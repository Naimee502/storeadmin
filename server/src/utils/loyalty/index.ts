import cron from "node-cron";
import mongoose, { Types } from "mongoose";
import { Admin } from "../../models/admin";
import { AdminSettings } from "../../models/adminsettings";
import { LoyaltyEntry } from "../../models/loyalty";
import { pushNotification } from "../../models/notifications";
import { resolveTenant, TenantError } from "../tenant";

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const oid = (v: any) => (v && typeof v === "object" ? v._id || v.id : v);

/** Loyalty is opt-in: on only when the business has ticked the Loyalty Points module. */
export const loyaltyOn = async (adminid: any) => {
  const a: any = await Admin.findById(oid(adminid)).select("allowedmodules").lean();
  return Array.isArray(a?.allowedmodules) && a.allowedmodules.some((m: string) => String(m).toLowerCase() === "loyalty");
};

/** The business's rules, with defaults for anything left blank. */
export const loyaltyRules = async (adminid: any) => {
  const s: any = (await AdminSettings.findOne({ adminid: oid(adminid) }).lean()) || {};
  const num = (v: any, d: number) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? d : Number(v));
  return {
    earnPer100: num(s.loyaltyEarnPer100, 1),
    pointValue: num(s.loyaltyPointValue, 1),
    minBill: num(s.loyaltyMinBill, 0),
    maxEarn: num(s.loyaltyMaxEarn, 0),
    expiryDays: num(s.loyaltyExpiryDays, 365),
    minRedeem: num(s.loyaltyMinRedeem, 0),
    maxRedeemPercent: num(s.loyaltyMaxRedeemPercent, 100),
  };
};
export type LoyaltyRules = Awaited<ReturnType<typeof loyaltyRules>>;

export const pointsFor = (billTotal: number, r: LoyaltyRules) => {
  if (!(billTotal > 0) || billTotal < r.minBill || !(r.earnPer100 > 0)) return 0;
  const p = Math.floor((billTotal / 100) * r.earnPer100);
  return r.maxEarn > 0 ? Math.min(p, r.maxEarn) : p;
};

export const balanceOf = async (adminid: any, partyid: any) => {
  const [row]: any[] = await LoyaltyEntry.aggregate([
    { $match: { adminid: new Types.ObjectId(String(oid(adminid))), partyid: new Types.ObjectId(String(oid(partyid))) } },
    { $group: { _id: null, points: { $sum: "$points" } } },
  ]);
  return r2(row?.points || 0);
};

const sumFor = async (docmodel: string, docid: any, kind: string) => {
  const [row]: any[] = await LoyaltyEntry.aggregate([
    { $match: { docmodel, docid: new Types.ObjectId(String(docid)), kind } },
    { $group: { _id: null, points: { $sum: "$points" } } },
  ]);
  return r2(row?.points || 0);
};

/**
 * Check the points a bill or order wants to use and set its loyalty discount from the rules.
 * The total moves by any difference from the client's figure, so the bill always balances.
 */
export const applyRedeem = async (input: any, docmodel: "SalesInvoice" | "SalesOrder", docid?: any, context?: any) => {
  if (!input || typeof input !== "object") return;
  const points = Number(input.loyaltyredeempoints) || 0;
  const clientDiscount = Number(input.loyaltydiscount) || 0;
  if (!points) {
    if (clientDiscount) input.totalamount = r2(Number(input.totalamount || 0) + clientDiscount);
    // Left out stays left out, so bills without points look as they always did.
    if (input.loyaltyredeempoints !== undefined || input.loyaltydiscount !== undefined) {
      input.loyaltyredeempoints = 0;
      input.loyaltydiscount = 0;
    }
    return;
  }
  // An order being closed into a bill hands its points to that bill, so nothing to check here.
  if (docmodel === "SalesOrder" && input.isConverted) return;
  if (points < 0 || !Number.isInteger(points)) throw new TenantError("Enter whole loyalty points to redeem.", "BAD_USER_INPUT");
  const adminid = oid(input.adminid) || (context ? (await resolveTenant(context)).adminid : null);
  const partyid = oid(input.partyacc);
  if (!adminid || !partyid) throw new TenantError("Pick the party to redeem loyalty points.", "BAD_USER_INPUT");
  if (context?.user?.type === "party" && String(partyid) !== String(context.user.id)) throw new TenantError("You can use only your own points.");
  if (!(await loyaltyOn(adminid))) throw new TenantError("Loyalty points are not on for this business.", "BAD_USER_INPUT");
  const r = await loyaltyRules(adminid);
  // Points this same bill already holds count as available when it is edited.
  let held = docid ? -(await sumFor(docmodel, docid, "redeem")) : 0;
  // A bill made from an order takes over the points that order holds.
  if (docmodel === "SalesInvoice" && input.sourceorderid && Types.ObjectId.isValid(String(input.sourceorderid))) {
    held += -(await sumFor("SalesOrder", input.sourceorderid, "redeem"));
  }
  const available = (await balanceOf(adminid, partyid)) + held;
  if (points > available) throw new TenantError(`Only ${available} loyalty points are available.`, "BAD_USER_INPUT");
  if (r.minRedeem > 0 && points < r.minRedeem) throw new TenantError(`At least ${r.minRedeem} points are needed to redeem.`, "BAD_USER_INPUT");
  const discount = r2(points * r.pointValue);
  const billBefore = r2(Number(input.totalamount || 0) + clientDiscount);
  const cap = r2((billBefore * r.maxRedeemPercent) / 100);
  if (discount > cap + 0.01) throw new TenantError(`Points can pay up to ${r.maxRedeemPercent}% of the bill (₹${cap}).`, "BAD_USER_INPUT");
  input.loyaltydiscount = discount;
  input.totalamount = r2(billBefore - discount);
};

/** Bring a bill's or order's earn and redeem lines in line with the document as it now stands. */
export const syncLoyalty = async (docmodel: "SalesInvoice" | "SalesOrder", docid: any, opts: { created?: boolean } = {}) => {
  try {
    if (!docid || !Types.ObjectId.isValid(String(docid))) return;
    const Model: any = mongoose.model(docmodel);
    const d: any = await Model.findById(docid).lean();
    if (!d || !d.partyacc) return;
    const active = d.status !== false && d.cancelStatus !== "cancelled" && !(docmodel === "SalesOrder" && d.isConverted);
    const docno = `${docmodel === "SalesOrder" ? "SO" : "INV"}-${d.billnumber || ""}`;
    const write = async (kind: string, want: number) => {
      const have = await sumFor(docmodel, d._id, kind);
      const delta = r2(want - have);
      if (Math.abs(delta) < 0.001) return;
      await LoyaltyEntry.create({ adminid: d.adminid, partyid: d.partyacc, kind, points: delta, docmodel, docid: d._id, docno });
    };
    await write("redeem", active ? -(Number(d.loyaltyredeempoints) || 0) : 0);
    if (docmodel !== "SalesInvoice") return;
    // Earning starts with bills made after loyalty was turned on; returns reduce it.
    const tracked = d.loyaltyearned !== undefined && d.loyaltyearned !== null;
    if (!tracked && !opts.created) return;
    let want = 0;
    const party: any = await mongoose.model("Account").findById(d.partyacc).select("name").lean();
    // A shared walk-in / cash customer account does not collect points.
    const walkIn = /walk[\s-]?in|cash\s*(customer|sale)/i.test(String(party?.name || ""));
    if (active && !walkIn && (await loyaltyOn(d.adminid))) {
      const returned = await mongoose.model("SalesReturn").aggregate([
        { $match: { sourceInvoiceId: d._id, status: { $ne: false } } },
        { $group: { _id: null, t: { $sum: "$totalamount" } } },
      ]);
      want = pointsFor(Number(d.totalamount || 0) - Number(returned[0]?.t || 0), await loyaltyRules(d.adminid));
    }
    if (!tracked && want === 0) return;
    await write("earn", want);
    if (want !== d.loyaltyearned) await Model.updateOne({ _id: d._id }, { $set: { loyaltyearned: want } });
    if (opts.created && want > 0) {
      pushNotification({ adminid: d.adminid, targettype: "party", targetid: d.partyacc, ntype: "loyalty", title: `You earned ${want} loyalty points`, message: `${docno} · use them on your next order`, docmodel: "SalesInvoice", docid: d._id }).catch(() => {});
    }
  } catch (e) {
    console.error("loyalty sync failed:", e);
  }
};

const idOf = (args: any[], result: any) => oid(result) && typeof result === "object" ? oid(result) : args[1]?.id;

/** Run the loyalty checks and sync around these invoice / order / return mutations. */
export const withLoyalty = (map: any, docmodel: "SalesInvoice" | "SalesOrder" | "SalesReturn") => {
  if (!map?.Mutation) return map;
  const M = { ...map.Mutation };
  const wrap = (field: string, fn: (args: any[], result: any) => Promise<void>, before?: (args: any[]) => Promise<void>) => {
    const orig = M[field];
    if (typeof orig !== "function") return;
    M[field] = async (...args: any[]) => {
      if (before) await before(args);
      const result = await orig(...args);
      await fn(args, result);
      return result;
    };
  };
  if (docmodel === "SalesReturn") {
    const resync = async (args: any[], result: any) => {
      const id = idOf(args, result);
      const ret: any = id ? await mongoose.model("SalesReturn").findById(id).select("sourceInvoiceId").lean() : null;
      if (ret?.sourceInvoiceId) await syncLoyalty("SalesInvoice", ret.sourceInvoiceId);
    };
    for (const f of ["addSalesReturn", "editSalesReturn", "deleteSalesReturn", "resetSalesReturn"]) wrap(f, resync);
    return { ...map, Mutation: M };
  }
  const add = docmodel === "SalesInvoice" ? "addSalesInvoice" : "addSalesOrder";
  const edit = docmodel === "SalesInvoice" ? "editSalesInvoice" : "editSalesOrder";
  wrap(add, async (args, result) => {
    await syncLoyalty(docmodel, idOf(args, result), { created: true });
    if (docmodel === "SalesInvoice" && args[1]?.input?.sourceorderid) await syncLoyalty("SalesOrder", args[1].input.sourceorderid);
  }, (args) => applyRedeem(args[1]?.input, docmodel, undefined, args[2]));
  wrap(edit, async (args) => syncLoyalty(docmodel, args[1]?.id), async (args) => {
    const input = args[1]?.input;
    if (!input) return;
    if (input.loyaltyredeempoints === undefined) {
      // A screen that does not know loyalty sends the total before points: keep the points and take them off again.
      if (input.totalamount === undefined || !Types.ObjectId.isValid(String(args[1].id))) return;
      const d: any = await mongoose.model(docmodel).findById(args[1].id).select("loyaltyredeempoints adminid partyacc").lean();
      if (!(Number(d?.loyaltyredeempoints) > 0)) return;
      input.loyaltyredeempoints = d.loyaltyredeempoints;
      input.loyaltydiscount = 0;
      input.adminid = input.adminid || d.adminid;
      input.partyacc = input.partyacc || d.partyacc;
    }
    await applyRedeem(input, docmodel, args[1].id, args[2]);
  });
  const fields = docmodel === "SalesInvoice"
    ? ["deleteSalesInvoice", "resetSalesInvoice", "cancelSalesInvoice", "reopenSalesInvoice"]
    : ["deleteSalesOrder", "resetSalesOrder", "cancelSalesOrder", "reopenSalesOrder", "confirmSalesOrder", "markSalesOrderDispatched", "markSalesOrderDelivered"];
  for (const f of fields) wrap(f, async (args, result) => {
    const id = idOf(args, result);
    await syncLoyalty(docmodel, id);
    // Order-only businesses get the invoice made inside these steps.
    if (docmodel === "SalesOrder" && id) {
      const inv: any = await mongoose.model("SalesInvoice").findOne({ sourceorderid: id }).select("_id createdAt").lean();
      if (inv) await syncLoyalty("SalesInvoice", inv._id, { created: Date.now() - new Date(inv.createdAt).getTime() < 10 * 60000 });
    }
  });
  if (docmodel === "SalesInvoice") {
    wrap("convertSalesOrderToInvoice", async (args, result) => {
      await syncLoyalty("SalesInvoice", oid(result), { created: true });
      await syncLoyalty("SalesOrder", args[1]?.id);
    });
  }
  return { ...map, Mutation: M };
};

/** Daily: points older than the business's expiry days, not yet used, expire (oldest first). */
export const startLoyaltyExpiryScheduler = () => {
  cron.schedule("37 1 * * *", async () => {
    try {
      const admins: any[] = await Admin.find({ allowedmodules: { $regex: /^loyalty$/i } }).select("_id").lean();
      for (const a of admins) {
        const r = await loyaltyRules(a._id);
        if (!(r.expiryDays > 0)) continue;
        const cutoff = new Date(Date.now() - r.expiryDays * 86400000);
        const rows: any[] = await LoyaltyEntry.aggregate([
          { $match: { adminid: a._id } },
          { $group: {
            _id: "$partyid",
            oldEarn: { $sum: { $cond: [{ $and: [{ $eq: ["$kind", "earn"] }, { $lte: ["$createdAt", cutoff] }] }, "$points", 0] } },
            used: { $sum: { $cond: [{ $in: ["$kind", ["redeem", "expire"]] }, "$points", 0] } },
            total: { $sum: "$points" },
          } },
        ]);
        for (const row of rows) {
          const due = r2(Math.min(row.oldEarn + row.used, row.total));
          if (due >= 1) {
            await LoyaltyEntry.create({ adminid: a._id, partyid: row._id, kind: "expire", points: -Math.floor(due), note: `Older than ${r.expiryDays} days` });
          }
        }
      }
    } catch (e) {
      console.error("loyalty expiry failed:", e);
    }
  }, { timezone: "Asia/Kolkata" });
};
