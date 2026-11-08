import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router";
import HomeLayout from "../../../layouts/home";
import FormField from "../../../components/formfiled";
import Button from "../../../components/button";
import FormPage from "../../../components/formpage";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { selectIsModuleBusinessEnabled } from "../../../redux/slices/permissions";
import { showMessage } from "../../../redux/slices/message";
import {
  usePaymentMutations,
  usePaymentByIDQuery,
  usePreviewAllocationLazy,
} from "../../../graphql/hooks/payments";
import { useLedgerMovementsLazy } from "../../../graphql/hooks/transactions";
import { useOutstanding } from "../../../graphql/hooks/shared/useoutstanding";
import { useAccountLedgersQuery } from "../../../graphql/hooks/accountledgers";
import { useAccountsLiteQuery } from "../../../graphql/hooks/accounts";
import { useSalesInvoicesSettleQuery } from "../../../graphql/hooks/salesinvoice";
import { usePurchaseInvoicesSettleQuery } from "../../../graphql/hooks/purchaseinvoice";
import { useExpenseNotesQuery } from "../../../graphql/hooks/expensenote";
import { useAdminSettingsQuery } from "../../../graphql/hooks/adminsettings";
import { partyLabel } from "../../../utils/partylabel";
import { todayYMD, normalizeToYMD } from "../../../utils/helper";
import { isCustomerParty, isVendorParty } from "../../../utils/partytype";
import { BRANCH_REQUIRED } from "../../../utils/branch";
import { savedOffline as wasSavedOffline, useOfflineNumber, useOfflinePartyDelta } from "../../../offline/billing";
import { OFFLINE_SAVED_MESSAGE } from "../../../offline/billing";
import { isOfflineEnabled } from "../../../offline/settings";
import { isNoNetworkError } from "../../../offline/localprice";

type SettledInvoice = {
  invoiceid: string;
  invoicemodel: "SalesInvoice" | "PurchaseInvoice" | "ExpenseNote";
  settledamount: number;
  discount: number;
  commission: number;
  billnumber: string;
  /** Source Sales Order number, when this bill was raised from an order. */
  sourceref?: string | null;
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
  sourceref?: string | null;
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
const round2 = (n: number) => parseFloat((Number(n) || 0).toFixed(2));

/** A concession must reduce a debt: open bills or the opening balance, not On Account money. */
const noBillForConcession = (onaccount = 0) =>
  `${
    onaccount > 0
      ? `₹${fmt(onaccount)} stayed on account, so nothing`
      : "Nothing"
  } is being settled — a discount or commission has nowhere to sit. Clear the concession, or raise the amount so it reaches the opening balance or the bills.`;

const AddEditPayment = () => {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // Order-only businesses never see invoice numbers, so show the Sales Order number.
  const salesInvoiceEnabled = useAppSelector(state =>
    selectIsModuleBusinessEnabled(state, "salesinvoice"));
  const purchaseInvoiceEnabled = useAppSelector(state =>
    selectIsModuleBusinessEnabled(state, "purchaseinvoice"));

  /** Bill label: expense number, "SO-<order no>" for order-only sales, else "INV-<no>". */
  const billLabel = (b: { invoicemodel?: string; billnumber?: string; sourceref?: string | null; sourceorderno?: string | null }) => {
    if (b?.invoicemodel === "ExpenseNote") return b.billnumber || "";
    const orderNo = b?.sourceref || (b as any)?.sourceorderno;
    if (orderNo) {
      const isPurchase = b?.invoicemodel === "PurchaseInvoice";
      if (isPurchase && !purchaseInvoiceEnabled) return `PO-${orderNo}`;
      if (!isPurchase && !salesInvoiceEnabled) return `SO-${orderNo}`;
    }
    return `INV-${b?.billnumber || ""}`;
  };
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

  // ── Data fetching
  const paymentFormPermissions = useAppSelector(state => state.permissions.permissions?.formPermissions?.payments || {});
  const isFieldEnabled = (fieldId: string) => paymentFormPermissions[fieldId] !== false;

  const { data: existingData } = usePaymentByIDQuery(id || "");
  // Ledgers/parties are often created just before landing here, so revalidate.
  const { data: ledgerData, refetch: refetchLedgers } =
    useAccountLedgersQuery("cache-and-network");
  const { data: accountsData, refetch: refetchAccounts } =
    useAccountsLiteQuery(true, "cache-and-network");
  // Sources may be created just before this page, so revalidate (settlement-lite query).
  const { data: salesInvData, refetch: refetchSalesInv } = useSalesInvoicesSettleQuery("cache-and-network");
  const { data: purchaseInvData, refetch: refetchPurchaseInv } = usePurchaseInvoicesSettleQuery("cache-and-network");
  // Shared hook so this page and Transaction agree on what a party owes.
  const { outstandingOf } = useOutstanding({ excludePaymentId: id || undefined });
  const { data: expenseNotesData, refetch: refetchExpenseNotes } = useExpenseNotesQuery("cache-and-network");

  // Refetch settle-able sources on mount; they may have just been created.
  useEffect(() => {
    refetchSalesInv?.();
    refetchPurchaseInv?.();
    refetchExpenseNotes?.();
    // Refetch pickers too so a just-added ledger or party is selectable.
    refetchLedgers?.();
    refetchAccounts?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh pickers when the tab regains focus.
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
  // off | ask | always; "ask" is default so nothing is allocated unseen.
  const autoSettlement: "off" | "ask" | "always" =
    adminSettingsData?.getAdminSettings?.paymentAutoSettlement || "ask";
  const runPreview = usePreviewAllocationLazy();
  const runLedgerMovements = useLedgerMovementsLazy();

  // ── Form state
  const [paymentdate, setPaymentdate] = useState(todayYMD());
  const [payType, setPayType] = useState<"receipt" | "payment" | "expense">("receipt");
  const [mode, setMode] = useState("cash");
  const [ledgerid, setLedgerid] = useState("");
  const [partyid, setPartyid] = useState("");
  /** "party": party ledger, can settle bills. "ledger": any ledger, no bills or concessions. */
  const [against, setAgainst] = useState<"party" | "ledger">("party");
  const [counterledgerid, setCounterledgerid] = useState("");
  const [reference, setReference] = useState("");
  const [remarks, setRemarks] = useState("");
  const [manualAmount, setManualAmount] = useState<string>("");
  const [settledInvoices, setSettledInvoices] = useState<SettledInvoice[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // "invoice": tick each bill. "direct": one amount spread FIFO (On Account / Agst Ref).
  const [settlementMode, setSettlementMode] = useState<"invoice" | "direct">("invoice");
  // Direct mode: one discount/commission for the receipt, spread over the bills FIFO clears.
  const [directDiscount, setDirectDiscount] = useState<string>("");
  const [directCommission, setDirectCommission] = useState<string>("");
  // Party opening balance as last reported by the server; null until a preview runs.
  const [openingDue, setOpeningDue] = useState<number | null>(null);
  /** True while the opening-balance preview is loading, so the panel can show it is waiting. */
  const [openingLoading, setOpeningLoading] = useState(false);
  /** Party's current balance from the server; the master opening never changes after vouchers. */
  const [partyBalanceLive, setPartyBalanceLive] = useState<number | null>(null);
  /** Ledger mode: the selected ledger's current balance from the server. */
  const [ledgerDue, setLedgerDue] = useState<{
    openingbalance: number;
    movement: number;
    balance: number;
    outstanding: number;
  } | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  // Confirm action: save the payment, or only re-spread an existing one (no journal change).
  const [proposalIntent, setProposalIntent] = useState<"save" | "reallocate">("save");
  // Last "Allocate now" result, shown inline; nothing to apply to is normal, not an error.
  const [allocateNote, setAllocateNote] = useState("");
  const [saving, setSaving] = useState(false);
  // Offline mode without network: this device's receipt/payment number (null otherwise).
  const { number: offlineNo, noDevice } = useOfflineNumber("payment", !isEdit);

  // Bill clears = sum of settledamount (reduces outstanding).
  const totalSettled = parseFloat(
    settledInvoices.reduce((s, i) => s + (i.settledamount || 0), 0).toFixed(2)
  );
  // All the party's invoices with an outstanding balance, any payment type.
  const outstandingInvoices = useMemo(() => {
    // Expense mode needs no party; it comes from the note's ledger.
    if (!partyid && payType !== "expense") return [];

    let source: any[];
    if (payType === "expense") {
      // All outstanding credit expense notes; picking one sets the payable party.
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

  /** Ledger mode: no party, no bills, no concession; just Dr/Cr against cash. */
  const isLedgerMode = against === "ledger" && payType !== "expense";

  const isDirectSettle =
    !isLedgerMode && settlementMode === "direct" && payType !== "expense" && !!partyid;
  /** Open bills on screen — the rows of the Invoice-wise table. */
  const hasOpenBills = outstandingInvoices.length > 0;
  /** Opening balance still owed; settled before bills and can carry a concession. */
  const openingDueValue = Math.max(0, openingDue || 0);
  /** Is there actually a debt for the money — and a concession — to reduce? */
  const hasSomethingToSettle = hasOpenBills || openingDueValue > 0;
  /** Ledger balance this voucher can settle: debit for a receipt, credit for a payment. */
  const ledgerDueValue = Math.max(0, ledgerDue?.outstanding || 0);

  // Direct-mode concessions need an allocation; On Account money has nothing to reduce.
  /** Whether the party carries an opening on either side (ledger first, then account). */
  const partyOpening = useMemo(() => {
    // Prefer the live server balance; the master opening does not move with vouchers.
    if (partyBalanceLive !== null) return partyBalanceLive;
    const acc = (accountsData?.getAccounts || []).find((a: any) => a.id === partyid);
    if (!acc) return 0;
    const led = (ledgerData?.getAccountLedgers || []).find(
      (l: any) => l.id === acc.ledgerid?.id
    );
    const src = led || acc;
    const amt = Number(src.openingbalance) || 0;
    if (!amt) return 0;
    return String(src.openingbalancetype).toLowerCase() === "debit" ? amt : -amt;
  }, [accountsData, ledgerData, partyid, partyBalanceLive]);
  const partyHasOpening = partyOpening !== 0;
  // Shown balance includes unsynced bills and receipts of this device (0 when offline mode is off).
  const partyOpeningShown = partyOpening + useOfflinePartyDelta(isLedgerMode ? null : partyid);
  /** Party carries an opening, but this voucher moves it instead of clearing it. */
  const openingMovesNotClears = partyHasOpening && !hasSomethingToSettle;
  /** Label as carried-forward only when bills sit beside it; otherwise it is the current balance. */
  const openingIsWholeBalance = openingDueValue > 0 && !hasOpenBills;

  const directConcessionsAllowed =
    dcEnabled &&
    isDirectSettle &&
    autoSettlement !== "off" &&
    (hasSomethingToSettle || partyHasOpening);
  /** Ledger mode takes the same discount/commission pair, applied to the payment itself. */
  const ledgerConcessionsAllowed = dcEnabled && isLedgerMode;
  /** Either flavour of "one concession figure for the whole voucher". */
  const singleConcession = isDirectSettle || isLedgerMode;
  const concessionsAllowed = directConcessionsAllowed || ledgerConcessionsAllowed;

  // Concessions: from ticked rows invoice-wise, one figure in Direct and Ledger mode.
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

  // The box holds the value settled; Direct spreads it FIFO, Ledger applies it to the ledger.
  const directBillValue = singleConcession ? parseFloat(manualAmount) || 0 : 0;

  // Cash = bills cleared - discount + commission.
  /** Invoice-wise: the ticked bills are the amount, both when adding and editing. */
  const rowsDriveAmount =
    !isLedgerMode && payType !== "expense" && !!partyid && settlementMode === "invoice";

  const totalAmount = singleConcession
    ? parseFloat((directBillValue - totalDiscount + totalCommission).toFixed(2))
    : rowsDriveAmount
    ? parseFloat((totalSettled - totalDiscount + totalCommission).toFixed(2))
    : isEdit
    ? parseFloat(manualAmount) || 0
    : settledInvoices.length > 0
    ? parseFloat((totalSettled - totalDiscount + totalCommission).toFixed(2))
    : parseFloat(manualAmount) || 0;

  /** Invoice-wise/Direct choice is shown (same condition as the radios). */
  const settlementModeAvailable =
    !isLedgerMode && payType !== "expense" && !!partyid;

  // No open bills to tick, so default to Direct / On Account.
  useEffect(() => {
    if (isEdit || isLedgerMode || payType === "expense") return;
    if (partyid && !hasOpenBills) setSettlementMode("direct");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyid, hasOpenBills, isLedgerMode, payType]);

  // Fetch the opening balance as soon as a party is picked; it is cleared before bills.
  useEffect(() => {
    if (!partyid || isLedgerMode || payType === "expense") {
      setOpeningDue(null);
      setPartyBalanceLive(null);
      setOpeningLoading(false);
      return;
    }
    let cancelled = false;
    setOpeningLoading(true);
    (async () => {
      try {
        const res = await runPreview({
          variables: {
            partyid,
            invoicemodel: payType === "receipt" ? "SalesInvoice" : "PurchaseInvoice",
            adminid: adminId,
            branchid: branchId,
            // Nothing is being allocated — we only want what is carried forward.
            amount: 0,
            // Editing: exclude this payment's own settlement so its opening leg stays visible.
            excludePaymentId: id || undefined,
          },
        });
        if (!cancelled) {
          setOpeningDue(Number(res?.data?.previewAllocation?.openingdue) || 0);
          const bal = res?.data?.previewAllocation?.partybalance;
          setPartyBalanceLive(bal === null || bal === undefined ? null : Number(bal) || 0);
        }
      } catch {
        if (!cancelled) {
          setOpeningDue(null);
          setPartyBalanceLive(null);
        }
      } finally {
        if (!cancelled) setOpeningLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyid, payType, isLedgerMode, adminId, branchId, id]);

  // Ledger balance = opening + journals posted to it since (fetched filtered server-side).
  useEffect(() => {
    const led = ledgerData?.getAccountLedgers?.find((l: any) => l.id === counterledgerid);
    if (!isLedgerMode || !counterledgerid || !adminId || !led) {
      setLedgerDue(null);
      return;
    }
    let cancelled = false;
    (async () => {
      // Debit balance: they owe us; credit: we owe them.
      const openingbalance = round2(
        String(led.openingbalancetype).toLowerCase() === "credit"
          ? -(Number(led.openingbalance) || 0)
          : Number(led.openingbalance) || 0
      );
      let movement = 0;
      try {
        const res = await runLedgerMovements({
          variables: { filter: { adminid: adminId, ledgerid: counterledgerid } },
        });
        const txs = res?.data?.getTransactions || [];
        movement = round2(
          txs.reduce((sum: number, t: any) => {
            // Editing: skip this payment's own journal, it is about to be rewritten.
            if (id && String(t?.source?.docid || "") === String(id)) return sum;
            // Only this ledger's own entries move its balance.
            return (
              sum +
              (t.entries || []).reduce(
                (legs: number, e: any) =>
                  e?.ledgerid?.id === counterledgerid
                    ? legs + (Number(e.debit) || 0) - (Number(e.credit) || 0)
                    : legs,
                0
              )
            );
          }, 0)
        );
      } catch {
        // Show the opening balance even with no journals.
        movement = 0;
      }
      if (cancelled) return;
      const balance = round2(openingbalance + movement);
      // Receipts collect a debit balance; payments clear a credit one.
      const outstanding =
        payType === "payment" ? Math.max(0, round2(-balance)) : Math.max(0, balance);
      setLedgerDue({ openingbalance, movement, balance, outstanding });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counterledgerid, isLedgerMode, payType, adminId, id, ledgerData]);

  // ── Load existing payment for edit
  useEffect(() => {
    if (!isEdit || !existingData?.getPaymentById) return;
    const p = existingData.getPaymentById;
    setPaymentdate(formatDate(p.paymentdate));
    // "expense" is stored as type "payment"; detect it by an ExpenseNote line.
    const isExpense = (p.invoices || []).some((ei: any) => ei.invoicemodel === "ExpenseNote");
    setPayType(isExpense ? "expense" : p.type === "payment" ? "payment" : "receipt");
    setMode(p.mode || "cash");
    setLedgerid(typeof p.ledgerid === "string" ? p.ledgerid : p.ledgerid?.id || "");
    setPartyid(typeof p.partyid === "string" ? p.partyid : p.partyid?.id || "");
    // Saved against a plain ledger: reopen in ledger mode.
    const savedCounter =
      typeof p.counterledgerid === "string" ? p.counterledgerid : p.counterledgerid?.id || "";
    setCounterledgerid(savedCounter);
    setAgainst(savedCounter && !isExpense ? "ledger" : "party");
    setReference(p.reference || "");
    setRemarks(p.remarks || "");

    // Reopen in the settlement mode the payment was created in.
    const savedDirect =
      p.allocationmode === "auto_fifo" || p.allocationmode === "on_account";
    setSettlementMode(savedDirect && !isExpense ? "direct" : "invoice");

    // Direct mode is driven by the amount box, so seed it either way.
    if (savedDirect || !(p.invoices?.length)) {
      setManualAmount(String(p.amount || ""));
    }

    // Concessions live on bill lines (party) or the payment (ledger); edited as one figure.
    if ((savedDirect || savedCounter) && !isExpense) {
      const lineD = (p.invoices || []).reduce((t: number, i: any) => t + (Number(i.discount) || 0), 0);
      const lineC = (p.invoices || []).reduce((t: number, i: any) => t + (Number(i.commission) || 0), 0);
      const d = lineD || Number(p.discount) || 0;
      const c = lineC || Number(p.commission) || 0;
      setDirectDiscount(d ? String(parseFloat(d.toFixed(2))) : "");
      setDirectCommission(c ? String(parseFloat(c.toFixed(2))) : "");
      // The box holds the settle value, not the cash, so reverse the formula.
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

    // Look up all invoices so settled ones still have billnumber and othercharges.
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
        sourceref: match?.sourceref || match?.sourceorderno || null,
        totalamount: match?.totalamount || 0,
        othercharges: match?.othercharges || [],
        subtotal: match?.subtotal || 0,
        totalgst: match?.totalgst || 0,
      };
    });

    setSettledInvoices(settled);
    editLoaded.current = true;
  }, [isEdit, existingData, outstandingInvoices, salesInvData, purchaseInvData, expenseNotesData]);

  // normalizeToYMD handles Date, ISO and epoch-ms strings using the local day.
  const formatDate = (date: any) => normalizeToYMD(date) || todayYMD();

  // ── Dropdown options
  const partyOptions = useMemo(() => {
    const accounts = accountsData?.getAccounts || [];

    if (payType === "expense") {
      // Only parties whose ledger has an outstanding credit expense note.
      const expenseLedgerIds = new Set(
        (expenseNotesData?.getExpenseNotes || [])
          .filter((e: any) => e.status && e.paymenttype === "credit" && e.ledgerid?.id)
          .map((e: any) => e.ledgerid.id)
      );
      return accounts
        .filter((a: any) => a.ledgerid?.id && expenseLedgerIds.has(a.ledgerid.id))
        .map((a: any) => ({
          value: a.id,
          label: partyLabel(a),
        }));
    }

    return accounts
      // A party we both sell to and buy from appears on both lists.
      .filter((a: any) =>
        payType === "receipt"
          ? isCustomerParty(a.type)
          : isVendorParty(a.type) || a.type === "other"
      )
      .map((a: any) => ({
        value: a.id,
        label: partyLabel(a),
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

  // Auto-pick the Cash/Bank ledger once a party is chosen, like the Transaction page.
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

  // ── Invoice settlement helpers
  const isSelected = (invId: string) => settledInvoices.some(s => s.invoiceid === invId);

  const toggleInvoice = (inv: any) => {
    if (isSelected(inv.id)) {
      setSettledInvoices(prev => prev.filter(s => s.invoiceid !== inv.id));
    } else {
      // Payable party comes from the expense note's ledger (Dr party / Cr Cash).
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
          sourceref: inv.sourceref || inv.sourceorderno || null,
          totalamount: inv.totalamount,
          othercharges: inv.othercharges || [],
          subtotal: inv.subtotal || 0,
          totalgst: inv.totalgst || 0,
        },
      ]);
    }
  };

  // ?expensenote=<id> from an approved claim: preselect it once, new payments only.
  const location = useLocation();
  const prefillNoteId = !isEdit ? new URLSearchParams(location.search).get("expensenote") : null;
  const prefillDone = useRef(false);
  useEffect(() => {
    if (prefillNoteId && payType !== "expense" && !prefillDone.current) setPayType("expense");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillNoteId]);
  useEffect(() => {
    if (!prefillNoteId || prefillDone.current || payType !== "expense") return;
    const note = outstandingInvoices.find((inv: any) => inv.id === prefillNoteId);
    if (!note) return;
    prefillDone.current = true;
    if (!isSelected(note.id)) toggleInvoice(note);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillNoteId, payType, outstandingInvoices]);

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

  // ── Validation & Submit
  const validate = () => {
    const e: Record<string, string> = {};
    if (!ledgerid) e.ledgerid = "Select a cash / bank ledger";
    if (totalAmount <= 0) e.amount = "Amount must be greater than zero";
    // Every payment needs a second leg or no journal is posted.
    if (!isLedgerMode && payType !== "expense" && !partyid) {
      e.counterledgerid =
        "Pick a party, or switch to Ledger — a payment needs the other side to post.";
      return e;
    }
    // Ledger mode needs the counter ledger; there is no party fallback.
    if (isLedgerMode) {
      if (!counterledgerid) e.counterledgerid = "Select the ledger this is against";
      if (counterledgerid && counterledgerid === ledgerid) {
        e.counterledgerid = "This is the same as the Cash / Bank ledger — pick the other side.";
      }
      // No bill here, so concession cannot exceed the settle amount.
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
    // Direct mode: bills are known only after the FIFO preview; catch obvious errors here.
    if (directConcessionsAllowed && (totalDiscount > 0 || totalCommission > 0)) {
      if (totalDiscount < 0 || totalCommission < 0) {
        e.amount = "Discount and commission can't be negative";
      } else if (totalDiscount > directBillValue + 0.01) {
        e.amount = `Discount ₹${fmt(totalDiscount)} can't exceed the ₹${fmt(directBillValue)} being settled.`;
      } else if (totalDiscount > totalOutstanding + 0.01) {
        e.amount = `Discount ₹${fmt(totalDiscount)} is more than the ₹${fmt(totalOutstanding)} this party owes.`;
      }
    }
    // When editing, rows must fit inside the amount, including any opening-balance share.
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

  /** Bills before subtraction, so the empty state can say "everything is settled". */
  const partyBillCount = useMemo(() => {
    if (!partyid || payType === "expense") return 0;
    const src =
      payType === "receipt"
        ? (salesInvData?.getSalesInvoices || [])
        : (purchaseInvData?.getPurchaseInvoices || []);
    return src.filter((inv: any) => inv.partyacc?.id === partyid && inv.status).length;
  }, [partyid, payType, salesInvData, purchaseInvData]);

  /** Still owed on the BILLS shown. */
  const billsOutstanding = parseFloat(
    outstandingInvoices.reduce((t: number, i: any) => t + (i.outstanding || 0), 0).toFixed(2)
  );
  /** Total owed: opening balance first, then bills. Concessions are checked against this. */
  const totalOutstanding = parseFloat((billsOutstanding + openingDueValue).toFixed(2));

  /** Selected ledger's balance, laid out like the party panel; null when nothing is carried. */
  const ledgerBalanceRows =
    ledgerDue && (ledgerDue.openingbalance !== 0 || ledgerDue.movement !== 0) ? (
      <div className="space-y-1">
        <div className="flex justify-between">
          <span>
            Current Balance
            <span className="block text-[11px] text-gray-500">
              {ledgerDueValue > 0
                ? `Balance as it stands now — this ${
                    payType === "payment" ? "payment" : "receipt"
                  } clears it.`
                : "Balance as it stands now — opening plus everything posted since."}
            </span>
          </span>
          <span className="font-medium whitespace-nowrap">
            ₹{fmt(Math.abs(ledgerDue.balance))}
            {ledgerDue.balance !== 0 ? ` (${ledgerDue.balance > 0 ? "Dr" : "Cr"})` : ""}
          </span>
        </div>
        {/* A reverse-direction balance can't be settled by this voucher; it stays on account. */}
        {ledgerDueValue === 0 && ledgerDue.balance !== 0 && (
          <p className="text-[11px] text-gray-500">
            This ledger carries ₹{fmt(Math.abs(ledgerDue.balance))}{" "}
            {ledgerDue.balance > 0 ? "Dr" : "Cr"} — nothing for a{" "}
            {payType === "payment" ? "payment" : "receipt"} to settle, so this amount
            goes on account.
          </p>
        )}
      </div>
    ) : null;

  /** Split a figure across lines pro rata; the last line absorbs rounding. */
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

  /** Convert a server FIFO proposal to rows; Direct concessions are spread per line. */
  const linesFromProposal = (p: Proposal, withConcessions = false): SettledInvoice[] => {
    const split = withConcessions ? concessionSplit(p) : null;
    const discounts = split ? split.discounts : [];
    const commissions = split ? split.commissions : [];
    return p.lines.map((l, i) => {
      const inv = outstandingInvoices.find((o: any) => o.id === l.invoiceid);
      return {
        invoiceid: l.invoiceid,
        invoicemodel: l.invoicemodel as SettledInvoice["invoicemodel"],
        settledamount: l.settledamount,
        discount: discounts[i] || 0,
        commission: commissions[i] || 0,
        billnumber: l.billnumber || inv?.billnumber || "",
        sourceref: l.sourceref || inv?.sourceref || inv?.sourceorderno || null,
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

  /** Split the concession pro rata between bills and opening; opening share stays on the payment. */
  const concessionSplit = (p: Proposal) => {
    const onBills = billsAllocated(p);
    const cleared = parseFloat((onBills + (p.openingsettled || 0)).toFixed(2));
    const billShare = (total: number) =>
      cleared > 0 ? parseFloat(((total * onBills) / cleared).toFixed(2)) : 0;
    const billDiscount = billShare(totalDiscount);
    const billCommission = billShare(totalCommission);
    return {
      discounts: spread(billDiscount, p.lines),
      commissions: spread(billCommission, p.lines),
      openingDiscount: parseFloat((totalDiscount - billDiscount).toFixed(2)),
      openingCommission: parseFloat((totalCommission - billCommission).toFixed(2)),
    };
  };

  /** Return an error when the concession has no debt to reduce, else "". */
  const checkConcessionFits = (p: Proposal): string => {
    if (totalDiscount <= 0 && totalCommission <= 0) return "";
    const cleared = parseFloat((billsAllocated(p) + (p.openingsettled || 0)).toFixed(2));
    if (cleared <= 0) {
      if (partyHasOpening) return "";
      return noBillForConcession(p.unallocated || 0);
    }
    if (totalDiscount > cleared + 0.01) {
      return `Discount ₹${fmt(totalDiscount)} is more than the ₹${fmt(
        cleared
      )} this payment clears. Lower the discount or raise the amount.`;
    }
    return "";
  };

  const persist = async (lines: SettledInvoice[], amount: number, openingsettled = 0) => {
    // Every save path goes through here.
    if (!branchId) {
      dispatch(showMessage({ message: BRANCH_REQUIRED, type: "error" }));
      return;
    }
    const input: any = {
      adminid: adminId,
      branchid: branchId,
      paymentdate,
      // "expense" is saved as a money-out payment (Dr party-payable / Cr cash).
      type: payType === "expense" ? "payment" : payType,
      mode,
      ledgerid,
      // Exactly one of these is the non-cash leg.
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
      // Payment-level concession totals (denormalised sum of lines; only source in Ledger mode).
      discount: dcEnabled ? totalDiscount : 0,
      commission: dcEnabled ? totalCommission : 0,
      // Part of this receipt that cleared the opening balance; not a bill line.
      openingsettled,
      reference: reference || undefined,
      remarks: remarks || undefined,
      status: true,
      createdby_id: creator.id,
      createdby_name: creator.name,
      createdby_type: creator.type,
    };
    // Offline mode without network only: the device number shown on the form.
    if (!isEdit && offlineNo) input.paymentcode = offlineNo;

    setSaving(true);
    try {
      if (isEdit) {
        const r = await editPaymentMutation({ variables: { id, input } });
        dispatch(showMessage({ message: wasSavedOffline(r?.data?.editPayment) ? OFFLINE_SAVED_MESSAGE : "Payment updated", type: "success" }));
      } else {
        const r = await addPaymentMutation({ variables: { input } });
        dispatch(showMessage({ message: wasSavedOffline(r?.data?.addPayment) ? OFFLINE_SAVED_MESSAGE : "Payment saved", type: "success" }));
        // New entries land on page 1, so reset the remembered list page.
        try {
          sessionStorage.removeItem("datatable:/payments:Manage Payments:currentPage");
        } catch {
          /* storage unavailable — the list just keeps its old page */
        }
      }
      navigate("/payments");
    } catch (err: any) {
      // Show the server's over-settlement message.
      dispatch(showMessage({ message: err?.message || "Error saving payment", type: "error" }));
    } finally {
      setSaving(false);
      setProposal(null);
    }
  };

  /** Amount on THIS payment that is still unallocated (edit mode only). */
  const savedUnallocated = Number(existingData?.getPaymentById?.unallocatedamount) || 0;
  /** Keep the opening balance already cleared so an edit doesn't drop it. */
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
          // Not excluded: we want what is still open given this payment's allocations.
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

    // Invoice-wise or auto-settle off: save as built; a direct amount stays On Account.
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
          // Bill value, not cash; see directBillValue.
          amount: directBillValue,
          excludePaymentId: id || undefined,
        },
      });
      p = res?.data?.previewAllocation || null;
      // Keep the carried-forward opening balance; it is cleared before bills.
      setOpeningDue(p ? Number(p.openingdue) || 0 : 0);
    } catch (err: any) {
      // Offline mode without network: no FIFO preview, so it is saved On Account.
      if (isOfflineEnabled() && isNoNetworkError(err)) {
        p = null;
      } else {
        dispatch(showMessage({ message: err?.message || "Could not work out the settlement", type: "error" }));
        return;
      }
    }

    // No open bills: the amount goes to the opening balance, then On Account.
    if (!p || (!p.lines.length && !p.openingsettled)) {
      if (!partyHasOpening && (totalDiscount > 0 || totalCommission > 0)) {
        setErrors({ amount: noBillForConcession(totalAmount) });
        return;
      }
      return persist([], totalAmount, 0);
    }

    // A concession needs a bill line; opening balance and On Account don't count.
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

  // Direct-mode concession split shown in the confirm dialog.
  const showConcessionSplit =
    !!proposal &&
    proposalIntent === "save" &&
    directConcessionsAllowed &&
    (totalDiscount > 0 || totalCommission > 0);
  const proposalSplit = showConcessionSplit ? concessionSplit(proposal!) : null;
  const proposalDiscounts = proposalSplit ? proposalSplit.discounts : [];
  const proposalCommissions = proposalSplit ? proposalSplit.commissions : [];

  return (
    <HomeLayout>
      <FormPage
        breadcrumb="Payments"
        title={isEdit ? "Edit Payment" : "Add Payment"}
        saveLabel={isEdit ? "Update Payment" : "Save Payment"}
        saveDisabled={saving}
        onSave={handleSubmit}
        onCancel={() => navigate("/payments")}
      >

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
                // Direction only; the next field picks the account.
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
              {(offlineNo || noDevice) && (
                <div className="flex flex-col justify-end text-[13px]">
                  <span className="text-slate-500">Voucher No.</span>
                  <span className="h-8 leading-8 font-mono font-semibold text-slate-800">{offlineNo || "—"}</span>
                  {noDevice && <span className="text-[12px] text-amber-700">Offline: the number will be given when this syncs.</span>}
                </div>
              )}
              {payType !== "expense" ? (
                // The other side of the voucher is a ledger, which may or may not be a party's.
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
                              // No party means no bills or concession; clear them.
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
                          // Clear concessions when the party changes.
                          setDirectDiscount("");
                          setDirectCommission("");
                          if (!isEdit) setManualAmount("");
                        }}
                        options={partyOptions}
                        // Required in Party mode: this is the other leg.
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

              {/* Re-allocating moves attribution only; no journal entry is created. */}
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

              {/* Invoice-wise vs Direct (one amount spread oldest-first, confirmed before saving). */}
              {settlementModeAvailable && (
                <div className="flex flex-wrap items-center gap-4 text-sm border-b pb-3">
                  <span className="font-medium">Settlement Mode:</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      className="w-4 h-4"
                      checked={settlementMode === "invoice"}
                      onChange={() => {
                        // Invoice-wise hides the amount box, so clear it.
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
                        // Seed Direct with the bills cleared (bill figure, not cash).
                        const seed =
                          settledInvoices.length > 0 ? totalSettled : totalAmount;
                        if (!manualAmount && seed > 0) {
                          setManualAmount(String(seed));
                        }
                        // Carry row concessions across as the receipt-level figure.
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
                // Ordered as the entry is made: owed, amount, concession, total.
                <div className="rounded-lg bg-gray-50 border p-4 space-y-4 text-sm">
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Open bills</span>
                      <span className="font-medium">{outstandingInvoices.length}</span>
                    </div>
                    {hasOpenBills && (
                      <div className="flex justify-between">
                        <span>Bills Outstanding</span>
                        <span className="font-medium">₹{fmt(billsOutstanding)}</span>
                      </div>
                    )}
                    {/* Opening balance is cleared before bills and can take a concession. */}
                    {(openingDueValue > 0 || openingMovesNotClears) && (
                      <div className="flex justify-between">
                        <span>
                          {openingMovesNotClears || openingIsWholeBalance
                            ? "Current Balance"
                            : "Opening Balance"}
                          <span className="block text-[11px] text-gray-500">
                            {openingMovesNotClears
                              ? payType === "receipt"
                                ? "Balance as it stands now — this receipt reduces it."
                                : "Balance as it stands now — this payment adds to it."
                              : openingIsWholeBalance
                              ? payType === "receipt"
                                ? "Balance as it stands now — this receipt comes off it."
                                : "Balance as it stands now — this payment comes off it."
                              : "Carried forward — what is left of it clears before any bill."}
                          </span>
                        </span>
                        <span className="font-medium whitespace-nowrap">
                          {/* Show the full balance (matches the party statement), not just the settleable part. */}
                          {openingMovesNotClears || openingIsWholeBalance
                            ? `₹${fmt(Math.abs(partyOpeningShown))} (${partyOpeningShown > 0 ? "Dr" : "Cr"})`
                            : `₹${fmt(openingDueValue)}`}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Inputs in entry order: amount, discount, commission. */}
                  <div className="pt-3 border-t space-y-3">
                    {isFieldEnabled("amount") && (
                      <label className="flex items-start justify-between gap-4">
                        <span className="pt-1.5">
                          <span className="font-medium text-gray-700">
                            {hasSomethingToSettle ? "Settle Amount (₹)" : "Amount (₹)"}
                          </span>
                          <span className="block text-[11px] text-gray-500">
                            {openingLoading
                              ? "Checking what is still open…"
                              : openingMovesNotClears
                              ? payType === "receipt"
                                ? "Recorded On Account — it comes off the current balance above."
                                : "Recorded On Account — it adds to the current balance above."
                              : !hasSomethingToSettle
                              ? "Nothing open — this is recorded On Account and goes onto their next invoice."
                              : directConcessionsAllowed
                              ? hasOpenBills
                                ? "Balance to clear — carried-forward balance first, then the oldest bills."
                                : "Current balance to clear — same as Settle Now on a bill row."
                              : hasOpenBills
                              ? "Cleared against the carried-forward balance first, then the oldest bills."
                              : "Cleared against the balance they carry."}
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

                    {/* Entered once in Direct mode and spread across the chosen bills on save. */}
                    {directConcessionsAllowed && (
                      <>
                        <label className="flex items-start justify-between gap-4">
                          <span className="pt-1.5">
                            <span className="font-medium text-gray-700">Discount (₹)</span>
                            <span className="block text-[11px] text-gray-500">
                              {payType === "receipt"
                                ? "Concession you allowed — comes off the cash and the balance."
                                : "Discount the vendor allowed — comes off the cash and the balance."}
                              {!hasOpenBills && openingDueValue > 0
                                ? " Given on the current balance."
                                : ""}
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

                  {/* Result: bills cleared - discount + commission = cash. */}
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
                      <div className="text-[11px] text-gray-500 pt-0.5">
                        This is also what comes off the balance — the discount and
                        commission move it, not just the cash.
                      </div>
                    </div>
                  )}

                  {errors.amount && (
                    <div className="text-red-600 text-xs">{errors.amount}</div>
                  )}

                  {hasSomethingToSettle ? (
                    <p className="text-xs text-gray-500">
                      {openingDueValue > 0
                        ? hasOpenBills
                          ? "The carried-forward balance is cleared first, then the oldest bills"
                          : "This clears the balance they carry"
                        : "Oldest bills are cleared first"}
                      , and you will see exactly what it clears
                      {directConcessionsAllowed
                        ? " — and how the discount / commission is split —"
                        : ""}{" "}
                      before it saves.
                    </p>
                  ) : openingLoading ? (
                    <p className="text-xs text-gray-500">
                      Working out what this party still owes…
                    </p>
                  ) : openingMovesNotClears ? null : (
                    dcEnabled && (
                      <p className="text-xs text-gray-500">
                        No discount or commission — this party has nothing outstanding, so the
                        money is an advance and there is no balance to reduce. Give the
                        concession once there is an opening balance or a bill to put it on.
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
                              {billLabel(inv)}
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

              {/* Invoice-wise with nothing ticked: point to Direct for a typed amount. */}
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

              {/* Expense mode: the ticked notes are the amount. */}
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

          {/* No party picked yet, so there is no second leg to post against. */}
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

          {/* Manual amount: only for Ledger mode or a party with nothing open (goes On Account). */}
          {!isDirectSettle && !rowsDriveAmount && (isEdit || isLedgerMode) && (
            <fieldset className="border rounded-xl p-4">
              <legend className="text-sm font-medium px-2">Amount</legend>

              {ledgerConcessionsAllowed ? (
                // Ledger settlement uses the same rows as the Direct panel.
                <div className="rounded-lg bg-gray-50 border p-4 space-y-4 text-sm">
                  {ledgerBalanceRows}

                  <div className={`space-y-3 ${ledgerBalanceRows ? "pt-3 border-t" : ""}`}>
                  {isFieldEnabled("amount") && (
                    <label className="flex items-start justify-between gap-4">
                      <span className="pt-1.5">
                        <span className="font-medium text-gray-700">Settle Amount (₹)</span>
                        <span className="block text-[11px] text-gray-500">
                          The base figure, before the two adjustments below.
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
                          ? "Concession you allowed — comes off the cash and the balance."
                          : "Concession they allowed — comes off the cash and the balance."}
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
                        Charged on top — adds to the cash and the balance.
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
                        <span>Base Amount:</span>
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
                      <div className="text-[11px] text-gray-500 pt-0.5">
                        This is also what comes off the balance — the discount and
                        commission move it, not just the cash.
                      </div>
                    </div>
                  )}

                  {errors.amount && (
                    <div className="text-red-600 text-xs">{errors.amount}</div>
                  )}
                  </div>
                </div>
              ) : (
                // Concessions off: still show the ledger's balance.
                <div className="space-y-4">
                  {ledgerBalanceRows && (
                    <div className="rounded-lg bg-gray-50 border p-4 text-sm">
                      {ledgerBalanceRows}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {isFieldEnabled("amount") && (<FormField
                      label={ledgerDueValue > 0 ? "Settle Amount (₹)" : "Amount (₹)"}
                      name="amount"
                      type="number"
                      value={manualAmount}
                      onChange={e => setManualAmount(e.target.value)}
                      placeholder="0.00"
                      error={errors.amount}
                    />)}
                  </div>
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
                    <span>{billLabel(s)}</span>
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
                    // Two legs, both at the cash: Cash/Bank and the party.
                    const row = (label: string, dr: boolean) => (
                      <tr>
                        <td className="py-1">{label}</td>
                        <td className="text-right">{dr ? fmt(totalAmount) : "—"}</td>
                        <td className="text-right">{dr ? "—" : fmt(totalAmount)}</td>
                      </tr>
                    );
                    return payType === "receipt" ? (
                      <>
                        {row(selectedLedgerName, true)}
                        {row(counterLegName, false)}
                      </>
                    ) : (
                      <>
                        {row(counterLegName, true)}
                        {row(selectedLedgerName, false)}
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
        </div>
      </FormPage>

      {/* Confirm auto settlement; nothing is saved until approved. */}
      {proposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="px-5 py-4 border-b">
              <h3 className="text-base font-semibold">Confirm Auto Settlement</h3>
              {/* Show only what lands on bills (excludes opening balance and On Account). */}
              <p className="text-xs text-gray-500 mt-1">
                ₹{fmt(proposal.allocated)} will be applied
                {proposal.openingsettled > 0 ? " to the opening balance" : ""}
                {proposal.openingsettled > 0 && proposal.lines.length > 0 ? " first, then" : ""}
                {proposal.lines.length > 0
                  ? ` to ${proposal.lines.length} ${proposal.lines.length === 1 ? "bill" : "bills"}, oldest first`
                  : ""}
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
                        <td className="px-3 py-2 text-right">
                          ₹{fmt(proposalSplit?.openingDiscount || 0)}
                        </td>
                      )}
                      {showConcessionSplit && totalCommission > 0 && (
                        <td className="px-3 py-2 text-right">
                          ₹{fmt(proposalSplit?.openingCommission || 0)}
                        </td>
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
                      <td className="px-3 py-2 font-medium">{billLabel({ ...l, invoicemodel: l.invoicemodel })}</td>
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
                      {totalCommission > 0 ? "commission" : ""}{" "}
                      {proposal.lines.length === 0
                        ? "is given on the opening balance, which is all this clears."
                        : proposal.openingsettled > 0
                        ? "is split across the opening balance and the bills above, in proportion to what each one clears."
                        : "is split across the bills above in proportion to what each one clears."}{" "}
                      {proposal.lines.length > 0
                        ? "Use \u201CChange Manually\u201D to set it bill by bill instead."
                        : ""}
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
                    // Keep the concession when switching views.
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
