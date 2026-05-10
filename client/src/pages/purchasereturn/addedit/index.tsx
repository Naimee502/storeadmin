// Add / Edit a Purchase Return (Debit Note).
// Same structure as Sales Return — see salesreturn/addedit for line comments.

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router";
import HomeLayout from "../../../layouts/home";
import FormField from "../../../components/formfiled";
import Button from "../../../components/button";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";
import {
  usePurchaseReturnByIDQuery,
  usePurchaseReturnMutations,
} from "../../../graphql/hooks/purchasereturn";
import {
  usePurchaseInvoicesQuery,
  usePurchaseInvoiceByIDQuery,
} from "../../../graphql/hooks/purchaseinvoice";

type Line = {
  productserviceid: string;
  productName: string;
  variantid?: string;
  variantName?: string;
  purchaseunitid?: string;
  unitqty: number;
  gst: number;
  rate: number;
  discount: number;
  qty: number;
  originalQty: number;
  amount: number;
};

const todayStr = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const AddEditPurchaseReturn: React.FC = () => {
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

  const [sourceInvoiceId, setSourceInvoiceId] = useState(fromInvoiceParam || "");

  const [returndate, setReturndate] = useState(todayStr());
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [refundMode, setRefundMode] = useState("auto");
  const [paymentType, setPaymentType] = useState("");
  const [partyacc, setPartyacc] = useState<any>(null);
  const [billtype, setBilltype] = useState("");
  const [taxorsupplytype, setTaxOrSupplyType] = useState("");
  const [invoicetype, setInvoiceType] = useState("regular");
  const [isservice, setIsService] = useState(false);
  const [autocreate, setAutoCreate] = useState(true);
  const [lines, setLines] = useState<Line[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: existingData } = usePurchaseReturnByIDQuery(id || "");
  const { data: sourceInvData } = usePurchaseInvoiceByIDQuery(sourceInvoiceId || "");
  const { data: invoicesData } = usePurchaseInvoicesQuery();

  const invoiceOptions = useMemo(
    () =>
      (invoicesData?.getPurchaseInvoices ?? []).map((inv: any) => ({
        value: inv.id,
        label: `INV-${inv.billnumber} · ${inv.partyacc?.accountname ?? "?"} · ₹${inv.totalamount}`,
      })),
    [invoicesData]
  );

  const { addPurchaseReturnMutation, editPurchaseReturnMutation } = usePurchaseReturnMutations();

  // Hydrate from existing return
  useEffect(() => {
    if (!isEdit) return;
    const ret = existingData?.getPurchaseReturnById;
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
    setInvoiceType(ret.invoicetype || "regular");
    setIsService(!!ret.isservice);
    setAutoCreate(ret.autocreate ?? true);
    setLines(
      (ret.productservice ?? []).map((p: any) => ({
        productserviceid: p.productserviceid?.id ?? p.productserviceid,
        productName: p.productserviceid?.name ?? "Item",
        variantid: p.variantid?.id ?? undefined,
        variantName: p.variantid?.name,
        purchaseunitid: p.purchaseunitid?.id,
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

  // Hydrate from source invoice
  useEffect(() => {
    if (isEdit) return;
    const inv = sourceInvData?.getPurchaseInvoiceById;
    if (!inv) return;

    setReturndate(todayStr());
    setPaymentType(inv.paymenttype || "");
    setPartyacc(inv.partyacc);
    setBilltype(inv.billtype || "");
    setTaxOrSupplyType(inv.taxorsupplytype || "");
    setInvoiceType(inv.invoicetype || "regular");
    setIsService(!!inv.isservice);

    setLines(
      (inv.productservice ?? []).map((p: any) => ({
        productserviceid: p.productserviceid?.id ?? p.productserviceid,
        productName: p.productserviceid?.name ?? "Item",
        variantid: p.variantid?.id ?? undefined,
        variantName: p.variantid?.name,
        purchaseunitid: p.purchaseunitid?.id,
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

  const updateLine = (idx: number, field: keyof Line, value: any) => {
    setLines((prev) => {
      const next = [...prev];
      const line = { ...next[idx], [field]: value };
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
    const totalamount = subtotal + totalgst;
    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      totaldiscount: parseFloat(totaldiscount.toFixed(2)),
      totalgst: parseFloat(totalgst.toFixed(2)),
      totalamount: parseFloat(totalamount.toFixed(2)),
    };
  }, [lines]);

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
    const filteredLines = lines.filter((l) => Number(l.qty) > 0);

    const input: any = {
      sourceInvoiceId,
      paymenttype: paymentType,
      partyacc: partyacc?.id,
      taxorsupplytype: taxorsupplytype || "exclusive",
      returndate,
      billtype: billtype || "tax",
      notes: notes || undefined,
      reason: reason || undefined,
      refundMode,
      invoicetype: invoicetype || "regular",
      subtotal: totals.subtotal,
      totaldiscount: totals.totaldiscount,
      totalgst: totals.totalgst,
      totalamount: totals.totalamount,
      adminid: adminId,
      branchid: branchId,
      isservice,
      autocreate,
      createdby_id: creator.id,
      createdby_name: creator.name,
      createdby_type: creator.type,
      productservice: filteredLines.map((l) => ({
        productserviceid: l.productserviceid,
        variantid: l.variantid || undefined,
        purchaseunitid: l.purchaseunitid || undefined,
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
        await editPurchaseReturnMutation({ variables: { id, input } });
        dispatch(showMessage({ message: "Purchase return updated.", type: "success" }));
      } else {
        await addPurchaseReturnMutation({ variables: { input } });
        dispatch(showMessage({ message: "Purchase return saved.", type: "success" }));
      }
      navigate("/purchasereturn");
    } catch (err: any) {
      dispatch(
        showMessage({
          message: err?.message || "Failed to save purchase return",
          type: "error",
        })
      );
    }
  };

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <h1 className="text-xl font-semibold mb-4">
          {isEdit ? "Edit Purchase Return" : "Add Purchase Return (Debit Note)"}
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
                { value: "advance", label: "Hold as Vendor Advance" },
                { value: "skip", label: "Skip — journal entry only" },
              ]}
              value={refundMode}
              onChange={(e: any) => setRefundMode(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <FormField label="Reason" name="reason" value={reason}
              onChange={(e: any) => setReason(e.target.value)} placeholder="Damaged, wrong item, etc." />
            <FormField label="Notes" name="notes" value={notes}
              onChange={(e: any) => setNotes(e.target.value)} />
          </div>

          {partyacc && (
            <div className="mt-3 text-sm text-gray-600">
              <span className="font-medium">Vendor:</span>{" "}
              {partyacc.accountname} {partyacc.mobile ? `· ${partyacc.mobile}` : ""}
              {paymentType && (
                <span className="ml-3">
                  <span className="font-medium">Payment Type:</span> {paymentType}
                </span>
              )}
            </div>
          )}
        </div>

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

        {errors.lines && <div className="text-red-600 text-sm mt-2">{errors.lines}</div>}

        <div className="flex justify-end mt-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4 w-full sm:w-80 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>₹ {totals.subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Total Discount</span><span>₹ {totals.totaldiscount.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Total GST</span><span>₹ {totals.totalgst.toFixed(2)}</span></div>
            <div className="flex justify-between font-semibold border-t pt-2 mt-2">
              <span>Refund Amount</span><span>₹ {totals.totalamount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={() => navigate("/purchasereturn")}>Cancel</Button>
          <Button variant="outline" onClick={handleSubmit}>
            {isEdit ? "Update" : "Save"}
          </Button>
        </div>
      </div>
    </HomeLayout>
  );
};

export default AddEditPurchaseReturn;
