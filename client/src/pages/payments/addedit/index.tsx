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
  usePaymentsQuery,
} from "../../../graphql/hooks/payments";
import { useAccountLedgersQuery } from "../../../graphql/hooks/accountledgers";
import { useAccountsQuery } from "../../../graphql/hooks/accounts";
import { useSalesInvoicesQuery } from "../../../graphql/hooks/salesinvoice";
import { usePurchaseInvoicesQuery } from "../../../graphql/hooks/purchaseinvoice";
import { useTransactionsQuery } from "../../../graphql/hooks/transactions";
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
  const { data: existingData } = usePaymentByIDQuery(id || "");
  const { data: ledgerData } = useAccountLedgersQuery();
  const { data: accountsData } = useAccountsQuery();
  const { data: salesInvData } = useSalesInvoicesQuery();
  const { data: purchaseInvData } = usePurchaseInvoicesQuery();
  const { data: paymentsData } = usePaymentsQuery();
  const { data: transactionsData } = useTransactionsQuery();
  const { data: expenseNotesData } = useExpenseNotesQuery();
  const { data: adminSettingsData } = useAdminSettingsQuery(adminId);
  const { addPaymentMutation, editPaymentMutation } = usePaymentMutations();

  // Feature flag (per business): allow Discount & Commission while settling a bill.
  const dcEnabled = !!adminSettingsData?.getAdminSettings?.enablePaymentDiscountCommission;

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
  const totalAmount = settledInvoices.length > 0
    ? parseFloat((totalSettled - totalDiscount + totalCommission).toFixed(2))
    : parseFloat(manualAmount) || 0;

  // ── Already-paid amounts per invoice (exclude current edit) ────────────
  const paidByInvoice = useMemo(() => {
    const map: Record<string, number> = {};
    // Payments
    (paymentsData?.getPayments || []).forEach((pay: any) => {
      if (isEdit && pay.id === id) return;
      (pay.invoices || []).forEach((inv: any) => {
        if (inv.invoiceid) {
          map[inv.invoiceid] = (map[inv.invoiceid] || 0) + (inv.settledamount || 0);
        }
      });
    });
    // Manual transactions that settled invoices (Tally "Agst Ref") — counted so
    // a journal settlement reduces outstanding here too, consistent with the
    // Transaction page's BillAllocation.
    (transactionsData?.getTransactions || []).forEach((txn: any) => {
      (txn.invoices || []).forEach((inv: any) => {
        if (inv.invoiceid) {
          map[inv.invoiceid] = (map[inv.invoiceid] || 0) + (inv.settledamount || 0);
        }
      });
    });
    return map;
  }, [paymentsData, transactionsData, id, isEdit]);

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
      .map((inv: any) => {
        const paid = paidByInvoice[inv.id] || 0;
        const outstanding = parseFloat((inv.totalamount - paid).toFixed(2));
        return { ...inv, outstanding };
      })
      .filter((inv: any) => inv.outstanding > 0);
  }, [partyid, payType, salesInvData, purchaseInvData, expenseNotesData, accountsData, paidByInvoice]);

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
    if (!(p.invoices?.length)) {
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
    return e;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

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
      invoices: settledInvoices
        .filter(s => s.invoiceid)
        .map(s => ({
          invoiceid: s.invoiceid,
          invoicemodel: s.invoicemodel,
          settledamount: s.settledamount,
          discount: dcEnabled ? (s.discount || 0) : 0,
          commission: dcEnabled ? (s.commission || 0) : 0,
        })),
      amount: totalAmount,
      reference: reference || undefined,
      remarks: remarks || undefined,
      status: true,
      createdby_id: creator.id,
      createdby_name: creator.name,
      createdby_type: creator.type,
    };

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
      dispatch(showMessage({ message: err?.message || "Error saving payment", type: "error" }));
    }
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
              <FormField
                label="Payment Date"
                name="paymentdate"
                type="date"
                value={paymentdate}
                onChange={e => setPaymentdate(e.target.value)}
              />
              <FormField
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
              />
              <FormField
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
              />
              {payType !== "expense" ? (
                <FormField
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
                />
              ) : (
                <div className="flex flex-col justify-end text-sm text-gray-500">
                  <span className="font-medium text-gray-700 mb-1">Expense Note</span>
                  <span>Pick an expense note to settle from the list below.</span>
                </div>
              )}
              <FormField
                label="Cash / Bank Ledger"
                name="ledgerid"
                type="select"
                value={ledgerid}
                onChange={e => setLedgerid(e.target.value)}
                options={ledgerOptions}
                placeholder="Select ledger"
                searchable
                error={errors.ledgerid}
              />
              <FormField
                label="Reference"
                name="reference"
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="Cheque no., UTR, etc."
              />
              <FormField
                label="Remarks"
                name="remarks"
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="Optional"
              />
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

              {outstandingInvoices.length === 0 ? (
                <p className="text-sm text-gray-500">
                  {payType === "expense"
                    ? "No outstanding credit expense notes to settle."
                    : "No outstanding credit invoices found for this party. Enter the amount manually below."}
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
          {settledInvoices.length === 0 && (
            <fieldset className="border rounded-xl p-4">
              <legend className="text-sm font-medium px-2">Amount</legend>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField
                  label="Amount (₹)"
                  name="amount"
                  type="number"
                  value={manualAmount}
                  onChange={e => setManualAmount(e.target.value)}
                  placeholder="0.00"
                  error={errors.amount}
                />
              </div>
            </fieldset>
          )}

          {/* ── Section 4: Summary ───────────────────────────────────── */}
          {settledInvoices.length > 0 && (
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
                    const partyLeg = settledInvoices.length > 0 ? totalSettled : totalAmount;
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
            <Button variant="outline" onClick={handleSubmit}>
              {isEdit ? "Update Payment" : "Save Payment"}
            </Button>
          </div>
        </div>
      </div>
    </HomeLayout>
  );
};

export default AddEditPayment;
