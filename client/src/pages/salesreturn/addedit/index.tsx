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

  const salesReturns = useAppSelector(
    (state) => state.salesreturn?.returns || []
  );

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
  const [billnumber, setBillnumber] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [otherCharges, setOtherCharges] = useState<OtherCharge[]>([]);
  const [roundOff, setRoundOff] = useState<number | "">("");
  const [invoiceDiscount, setInvoiceDiscount] = useState<number | "">("");
  const [invoiceDiscountType, setInvoiceDiscountType] = useState("amount");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [transportName, setTransportName] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [ewayBillNo, setEwayBillNo] = useState("");
  const [distance, setDistance] = useState<number | "">("");

  // Existing return (edit mode)
  const { data: existingData } = useSalesReturnByIDQuery(id || "");
  // Source invoice details
  const { data: sourceInvData } = useSalesInvoiceByIDQuery(sourceInvoiceId || "");
  // List of invoices for the picker
  const { data: invoicesData } = useSalesInvoicesQuery();
  const invoiceOptions = useMemo(() => {
    // Calculate how much has been returned for each item in each invoice
    const returnedByInvoiceAndItem = new Map<string, Record<string, number>>();

    salesReturns
      .filter((ret: any) => ret.status === true)  // Only active returns
      .forEach((ret: any) => {
        const invoiceId = ret.sourceInvoiceId;
        if (!returnedByInvoiceAndItem.has(invoiceId)) {
          returnedByInvoiceAndItem.set(invoiceId, {});
        }
        const itemMap = returnedByInvoiceAndItem.get(invoiceId)!;

        (ret.productservice ?? []).forEach((line: any) => {
          const key = `${line.productserviceid}_${line.variantid ?? ""}`;
          itemMap[key] = (itemMap[key] || 0) + (line.qty || 0);
        });
      });

    // Filter invoices: only exclude if ALL items have been fully returned
    return (invoicesData?.getSalesInvoices ?? [])
      .filter((inv: any) => {
        const returnedItems = returnedByInvoiceAndItem.get(inv.id);

        // If no returns for this invoice, include it
        if (!returnedItems) return true;

        // Check if ALL items have been fully returned
        const allItemsFullyReturned = (inv.productservice ?? []).every((line: any) => {
          const key = `${line.productserviceid}_${line.variantid ?? ""}`;
          const invoicedQty = line.qty || 0;
          const returnedQty = returnedItems[key] || 0;
          return returnedQty >= invoicedQty;  // All of this item returned
        });

        // Include invoice if NOT all items are fully returned (still has returnable items)
        return !allItemsFullyReturned;
      })
      .map((inv: any) => {
        const returnedItems = returnedByInvoiceAndItem.get(inv.id) || {};
        const remainingQty = (inv.productservice ?? []).reduce((sum: number, line: any) => {
          const key = `${line.productserviceid}_${line.variantid ?? ""}`;
          const invoicedQty = line.qty || 0;
          const returnedQty = returnedItems[key] || 0;
          return sum + Math.max(0, invoicedQty - returnedQty);
        }, 0);

        return {
          value: inv.id,
          label: `INV-${inv.billnumber} · ${inv.partyacc?.accountname ?? "?"} · ₹${inv.totalamount} · Remaining: ${remainingQty}`,
        };
      });
  }, [invoicesData, salesReturns]);

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
    setBillnumber(ret.billnumber || "");
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
    setDeliveryDate(ret.deliverydate || "");
    setDueDate(ret.duedate || "");
    setTransportName(ret.transportname || "");
    setVehicleNumber(ret.vehiclenumber || "");
    setEwayBillNo(ret.ewaybillno || "");
    setDistance(ret.distance || "");

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

  // Auto-calculate bill number for new returns
  useEffect(() => {
    if (isEdit) return;
    if (sourceInvoiceId) return; // Wait for source invoice to be selected
    if (billnumber) return; // Already set

    // When no source invoice is selected in new mode, auto-calculate bill number
    if (salesReturns.length > 0) {
      const billNumbers = salesReturns.map((ret) => ret.billnumber).filter(Boolean);
      const lastBillNumber = [...billNumbers].sort().pop();
      const nextBillNumber = (parseInt(lastBillNumber || "0", 10) + 1)
        .toString()
        .padStart(6, "0");
      setBillnumber(nextBillNumber);
    } else {
      setBillnumber("000001");
    }
  }, [isEdit, sourceInvoiceId, billnumber]);

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
    setDeliveryDate(inv.deliverydate || "");
    setDueDate(inv.duedate || "");
    setTransportName(inv.transportname || "");
    setVehicleNumber(inv.vehiclenumber || "");
    setEwayBillNo(inv.ewaybillno || "");
    setDistance(inv.distance || "");

    // Pre-populate full quantity from each line. User then reduces as needed.
    setLines(
      (inv.productservice ?? []).map((p: any) => {
        // Recalculate amount without GST for return form
        const rate = Number(p.rate) || 0;
        const discount = Number(p.discount) || 0;
        const qty = Number(p.qty) || 0;
        const amount = parseFloat(((rate - discount) * qty).toFixed(2));

        return {
          productserviceid: p.productserviceid?.id ?? p.productserviceid,
          productName: p.productserviceid?.name ?? "Item",
          variantid: p.variantid?.id ?? undefined,
          variantName: p.variantid?.name,
          salesunitid: p.salesunitid?.id,
          unitqty: p.unitqty || 1,
          gst: p.gst || 0,
          rate: rate,
          discount: discount,
          qty: qty,
          originalQty: qty,
          amount: amount, // ✅ Recalculated without GST
        };
      })
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      billnumber: isEdit ? billnumber : null,  // ✅ Let server generate for new records
      notes: notes || undefined,
      reason: reason || undefined,
      refundMode,
      invoicetype,
      subtotal: totals.subtotal,
      totaldiscount: totals.totaldiscount,
      totalgst: totals.totalgst,
      totalamount: totals.totalamount,
      othercharges: otherCharges
        .filter(c => c.ledgerid && c.amount > 0)
        .map((c) => ({
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
      deliverydate: deliveryDate || null,
      duedate: dueDate || null,
      transportname: transportName || null,
      vehiclenumber: vehicleNumber || null,
      ewaybillno: ewayBillNo || null,
      distance: distance ? Number(distance) : null,
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
      navigate(-1);
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
      <div className="w-full px-2 sm:px-6 pt-4 pb-6 text-sm sm:text-base">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-6">
          {isEdit ? "Edit Sales Return" : "Add Sales Return (Credit Note)"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Main Details */}
          <fieldset className="border rounded-xl p-4 space-y-4">
            <legend className="text-sm font-medium px-2">Main Details</legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                label="Return Number"
                name="billnumber"
                type="text"
                value={billnumber}
                onChange={(e: any) => setBillnumber(e.target.value)}
                placeholder="Auto-generated"
                disabled={!isEdit && billnumber !== ""}
              />
              <FormField
                label="Payment Type"
                name="paymentType"
                type="select"
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value)}
                options={[
                  { value: "cash", label: "Cash" },
                  { value: "bank", label: "Bank" },
                  { value: "credit", label: "Credit" },
                  { value: "upi", label: "UPI" },
                  { value: "card", label: "Card" },
                  { value: "cheque", label: "Cheque" },
                  { value: "other", label: "Other" },
                ]}
                searchable
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
              <FormField
                label="Tax/Supply Type"
                name="taxOrSupplyType"
                type="select"
                value={taxorsupplytype}
                onChange={(e) => setTaxOrSupplyType(e.target.value)}
                options={[
                  { value: "taxInvoice", label: "Tax Invoice" },
                  { value: "billOfSupply", label: "Bill of Supply" },
                  { value: "other", label: "Other" },
                ]}
                searchable
              />
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

              {partyacc && (
                <div className="col-span-1 md:col-span-3 text-sm text-gray-600 bg-gray-50 p-3 rounded">
                  <span className="font-medium">Customer:</span>{" "}
                  {partyacc.accountname} {partyacc.mobile ? `· ${partyacc.mobile}` : ""}
                </div>
              )}
            </div>
          </fieldset>

          {/* Line Items */}
          <fieldset className="border rounded-xl p-4 space-y-4">
            <legend className="text-sm font-medium px-2">Return Items</legend>
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
            {errors.lines && <div className="text-red-600 text-sm">{errors.lines}</div>}
          </fieldset>

          {/* Other Charges */}
          <OtherChargesSection
            otherCharges={otherCharges}
            setOtherCharges={setOtherCharges}
          />

          {/* Transport & Delivery */}
          <fieldset className="border rounded-xl p-4 space-y-4">
            <legend className="text-sm font-medium px-2">Transport & Delivery</legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                label="Delivery Date"
                name="deliveryDate"
                type="date"
                value={deliveryDate}
                onChange={(e: any) => setDeliveryDate(e.target.value)}
              />
              <FormField
                label="Due Date"
                name="dueDate"
                type="date"
                value={dueDate}
                onChange={(e: any) => setDueDate(e.target.value)}
              />
              <FormField
                label="Transport Name"
                name="transportName"
                type="text"
                value={transportName}
                onChange={(e: any) => setTransportName(e.target.value)}
                placeholder="e.g., ABC Logistics"
              />
              <FormField
                label="Vehicle Number"
                name="vehicleNumber"
                type="text"
                value={vehicleNumber}
                onChange={(e: any) => setVehicleNumber(e.target.value)}
                placeholder="e.g., MH-01-AB-1234"
              />
              <FormField
                label="E-Way Bill No."
                name="ewayBillNo"
                type="text"
                value={ewayBillNo}
                onChange={(e: any) => setEwayBillNo(e.target.value)}
                placeholder="e.g., EWB123456789"
              />
              <FormField
                label="Distance (km)"
                name="distance"
                type="number"
                value={distance}
                onChange={(e: any) => setDistance(e.target.value)}
                placeholder="0"
              />
            </div>
          </fieldset>

          {/* Summary */}
          <fieldset className="border rounded-xl p-4 space-y-4">
            <legend className="text-sm font-medium px-2">Summary</legend>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <FormField label="Subtotal" name="subtotal" onChange={() => ""} type="text" value={totals.subtotal.toFixed(2)} disabled />
              <FormField label="Total Discount" name="totalDiscount" onChange={() => ""} type="text" value={totals.totaldiscount.toFixed(2)} disabled />
              <FormField label="Tax Amount" name="taxAmount" onChange={() => ""} type="text" value={totals.totalgst.toFixed(2)} disabled />
              <FormField label="Other Charges" name="otherCharges" onChange={() => ""} type="text" value={otherCharges.reduce((sum, c) => sum + (c.totalamount || 0), 0).toFixed(2)} disabled />

              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <FormField
                    label="Invoice Discount"
                    name="invoiceDiscount"
                    onChange={(e) => setInvoiceDiscount(e.target.value)}
                    type="number"
                    value={invoiceDiscount}
                  />
                </div>
                <select
                  className="border rounded p-2 text-sm h-10 mb-1"
                  value={invoiceDiscountType}
                  onChange={(e) => setInvoiceDiscountType(e.target.value)}
                >
                  <option value="amount">₹</option>
                  <option value="percent">%</option>
                </select>
              </div>

              <FormField
                label="Round Off"
                name="roundOff"
                onChange={(e) => setRoundOff(e.target.value)}
                type="number"
                value={roundOff}
              />

              <FormField label="Refund Amount" name="totalAmount" onChange={() => ""} type="text" value={totals.totalamount.toFixed(2)} disabled />
            </div>
          </fieldset>

          <div className="mt-6 flex gap-4 justify-end">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" variant="outline" disabled={lines.length === 0 || lines.every((l) => Number(l.qty) <= 0)}>
              {isEdit ? "Update Return" : "Save Return"}
            </Button>
          </div>
        </form>
      </div>
    </HomeLayout>
  );
};

export default AddEditSalesReturn;
