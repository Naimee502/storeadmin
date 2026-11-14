import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { LogOut, Truck } from "lucide-react";
import Breadcrumb from "../../components/breadcrumb";
import { useTenant } from "../../contexts/tenant";
import { GET_SUPPLIER_PORTAL, LOGIN_SUPPLIER } from "../../graphql/queries/supplier";

const rupees = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const dateLabel = (ymd?: string | null) =>
  ymd ? new Date(`${String(ymd).slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "-";
const codeOf = (e: any) => e?.graphQLErrors?.[0]?.extensions?.code || "";
const ORDER: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700", confirmed: "bg-sky-50 text-sky-700", received: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-rose-50 text-rose-700", returned: "bg-slate-100 text-slate-700",
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Supplier portal: a supplier signs in with mobile + email OTP and sees orders, bills, payments and balance. */
export default function SupplierPage() {
  const { adminid } = useTenant();
  const key = `supplierToken:${adminid}`;
  const [token, setToken] = useState(() => { try { return localStorage.getItem(key) || ""; } catch { return ""; } });
  const save = (t: string) => { try { t ? localStorage.setItem(key, t) : localStorage.removeItem(key); } catch { /* storage off */ } setToken(t); };

  return (
    <div>
      <Breadcrumb items={[{ label: "Supplier Portal" }]} />
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {token && adminid ? <Portal token={token} onSignOut={() => save("")} /> : <SupplierLogin adminid={adminid} onToken={save} />}
      </div>
    </div>
  );
}

function SupplierLogin({ adminid, onToken }: { adminid?: string | null; onToken: (t: string) => void }) {
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [otpStep, setOtpStep] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [login, { loading }] = useMutation(LOGIN_SUPPLIER);

  const submit = async (withOtp: boolean) => {
    if (!adminid || !/^\d{10}$/.test(mobile.trim())) return setError("Enter your 10 digit mobile number.");
    setError("");
    try {
      const { data } = await login({ variables: { adminId: adminid, mobile: mobile.trim(), otp: withOtp ? otp.trim() : undefined } });
      if (data?.loginSupplier?.accessToken) onToken(data.loginSupplier.accessToken);
    } catch (e: any) {
      if (codeOf(e) === "LOGIN_OTP_REQUIRED") { setOtpStep(true); setMsg(e.message); setOtp(""); return; }
      setError(e?.message || "Could not sign in.");
    }
  };

  return (
    <div className="mx-auto max-w-sm space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 text-lg font-bold text-ink-900"><Truck className="h-5 w-5 text-brand-700" /> Supplier Login</div>
      <p className="text-sm text-slate-600">See your purchase orders, bills, payments and balance with us.</p>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit(otpStep); }}>
        <input value={mobile} onChange={(e) => { setMobile(e.target.value.replace(/\D/g, "").slice(0, 10)); setOtpStep(false); }} inputMode="numeric"
          placeholder="Mobile number" className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" />
        {otpStep && (
          <>
            <p className="text-xs text-slate-600">{msg}</p>
            <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoFocus
              placeholder="Enter OTP" className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm tracking-widest" />
          </>
        )}
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={loading || (otpStep && otp.length < 4)}
          className="h-10 w-full rounded-lg bg-brand-600 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
          {loading ? "Please wait..." : otpStep ? "Verify and Sign In" : "Send OTP"}
        </button>
        {otpStep && <button type="button" onClick={() => submit(false)} className="w-full text-sm font-semibold text-brand-700 hover:underline">Resend OTP</button>}
      </form>
    </div>
  );
}

function Portal({ token, onSignOut }: { token: string; onSignOut: () => void }) {
  const [tab, setTab] = useState<"orders" | "bills" | "payments">("bills");
  const { data, loading, error } = useQuery(GET_SUPPLIER_PORTAL, {
    context: { headers: { Authorization: `Bearer ${token}` } },
    fetchPolicy: "no-cache",
    onError: (e) => { if (["UNAUTHENTICATED", "FORBIDDEN"].includes(codeOf(e))) onSignOut(); },
  });
  const p = data?.getSupplierPortal;
  if (loading && !p) return <p className="text-sm text-slate-500">Loading...</p>;
  if (error || !p) return <p className="text-sm text-rose-600">{error?.message || "Could not load your account."}</p>;

  const open = p.bills.filter((b: any) => b.outstanding > 0);
  const cell = "px-3 py-2";
  const empty = (t: string) => <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">{t}</td></tr>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink-900">{p.name}</h1>
          <p className="text-sm text-slate-500">Supplier account with {p.company || "us"}{p.mobile ? ` · ${p.mobile}` : ""}</p>
        </div>
        <button type="button" onClick={onSignOut} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <LogOut className="h-4 w-4" /> Sign Out
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">{p.payable >= 0 ? "Payable to you" : "You owe us"}</div>
          <div className={`text-2xl font-bold ${p.payable >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{rupees(Math.abs(p.payable))}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Unpaid bills</div>
          <div className="text-2xl font-bold text-ink-900">{open.length} <span className="text-base font-semibold text-slate-500">· {rupees(open.reduce((t: number, b: any) => t + b.outstanding, 0))}</span></div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Open orders</div>
          <div className="text-2xl font-bold text-ink-900">{p.orders.filter((o: any) => ["pending", "confirmed"].includes(o.orderStatus)).length}</div>
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        {([["bills", "Bills"], ["orders", "Purchase Orders"], ["payments", "Payments"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${tab === k ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-ink-900"}`}>{l}</button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          {tab === "bills" && (
            <>
              <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className={cell}>Bill No.</th><th className={cell}>Date</th><th className={`${cell} text-right`}>Amount</th><th className={`${cell} text-right`}>Unpaid</th><th className={cell}>Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {p.bills.length ? p.bills.map((b: any) => (
                  <tr key={b.id}>
                    <td className={`${cell} font-medium`}>{b.billnumber || "-"}</td><td className={cell}>{dateLabel(b.billdate)}</td>
                    <td className={`${cell} text-right`}>{rupees(b.totalamount)}</td><td className={`${cell} text-right`}>{rupees(b.outstanding)}</td>
                    <td className={cell}><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${b.outstanding > 0 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{b.outstanding <= 0 ? "Paid" : b.outstanding < b.totalamount ? "Part Paid" : "Unpaid"}</span></td>
                  </tr>
                )) : empty("No bills yet.")}
              </tbody>
            </>
          )}
          {tab === "orders" && (
            <>
              <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className={cell}>Order No.</th><th className={cell}>Date</th><th className={`${cell} text-right`}>Items</th><th className={`${cell} text-right`}>Amount</th><th className={cell}>Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {p.orders.length ? p.orders.map((o: any) => (
                  <tr key={o.id}>
                    <td className={`${cell} font-medium`}>{o.billnumber || "-"}</td><td className={cell}>{dateLabel(o.billdate)}</td>
                    <td className={`${cell} text-right`}>{o.items}</td><td className={`${cell} text-right`}>{rupees(o.totalamount)}</td>
                    <td className={cell}><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ORDER[o.orderStatus] || ORDER.pending}`}>{cap(o.orderStatus)}</span></td>
                  </tr>
                )) : empty("No purchase orders yet.")}
              </tbody>
            </>
          )}
          {tab === "payments" && (
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
          )}
        </table>
      </div>
    </div>
  );
}
