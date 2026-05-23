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

type SettledInvoice = {
  invoiceid: string;
  invoicemodel: "SalesInvoice" | "PurchaseInvoice";
  settledamount: number;
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
  const { addPaymentMutation, editPaymentMutation } = usePaymentMutations();

  // ── Form state ─────────────────────────────────────────────────────────
  const [paymentdate, setPaymentdate] = useState(new Date().toISOString().slice(0, 10));
  const [payType, setPayType] = useState<"receipt" | "payment">("receipt");
  const [mode, setMode] = useState("cash");
  const [ledgerid, setLedgerid] = useState("");
  const [partyid, setPartyid] = useState("");
  const [reference, setReference] = useState("");
  const [remarks, setRemarks] = useState("");
  const [manualAmount, setManualAmount] = useState<string>("");
  const [settledInvoices, setSettledInvoices] = useState<SettledInvoice[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Total = sum of settlements, or manual amount if no invoices selected
  const totalAmount = settledInvoices.length > 0
    ? parseFloat(settledInvoices.reduce((s, i) => s + (i.settledamount || 0), 0).toFixed(2))
    : parseFloat(manualAmount) || 0;

  // ── Already-paid amounts per invoice (exclude current edit) ────────────
  const paidByInvoice = useMemo(() => {
    const map: Record<string, number> = {};
    (paymentsData?.getPayments || []).forEach((pay: any) => {
      if (isEdit && pay.id === id) return;
      (pay.invoices || []).forEach((inv: any) => {
        if (inv.invoiceid) {
          map[inv.invoiceid] = (map[inv.invoiceid] || 0) + (inv.settledamount || 0);
        }
      });
    });
    return map;
  }, [paymentsData, id, isEdit]);

  // ── Outstanding invoices for the selected party ────────────────────────
  const outstandingInvoices = useMemo(() => {
    if (!partyid) return [];
    const source =
      payType === "receipt"
        ? (salesInvData?.getSalesInvoices || []).filter(
            (inv: any) =>
              inv.partyacc?.id === partyid &&
              inv.paymenttype === "credit" &&
              inv.status
          ).map((inv: any) => ({ ...inv, invoicemodel: "SalesInvoice" }))
        : (purchaseInvData?.getPurchaseInvoices || []).filter(
            (inv: any) =>
              inv.partyacc?.id === partyid &&
              inv.paymenttype === "credit" &&
              inv.status
          ).map((inv: any) => ({ ...inv, invoicemodel: "PurchaseInvoice" }));

    return source
      .map((inv: any) => {
        const paid = paidByInvoice[inv.id] || 0;
        const outstanding = parseFloat((inv.totalamount - paid).toFixed(2));
        return { ...inv, outstanding };
      })
      .filter((inv: any) => inv.outstanding > 0);
  }, [partyid, payType, salesInvData, purchaseInvData, paidByInvoice]);

  // ── Load existing payment for edit ─────────────────────────────────────
  useEffect(() => {
    if (!isEdit || !existingData?.getPaymentById) return;
    const p = existingData.getPaymentById;
    setPaymentdate(formatDate(p.paymentdate));
    setPayType(p.type === "payment" ? "payment" : "receipt");
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
    // Wait until invoice data is fetched
    if (!salesInvData && !purchaseInvData) return;

    const settled: SettledInvoice[] = (p.invoices || []).map((ei: any) => {
      const match = outstandingInvoices.find((oi: any) => oi.id === ei.invoiceid);
      return {
        invoiceid: ei.invoiceid,
        invoicemodel: ei.invoicemodel,
        settledamount: ei.settledamount,
        billnumber: match?.billnumber || ei.invoiceid,
        totalamount: match?.totalamount || 0,
        othercharges: match?.othercharges || [],
        subtotal: match?.subtotal || 0,
        totalgst: match?.totalgst || 0,
      };
    });

    setSettledInvoices(settled);
    editLoaded.current = true;
  }, [isEdit, existingData, outstandingInvoices, salesInvData, purchaseInvData]);

  const formatDate = (date: any) => {
    if (!date) return new Date().toISOString().slice(0, 10);
    const ts = Number(date);
    if (!isNaN(ts)) return new Date(ts).toISOString().slice(0, 10);
    return new Date(date).toISOString().slice(0, 10);
  };

  // ── Dropdown options ───────────────────────────────────────────────────
  const partyOptions = useMemo(() => {
    return (accountsData?.getAccounts || [])
      .filter((a: any) =>
        payType === "receipt"
          ? a.type === "customer"
          : a.type === "vendor" || a.type === "other"
      )
      .map((a: any) => ({
        value: a.id,
        label: `${a.name}${a.mobile ? ` - ${a.mobile}` : ""}`,
      }));
  }, [accountsData, payType]);

  const ledgerOptions = useMemo(() => {
    return (ledgerData?.getAccountLedgers || []).map((l: any) => ({
      value: l.id,
      label: l.ledgername,
    }));
  }, [ledgerData]);

  const selectedLedgerName =
    ledgerData?.getAccountLedgers?.find((l: any) => l.id === ledgerid)?.ledgername || "Cash / Bank Ledger";

  // ── Invoice settlement helpers ─────────────────────────────────────────
  const isSelected = (invId: string) => settledInvoices.some(s => s.invoiceid === invId);

  const toggleInvoice = (inv: any) => {
    if (isSelected(inv.id)) {
      setSettledInvoices(prev => prev.filter(s => s.invoiceid !== inv.id));
    } else {
      setSettledInvoices(prev => [
        ...prev,
        {
          invoiceid: inv.id,
          invoicemodel: inv.invoicemodel,
          settledamount: inv.outstanding,
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

  // ── Validation & Submit ────────────────────────────────────────────────
  const validate = () => {
    const e: Record<string, string> = {};
    if (!ledgerid) e.ledgerid = "Select a cash / bank ledger";
    if (totalAmount <= 0) e.amount = "Amount must be greater than zero";
    return e;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const input: any = {
      adminid: adminId,
      branchid: branchId,
      paymentdate,
      type: payType,
      mode,
      ledgerid,
      partyid: partyid || null,
      invoices: settledInvoices
        .filter(s => s.invoiceid)
        .map(s => ({
          invoiceid: s.invoiceid,
          invoicemodel: s.invoicemodel,
          settledamount: s.settledamount,
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
                  setPayType(e.target.value as "receipt" | "payment");
                  setPartyid("");
                  setSettledInvoices([]);
                  editLoaded.current = false;
                }}
                options={[
                  { label: "Receipt  (Money In — from Customer)", value: "receipt" },
                  { label: "Payment  (Money Out — to Vendor)", value: "payment" },
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
          {partyid && (
            <fieldset className="border rounded-xl p-4 space-y-4">
              <legend className="text-sm font-medium px-2">
                {payType === "receipt" ? "Outstanding Sales Invoices" : "Outstanding Purchase Invoices"}
              </legend>

              {outstandingInvoices.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No outstanding credit invoices found for this party. Enter the amount manually below.
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
                            <td className="px-3 py-2 font-medium">INV-{inv.billnumber}</td>
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
                    <span>INV-{s.billnumber}</span>
                    <span>₹{fmt(s.settledamount)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-semibold text-base border-t pt-2 mt-2">
                  <span>Total:</span>
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
                  {payType === "receipt" ? (
                    <>
                      <tr>
                        <td className="py-1">{selectedLedgerName}</td>
                        <td className="text-right">{fmt(totalAmount)}</td>
                        <td className="text-right">—</td>
                      </tr>
                      <tr>
                        <td className="py-1">Party Account (Debtor)</td>
                        <td className="text-right">—</td>
                        <td className="text-right">{fmt(totalAmount)}</td>
                      </tr>
                    </>
                  ) : (
                    <>
                      <tr>
                        <td className="py-1">Party Account (Creditor)</td>
                        <td className="text-right">{fmt(totalAmount)}</td>
                        <td className="text-right">—</td>
                      </tr>
                      <tr>
                        <td className="py-1">{selectedLedgerName}</td>
                        <td className="text-right">—</td>
                        <td className="text-right">{fmt(totalAmount)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
              {settledInvoices.length > 0 && (
                <p className="text-xs text-blue-600 mt-2">
                  Other charges (freight, transport, etc.) from the linked invoices are already posted
                  in the invoice journal entries and do not appear here separately.
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
