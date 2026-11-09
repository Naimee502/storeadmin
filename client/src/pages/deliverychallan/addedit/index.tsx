import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import FormField from "../../../components/formfiled";
import FormPage from "../../../components/formpage";
import ProductSection from "../../../components/productsection";
import type { InvoiceProduct } from "../../../components/productsection";
import HomeLayout from "../../../layouts/home";
import { useAccountsLiteQuery } from "../../../graphql/hooks/accounts";
import { useProductServicesQuery } from "../../../graphql/hooks/products";
import { useSalesOrderByIDQuery } from "../../../graphql/hooks/salesorder";
import { useSalesInvoiceByIDQuery } from "../../../graphql/hooks/salesinvoice";
import { useDeliveryChallanByIdQuery, useDeliveryChallanMutations } from "../../../graphql/hooks/deliverychallan";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";
import { partyLabel } from "../../../utils/partylabel";
import { todayYMD } from "../../../utils/helper";
import { BRANCH_REQUIRED } from "../../../utils/branch";
import { OFFLINE_SAVED_MESSAGE, OfflineNumberNote, isOfflineSaved, savedOffline, useOfflineNumber, useOfflineStock } from "../../../offline/billing";
import { CHALLAN_REASONS, challanNo } from "..";

const idOf = (v: any) => (v && typeof v === "object" ? v.id : v) || null;

// Order / invoice / saved challan lines in the shape ProductSection edits.
const toLines = (lines: any[] = []): InvoiceProduct[] =>
  lines.map((p: any) => ({
    productserviceid: idOf(p.productserviceid) || "",
    variantid: idOf(p.variantid),
    salesunitid: idOf(p.salesunitid),
    productname: `${p.productserviceid?.name || ""}${p.variantid?.name ? ` - ${p.variantid.name}` : ""}`,
    unitquantity: p.unitqty ?? 1,
    quantity: p.qty ?? 0,
    rate: p.rate ?? 0,
    total: p.amount ?? 0,
    discount: p.discount ?? 0,
    gst: p.gst ?? 0,
    selectedUnitValue: p.salesunitid && p.unitqty ? `${idOf(p.salesunitid)}--${p.unitqty}` : null,
  })) as any;

const AddEditDeliveryChallan = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const query = new URLSearchParams(useLocation().search);
  const from = query.get("from");
  const sourceId = query.get("id");
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { addDeliveryChallanMutation, editDeliveryChallanMutation } = useDeliveryChallanMutations();
  // Business Settings → Business Form Permissions → Delivery Challan Fields.
  const formPerms = useAppSelector((s) => s.permissions.permissions?.formPermissions?.deliverychallan || {});
  const on = (field: string) => formPerms[field] !== false;

  const { type, branch, staff } = useAppSelector((s) => s.auth);
  const selectedBranchId = useAppSelector((s) => s.selectedBranch.branchId);
  const branchId = type === "admin" ? selectedBranchId : type === "branch" ? branch?.id : staff?.branchid?.id || selectedBranchId;

  const [party, setParty] = useState<any>(null);
  const [billDate, setBillDate] = useState(todayYMD());
  const [billNumber, setBillNumber] = useState("");
  const [reason, setReason] = useState("sale");
  const [products, setProducts] = useState<InvoiceProduct[]>([]);
  const [transport, setTransport] = useState({ transportname: "", vehiclenumber: "", ewaybillno: "", distance: "" as any, deliverydate: "" });
  const [notes, setNotes] = useState("");
  const [source, setSource] = useState<{ sourceorderid?: string | null; sourceinvoiceid?: string | null; label?: string }>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Local-first: the order or invoice is read from this device when offline.
  const { data: own } = useDeliveryChallanByIdQuery(id);
  const { data: orderData } = useSalesOrderByIDQuery(from === "order" ? sourceId || "" : "");
  const { data: invoiceData } = useSalesInvoiceByIDQuery(from === "invoice" ? sourceId || "" : "");
  const { number: offlineNo, noDevice } = useOfflineNumber("deliverychallan", !isEdit);

  const { data: accountData } = useAccountsLiteQuery();
  const accounts = accountData?.getAccounts || [];
  const accountOptions = accounts.map((a: any) => ({ value: a.id, label: partyLabel(a) }));
  const { data: productData } = useProductServicesQuery();
  const productList = useOfflineStock(productData?.getProductServices ?? [], branchId);

  const fill = (doc: any) => {
    setParty(doc.partyacc ? { id: doc.partyacc.id, ...doc.partyacc } : null);
    setProducts(toLines(doc.productservice));
    setTransport({
      transportname: doc.transportname || "", vehiclenumber: doc.vehiclenumber || "", ewaybillno: doc.ewaybillno || "",
      distance: doc.distance ?? "", deliverydate: doc.deliverydate || "",
    });
  };

  useEffect(() => {
    const c = own?.getDeliveryChallanById;
    if (isEdit && c) {
      fill(c);
      setBillDate(c.billdate || todayYMD());
      setBillNumber(challanNo(c));
      setReason(c.reason || "sale");
      setNotes(c.notes || "");
      setSource({ sourceorderid: c.sourceorderid, sourceinvoiceid: c.sourceinvoiceid,
        label: c.sourceInvoiceNumber ? `Invoice ${c.sourceInvoiceNumber}` : c.sourceOrderNumber ? `Order SO-${c.sourceOrderNumber}` : "" });
    }
  }, [isEdit, own]);

  useEffect(() => {
    const o = orderData?.getSalesOrderById;
    if (!isEdit && o) {
      fill(o);
      setSource({ sourceorderid: o.id, label: `Order SO-${o.billnumber}` });
    }
  }, [isEdit, orderData]);

  useEffect(() => {
    const inv = invoiceData?.getSalesInvoiceById;
    if (!isEdit && inv) {
      fill(inv);
      setSource({ sourceinvoiceid: inv.id, sourceorderid: inv.sourceorderid || null, label: `Invoice ${inv.billnumber}` });
    }
  }, [isEdit, invoiceData]);

  useEffect(() => {
    if (!isEdit) setBillNumber(offlineNo || "");
  }, [isEdit, offlineNo]);

  const totals = useMemo(() => {
    let subtotal = 0, discount = 0, gst = 0, amount = 0;
    for (const p of products as any[]) {
      const qty = Number(p.quantity || 0), rate = Number(p.rate || 0), disc = Number(p.discount || 0);
      const taxable = (rate - disc) * qty;
      const g = (taxable * Number(p.gst || 0)) / 100;
      subtotal += qty * rate;
      discount += disc * qty;
      gst += g;
      amount += taxable + g;
    }
    return { subtotal, discount, gst, amount };
  }, [products]);

  const save = async () => {
    const e: Record<string, string> = {};
    if (!party?.id) e.party = "Party is required";
    if (!billDate) e.billDate = "Date is required";
    if (!products.length) e.products = "Add at least one item";
    setErrors(e);
    if (Object.keys(e).length) return;
    if (!branchId && !source.sourceorderid && !source.sourceinvoiceid) {
      dispatch(showMessage({ message: BRANCH_REQUIRED, type: "error" }));
      return;
    }
    const input: any = {
      partyacc: party.id,
      billdate: billDate,
      reason,
      notes,
      branchid: branchId || undefined,
      sourceorderid: source.sourceorderid || undefined,
      sourceinvoiceid: source.sourceinvoiceid || undefined,
      subtotal: totals.subtotal,
      totaldiscount: totals.discount,
      totalgst: totals.gst,
      totalamount: totals.amount,
      transportname: transport.transportname,
      vehiclenumber: transport.vehiclenumber,
      ewaybillno: transport.ewaybillno,
      distance: transport.distance === "" ? null : Number(transport.distance),
      deliverydate: transport.deliverydate,
      productservice: (products as any[]).map((p) => ({
        productserviceid: p.productserviceid,
        variantid: p.variantid,
        salesunitid: p.salesunitid,
        unitqty: p.unitquantity ?? 1,
        qty: Number(p.quantity || 0),
        rate: Number(p.rate || 0),
        discount: Number(p.discount || 0),
        gst: Number(p.gst || 0),
        amount: Number(p.total || 0),
      })),
    };
    if (!isEdit && offlineNo) input.billnumber = offlineNo;
    setSaving(true);
    try {
      if (isEdit && id) {
        const r = await editDeliveryChallanMutation({ variables: { id, input, expectedUpdatedAt: own?.getDeliveryChallanById?.updatedAt } });
        dispatch(showMessage({ message: savedOffline(r?.data?.editDeliveryChallan) ? OFFLINE_SAVED_MESSAGE : "Challan updated.", type: "success" }));
      } else {
        const r = await addDeliveryChallanMutation({ variables: { input } });
        dispatch(showMessage({ message: isOfflineSaved(r?.data?.addDeliveryChallan) ? OFFLINE_SAVED_MESSAGE : "Challan saved.", type: "success" }));
      }
      navigate("/deliverychallan");
    } catch (err: any) {
      dispatch(showMessage({ message: err?.message || "Could not save the challan.", type: "error" }));
    } finally {
      setSaving(false);
    }
  };

  const setT = (k: keyof typeof transport) => (ev: any) => setTransport((t) => ({ ...t, [k]: ev.target.value }));

  return (
    <HomeLayout>
      <FormPage
        breadcrumb="Delivery Challans"
        title={isEdit ? "Edit Delivery Challan" : "Add Delivery Challan"}
        onSave={save}
        onCancel={() => navigate(-1)}
        saveLabel={isEdit ? "Update Challan" : "Save Challan"}
        saveDisabled={saving}
      >
        <form onSubmit={(ev) => ev.preventDefault()} className="space-y-6">
          <fieldset className="border rounded-xl p-4 space-y-4">
            <legend className="text-sm font-medium px-2">Challan Details</legend>
            {source.label && (
              <p className="text-[13px] text-slate-600">
                Against <span className="font-semibold text-slate-800">{source.label}</span>
                {source.sourceinvoiceid ? " — stock was already taken out by the invoice." : " — stock goes out with this challan."}
              </p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {on("partyacc") && <FormField
                label="Party (Consignee)"
                name="party"
                type="select"
                value={party?.id || ""}
                onChange={(ev: any) => {
                  const a = accounts.find((x: any) => x.id === ev.target.value);
                  setParty(a ? { id: a.id, ...a } : null);
                }}
                options={accountOptions}
                error={errors.party}
                searchable
              />}
              {on("billdate") && <FormField label="Challan Date" name="billDate" type="date" value={billDate} onChange={(ev: any) => setBillDate(ev.target.value)} error={errors.billDate} />}
              {on("billnumber") && <FormField label="Challan No." name="billNumber" type="text" value={billNumber || (isEdit ? "" : "Auto")} onChange={() => {}} disabled />}
              {on("reason") && <FormField
                label="Reason"
                name="reason"
                type="select"
                value={reason}
                onChange={(ev: any) => setReason(ev.target.value)}
                options={CHALLAN_REASONS}
                disabled={!!source.sourceorderid || !!source.sourceinvoiceid}
              />}
              <OfflineNumberNote show={!isEdit && noDevice} />
            </div>
            {errors.products && <p className="text-[12px] text-rose-600">{errors.products}</p>}
          </fieldset>

          <ProductSection
            permissionModuleId="deliverychallan"
            products={products}
            setProducts={setProducts}
            productData={productList}
            invoiceHistory={[]}
            partyAccount={party}
            type="sales"
            navigate={navigate}
            iservice={false}
          />

          <fieldset className="border rounded-xl p-4">
            <legend className="text-sm font-medium px-2">Transport</legend>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {on("transportname") && <FormField label="Transport Name" name="transportname" type="text" value={transport.transportname} onChange={setT("transportname")} />}
              {on("vehiclenumber") && <FormField label="Vehicle Number" name="vehiclenumber" type="text" value={transport.vehiclenumber} onChange={setT("vehiclenumber")} />}
              {on("ewaybillno") && <FormField label="E-Way Bill No." name="ewaybillno" type="text" value={transport.ewaybillno} onChange={setT("ewaybillno")} />}
              {on("distance") && <FormField label="Distance (km)" name="distance" type="number" value={transport.distance} onChange={setT("distance")} />}
              {on("deliverydate") && <FormField label="Delivery Date" name="deliverydate" type="date" value={transport.deliverydate} onChange={setT("deliverydate")} />}
            </div>
            {on("notes") && <div className="mt-4">
              <FormField label="Notes" name="notes" type="text" value={notes} onChange={(ev: any) => setNotes(ev.target.value)} />
            </div>}
            <p className="mt-3 text-[13px] text-slate-600">
              Value of goods: <span className="font-semibold text-slate-900">₹{totals.amount.toFixed(2)}</span>
              {totals.amount > 50000 && <span className="ml-2 text-amber-700">Above ₹50,000 — an e-way bill is needed.</span>}
            </p>
          </fieldset>
        </form>
      </FormPage>
    </HomeLayout>
  );
};

export default AddEditDeliveryChallan;
