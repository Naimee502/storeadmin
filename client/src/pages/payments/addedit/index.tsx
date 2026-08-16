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
  const { data: ledgerData } = useAccountLedgersQuery();
  const { data: accountsData } = useAccountsQuery();
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
  const [reference, setReference] = useState("");
  const [remarks, setRemarks] = useState("");
  const [manualAmount, setManualAmount] = useState<string>("");
  const [settledInvoices, setSettledInvoices] = useState<SettledInvoice[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // "invoice" → tick each bill (classic). "direct" → type one amount and let
  // FIFO spread it, Tally's On-Account/Agst-Ref flow in a single screen.
  const [settlementMode, setSettlementMode] = useState<"invoice" | "direct">("invoice");
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
  // Concessions (only when the feature flag is on).
  const totalDiscount = dcEnabled
    ? parseFloat(settledInvoices.reduce((s, i) => s + (i.discount || 0), 0).toFixed(2))
    : 0;
  const totalCommission = dcEnabled
    ? parseFloat(settledInvoices.reduce((s, i) => s + (i.commission || 0), 0).toFixed(2))
    : 0;

  // Cash actually moved = bills cleared, LESS discount (concession given), PLUS
  // commission (extra charged on top). This is the payment "amount". When no
  // invoices are linked, the manual amount is the cash.
  // How much cash this payment represents.
  //
  //  • New + Invoice-wise → the ticked rows ARE the amount (tick ₹100, receive ₹100).
  //  • Direct             → the typed amount drives everything.
  //  • Editing            → the amount is a FACT that already happened. Un-ticking a
  //                         bill re-allocates it; it does not mean the party handed
  //                         over less money. Deriving it from rows here rewrote a
  //                         ₹250 receipt as ₹100 the moment you opened it invoice-wise.
  const totalAmount =
    settlementMode === "direct" || isEdit
      ? parseFloat(manualAmount) || 0
      : settledInvoices.length > 0
      ? parseFloat((totalSettled - totalDiscount + totalCommission).toFixed(2))
      : parseFloat(manualAmount) || 0;

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
    // Discount (concession given) can't exceed the bill being cleared.
    if (dcEnabled) {
      const bad = settledInvoices.find(
        s => (s.discount || 0) > (s.settledamount || 0) + 0.001
      );
      if (bad) e.amount = `Discount can't exceed the settle amount for INV-${bad.billnumber}`;
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

  /** Turn a server FIFO proposal into rows this page can render/submit. */
  const linesFromProposal = (p: Proposal): SettledInvoice[] =>
    p.lines.map((l) => {
      const inv = outstandingInvoices.find((o: any) => o.id === l.invoiceid);
      return {
        invoiceid: l.invoiceid,
        invoicemodel: l.invoicemodel as SettledInvoice["invoicemodel"],
        settledamount: l.settledamount,
        discount: 0,
        commission: 0,
        billnumber: l.billnumber || inv?.billnumber || "",
        totalamount: inv?.totalamount ?? l.outstanding,
        othercharges: inv?.othercharges || [],
        subtotal: inv?.subtotal || 0,
        totalgst: inv?.totalgst || 0,
        allocatedmode: "auto_fifo",
      };
    });

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
      partyid: partyid || null,
      invoices: lines
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

    const isDirect =
      settlementMode === "direct" && payType !== "expense" && !!partyid;

    // Invoice-wise, or auto-settlement switched off → save exactly what the
    // user built. In "off" mode a direct amount simply stays On Account.
    if (!isDirect || autoSettlement === "off") {
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
          amount: totalAmount,
          excludePaymentId: id || undefined,
        },
      });
      p = res?.data?.previewAllocation || null;
    } catch (err: any) {
      dispatch(showMessage({ message: err?.message || "Could not work out the settlement", type: "error" }));
      return;
    }

    // Nothing open to settle → the whole amount is On Account. Saving it is
    // still correct: the party ledger is posted in full either way.
    // No open bills, but the opening balance may still soak up part of it.
    if (!p || (!p.lines.length && !p.openingsettled)) {
      return persist([], totalAmount, 0);
    }

    if (autoSettlement === "always") {
      return persist(linesFromProposal(p), totalAmount, p.openingsettled);
    }
    // "ask" → show it and let the user decide. Nothing is written yet.
    setProposalIntent("save");
    setProposal(p);
  };

  // ── Render ─────────────────────────────────────────────────────────────
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
                  editLoaded.current = false;
                }}
                options={[
                  { label: "Receipt  (Money In — from Customer)", value: "receipt" },
                  { label: "Payment  (Money Out — to Vendor)", value: "payment" },
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
                isFieldEnabled("party") && (<FormField
                  label={payType === "receipt" ? "Customer (Party)" : "Vendor (Party)"}
                  name="partyid"
                  type="select"
                  value={partyid}
                  onChange={e => {
                    setPartyid(e.target.value);
                    setSettledInvoices([]);
                  }}
                  options={partyOptions}
                  placeholder="Select party (optional)"
                  searchable
                />)
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
              {payType !== "expense" && partyid && outstandingInvoices.length > 0 && (
                <div className="flex flex-wrap items-center gap-4 text-sm border-b pb-3">
                  <span className="font-medium">Settlement Mode:</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      className="w-4 h-4"
                      checked={settlementMode === "invoice"}
                      onChange={() => setSettlementMode("invoice")}
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
                        if (!manualAmount && totalAmount > 0) {
                          setManualAmount(String(totalAmount));
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

              {settlementMode === "direct" && payType !== "expense" && partyid ? (
                <div className="rounded-lg bg-gray-50 border p-4 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Open bills</span>
                    <span className="font-medium">{outstandingInvoices.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Outstanding</span>
                    <span className="font-semibold text-orange-600">₹{fmt(totalOutstanding)}</span>
                  </div>
                  <p className="text-xs text-gray-500 pt-2">
                    Enter the amount below. Oldest bills are cleared first, and you
                    will see exactly which ones before it saves.
                  </p>
                </div>
              ) : outstandingInvoices.length === 0 ? (
                <p className="text-sm text-gray-500">
                  {payType === "expense"
                    ? "No outstanding credit expense notes to settle."
                    : partyBillCount > 0
                    ? `All ${partyBillCount} bill(s) for this party are already fully settled — by their own receipts, by earlier payments, or by returns. Anything entered below is recorded On Account.`
                    : "This party has no invoices yet. Anything entered below is recorded On Account."}
                </p>
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
            </fieldset>
          )}

          {/* ── Section 3: Manual Amount (when no invoices linked) ───── */}
          {(settlementMode === "direct" || isEdit || settledInvoices.length === 0) && (
            <fieldset className="border rounded-xl p-4">
              <legend className="text-sm font-medium px-2">Amount</legend>
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
                            <td className="py-1">Party Account (Debtor)</td>
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
                          <td className="py-1">Party Account (Creditor)</td>
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
              <p className="text-xs text-gray-500 mt-1">
                ₹{fmt(totalAmount)} will be applied
                {proposal.openingsettled > 0 ? " to the opening balance first, then" : ""} to{" "}
                {proposal.lines.length} {proposal.lines.length === 1 ? "bill" : "bills"}, oldest first.
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
                  {proposal.lines.map((l) => (
                    <tr key={l.invoiceid} className="border-t">
                      <td className="px-3 py-2 font-medium">INV-{l.billnumber}</td>
                      <td className="px-3 py-2 text-gray-500">{l.billdate}</td>
                      <td className="px-3 py-2 text-right">₹{fmt(l.outstanding)}</td>
                      <td className="px-3 py-2 text-right font-medium">₹{fmt(l.settledamount)}</td>
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
                  Auto settlement never applies a discount or commission. Use
                  &ldquo;Change Manually&rdquo; if this party is getting a concession.
                </p>
              )}
            </div>

            <div className="px-5 py-4 border-t flex flex-wrap justify-end gap-2">
              {proposalIntent === "save" && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSettledInvoices(linesFromProposal(proposal));
                    setSettlementMode("invoice");
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
                    : persist(linesFromProposal(proposal), totalAmount, proposal.openingsettled)
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
