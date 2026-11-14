import { Navigate, useNavigate, useSearchParams } from "react-router";
import type { NavigateFunction } from "react-router";
import { useQuery } from "@apollo/client";
import { FileText, LayoutDashboard, LogOut, Package, Wallet } from "lucide-react";
import Breadcrumb from "../../components/breadcrumb";
import { GET_SUPPLIER_PORTAL } from "../../graphql/queries/supplier";
import { useSupplier } from "../../hooks/useSupplier";

const rupees = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const dateLabel = (ymd?: string | null) =>
  ymd ? new Date(`${String(ymd).slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "-";
const codeOf = (e: any) => e?.graphQLErrors?.[0]?.extensions?.code || "";
const ORDER: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700", confirmed: "bg-sky-50 text-sky-700", received: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-rose-50 text-rose-700", returned: "bg-slate-100 text-slate-700",
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
type Tab = "dashboard" | "bills" | "orders" | "payments";
const NAV: { id: Tab; label: string; icon: typeof Package }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "bills", label: "Bills", icon: FileText },
  { id: "orders", label: "Purchase Orders", icon: Package },
  { id: "payments", label: "Payments", icon: Wallet },
];

/** Supplier area: signed in on the common login page; shows only their bills, orders, payments and balance. */
export default function SupplierPage() {
  const supplier = useSupplier();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const asked = params.get("tab") as Tab | null;
  const tab: Tab = asked && NAV.some((n) => n.id === asked) ? asked : "dashboard";
  const { data, loading, error } = useQuery(GET_SUPPLIER_PORTAL, {
    skip: !supplier.token,
    context: { headers: { Authorization: `Bearer ${supplier.token}` } },
    fetchPolicy: "no-cache",
    onError: (e) => { if (["UNAUTHENTICATED", "FORBIDDEN"].includes(codeOf(e))) supplier.signOut(); },
  });
  if (!supplier.token) return <Navigate to="/login" replace />;

  const p = data?.getSupplierPortal;
  const name = p?.name || supplier.name || "Supplier";
  const initials = name.split(/\s+/).map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  const signOut = () => { supplier.signOut(); navigate("/login"); };
  const label = NAV.find((n) => n.id === tab)!.label;

  return (
    <div>
      <Breadcrumb items={[{ label: "Supplier Account" }]} />
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-100 p-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-700 text-base font-bold text-white">{initials || "S"}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink-900">{name}</p>
              <p className="text-xs text-slate-500">{p?.mobile ? `+91 ${p.mobile}` : "Supplier"}</p>
            </div>
          </div>
          <nav className="space-y-1 rounded-2xl border border-slate-100 p-2">
            {NAV.map(({ id, label: l, icon: Icon }) => (
              <button key={id} type="button" onClick={() => setParams(id === "dashboard" ? {} : { tab: id })}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${tab === id ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50"}`}>
                <Icon className="h-4 w-4" /> {l}
              </button>
            ))}
            <button type="button" onClick={signOut}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-rose-600 hover:bg-rose-50">
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </nav>
        </aside>

        <section className="min-w-0 space-y-5">
          <div>
            <h1 className="text-xl font-bold text-ink-900">{label}</h1>
            {p?.company && <p className="text-sm text-slate-500">Your account with {p.company}</p>}
          </div>
          {loading && !p ? <p className="text-sm text-slate-500">Loading...</p>
            : error || !p ? <p className="text-sm text-rose-600">{error?.message || "Could not load your account."}</p>
            : <Content tab={tab} p={p} go={(t) => setParams({ tab: t })} nav={navigate} />}
        </section>
      </div>
    </div>
  );
}

function Content({ tab, p, go, nav }: { tab: Tab; p: any; go: (t: Tab) => void; nav: NavigateFunction }) {
  const rowCls = "cursor-pointer hover:bg-slate-50";
  const open = p.bills.filter((b: any) => b.outstanding > 0);
  const cell = "px-3 py-2";
  const empty = (t: string) => <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">{t}</td></tr>;
  const billRows = (rows: any[]) => rows.length ? rows.map((b: any) => (
    <tr key={b.id} className={rowCls} onClick={() => nav(`/supplier/bill/${b.id}`)}>
      <td className={`${cell} font-medium text-brand-700`}>{b.billnumber ? `INV-${b.billnumber}` : "-"}</td><td className={cell}>{dateLabel(b.billdate)}</td>
      <td className={`${cell} text-right`}>{rupees(b.totalamount)}</td><td className={`${cell} text-right`}>{rupees(b.outstanding)}</td>
      <td className={cell}><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${b.outstanding > 0 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{b.outstanding <= 0 ? "Paid" : b.outstanding < b.totalamount ? "Part Paid" : "Unpaid"}</span></td>
    </tr>
  )) : empty("No bills yet.");
  const billHead = <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className={cell}>Bill No.</th><th className={cell}>Date</th><th className={`${cell} text-right`}>Amount</th><th className={`${cell} text-right`}>Unpaid</th><th className={cell}>Status</th></tr></thead>;
  const table = (body: React.ReactNode) => <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full text-left text-sm">{body}</table></div>;

  if (tab === "dashboard") {
    const cards = [
      { label: p.payable >= 0 ? "Payable to you" : "You owe us", value: rupees(Math.abs(p.payable)), cls: p.payable >= 0 ? "text-emerald-700" : "text-rose-700", to: "payments" as Tab },
      { label: "Unpaid bills", value: `${open.length} · ${rupees(open.reduce((t: number, b: any) => t + b.outstanding, 0))}`, cls: "text-ink-900", to: "bills" as Tab },
      { label: "Open orders", value: String(p.orders.filter((o: any) => ["pending", "confirmed"].includes(o.orderStatus)).length), cls: "text-ink-900", to: "orders" as Tab },
    ];
    return (
      <>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {cards.map((c) => (
            <button key={c.label} type="button" onClick={() => go(c.to)} className="rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-slate-300">
              <div className="text-xs text-slate-500">{c.label}</div>
              <div className={`text-2xl font-bold ${c.cls}`}>{c.value}</div>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-900">Unpaid bills</h2>
          <button type="button" onClick={() => go("bills")} className="text-sm font-semibold text-brand-700 hover:underline">View all</button>
        </div>
        {table(<>{billHead}<tbody className="divide-y divide-slate-100">{open.length ? billRows(open.slice(0, 5)) : empty("All bills are paid.")}</tbody></>)}
      </>
    );
  }
  if (tab === "bills") return table(<>{billHead}<tbody className="divide-y divide-slate-100">{billRows(p.bills)}</tbody></>);
  if (tab === "orders") return table(
    <>
      <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className={cell}>Order No.</th><th className={cell}>Date</th><th className={`${cell} text-right`}>Items</th><th className={`${cell} text-right`}>Amount</th><th className={cell}>Status</th></tr></thead>
      <tbody className="divide-y divide-slate-100">
        {p.orders.length ? p.orders.map((o: any) => (
          <tr key={o.id} className={rowCls} onClick={() => nav(`/supplier/order/${o.id}`)}>
            <td className={`${cell} font-medium text-brand-700`}>{o.billnumber ? `PO-${o.billnumber}` : "-"}</td><td className={cell}>{dateLabel(o.billdate)}</td>
            <td className={`${cell} text-right`}>{o.items}</td><td className={`${cell} text-right`}>{rupees(o.totalamount)}</td>
            <td className={cell}><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ORDER[o.orderStatus] || ORDER.pending}`}>{cap(o.orderStatus)}</span></td>
          </tr>
        )) : empty("No purchase orders yet.")}
      </tbody>
    </>
  );
  return table(
    <>
      <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className={cell}>Payment No.</th><th className={cell}>Date</th><th className={cell}>Mode</th><th className={cell}>Reference</th><th className={`${cell} text-right`}>Amount</th></tr></thead>
      <tbody className="divide-y divide-slate-100">
        {p.payments.length ? p.payments.map((x: any) => (
          <tr key={x.id}>
            <td className={`${cell} font-medium`}>{x.paymentcode || "-"}{x.type !== "payment" && <span className="ml-2 text-xs text-slate-500">({x.type === "receipt" ? "received from you" : "refund"})</span>}</td>
            <td className={cell}>{dateLabel(x.paymentdate)}</td><td className={cell}>{x.mode ? cap(String(x.mode)) : "-"}</td>
            <td className={cell}>{x.reference || "-"}</td><td className={`${cell} text-right`}>{rupees(x.amount)}</td>
          </tr>
        )) : empty("No payments yet.")}
      </tbody>
    </>
  );
}
