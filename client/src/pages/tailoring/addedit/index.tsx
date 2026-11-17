import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Plus, Trash2 } from "lucide-react";
import FormField from "../../../components/formfiled";
import FormPage from "../../../components/formpage";
import HomeLayout from "../../../layouts/home";
import { PartyQuickAdd } from "../../../components/posaddcustomer";
import { useAccountsLiteQuery } from "../../../graphql/hooks/accounts";
import { useProductServicesPickerQuery } from "../../../graphql/hooks/products";
import { useStaffListQuery } from "../../../graphql/hooks/staffaccounts";
import { addDaysYMD, useLatestMeasurementsQuery, useServiceBranch, useServiceMutations, useTailorOrderByIdQuery } from "../../../graphql/hooks/service";
import { useAddNew } from "../../../hooks/useaddnew";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";
import { partyLabel } from "../../../utils/partylabel";
import { formatDateDMY, todayYMD } from "../../../utils/helper";
import { FormRules } from "../../../hooks/useformmode";
import { useCompany } from "../../deliverychallan";
import { GARMENTS, printTailorSlip, tailorNo } from "..";

const idOf = (v: any) => (v && typeof v === "object" ? v.id : v) || "";
type Item = { garment: string; productserviceid: string; qty: string; rate: string; fabric: string; fabricnote: string; design: string; unit: string; values: Record<string, string>; extra: string[] };
const EMPTY: Item = { garment: "Shirt", productserviceid: "", qty: "1", rate: "", fabric: "own", fabricnote: "", design: "", unit: "inch", values: {}, extra: [] };

const AddEditTailorOrder = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const branchId = useServiceBranch();
  const settings = useAppSelector((s: any) => s.adminsettings.settings);
  const company = useCompany();
  const { addTailorOrder, editTailorOrder } = useServiceMutations();
  const { data: own } = useTailorOrderByIdQuery(id);
  const { data: accountData } = useAccountsLiteQuery();
  const partyOptions = useMemo(() => (accountData?.getAccounts || []).map((a: any) => ({ value: a.id, label: partyLabel(a) })), [accountData]);
  const { data: staffData } = useStaffListQuery();
  const { data: productData } = useProductServicesPickerQuery();
  const addService = useAddNew("/services/addedit", ["GetProductServices", "GetProductServicesPicker"]);
  const [partyOpen, setPartyOpen] = useState(false);
  const services = useMemo(() => (productData?.getProductServices || []).filter((p: any) => p.isservice), [productData]);
  const serviceOptions = useMemo(() => services.map((p: any) => ({ value: p.id, label: p.name })), [services]);
  const rateOf = (sid: string) => Number(services.find((p: any) => p.id === sid)?.servicevariants?.[0]?.servicerate || 0);

  const [f, setF] = useState<any>({ partyacc: "", customername: "", customermobile: "", billdate: todayYMD(), trialdate: "", deliverydate: addDaysYMD(todayYMD(), 7), staffid: "", notes: "" });
  const [items, setItems] = useState<Item[]>([{ ...EMPTY }]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [filled, setFilled] = useState(false);
  const set = (k: string) => (e: any) => setF((x: any) => ({ ...x, [k]: e.target.value }));
  const setItem = (i: number, patch: Partial<Item>) => setItems((list) => list.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  useEffect(() => {
    const o = own?.getTailorOrderById;
    if (!isEdit || !o || filled) return;
    setFilled(true);
    setF({ partyacc: idOf(o.partyacc), customername: o.customername || "", customermobile: o.customermobile || "", billdate: o.billdate, trialdate: o.trialdate || "",
      deliverydate: o.deliverydate || "", staffid: idOf(o.staffid), notes: o.notes || "" });
    setItems((o.items || []).map((i: any) => {
      const known = (GARMENTS[i.garment] || []).map(([k]) => k);
      const values = Object.fromEntries((i.values || []).map((v: any) => [v.key, v.value]));
      return { garment: i.garment, productserviceid: idOf(i.productserviceid), qty: String(i.qty), rate: String(i.rate ?? ""), fabric: i.fabric || "own",
        fabricnote: i.fabricnote || "", design: i.design || "", unit: i.unit || "inch", values, extra: Object.keys(values).filter((k) => !known.includes(k)) };
    }));
  }, [isEdit, own, filled]);

  // The customer's last measurements fill a garment's boxes (new orders, empty boxes only).
  const { data: latestData } = useLatestMeasurementsQuery(f.partyacc || null);
  const latest: any[] = latestData?.getLatestMeasurements || [];
  const fillFromLatest = (i: number, garment: string) => {
    const m = latest.find((x) => x.garment === garment);
    if (!m) return;
    const values = Object.fromEntries((m.values || []).map((v: any) => [v.key, v.value]));
    const known = (GARMENTS[garment] || []).map(([k]) => k);
    setItem(i, { values, unit: m.unit || "inch", extra: Object.keys(values).filter((k) => !known.includes(k)) });
  };
  useEffect(() => {
    if (isEdit || !latest.length) return;
    items.forEach((it, i) => { if (!Object.values(it.values).some(Boolean)) fillFromLatest(i, it.garment); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestData]);

  const total = items.reduce((t, i) => t + (Number(i.qty) || 0) * (Number(i.rate) || 0), 0);

  const toInput = () => ({
    partyacc: f.partyacc || null, customername: f.partyacc ? "" : f.customername.trim(), customermobile: f.partyacc ? "" : f.customermobile.trim(),
    billdate: f.billdate, trialdate: f.trialdate || null, deliverydate: f.deliverydate || null, staffid: f.staffid || null, notes: f.notes || undefined,
    branchid: branchId || undefined,
    items: items.map((i) => {
      const fields = [...(GARMENTS[i.garment] || []), ...i.extra.map((k) => [k, k] as [string, string])];
      return {
        garment: i.garment, productserviceid: i.productserviceid || null, qty: Number(i.qty) || 0, rate: Number(i.rate) || 0,
        fabric: i.fabric, fabricnote: i.fabricnote || undefined, design: i.design || undefined, unit: i.unit,
        values: fields.map(([key, label]) => ({ key, label, value: String(i.values[key] ?? "").trim() })).filter((v) => v.value),
      };
    }),
  });

  const save = async () => {
    const e: Record<string, string> = {};
    if (!f.partyacc && !f.customername.trim()) e.customer = "Pick a customer or type the name";
    if (!items.some((i) => i.garment && Number(i.qty) > 0)) e.items = "Add at least one garment";
    if (f.deliverydate && f.deliverydate < f.billdate) e.deliverydate = "Delivery is before the order date";
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      const input = toInput();
      const r = isEdit && id
        ? (await editTailorOrder({ variables: { id, input, expectedUpdatedAt: own?.getTailorOrderById?.updatedAt } }))?.data?.editTailorOrder
        : (await addTailorOrder({ variables: { input } }))?.data?.addTailorOrder;
      dispatch(showMessage({ message: `${tailorNo(r)} saved.`, type: "success" }));
      if (r && window.confirm("Print the order slip now?")) printTailorSlip(r, company, settings);
      navigate("/tailoring");
    } catch (err: any) {
      dispatch(showMessage({ message: err?.message || "Could not save the order.", type: "error" }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <HomeLayout>
      <FormPage breadcrumb="Tailoring" title={isEdit ? "Edit Stitching Order" : "New Stitching Order"} onSave={save} onCancel={() => navigate(-1)}
        saveLabel={isEdit ? "Update Order" : "Save Order"} saveDisabled={saving}>
        <form onSubmit={(ev) => ev.preventDefault()} className="space-y-6">
          <fieldset className="border rounded-xl p-4 space-y-4">
            <legend className="text-sm font-medium px-2">Customer &amp; Dates</legend>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <FormField label="Customer" name="partyacc" type="select" searchable addable onAddNew={() => setPartyOpen(true)} error={errors.customer} value={f.partyacc}
                  options={partyOptions} onChange={set("partyacc")} />
              </div>
              {!f.partyacc && <FormField label="Customer Name" name="customername" type="text" value={f.customername} onChange={set("customername")} />}
              {!f.partyacc && <FormField label="Mobile" name="customermobile" type="tel" value={f.customermobile} onChange={set("customermobile")} />}
              <FormField label="Order Date" name="billdate" type="date" value={f.billdate} onChange={set("billdate")} />
              <FormField label="Trial Date" name="trialdate" type="date" value={f.trialdate} onChange={set("trialdate")} />
              <FormField label="Delivery Date" name="deliverydate" type="date" value={f.deliverydate} error={errors.deliverydate} onChange={set("deliverydate")} />
              <FormField label="Tailor" name="staffid" type="select" searchable value={f.staffid} placeholder="Not assigned"
                options={(staffData?.getStaffAccounts || []).filter((s: any) => s.status !== false).map((s: any) => ({ value: s.id, label: s.name }))} onChange={set("staffid")} />
            </div>
          </fieldset>

          {items.map((it, i) => {
            const fields = [...(GARMENTS[it.garment] || []), ...it.extra.map((k) => [k, k] as [string, string])];
            const last = latest.find((m) => m.garment === it.garment);
            return (
              <fieldset key={i} className="border rounded-xl p-4 space-y-3">
                <legend className="text-sm font-medium px-2">Garment {i + 1}</legend>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
                  <FormField label="Garment" name={`garment_${i}`} type="select" searchable value={it.garment} options={Object.keys(GARMENTS).map((g) => ({ value: g, label: g }))}
                    onChange={(e: any) => { const g = e.target.value || "Shirt"; setItem(i, { garment: g, values: {}, extra: [] }); fillFromLatest(i, g); }} />
                  <div className="col-span-2">
                    <FormField label="Stitching Item" name={`service_${i}`} type="select" searchable addable onAddNew={addService} value={it.productserviceid}
                      options={serviceOptions}
                      onChange={(e: any) => setItem(i, { productserviceid: e.target.value, rate: it.rate || String(rateOf(e.target.value) || "") })} />
                  </div>
                  <FormField label="Qty" name={`qty_${i}`} type="number" value={it.qty} onChange={(e: any) => setItem(i, { qty: e.target.value })} />
                  <FormField label="Rate (₹)" name={`rate_${i}`} type="number" value={it.rate} onChange={(e: any) => setItem(i, { rate: e.target.value })} />
                  <FormField label="Fabric" name={`fabric_${i}`} type="select" searchable value={it.fabric}
                    options={[{ value: "own", label: "Customer's Own" }, { value: "shop", label: "From Shop" }]} onChange={(e: any) => setItem(i, { fabric: e.target.value || "own" })} />
                  <div className="col-span-2 md:col-span-3"><FormField label="Fabric Note" name={`fabricnote_${i}`} type="text" value={it.fabricnote} placeholder="Colour, metres" onChange={(e: any) => setItem(i, { fabricnote: e.target.value })} /></div>
                  <div className="col-span-2 md:col-span-3"><FormField label="Design" name={`design_${i}`} type="text" value={it.design} placeholder="Collar, pockets, buttons…" onChange={(e: any) => setItem(i, { design: e.target.value })} /></div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[12px] font-semibold text-slate-600">Measurements ({it.unit === "cm" ? "cm" : "inch"})</div>
                  <div className="flex items-center gap-2 text-[12px]">
                    {last && <button type="button" onClick={() => fillFromLatest(i, it.garment)} className="text-indigo-700 hover:underline">Use last ({formatDateDMY(last.takenon || last.createdAt)})</button>}
                    <select value={it.unit} onChange={(e) => setItem(i, { unit: e.target.value })} className="h-7 rounded border border-slate-300 px-1">
                      <option value="inch">Inch</option><option value="cm">Cm</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
                  {fields.map(([key, label]) => (
                    <FormField key={key} label={label} name={`m_${i}_${key}`} type="text" value={it.values[key] ?? ""} onChange={(e: any) => setItem(i, { values: { ...it.values, [key]: e.target.value } })} />
                  ))}
                  <div className="flex items-end">
                    <button type="button" onClick={() => { const k = window.prompt("Measurement name (e.g. Bicep)")?.trim(); if (k) setItem(i, { extra: [...new Set([...it.extra, k])] }); }}
                      className="h-8 w-full rounded-md border border-dashed border-slate-300 text-[12px] text-slate-600 hover:bg-slate-50">+ Add</button>
                  </div>
                </div>
                {items.length > 1 && (
                  <button type="button" onClick={() => setItems((l) => l.filter((_, j) => j !== i))} className="inline-flex items-center gap-1 text-[12px] text-rose-600 hover:underline"><Trash2 size={13} /> Remove garment</button>
                )}
              </fieldset>
            );
          })}
          {errors.items && <div className="text-sm text-red-600">{errors.items}</div>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={() => setItems((l) => [...l, { ...EMPTY }])}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 text-[13px] font-medium text-indigo-700 hover:bg-indigo-100"><Plus size={14} /> Add Garment</button>
            <div className="text-[14px] font-semibold text-slate-800">Total ₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <FormField label="Notes" name="notes" type="text" value={f.notes} onChange={set("notes")} />
          <p className="text-[12px] text-slate-500">Measurements are saved to the customer for next time. Take an advance from the order list (Record Advance): it is a receipt with this order number.</p>
        </form>
        <PartyQuickAdd open={partyOpen} onClose={() => setPartyOpen(false)} onPicked={(pid) => set("partyacc")({ target: { value: pid } })} />
      </FormPage>
    </HomeLayout>
  );
};

const AddEditTailorOrderWithRules = (props: any) => (
  <FormRules module="tailoring">
    <AddEditTailorOrder {...props} />
  </FormRules>
);

export default AddEditTailorOrderWithRules;
