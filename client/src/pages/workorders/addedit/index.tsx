import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import FormField from "../../../components/formfiled";
import FormPage from "../../../components/formpage";
import { defaultBom, explodeBom, itemOptions, pickItem, unitFactor, unitOptions, variantOf } from "../../../components/mfglines";
import HomeLayout from "../../../layouts/home";
import { useProductServicesQuery } from "../../../graphql/hooks/products";
import { mfgNo, useBomsQuery, useManufacturingMutations, useMfgBranch, useWorkOrderByIdQuery } from "../../../graphql/hooks/manufacturing";
import { useAppDispatch } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";
import { todayYMD } from "../../../utils/helper";
import { OFFLINE_SAVED_MESSAGE, OfflineNumberNote, isOfflineSaved, savedOffline, useOfflineNumber, useOfflineStock } from "../../../offline/billing";

const idOf = (v: any) => (v && typeof v === "object" ? v.id : v) || null;
const fmt = (n: number) => Number(n.toFixed(3)).toString();

/** Raw material a quantity needs against branch stock (Material Planning and the work order use it). */
export function materialNeeds(boms: any[], products: any[], pid: string, vid: string | null, baseQty: number) {
  const need = explodeBom(boms, products, pid, vid, baseQty);
  return [...need].map(([key, qty]) => {
    const [p, v] = key.split("|");
    const prod = products.find((x: any) => x.id === p);
    const variant = variantOf(products, p, v || null);
    const stock = Number(variant?.currentstock || 0);
    return {
      key,
      name: `${prod?.name || "?"}${(prod?.productvariants || []).length > 1 && variant?.name ? ` - ${variant.name}` : ""}`,
      unit: variant?.baseunitid?.unitname || "",
      need: qty,
      stock,
      short: Math.max(qty - stock, 0),
      rate: Number(variant?.purchaserate || 0),
    };
  });
}

const AddEditWorkOrder = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const branchId = useMfgBranch();
  const { addWorkOrder, editWorkOrder } = useManufacturingMutations();
  const { data: own } = useWorkOrderByIdQuery(id);
  const { data: bomsData } = useBomsQuery();
  const boms = bomsData?.getBoms || [];
  const { data: productData } = useProductServicesQuery();
  const products = useOfflineStock(productData?.getProductServices ?? [], branchId);
  const { number: offlineNo, noDevice } = useOfflineNumber("workorder", !isEdit);

  const [f, setF] = useState({ productserviceid: "", variantid: null as string | null, salesunitid: null as string | null, bomid: "", qty: 1 as number | string, billdate: todayYMD(), duedate: "", notes: "" });
  const [billNumber, setBillNumber] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    const w = own?.getWorkOrderById;
    if (!isEdit || !w || filled) return;
    setFilled(true);
    setF({
      productserviceid: idOf(w.productserviceid) || "", variantid: idOf(w.variantid), salesunitid: idOf(w.salesunitid), bomid: w.bomid || "",
      qty: w.qty ?? 1, billdate: w.billdate || todayYMD(), duedate: w.duedate || "", notes: w.notes || "",
    });
    setBillNumber(mfgNo(w, "WO-"));
  }, [isEdit, own, filled]);
  useEffect(() => {
    if (!isEdit) setBillNumber(offlineNo || "");
  }, [isEdit, offlineNo]);

  const itemBoms = boms.filter((b: any) => idOf(b.productserviceid) === f.productserviceid);
  const variant = variantOf(products, f.productserviceid, f.variantid);
  const bom = boms.find((b: any) => b.id === f.bomid) || defaultBom(boms, f.productserviceid, f.variantid);
  // The chosen BOM goes first so explodeBom uses it at the top level.
  const needs = useMemo(() => {
    if (!f.productserviceid || !bom) return [];
    const ordered = [{ ...bom, isdefault: true }, ...boms.filter((b: any) => b.id !== bom.id && idOf(b.productserviceid) !== f.productserviceid)];
    return materialNeeds(ordered, products, f.productserviceid, f.variantid, Number(f.qty || 0) * unitFactor(variant, f.salesunitid));
  }, [f.productserviceid, f.variantid, f.salesunitid, f.qty, bom, boms, products, variant]);

  const save = async () => {
    const e: Record<string, string> = {};
    if (!f.productserviceid) e.item = "Pick the item to make";
    if (!(Number(f.qty) > 0)) e.qty = "Quantity must be more than 0";
    if (!f.billdate) e.billdate = "Date is required";
    setErrors(e);
    if (Object.keys(e).length) return;
    const input: any = {
      productserviceid: f.productserviceid, variantid: f.variantid || null, salesunitid: f.salesunitid || null,
      bomid: bom?.id || null, qty: Number(f.qty), billdate: f.billdate, duedate: f.duedate || null, notes: f.notes || undefined,
      branchid: branchId || undefined,
    };
    if (!isEdit && offlineNo) input.billnumber = offlineNo;
    setSaving(true);
    try {
      if (isEdit && id) {
        const r = await editWorkOrder({ variables: { id, input, expectedUpdatedAt: own?.getWorkOrderById?.updatedAt } });
        dispatch(showMessage({ message: savedOffline(r?.data?.editWorkOrder) ? OFFLINE_SAVED_MESSAGE : "Work order updated.", type: "success" }));
      } else {
        const r = await addWorkOrder({ variables: { input } });
        dispatch(showMessage({ message: isOfflineSaved(r?.data?.addWorkOrder) ? OFFLINE_SAVED_MESSAGE : "Work order saved.", type: "success" }));
      }
      navigate("/workorders");
    } catch (err: any) {
      dispatch(showMessage({ message: err?.message || "Could not save the work order.", type: "error" }));
    } finally {
      setSaving(false);
    }
  };

  const shortCount = needs.filter((n) => n.short > 0).length;

  return (
    <HomeLayout>
      <FormPage breadcrumb="Work Orders" title={isEdit ? `Edit ${billNumber}` : "Add Work Order"} onSave={save} onCancel={() => navigate(-1)}
        saveLabel={isEdit ? "Update Work Order" : "Save Work Order"} saveDisabled={saving}>
        <form onSubmit={(ev) => ev.preventDefault()} className="space-y-6">
          <fieldset className="border rounded-xl p-4 space-y-4">
            <legend className="text-sm font-medium px-2">Work Order</legend>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <FormField label="WO No." name="billNumber" type="text" value={billNumber || (isEdit ? "" : "Auto")} onChange={() => {}} disabled />
              <FormField label="Date" name="billdate" type="date" value={f.billdate} error={errors.billdate} onChange={(e: any) => setF((x) => ({ ...x, billdate: e.target.value }))} />
              <FormField label="Due Date" name="duedate" type="date" value={f.duedate} onChange={(e: any) => setF((x) => ({ ...x, duedate: e.target.value }))} />
              <OfflineNumberNote show={!isEdit && noDevice} />
              <div className="md:col-span-2">
                <FormField label="Item to Make" name="item" type="select" searchable options={itemOptions(products, false)} error={errors.item}
                  value={f.productserviceid ? `${f.productserviceid}|${f.variantid || ""}` : ""}
                  onChange={(e: any) => setF((x) => ({ ...x, ...pickItem(products, e.target.value), bomid: "" }))} />
              </div>
              <FormField label="BOM" name="bomid" type="select" searchable value={bom?.id || ""}
                options={itemBoms.map((b: any) => ({ value: b.id, label: `${b.name || "BOM"}${b.isdefault ? " (Default)" : ""}` }))}
                onChange={(e: any) => setF((x) => ({ ...x, bomid: e.target.value }))} />
              <div className="grid grid-cols-2 gap-2">
                <FormField label="Quantity" name="qty" type="number" value={f.qty} error={errors.qty} onChange={(e: any) => setF((x) => ({ ...x, qty: e.target.value }))} />
                <FormField label="Unit" name="unit" type="select" searchable options={unitOptions(variant)} value={f.salesunitid || ""}
                  onChange={(e: any) => setF((x) => ({ ...x, salesunitid: e.target.value || null }))} />
              </div>
              <div className="md:col-span-4">
                <FormField label="Notes" name="notes" type="text" value={f.notes} onChange={(e: any) => setF((x) => ({ ...x, notes: e.target.value }))} />
              </div>
            </div>
            {f.productserviceid && !bom && <p className="text-[12px] text-amber-600">This item has no BOM yet; add one to see the raw material it needs.</p>}
          </fieldset>

          {needs.length > 0 && (
            <fieldset className="border rounded-xl p-4 space-y-2">
              <legend className="text-sm font-medium px-2">Raw Material Needed {shortCount ? <span className="text-rose-600">({shortCount} short)</span> : null}</legend>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[12px] text-slate-500">
                    <th className="py-1">Item</th><th className="py-1 text-right">Needed</th><th className="py-1 text-right">In Stock</th><th className="py-1 text-right">Short</th>
                  </tr>
                </thead>
                <tbody>
                  {needs.map((n) => (
                    <tr key={n.key} className="border-t border-slate-100">
                      <td className="py-1.5">{n.name}</td>
                      <td className="py-1.5 text-right">{fmt(n.need)} {n.unit}</td>
                      <td className="py-1.5 text-right">{fmt(n.stock)} {n.unit}</td>
                      <td className={`py-1.5 text-right ${n.short > 0 ? "font-semibold text-rose-600" : "text-emerald-600"}`}>{n.short > 0 ? `${fmt(n.short)} ${n.unit}` : "OK"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </fieldset>
          )}
        </form>
      </FormPage>
    </HomeLayout>
  );
};

export default AddEditWorkOrder;
