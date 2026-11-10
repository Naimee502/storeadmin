import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import FormField from "../../../components/formfiled";
import FormPage from "../../../components/formpage";
import ProductSection from "../../../components/productsection";
import type { InvoiceProduct } from "../../../components/productsection";
import HomeLayout from "../../../layouts/home";
import { useAccountsLiteQuery } from "../../../graphql/hooks/accounts";
import { useProductServicesQuery } from "../../../graphql/hooks/products";
import { useLeadByIdQuery, useLeadsQuery } from "../../../graphql/hooks/lead";
import { quotationNo, useQuotationByIdQuery, useQuotationMutations } from "../../../graphql/hooks/quotation";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";
import { partyLabel } from "../../../utils/partylabel";
import { stateOptions } from "../../../utils/constants";
import { gstSplit, todayYMD } from "../../../utils/helper";
import { OFFLINE_SAVED_MESSAGE, OfflineNumberNote, isOfflineSaved, savedOffline, useOfflineNumber, useOfflineStock } from "../../../offline/billing";

type Line = InvoiceProduct & { description?: string; optional?: boolean };
const idOf = (v: any) => (v && typeof v === "object" ? v.id : v) || null;
const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

// Saved lines (quotation, or a lead's products of interest) in the shape ProductSection edits.
const toLines = (lines: any[] = []): Line[] =>
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
    description: p.description || "",
    optional: !!p.optional,
  })) as any;

const AddEditQuotation = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const leadId = new URLSearchParams(useLocation().search).get("leadId");
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { addQuotation, editQuotation } = useQuotationMutations();
  const settings = useAppSelector((s: any) => s.adminsettings.settings);
  // Business Settings → Business Form Permissions → Quotation Fields.
  const formPerms = useAppSelector((s) => s.permissions.permissions?.formPermissions?.quotations || {});
  const on = (field: string) => formPerms[field] !== false;

  const { type, branch, staff } = useAppSelector((s) => s.auth);
  const selectedBranchId = useAppSelector((s) => s.selectedBranch.branchId);
  const branchId = type === "admin" ? selectedBranchId : type === "branch" ? branch?.id : staff?.branchid?.id || selectedBranchId;

  const validity = Number(settings?.quoteValidityDays) > 0 ? Number(settings.quoteValidityDays) : 15;
  const [party, setParty] = useState<any>(null);
  const [lead, setLead] = useState<any>(null);
  const [cust, setCust] = useState({ customername: "", customermobile: "", customeraddress: "", customercity: "", customerstate: "", customergstin: "" });
  const [f, setF] = useState({ billdate: todayYMD(), validtill: addDays(todayYMD(), validity), subject: "", contactperson: "", intro: "", terms: settings?.quoteTerms || "", notes: "" });
  const [products, setProducts] = useState<Line[]>([]);
  const [billNumber, setBillNumber] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: any) => setF((x) => ({ ...x, [k]: e.target.value }));
  const setC = (k: keyof typeof cust) => (e: any) => setCust((x) => ({ ...x, [k]: e.target.value }));

  const { data: own } = useQuotationByIdQuery(id);
  const { data: leadData } = useLeadByIdQuery(!isEdit ? leadId : null);
  const { data: leadsData } = useLeadsQuery();
  const { number: offlineNo, noDevice } = useOfflineNumber("quotation", !isEdit);
  const { data: accountData } = useAccountsLiteQuery();
  const accounts = accountData?.getAccounts || [];
  const accountOptions = accounts.map((a: any) => ({ value: a.id, label: partyLabel(a) }));
  const leadOptions = (leadsData?.getLeads || []).map((l: any) => ({ value: l.id, label: [l.name, l.company, l.mobile, l.city].filter(Boolean).join(" - ") }));
  const { data: productData } = useProductServicesQuery();
  const productList = useOfflineStock(productData?.getProductServices ?? [], branchId);

  const fillLead = (l: any) => {
    if (!l) return;
    setLead({ id: l.id, name: l.name });
    if (l.partyid?.id) {
      const a = accounts.find((x: any) => x.id === l.partyid.id);
      setParty(a ? { id: a.id, ...a } : { id: l.partyid.id, name: l.partyid.name });
    }
    setCust({
      customername: l.company || l.name || "", customermobile: l.mobile || "", customeraddress: l.address || "",
      customercity: l.city || "", customerstate: l.state || "", customergstin: l.gstin || "",
    });
    setF((x) => ({ ...x, contactperson: l.company ? l.name : x.contactperson, subject: x.subject || (l.requirement || "").slice(0, 80) }));
  };

  // Edit: fill once.
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const q = own?.getQuotationById;
    if (!isEdit || !q || filled) return;
    setFilled(true);
    setParty(q.partyacc ? { id: q.partyacc.id, ...q.partyacc } : null);
    setLead(q.leadid ? { id: q.leadid.id, name: q.leadid.name } : null);
    setCust({
      customername: q.customername || "", customermobile: q.customermobile || "", customeraddress: q.customeraddress || "",
      customercity: q.customercity || "", customerstate: q.customerstate || "", customergstin: q.customergstin || "",
    });
    setF({ billdate: q.billdate || todayYMD(), validtill: q.validtill || "", subject: q.subject || "", contactperson: q.contactperson || "", intro: q.intro || "", terms: q.terms || "", notes: q.notes || "" });
    setProducts(toLines(q.productservice));
    setBillNumber(quotationNo(q));
  }, [isEdit, own, filled]);

  // From a lead: its contact and products of interest (rates come from the product).
  useEffect(() => {
    const l = leadData?.getLeadById;
    if (isEdit || !l || filled) return;
    setFilled(true);
    fillLead(l);
    const lines = (l.products || []).filter((p: any) => p.productid?.id).map((p: any) => {
      const prod = productList.find((x: any) => x.id === p.productid.id);
      const v = prod?.productvariants?.find((x: any) => x.id === p.variantid) || prod?.productvariants?.[0];
      const up = (v?.unitprices || []).find((u: any) => (u.unitid?.id ?? u.unitid) === p.unitid?.id && Number(u.quantity) === Number(p.unitqty || 1)) || v?.unitprices?.[0];
      const rate = Number(up?.salesrate || 0);
      const qty = Number(p.qty || 1);
      const gst = Number(v?.gst || 0);
      return {
        productserviceid: p.productid.id, variantid: v?.id || null, salesunitid: up?.unitid?.id ?? up?.unitid ?? p.unitid?.id ?? null,
        productname: `${p.productid.name}${v?.name ? ` - ${v.name}` : ""}`, unitquantity: up?.quantity ?? p.unitqty ?? 1,
        quantity: qty, rate, discount: 0, gst, total: rate * qty * (1 + gst / 100),
        selectedUnitValue: up ? `${up.unitid?.id ?? up.unitid}--${up.quantity}` : null, description: p.note || "", optional: false,
      } as Line;
    });
    if (lines.length) setProducts(lines);
  }, [isEdit, leadData, productList.length, filled]);

  useEffect(() => {
    if (!isEdit) setBillNumber(offlineNo || "");
  }, [isEdit, offlineNo]);
  useEffect(() => {
    if (!isEdit && settings?.quoteTerms) setF((x) => (x.terms ? x : { ...x, terms: settings.quoteTerms }));
  }, [isEdit, settings?.quoteTerms]);

  // Optional lines are shown to the customer but stay out of the total.
  const totals = useMemo(() => {
    let subtotal = 0, discount = 0, gst = 0, amount = 0;
    for (const p of products) {
      if (p.optional) continue;
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

  const editLine = (i: number, patch: Partial<Line>) => setProducts((ps) => ps.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const save = async () => {
    const e: Record<string, string> = {};
    if (!party?.id && !lead?.id && !cust.customername.trim()) e.party = "Pick a party or a lead, or type the customer name";
    if (!f.billdate) e.billdate = "Date is required";
    if (!products.length) e.products = "Add at least one item";
    setErrors(e);
    if (Object.keys(e).length) return;
    const input: any = {
      partyacc: party?.id || null,
      leadid: lead?.id || null,
      ...cust,
      billdate: f.billdate,
      validtill: f.validtill || null,
      subject: f.subject,
      contactperson: f.contactperson,
      intro: f.intro,
      terms: f.terms,
      notes: f.notes,
      branchid: branchId || undefined,
      subtotal: totals.subtotal,
      totaldiscount: totals.discount,
      totalgst: totals.gst,
      totalamount: totals.amount,
      productservice: products.map((p) => ({
        productserviceid: p.productserviceid || null,
        variantid: p.variantid || null,
        salesunitid: p.salesunitid || null,
        unitqty: p.unitquantity ?? 1,
        qty: Number(p.quantity || 0),
        rate: Number(p.rate || 0),
        discount: Number(p.discount || 0),
        gst: Number(p.gst || 0),
        amount: Number(p.total || 0),
        description: p.description || undefined,
        optional: p.optional || undefined,
      })),
    };
    if (!isEdit && offlineNo) input.billnumber = offlineNo;
    setSaving(true);
    try {
      if (isEdit && id) {
        const r = await editQuotation({ variables: { id, input, expectedUpdatedAt: own?.getQuotationById?.updatedAt } });
        dispatch(showMessage({ message: savedOffline(r?.data?.editQuotation) ? OFFLINE_SAVED_MESSAGE : "Quotation updated.", type: "success" }));
      } else {
        const r = await addQuotation({ variables: { input } });
        dispatch(showMessage({ message: isOfflineSaved(r?.data?.addQuotation) ? OFFLINE_SAVED_MESSAGE : "Quotation saved.", type: "success" }));
      }
      navigate(leadId ? `/leads/addedit/${leadId}` : "/quotations");
    } catch (err: any) {
      dispatch(showMessage({ message: err?.message || "Could not save the quotation.", type: "error" }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <HomeLayout>
      <FormPage
        breadcrumb="Quotations"
        title={isEdit ? `Edit ${billNumber}` : "Add Quotation"}
        onSave={save}
        onCancel={() => navigate(-1)}
        saveLabel={isEdit ? "Update Quotation" : "Save Quotation"}
        saveDisabled={saving}
      >
        <form onSubmit={(ev) => ev.preventDefault()} className="space-y-6">
          <fieldset className="border rounded-xl p-4 space-y-4">
            <legend className="text-sm font-medium px-2">Customer</legend>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <FormField label="Party" name="party" type="select" searchable options={accountOptions} value={party?.id || ""} error={errors.party}
                  onChange={(ev: any) => {
                    const a = accounts.find((x: any) => x.id === ev.target.value);
                    setParty(a ? { id: a.id, ...a } : null);
                  }} />
              </div>
              <div className="md:col-span-2">
                <FormField label="Lead (not yet a party)" name="lead" type="select" searchable options={leadOptions} value={lead?.id || ""}
                  onChange={(ev: any) => {
                    const l = (leadsData?.getLeads || []).find((x: any) => x.id === ev.target.value);
                    if (l) fillLead(l);
                    else setLead(null);
                  }} />
              </div>
            </div>
            {!party?.id && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <FormField label="Customer Name" name="customername" type="text" value={cust.customername} onChange={setC("customername")} />
                <FormField label="Mobile" name="customermobile" type="tel" value={cust.customermobile} onChange={setC("customermobile")} />
                <FormField label="City" name="customercity" type="text" value={cust.customercity} onChange={setC("customercity")} />
                <FormField label="State" name="customerstate" type="select" searchable options={stateOptions} value={cust.customerstate} onChange={setC("customerstate")} />
                <FormField label="GSTIN" name="customergstin" type="text" value={cust.customergstin} onChange={(e: any) => setCust((x) => ({ ...x, customergstin: String(e.target.value).toUpperCase() }))} />
                <div className="md:col-span-4">
                  <FormField label="Address" name="customeraddress" type="text" value={cust.customeraddress} onChange={setC("customeraddress")} />
                </div>
              </div>
            )}
          </fieldset>

          <fieldset className="border rounded-xl p-4 space-y-4">
            <legend className="text-sm font-medium px-2">Quotation Details</legend>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <FormField label="Quotation No." name="billNumber" type="text" value={billNumber || (isEdit ? "" : "Auto")} onChange={() => {}} disabled />
              {on("billdate") && <FormField label="Quotation Date" name="billdate" type="date" value={f.billdate} onChange={set("billdate")} error={errors.billdate} />}
              {on("validtill") && <FormField label="Valid Till" name="validtill" type="date" value={f.validtill} onChange={set("validtill")} />}
              {on("contactperson") && <FormField label="Kind Attention" name="contactperson" type="text" value={f.contactperson} onChange={set("contactperson")} />}
              {on("subject") && <div className="md:col-span-4"><FormField label="Subject" name="subject" type="text" value={f.subject} onChange={set("subject")} placeholder="e.g. Quotation for 250 kVA transformer" /></div>}
              <OfflineNumberNote show={!isEdit && noDevice} />
            </div>
            {on("intro") && <FormField label="Opening Text" name="intro" type="text" multiline value={f.intro} onChange={set("intro")} placeholder={settings?.quoteIntro || "Thank you for your enquiry. We are pleased to quote as below:"} />}
            {errors.products && <p className="text-[12px] text-rose-600">{errors.products}</p>}
          </fieldset>

          <ProductSection
            permissionModuleId="quotations"
            products={products}
            setProducts={setProducts as any}
            productData={productList}
            invoiceHistory={[]}
            partyAccount={party}
            type="sales"
            navigate={navigate}
            iservice={false}
          />

          {products.length > 0 && (on("description") || on("optional")) && (
            <fieldset className="border rounded-xl p-4 space-y-2">
              <legend className="text-sm font-medium px-2">Line Details</legend>
              {products.map((p, i) => (
                <div key={i} className="grid grid-cols-12 items-center gap-2 text-[13px]">
                  <div className="col-span-12 truncate font-medium text-slate-700 md:col-span-3" title={p.productname}>{i + 1}. {p.productname}</div>
                  {on("description") && (
                    <input className="col-span-10 h-8 rounded-md border border-slate-300 px-2 md:col-span-7" value={p.description || ""} placeholder="Specs / scope, printed under the item"
                      onChange={(e) => editLine(i, { description: e.target.value })} />
                  )}
                  {on("optional") && (
                    <label className="col-span-2 flex items-center gap-1.5 text-slate-600">
                      <input type="checkbox" checked={!!p.optional} onChange={(e) => editLine(i, { optional: e.target.checked })} /> Optional
                    </label>
                  )}
                </div>
              ))}
            </fieldset>
          )}

          <fieldset className="border rounded-xl p-4 space-y-4">
            <legend className="text-sm font-medium px-2">Terms &amp; Total</legend>
            {on("terms") && <FormField label="Terms & Conditions" name="terms" type="text" multiline value={f.terms} onChange={set("terms")} />}
            {on("notes") && <FormField label="Internal Notes (not printed)" name="notes" type="text" value={f.notes} onChange={set("notes")} />}
            <div className="flex flex-wrap justify-end gap-6 text-[13px] text-slate-600">
              <span>Sub Total ₹{totals.subtotal.toFixed(2)}</span>
              <span>Discount ₹{totals.discount.toFixed(2)}</span>
              {/* Same rule as the bills: other state = IGST, same state = CGST + SGST. */}
              {(() => {
                const t = gstSplit(settings?.companyState, party?.id ? party.state : cust.customerstate, totals.gst);
                return t.inter
                  ? <span>IGST ₹{t.igst.toFixed(2)}</span>
                  : <><span>CGST ₹{t.cgst.toFixed(2)}</span><span>SGST ₹{t.sgst.toFixed(2)}</span></>;
              })()}
              <span className="font-semibold text-slate-900">Grand Total ₹{totals.amount.toFixed(2)}</span>
            </div>
          </fieldset>
        </form>
      </FormPage>
    </HomeLayout>
  );
};

export default AddEditQuotation;
