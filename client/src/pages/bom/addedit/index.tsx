import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Plus, Trash2 } from "lucide-react";
import FormField from "../../../components/formfiled";
import FormPage from "../../../components/formpage";
import MfgLines, { type MfgLine, CONSUMES, MAKES, itemOptions, mfgInput, pickItem, toMfgLines, unitOptions, variantOf } from "../../../components/mfglines";
import HomeLayout from "../../../layouts/home";
import { useProductServicesQuery } from "../../../graphql/hooks/products";
import { useBomByIdQuery, useBomsQuery, useManufacturingMutations } from "../../../graphql/hooks/manufacturing";
import { useAppDispatch } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";
import { OFFLINE_SAVED_MESSAGE, isOfflineSaved, savedOffline } from "../../../offline/billing";
import { bomRunCost, money } from "..";

type Op = { name: string; workcenter?: string; minutes?: number | string; costperhour?: number | string; outsourced?: boolean };
const idOf = (v: any) => (v && typeof v === "object" ? v.id : v) || null;

const AddEditBom = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { addBom, editBom } = useManufacturingMutations();
  const { data: own } = useBomByIdQuery(id);
  const { data: bomsData } = useBomsQuery();
  const { data: productData } = useProductServicesQuery();
  const products = productData?.getProductServices || [];

  const [head, setHead] = useState({ name: "", productserviceid: "", variantid: null as string | null, salesunitid: null as string | null, qty: 1 as number | string, overhead: "" as number | string, isdefault: true, notes: "" });
  const [items, setItems] = useState<MfgLine[]>([{ productserviceid: "", qty: 1 }]);
  const [byproducts, setByproducts] = useState<MfgLine[]>([]);
  const [ops, setOps] = useState<Op[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    const b = own?.getBomById;
    if (!isEdit || !b || filled) return;
    setFilled(true);
    setHead({
      name: b.name || "", productserviceid: idOf(b.productserviceid) || "", variantid: idOf(b.variantid), salesunitid: idOf(b.salesunitid),
      qty: b.qty ?? 1, overhead: b.overhead ?? "", isdefault: !!b.isdefault, notes: b.notes || "",
    });
    setItems(toMfgLines(b.items));
    setByproducts(toMfgLines(b.byproducts));
    setOps((b.operations || []).map((o: any) => ({ ...o })));
  }, [isEdit, own, filled]);

  const outVariant = variantOf(products, head.productserviceid, head.variantid);
  const hasBom = (pid: string) => (bomsData?.getBoms || []).some((b: any) => idOf(b.productserviceid) === pid && b.id !== id);
  const cost = useMemo(
    () => bomRunCost({ items: mfgInput(items), byproducts: mfgInput(byproducts), operations: ops, overhead: head.overhead }, products),
    [items, byproducts, ops, head.overhead, products]
  );
  const subs = items.filter((l) => l.productserviceid && hasBom(l.productserviceid)).length;
  const editOp = (i: number, patch: Partial<Op>) => setOps(ops.map((o, j) => (j === i ? { ...o, ...patch } : o)));

  const save = async () => {
    const e: Record<string, string> = {};
    if (!head.productserviceid) e.item = "Pick the item this BOM makes";
    if (!(Number(head.qty) > 0)) e.qty = "Quantity must be more than 0";
    if (!mfgInput(items).length) e.items = "Add at least one component";
    if (items.some((l) => l.productserviceid === head.productserviceid)) e.items = "The item cannot be its own component";
    setErrors(e);
    if (Object.keys(e).length) return;
    const input: any = {
      name: head.name.trim() || undefined,
      productserviceid: head.productserviceid,
      variantid: head.variantid || null,
      salesunitid: head.salesunitid || null,
      qty: Number(head.qty),
      items: mfgInput(items),
      byproducts: mfgInput(byproducts),
      operations: ops.filter((o) => o.name.trim()).map((o) => ({
        name: o.name.trim(), workcenter: o.workcenter || undefined, minutes: Number(o.minutes) || undefined,
        costperhour: Number(o.costperhour) || undefined, outsourced: o.outsourced || undefined,
      })),
      overhead: head.overhead === "" ? undefined : Number(head.overhead),
      isdefault: head.isdefault,
      notes: head.notes || undefined,
    };
    setSaving(true);
    try {
      if (isEdit && id) {
        const r = await editBom({ variables: { id, input, expectedUpdatedAt: own?.getBomById?.updatedAt } });
        dispatch(showMessage({ message: savedOffline(r?.data?.editBom) ? OFFLINE_SAVED_MESSAGE : "BOM updated.", type: "success" }));
      } else {
        const r = await addBom({ variables: { input } });
        dispatch(showMessage({ message: isOfflineSaved(r?.data?.addBom) ? OFFLINE_SAVED_MESSAGE : "BOM saved.", type: "success" }));
      }
      navigate("/bom");
    } catch (err: any) {
      dispatch(showMessage({ message: err?.message || "Could not save the BOM.", type: "error" }));
    } finally {
      setSaving(false);
    }
  };

  const perUnit = cost.total / (Number(head.qty) || 1);

  return (
    <HomeLayout>
      <FormPage breadcrumb="Bill of Materials" title={isEdit ? "Edit BOM" : "Add BOM"} onSave={save} onCancel={() => navigate(-1)}
        saveLabel={isEdit ? "Update BOM" : "Save BOM"} saveDisabled={saving}>
        <form onSubmit={(ev) => ev.preventDefault()} className="space-y-6">
          <fieldset className="border rounded-xl p-4 space-y-4">
            <legend className="text-sm font-medium px-2">Finished Item</legend>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <FormField label="Item to Make" name="item" type="select" searchable options={itemOptions(products, false, MAKES)} error={errors.item}
                  value={head.productserviceid ? `${head.productserviceid}|${head.variantid || ""}` : ""}
                  onChange={(e: any) => setHead((h) => ({ ...h, ...pickItem(products, e.target.value) }))} />
              </div>
              <FormField label="Unit" name="unit" type="select" searchable options={unitOptions(outVariant)} value={head.salesunitid || ""}
                onChange={(e: any) => setHead((h) => ({ ...h, salesunitid: e.target.value || null }))} />
              <FormField label="Quantity Made" name="qty" type="number" value={head.qty} error={errors.qty}
                onChange={(e: any) => setHead((h) => ({ ...h, qty: e.target.value }))} />
              <div className="md:col-span-2">
                <FormField label="BOM Name" name="name" type="text" value={head.name} placeholder="BOM Name"
                  onChange={(e: any) => setHead((h) => ({ ...h, name: e.target.value }))} />
              </div>
              <FormField label="Overhead / Run (₹)" name="overhead" type="number" value={head.overhead} placeholder="Power, packing"
                onChange={(e: any) => setHead((h) => ({ ...h, overhead: e.target.value }))} />
              <label className="flex items-end gap-2 pb-1.5 text-[13px] text-slate-700">
                <button type="button" role="switch" aria-checked={head.isdefault} onClick={() => setHead((h) => ({ ...h, isdefault: !h.isdefault }))}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${head.isdefault ? "bg-emerald-500" : "bg-slate-300"}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${head.isdefault ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                </button>
                Default BOM for this item
              </label>
            </div>
          </fieldset>

          <MfgLines title="Components (Raw Material / Sub-Assemblies)" lines={items} setLines={setItems} products={products} types={CONSUMES} wastage error={errors.items}
            hint={subs ? `${subs} component${subs > 1 ? "s have" : " has"} its own BOM; Material Planning works through every level.` : "Quantities are for the quantity made above."} />

          <MfgLines title="By-Products / Scrap" lines={byproducts} setLines={setByproducts} products={products} rate rateLabel="Value / Unit (₹)"
            hint="Comes back into stock with each production run; its value lowers the finished item's cost." />

          <fieldset className="border rounded-xl p-4 space-y-2">
            <legend className="text-sm font-medium px-2">Operations / Labour</legend>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[12px] text-slate-500">
                  <th className="py-1">Operation</th><th className="py-1">Work Center</th><th className="w-24 py-1 text-right">Minutes</th>
                  <th className="w-28 py-1 text-right">Cost / Hour</th><th className="w-24 py-1">Job Work</th><th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {ops.map((o, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-1 pr-2"><input className="h-8 w-full rounded-md border border-slate-300 px-2" value={o.name} placeholder="Operation" onChange={(e) => editOp(i, { name: e.target.value })} /></td>
                    <td className="py-1 pr-2"><input className="h-8 w-full rounded-md border border-slate-300 px-2" value={o.workcenter || ""} placeholder="Work Center" onChange={(e) => editOp(i, { workcenter: e.target.value })} /></td>
                    <td className="py-1 pr-2"><input type="number" min="0" className="h-8 w-full rounded-md border border-slate-300 px-2 text-right" value={o.minutes ?? ""} onChange={(e) => editOp(i, { minutes: e.target.value })} /></td>
                    <td className="py-1 pr-2"><input type="number" min="0" className="h-8 w-full rounded-md border border-slate-300 px-2 text-right" value={o.costperhour ?? ""} onChange={(e) => editOp(i, { costperhour: e.target.value })} /></td>
                    <td className="py-1"><input type="checkbox" checked={!!o.outsourced} onChange={(e) => editOp(i, { outsourced: e.target.checked })} /></td>
                    <td className="py-1">
                      <button type="button" title="Remove" className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => setOps(ops.filter((_, j) => j !== i))}>
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" onClick={() => setOps([...ops, { name: "" }])} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed border-indigo-300 px-3 text-[13px] font-medium text-indigo-600 hover:bg-indigo-50">
              <Plus size={14} /> Add Operation
            </button>
          </fieldset>

          <fieldset className="border rounded-xl p-4 space-y-3">
            <legend className="text-sm font-medium px-2">Notes &amp; Cost</legend>
            <FormField label="Notes" name="notes" type="text" multiline value={head.notes} onChange={(e: any) => setHead((h) => ({ ...h, notes: e.target.value }))} />
            <div className="flex flex-wrap justify-end gap-6 text-[13px] text-slate-600">
              <span>Material ₹{money(cost.material)}</span>
              <span>Labour ₹{money(cost.labour)}</span>
              <span>Overhead ₹{money(cost.overhead)}</span>
              {cost.byValue > 0 && <span>By-Products −₹{money(cost.byValue)}</span>}
              <span className="font-semibold text-slate-900">Est. Cost / Unit ₹{money(perUnit)}</span>
            </div>
            <p className="text-right text-[11px] text-slate-400">Estimate at purchase rates; production uses the branch average cost.</p>
          </fieldset>
        </form>
      </FormPage>
    </HomeLayout>
  );
};

export default AddEditBom;
