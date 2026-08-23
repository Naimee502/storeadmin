import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import HomeLayout from "../../../layouts/home";
import FormField from "../../../components/formfiled";
import Button from "../../../components/button";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";
import {
  usePaymentMutations,
  usePaymentByIDQuery,
  usePreviewAllocationLazy,
} from "../../../graphql/hooks/payments";
import { useOutstanding } from "../../../graphql/hooks/shared/useoutstanding";
import { useAccountLedgersQuery } from "../../../graphql/hooks/accountledgers";
import { useAccountsQuery } from "../../../graphql/hooks/accounts";
import { useSalesInvoicesQuery } from "../../../graphql/hooks/salesinvoice";
import { usePurchaseInvoicesQuery } from "../../../graphql/hooks/purchaseinvoice";
import { useExpenseNotesQuery } from "../../../graphql/hooks/expensenote";
import { useAdminSettingsQuery } from "../../../graphql/hooks/adminsettings";

type SettledInvoice = {
  invoiceid: string;
  invoicemodel: "SalesInvoice" | "PurchaseInvoice" | "ExpenseNote";
  settledamount: number;
  discount: number;
  commission: number;
  billnumber: string;
  totalamount: number;
  othercharges: any[];
  subtotal: number;
  totalgst: number;
  /** "auto_fifo" when the row came from the FIFO proposal rather than a tick. */
  allocatedmode?: "manual" | "auto_fifo";
};

type ProposalLine = {
  invoiceid: string;
  invoicemodel: string;
  billnumber: string;
  billdate: string;
  outstanding: number;
  settledamount: number;
  fullysettled: boolean;
};

type Proposal = {
  lines: ProposalLine[];
  totaloutstanding: number;
  allocated: number;
  unallocated: number;
  /** Opening balance the party carried in, still unpaid before this receipt. */
  openingdue: number;
  /** How much of THIS amount went to clearing that opening. */
  openingsettled: number;
};

const fmt = (n: number) => n.toFixed(2);

/**
 * A concession is stored ON a bill line, so it needs one. Say where the money
 * actually went instead of a generic "no bill" — the opening balance is cleared
 * before any bill and is invisible on this screen otherwise, which made this
 * message look wrong when the party clearly had an open bill.
 */
const noBillForConcession = (openingsettled = 0, onaccount = 0) => {
  const went = [
    openingsettled > 0 ? `₹${fmt(openingsettled)} cleared the opening balance` : "",
    onaccount > 0 ? `₹${fmt(onaccount)} stayed on account` : "",
  ]
    .filter(Boolean)
    .join(" and ");
  return `${
    went ? `${went[0].toUpperCase()}${went.slice(1)} — no` : "No"
  } bill is being reduced, so a discount or commission has nowhere to sit. Clear the concession, raise the amount so it reaches the bills, or settle invoice-wise.`;
};

const AddEditPayment = () => {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const editLoaded = useRef(false);

  const { type, admin, branch, staff } = useAppSelector((s: any) => s.auth);
  const selectedBranchId = useAppSelector((s: any) => s.selectedBranch?.branchId);

  const adminId =
    type === "admin" ? admin?.id :
    type === "branch" ? branch?.admin?.id :
    type === "staff" ? staff?.admin?.id : undefined;

  const branchId =
    type === "branch" ? branch?.id :
    type === "staff" ? staff?.branchid?.id :
    selectedBranchId;

  const creator = useMemo(() => {
    if (type === "admin" && admin) return { id: admin.id, name: admin.name, type: "admin" };
    if (type === "branch" && branch) return { id: branch.id, name: branch.branchname || "Branch", type: "branch" };
    if (type === "staff" && staff) return { id: staff.id, name: staff.name, type: "staff" };
    return { id: "", name: "Unknown", type: "unknown" };
  }, [type, admin, branch, staff]);

  // ── Data fetching ──────────────────────────────────────────────────────
  const paymentFormPermissions = useAppSelector(state => state.permissions.permissions?.formPermissions?.payments || {});
  const isFieldEnabled = (fieldId: string) => paymentFormPermissions[fieldId] !== false;

  const { data: existingData } = usePaymentByIDQuery(id || "");
  // A ledger or party is very often created seconds before landing here — open
  // Account Ledgers in another tab, add "Ramesh Angadia", come back. Cache-first
  // kept them out of the pickers until a full page reload, so revalidate.
  const { data: ledgerData, refetch: refetchLedgers } =
    useAccountLedgersQuery("cache-and-network");
  const { data: accountsData, refetch: refetchAccounts } =
    useAccountsQuery(true, "cache-and-network");
  // These sources can be created right before opening this page (e.g. "Convert
  // to Invoice"). Use cache-and-network so the settle-able lists always
  // revalidate from the server on mount instead of showing stale cache.
  const { data: salesInvData, refetch: refetchSalesInv } = useSalesInvoicesQuery("cache-and-network");
  const { data: purchaseInvData, refetch: refetchPurchaseInv } = usePurchaseInvoicesQuery("cache-and-network");
  // Payment allocations + journal ("Agst Ref") settlements + un-refunded
  // returns, all derived in one shared hook so this page and the Transaction
  // page can never disagree about what a party still owes.
  const { outstandingOf } = useOutstanding({ excludePaymentId: id || undefined });
  const { data: expenseNotesData, refetch: refetchExpenseNotes } = useExpenseNotesQuery("cache-and-network");

  // Invoices/expense notes can be created right before opening this page (e.g.
  // "Convert to Invoice"). The default cache-first policy would show a stale
  // list, so refetch the settle-able sources once when the page mounts.
  useEffect(() => {
    refetchSalesInv?.();
    refetchPurchaseInv?.();
    refetchExpenseNotes?.();
    // Same for the two pickers — a ledger or party added a moment ago must be
    // selectable without reloading the page.
    refetchLedgers?.();
    refetchAccounts?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Coming back to this tab is the moment a just-created ledger or party is
  // expected to be there, so refresh both then too.
  useEffect(() => {
    const onFocus = () => {
      refetchLedgers?.();
      refetchAccounts?.();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { data: adminSettingsData } = useAdminSettingsQuery(adminId);
  const { addPaymentMutation, editPaymentMutation, reallocatePaymentMutation } = usePaymentMutations();

  // Feature flag (per business): allow Discount & Commission while settling a bill.
  const dcEnabled = !!adminSettingsData?.getAdminSettings?.enablePaymentDiscountCommission;
  // off | ask | always — "ask" is the default because Tally never allocates
  // a rupee the user hasn't seen.
  const autoSettlement: "off" | "ask" | "always" =
    adminSettingsData?.getAdminSettings?.paymentAutoSettlement || "ask";
  const runPreview = usePreviewAllocationLazy();

  // ── Form state ─────────────────────────────────────────────────────────
  const [paymentdate, setPaymentdate] = useState(new Date().toISOString().slice(0, 10));
  const [payType, setPayType] = useState<"receipt" | "payment" | "expense">("receipt");
  const [mode, setMode] = useState("cash");
  const [ledgerid, setLedgerid] = useState("");
  const [partyid, setPartyid] = useState("");
  /**
   * Which side of the voucher faces the cash — Tally's model, where a Receipt /
   * Payment can post against ANY ledger, not only a customer or vendor.
   *
   *  "party"  → the party's own ledger; money can settle their bills.
   *  "ledger" → any ledger at all: Capital introduced, a loan taken or repaid,
   *             rent, salary, interest received, a bank charge, cash to bank.
   *             No party, so no bills, no discount and no commission.
   */
  const [against, setAgainst] = useState<"party" | "ledger">("party");
  const [counterledgerid, setCounterledgerid] = useState("");
  const [reference, setReference] = useState("");
  const [remarks, setRemarks] = useState("");
  const [manualAmount, setManualAmount] = useState<string>("");
  const [settledInvoices, setSettledInvoices] = useState<SettledInvoice[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // "invoice" → tick each bill (classic). "direct" → type one amount and let
  // FIFO spread it, Tally's On-Account/Agst-Ref flow in a single screen.
  const [settlementMode, setSettlementMode] = useState<"invoice" | "direct">("invoice");
  // Direct mode has no per-bill rows to type a concession into, so the discount
  // and commission are entered once for the whole receipt and then spread over
  // whatever bills the FIFO proposal actually clears.
  const [directDiscount, setDirectDiscount] = useState<string>("");
  const [directCommission, setDirectCommission] = useState<string>("");
  // Opening balance this party still carries, as the server last reported it.
  // Null until a preview has run — we never guess it client-side.
  const [openingDue, setOpeningDue] = useState<number | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  // What the confirm dialog should do on approval: create/update the payment,
  // or just re-spread an existing one (which never touches the journal).
  const [proposalIntent, setProposalIntent] = useState<"save" | "reallocate">("save");
  // Result of the last "Allocate now" attempt. Shown inline under the On Account
  // banner rather than as a red toast — "nothing open to apply it to" is a normal
  // state for an advance, not a failure.
  const [allocateNote, setAllocateNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Bill clears = sum of settledamount (reduces outstanding).
  const totalSettled = parseFloat(
    settledInvoices.reduce((s, i) => s + (i.settledamount || 0), 0).toFixed(2)
  );
  // Is the Direct / On Account flow actually driving this screen? (Expense
  // notes are always settled note-wise, and without a party there is nothing
  // to spread an amount over.)
  // ── Outstanding invoices for the selected party ────────────────────────
  // Show ALL invoices for this party (any payment type) that still have
  // outstanding balance — Tally allows settling any invoice regardless of
  // how it was originally recorded (cash, credit, bank).
  const outstandingInvoices = useMemo(() => {
    // Expense settles a credit expense note directly — no party needs to be picked
    // first; we derive the payable party from the note's ledger when it's selected.
    if (!partyid && payType !== "expense") return [];

    let source: any[];
    if (payType === "expense") {
      // ALL outstanding CREDIT expense notes (across parties). Selecting one sets
      // the payable party automatically from its ledger.
      const accounts = accountsData?.getAccounts || [];
      source = (expenseNotesData?.getExpenseNotes || [])
        // Expense notes are notes-only: every unpaid note is a payable settled here.
        .filter((e: any) => e.status && e.ledgerid?.id)
        .map((e: any) => {
          const payableAcc = accounts.find((a: any) => a.ledgerid?.id === e.ledgerid?.id);
          return {
            id: e.id,
            invoicemodel: "ExpenseNote",
            billnumber: e.expensenumber,
            totalamount: e.totalamount,
            subtotal: parseFloat((Number(e.totalamount || 0) - Number(e.totalgst || 0)).toFixed(2)),
            totalgst: e.totalgst || 0,
            othercharges: [],
            status: e.status,
            ledgerid: e.ledgerid,
            payablePartyId: payableAcc?.id || "",
            payablePartyName: payableAcc?.name || e.ledgerid?.ledgername || "",
          };
        });
    } else if (payType === "receipt") {
      source = (salesInvData?.getSalesInvoices || [])
        .filter((inv: any) => inv.partyacc?.id === partyid && inv.status)
        .map((inv: any) => ({ ...inv, invoicemodel: "SalesInvoice" }));
    } else {
      source = (purchaseInvData?.getPurchaseInvoices || [])
        .filter((inv: any) => inv.partyacc?.id === partyid && inv.status)
        .map((inv: any) => ({ ...inv, invoicemodel: "PurchaseInvoice" }));
    }

    return source
      .map((inv: any) => ({ ...inv, outstanding: outstandingOf(inv) }))
      .filter((inv: any) => inv.outstanding > 0);
  }, [partyid, payType, salesInvData, purchaseInvData, expenseNotesData, accountsData, outstandingOf]);

  /**
   * Ledger mode: the other leg is a plain ledger, so there is no party, no bill
   * settlement and no concession — just Dr/Cr between that ledger and cash.
   * Expense mode keeps its own note-wise flow.
   */
  const isLedgerMode = against === "ledger" && payType !== "expense";

  const isDirectSettle =
    !isLedgerMode && settlementMode === "direct" && payType !== "expense" && !!partyid;
  // Concessions can be captured in Direct mode too, but only when there is an
  // allocation to attach them to — with auto-settlement off the money just sits
  // On Account and a discount would have no bill to reduce.
  const directConcessionsAllowed =
    dcEnabled && isDirectSettle && autoSettlement !== "off" && outstandingInvoices.length > 0;
  /**
   * Ledger mode takes the same pair. Settling a running ledger — the angadia,
   * a transporter, a labour contractor — works exactly like settling a party:
   * you knock ₹500 off what they carry, allow ₹20 discount, and ₹480 leaves the
   * drawer. There is no bill, so the figures ride on the payment itself.
   */
  const ledgerConcessionsAllowed = dcEnabled && isLedgerMode;
  /** Either flavour of "one concession figure for the whole voucher". */
  const singleConcession = isDirectSettle || isLedgerMode;
  const concessionsAllowed = directConcessionsAllowed || ledgerConcessionsAllowed;

  // Concessions (only when the feature flag is on). Invoice-wise they come from
  // the ticked rows; Direct and Ledger mode each have one figure for the whole
  // voucher.
  const totalDiscount = !dcEnabled
    ? 0
    : singleConcession
    ? (concessionsAllowed ? parseFloat(directDiscount) || 0 : 0)
    : parseFloat(settledInvoices.reduce((s, i) => s + (i.discount || 0), 0).toFixed(2));
  const totalCommission = !dcEnabled
    ? 0
    : singleConcession
    ? (concessionsAllowed ? parseFloat(directCommission) || 0 : 0)
    : parseFloat(settledInvoices.reduce((s, i) => s + (i.commission || 0), 0).toFixed(2));

  // The box holds the value being SETTLED — exactly what "Settle Now" is on a
  // bill row. Direct mode spreads it over open bills via FIFO; Ledger mode
  // knocks it straight off the chosen ledger.
  const directBillValue = singleConcession ? parseFloat(manualAmount) || 0 : 0;

  // Cash actually moved = bills cleared, LESS discount (concession given), PLUS
  // commission (extra charged on top). This is the payment "amount". When no
  // invoices are linked, the manual amount is the cash.
  // How much cash this payment represents.
  //
  //  • New + Invoice-wise → the ticked rows ARE the amount (tick ₹100, receive ₹100).
  //  • Direct             → same formula, one figure instead of many rows:
  //                         settle ₹100 with ₹5 discount and ₹20 commission and
  //                         ₹115 is the cash — identical to ticking that bill.
  //  • Editing            → the amount is a FACT that already happened. Un-ticking a
  //                         bill re-allocates it; it does not mean the party handed
  //                         over less money. Deriving it from rows here rewrote a
  //                         ₹250 receipt as ₹100 the moment you opened it invoice-wise.
  const totalAmount = singleConcession
    ? parseFloat((directBillValue - totalDiscount + totalCommission).toFixed(2))
    : isEdit
    ? parseFloat(manualAmount) || 0
    : settledInvoices.length > 0
    ? parseFloat((totalSettled - totalDiscount + totalCommission).toFixed(2))
    : parseFloat(manualAmount) || 0;


  /**
   * Is the Invoice-wise / Direct choice on screen? (Same condition the radios
   * render under.) When it is, Invoice-wise means "the ticked bills ARE the
   * amount" — so a free amount box next to it is misleading: whatever was typed
   * there vanished the moment a bill was ticked. Direct / On Account is the
   * mode for typing one amount, and that is where its box lives.
   */
  const settlementModeAvailable =
    !isLedgerMode && payType !== "expense" && !!partyid;

  /** Is there actually something for a concession to reduce? */
  const hasSomethingToSettle = outstandingInvoices.length > 0;

  // A party with nothing open has no bills to tick, so Invoice-wise would show
  // an empty table and no way to enter the amount. Drop straight into Direct /
  // On Account — the one panel that takes an amount for a party.
  useEffect(() => {
    if (isEdit || isLedgerMode || payType === "expense") return;
    if (partyid && !hasSomethingToSettle) setSettlementMode("direct");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyid, hasSomethingToSettle, isLedgerMode, payType]);

  // ── Load existing payment for edit ─────────────────────────────────────
  useEffect(() => {
    if (!isEdit || !existingData?.getPaymentById) return;
    const p = existingData.getPaymentById;
    setPaymentdate(formatDate(p.paymentdate));
    // "expense" is a UI-only mode stored on the server as type "payment", so we
    // can't tell it apart by type alone. Detect it from the settled lines: an
    // expense settlement references an ExpenseNote.
    const isExpense = (p.invoices || []).some((ei: any) => ei.invoicemodel === "ExpenseNote");
    setPayType(isExpense ? "expense" : p.type === "payment" ? "payment" : "receipt");
    setMode(p.mode || "cash");
    setLedgerid(typeof p.ledgerid === "string" ? p.ledgerid : p.ledgerid?.id || "");
    setPartyid(typeof p.partyid === "string" ? p.partyid : p.partyid?.id || "");
    // Saved against a plain ledger → re-open in that mode, not as a party
    // payment with an empty party box.
    const savedCounter =
      typeof p.counterledgerid === "string" ? p.counterledgerid : p.counterledgerid?.id || "";
    setCounterledgerid(savedCounter);
    setAgainst(savedCounter && !isExpense ? "ledger" : "party");
    setReference(p.reference || "");
    setRemarks(p.remarks || "");

    // Re-open the payment in the mode it was created in. A receipt entered as
    // Direct / On Account should not come back as Invoice-wise — the two modes
    // behave differently on save, so showing the wrong one is misleading.
    const savedDirect =
      p.allocationmode === "auto_fifo" || p.allocationmode === "on_account";
    setSettlementMode(savedDirect && !isExpense ? "direct" : "invoice");

    // Direct mode is driven by the amount box, so seed it either way.
    if (savedDirect || !(p.invoices?.length)) {
      setManualAmount(String(p.amount || ""));
    }

    // Concessions ride on the bill lines for a party payment and on the payment
    // itself in Ledger mode; both are edited as ONE figure here, so read
    // whichever the record carries.
    if ((savedDirect || savedCounter) && !isExpense) {
      const lineD = (p.invoices || []).reduce((t: number, i: any) => t + (Number(i.discount) || 0), 0);
      const lineC = (p.invoices || []).reduce((t: number, i: any) => t + (Number(i.commission) || 0), 0);
      const d = lineD || Number(p.discount) || 0;
      const c = lineC || Number(p.commission) || 0;
      setDirectDiscount(d ? String(parseFloat(d.toFixed(2))) : "");
      setDirectCommission(c ? String(parseFloat(c.toFixed(2))) : "");
      // The box holds the SETTLE value, not the cash — reverse the formula so
      // re-opening a ₹115 receipt with ₹5 discount and ₹20 commission shows the
      // ₹100 it actually settled.
      if (d || c) {
        setManualAmount(String(parseFloat(((Number(p.amount) || 0) + d - c).toFixed(2))));
      } else if (savedCounter) {
        setManualAmount(String(p.amount || ""));
      }
    }
  }, [isEdit, existingData]);

  // Load settled invoices once outstanding list is ready (edit mode only)
  useEffect(() => {
    if (!isEdit || editLoaded.current || !existingData?.getPaymentById) return;
    const p = existingData.getPaymentById;
    if (!(p.invoices?.length)) { editLoaded.current = true; return; }
    const isExpense = (p.invoices || []).some((ei: any) => ei.invoicemodel === "ExpenseNote");
    // Wait until the relevant source data is fetched
    if (isExpense) {
      if (!expenseNotesData) return;
    } else if (!salesInvData && !purchaseInvData) return;

    // Look up full invoice data from all invoices (not just outstanding),
    // so we get billnumber and othercharges even for fully-settled invoices.
    const allSales = salesInvData?.getSalesInvoices || [];
    const allPurchase = purchaseInvData?.getPurchaseInvoices || [];
    const allExpense = expenseNotesData?.getExpenseNotes || [];

    const settled: SettledInvoice[] = (p.invoices || []).map((ei: any) => {
      if (ei.invoicemodel === "ExpenseNote") {
        const match =
          outstandingInvoices.find((oi: any) => oi.id === ei.invoiceid) ||
          allExpense.find((e: any) => e.id === ei.invoiceid);
        return {
          invoiceid: ei.invoiceid,
          invoicemodel: ei.invoicemodel,
          settledamount: ei.settledamount,
          discount: ei.discount || 0,
          commission: ei.commission || 0,
          billnumber: match?.billnumber || match?.expensenumber || ei.invoiceid,
          totalamount: match?.totalamount || 0,
          othercharges: [],
          subtotal: match?.subtotal ?? (Number(match?.totalamount || 0) - Number(match?.totalgst || 0)),
          totalgst: match?.totalgst || 0,
        };
      }
      const all = ei.invoicemodel === "PurchaseInvoice" ? allPurchase : allSales;
      const match =
        outstandingInvoices.find((oi: any) => oi.id === ei.invoiceid) ||
        all.find((inv: any) => inv.id === ei.invoiceid);
      return {
        invoiceid: ei.invoiceid,
        invoicemodel: ei.invoicemodel,
        settledamount: ei.settledamount,
        discount: ei.discount || 0,
        commission: ei.commission || 0,
        billnumber: match?.billnumber || ei.invoiceid,
        totalamount: match?.totalamount || 0,
        othercharges: match?.othercharges || [],
        subtotal: match?.subtotal || 0,
        totalgst: match?.totalgst || 0,
      };
    });

    setSettledInvoices(settled);
    editLoaded.current = true;
  }, [isEdit, existingData, outstandingInvoices, salesInvData, purchaseInvData, expenseNotesData]);

  const formatDate = (date: any) => {
    if (!date) return new Date().toISOString().slice(0, 10);
    const ts = Number(date);
    if (!isNaN(ts)) return new Date(ts).toISOString().slice(0, 10);
    return new Date(date).toISOString().slice(0, 10);
  };

  // ── Dropdown options ───────────────────────────────────────────────────
  const partyOptions = useMemo(() => {
    const accounts = accountsData?.getAccounts || [];

    if (payType === "expense") {
      // Show only parties (any type) whose ledger has an outstanding CREDIT
      // expense note — matches expense.ledgerid === account.ledgerid.
      const expenseLedgerIds = new Set(
        (expenseNotesData?.getExpenseNotes || [])
          .filter((e: any) => e.status && e.paymenttype === "credit" && e.ledgerid?.id)
          .map((e: any) => e.ledgerid.id)
      );
      return accounts
        .filter((a: any) => a.ledgerid?.id && expenseLedgerIds.has(a.ledgerid.id))
        .map((a: any) => ({
          value: a.id,
          label: `${a.name}${a.mobile ? ` - ${a.mobile}` : ""}`,
        }));
    }

    return accounts
      .filter((a: any) =>
        payType === "receipt"
          ? a.type === "customer"
          : a.type === "vendor" || a.type === "other"
      )
      .map((a: any) => ({
        value: a.id,
        label: `${a.name}${a.mobile ? ` - ${a.mobile}` : ""}`,
      }));
  }, [accountsData, payType, expenseNotesData]);

  const ledgerOptions = useMemo(() => {
    return (ledgerData?.getAccountLedgers || []).map((l: any) => ({
      value: l.id,
      label: l.ledgername,
    }));
  }, [ledgerData]);

  const selectedLedgerName =
    ledgerData?.getAccountLedgers?.find((l: any) => l.id === ledgerid)?.ledgername || "Cash / Bank Ledger";

  /** The non-cash leg's name — the chosen ledger in Ledger mode, else the party. */
  const counterLegName = isLedgerMode
    ? ledgerData?.getAccountLedgers?.find((l: any) => l.id === counterledgerid)?.ledgername ||
      "Select a ledger"
    : payType === "receipt"
    ? "Party Account (Debtor)"
    : "Party Account (Creditor)";

  // Auto-default the Cash/Bank ledger once a party is chosen (matches the
  // Transaction page's counter-ledger auto-pick), so the Dr (Cash/Bank) and Cr
  // (Party) sides are both set automatically when you start settling invoices.
  useEffect(() => {
    if (ledgerid || !partyid) return;
    const ledgers = ledgerData?.getAccountLedgers || [];
    if (!ledgers.length) return;
    const byName = (re: RegExp) => ledgers.find((l: any) => re.test(l.ledgername || ""));
    const pick =
      mode === "bank" ? (byName(/bank/i) || byName(/cash/i))
      : mode === "cash" ? (byName(/cash/i) || byName(/bank/i))
      : (byName(/cash/i) || byName(/bank/i) || ledgers[0]);
    if (pick) setLedgerid(pick.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyid, mode, ledgerData]);

  // ── Invoice settlement helpers ─────────────────────────────────────────
  const isSelected = (invId: string) => settledInvoices.some(s => s.invoiceid === invId);

  const toggleInvoice = (inv: any) => {
    if (isSelected(inv.id)) {
      setSettledInvoices(prev => prev.filter(s => s.invoiceid !== inv.id));
    } else {
      // Expense note: derive the payable party from its ledger so the journal
      // posts Dr <party-payable> / Cr Cash.
      if (payType === "expense" && inv.payablePartyId && !partyid) {
        setPartyid(inv.payablePartyId);
      }
      setSettledInvoices(prev => [
        ...prev,
        {
          invoiceid: inv.id,
          invoicemodel: inv.invoicemodel,
          settledamount: inv.outstanding,
          discount: 0,
          commission: 0,
          billnumber: inv.billnumber,
          totalamount: inv.totalamount,
          othercharges: inv.othercharges || [],
          subtotal: inv.subtotal || 0,
          totalgst: inv.totalgst || 0,
        },
      ]);
    }
  };

  const updateSettleAmount = (invoiceid: string, amount: number) => {
    setSettledInvoices(prev =>
      prev.map(s => (s.invoiceid === invoiceid ? { ...s, settledamount: amount } : s))
    );
  };

  const updateConcession = (invoiceid: string, field: "discount" | "commission", amount: number) => {
    setSettledInvoices(prev =>
      prev.map(s => (s.invoiceid === invoiceid ? { ...s, [field]: amount } : s))
    );
  };

  // ── Validation & Submit ────────────────────────────────────────────────
  const validate = () => {
    const e: Record<string, string> = {};
    if (!ledgerid) e.ledgerid = "Select a cash / bank ledger";
    if (totalAmount <= 0) e.amount = "Amount must be greater than zero";
    // Every payment needs a second leg. Without one nothing posts: the journal
    // builders all bail out and the payment saves with no Transaction at all.
    if (!isLedgerMode && payType !== "expense" && !partyid) {
      e.counterledgerid =
        "Pick a party, or switch to Ledger — a payment needs the other side to post.";
      return e;
    }
    // Ledger mode has no party to fall back on, so the counter leg is required
    // — without it the voucher would have only one side.
    if (isLedgerMode) {
      if (!counterledgerid) e.counterledgerid = "Select the ledger this is against";
      if (counterledgerid && counterledgerid === ledgerid) {
        e.counterledgerid = "This is the same as the Cash / Bank ledger — pick the other side.";
      }
      // No bill here, so the settle amount itself is the ceiling: you cannot
      // allow more concession than the balance you are knocking off.
      if (ledgerConcessionsAllowed && (totalDiscount > 0 || totalCommission > 0)) {
        if (totalDiscount < 0 || totalCommission < 0) {
          e.amount = "Discount and commission can't be negative";
        } else if (totalDiscount > directBillValue + 0.01) {
          e.amount = `Discount ₹${fmt(totalDiscount)} can't exceed the ₹${fmt(directBillValue)} being settled.`;
        }
      }
      return e;
    }
    // Discount (concession given) can't exceed the bill being cleared.
    if (dcEnabled && !singleConcession) {
      const bad = settledInvoices.find(
        s => (s.discount || 0) > (s.settledamount || 0) + 0.001
      );
      if (bad) e.amount = `Discount can't exceed the settle amount for INV-${bad.billnumber}`;
    }
    // Direct mode: which bills get cleared is only known after the FIFO preview
    // (checkConcessionFits handles that), but these are wrong on their face.
    if (directConcessionsAllowed && (totalDiscount > 0 || totalCommission > 0)) {
      if (totalDiscount < 0 || totalCommission < 0) {
        e.amount = "Discount and commission can't be negative";
      } else if (totalDiscount > directBillValue + 0.01) {
        e.amount = `Discount ₹${fmt(totalDiscount)} can't exceed the ₹${fmt(directBillValue)} being settled.`;
      } else if (totalDiscount > totalOutstanding + 0.01) {
        e.amount = `Discount ₹${fmt(totalDiscount)} is more than the ₹${fmt(totalOutstanding)} this party owes.`;
      }
    }
    // While editing, the rows allocate the amount rather than define it, so they
    // must fit inside it — including whatever already went to the opening balance.
    if (isEdit && settlementMode !== "direct") {
      const applied = parseFloat(
        (totalSettled - totalDiscount + totalCommission + savedOpeningSettled).toFixed(2)
      );
      if (applied > totalAmount + 0.01) {
        e.amount = `Allocated ₹${fmt(applied)} is more than the ₹${fmt(totalAmount)} received. Reduce a settle amount or raise the amount.`;
      }
    }
    return e;
  };

  /**
   * Bills this party has at all (before subtracting anything). Lets the empty
   * state say "everything is settled" instead of the misleading "no invoices
   * found" — the difference matters now that already-paid bills are correctly
   * hidden.
   */
  const partyBillCount = useMemo(() => {
    if (!partyid || payType === "expense") return 0;
    const src =
      payType === "receipt"
        ? (salesInvData?.getSalesInvoices || [])
        : (purchaseInvData?.getPurchaseInvoices || []);
    return src.filter((inv: any) => inv.partyacc?.id === partyid && inv.status).length;
  }, [partyid, payType, salesInvData, purchaseInvData]);

  /** Total still owed by this party across the bills shown. */
  const totalOutstanding = parseFloat(
    outstandingInvoices.reduce((t: number, i: any) => t + (i.outstanding || 0), 0).toFixed(2)
  );

  /**
   * Split one figure across the proposal lines in proportion to what each line
   * clears, with the last line absorbing the rounding so the parts always add
   * back up to the whole. (₹10 over ₹70 + ₹30 → ₹7.00 + ₹3.00, never ₹9.99.)
   */
  const spread = (total: number, lines: ProposalLine[]): number[] => {
    const base = lines.reduce((s, l) => s + (l.settledamount || 0), 0);
    if (!total || base <= 0) return lines.map(() => 0);
    let used = 0;
    return lines.map((l, i) => {
      if (i === lines.length - 1) return parseFloat((total - used).toFixed(2));
      const part = parseFloat(((total * (l.settledamount || 0)) / base).toFixed(2));
      used = parseFloat((used + part).toFixed(2));
      return part;
    });
  };

  /**
   * Turn a server FIFO proposal into rows this page can render/submit.
   *
   * In Direct mode the discount / commission is entered once for the receipt,
   * so it is spread over the bills the proposal actually clears — the server
   * stores and journalises concessions per line, exactly as invoice-wise does.
   */
  const linesFromProposal = (p: Proposal, withConcessions = false): SettledInvoice[] => {
    const discounts = withConcessions ? spread(totalDiscount, p.lines) : [];
    const commissions = withConcessions ? spread(totalCommission, p.lines) : [];
    return p.lines.map((l, i) => {
      const inv = outstandingInvoices.find((o: any) => o.id === l.invoiceid);
      return {
        invoiceid: l.invoiceid,
        invoicemodel: l.invoicemodel as SettledInvoice["invoicemodel"],
        settledamount: l.settledamount,
        discount: discounts[i] || 0,
        commission: commissions[i] || 0,
        billnumber: l.billnumber || inv?.billnumber || "",
        totalamount: inv?.totalamount ?? l.outstanding,
        othercharges: inv?.othercharges || [],
        subtotal: inv?.subtotal || 0,
        totalgst: inv?.totalgst || 0,
        allocatedmode: "auto_fifo",
      };
    });
  };

  /** Bill value the proposal puts on actual bills (the opening leg is not one). */
  const billsAllocated = (p: Proposal) =>
    parseFloat(((p.allocated || 0) - (p.openingsettled || 0)).toFixed(2));

  /**
   * A discount / commission has to sit on a bill line — the opening balance and
   * the On Account remainder are not bills and have nowhere to carry it. Returns
   * an error message when the concession cannot be placed, else "".
   */
  const checkConcessionFits = (p: Proposal): string => {
    if (totalDiscount <= 0 && totalCommission <= 0) return "";
    const onBills = billsAllocated(p);
    if (onBills <= 0) {
      return noBillForConcession(p.openingsettled || 0, p.unallocated || 0);
    }
    if (totalDiscount > onBills + 0.01) {
      return `Discount ₹${fmt(totalDiscount)} is more than the ₹${fmt(
        onBills
      )} of bills this clears. Lower the discount or raise the amount.`;
    }
    return "";
  };

  const persist = async (lines: SettledInvoice[], amount: number, openingsettled = 0) => {
    const input: any = {
      adminid: adminId,
      branchid: branchId,
      paymentdate,
      // "expense" is a UI-only mode (settle a credit expense note); on the
      // server it's a money-out payment (Dr party-payable / Cr cash).
      type: payType === "expense" ? "payment" : payType,
      mode,
      ledgerid,
      // Exactly one of these carries the non-cash leg. Ledger mode has no party
      // and no bills; party mode never sends a counter ledger.
      partyid: isLedgerMode ? null : partyid || null,
      counterledgerid: isLedgerMode ? counterledgerid : null,
      invoices: (isLedgerMode ? [] : lines)
        .filter(s => s.invoiceid)
        .map(s => ({
          invoiceid: s.invoiceid,
          invoicemodel: s.invoicemodel,
          settledamount: s.settledamount,
          discount: dcEnabled ? (s.discount || 0) : 0,
          commission: dcEnabled ? (s.commission || 0) : 0,
          allocatedmode: s.allocatedmode || "manual",
        })),
      amount,
      // Payment-level concession totals. In Ledger mode there is no bill line
      // to carry them, and for every other mode these are simply the sum of the
      // lines — denormalised so a report never has to walk invoices[].
      discount: dcEnabled ? totalDiscount : 0,
      commission: dcEnabled ? totalCommission : 0,
      // Part of this receipt that cleared the party's opening balance. Not a
      // bill, so it can't live in invoices[] — see the note on the model.
      openingsettled,
      reference: reference || undefined,
      remarks: remarks || undefined,
      status: true,
      createdby_id: creator.id,
      createdby_name: creator.name,
      createdby_type: creator.type,
    };

    setSaving(true);
    try {
      if (isEdit) {
        await editPaymentMutation({ variables: { id, input } });
        dispatch(showMessage({ message: "Payment updated", type: "success" }));
      } else {
        await addPaymentMutation({ variables: { input } });
        dispatch(showMessage({ message: "Payment saved", type: "success" }));
      }
      navigate("/payments");
    } catch (err: any) {
      // The server rejects over-settlement (two users clearing the same bill),
      // so surface its message rather than a generic one.
      dispatch(showMessage({ message: err?.message || "Error saving payment", type: "error" }));
    } finally {
      setSaving(false);
      setProposal(null);
    }
  };

  /** Amount on THIS payment that is still unallocated (edit mode only). */
  const savedUnallocated = Number(existingData?.getPaymentById?.unallocatedamount) || 0;
  /**
   * Opening balance this receipt already cleared. Carried through on a plain
   * edit — otherwise re-saving the payment would silently drop the opening leg
   * and the party would look like they still owe it.
   */
  const savedOpeningSettled = Number(existingData?.getPaymentById?.openingsettled) || 0;

  /** Propose a FIFO spread for the floating part of an already-saved payment. */
  const startReallocate = async () => {
    try {
      const res = await runPreview({
        variables: {
          partyid,
          invoicemodel: payType === "receipt" ? "SalesInvoice" : "PurchaseInvoice",
          adminid: adminId,
          branchid: branchId,
          amount: savedUnallocated,
          // NOT excluded on purpose: we want what is still open GIVEN this
          // payment's existing allocations. Excluding it would re-offer the very
          // bills this payment has already cleared.
        },
      });
      const p: Proposal | null = res?.data?.previewAllocation || null;
      if (!p || !p.lines.length) {
        setAllocateNote(
          "Nothing open to apply it to right now — every bill and the opening balance are settled. It stays as an advance and goes on to their next invoice automatically."
        );
        return;
      }
      setAllocateNote("");
      setProposalIntent("reallocate");
      setProposal(p);
    } catch (err: any) {
      dispatch(showMessage({ message: err?.message || "Could not work out the settlement", type: "error" }));
    }
  };

  /** Apply the approved spread ON TOP of what this payment already settles. */
  const commitReallocate = async (p: Proposal) => {
    setSaving(true);
    try {
      const merged = [
        ...settledInvoices.map((s) => ({
          invoiceid: s.invoiceid,
          invoicemodel: s.invoicemodel,
          settledamount: s.settledamount,
          discount: dcEnabled ? (s.discount || 0) : 0,
          commission: dcEnabled ? (s.commission || 0) : 0,
          allocatedmode: s.allocatedmode || "manual",
        })),
        ...p.lines.map((l) => ({
          invoiceid: l.invoiceid,
          invoicemodel: l.invoicemodel,
          settledamount: l.settledamount,
          discount: 0,
          commission: 0,
          allocatedmode: "auto_fifo",
        })),
      ];
      await reallocatePaymentMutation({ variables: { id, invoices: merged } });
      dispatch(showMessage({ message: "Allocation updated", type: "success" }));
      navigate("/payments");
    } catch (err: any) {
      dispatch(showMessage({ message: err?.message || "Could not re-allocate", type: "error" }));
    } finally {
      setSaving(false);
      setProposal(null);
    }
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});

    // Ledger mode: two legs, nothing to allocate — save straight away.
    if (isLedgerMode) {
      return persist([], totalAmount, 0);
    }

    // Invoice-wise, or auto-settlement switched off → save exactly what the
    // user built. In "off" mode a direct amount simply stays On Account.
    if (!isDirectSettle || autoSettlement === "off") {
      return persist(settledInvoices, totalAmount, savedOpeningSettled);
    }

    let p: Proposal | null = null;
    try {
      const res = await runPreview({
        variables: {
          partyid,
          invoicemodel: payType === "receipt" ? "SalesInvoice" : "PurchaseInvoice",
          adminid: adminId,
          branchid: branchId,
          // Bill value, not cash — a discount clears more bill than the money
          // received, a commission clears less. See directBillValue.
          amount: directBillValue,
          excludePaymentId: id || undefined,
        },
      });
      p = res?.data?.previewAllocation || null;
      // Remember what the server says is carried forward. The panel shows open
      // BILLS only, but the opening balance is cleared before any of them — so
      // without this the user can't see why their amount never reached a bill.
      setOpeningDue(p ? Number(p.openingdue) || 0 : 0);
    } catch (err: any) {
      dispatch(showMessage({ message: err?.message || "Could not work out the settlement", type: "error" }));
      return;
    }

    // Nothing open to settle → the whole amount is On Account. Saving it is
    // still correct: the party ledger is posted in full either way.
    // No open bills, but the opening balance may still soak up part of it.
    if (!p || (!p.lines.length && !p.openingsettled)) {
      if (totalDiscount > 0 || totalCommission > 0) {
        setErrors({ amount: noBillForConcession(0, totalAmount) });
        return;
      }
      return persist([], totalAmount, 0);
    }

    // A concession is a reduction OF A BILL, so it has to live on a bill line.
    // The opening balance is not one, and neither is an On Account remainder.
    const concessionError = checkConcessionFits(p);
    if (concessionError) {
      setErrors({ amount: concessionError });
      return;
    }

    if (autoSettlement === "always") {
      return persist(linesFromProposal(p, true), totalAmount, p.openingsettled);
    }
    // "ask" → show it and let the user decide. Nothing is written yet.
    setProposalIntent("save");
    setProposal(p);
  };

  // ── Render ─────────────────────────────────────────────────────────────
  // Direct-mode concessions are spread across the proposed bills; show that
  // split in the confirm dialog so nobody has to trust it blind.
  const showConcessionSplit =
    !!proposal &&
    proposalIntent === "save" &&
    directConcessionsAllowed &&
    (totalDiscount > 0 || totalCommission > 0);
  const proposalDiscounts = showConcessionSplit ? spread(totalDiscount, proposal!.lines) : [];
  const proposalCommissions = showConcessionSplit ? spread(totalCommission, proposal!.lines) : [];

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6 text-sm sm:text-base">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-6">
          {isEdit ? "Edit Payment" : "Add Payment"}
        </h2>

        <div className="space-y-6">
          {/* ── Section 1: Main Info ─────────────────────────────────── */}
          <fieldset className="border rounded-xl p-4 space-y-4">
            <legend className="text-sm font-medium px-2">Payment Info</legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {isFieldEnabled("paymentdate") && (<FormField
                label="Payment Date"
                name="paymentdate"
                type="date"
                value={paymentdate}
                onChange={e => setPaymentdate(e.target.value)}
              />)}
              {isFieldEnabled("type") && (<FormField
                label="Type"
                name="type"
                type="select"
                value={payType}
                onChange={e => {
                  setPayType(e.target.value as "receipt" | "payment" | "expense");
                  setPartyid("");
                  setSettledInvoices([]);
                  setAgainst("party");
                  setCounterledgerid("");
                  setDirectDiscount("");
                  setDirectCommission("");
                  if (!isEdit) setManualAmount("");
                  editLoaded.current = false;
                }}
                /* Direction only. These used to read "from Customer" / "to
                   Vendor", which stopped being true the moment the other side
                   could be a plain ledger — capital, a loan, rent, interest.
                   Who or what it is against is the next field's job. */
                options={[
                  { label: "Payment In  (Receipt)", value: "receipt" },
                  { label: "Payment Out  (Payment)", value: "payment" },
                  { label: "Expense  (Settle Expense Note)", value: "expense" },
                ]}
              />)}
              {isFieldEnabled("mode") && (<FormField
                label="Mode"
                name="mode"
                type="select"
                value={mode}
                onChange={e => setMode(e.target.value)}
                options={[
                  { label: "Cash", value: "cash" },
                  { label: "Bank", value: "bank" },
                  { label: "UPI", value: "upi" },
                  { label: "Card", value: "card" },
                  { label: "Cheque", value: "cheque" },
                  { label: "Other", value: "other" },
                ]}
              />)}
              {payType !== "expense" ? (
                /* Tally's Receipt / Payment: the other side of the voucher is a
                   ledger. Usually that ledger belongs to a party, but plenty of
                   real entries have no party at all — capital, a loan, rent,
                   salary, interest, a bank charge, cash moved to the bank. */
                isFieldEnabled("party") && (
                  <div className="flex flex-col">
                    <div className="flex flex-wrap items-center gap-3 mb-1">
                      <span className="text-sm font-medium">
                        {isLedgerMode
                          ? "Against Ledger"
                          : payType === "receipt"
                          ? "Customer (Party)"
                          : "Vendor (Party)"}
                      </span>
                      <div className="flex items-center gap-3 text-xs">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            className="w-3.5 h-3.5"
                            checked={against === "party"}
                            onChange={() => {
                              setAgainst("party");
                              setCounterledgerid("");
                            }}
                          />
                          <span>Party</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            className="w-3.5 h-3.5"
                            checked={against === "ledger"}
                            onChange={() => {
                              // No party ⇒ no bills, no concession. Drop them
                              // rather than leave them set but unreachable.
                              setAgainst("ledger");
                              setPartyid("");
                              setSettledInvoices([]);
                              setDirectDiscount("");
                              setDirectCommission("");
                            }}
                          />
                          <span>Ledger</span>
                        </label>
                      </div>
                    </div>

                    {isLedgerMode ? (
                      <>
                        <FormField
                          label=""
                          name="counterledgerid"
                          type="select"
                          value={counterledgerid}
                          onChange={e => setCounterledgerid(e.target.value)}
                          options={ledgerOptions}
                          placeholder="Capital, Loan, Rent, Salary, Interest…"
                          searchable
                          error={errors.counterledgerid}
                        />
                        <span className="text-[11px] text-gray-500 mt-1">
                          {payType === "receipt"
                            ? "Where the money came from. No bills — this posts Dr Cash / Cr this ledger."
                            : "What the money was for. No bills — this posts Dr this ledger / Cr Cash."}
                        </span>
                      </>
                    ) : (
                      <FormField
                        label=""
                        name="partyid"
                        type="select"
                        value={partyid}
                        onChange={e => {
                          setPartyid(e.target.value);
                          setSettledInvoices([]);
                          // A concession belongs to the party it was agreed with, and
                          // the amount box may be hidden for the new party — don't let
                          // either linger unseen.
                          setDirectDiscount("");
                          setDirectCommission("");
                          if (!isEdit) setManualAmount("");
                        }}
                        options={partyOptions}
                        /* Not optional any more: in Party mode this IS the other
                           leg, and without it nothing posts. */
                        placeholder={payType === "receipt" ? "Select customer" : "Select vendor"}
                        searchable
                      />
                    )}
                  </div>
                )
              ) : (
                <div className="flex flex-col justify-end text-sm text-gray-500">
                  <span className="font-medium text-gray-700 mb-1">Expense Note</span>
                  <span>Pick an expense note to settle from the list below.</span>
                </div>
              )}
              {isFieldEnabled("cashbankledger") && (<FormField
                label="Cash / Bank Ledger"
                name="ledgerid"
                type="select"
                value={ledgerid}
                onChange={e => setLedgerid(e.target.value)}
                options={ledgerOptions}
                placeholder="Select ledger"
                searchable
                error={errors.ledgerid}
              />)}
              {isFieldEnabled("reference") && (<FormField
                label="Reference"
                name="reference"
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="Cheque no., UTR, etc."
              />)}
              {isFieldEnabled("remarks") && (<FormField
                label="Remarks"
                name="remarks"
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="Optional"
              />)}
            </div>
          </fieldset>

          {/* ── Section 2: Outstanding Invoice Settlement ─────────────── */}
          {(partyid || payType === "expense") && (
            <fieldset className="border rounded-xl p-4 space-y-4">
              <legend className="text-sm font-medium px-2">
                {payType === "expense"
                  ? "Settle Expense Note — pick one or more"
                  : "Bill Settlement (Against Invoices) — optional"}
              </legend>

              {/* An already-saved payment with money still floating. Re-allocating
                  moves attribution only — the party ledger was posted in full
                  when the cash arrived, so no journal entry is created. */}
              {isEdit && savedUnallocated > 0 && payType !== "expense" && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm">
                    <span className="font-medium text-amber-900">
                      ₹{fmt(savedUnallocated)} On Account
                    </span>
                    <p className="text-xs text-amber-800 mt-0.5">
                      Of ₹{fmt(Number(existingData?.getPaymentById?.amount) || 0)} received:
                      {savedOpeningSettled > 0 ? ` ₹${fmt(savedOpeningSettled)} opening +` : ""}{" "}
                      ₹{fmt(
                        (existingData?.getPaymentById?.invoices || []).reduce(
                          (t: number, i: any) => t + (Number(i.settledamount) || 0),
                          0
                        )
                      )}{" "}
                      bills applied, ₹{fmt(savedUnallocated)} still unapplied.
                    </p>
                    {allocateNote && (
                      <p className="text-xs text-amber-900 mt-2 max-w-2xl">{allocateNote}</p>
                    )}
                  </div>
                  <Button variant="outline" onClick={startReallocate} disabled={saving}>
                    Allocate now
                  </Button>
                </div>
              )}

              {/* Invoice-wise vs Direct. Direct is Tally's On-Account entry: one
                  amount, spread over the open bills oldest-first, shown for
                  confirmation before anything is written. */}
              {settlementModeAvailable && (
                <div className="flex flex-wrap items-center gap-4 text-sm border-b pb-3">
                  <span className="font-medium">Settlement Mode:</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      className="w-4 h-4"
                      checked={settlementMode === "invoice"}
                      onChange={() => {
                        // Invoice-wise takes its amount from the ticked rows and
                        // hides the amount box, so an amount typed in Direct must
                        // not stay behind invisibly and get saved.
                        if (!isEdit) setManualAmount("");
                        setSettlementMode("invoice");
                      }}
                    />
                    <span>Invoice-wise</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      className="w-4 h-4"
                      checked={settlementMode === "direct"}
                      onChange={() => {
                        // Switching is only a change of view — the ticked rows
                        // are kept, so flipping back and forth loses nothing.
                        // Direct mode is amount-driven, so carry the current
                        // total across as the starting amount.
                        // The Direct box is a bill figure, so carry the bills
                        // cleared across — not the cash they added up to.
                        const seed =
                          settledInvoices.length > 0 ? totalSettled : totalAmount;
                        if (!manualAmount && seed > 0) {
                          setManualAmount(String(seed));
                        }
                        // Carry any concession typed on the rows across as the
                        // receipt-level figure, so switching view loses nothing.
                        if (dcEnabled && !directDiscount && totalDiscount > 0) {
                          setDirectDiscount(String(totalDiscount));
                        }
                        if (dcEnabled && !directCommission && totalCommission > 0) {
                          setDirectCommission(String(totalCommission));
                        }
                        setSettlementMode("direct");
                      }}
                    />
                    <span>Direct / On Account</span>
                  </label>
                  {settlementMode === "direct" && autoSettlement === "off" && (
                    <span className="text-xs text-amber-700">
                      Auto-settlement is off in Settings — this amount will stay On Account.
                    </span>
                  )}
                </div>
              )}

              {isDirectSettle ? (
                /* Read top to bottom the way the entry is actually made: what
                   this party owes → the money that moved → any concession on it
                   → what that adds up to on the bills. The amount box lives here
                   rather than in the Amount section below, so the total is never
                   shown above the figures it is made of. */
                <div className="rounded-lg bg-gray-50 border p-4 space-y-4 text-sm">
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Open bills</span>
                      <span className="font-medium">{outstandingInvoices.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Outstanding</span>
                      <span className="font-semibold text-orange-600">₹{fmt(totalOutstanding)}</span>
                    </div>
                    {/* Cleared BEFORE any bill, so it has to be on screen —
                        otherwise an amount smaller than this never reaches a
                        bill and there is nothing to explain why. */}
                    {openingDue !== null && openingDue > 0 && (
                      <div className="flex justify-between">
                        <span>
                          Opening Balance
                          <span className="block text-[11px] text-gray-500">
                            Carried forward — cleared before any bill.
                          </span>
                        </span>
                        <span className="font-semibold text-orange-600">₹{fmt(openingDue)}</span>
                      </div>
                    )}
                  </div>

                  {/* The three inputs stack in the order the entry is made —
                      amount, then discount, then commission — with the boxes in
                      the same right-hand column as the figures above and the
                      totals below, so one line of numbers runs down the panel. */}
                  <div className="pt-3 border-t space-y-3">
                    {isFieldEnabled("amount") && (
                      <label className="flex items-start justify-between gap-4">
                        <span className="pt-1.5">
                          <span className="font-medium text-gray-700">
                            {hasSomethingToSettle ? "Settle Amount (₹)" : "Amount (₹)"}
                          </span>
                          <span className="block text-[11px] text-gray-500">
                            {!hasSomethingToSettle
                              ? "Nothing open — this is recorded On Account and goes onto their next invoice."
                              : directConcessionsAllowed
                              ? "Bill value to clear — same as Settle Now on a bill row."
                              : "Cleared against the oldest bills first."}
                          </span>
                        </span>
                        <input
                          type="number"
                          className={`w-40 shrink-0 border rounded px-2 py-1 text-right ${
                            errors.amount ? "border-red-400" : "border-gray-300"
                          }`}
                          value={manualAmount}
                          placeholder="0.00"
                          min={0}
                          step={0.01}
                          onChange={e => setManualAmount(e.target.value)}
                        />
                      </label>
                    )}

                    {/* Same pair as the invoice-wise table, entered once because
                        Direct mode picks the bills itself; they are spread across
                        those bills on save. */}
                    {directConcessionsAllowed && (
                      <>
                        <label className="flex items-start justify-between gap-4">
                          <span className="pt-1.5">
                            <span className="font-medium text-gray-700">Discount (₹)</span>
                            <span className="block text-[11px] text-gray-500">
                              {payType === "receipt"
                                ? "Concession you allowed — comes off the cash received."
                                : "Discount the vendor allowed — comes off the cash paid."}
                            </span>
                          </span>
                          <input
                            type="number"
                            className="w-40 shrink-0 border rounded px-2 py-1 border-gray-300 text-right"
                            value={directDiscount}
                            placeholder="0.00"
                            min={0}
                            step={0.01}
                            onChange={e => setDirectDiscount(e.target.value)}
                          />
                        </label>
                        <label className="flex items-start justify-between gap-4">
                          <span className="pt-1.5">
                            <span className="font-medium text-gray-700">Commission (₹)</span>
                            <span className="block text-[11px] text-gray-500">
                              Charged on top — adds to the cash, not to the bill.
                            </span>
                          </span>
                          <input
                            type="number"
                            className="w-40 shrink-0 border rounded px-2 py-1 border-gray-300 text-right"
                            value={directCommission}
                            placeholder="0.00"
                            min={0}
                            step={0.01}
                            onChange={e => setDirectCommission(e.target.value)}
                          />
                        </label>
                      </>
                    )}
                  </div>

                  {/* Step 3 — the result. Same arithmetic, same wording, same
                      order as the invoice-wise summary box: bills cleared, less
                      the discount, plus the commission, equals the cash. */}
                  {directBillValue > 0 && (totalDiscount > 0 || totalCommission > 0) && (
                    <div className="rounded-md bg-white border px-3 py-2 space-y-1">
                      <div className="flex justify-between text-gray-600">
                        <span>Bills Cleared:</span>
                        <span>₹{fmt(directBillValue)}</span>
                      </div>
                      {totalDiscount > 0 && (
                        <div className="flex justify-between text-gray-500">
                          <span>Less Discount:</span>
                          <span>− ₹{fmt(totalDiscount)}</span>
                        </div>
                      )}
                      {totalCommission > 0 && (
                        <div className="flex justify-between text-gray-500">
                          <span>Add Commission:</span>
                          <span>+ ₹{fmt(totalCommission)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-semibold border-t pt-1">
                        <span>{payType === "receipt" ? "Cash Received:" : "Cash Paid:"}</span>
                        <span>₹{fmt(totalAmount)}</span>
                      </div>
                    </div>
                  )}

                  {errors.amount && (
                    <div className="text-red-600 text-xs">{errors.amount}</div>
                  )}

                  {hasSomethingToSettle ? (
                    <p className="text-xs text-gray-500">
                      Oldest bills are cleared first, and you will see exactly which ones
                      {directConcessionsAllowed
                        ? " — and how the discount / commission is split across them —"
                        : ""}{" "}
                      before it saves.
                    </p>
                  ) : (
                    dcEnabled && (
                      <p className="text-xs text-gray-500">
                        No discount or commission — this isn't clearing a bill yet. Give the
                        concession on the bill it belongs to, once one exists.
                      </p>
                    )
                  )}
                </div>
              ) : outstandingInvoices.length === 0 ? (
                <>
                  <p className="text-sm text-gray-500">
                    {payType === "expense"
                      ? "No outstanding credit expense notes to settle."
                      : partyBillCount > 0
                      ? `All ${partyBillCount} bill(s) for this party are already fully settled — by their own receipts, by earlier payments, or by returns. Anything entered below is recorded On Account.`
                      : "This party has no invoices yet. Anything entered below is recorded On Account."}
                  </p>
                </>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead className="bg-gray-50">
                      <tr className="text-left">
                        <th className="px-3 py-2 w-10"></th>
                        <th className="px-3 py-2">Invoice #</th>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2 text-right">Subtotal</th>
                        <th className="px-3 py-2 text-right">Other Charges</th>
                        <th className="px-3 py-2 text-right">GST</th>
                        <th className="px-3 py-2 text-right">Invoice Total</th>
                        <th className="px-3 py-2 text-right text-orange-600">Outstanding</th>
                        <th className="px-3 py-2 text-right">Settle Now</th>
                        {dcEnabled && <th className="px-3 py-2 text-right">Discount</th>}
                        {dcEnabled && <th className="px-3 py-2 text-right">Commission</th>}
                        {dcEnabled && <th className="px-3 py-2 text-right text-green-700">Cash In</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {outstandingInvoices.map((inv: any) => {
                        const selected = settledInvoices.find(s => s.invoiceid === inv.id);
                        const otherChargesTotal = (inv.othercharges || []).reduce(
                          (s: number, c: any) => s + (c.totalamount || 0),
                          0
                        );
                        return (
                          <tr
                            key={inv.id}
                            className={`border-t ${selected ? "bg-blue-50" : "hover:bg-gray-50"}`}
                          >
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={!!selected}
                                onChange={() => toggleInvoice(inv)}
                                className="w-4 h-4"
                              />
                            </td>
                            <td className="px-3 py-2 font-medium">
                              {inv.invoicemodel === "ExpenseNote" ? inv.billnumber : `INV-${inv.billnumber}`}
                              {inv.invoicemodel === "ExpenseNote" && inv.payablePartyName && (
                                <div className="text-xs text-gray-500 font-normal">{inv.payablePartyName}</div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-gray-500">{inv.billdate || "-"}</td>
                            <td className="px-3 py-2 text-right">₹{fmt(inv.subtotal || 0)}</td>
                            <td className="px-3 py-2 text-right">
                              <span>₹{fmt(otherChargesTotal)}</span>
                              {(inv.othercharges || []).length > 0 && (
                                <div className="text-xs text-gray-500 mt-0.5 space-y-0.5">
                                  {inv.othercharges.map((c: any, ci: number) => (
                                    <div key={ci} className="text-right">
                                      {c.ledgerid?.ledgername || c.ledgername}: ₹{fmt(c.totalamount || 0)}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">₹{fmt(inv.totalgst || 0)}</td>
                            <td className="px-3 py-2 text-right font-semibold">₹{fmt(inv.totalamount || 0)}</td>
                            <td className="px-3 py-2 text-right font-semibold text-orange-600">
                              ₹{fmt(inv.outstanding)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {selected ? (
                                <input
                                  type="number"
                                  className="w-28 border rounded px-2 py-1 border-gray-300 text-right"
                                  value={selected.settledamount}
                                  min={0.01}
                                  max={inv.outstanding}
                                  step={0.01}
                                  onChange={e =>
                                    updateSettleAmount(inv.id, parseFloat(e.target.value) || 0)
                                  }
                                />
                              ) : (
                                <span className="text-gray-400 text-xs">—</span>
                              )}
                            </td>
                            {dcEnabled && (
                              <td className="px-3 py-2 text-right">
                                {selected ? (
                                  <input
                                    type="number"
                                    className="w-24 border rounded px-2 py-1 border-gray-300 text-right"
                                    value={selected.discount || ""}
                                    placeholder="0"
                                    min={0}
                                    step={0.01}
                                    onChange={e =>
                                      updateConcession(inv.id, "discount", parseFloat(e.target.value) || 0)
                                    }
                                  />
                                ) : (
                                  <span className="text-gray-400 text-xs">—</span>
                                )}
                              </td>
                            )}
                            {dcEnabled && (
                              <td className="px-3 py-2 text-right">
                                {selected ? (
                                  <input
                                    type="number"
                                    className="w-24 border rounded px-2 py-1 border-gray-300 text-right"
                                    value={selected.commission || ""}
                                    placeholder="0"
                                    min={0}
                                    step={0.01}
                                    onChange={e =>
                                      updateConcession(inv.id, "commission", parseFloat(e.target.value) || 0)
                                    }
                                  />
                                ) : (
                                  <span className="text-gray-400 text-xs">—</span>
                                )}
                              </td>
                            )}
                            {dcEnabled && (
                              <td className="px-3 py-2 text-right font-semibold text-green-700">
                                {selected
                                  ? `₹${fmt(Math.max(0, (selected.settledamount || 0) - (selected.discount || 0) + (selected.commission || 0)))}`
                                  : <span className="text-gray-400 text-xs">—</span>}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Invoice-wise with nothing ticked: say where the amount comes
                  from, and point at the mode that takes a typed one. This is
                  where the free amount box used to sit. */}
              {settlementModeAvailable &&
                settlementMode === "invoice" &&
                settledInvoices.length === 0 &&
                !isEdit && (
                  <div className="rounded-lg border border-dashed bg-gray-50 px-4 py-3 text-xs text-gray-600">
                    Tick the bills this {payType === "receipt" ? "receipt" : "payment"} clears —
                    the amount adds up from them. To enter one amount instead and let it
                    settle the oldest bills{" "}
                    {dcEnabled ? "(with a discount or commission if any)" : ""}, switch to{" "}
                    <button
                      type="button"
                      className="underline font-medium text-blue-700"
                      onClick={() => setSettlementMode("direct")}
                    >
                      Direct / On Account
                    </button>
                    .
                    {errors.amount && (
                      <div className="text-red-600 mt-1">{errors.amount}</div>
                    )}
                  </div>
                )}

              {/* Expense mode: same rule — the ticked notes are the amount.
                  There is nothing to type, so there is no amount box. */}
              {payType === "expense" &&
                !isEdit &&
                outstandingInvoices.length > 0 &&
                settledInvoices.length === 0 && (
                  <div className="rounded-lg border border-dashed bg-gray-50 px-4 py-3 text-xs text-gray-600">
                    Tick the expense note(s) this payment settles — the amount adds up
                    from them.
                    {errors.amount && (
                      <div className="text-red-600 mt-1">{errors.amount}</div>
                    )}
                  </div>
                )}
            </fieldset>
          )}

          {/* Party mode with no party picked: there is no second leg yet, so
              there is nothing to type an amount against. Point at the two real
              ways forward instead of showing a box that cannot post. */}
          {!isEdit && !isLedgerMode && payType !== "expense" && !partyid && (
            <div className="rounded-lg border border-dashed bg-gray-50 px-4 py-3 text-xs text-gray-600">
              Pick the {payType === "receipt" ? "customer" : "vendor"} this money is
              from, or switch to{" "}
              <button
                type="button"
                className="underline font-medium text-blue-700"
                onClick={() => {
                  setAgainst("ledger");
                  setSettledInvoices([]);
                  setDirectDiscount("");
                  setDirectCommission("");
                }}
              >
                Ledger
              </button>{" "}
              to post it against Capital, a loan, rent, salary, interest — anything
              that isn't a party.
              {errors.counterledgerid && (
                <div className="text-red-600 mt-1">{errors.counterledgerid}</div>
              )}
            </div>
          )}

          {/* ── Section 3: Manual Amount ───────────────────────────────
              A payment always needs a second leg — a party, a ledger, or an
              expense note. The box only appears where typing the amount is
              genuinely the way in:
                • Ledger mode → here (with the concession rows when enabled).
                • A party with nothing open → here; it goes On Account.
                • Direct / On Account → its own box, inline in that panel.
                • Invoice-wise with the mode choice on screen, or an expense
                  note → the ticked rows ARE the amount, so no box.
                • No party picked at all → no box either. An amount typed there
                  had no second leg, so it saved without ever reaching the
                  ledger; a hint now points at the two real choices.
                • Editing → always, because the amount is a fact. */}
          {!isDirectSettle && (isEdit || isLedgerMode) && (
            <fieldset className="border rounded-xl p-4">
              <legend className="text-sm font-medium px-2">Amount</legend>

              {ledgerConcessionsAllowed ? (
                /* Settling a running ledger reads exactly like settling a bill:
                   knock ₹500 off what they carry, allow ₹20, ₹480 leaves the
                   drawer. Same three rows, same order, same wording as the
                   Direct / On Account panel. */
                <div className="space-y-3 text-sm">
                  {isFieldEnabled("amount") && (
                    <label className="flex items-start justify-between gap-4">
                      <span className="pt-1.5">
                        <span className="font-medium text-gray-700">Settle Amount (₹)</span>
                        <span className="block text-[11px] text-gray-500">
                          Knocked off this ledger's balance.
                        </span>
                      </span>
                      <input
                        type="number"
                        className={`w-40 shrink-0 border rounded px-2 py-1 text-right ${
                          errors.amount ? "border-red-400" : "border-gray-300"
                        }`}
                        value={manualAmount}
                        placeholder="0.00"
                        min={0}
                        step={0.01}
                        onChange={e => setManualAmount(e.target.value)}
                      />
                    </label>
                  )}

                  <label className="flex items-start justify-between gap-4">
                    <span className="pt-1.5">
                      <span className="font-medium text-gray-700">Discount (₹)</span>
                      <span className="block text-[11px] text-gray-500">
                        {payType === "receipt"
                          ? "Concession you allowed — comes off the cash received."
                          : "Concession they allowed — comes off the cash paid."}
                      </span>
                    </span>
                    <input
                      type="number"
                      className="w-40 shrink-0 border rounded px-2 py-1 border-gray-300 text-right"
                      value={directDiscount}
                      placeholder="0.00"
                      min={0}
                      step={0.01}
                      onChange={e => setDirectDiscount(e.target.value)}
                    />
                  </label>

                  <label className="flex items-start justify-between gap-4">
                    <span className="pt-1.5">
                      <span className="font-medium text-gray-700">Commission (₹)</span>
                      <span className="block text-[11px] text-gray-500">
                        Charged on top — adds to the cash, not to the balance.
                      </span>
                    </span>
                    <input
                      type="number"
                      className="w-40 shrink-0 border rounded px-2 py-1 border-gray-300 text-right"
                      value={directCommission}
                      placeholder="0.00"
                      min={0}
                      step={0.01}
                      onChange={e => setDirectCommission(e.target.value)}
                    />
                  </label>

                  {directBillValue > 0 && (totalDiscount > 0 || totalCommission > 0) && (
                    <div className="rounded-md bg-gray-50 border px-3 py-2 space-y-1">
                      <div className="flex justify-between text-gray-600">
                        <span>Balance Settled:</span>
                        <span>₹{fmt(directBillValue)}</span>
                      </div>
                      {totalDiscount > 0 && (
                        <div className="flex justify-between text-gray-500">
                          <span>Less Discount:</span>
                          <span>− ₹{fmt(totalDiscount)}</span>
                        </div>
                      )}
                      {totalCommission > 0 && (
                        <div className="flex justify-between text-gray-500">
                          <span>Add Commission:</span>
                          <span>+ ₹{fmt(totalCommission)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-semibold border-t pt-1">
                        <span>{payType === "receipt" ? "Cash Received:" : "Cash Paid:"}</span>
                        <span>₹{fmt(totalAmount)}</span>
                      </div>
                    </div>
                  )}

                  {errors.amount && (
                    <div className="text-red-600 text-xs">{errors.amount}</div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {isFieldEnabled("amount") && (<FormField
                    label="Amount (₹)"
                    name="amount"
                    type="number"
                    value={manualAmount}
                    onChange={e => setManualAmount(e.target.value)}
                    placeholder="0.00"
                    error={errors.amount}
                  />)}
                </div>
              )}
            </fieldset>
          )}

          {/* ── Section 4: Summary ───────────────────────────────────── */}
          {settlementMode !== "direct" && settledInvoices.length > 0 && (
            <div className="flex justify-end">
              <div className="bg-gray-50 border rounded-xl p-4 text-sm space-y-1 min-w-[260px]">
                <div className="flex justify-between text-gray-600">
                  <span>Invoices Selected:</span>
                  <span>{settledInvoices.length}</span>
                </div>
                {settledInvoices.map(s => (
                  <div key={s.invoiceid} className="flex justify-between text-gray-500 text-xs">
                    <span>{s.invoicemodel === "ExpenseNote" ? s.billnumber : `INV-${s.billnumber}`}</span>
                    <span>₹{fmt(s.settledamount)}</span>
                  </div>
                ))}
                {dcEnabled && (totalDiscount > 0 || totalCommission > 0) && (
                  <div className="border-t pt-2 mt-2 space-y-1">
                    <div className="flex justify-between text-gray-600">
                      <span>Bills Cleared:</span>
                      <span>₹{fmt(totalSettled)}</span>
                    </div>
                    {totalDiscount > 0 && (
                      <div className="flex justify-between text-gray-500">
                        <span>Less Discount:</span>
                        <span>− ₹{fmt(totalDiscount)}</span>
                      </div>
                    )}
                    {totalCommission > 0 && (
                      <div className="flex justify-between text-gray-500">
                        <span>Add Commission:</span>
                        <span>+ ₹{fmt(totalCommission)}</span>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex justify-between font-semibold text-base border-t pt-2 mt-2">
                  <span>{dcEnabled && (totalDiscount > 0 || totalCommission > 0) ? "Cash Received:" : "Total:"}</span>
                  <span>₹{fmt(totalAmount)}</span>
                </div>
                {errors.amount && (
                  <div className="text-red-600 text-xs">{errors.amount}</div>
                )}
              </div>
            </div>
          )}

          {/* ── Section 5: Journal Entry Preview (Tally-style) ──────── */}
          {totalAmount > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
              <div className="font-semibold mb-2">Journal Entry Preview</div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-blue-700 border-b border-blue-200">
                    <th className="pb-1">Ledger</th>
                    <th className="pb-1 text-right">Dr (₹)</th>
                    <th className="pb-1 text-right">Cr (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // The party leg is the FULL reduction in what they owe —
                    // never just the bills ticked. Cash of ₹250 lowers the party
                    // balance by ₹250 whether it lands on one bill, the opening
                    // balance, or sits on account. Using the ticked total here
                    // produced an unbalanced entry (Dr Cash 250 / Cr Party 100)
                    // the moment an amount carried an on-account remainder.
                    //
                    //   Dr Cash      amount
                    //   Dr Discount  discount            (concession we absorbed)
                    //     Cr Party     amount + discount − commission
                    //     Cr Commission            commission
                    const partyLeg = parseFloat(
                      (totalAmount + totalDiscount - totalCommission).toFixed(2)
                    );
                    if (payType === "receipt") {
                      return (
                        <>
                          <tr>
                            <td className="py-1">{selectedLedgerName}</td>
                            <td className="text-right">{fmt(totalAmount)}</td>
                            <td className="text-right">—</td>
                          </tr>
                          {dcEnabled && totalDiscount > 0 && (
                            <tr>
                              <td className="py-1">Discount Allowed</td>
                              <td className="text-right">{fmt(totalDiscount)}</td>
                              <td className="text-right">—</td>
                            </tr>
                          )}
                          <tr>
                            <td className="py-1">{counterLegName}</td>
                            <td className="text-right">—</td>
                            <td className="text-right">{fmt(partyLeg)}</td>
                          </tr>
                          {dcEnabled && totalCommission > 0 && (
                            <tr>
                              <td className="py-1">Commission Received</td>
                              <td className="text-right">—</td>
                              <td className="text-right">{fmt(totalCommission)}</td>
                            </tr>
                          )}
                        </>
                      );
                    }
                    return (
                      <>
                        <tr>
                          <td className="py-1">{counterLegName}</td>
                          <td className="text-right">{fmt(partyLeg)}</td>
                          <td className="text-right">—</td>
                        </tr>
                        {dcEnabled && totalCommission > 0 && (
                          <tr>
                            <td className="py-1">Commission</td>
                            <td className="text-right">{fmt(totalCommission)}</td>
                            <td className="text-right">—</td>
                          </tr>
                        )}
                        <tr>
                          <td className="py-1">{selectedLedgerName}</td>
                          <td className="text-right">—</td>
                          <td className="text-right">{fmt(totalAmount)}</td>
                        </tr>
                        {dcEnabled && totalDiscount > 0 && (
                          <tr>
                            <td className="py-1">Discount Received</td>
                            <td className="text-right">—</td>
                            <td className="text-right">{fmt(totalDiscount)}</td>
                          </tr>
                        )}
                      </>
                    );
                  })()}
                </tbody>
              </table>
              {settledInvoices.length > 0 && (
                <p className="text-xs text-blue-600 mt-2">
                  The settlement amount (₹{fmt(totalAmount)}) covers the full invoice total including
                  other charges (freight, transport, etc.). Those charges were already journalised
                  when the invoice was created — no separate entry needed here.
                </p>
              )}
            </div>
          )}

          {/* ── Actions ─────────────────────────────────────────────── */}
          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => navigate("/payments")}>
              Cancel
            </Button>
            <Button variant="outline" onClick={handleSubmit} disabled={saving}>
              {saving ? "Saving..." : isEdit ? "Update Payment" : "Save Payment"}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Confirm Auto Settlement ────────────────────────────────────────
          Nothing is written until this is approved. It exists so no one can
          ever say "I never picked these invoices — how did they get cleared?"
          "Change Manually" drops the same proposal into the invoice-wise
          table, pre-filled, for the user to adjust. */}
      {proposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="px-5 py-4 border-b">
              <h3 className="text-base font-semibold">Confirm Auto Settlement</h3>
              {/* Quote what actually LANDS on bills. The typed figure is not all
                  going onto bills once part of it clears an opening balance or
                  stays on account — saying "₹125 of bills … applied to 1 bill"
                  when only ₹100 reaches that bill reads as a mistake. */}
              <p className="text-xs text-gray-500 mt-1">
                ₹{fmt(proposal.allocated)} will be applied
                {proposal.openingsettled > 0 ? " to the opening balance first, then" : ""} to{" "}
                {proposal.lines.length} {proposal.lines.length === 1 ? "bill" : "bills"}, oldest first
                {proposal.unallocated > 0
                  ? `, and ₹${fmt(proposal.unallocated)} stays on account`
                  : ""}
                .
                {(totalDiscount > 0 || totalCommission > 0) && (
                  <>
                    {" "}
                    Cash {payType === "receipt" ? "received" : "paid"} ₹{fmt(totalAmount)} = ₹
                    {fmt(directBillValue)} settled
                    {totalDiscount > 0 ? ` − ₹${fmt(totalDiscount)} discount` : ""}
                    {totalCommission > 0 ? ` + ₹${fmt(totalCommission)} commission` : ""}.
                  </>
                )}
              </p>
            </div>

            <div className="overflow-auto px-5 py-3">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-50">
                  <tr className="text-left">
                    <th className="px-3 py-2">Invoice #</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2 text-right">Outstanding</th>
                    <th className="px-3 py-2 text-right">Settle Now</th>
                    {showConcessionSplit && totalDiscount > 0 && (
                      <th className="px-3 py-2 text-right">Discount</th>
                    )}
                    {showConcessionSplit && totalCommission > 0 && (
                      <th className="px-3 py-2 text-right">Commission</th>
                    )}
                    <th className="px-3 py-2">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {proposal.openingsettled > 0 && (
                    <tr className="border-t bg-slate-50">
                      <td className="px-3 py-2 font-medium">Opening Balance</td>
                      <td className="px-3 py-2 text-gray-500">brought forward</td>
                      <td className="px-3 py-2 text-right">₹{fmt(proposal.openingdue)}</td>
                      <td className="px-3 py-2 text-right font-medium">
                        ₹{fmt(proposal.openingsettled)}
                      </td>
                      {showConcessionSplit && totalDiscount > 0 && (
                        <td className="px-3 py-2 text-right text-gray-400">—</td>
                      )}
                      {showConcessionSplit && totalCommission > 0 && (
                        <td className="px-3 py-2 text-right text-gray-400">—</td>
                      )}
                      <td className="px-3 py-2">
                        {proposal.openingdue - proposal.openingsettled <= 0.01 ? (
                          <span className="text-green-700">Cleared</span>
                        ) : (
                          <span className="text-orange-600">
                            Partial — ₹{fmt(proposal.openingdue - proposal.openingsettled)} left
                          </span>
                        )}
                      </td>
                    </tr>
                  )}
                  {proposal.lines.map((l, li) => (
                    <tr key={l.invoiceid} className="border-t">
                      <td className="px-3 py-2 font-medium">INV-{l.billnumber}</td>
                      <td className="px-3 py-2 text-gray-500">{l.billdate}</td>
                      <td className="px-3 py-2 text-right">₹{fmt(l.outstanding)}</td>
                      <td className="px-3 py-2 text-right font-medium">₹{fmt(l.settledamount)}</td>
                      {showConcessionSplit && totalDiscount > 0 && (
                        <td className="px-3 py-2 text-right">₹{fmt(proposalDiscounts[li] || 0)}</td>
                      )}
                      {showConcessionSplit && totalCommission > 0 && (
                        <td className="px-3 py-2 text-right">₹{fmt(proposalCommissions[li] || 0)}</td>
                      )}
                      <td className="px-3 py-2">
                        {l.fullysettled ? (
                          <span className="text-green-700">Fully Paid</span>
                        ) : (
                          <span className="text-orange-600">
                            Partial — ₹{fmt(l.outstanding - l.settledamount)} left
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-semibold">
                    <td className="px-3 py-2" colSpan={2}>Total</td>
                    <td className="px-3 py-2 text-right">₹{fmt(proposal.totaloutstanding)}</td>
                    <td className="px-3 py-2 text-right">₹{fmt(proposal.allocated)}</td>
                    {showConcessionSplit && totalDiscount > 0 && (
                      <td className="px-3 py-2 text-right">₹{fmt(totalDiscount)}</td>
                    )}
                    {showConcessionSplit && totalCommission > 0 && (
                      <td className="px-3 py-2 text-right">₹{fmt(totalCommission)}</td>
                    )}
                    <td />
                  </tr>
                </tfoot>
              </table>

              {proposal.unallocated > 0 && (
                <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
                  <div className="flex justify-between font-medium text-amber-900">
                    <span>Unallocated (On Account)</span>
                    <span>₹{fmt(proposal.unallocated)}</span>
                  </div>
                  <p className="text-xs text-amber-800 mt-1">
                    More than this party owes
                    {proposal.openingsettled > 0
                      ? ` (₹${fmt(proposal.openingsettled)} opening + ₹${fmt(
                          proposal.allocated - proposal.openingsettled
                        )} bills = ₹${fmt(proposal.allocated)})`
                      : ""}
                    . The extra stays as an advance on their ledger and is applied
                    automatically to their next invoice.
                  </p>
                </div>
              )}

              {dcEnabled && (
                <p className="text-xs text-gray-500 mt-3">
                  {showConcessionSplit ? (
                    <>
                      The {totalDiscount > 0 ? "discount" : ""}
                      {totalDiscount > 0 && totalCommission > 0 ? " and " : ""}
                      {totalCommission > 0 ? "commission" : ""} is split across the bills
                      above in proportion to what each one clears
                      {proposal.openingsettled > 0 ? " (the opening balance gets none)" : ""}.
                      Use &ldquo;Change Manually&rdquo; to set it bill by bill instead.
                    </>
                  ) : (
                    <>
                      Auto settlement is not applying a discount or commission. Use
                      &ldquo;Change Manually&rdquo; if this party is getting a concession.
                    </>
                  )}
                </p>
              )}
            </div>

            <div className="px-5 py-4 border-t flex flex-wrap justify-end gap-2">
              {proposalIntent === "save" && (
                <Button
                  variant="outline"
                  onClick={() => {
                    // Carry the concession into the rows so switching views
                    // never silently drops it.
                    setSettledInvoices(linesFromProposal(proposal, showConcessionSplit));
                    setSettlementMode("invoice");
                    setDirectDiscount("");
                    setDirectCommission("");
                    setProposal(null);
                  }}
                >
                  Change Manually
                </Button>
              )}
              <Button variant="outline" onClick={() => setProposal(null)}>
                Cancel
              </Button>
              <Button
                variant="outline"
                disabled={saving}
                onClick={() =>
                  proposalIntent === "reallocate"
                    ? commitReallocate(proposal)
                    : persist(
                        linesFromProposal(proposal, showConcessionSplit),
                        totalAmount,
                        proposal.openingsettled
                      )
                }
              >
                {saving ? "Saving..." : "Confirm & Save"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </HomeLayout>
  );
};

export default AddEditPayment;
