import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Navigate, Link } from "react-router";
import { useQuery, useMutation } from "@apollo/client";
import { ArrowLeft, Banknote, Landmark, QrCode, CreditCard, Receipt, MoreHorizontal, CheckCircle2, ShieldOff } from "lucide-react";
import Breadcrumb from "../../components/breadcrumb";
import { useAuth } from "../../contexts/auth";
import { useTenant } from "../../contexts/tenant";
import { useDownline } from "../../hooks/useDownline";
import { GET_ACCOUNT, GET_ACCOUNT_LEDGERS, ADD_PAYMENT, GET_PAYMENTS, GET_DOWNLINE_PARTY_BALANCES } from "../../graphql/queries/accounts";
import { formatPrice } from "../../utils/format";

type PaymentMode = "cash" | "bank" | "upi" | "card" | "cheque" | "other";

const MODES: { id: PaymentMode; label: string; icon: typeof Banknote }[] = [
  { id: "cash", label: "Cash", icon: Banknote },
  { id: "bank", label: "Bank", icon: Landmark },
  { id: "upi", label: "UPI", icon: QrCode },
  { id: "card", label: "Card", icon: CreditCard },
  { id: "cheque", label: "Cheque", icon: Receipt },
  { id: "other", label: "Other", icon: MoreHorizontal },
];

// Collect a payment from a downline (sub-party) — the website equivalent of
// the app's shared salesman/party CollectPayment screen. Scoped down to
// on-account receipts only (no bill-wise Tally allocation / discount &
// commission split) to keep this a straightforward, correct MVP; the server
// mutation is identical either way (addPayment).
export default function CollectPaymentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isLoggedIn, account } = useAuth();
  const { adminid, branchid } = useTenant();
  const { manageDownline, downlineIds } = useDownline();

  const allowed = manageDownline && !!id && downlineIds.has(id);

  const { data: accountData } = useQuery(GET_ACCOUNT, {
    variables: { id, adminId: adminid },
    skip: !id || !adminid || !allowed,
  });
  const targetAccount = accountData?.getAccountById;

  const { data: ledgerData } = useQuery(GET_ACCOUNT_LEDGERS, {
    variables: { adminId: adminid },
    skip: !adminid || !allowed,
  });
  const cashBankLedgers: any[] = useMemo(
    () => (ledgerData?.getAccountLedgers ?? []).filter((l: any) => l.status !== false),
    [ledgerData]
  );

  const [addPayment] = useMutation(ADD_PAYMENT);

  const [mode, setMode] = useState<PaymentMode>("cash");
  const [ledgerId, setLedgerId] = useState("");
  const [amount, setAmount] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const outstanding = Math.max(0, targetAccount?.outstanding || 0);

  useEffect(() => {
    if (!amountTouched && outstanding > 0) setAmount(String(outstanding));
  }, [outstanding, amountTouched]);

  useEffect(() => {
    if (ledgerId || cashBankLedgers.length === 0) return;
    const byName = (re: RegExp) => cashBankLedgers.find((l: any) => re.test(l.ledgername || ""));
    const match =
      mode === "cash"
        ? byName(/cash/i) || cashBankLedgers[0]
        : mode === "bank"
        ? byName(/bank/i) || byName(/cash/i) || cashBankLedgers[0]
        : byName(/cash/i) || byName(/bank/i) || cashBankLedgers[0];
    if (match) setLedgerId(match.id);
  }, [cashBankLedgers, mode, ledgerId]);

  if (!isLoggedIn) return <Navigate to="/login" replace />;

  if (!allowed) {
    return (
      <div>
        <Breadcrumb items={[{ label: "My Account", to: "/account" }, { label: "Collect Payment" }]} />
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

  const parsedAmount = parseFloat(amount) || 0;
  const selectedMode = MODES.find((m) => m.id === mode)!;

  const handleSubmit = async () => {
    if (!parsedAmount || parsedAmount <= 0) {
      setError("Please enter a valid payment amount.");
      return;
    }
    if (!adminid || !branchid) {
      setError("Store is still loading — please try again in a moment.");
      return;
    }
    if (!ledgerId) {
      setError("Choose which Cash / Bank ledger this payment is deposited to.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await addPayment({
        variables: {
          input: {
            adminid,
            branchid,
            type: "receipt",
            mode,
            partyid: id,
            ledgerid: ledgerId,
            amount: parsedAmount,
            invoices: [],
            reference: reference.trim() || null,
            remarks: notes.trim() || null,
            paymentdate: new Date().toISOString().slice(0, 10),
            createdby_id: account?.id,
            createdby_name: account?.name,
            createdby_type: "party",
            status: true,
          },
        },
        refetchQueries: [
          { query: GET_PAYMENTS, variables: { adminid, partyid: id } },
          { query: GET_DOWNLINE_PARTY_BALANCES, variables: { partyid: account?.id } },
        ],
      });
      setDone(true);
    } catch (err: any) {
      setError(err?.message || "Could not record payment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6">
        <CheckCircle2 className="h-16 w-16 text-brand-600" />
        <h1 className="mt-4 text-2xl font-bold text-ink-900">Payment recorded!</h1>
        <p className="mt-2 text-sm text-slate-500">
          {formatPrice(parsedAmount)} via {selectedMode.label} collected from {targetAccount?.name}.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            to={`/account/parties/${id}/payments`}
            className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
          >
            View Payments
          </Link>
          <Link to="/account" className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-ink-900 hover:bg-slate-50">
            Back to My Account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb items={[{ label: "My Account", to: "/account" }, { label: "Collect Payment" }]} />

      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <h1 className="mb-5 text-xl font-bold text-ink-900">Collect Payment</h1>

        {/* Party card */}
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-slate-100 p-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-50 text-base font-bold text-brand-700">
            {(targetAccount?.name || "P").charAt(0).toUpperCase()}
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-ink-900">{targetAccount?.name || "…"}</p>
            {outstanding > 0 && <p className="text-xs font-semibold text-rose-600">Outstanding: {formatPrice(outstanding)}</p>}
          </div>
          {outstanding > 0 && (
            <button
              onClick={() => {
                setAmount(String(outstanding));
                setAmountTouched(true);
              }}
              className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100"
            >
              Use full
            </button>
          )}
        </div>

        {/* Payment mode */}
        <p className="mb-2.5 text-sm font-semibold text-ink-900">Payment Mode</p>
        <div className="mb-5 grid grid-cols-3 gap-2.5 sm:grid-cols-6">
          {MODES.map((m) => {
            const active = mode === m.id;
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 text-xs font-semibold transition ${
                  active ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-500 hover:border-brand-300"
                }`}
              >
                <Icon className="h-5 w-5" /> {m.label}
              </button>
            );
          })}
        </div>

        {/* Ledger */}
        <label className="mb-1.5 block text-sm font-semibold text-ink-900">Cash / Bank Ledger</label>
        {cashBankLedgers.length === 0 ? (
          <p className="mb-5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
            No ledger found. Ask the admin to create one.
          </p>
        ) : (
          <select
            value={ledgerId}
            onChange={(e) => setLedgerId(e.target.value)}
            className="mb-5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
          >
            <option value="">Select ledger</option>
            {cashBankLedgers.map((l: any) => (
              <option key={l.id} value={l.id}>
                {l.ledgername}
              </option>
            ))}
          </select>
        )}

        {/* Amount */}
        <label className="mb-1.5 block text-sm font-semibold text-ink-900">Amount (₹)</label>
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-slate-200 px-3 focus-within:border-brand-500">
          <span className="text-lg font-bold text-brand-700">₹</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setAmountTouched(true);
            }}
            placeholder="0.00"
            className="w-full py-2.5 text-lg font-bold outline-none placeholder:text-slate-400"
          />
        </div>

        {/* Reference */}
        {mode !== "cash" && (
          <>
            <label className="mb-1.5 block text-sm font-semibold text-ink-900">
              {mode === "upi" ? "UPI Transaction ID" : mode === "cheque" ? "Cheque Number" : mode === "card" ? "Card / Approval Ref" : "Reference"}
            </label>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Cheque no., UTR, etc."
              className="mb-5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
            />
          </>
        )}

        {/* Notes */}
        <label className="mb-1.5 block text-sm font-semibold text-ink-900">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Add a note…"
          className="mb-5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
        />

        {error && <div className="mb-4 rounded-lg bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">{error}</div>}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 py-3 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Recording…" : parsedAmount > 0 ? `Record ${formatPrice(parsedAmount)}` : "Record Payment"}
        </button>
      </div>
    </div>
  );
}
