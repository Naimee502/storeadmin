import { useParams, useNavigate, Navigate, Link } from "react-router";
import { useQuery } from "@apollo/client";
import { ArrowLeft, Wallet2, IndianRupee, ShieldOff } from "lucide-react";
import Breadcrumb from "../../components/breadcrumb";
import { useAuth } from "../../contexts/auth";
import { useTenant } from "../../contexts/tenant";
import { useDownline } from "../../hooks/useDownline";
import { GET_ACCOUNT, GET_PAYMENTS, GET_SALES_ORDERS } from "../../graphql/queries/accounts";
import { formatPrice } from "../../utils/format";
import { formatBillNumber, formatDate, titleCase } from "../../utils/orders";

// Drill-down into a single sub-party's payment history — same screen the
// app's Payments tab opens (isDrill=true) when a channel party taps one of
// its downline parties. Only reachable when downline management is on AND
// this specific id is actually one of the logged-in party's sub-parties.
export default function PartyPaymentsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const { adminid } = useTenant();
  const { manageDownline, downlineIds } = useDownline();

  const allowed = manageDownline && !!id && downlineIds.has(id);

  const { data: accountData } = useQuery(GET_ACCOUNT, {
    variables: { id, adminId: adminid },
    skip: !id || !adminid || !allowed,
  });
  const { data: paymentsData, loading: paymentsLoading } = useQuery(GET_PAYMENTS, {
    variables: { adminid, partyid: id },
    skip: !id || !adminid || !allowed,
    fetchPolicy: "network-only",
  });
  const { data: ordersData } = useQuery(GET_SALES_ORDERS, {
    variables: { adminid, partyacc: id },
    skip: !id || !adminid || !allowed,
    fetchPolicy: "network-only",
  });

  if (!isLoggedIn) return <Navigate to="/login" replace />;

  const account = accountData?.getAccountById;
  // Newest first — same as the app.
  const payments: any[] = [...(paymentsData?.getPayments ?? [])].filter((p: any) => p.status !== false).reverse();
  const orders: any[] = [...(ordersData?.getSalesOrders ?? [])].reverse();
  const outstandingInvoices = orders.filter((o: any) => o.isConverted && o.cancelStatus !== "cancelled");
  const totalOutstanding = Math.max(0, account?.outstanding || 0);
  const totalPaid = payments.reduce((s: number, p: any) => s + (p.amount ?? 0), 0);

  if (!allowed) {
    return (
      <div>
        <Breadcrumb items={[{ label: "My Account", to: "/account" }, { label: "Party" }]} />
        <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6">
          <ShieldOff className="h-14 w-14 text-slate-300" />
          <h1 className="mt-4 text-xl font-bold text-ink-900">Not available</h1>
          <p className="mt-1 text-sm text-slate-500">This party isn't linked under your account.</p>
          <Link to="/account" className="mt-6 rounded-lg bg-brand-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">
            Back to My Account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb items={[{ label: "My Account", to: "/account" }, { label: account?.name || "Party" }]} />

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate("/account")}
          className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to My Account
        </button>

        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-xl font-bold text-ink-900">{account?.name || "Party"} — Payments</h1>
          {totalOutstanding > 0 && (
            <button
              onClick={() => navigate(`/account/parties/${id}/collect`)}
              className="flex items-center gap-1.5 rounded-lg bg-brand-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-800"
            >
              <IndianRupee className="h-3.5 w-3.5" /> Collect Payment
            </button>
          )}
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-100 p-4">
            <p className="text-xs text-slate-500">Total Outstanding</p>
            <p className="mt-1 text-lg font-bold text-rose-600">{formatPrice(totalOutstanding)}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 p-4">
            <p className="text-xs text-slate-500">Total Paid</p>
            <p className="mt-1 text-lg font-bold text-brand-700">{formatPrice(totalPaid)}</p>
          </div>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink-900">Payment History</h2>
          <p className="text-xs text-slate-400">
            {payments.length} payment{payments.length !== 1 ? "s" : ""}
          </p>
        </div>
        {paymentsLoading ? (
          <p className="py-6 text-center text-sm text-slate-400">Loading payments…</p>
        ) : payments.length === 0 ? (
          <p className="rounded-2xl border border-slate-100 py-8 text-center text-sm text-slate-400">No payments yet.</p>
        ) : (
          <div className="space-y-2.5">
            {payments.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                  <Wallet2 className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink-900">#{p.paymentcode}</p>
                  <p className="truncate text-xs text-slate-500">
                    {titleCase(p.type) || "Receipt"} · {titleCase(p.mode) || "Cash"} · {formatDate(p.paymentdate)}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold text-brand-700">{formatPrice(p.amount)}</p>
              </div>
            ))}
          </div>
        )}

        {outstandingInvoices.length > 0 && (
          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-ink-900">Outstanding Invoices</h2>
              <p className="text-xs text-slate-400">
                {outstandingInvoices.length} invoice{outstandingInvoices.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="space-y-2.5">
              {outstandingInvoices.map((o: any) => (
                <div key={o.id} className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-ink-900">{formatBillNumber(o)}</p>
                      <p className="text-xs text-slate-500">{formatDate(o.billdate)}</p>
                    </div>
                    <p className="text-sm font-bold text-brand-700">{formatPrice(o.totalamount)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
