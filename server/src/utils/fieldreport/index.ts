import mongoose from "mongoose";
import { StaffAccount } from "../../models/staffaccounts";
import { SalesRoute } from "../../models/salesroutes";
import { Visit } from "../../models/visit";
import { SalesOrder } from "../../models/salesorder";
import { Payment } from "../../models/payments";
import { LocationPing } from "../../models/locationping";
import { Account } from "../../models/accounts";
import { AdminSettings } from "../../models/adminsettings";
import { ProductService } from "../../models/products";
import { Category } from "../../models/categories";
import { Unit } from "../../models/units";

// ─────────────────────────────────────────────────────────────────────────────
// Salesman field analytics — one place that decides what a "call" is, so the
// admin reports and the salesman app dashboard can never disagree.
//
// For every salesman and every day in the range:
//   planned      = parties on the salesman's routes for that weekday
//   productive   = party visited AND an order booked (a visit record with an
//                  order, or simply an order by this salesman for the party)
//   unproductive = party visited, no order (salesman marked "No order")
//   missed       = planned party with no visit and no order, on a past day
//   pending      = the same, but for today (the day isn't over yet)
//   off-route    = a productive / unproductive call to a party that was not
//                  planned for that day
// Target = the salesman's monthly target (Staff Accounts -> Target Amount),
// achieved = order value booked by the salesman in that calendar month.
// All dates are business dates in IST (YYYY-MM-DD).
// ─────────────────────────────────────────────────────────────────────────────

const IST_OFFSET_MS = 330 * 60 * 1000;
export const istYMD = (d: Date = new Date()) => new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
const oid = (v: any) => new mongoose.Types.ObjectId(String(v));
const r2 = (n: number) => Math.round((n || 0) * 100) / 100;
const pct = (a: number, b: number) => (b > 0 ? r2((a / b) * 100) : 0);

const DAY3 = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_FULL: Record<string, string> = {
  sun: "Sunday", mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday",
};
const day3OfYMD = (ymd: string) => DAY3[new Date(`${ymd}T00:00:00Z`).getUTCDay()];
const norm3 = (d: any) => String(d ?? "").trim().slice(0, 3).toLowerCase();

export const daysBetween = (from: string, to: string) => {
  const out: string[] = [];
  let t = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(t) || !Number.isFinite(end)) return out;
  while (t <= end && out.length < 400) {
    out.push(new Date(t).toISOString().slice(0, 10));
    t += 86400000;
  }
  return out;
};

export const haversineM = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const hasLoc = (p: any) => p && typeof p.latitude === "number" && typeof p.longitude === "number" && !(p.latitude === 0 && p.longitude === 0);

const pingMeters = (list: any[]) => {
  let m = 0;
  for (let i = 1; i < list.length; i++) {
    const d = haversineM(list[i - 1].latitude, list[i - 1].longitude, list[i].latitude, list[i].longitude);
    if (d < 5000) m += d; // ignore GPS jumps
  }
  return m;
};

export type ReportFilter = { adminid: string; branchid?: string; salesmanid?: string; dateFrom: string; dateTo: string };

/** Geo-fence settings of a business. */
export const getGeoFence = async (adminid: any) => {
  const s: any = await AdminSettings.findOne({ adminid: oid(adminid) }).select("geoFenceEnabled geoFenceRadiusM").lean();
  return { enabled: !!s?.geoFenceEnabled, radiusM: Number(s?.geoFenceRadiusM) || 200 };
};

/**
 * GPS drift allowance: the fix's reported accuracy (metres) is taken off the
 * distance, capped so a very poor fix can never pass on its own. Indoors a
 * phone at the counter often reads 30-80 m off the shop's saved point.
 * Keep in sync with GEO_ACC_CAP_M in clientapp/src/utils/geo.ts.
 */
export const GEO_ACC_CAP_M = 100;

/** Is the salesman (lat/lng) close enough to the party to record a call / order? */
export const checkGeoFence = async (
  adminid: any, partyacc: any, lat?: number | null, lng?: number | null, accuracy?: number | null,
) => {
  const g = await getGeoFence(adminid);
  const party: any = await Account.findById(partyacc).select("latitude longitude name").lean();
  const partyHasLocation = hasLoc(party);
  const base = { enabled: g.enabled, radiusM: g.radiusM, partyHasLocation };
  const here = typeof lat === "number" && typeof lng === "number";
  const distanceM = partyHasLocation && here ? r2(haversineM(lat!, lng!, party.latitude, party.longitude)) : null;
  if (!g.enabled) return { ...base, allowed: true, distanceM, message: null };
  if (!here) return { ...base, allowed: false, distanceM, message: "Turn on GPS — orders can only be taken at the party's location." };
  // No saved location yet → nothing to fence against. Allowed, same as the
  // app's party list; the app saves this fix as the party's location.
  if (!partyHasLocation) return { ...base, allowed: true, distanceM, message: null };
  const acc = Math.min(Math.max(Number(accuracy) || 0, 0), GEO_ACC_CAP_M);
  if (distanceM! - acc > g.radiusM) {
    return {
      ...base, allowed: false, distanceM,
      message: `You are ${Math.round(distanceM!)} m away from ${party.name || "the party"}. Orders can be taken only within ${g.radiusM} m.`,
    };
  }
  return { ...base, allowed: true, distanceM, message: null };
};

/** Raw data + the per-salesman / per-day call log for a filter. */
export const buildFieldData = async (f: ReportFilter) => {
  const adminId = oid(f.adminid);
  const today = istYMD();
  const days = daysBetween(f.dateFrom, f.dateTo);

  const staffQ: any = { admin: adminId, role: "salesman", status: true };
  if (f.salesmanid) staffQ._id = oid(f.salesmanid);
  if (f.branchid) staffQ.$or = [{ branchid: oid(f.branchid) }, { branchid: null }];
  const salesmen: any[] = await StaffAccount.find(staffQ).select("name mobile target branchid").lean();
  const sIds = salesmen.map((s) => s._id);

  const routeQ: any = { adminid: adminId, salesmanid: { $in: sIds }, status: true };
  if (f.branchid) routeQ.branchid = oid(f.branchid);
  const routes: any[] = await SalesRoute.find(routeQ).select("routename salesmanid visitdays accounts dayWiseAccounts").lean();

  const visits: any[] = await Visit.find({
    adminid: adminId, salesmanid: { $in: sIds }, status: true,
    visitdate: { $gte: f.dateFrom, $lte: f.dateTo },
  }).lean();

  const orderQ: any = {
    adminid: adminId, salesmenid: { $in: sIds }, status: true,
    cancelStatus: { $ne: "cancelled" },
    billdate: { $gte: f.dateFrom, $lte: `${f.dateTo}￿` },
  };
  if (f.branchid) orderQ.branchid = oid(f.branchid);
  const orders: any[] = await SalesOrder.find(orderQ)
    .select("billnumber billdate partyacc salesmenid routeid totalamount productservice createdAt")
    .lean();

  const fromD = new Date(Date.parse(`${f.dateFrom}T00:00:00Z`) - IST_OFFSET_MS);
  const toD = new Date(Date.parse(`${f.dateTo}T00:00:00Z`) - IST_OFFSET_MS + 86400000);
  const payQ: any = {
    adminid: adminId, type: "receipt", status: true,
    paymentdate: { $gte: fromD, $lt: toD },
    $or: [{ createdby_id: { $in: sIds } }, { orderedby_id: { $in: sIds } }],
  };
  if (f.branchid) payQ.branchid = oid(f.branchid);
  const payments: any[] = await Payment.find(payQ).select("amount paymentdate createdby_id orderedby_id").lean();

  const pings: any[] = await LocationPing.find({
    adminid: adminId, staffid: { $in: sIds }, status: true,
    pingdate: { $gte: f.dateFrom, $lte: f.dateTo },
  }).select("staffid pingdate latitude longitude pingedAt").sort({ pingedAt: 1 }).lean();

  // Party details for everything referenced.
  const partyIds = new Set<string>();
  routes.forEach((r) => {
    (r.accounts || []).forEach((a: any) => partyIds.add(String(a)));
    (r.dayWiseAccounts || []).forEach((d: any) => (d.accounts || []).forEach((a: any) => partyIds.add(String(a))));
  });
  visits.forEach((v) => partyIds.add(String(v.partyacc)));
  orders.forEach((o) => partyIds.add(String(o.partyacc)));
  const parties: any[] = await Account.find({ _id: { $in: Array.from(partyIds).map(oid) } })
    .select("name mobile latitude longitude").lean();
  const partyMap = new Map(parties.map((p) => [String(p._id), p]));
  const routeMap = new Map(routes.map((r) => [String(r._id), r]));

  // planned[salesman][date] = Map(partyId -> routeId)
  const plannedFor = (sid: string, ymd: string) => {
    const d3 = day3OfYMD(ymd);
    const map = new Map<string, string>();
    routes.filter((r) => String(r.salesmanid) === sid).forEach((r) => {
      const dw = (r.dayWiseAccounts || []).filter((d: any) => norm3(d.day) === d3);
      if (dw.length) {
        dw.forEach((d: any) => (d.accounts || []).forEach((a: any) => map.set(String(a), String(r._id))));
      } else if ((r.visitdays || []).some((d: any) => norm3(d) === d3) && !(r.dayWiseAccounts || []).length) {
        (r.accounts || []).forEach((a: any) => map.set(String(a), String(r._id)));
      }
    });
    return map;
  };

  const log: any[] = [];
  for (const s of salesmen) {
    const sid = String(s._id);
    for (const ymd of days) {
      const planned = plannedFor(sid, ymd);
      const dayVisits = visits.filter((v) => String(v.salesmanid) === sid && v.visitdate === ymd);
      const dayOrders = orders.filter((o) => String(o.salesmenid) === sid && String(o.billdate).slice(0, 10) === ymd);

      const touched = new Map<string, { v: any[]; o: any[] }>();
      const touch = (pid: string) => {
        if (!touched.has(pid)) touched.set(pid, { v: [], o: [] });
        return touched.get(pid)!;
      };
      dayVisits.forEach((v) => touch(String(v.partyacc)).v.push(v));
      dayOrders.forEach((o) => touch(String(o.partyacc)).o.push(o));

      const allParties = new Set<string>([...planned.keys(), ...touched.keys()]);
      for (const pid of allParties) {
        const t = touched.get(pid);
        const p = partyMap.get(pid) || {};
        const onRoute = planned.has(pid);
        const routeId = planned.get(pid) || String(t?.o.find((o) => o.routeid)?.routeid || t?.v.find((v) => v.routeid)?.routeid || "") || null;
        const visit = t?.v.sort((a, b) => Number(!!b.ordercreated) - Number(!!a.ordercreated))[0];
        let status: string;
        if (t && (t.o.length || t.v.some((v) => v.ordercreated))) status = "productive";
        else if (t && t.v.some((v) => v.visited)) status = "unproductive";
        else status = ymd >= today ? "pending" : "missed";
        const orderAmount = (t?.o || []).reduce((a, o) => a + (o.totalamount || 0), 0);
        const vt = visit?.visitedAt || visit?.createdAt || t?.o[0]?.createdAt;
        log.push({
          date: ymd,
          day: DAY_FULL[day3OfYMD(ymd)],
          salesmanid: sid,
          salesmanname: s.name,
          routeid: routeId,
          routename: routeId ? routeMap.get(routeId)?.routename || null : null,
          partyid: pid,
          partyname: (p as any).name || "Unknown party",
          partymobile: (p as any).mobile || null,
          status,
          onRoute,
          reason: visit?.reason || null,
          notes: visit?.notes || null,
          visitTime: vt ? new Date(vt).toISOString() : null,
          orderNo: (t?.o || []).map((o) => o.billnumber).filter(Boolean).join(", ") || null,
          orderAmount: t?.o.length ? r2(orderAmount) : null,
          distanceM: visit && hasLoc(visit) && hasLoc(p) ? r2(haversineM(visit.latitude, visit.longitude, (p as any).latitude, (p as any).longitude)) : null,
        });
      }
    }
  }

  return { salesmen, routes, visits, orders, payments, pings, log, days, today };
};

const emptyDaily = (date: string) => ({ date, planned: 0, productive: 0, unproductive: 0, missed: 0, pending: 0, orders: 0, amount: 0, collections: 0 });

/** Per-salesman performance for the filter (plus month-target figures for the month of dateTo). */
export const buildPerformance = async (f: ReportFilter) => {
  const data = await buildFieldData(f);
  const targetMonth = f.dateTo.slice(0, 7);
  const monthFrom = `${targetMonth}-01`;
  const monthTo = `${targetMonth}-31`;
  const monthOrders: any[] = await SalesOrder.find({
    adminid: oid(f.adminid), salesmenid: { $in: data.salesmen.map((s) => s._id) }, status: true,
    cancelStatus: { $ne: "cancelled" },
    billdate: { $gte: monthFrom, $lte: `${monthTo}￿` },
    ...(f.branchid ? { branchid: oid(f.branchid) } : {}),
  }).select("salesmenid totalamount").lean();

  return data.salesmen.map((s) => {
    const sid = String(s._id);
    const rows = data.log.filter((r) => r.salesmanid === sid);
    const ord = data.orders.filter((o) => String(o.salesmenid) === sid);
    const pays = data.payments.filter((p) => String(p.orderedby_id || p.createdby_id) === sid);
    const productive = rows.filter((r) => r.status === "productive").length;
    const unproductive = rows.filter((r) => r.status === "unproductive").length;
    const planned = rows.filter((r) => r.onRoute).length;
    const plannedDone = rows.filter((r) => r.onRoute && (r.status === "productive" || r.status === "unproductive")).length;
    const orderAmount = ord.reduce((a, o) => a + (o.totalamount || 0), 0);
    const products = new Set<string>();
    let qty = 0;
    ord.forEach((o) => (o.productservice || []).forEach((l: any) => {
      products.add(String(l.productserviceid));
      qty += Number(l.qty) || 0;
    }));

    const daily = data.days.map((d) => {
      const x = emptyDaily(d);
      rows.filter((r) => r.date === d).forEach((r) => {
        if (r.onRoute) x.planned++;
        if (r.status in x) (x as any)[r.status]++;
      });
      const od = ord.filter((o) => String(o.billdate).slice(0, 10) === d);
      x.orders = od.length;
      x.amount = r2(od.reduce((a, o) => a + (o.totalamount || 0), 0));
      x.collections = r2(pays.filter((p) => istYMD(new Date(p.paymentdate)) === d).reduce((a, p) => a + (p.amount || 0), 0));
      return x;
    });

    const sp = data.pings.filter((p) => String(p.staffid) === sid);
    let meters = 0;
    data.days.forEach((d) => { meters += pingMeters(sp.filter((p) => p.pingdate === d)); });
    const workingDays = new Set([
      ...rows.filter((r) => r.status === "productive" || r.status === "unproductive").map((r) => r.date),
      ...sp.map((p) => p.pingdate),
    ]).size;

    const monthTarget = Number(s.target) || 0;
    const monthAchieved = r2(monthOrders.filter((o) => String(o.salesmenid) === sid).reduce((a, o) => a + (o.totalamount || 0), 0));
    const totalCalls = productive + unproductive;

    return {
      salesmanid: sid,
      salesmanname: s.name,
      mobile: s.mobile || null,
      // Names of the routes assigned to this salesman (one "Route" column in the report).
      routes: data.routes.filter((r: any) => String(r.salesmanid) === sid).map((r: any) => r.routename).filter(Boolean),
      plannedCalls: planned,
      productiveCalls: productive,
      unproductiveCalls: unproductive,
      missedCalls: rows.filter((r) => r.status === "missed").length,
      pendingCalls: rows.filter((r) => r.status === "pending").length,
      offRouteCalls: rows.filter((r) => !r.onRoute && (r.status === "productive" || r.status === "unproductive")).length,
      totalCalls,
      productivityPct: pct(productive, totalCalls),
      coveragePct: pct(plannedDone, planned),
      orders: ord.length,
      ordersOnRoute: ord.filter((o) => o.routeid).length,
      ordersOffRoute: ord.filter((o) => !o.routeid).length,
      orderAmount: r2(orderAmount),
      avgOrderValue: ord.length ? r2(orderAmount / ord.length) : 0,
      totalQty: r2(qty),
      linesSold: products.size,
      collections: r2(pays.reduce((a, p) => a + (p.amount || 0), 0)),
      km: r2(meters / 1000),
      workingDays,
      targetMonth,
      monthTarget,
      monthAchieved,
      monthAchievedPct: pct(monthAchieved, monthTarget),
      monthRemaining: r2(Math.max(monthTarget - monthAchieved, 0)),
      daily,
    };
  });
};

/** Product / category sales per salesman. */
export const buildProductSales = async (f: ReportFilter) => {
  const { salesmen, orders } = await buildFieldData({ ...f });
  const nameOf = new Map(salesmen.map((s) => [String(s._id), s.name]));
  const pIds = new Set<string>();
  orders.forEach((o) => (o.productservice || []).forEach((l: any) => pIds.add(String(l.productserviceid))));
  const products: any[] = await ProductService.find({ _id: { $in: Array.from(pIds).map(oid) } }).select("name categoryid").lean();
  const pMap = new Map(products.map((p) => [String(p._id), p]));
  const cIds = Array.from(new Set(products.map((p) => p.categoryid && String(p.categoryid)).filter(Boolean)));
  const cats: any[] = await Category.find({ _id: { $in: cIds.map(oid) } }).select("categoryname").lean();
  const cMap = new Map(cats.map((c) => [String(c._id), c.categoryname]));

  const acc = new Map<string, any>();
  orders.forEach((o) => {
    const sid = String(o.salesmenid);
    const seen = new Set<string>();
    (o.productservice || []).forEach((l: any) => {
      const pid = String(l.productserviceid);
      const key = `${sid}|${pid}`;
      const p = pMap.get(pid) || {};
      if (!acc.has(key)) {
        const cid = (p as any).categoryid ? String((p as any).categoryid) : null;
        acc.set(key, {
          salesmanid: sid, salesmanname: nameOf.get(sid) || "",
          productid: pid, productname: (p as any).name || "Deleted product",
          categoryid: cid, categoryname: cid ? cMap.get(cid) || "Uncategorised" : "Uncategorised",
          qty: 0, amount: 0, orders: 0,
        });
      }
      const row = acc.get(key);
      row.qty += Number(l.qty) || 0;
      row.amount += Number(l.amount) || 0;
      if (!seen.has(pid)) { row.orders++; seen.add(pid); }
    });
  });
  return Array.from(acc.values()).map((r) => ({ ...r, qty: r2(r.qty), amount: r2(r.amount) }))
    .sort((a, b) => b.amount - a.amount);
};


/**
 * Every order line booked by salesmen in the period — the "daily sales report"
 * level of detail: which party, which product, variant and unit, how many,
 * at what rate. The admin report groups / filters these on screen.
 * baseqty = qty × unitqty (e.g. 2 Dozen of 12 → 24 pcs) in the variant's base unit.
 */
export const buildOrderLines = async (f: ReportFilter) => {
  const { salesmen, routes, orders } = await buildFieldData({ ...f });
  const nameOf = new Map(salesmen.map((s) => [String(s._id), s.name]));
  const routeOf = new Map(routes.map((r: any) => [String(r._id), r.routename]));

  const pIds = new Set<string>(), aIds = new Set<string>(), uIds = new Set<string>();
  orders.forEach((o) => {
    if (o.partyacc) aIds.add(String(o.partyacc));
    (o.productservice || []).forEach((l: any) => {
      pIds.add(String(l.productserviceid));
      if (l.salesunitid) uIds.add(String(l.salesunitid));
    });
  });
  const products: any[] = await ProductService.find({ _id: { $in: Array.from(pIds).map(oid) } })
    .select("name categoryid productvariants._id productvariants.name productvariants.baseunitid").lean();
  const pMap = new Map(products.map((p) => [String(p._id), p]));
  products.forEach((p) => (p.productvariants || []).forEach((v: any) => v.baseunitid && uIds.add(String(v.baseunitid))));
  const cIds = Array.from(new Set(products.map((p) => p.categoryid && String(p.categoryid)).filter(Boolean)));
  const [cats, units, parties]: any[] = await Promise.all([
    Category.find({ _id: { $in: cIds.map(oid) } }).select("categoryname").lean(),
    Unit.find({ _id: { $in: Array.from(uIds).map(oid) } }).select("unitname").lean(),
    Account.find({ _id: { $in: Array.from(aIds).map(oid) } }).select("name mobile city").lean(),
  ]);
  const cMap = new Map(cats.map((c: any) => [String(c._id), c.categoryname]));
  const uMap = new Map(units.map((u: any) => [String(u._id), u.unitname]));
  const aMap = new Map(parties.map((a: any) => [String(a._id), a]));

  const rows: any[] = [];
  orders.forEach((o) => {
    const sid = String(o.salesmenid);
    const party: any = aMap.get(String(o.partyacc)) || {};
    (o.productservice || []).forEach((l: any) => {
      const p: any = pMap.get(String(l.productserviceid)) || {};
      const v: any = (p.productvariants || []).find((x: any) => String(x._id) === String(l.variantid)) || {};
      const cid = p.categoryid ? String(p.categoryid) : null;
      const qty = Number(l.qty) || 0;
      const unitqty = Number(l.unitqty) || 1;
      rows.push({
        orderid: String(o._id),
        billnumber: o.billnumber || "",
        date: String(o.billdate || "").slice(0, 10),
        salesmanid: sid,
        salesmanname: nameOf.get(sid) || "",
        routename: o.routeid ? routeOf.get(String(o.routeid)) || null : null,
        partyid: o.partyacc ? String(o.partyacc) : null,
        partyname: party.name || "",
        partycity: party.city || null,
        partymobile: party.mobile || null,
        productid: String(l.productserviceid),
        productname: p.name || "Deleted product",
        categoryid: cid,
        categoryname: cid ? cMap.get(cid) || "Uncategorised" : "Uncategorised",
        variantname: v.name || null,
        unitname: l.salesunitid ? uMap.get(String(l.salesunitid)) || null : null,
        baseunitname: v.baseunitid ? uMap.get(String(v.baseunitid)) || null : null,
        unitqty,
        qty: r2(qty),
        baseqty: r2(qty * unitqty),
        rate: r2(Number(l.rate) || 0),
        discount: r2(Number(l.discount) || 0),
        gst: Number(l.gst) || 0,
        amount: r2(Number(l.amount) || 0),
      });
    });
  });
  return rows.sort((a, b) => b.date.localeCompare(a.date) || String(b.billnumber).localeCompare(String(a.billnumber)));
};
