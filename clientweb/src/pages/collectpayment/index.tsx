import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Navigate, Link } from "react-router";
import { useQuery, useMutation, useLazyQuery } from "@apollo/client";
import { ArrowLeft, Banknote, Landmark, QrCode, CreditCard, Receipt, MoreHorizontal, CheckCircle2, ShieldOff } from "lucide-react";
import Breadcrumb from "../../components/breadcrumb";
import { useAuth } from "../../contexts/auth";
import { useTenant } from "../../contexts/tenant";
import { useDownline } from "../../hooks/useDownline";
import { GET_ACCOUNT, GET_ACCOUNT_LEDGERS, ADD_PAYMENT, GET_PAYMENTS, GET_DOWNLINE_PARTY_BALANCES, PREVIEW_ALLOCATION, GET_PARTY_OUTSTANDING_BILLS } from "../../graphql/queries/accounts";
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
// the app's shared salesman/party CollectPayment screen.
//
// The amount is spread by the SERVER (opening balance first, then oldest bills)
// and shown for approval before anything is written, so this behaves exactly
// like the admin panel's Direct / On Account mode. Bill-by-bill picking and
// discount/commission stay admin-only — a downline collecting cash doesn't need
// them, and the server mutation is the same either way (addPayment).
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
  const [previewAllocation] = useLazyQuery(PREVIEW_ALLOCATION, { fetchPolicy: "network-only" });

  const [mode, setMode] = useState<PaymentMode>("cash");
  const [ledgerId, setLedgerId] = useState("");
  const [amount, setAmount] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Server's proposed spread, held while the user approves it. Nothing is
  // written until they press Confirm.
  const [proposal, setProposal] = useState<any>(null);
  // "direct" → type an amount, the server spreads it (opening first, then oldest
  // bills). "invoice" → tick the bills yourself. Same two modes as the admin panel.
  const [settlementMode, setSettlementMode] = useState<"invoice" | "direct">("direct");
  const [ticked, setTicked] = useState<Record<string, number>>({});

  const { data: billsData } = useQuery(GET_PARTY_OUTSTANDING_BILLS, {
    variables: { partyid: id, invoicemodel: "SalesInvoice", adminid, branchid },
    skip: !id || !adminid || !allowed,
    fetchPolicy: "cache-and-network",
  });
  const openBills: any[] = billsData?.getPartyOutstandingBills ?? [];
  const totalOutstandingBills = openBills.reduce((t, b) => t + (b.outstanding || 0), 0);
  const tickedTotal = parseFloat(
    Object.values(ticked).reduce((t: number, v: number) => t + (v || 0), 0).toFixed(2)
  );
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Party-level due from the server: opening balance + open bills − advances.
  // It is deliberately NOT the sum of the bill list — an opening balance is a
  // real debt with no invoice behind it, and the allocator clears it first.
  const outstanding = Math.max(0, targetAccount?.outstanding || 0);
  // Whatever the bills don't explain is the opening balance carried forward.
  // Surfaced so "Outstanding ₹1,250 but only ₹250 of bills" never looks wrong.
  const openingPortion = parseFloat(Math.max(0, outstanding - totalOutstandingBills).toFixed(2));

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

  // Invoice-wise: the ticked rows ARE the amount. Direct: the typed amount.
  const parsedAmount =
    settlementMode === "invoice" && openBills.length > 0
      ? tickedTotal
      : parseFloat(amount) || 0;
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

    // Invoice-wise: the collector already chose the rows, so there is nothing to
    // propose — write it directly.
    if (settlementMode === "invoice" && openBills.length > 0) {
      return handleConfirm();
    }

    // Step 1 — ask the server where this money lands and show it.
    setSubmitting(true);
    try {
      const res: any = await previewAllocation({
        variables: {
          partyid: id,
          invoicemodel: "SalesInvoice",
          adminid,
          branchid,
          amount: parsedAmount,
        },
      });
      setProposal(res?.data?.previewAllocation ?? { lines: [], openingdue: 0, openingsettled: 0, allocated: 0, unallocated: parsedAmount });
    } catch {
      // Preview is a courtesy — fall back to a plain on-account receipt.
      setProposal({ lines: [], openingdue: 0, openingsettled: 0, allocated: 0, unallocated: parsedAmount });
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2 — the user approved the breakdown, so write it.
  const handleConfirm = async () => {
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
            invoices:
              settlementMode === "invoice" && openBills.length > 0
                ? openBills
                    .filter((b) => (ticked[b.id] || 0) > 0)
                    .map((b) => ({
                      invoiceid: b.id,
                      invoicemodel: b.invoicemodel,
                      settledamount: ticked[b.id],
                      discount: 0,
                      commission: 0,
                      allocatedmode: "manual",
                    }))
                : (proposal?.lines ?? []).map((l: any) => ({
                    invoiceid: l.invoiceid,
                    invoicemodel: l.invoicemodel,
                    settledamount: l.settledamount,
                    discount: 0,
                    commission: 0,
                    allocatedmode: "auto_fifo",
                  })),
            openingsettled:
              settlementMode === "invoice" && openBills.length > 0
                ? 0
                : (proposal?.openingsettled ?? 0),
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
      setProposal(null);
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
            {outstanding > 0 && openingPortion > 0.005 && (
              <p className="text-[11px] text-slate-500">
                {formatPrice(totalOutstandingBills)} on bills + {formatPrice(openingPortion)} opening balance
              </p>
            )}
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

        {/* ── Bill Settlement ───────────────────────────────────────────
            Always rendered. Hiding it when the party had no open bills made the
            whole feature look absent — better to show it and say why it's empty. */}
        {true && (
          <div className="mb-5 rounded-xl border border-slate-200 p-4">
            <p className="mb-3 text-sm font-semibold text-ink-900">
              Bill Settlement (Against Invoices) <span className="font-normal text-slate-400">— optional</span>
            </p>

            <div className="mb-3 flex flex-wrap items-center gap-4 border-b border-slate-100 pb-3 text-sm">
              <span className="font-medium text-ink-900">Settlement Mode:</span>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  className="h-4 w-4"
                  checked={settlementMode === "invoice"}
                  onChange={() => setSettlementMode("invoice")}
                />
                <span>Invoice-wise</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  className="h-4 w-4"
                  checked={settlementMode === "direct"}
                  onChange={() => setSettlementMode("direct")}
                />
                <span>Direct / On Account</span>
              </label>
            </div>

            {settlementMode === "direct" ? (
              <div className="rounded-lg bg-slate-50 p-3 text-sm">
                <div className="flex justify-between">
                  <span>Open bills</span>
                  <span className="font-medium">{openBills.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Outstanding</span>
                  <span className="font-semibold text-orange-600">{formatPrice(totalOutstandingBills)}</span>
                </div>
                <p className="pt-2 text-xs text-slate-500">
                  Enter the amount below. Oldest bills are cleared first, and you will
                  see exactly which ones before it saves.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {openBills.map((b) => {
                  const on = (ticked[b.id] || 0) > 0;
                  return (
                    <div
                      key={b.id}
                      className={`rounded-lg border p-3 ${on ? "border-brand-300 bg-brand-50/40" : "border-slate-100"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <label className="flex flex-1 cursor-pointer items-center gap-2.5">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={on}
                            onChange={() =>
                              setTicked((prev) => {
                                const next = { ...prev };
                                if (on) delete next[b.id];
                                else next[b.id] = b.outstanding;
                                return next;
                              })
                            }
                          />
                          <span>
                            <span className="block text-sm font-semibold text-ink-900">INV-{b.billnumber}</span>
                            <span className="block text-xs text-slate-400">{b.billdate}</span>
                          </span>
                        </label>
                        <div className="text-right">
                          <p className="text-xs text-slate-400">Outstanding</p>
                          <p className="text-sm font-semibold text-orange-600">{formatPrice(b.outstanding)}</p>
                        </div>
                        <input
                          type="number"
                          disabled={!on}
                          value={on ? ticked[b.id] : ""}
                          onChange={(e) => {
                            // Never let a row clear more than the bill actually owes —
                            // the server rejects it anyway, so catch it here.
                            const v = Math.min(parseFloat(e.target.value) || 0, b.outstanding);
                            setTicked((prev) => ({ ...prev, [b.id]: v }));
                          }}
                          className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-right text-sm outline-none focus:border-brand-500 disabled:bg-slate-50"
                        />
                      </div>
                    </div>
                  );
                })}
                {openBills.length === 0 && (
                  <p className="py-2 text-sm text-slate-500">
                    No open bills for this party. Anything collected is recorded On Account
                    and applied automatically to their next invoice.
                  </p>
                )}
                {openBills.length > 0 && (
                  <div className="flex justify-between border-t border-slate-100 pt-2 text-sm font-semibold">
                    <span>Total selected</span>
                    <span>{formatPrice(tickedTotal)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Amount — Direct mode only. Invoice-wise takes the total from the
            ticked rows, so an editable box there would just contradict them. */}
        {(settlementMode === "direct" || openBills.length === 0) && (
          <>
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
          </>
        )}

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
          {submitting ? "Working…" : parsedAmount > 0 ? `Record ${formatPrice(parsedAmount)}` : "Record Payment"}
        </button>
      </div>

      {/* Confirm the spread before writing — the collector sees exactly which
          bills this clears, mirroring the admin panel's confirmation dialog. */}
      {proposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-bold text-ink-900">Confirm Payment</h2>
              <p className="mt-1 text-xs text-slate-500">
                {formatPrice(parsedAmount)} from {targetAccount?.name || "this party"} —
                {proposal.openingsettled > 0 ? " opening balance first, then" : ""} oldest bills first.
              </p>
            </div>

            <div className="overflow-auto px-5 py-3">
              {proposal.openingsettled > 0 && (
                <div className="flex items-center justify-between border-b border-slate-100 py-2 text-sm">
                  <div>
                    <p className="font-medium text-ink-900">Opening Balance</p>
                    <p className="text-xs text-slate-400">
                      Oldest debt — cleared before any bill.{" "}
                      {formatPrice(Math.max(0, (proposal.openingdue || 0) - proposal.openingsettled))} left after this.
                    </p>
                  </div>
                  <span className="font-semibold text-ink-900">{formatPrice(proposal.openingsettled)}</span>
                </div>
              )}

              {/* The money landed entirely on the opening balance, so every
                  invoice is still open. Without this the party pays and then
                  wonders why their bills didn't move. */}
              {proposal.openingsettled > 0 && !(proposal.lines ?? []).length && openBills.length > 0 && (
                <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  This clears the opening balance first, so your {openBills.length} open bill
                  {openBills.length !== 1 ? "s" : ""} ({formatPrice(totalOutstandingBills)}) stay
                  {openBills.length === 1 ? "s" : ""} pending. Switch to <strong>Invoice-wise</strong> if
                  you want to pay a specific bill instead.
                </p>
              )}

              {(proposal.lines ?? []).map((l: any) => (
                <div key={l.invoiceid} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm">
                  <div>
                    <p className="font-medium text-ink-900">INV-{l.billnumber}</p>
                    <p className="text-xs text-slate-400">
                      {l.fullysettled ? "Fully paid" : `Partial — ${formatPrice(l.outstanding - l.settledamount)} left`}
                    </p>
                  </div>
                  <span className="font-semibold text-ink-900">{formatPrice(l.settledamount)}</span>
                </div>
              ))}

              {!proposal.openingsettled && !(proposal.lines ?? []).length && (
                <p className="py-2 text-sm text-slate-500">
                  This party has nothing outstanding, so the whole amount is recorded on account.
                </p>
              )}

              {proposal.unallocated > 0 && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                  <div className="flex items-center justify-between text-sm font-medium text-amber-900">
                    <span>On Account</span>
                    <span>{formatPrice(proposal.unallocated)}</span>
                  </div>
                  <p className="mt-1 text-xs text-amber-800">
                    More than they owe. The extra stays as an advance and is applied to their next invoice.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button
                onClick={() => setProposal(null)}
                disabled={submitting}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className="rounded-lg bg-brand-700 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
              >
                {submitting ? "Recording…" : "Confirm & Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
