import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@apollo/client";
import HomeLayout from "../../../layouts/home";
import ReportTable, { type ReportColumn } from "../../../components/reporttable";
import { useStaffQuery } from "../../../graphql/hooks/staffaccounts";
import { useLatestLocationsQuery, useLocationPingsQuery, useTravelSummaryQuery } from "../../../graphql/hooks/locationping";
import {
  GET_SALESMAN_PERFORMANCE, GET_SALESMAN_CALL_LOG, GET_SALESMAN_PRODUCT_SALES,
} from "../../../graphql/queries/salesmanreport";
import { cumulativeKm } from "../../../utils/travel";
import LiveTrackingMap from "../../../components/livetrackingmap";
import { useAppSelector } from "../../../redux/hooks";
import { formatDateDMY, formatDateTimeDMY, todayYMD, shiftDaysYMD } from "../../../utils/helper";
import { FaChartBar, FaListAlt, FaBullseye, FaBoxes, FaMapMarkedAlt } from "react-icons/fa";

// ─────────────────────────────────────────────────────────────────────────────
// Salesman Field Report. All figures come from the server
// (getSalesmanPerformance / getSalesmanCallLog / getSalesmanProductSales),
// which applies one rule set for calls:
//   Productive   = visited and an order booked
//   Unproductive = visited, no order (with the salesman's reason)
//   Missed       = on the route for that day, never visited (past days)
//   Pending      = on today's route, not visited yet
// The salesman app dashboard uses the same server code, so both always agree.
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview", label: "Overview", icon: <FaChartBar className="text-amber-500" /> },
  { id: "calls", label: "Call Statement", icon: <FaListAlt className="text-blue-500" /> },
  { id: "targets", label: "Target vs Achievement", icon: <FaBullseye className="text-rose-500" /> },
  { id: "products", label: "Product & Category", icon: <FaBoxes className="text-violet-500" /> },
  { id: "live", label: "Live Tracking", icon: <FaMapMarkedAlt className="text-emerald-500" /> },
];

const STATUS: Record<string, { label: string; cls: string; bar: string }> = {
  productive: { label: "Productive", cls: "bg-green-100 text-green-800", bar: "#16a34a" },
  unproductive: { label: "Unproductive", cls: "bg-amber-100 text-amber-800", bar: "#f59e0b" },
  missed: { label: "Missed", cls: "bg-red-100 text-red-700", bar: "#dc2626" },
  pending: { label: "Pending", cls: "bg-gray-100 text-gray-600", bar: "#9ca3af" },
};

const inr = (n: any) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const n2 = (n: any) => Number(n || 0).toFixed(2);

const geocodeCache: Record<string, string> = {};

const Tile: React.FC<{ label: string; value: string; sub?: string; tone?: string }> = ({ label, value, sub, tone }) => (
  <div className="bg-white border rounded-lg p-3">
    <div className="text-xs text-gray-500">{label}</div>
    <div className={`text-xl font-bold ${tone || "text-gray-800"}`}>{value}</div>
    {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
  </div>
);

const Progress: React.FC<{ pct: number }> = ({ pct }) => {
  const p = Math.max(0, Math.min(pct, 100));
  const color = pct >= 100 ? "#16a34a" : pct >= 60 ? "#2563eb" : pct >= 30 ? "#f59e0b" : "#dc2626";
  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <div className="flex-1 h-2 rounded bg-gray-200 overflow-hidden">
        <div style={{ width: `${p}%`, background: color }} className="h-2" />
      </div>
      <span className="text-xs font-semibold w-12 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
};

/** Day-by-day call outcome bars + order value. */
const DailyChart: React.FC<{ daily: any[] }> = ({ daily }) => {
  const maxCalls = Math.max(1, ...daily.map((d) => d.productive + d.unproductive + d.missed + d.pending));
  const maxAmt = Math.max(1, ...daily.map((d) => d.amount));
  if (!daily.length) return null;
  return (
    <div className="bg-white border rounded-lg p-4 mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="font-semibold text-gray-700">Daily calls &amp; order value</div>
        <div className="flex flex-wrap gap-3 text-xs text-gray-600">
          {["productive", "unproductive", "missed", "pending"].map((k) => (
            <span key={k} className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: STATUS[k].bar }} />
              {STATUS[k].label}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-1 rounded" style={{ background: "#2563eb" }} /> Order value
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="flex items-end gap-1 h-44" style={{ minWidth: daily.length * 22 }}>
          {daily.map((d) => {
            const total = d.productive + d.unproductive + d.missed + d.pending;
            return (
              <div
                key={d.date}
                className="flex-1 flex flex-col items-center justify-end h-full relative"
                title={`${formatDateDMY(d.date)}\nProductive ${d.productive} · Unproductive ${d.unproductive} · Missed ${d.missed} · Pending ${d.pending}\nOrders ${d.orders} · ${inr(d.amount)}`}
              >
                <div
                  className="absolute left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
                  style={{ bottom: `calc(${(d.amount / maxAmt) * 100}% - 3px)`, background: d.amount ? "#2563eb" : "transparent" }}
                />
                <div className="w-full max-w-[18px] flex flex-col-reverse" style={{ height: `${(total / maxCalls) * 100}%` }}>
                  {["productive", "unproductive", "missed", "pending"].map((k) =>
                    d[k] ? <div key={k} style={{ flex: d[k], background: STATUS[k].bar }} /> : null
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-1 mt-1" style={{ minWidth: daily.length * 22 }}>
          {daily.map((d, i) => (
            <div key={d.date} className="flex-1 text-center text-[10px] text-gray-400">
              {daily.length <= 14 || i % Math.ceil(daily.length / 14) === 0 ? d.date.slice(8, 10) + "/" + d.date.slice(5, 7) : ""}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const SalesmanFieldReport: React.FC = () => {
  const [tab, setTab] = useState("overview");
  const { type, admin, branch, staff } = useAppSelector((s: any) => s.auth);
  const selectedBranchId = useAppSelector((s: any) => s.selectedBranch?.branchId);
  const adminId = type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : type === "staff" ? staff?.admin?.id : undefined;
  const branchId = type === "admin" ? selectedBranchId : type === "branch" ? branch?.id : type === "staff" ? staff?.branchid?.id : undefined;

  const { data: staffData } = useStaffQuery();
  const salesmen = [...(staffData?.getStaffAccounts || [])].filter((s: any) => s.role?.toLowerCase() === "salesman");

  // ── Shared filter (all tabs except Live Tracking) ──
  const [draft, setDraft] = useState({ fromDate: shiftDaysYMD(-29), toDate: todayYMD(), salesmanid: "" });
  const [applied, setApplied] = useState(draft);
  const reportFilter = useMemo(() => ({
    adminid: adminId,
    branchid: branchId || undefined,
    salesmanid: applied.salesmanid || undefined,
    dateFrom: applied.fromDate,
    dateTo: applied.toDate,
  }), [adminId, branchId, applied]);
  const skip = !adminId || !applied.fromDate || !applied.toDate;

  const { data: perfLive, previousData: perfPrev, loading: perfLoading } = useQuery(GET_SALESMAN_PERFORMANCE, {
    variables: { filter: reportFilter }, skip: skip || (tab !== "overview" && tab !== "targets"), fetchPolicy: "cache-and-network",
  });
  const { data: logLive, previousData: logPrev, loading: logLoading } = useQuery(GET_SALESMAN_CALL_LOG, {
    variables: { filter: reportFilter }, skip: skip || tab !== "calls", fetchPolicy: "cache-and-network",
  });
  const { data: prodLive, previousData: prodPrev, loading: prodLoading } = useQuery(GET_SALESMAN_PRODUCT_SALES, {
    variables: { filter: reportFilter }, skip: skip || tab !== "products", fetchPolicy: "cache-and-network",
  });
  // Keep showing the previous result while a new filter loads — no full-screen
  // loader / blank page on every Apply, Reset or quick-date click.
  const perfData = perfLive ?? perfPrev;
  const logData = logLive ?? logPrev;
  const prodData = prodLive ?? prodPrev;
  const perf: any[] = (perfData as any)?.getSalesmanPerformance || [];
  const callLog: any[] = (logData as any)?.getSalesmanCallLog || [];
  const prodRows: any[] = (prodData as any)?.getSalesmanProductSales || [];

  // ReportTable wants filter state even when we render our own filter bar.
  const [tf, setTf] = useState<{ [k: string]: any }>({});
  const [taf, setTaf] = useState<{ [k: string]: any }>({});

  // ── Overview ──
  const totals = useMemo(() => {
    const t: any = { planned: 0, productive: 0, unproductive: 0, missed: 0, pending: 0, offRoute: 0, orders: 0, amount: 0, collections: 0, km: 0 };
    perf.forEach((p) => {
      t.planned += p.plannedCalls; t.productive += p.productiveCalls; t.unproductive += p.unproductiveCalls;
      t.missed += p.missedCalls; t.pending += p.pendingCalls; t.offRoute += p.offRouteCalls;
      t.orders += p.orders; t.amount += p.orderAmount; t.collections += p.collections; t.km += p.km;
    });
    t.calls = t.productive + t.unproductive;
    t.productivity = t.calls ? (t.productive / t.calls) * 100 : 0;
    t.coverage = t.planned ? ((t.planned - t.missed - t.pending) / t.planned) * 100 : 0;
    t.aov = t.orders ? t.amount / t.orders : 0;
    return t;
  }, [perf]);

  const dailyAll = useMemo(() => {
    const m = new Map<string, any>();
    perf.forEach((p) => p.daily.forEach((d: any) => {
      const x = m.get(d.date) || { date: d.date, planned: 0, productive: 0, unproductive: 0, missed: 0, pending: 0, orders: 0, amount: 0, collections: 0 };
      Object.keys(x).forEach((k) => { if (k !== "date") x[k] += d[k] || 0; });
      m.set(d.date, x);
    }));
    return Array.from(m.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [perf]);

  const perfRows = useMemo(() => [...perf]
    .sort((a, b) => b.orderAmount - a.orderAmount)
    .map((p, i) => ({
      rank: i + 1,
      name: p.salesmanname,
      planned: p.plannedCalls,
      productive: p.productiveCalls,
      unproductive: p.unproductiveCalls,
      missed: p.missedCalls,
      pending: p.pendingCalls,
      offRoute: p.offRouteCalls,
      productivity: `${p.productivityPct.toFixed(0)}%`,
      coverage: `${p.coveragePct.toFixed(0)}%`,
      orders: p.orders,
      onRoute: p.ordersOnRoute,
      offRouteOrders: p.ordersOffRoute,
      amount: n2(p.orderAmount),
      aov: n2(p.avgOrderValue),
      qty: p.totalQty,
      lines: p.linesSold,
      collections: n2(p.collections),
      km: n2(p.km),
      days: p.workingDays,
    })), [perf]);

  const perfColumns: ReportColumn[] = [
    { label: "Rank", key: "rank" },
    { label: "Salesman", key: "name" },
    { label: "Planned Calls", key: "planned", numeric: true },
    { label: "Productive", key: "productive", numeric: true },
    { label: "Unproductive", key: "unproductive", numeric: true },
    { label: "Missed", key: "missed", numeric: true },
    { label: "Pending (today)", key: "pending", numeric: true },
    { label: "Off-route Calls", key: "offRoute", numeric: true },
    { label: "Productivity %", key: "productivity" },
    { label: "Route Coverage %", key: "coverage" },
    { label: "Orders", key: "orders", numeric: true },
    { label: "On Route", key: "onRoute", numeric: true },
    { label: "Off Route", key: "offRouteOrders", numeric: true },
    { label: "Order Value (₹)", key: "amount", numeric: true },
    { label: "Avg Order (₹)", key: "aov", numeric: true },
    { label: "Qty", key: "qty", numeric: true },
    { label: "Products Sold", key: "lines", numeric: true },
    { label: "Collections (₹)", key: "collections", numeric: true },
    { label: "KM", key: "km", numeric: true },
    { label: "Working Days", key: "days", numeric: true },
  ];

  // ── Call statement ──
  const [statusFilter, setStatusFilter] = useState("all");
  const callRows = useMemo(() => callLog
    .filter((r) => statusFilter === "all" || (statusFilter === "offroute" ? !r.onRoute : r.status === statusFilter))
    .map((r, i) => ({
      seqNo: i + 1,
      date: formatDateDMY(r.date),
      day: r.day || "",
      salesman: r.salesmanname,
      route: r.routename || "—",
      party: r.partyname,
      mobile: r.partymobile || "",
      status: r.status,
      statusLabel: STATUS[r.status]?.label || r.status,
      plan: r.onRoute ? "On route" : "Off route",
      time: r.visitTime ? new Date(r.visitTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "",
      orderNo: r.orderNo || "",
      amount: r.orderAmount != null ? n2(r.orderAmount) : "",
      reason: r.reason || "",
      distance: r.distanceM != null ? `${Math.round(r.distanceM)} m` : "",
    })), [callLog, statusFilter]);

  const callCounts = useMemo(() => {
    const c: any = { all: callLog.length, productive: 0, unproductive: 0, missed: 0, pending: 0, offroute: 0 };
    callLog.forEach((r) => { c[r.status]++; if (!r.onRoute) c.offroute++; });
    return c;
  }, [callLog]);

  const callColumns: ReportColumn[] = [
    { label: "Seq No", key: "seqNo" },
    { label: "Date", key: "date" },
    { label: "Day", key: "day" },
    { label: "Salesman", key: "salesman" },
    { label: "Route", key: "route" },
    { label: "Party", key: "party" },
    { label: "Mobile", key: "mobile" },
    {
      label: "Call Status", key: "statusLabel",
      render: (row: any) => (
        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS[row.status]?.cls || ""}`}>{row.statusLabel}</span>
      ),
    },
    { label: "Plan", key: "plan" },
    { label: "Visit Time", key: "time" },
    { label: "Order No", key: "orderNo" },
    { label: "Order Value (₹)", key: "amount", numeric: true },
    { label: "No-order Reason", key: "reason" },
    { label: "Distance from Party", key: "distance" },
  ];

  // ── Targets ──
  const targetRows = useMemo(() => [...perf]
    .sort((a, b) => b.monthTarget - a.monthTarget || b.monthAchieved - a.monthAchieved)
    .map((p, i) => ({
      rank: i + 1,
      name: p.salesmanname,
      month: p.targetMonth,
      target: n2(p.monthTarget),
      achieved: n2(p.monthAchieved),
      remaining: n2(p.monthRemaining),
      pctNum: p.monthAchievedPct,
      pct: `${p.monthAchievedPct.toFixed(0)}%`,
      status: !p.monthTarget ? "No target set" : p.monthAchievedPct >= 100 ? "Achieved" : "Not achieved",
    })), [perf]);
  const targetColumns: ReportColumn[] = [
    { label: "Rank (by target)", key: "rank" },
    { label: "Salesman", key: "name" },
    { label: "Month", key: "month" },
    { label: "Monthly Target (₹)", key: "target", numeric: true },
    { label: "Achieved (₹)", key: "achieved", numeric: true },
    { label: "Remaining (₹)", key: "remaining", numeric: true },
    { label: "Achieved %", key: "pct", render: (r: any) => <Progress pct={r.pctNum} /> },
    {
      label: "Status", key: "status",
      render: (r: any) => (
        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
          r.status === "Achieved" ? "bg-green-100 text-green-800" : r.status === "No target set" ? "bg-gray-100 text-gray-600" : "bg-red-100 text-red-700"}`}>
          {r.status}
        </span>
      ),
    },
  ];
  const biggestTarget = [...perf].sort((a, b) => b.monthTarget - a.monthTarget)[0];
  const bestAchiever = [...perf].filter((p) => p.monthTarget > 0).sort((a, b) => b.monthAchievedPct - a.monthAchievedPct)[0];
  const topSeller = [...perf].sort((a, b) => b.monthAchieved - a.monthAchieved)[0];

  // ── Product & category ──
  const [groupBy, setGroupBy] = useState<"product" | "category" | "salesman-product" | "salesman-category">("product");
  const prodTable = useMemo(() => {
    const key = (r: any) => {
      if (groupBy === "product") return r.productid;
      if (groupBy === "category") return r.categoryid || "none";
      if (groupBy === "salesman-product") return `${r.salesmanid}|${r.productid}`;
      return `${r.salesmanid}|${r.categoryid || "none"}`;
    };
    const m = new Map<string, any>();
    prodRows.forEach((r) => {
      const k = key(r);
      const x = m.get(k) || {
        salesman: r.salesmanname, product: r.productname, category: r.categoryname || "Uncategorised",
        qty: 0, amount: 0, orders: 0, salesmen: new Set<string>(), products: new Set<string>(),
      };
      x.qty += r.qty; x.amount += r.amount; x.orders += r.orders;
      x.salesmen.add(r.salesmanname); x.products.add(r.productid);
      m.set(k, x);
    });
    const grand = Array.from(m.values()).reduce((a, x) => a + x.amount, 0) || 1;
    return Array.from(m.values())
      .sort((a, b) => b.amount - a.amount)
      .map((x, i) => ({
        rank: i + 1,
        salesman: x.salesman,
        product: x.product,
        category: x.category,
        salesmenCount: x.salesmen.size,
        productsCount: x.products.size,
        qty: Number(x.qty.toFixed(2)),
        orders: x.orders,
        amount: n2(x.amount),
        share: `${((x.amount / grand) * 100).toFixed(1)}%`,
      }));
  }, [prodRows, groupBy]);
  const prodColumns: ReportColumn[] = [
    { label: "Rank", key: "rank" },
    ...(groupBy.startsWith("salesman") ? [{ label: "Salesman", key: "salesman" }] : []),
    ...(groupBy.endsWith("product") ? [{ label: "Product", key: "product" }, { label: "Category", key: "category" }] : [{ label: "Category", key: "category" }, { label: "Products", key: "productsCount", numeric: true }]),
    ...(!groupBy.startsWith("salesman") ? [{ label: "Salesmen", key: "salesmenCount", numeric: true }] : []),
    { label: "Orders", key: "orders", numeric: true },
    { label: "Qty", key: "qty", numeric: true },
    { label: "Sales (₹)", key: "amount", numeric: true },
    { label: "Share", key: "share" },
  ];

  // ── Live tracking (own date + salesman, shown ABOVE the map) ──
  const [trkDraft, setTrkDraft] = useState({ date: todayYMD(), salesmanid: "" });
  const [trk, setTrk] = useState(trkDraft);
  const locFilter = useMemo(() => ({
    role: "salesman",
    staffid: trk.salesmanid || undefined,
    dateFrom: trk.date || undefined,
    dateTo: trk.date || undefined,
  }), [trk]);
  const { data: locationsData } = useLatestLocationsQuery(locFilter);
  const { data: trailData } = useLocationPingsQuery(locFilter);
  const { data: dayTravelData } = useTravelSummaryQuery(locFilter);
  const dayTravel: any[] = (dayTravelData as any)?.getTravelSummary || [];
  const locations = (locationsData as any)?.getLatestLocations || [];
  const trail = trk.salesmanid ? ((trailData as any)?.getLocationPings || []) : [];
  const showingTrail = !!trk.salesmanid;
  const trackingPings = showingTrail ? trail : locations;
  const [locationNames, setLocationNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (tab !== "live") return;
    const keys: string[] = Array.from(new Set<string>(
      trackingPings.filter((p: any) => p.latitude != null && p.longitude != null)
        .map((p: any) => `${Number(p.latitude).toFixed(4)},${Number(p.longitude).toFixed(4)}`)
    )).filter((k: string) => !(k in geocodeCache));
    if (!keys.length) return;
    let cancelled = false;
    const next = (i: number) => {
      if (cancelled || i >= keys.length) return;
      const [lat, lon] = keys[i].split(",");
      fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=16&addressdetails=0`, { headers: { Accept: "application/json" } })
        .then((r) => r.json())
        .then((j) => { geocodeCache[keys[i]] = j?.display_name || `${lat}, ${lon}`; })
        .catch(() => { geocodeCache[keys[i]] = `${lat}, ${lon}`; })
        .finally(() => {
          if (!cancelled) {
            setLocationNames((p) => ({ ...p, [keys[i]]: geocodeCache[keys[i]] }));
            setTimeout(() => next(i + 1), 1100);
          }
        });
    };
    next(0);
    return () => { cancelled = true; };
  }, [trackingPings, tab]);

  const trackingData = useMemo(() => {
    const running = showingTrail ? cumulativeKm(trackingPings) : [];
    const kmOf = (sid?: string) => dayTravel.find((t: any) => t.staffid === sid)?.km ?? 0;
    return trackingPings.map((p: any, idx: number) => {
      const key = p.latitude != null && p.longitude != null ? `${Number(p.latitude).toFixed(4)},${Number(p.longitude).toFixed(4)}` : "";
      return {
        seqNo: idx + 1,
        staffName: p.staffid?.name || "-",
        lastSeen: p.pingedAt ? formatDateTimeDMY(p.pingedAt) : "-",
        location: key ? (geocodeCache[key] || locationNames[key] || "Resolving…") : "-",
        accuracy: p.accuracy != null ? Math.round(p.accuracy) : "-",
        battery: p.battery != null ? `${Math.round(p.battery)}%` : "-",
        km: (showingTrail ? running[idx] : kmOf(p.staffid?.id)).toFixed(2),
      };
    });
  }, [trackingPings, locationNames, dayTravel, showingTrail]);
  const trailSummary = showingTrail ? dayTravel.find((t: any) => t.staffid === trk.salesmanid) : null;
  const trackingColumns: ReportColumn[] = [
    { label: "Seq No", key: "seqNo" },
    { label: "Salesman", key: "staffName" },
    { label: showingTrail ? "Time" : "Last Seen", key: "lastSeen" },
    { label: "Location", key: "location" },
    { label: "Accuracy (m)", key: "accuracy" },
    { label: "Battery", key: "battery" },
    { label: showingTrail ? "KM (so far)" : "Today's KM", key: "km" },
  ];

  const inputCls = "border rounded-lg px-3 py-2 text-sm bg-white w-full";
  const salesmanSelect = (value: string, onChange: (v: string) => void) => (
    <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">All salesmen</option>
      {salesmen.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
  );

  const FilterBar = (
    <div className="bg-white border rounded-lg p-4 mb-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
        <label className="text-sm text-gray-600">From Date
          <input type="date" className={inputCls} value={draft.fromDate} onChange={(e) => setDraft({ ...draft, fromDate: e.target.value })} />
        </label>
        <label className="text-sm text-gray-600">To Date
          <input type="date" className={inputCls} value={draft.toDate} onChange={(e) => setDraft({ ...draft, toDate: e.target.value })} />
        </label>
        <label className="text-sm text-gray-600">Salesman
          {salesmanSelect(draft.salesmanid, (v) => setDraft({ ...draft, salesmanid: v }))}
        </label>
        <div className="flex gap-2">
          <button type="button" className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold" onClick={() => setApplied(draft)}>Apply</button>
          <button type="button" className="px-4 py-2 rounded-lg bg-gray-500 text-white text-sm font-semibold" onClick={() => {
            const d = { fromDate: shiftDaysYMD(-29), toDate: todayYMD(), salesmanid: "" };
            setDraft(d); setApplied(d);
          }}>Reset</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-3 text-xs">
        {[
          { l: "Today", f: todayYMD(), t: todayYMD() },
          { l: "Yesterday", f: shiftDaysYMD(-1), t: shiftDaysYMD(-1) },
          { l: "Last 7 days", f: shiftDaysYMD(-6), t: todayYMD() },
          { l: "This month", f: todayYMD().slice(0, 8) + "01", t: todayYMD() },
          { l: "Last 30 days", f: shiftDaysYMD(-29), t: todayYMD() },
        ].map((q) => (
          <button key={q.l} type="button" className="px-3 py-1 rounded-full border bg-gray-50 hover:bg-gray-100"
            onClick={() => { const d = { ...draft, fromDate: q.f, toDate: q.t }; setDraft(d); setApplied(d); }}>
            {q.l}
          </button>
        ))}
      </div>
    </div>
  );

  const tableProps = { filters: tf, setFilters: setTf, appliedFilters: taf, setAppliedFilters: setTaf, showExport: true, showCsv: true, showPdf: true };

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6 font-sans">
        <div className="flex flex-wrap gap-2 mb-4">
          {TABS.map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                tab === t.id ? "!bg-slate-900 !text-white shadow-sm border border-slate-900" : "bg-white text-gray-700 hover:text-black hover:bg-gray-100 border border-gray-200"}`}>
              <span>{t.icon}</span><span>{t.label}</span>
            </button>
          ))}
        </div>

        {tab !== "live" && FilterBar}
        {tab !== "live" && (perfLoading || logLoading || prodLoading) && (
          <div className="text-xs text-gray-500 -mt-2 mb-3 flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full border-2 border-gray-300 border-t-slate-700 animate-spin" />
            Updating report…
          </div>
        )}

        {tab === "overview" && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
              <Tile label="Planned calls" value={String(totals.planned)} sub={`${totals.coverage.toFixed(0)}% route covered`} />
              <Tile label="Productive calls" value={String(totals.productive)} tone="text-green-700" sub="Visited + order" />
              <Tile label="Unproductive calls" value={String(totals.unproductive)} tone="text-amber-600" sub="Visited, no order" />
              <Tile label="Missed calls" value={String(totals.missed)} tone="text-red-600" sub={totals.pending ? `${totals.pending} pending today` : "On route, not visited"} />
              <Tile label="Productivity" value={`${totals.productivity.toFixed(0)}%`} sub={`${totals.offRoute} off-route calls`} />
              <Tile label="Orders" value={String(totals.orders)} sub={`Avg ${inr(totals.aov)}`} />
              <Tile label="Order value" value={inr(totals.amount)} tone="text-blue-700" />
              <Tile label="Collections" value={inr(totals.collections)} tone="text-emerald-700" />
              <Tile label="Distance travelled" value={`${totals.km.toFixed(1)} km`} />
            </div>
            <DailyChart daily={dailyAll} />
            <ReportTable moduleId="reports.salesmanfield" title="Salesman Performance (ranked by order value)"
              columns={perfColumns} data={perfRows} isLoading={false} exportFileName="SalesmanPerformance" showTotals {...tableProps} />
          </>
        )}

        {tab === "calls" && (
          <>
            <div className="flex flex-wrap gap-2 mb-3">
              {[
                { k: "all", l: "All calls" }, { k: "productive", l: "Productive" }, { k: "unproductive", l: "Unproductive" },
                { k: "missed", l: "Missed" }, { k: "pending", l: "Pending" }, { k: "offroute", l: "Off route" },
              ].map((c) => (
                <button key={c.k} type="button" onClick={() => setStatusFilter(c.k)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${statusFilter === c.k ? "bg-slate-900 text-white border-slate-900" : "bg-white text-gray-700"}`}>
                  {c.l} ({callCounts[c.k] ?? 0})
                </button>
              ))}
            </div>
            <ReportTable moduleId="reports.salesmanfield" title="Call Statement (every planned and visited party, day by day)"
              columns={callColumns} data={callRows} isLoading={false} exportFileName="SalesmanCallStatement" showTotals {...tableProps} />
          </>
        )}

        {tab === "targets" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <Tile label="Biggest monthly target" value={biggestTarget ? inr(biggestTarget.monthTarget) : "—"} sub={biggestTarget?.salesmanname} />
              <Tile label="Highest achievement" value={bestAchiever ? `${bestAchiever.monthAchievedPct.toFixed(0)}%` : "—"} tone="text-green-700" sub={bestAchiever?.salesmanname} />
              <Tile label="Top seller this month" value={topSeller ? inr(topSeller.monthAchieved) : "—"} tone="text-blue-700" sub={topSeller?.salesmanname} />
            </div>
            <p className="text-xs text-gray-500 mb-2">
              Target month = the month of the To Date ({applied.toDate.slice(0, 7)}). Target comes from Staff Accounts → Target Amount; achieved = order value booked by the salesman in that month (cancelled orders excluded).
            </p>
            <ReportTable moduleId="reports.salesmanfield" title="Monthly Target vs Achievement"
              columns={targetColumns} data={targetRows} isLoading={false} exportFileName="SalesmanTargets" showTotals {...tableProps} />
          </>
        )}

        {tab === "products" && (
          <>
            <div className="flex flex-wrap gap-2 mb-3">
              {[
                { k: "product", l: "By product" }, { k: "category", l: "By category" },
                { k: "salesman-product", l: "Salesman × product" }, { k: "salesman-category", l: "Salesman × category" },
              ].map((g) => (
                <button key={g.k} type="button" onClick={() => setGroupBy(g.k as any)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${groupBy === g.k ? "bg-slate-900 text-white border-slate-900" : "bg-white text-gray-700"}`}>
                  {g.l}
                </button>
              ))}
            </div>
            <ReportTable moduleId="reports.salesmanfield" title="Orders taken by salesmen — product & category wise"
              columns={prodColumns} data={prodTable} isLoading={false} exportFileName="SalesmanProductSales" showTotals {...tableProps} />
          </>
        )}

        {tab === "live" && (
          <>
            <div className="bg-white border rounded-lg p-4 mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <label className="text-sm text-gray-600">Date
                  <input type="date" className={inputCls} value={trkDraft.date} onChange={(e) => setTrkDraft({ ...trkDraft, date: e.target.value })} />
                </label>
                <label className="text-sm text-gray-600">Salesman
                  {salesmanSelect(trkDraft.salesmanid, (v) => setTrkDraft({ ...trkDraft, salesmanid: v }))}
                </label>
                <div className="flex gap-2">
                  <button type="button" className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold" onClick={() => setTrk(trkDraft)}>Apply</button>
                  <button type="button" className="px-4 py-2 rounded-lg bg-gray-500 text-white text-sm font-semibold" onClick={() => {
                    const d = { date: todayYMD(), salesmanid: "" }; setTrkDraft(d); setTrk(d);
                  }}>Reset</button>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {showingTrail
                  ? "Full trail of the selected salesman for the day (green = punch-in / start, blue = latest)."
                  : "Latest known location of every salesman. Pick a salesman to see the full route for the day."}
                {" "}GPS is recorded only while the salesman is punched in with the app open.
              </p>
            </div>

            {showingTrail && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <Tile label="Distance covered" value={`${(trailSummary?.km ?? 0).toFixed(2)} km`} />
                <Tile label="First location" value={trailSummary?.firstAt ? formatDateTimeDMY(trailSummary.firstAt) : "-"} />
                <Tile label="Last location" value={trailSummary?.lastAt ? formatDateTimeDMY(trailSummary.lastAt) : "-"} />
                <Tile label="Points recorded" value={String(trailSummary?.points ?? 0)} />
              </div>
            )}

            <div className="mb-4">
              <LiveTrackingMap latest={locations} trail={trail} height={440} />
            </div>

            <ReportTable moduleId="reports.salesmanfield"
              title={showingTrail ? "Live Location (Full Day Trail)" : "Live Location (Latest per Salesman)"}
              columns={trackingColumns} data={trackingData} exportFileName="SalesmanLiveLocation"
              filters={tf} setFilters={setTf} appliedFilters={taf} setAppliedFilters={setTaf} showCsv />
          </>
        )}
      </div>
    </HomeLayout>
  );
};

export default SalesmanFieldReport;
