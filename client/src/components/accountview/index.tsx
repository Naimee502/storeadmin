// Shared Party/Staff View building blocks; filtering is client-side.
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { formatINR } from "../../utils/helper";
import FormField from "../formfiled";

// ── dates
export const parseServerDate = (d: any): Date | null => {
  if (d === null || d === undefined || d === "") return null;
  const dt = /^\d+$/.test(String(d).trim()) ? new Date(Number(d)) : new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
};
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const fmtDate = (d: any) => {
  const dt = parseServerDate(d);
  return dt ? dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
};

type Preset = "all" | "today" | "last7" | "thisMonth" | "lastMonth" | "custom";
const PRESETS: { key: Preset; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today" },
  { key: "last7", label: "Last 7 days" },
  { key: "thisMonth", label: "This month" },
  { key: "lastMonth", label: "Last month" },
  { key: "custom", label: "Custom" },
];
const presetBounds = (p: Preset, from: string, to: string): [string | null, string | null] => {
  const now = new Date();
  switch (p) {
    case "today": return [ymd(now), ymd(now)];
    case "last7": { const a = new Date(now); a.setDate(a.getDate() - 6); return [ymd(a), ymd(now)]; }
    case "thisMonth": return [ymd(new Date(now.getFullYear(), now.getMonth(), 1)), ymd(now)];
    case "lastMonth": return [ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)), ymd(new Date(now.getFullYear(), now.getMonth(), 0))];
    case "custom": return [from || null, to || from || null];
    default: return [null, null];
  }
};
const inBounds = (d: any, [a, b]: [string | null, string | null]) => {
  if (!a && !b) return true;
  const dt = parseServerDate(d);
  if (!dt) return false;
  const k = ymd(dt);
  return (!a || k >= a) && (!b || k <= b);
};

/** Date preset + custom range controls; returns the active bounds. */
const useDateFilter = () => {
  const [preset, setPreset] = useState<Preset>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const bounds = presetBounds(preset, from, to);
  const ui = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-44">
        <FormField label="" name="preset" type="select" value={preset}
          options={PRESETS.map((p) => ({ value: p.key, label: p.label }))} onChange={(e: any) => setPreset((e.target.value || PRESETS[0].key) as Preset)} />
      </div>
      {preset === "custom" && (
        <>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 rounded-md border border-slate-300 px-2 text-[13px]" />
          <span className="text-[13px] text-slate-500">to</span>
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="h-8 rounded-md border border-slate-300 px-2 text-[13px]" />
        </>
      )}
    </div>
  );
  return { bounds, ui };
};

// ── order status (same derivation as the apps)
export const orderStatus = (o: any): string => {
  if (o?.cancelStatus === "cancelled") return "cancelled";
  if (o?.deliveryStatus === "delivered") return "delivered";
  if (o?.deliveryStatus === "dispatched") return "dispatched";
  const os = String(o?.orderStatus || "").toLowerCase();
  if (os) return os;
  return o?.isConverted ? "confirmed" : "pending";
};
const STATUS_CLS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  dispatched: "bg-sky-100 text-sky-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};
const STATUSES = ["all", "pending", "confirmed", "dispatched", "delivered", "cancelled"];
export const billNo = (o: any) => {
  const inv = o?.isConverted ? o?.invoicenumber : null;
  const raw = inv || o?.billnumber || "";
  const num = raw ? String(parseInt(raw, 10) || raw).padStart(6, "0") : "000000";
  return inv ? `INV-${num}` : `SO-${num}`;
};
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ── layout pieces
export const InfoRow: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div className="flex justify-between gap-3 border-b border-slate-100 py-1.5 text-[13px] last:border-0">
    <span className="text-slate-500">{label}</span>
    <span className="text-right font-medium text-gray-800 break-words">{value ?? "—"}</span>
  </div>
);

export const StatTile: React.FC<{ label: string; value: React.ReactNode; tone?: string }> = ({ label, value, tone = "text-gray-900" }) => (
  <div className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5">
    <p className="text-[11px] text-slate-500">{label}</p>
    <p className={`text-[15px] font-semibold leading-tight ${tone}`}>{value}</p>
  </div>
);

export const Tabs: React.FC<{ tabs: { key: string; label: string; count?: number }[]; active: string; onChange: (k: string) => void }> = ({ tabs, active, onChange }) => (
  <div className="mb-3 flex gap-1 overflow-x-auto border-b border-slate-200">
    {tabs.map((t) => (
      <button
        key={t.key}
        onClick={() => onChange(t.key)}
        className={`whitespace-nowrap border-b-2 px-3 py-1.5 text-[13px] font-semibold transition ${
          active === t.key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-800"
        }`}
      >
        {t.label}
        {typeof t.count === "number" && (
          <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-[11px] text-slate-600">{t.count}</span>
        )}
      </button>
    ))}
  </div>
);

const Empty: React.FC<{ text: string }> = ({ text }) => (
  <p className="py-8 text-center text-[13px] text-slate-400">{text}</p>
);
const Search: React.FC<{ value: string; onChange: (v: string) => void; placeholder: string }> = ({ value, onChange, placeholder }) => (
  <input
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className="h-8 w-full rounded-md border border-slate-300 px-2.5 text-[13px] outline-none focus:border-indigo-500 sm:w-56"
  />
);

// ── Orders table
export const OrdersTable: React.FC<{
  orders: any[];
  loading?: boolean;
  /** Show the party column (staff view lists orders of many parties). */
  showParty?: boolean;
  /** Party filter options (staff view). */
  partyOptions?: { id: string; name: string }[];
}> = ({ orders, loading, showParty, partyOptions }) => {
  const navigate = useNavigate();
  const { bounds, ui } = useDateFilter();
  const [status, setStatus] = useState("all");
  const [party, setParty] = useState("");
  const [q, setQ] = useState("");

  const inDates = useMemo(() => orders.filter((o) => inBounds(o.billdate || o.createdAt, bounds)), [orders, bounds[0], bounds[1]]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return inDates.filter((o) =>
      (status === "all" || orderStatus(o) === status) &&
      (!party || o.partyacc?.id === party) &&
      (!s || billNo(o).toLowerCase().includes(s) || String(o.partyacc?.accountname || "").toLowerCase().includes(s)),
    );
  }, [inDates, status, party, q]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: inDates.length };
    inDates.forEach((o) => { const k = orderStatus(o); c[k] = (c[k] || 0) + 1; });
    return c;
  }, [inDates]);
  const total = rows.reduce((a, o) => a + (o.cancelStatus === "cancelled" ? 0 : Number(o.totalamount) || 0), 0);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {ui}
        {partyOptions && partyOptions.length > 0 && (
          <div className="w-64">
            <FormField label="" name="party" type="select" placeholder="All parties" value={party}
              options={partyOptions.map((p) => ({ value: p.id, label: p.name }))} onChange={(e: any) => setParty(e.target.value || "")} />
          </div>
        )}
        <div className="ml-auto"><Search value={q} onChange={setQ} placeholder="Search bill no / party" /></div>
      </div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`h-7 rounded-full border px-2.5 text-[12px] font-medium ${status === s ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}
          >
            {titleCase(s)} {counts[s] ? `(${counts[s]})` : ""}
          </button>
        ))}
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <StatTile label="Orders" value={rows.length} />
        <StatTile label="Order value" value={formatINR(total)} tone="text-green-700" />
        <StatTile label="Avg / order" value={formatINR(rows.length ? total / Math.max(1, rows.filter((o) => o.cancelStatus !== "cancelled").length) : 0)} />
      </div>
      {loading ? <Empty text="Loading orders…" /> : rows.length === 0 ? <Empty text="No orders for these filters." /> : (
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="min-w-full text-[12.5px]">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2 py-1.5">Bill No</th>
                <th className="px-2 py-1.5">Date</th>
                {showParty && <th className="px-2 py-1.5">Party</th>}
                <th className="px-2 py-1.5">Items</th>
                <th className="px-2 py-1.5 text-right">Amount</th>
                <th className="px-2 py-1.5">Status</th>
                <th className="px-2 py-1.5">Taken by</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => {
                const st = orderStatus(o);
                return (
                  <tr key={o.id} className="cursor-pointer border-t border-slate-100 hover:bg-indigo-50" onClick={() => navigate(`/salesorder/addedit/${o.id}`)}>
                    <td className="px-2 py-1.5 font-semibold text-indigo-700">{billNo(o)}</td>
                    <td className="px-2 py-1.5">{fmtDate(o.billdate || o.createdAt)}</td>
                    {showParty && <td className="px-2 py-1.5">{o.partyacc?.accountname || "—"}</td>}
                    <td className="px-2 py-1.5">{o.productservice?.length ?? 0}</td>
                    <td className="px-2 py-1.5 text-right font-semibold">{formatINR(Number(o.totalamount) || 0)}</td>
                    <td className="px-2 py-1.5"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLS[st] || "bg-gray-100 text-gray-600"}`}>{titleCase(st)}</span></td>
                    <td className="px-2 py-1.5 text-gray-600">{o.salesmenid?.name || o.createdby_name || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ── Payments table
export const PaymentsTable: React.FC<{ payments: any[]; loading?: boolean }> = ({ payments, loading }) => {
  const navigate = useNavigate();
  const { bounds, ui } = useDateFilter();
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return payments.filter((p) =>
      p.status !== false && inBounds(p.paymentdate || p.createdAt, bounds) &&
      (!s || String(p.paymentcode || "").toLowerCase().includes(s) || String(p.reference || "").toLowerCase().includes(s)),
    );
  }, [payments, bounds[0], bounds[1], q]);
  const total = rows.reduce((a, p) => a + (Number(p.amount) || 0), 0);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {ui}
        <div className="ml-auto"><Search value={q} onChange={setQ} placeholder="Search payment no / ref" /></div>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <StatTile label="Payments" value={rows.length} />
        <StatTile label="Total amount" value={formatINR(total)} tone="text-green-700" />
      </div>
      {loading ? <Empty text="Loading payments…" /> : rows.length === 0 ? <Empty text="No payments for these filters." /> : (
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="min-w-full text-[12.5px]">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2 py-1.5">Payment No</th>
                <th className="px-2 py-1.5">Date</th>
                <th className="px-2 py-1.5">Type</th>
                <th className="px-2 py-1.5">Mode</th>
                <th className="px-2 py-1.5 text-right">Amount</th>
                <th className="px-2 py-1.5">Reference</th>
                <th className="px-2 py-1.5">Entered by</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="cursor-pointer border-t border-slate-100 hover:bg-indigo-50" onClick={() => navigate(`/payments/addedit/${p.id}`)}>
                  <td className="px-2 py-1.5 font-semibold text-indigo-700">{p.paymentcode || "—"}</td>
                  <td className="px-2 py-1.5">{fmtDate(p.paymentdate || p.createdAt)}</td>
                  <td className="px-2 py-1.5">{p.type ? titleCase(String(p.type)) : "—"}</td>
                  <td className="px-2 py-1.5">{p.mode || p.counterledgerid?.ledgername || "—"}</td>
                  <td className="px-2 py-1.5 text-right font-semibold">{formatINR(Number(p.amount) || 0)}</td>
                  <td className="px-2 py-1.5 text-gray-600">{p.reference || "—"}</td>
                  <td className="px-2 py-1.5 text-gray-600">{p.createdby_name || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ── Parties table
export const PartiesTable: React.FC<{
  parties: any[];
  outstandingById: Record<string, number>;
  orderCountById?: Record<string, number>;
  emptyText: string;
  canView: boolean;
}> = ({ parties, outstandingById, orderCountById, emptyText, canView }) => {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return parties.filter((p) => !s || [p.name, p.mobile, p.city, p.accountcode].some((x) => String(x || "").toLowerCase().includes(s)));
  }, [parties, q]);
  return (
    <div>
      <div className="mb-3 flex justify-end"><Search value={q} onChange={setQ} placeholder="Search name / mobile / city" /></div>
      {rows.length === 0 ? <Empty text={emptyText} /> : (
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="min-w-full text-[12.5px]">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2 py-1.5">Code</th>
                <th className="px-2 py-1.5">Name</th>
                <th className="px-2 py-1.5">Mobile</th>
                <th className="px-2 py-1.5">Channel</th>
                <th className="px-2 py-1.5">City</th>
                {orderCountById && <th className="px-2 py-1.5 text-right">Orders</th>}
                <th className="px-2 py-1.5 text-right">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr
                  key={p.id}
                  className={`border-t ${canView ? "cursor-pointer hover:bg-blue-50/40" : ""}`}
                  onClick={() => canView && navigate(`/accounts/view/${p.id}`)}
                >
                  <td className="px-2 py-1.5">{p.accountcode ? `#${p.accountcode}` : "—"}</td>
                  <td className={`px-2 py-1.5 font-semibold ${canView ? "text-blue-700" : ""}`}>{p.name}</td>
                  <td className="px-2 py-1.5">{p.mobile || "—"}</td>
                  <td className="px-2 py-1.5">{p.channel?.channelName || "—"}</td>
                  <td className="px-2 py-1.5">{p.city || "—"}</td>
                  {orderCountById && <td className="px-2 py-1.5 text-right">{orderCountById[p.id] || 0}</td>}
                  <td className="px-2 py-1.5 text-right font-semibold">{formatINR(outstandingById[p.id] || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ── Deliveries table (delivery boy)
const invNo = (i: any) => `INV-${String(parseInt(i?.billnumber, 10) || i?.billnumber || 0).padStart(6, "0")}`;
export const DeliveriesTable: React.FC<{ invoices: any[]; loading?: boolean }> = ({ invoices, loading }) => {
  const navigate = useNavigate();
  const { bounds, ui } = useDateFilter();
  const [status, setStatus] = useState<"all" | "out" | "delivered">("all");
  const [q, setQ] = useState("");
  const isDone = (i: any) => i.deliveryStatus === "delivered";
  // A delivered bill counts on the day it was delivered; an open one on its bill date.
  const dayOf = (i: any) => (isDone(i) && i.deliveredAt ? i.deliveredAt : i.billdate || i.createdAt);

  const inDates = useMemo(() => invoices.filter((i) => inBounds(dayOf(i), bounds)), [invoices, bounds[0], bounds[1]]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return inDates.filter((i) =>
      (status === "all" || (status === "delivered" ? isDone(i) : !isDone(i))) &&
      (!s || invNo(i).toLowerCase().includes(s) || String(i.partyacc?.accountname || "").toLowerCase().includes(s)),
    );
  }, [inDates, status, q]);
  const done = inDates.filter(isDone);
  const deliveredValue = done.reduce((a, i) => a + (Number(i.totalamount) || 0), 0);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {ui}
        <div className="ml-auto"><Search value={q} onChange={setQ} placeholder="Search invoice no / party" /></div>
      </div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {([["all", "All", inDates.length], ["out", "Out for delivery", inDates.length - done.length], ["delivered", "Delivered", done.length]] as const).map(([k, label, n]) => (
          <button
            key={k}
            onClick={() => setStatus(k)}
            className={`h-7 rounded-full border px-2.5 text-[12px] font-medium ${status === k ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}
          >
            {label} ({n})
          </button>
        ))}
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Assigned" value={inDates.length} />
        <StatTile label="Delivered" value={done.length} tone="text-green-700" />
        <StatTile label="Pending" value={inDates.length - done.length} tone="text-amber-600" />
        <StatTile label="Delivered value" value={formatINR(deliveredValue)} tone="text-green-700" />
      </div>
      {loading ? <Empty text="Loading deliveries…" /> : rows.length === 0 ? <Empty text="No deliveries for these filters." /> : (
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="min-w-full text-[12.5px]">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2 py-1.5">Invoice No</th>
                <th className="px-2 py-1.5">Bill date</th>
                <th className="px-2 py-1.5">Party</th>
                <th className="px-2 py-1.5 text-right">Amount</th>
                <th className="px-2 py-1.5 text-right">Due</th>
                <th className="px-2 py-1.5">Status</th>
                <th className="px-2 py-1.5">Delivered on</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id} className="cursor-pointer border-t border-slate-100 hover:bg-indigo-50" onClick={() => navigate(`/salesinvoice/addedit/${i.id}`)}>
                  <td className="px-2 py-1.5 font-semibold text-indigo-700">{invNo(i)}</td>
                  <td className="px-2 py-1.5">{fmtDate(i.billdate || i.createdAt)}</td>
                  <td className="px-2 py-1.5">{i.partyacc?.accountname || "—"}</td>
                  <td className="px-2 py-1.5 text-right font-semibold">{formatINR(Number(i.totalamount) || 0)}</td>
                  <td className="px-2 py-1.5 text-right">{formatINR(Number(i.outstanding) || 0)}</td>
                  <td className="px-2 py-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${isDone(i) ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      {isDone(i) ? "Delivered" : "Out for delivery"}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-gray-600">{isDone(i) ? fmtDate(i.deliveredAt) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ── Party stock table
export const PartyStockTable: React.FC<{ rows: any[]; loading?: boolean }> = ({ rows, loading }) => {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => !s || [r.productname, r.variantname, r.productcode].some((x) => String(x || "").toLowerCase().includes(s)));
  }, [rows, q]);
  const negative = rows.filter((r) => Number(r.qty) < 0).length;
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="grid flex-1 grid-cols-2 gap-2 sm:max-w-sm">
          <StatTile label="Products in stock" value={rows.filter((r) => Number(r.qty) > 0).length} />
          <StatTile label="Negative" value={negative} tone={negative ? "text-red-600" : "text-gray-900"} />
        </div>
        <div className="ml-auto"><Search value={q} onChange={setQ} placeholder="Search product / code" /></div>
      </div>
      {loading ? <Empty text="Loading stock…" /> : list.length === 0 ? <Empty text="No stock with this party yet." /> : (
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="min-w-full text-[12.5px]">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2 py-1.5">Product</th>
                <th className="px-2 py-1.5">Variant</th>
                <th className="px-2 py-1.5">Code</th>
                <th className="px-2 py-1.5 text-right">Stock</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-2 py-1.5 font-semibold text-gray-800">{r.productname}</td>
                  <td className="px-2 py-1.5">{r.variantname || "—"}</td>
                  <td className="px-2 py-1.5 text-gray-600">{r.productcode || "—"}</td>
                  <td className={`px-2 py-1.5 text-right font-bold ${Number(r.qty) < 0 ? "text-red-600" : "text-gray-900"}`}>
                    {Number(r.qty).toLocaleString("en-IN")} {r.unitname || ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
