// Add / Edit a Sales Return (Credit Note).
//
// Modes:
//   - ?fromInvoice=<id>  →  load that invoice and pre-populate full qty per line
//   - /:id (existing)    →  load existing return for editing
//   - bare /addedit      →  user must pick a source invoice from the dropdown
//
// Quantity validation runs both client-side (immediate UX) and server-side
// (authoritative — reads existing returns to compute remaining returnable qty).

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router";
import HomeLayout from "../../../layouts/home";
import FormField from "../../../components/formfiled";
import Button from "../../../components/button";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";
import {
  useSalesReturnByIDQuery,
  useSalesReturnMutations,
} from "../../../graphql/hooks/salesreturn";
import {
  useSalesInvoicesQuery,
  useSalesInvoiceByIDQuery,
} from "../../../graphql/hooks/salesinvoice";
import OtherChargesSection, { type OtherCharge } from "../../../components/othercharges";

type Line = {
  productserviceid: string;
  productName: string;
  variantid?: string;
  variantName?: string;
  salesunitid?: string;
  unitqty: number;
  gst: number;
  rate: number;
  discount: number;
  qty: number;        // returnable qty entered by user
  originalQty: number;
  amount: number;
};

const todayStr = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const AddEditSalesReturn: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const isEdit = Boolean(id);

  const queryParams = new URLSearchParams(location.search);
  const fromInvoiceParam = queryParams.get("fromInvoice");

  const { type, admin, branch, staff } = useAppSelector((s: any) => s.auth);
  const adminId =
    type === "admin" ? admin?.id :
    type === "branch" ? branch?.admin?.id :
    type === "staff" ? staff?.admin?.id : undefined;
  const selectedBranchId = useAppSelector((s: any) => s.selectedBranch?.branchId);
  const branchId = type === "branch" ? branch?.id :
                   type === "staff" ? staff?.branchid?.id :
                   selectedBranchId;

  const creator = useMemo(() => {
    if (type === "admin" && admin) return { id: admin.id, name: admin.name, type: "admin" };
    if (type === "branch" && branch) return { id: branch.id, name: branch.branchname || "Branch", type: "branch" };
    if (type === "staff" && staff) return { id: staff.id, name: staff.name, type: "staff" };
    return { id: "", name: "Unknown", type: "unknown" };
  }, [type, admin, branch, staff]);

  // Source invoice selection
  const [sourceInvoiceId, setSourceInvoiceId] = useState(fromInvoiceParam || "");

  // Form state
  const [returndate, setReturndate] = useState(todayStr());
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [refundMode, setRefundMode] = useState("auto");   // auto | advance | skip
  const [paymentType, setPaymentType] = useState("");
  const [partyacc, setPartyacc] = useState<any>(null);
  const [billtype, setBilltype] = useState("");
  const [taxorsupplytype, setTaxOrSupplyType] = useState("");
  const [invoicetype, setInvoiceType] = useState("retail");
  const [isservice, setIsService] = useState(false);
  const [salesmenid, setSalesmenid] = useState<string | undefined>(undefined);
  const [lines, setLines] = useState<Line[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [otherCharges, setOtherCharges] = useState<OtherCharge[]>([]);
  const [roundOff, setRoundOff] = useState<number | "">("");
  const [invoiceDiscount, setInvoiceDiscount] = useState<number | "">("");
  const [invoiceDiscountType, setInvoiceDiscountType] = useState("amount");

  // Existing return (edit mode)
  const { data: existingData } = useSalesReturnByIDQuery(id || "");
  // Source invoice details
  const { data: sourceInvData } = useSalesInvoiceByIDQuery(sourceInvoiceId || "");
  // List of invoices for the picker
  const { data: invoicesData } = useSalesInvoicesQuery();
  const invoiceOptions = useMemo(
    () =>
      (invoicesData?.getSalesInvoices ?? []).map((inv: any) => ({
        value: inv.id,
        label: `INV-${inv.billnumber} · ${inv.partyacc?.accountname ?? "?"} · ₹${inv.totalamount}`,
      })),
    [invoicesData]
  );

  // Mutations
  const { addSalesReturnMutation, editSalesReturnMutation } = useSalesReturnMutations();

  // Hydrate from existing return when editing
  useEffect(() => {
    if (!isEdit) return;
    const ret = existingData?.getSalesReturnById;
    if (!ret) return;
    setSourceInvoiceId(ret.sourceInvoiceId);
    setReturndate(ret.returndate || todayStr());
    setReason(ret.reason || "");
    setNotes(ret.notes || "");
    setRefundMode(ret.refundMode || "auto");
    setPaymentType(ret.paymenttype || "");
    setPartyacc(ret.partyacc);
    setBilltype(ret.billtype || "");
    setTaxOrSupplyType(ret.taxorsupplytype || "");
    setInvoiceType(ret.invoicetype || "retail");
    setIsService(!!ret.isservice);
    setSalesmenid(ret.salesmenid?.id);
    
    setOtherCharges(ret.othercharges?.map((c: any) => ({
      ledgerid: c.ledgerid?.id || "",
      ledgername: c.ledgerid?.ledgername || c.ledgername || "",
      amount: c.amount || 0,
      gstpercent: c.gstpercent || 0,
      gstamount: c.gstamount || 0,
      totalamount: c.totalamount || 0,
      remarks: c.remarks || "",
    })) || []);
    setRoundOff(ret.roundoff || "");
    setInvoiceDiscount(ret.invoicediscount || "");
    setInvoiceDiscountType(ret.invoicediscounttype || "amount");

    setLines(
      (ret.productservice ?? []).map((p: any) => ({
        productserviceid: p.productserviceid?.id ?? p.productserviceid,
        productName: p.productserviceid?.name ?? "Item",
        variantid: p.variantid?.id ?? undefined,
        variantName: p.variantid?.name,
        salesunitid: p.salesunitid?.id,
        unitqty: p.unitqty || 1,
        gst: p.gst || 0,
        rate: p.rate || 0,
        discount: p.discount || 0,
        qty: p.qty || 0,
        originalQty: p.qty || 0,
        amount: p.amount || 0,
      }))
    );
  }, [isEdit, existingData]);

  // Hydrate from source invoice when adding/converting
  useEffect(() => {
    if (isEdit) return;
    const inv = sourceInvData?.getSalesInvoiceById;
    if (!inv) return;

    setReturndate(todayStr());
    setPaymentType(inv.paymenttype || "");
    setPartyacc(inv.partyacc);
    setBilltype(inv.billtype || "");
    setTaxOrSupplyType(inv.taxorsupplytype || "");
    setInvoiceType(inv.invoicetype || "retail");
    setIsService(!!inv.isservice);
    setSalesmenid(inv.salesmenid?.id);

    setOtherCharges(inv.othercharges?.map((c: any) => ({
      ledgerid: c.ledgerid?.id || "",
      ledgername: c.ledgerid?.ledgername || c.ledgername || "",
      amount: c.amount || 0,
      gstpercent: c.gstpercent || 0,
      gstamount: c.gstamount || 0,
      totalamount: c.totalamount || 0,
      remarks: c.remarks || "",
    })) || []);
    setRoundOff(inv.roundoff || "");
    setInvoiceDiscount(inv.invoicediscount || "");
    setInvoiceDiscountType(inv.invoicediscounttype || "amount");

    // Pre-populate full quantity from each line. User then reduces as needed.
    setLines(
      (inv.productservice ?? []).map((p: any) => ({
        productserviceid: p.productserviceid?.id ?? p.productserviceid,
        productName: p.productserviceid?.name ?? "Item",
        variantid: p.variantid?.id ?? undefined,
        variantName: p.variantid?.name,
        salesunitid: p.salesunitid?.id,
        unitqty: p.unitqty || 1,
        gst: p.gst || 0,
        rate: p.rate || 0,
        discount: p.discount || 0,
        qty: p.qty || 0,
        originalQty: p.qty || 0,
        amount: p.amount || 0,
      }))
    );
  }, [isEdit, sourceInvData]);

  // Recompute line amount on qty/rate/discount change
  const updateLine = (idx: number, field: keyof Line, value: any) => {
    setLines((prev) => {
      const next = [...prev];
      const line = { ...next[idx], [field]: value };
      // Recompute amount = (rate - discount) * qty
      const rate = Number(line.rate) || 0;
      const discount = Number(line.discount) || 0;
      const qty = Number(line.qty) || 0;
      line.amount = parseFloat(((rate - discount) * qty).toFixed(2));
      next[idx] = line;
      return next;
    });
    if (errors[`qty_${idx}`]) {
      setErrors((prev) => {
        const n = { ...prev };
        delete n[`qty_${idx}`];
        return n;
      });
    }
  };

  // Totals
  const totals = useMemo(() => {
    let subtotal = 0;
    let totaldiscount = 0;
    let totalgst = 0;
    for (const l of lines) {
      const taxable = (Number(l.rate) - Number(l.discount)) * Number(l.qty);
      subtotal += taxable;
      totaldiscount += Number(l.discount) * Number(l.qty);
      totalgst += (taxable * Number(l.gst)) / 100;
    }

    const invDisc = Number(invoiceDiscount) || 0;
    const computedInvDisc = invoiceDiscountType === "percent" ? (subtotal * invDisc) / 100 : invDisc;

    let otherChargesTotal = 0;
    otherCharges.forEach((c) => {
      otherChargesTotal += c.totalamount;
    });

    const totalamount = subtotal + totalgst - computedInvDisc + otherChargesTotal + (Number(roundOff) || 0);
    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      totaldiscount: parseFloat((totaldiscount + computedInvDisc).toFixed(2)),
      totalgst: parseFloat(totalgst.toFixed(2)),
      totalamount: parseFloat(totalamount.toFixed(2)),
    };
  }, [lines, otherCharges, roundOff, invoiceDiscount, invoiceDiscountType]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!sourceInvoiceId) e.sourceInvoiceId = "Source invoice is required";
    if (!returndate) e.returndate = "Return date is required";
    if (!partyacc?.id) e.partyacc = "Party account missing";
    if (!lines.length || lines.every((l) => Number(l.qty) <= 0)) {
      e.lines = "Enter at least one return quantity > 0";
    }
    lines.forEach((l, i) => {
      const q = Number(l.qty || 0);
      if (q < 0) e[`qty_${i}`] = "Qty cannot be negative";
      if (q > l.originalQty) e[`qty_${i}`] = `Cannot exceed original ${l.originalQty}`;
    });
    setErrors(e);
    if (Object.keys(e).length > 0) {
      dispatch(showMessage({ message: "Please fix highlighted fields", type: "error" }));
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    // Strip out lines with qty <= 0 so we don't post zero-value lines
    const filteredLines = lines.filter((l) => Number(l.qty) > 0);

    const input: any = {
      sourceInvoiceId,
      salesmenid: salesmenid || undefined,
      paymenttype: paymentType,
      partyacc: partyacc?.id,
      taxorsupplytype: taxorsupplytype || "exclusive",
      returndate,
      billtype: billtype || "tax",
      notes: notes || undefined,
      reason: reason || undefined,
      refundMode,
      invoicetype,
      subtotal: totals.subtotal,
      totaldiscount: totals.totaldiscount,
      totalgst: totals.totalgst,
      totalamount: totals.totalamount,
      othercharges: otherCharges.map((c) => ({
        ledgerid: c.ledgerid,
        amount: c.amount,
        gstpercent: c.gstpercent,
        gstamount: c.gstamount,
        totalamount: c.totalamount,
        remarks: c.remarks,
      })),
      roundoff: roundOff ? Number(roundOff) : 0,
      invoicediscount: invoiceDiscount ? Number(invoiceDiscount) : 0,
      invoicediscounttype: invoiceDiscountType,
      adminid: adminId,
      branchid: branchId,
      isservice,
      createdby_id: creator.id,
      createdby_name: creator.name,
      createdby_type: creator.type,
      productservice: filteredLines.map((l) => ({
        productserviceid: l.productserviceid,
        variantid: l.variantid || undefined,
        salesunitid: l.salesunitid || undefined,
        unitqty: l.unitqty,
        gst: l.gst,
        qty: Number(l.qty),
        rate: l.rate,
        amount: l.amount,
        discount: l.discount,
      })),
    };

    try {
      if (isEdit && id) {
        await editSalesReturnMutation({ variables: { id, input } });
        dispatch(showMessage({ message: "Sales return updated.", type: "success" }));
      } else {
        await addSalesReturnMutation({ variables: { input } });
        dispatch(showMessage({ message: "Sales return saved.", type: "success" }));
      }
      navigate("/salesreturn");
    } catch (err: any) {
      dispatch(
        showMessage({
          message: err?.message || "Failed to save sales return",
          type: "error",
        })
      );
    }
  };

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <h1 className="text-xl font-semibold mb-4">
          {isEdit ? "Edit Sales Return" : "Add Sales Return (Credit Note)"}
        </h1>

        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField
              label="Source Invoice"
              name="sourceInvoiceId"
              type="select"
              options={invoiceOptions}
              value={sourceInvoiceId}
              onChange={(e: any) => setSourceInvoiceId(e.target.value)}
              searchable
              disabled={isEdit}
              required
              error={errors.sourceInvoiceId}
            />
            <FormField
              label="Return Date"
              name="returndate"
              type="date"
              value={returndate}
              onChange={(e: any) => setReturndate(e.target.value)}
              required
              error={errors.returndate}
            />
            <FormField
              label="Refund Mode"
              name="refundMode"
              type="select"
              options={[
                { value: "auto", label: "Auto-refund (Cash/Bank only)" },
                { value: "advance", label: "Hold as Customer Advance" },
                { value: "skip", label: "Skip — journal entry only" },
              ]}
              value={refundMode}
              onChange={(e: any) => setRefundMode(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <FormField
              label="Reason"
              name="reason"
              value={reason}
              onChange={(e: any) => setReason(e.target.value)}
              placeholder="Damaged, wrong item, etc."
            />
            <FormField
              label="Notes"
              name="notes"
              value={notes}
              onChange={(e: any) => setNotes(e.target.value)}
            />
          </div>

          {partyacc && (
            <div className="mt-3 text-sm text-gray-600">
              <span className="font-medium">Customer:</span>{" "}
              {partyacc.accountname} {partyacc.mobile ? `· ${partyacc.mobile}` : ""}
              {paymentType && (
                <span className="ml-3">
                  <span className="font-medium">Payment Type:</span> {paymentType}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Line items */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Original Qty</th>
                <th className="px-3 py-2">Return Qty</th>
                <th className="px-3 py-2">Rate</th>
                <th className="px-3 py-2">Discount</th>
                <th className="px-3 py-2">GST %</th>
                <th className="px-3 py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                    {sourceInvoiceId ? "Loading invoice…" : "Select a source invoice to load line items."}
                  </td>
                </tr>
              )}
              {lines.map((l, i) => (
                <tr key={`${l.productserviceid}_${l.variantid ?? "v"}_${i}`} className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-medium">{l.productName}</div>
                    {l.variantName && <div className="text-xs text-gray-500">{l.variantName}</div>}
                  </td>
                  <td className="px-3 py-2">{l.originalQty}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      className={`w-24 border rounded px-2 py-1 ${errors[`qty_${i}`] ? "border-red-500" : "border-gray-300"}`}
                      value={l.qty}
                      min={0}
                      max={l.originalQty}
                      onChange={(e) => updateLine(i, "qty", parseFloat(e.target.value) || 0)}
                    />
                    {errors[`qty_${i}`] && (
                      <div className="text-xs text-red-600 mt-1">{errors[`qty_${i}`]}</div>
                    )}
                  </td>
                  <td className="px-3 py-2">{l.rate}</td>
                  <td className="px-3 py-2">{l.discount}</td>
                  <td className="px-3 py-2">{l.gst}</td>
                  <td className="px-3 py-2">{l.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Other Charges */}
        <OtherChargesSection
          otherCharges={otherCharges}
          setOtherCharges={setOtherCharges}
        />

        {errors.lines && <div className="text-red-600 text-sm mt-2">{errors.lines}</div>}

        {/* Totals */}
        <div className="flex justify-end mt-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4 w-full sm:w-80 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>₹ {totals.subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between items-center mt-2">
              <span>Invoice Discount</span>
              <div className="flex gap-2">
                <input
                  type="number"
                  className="border rounded px-2 w-20 text-right h-8"
                  value={invoiceDiscount}
                  onChange={(e) => setInvoiceDiscount(e.target.value)}
                />
                <select
                  className="border rounded px-1 h-8"
                  value={invoiceDiscountType}
                  onChange={(e) => setInvoiceDiscountType(e.target.value)}
                >
                  <option value="amount">₹</option>
                  <option value="percent">%</option>
                </select>
              </div>
            </div>
            <div className="flex justify-between mt-2"><span>Total Line Discount</span><span>₹ {(totals.totaldiscount - (invoiceDiscountType === "percent" ? (totals.subtotal * (Number(invoiceDiscount)||0))/100 : (Number(invoiceDiscount)||0))).toFixed(2)}</span></div>
            <div className="flex justify-between mt-2"><span>Total GST</span><span>₹ {totals.totalgst.toFixed(2)}</span></div>
            {otherCharges.length > 0 && (
              <div className="flex justify-between mt-2"><span>Other Charges</span><span>₹ {otherCharges.reduce((sum, c) => sum + (c.totalamount || 0), 0).toFixed(2)}</span></div>
            )}
            <div className="flex justify-between items-center mt-2">
              <span>Round Off</span>
              <input
                type="number"
                className="border rounded px-2 w-20 text-right h-8"
                value={roundOff}
                onChange={(e) => setRoundOff(e.target.value)}
              />
            </div>
            <div className="flex justify-between font-semibold border-t pt-2 mt-2">
              <span>Refund Amount</span><span>₹ {totals.totalamount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={() => navigate("/salesreturn")}>Cancel</Button>
          <Button variant="outline" onClick={handleSubmit}>
            {isEdit ? "Update" : "Save"}
          </Button>
        </div>
      </div>
    </HomeLayout>
  );
};

export default AddEditSalesReturn;
