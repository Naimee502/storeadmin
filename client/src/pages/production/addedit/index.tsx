import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { Plus, Trash2 } from "lucide-react";
import FormField from "../../../components/formfiled";
import FormPage from "../../../components/formpage";
import MfgLines, { type MfgLine, baseQtyOf, lineCost, mfgInput, toMfgLines, variantOf } from "../../../components/mfglines";
import HomeLayout from "../../../layouts/home";
import { useProductServicesQuery } from "../../../graphql/hooks/products";
import {
  QC_STATUS, mfgNo, useBomsQuery, useManufacturingMutations, useMfgBranch, useProductionEntryByIdQuery, useWorkOrdersQuery,
} from "../../../graphql/hooks/manufacturing";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";
import { todayYMD } from "../../../utils/helper";
import { OFFLINE_SAVED_MESSAGE, OfflineNumberNote, isOfflineSaved, savedOffline, useOfflineNumber, useOfflineStock } from "../../../offline/billing";
import { itemName, money } from "../../bom";

type Test = { parameter: string; expected?: string; actual?: string; ok?: boolean };
const idOf = (v: any) => (v && typeof v === "object" ? v.id : v) || null;
const round = (n: number) => Math.round(n * 1000) / 1000;

const AddEditProduction = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const workOrderId = new URLSearchParams(useLocation().search).get("workOrderId");
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const branchId = useMfgBranch();
  const settings = useAppSelector((s: any) => s.adminsettings.settings);
  const { addProductionEntry, editProductionEntry } = useManufacturingMutations();
  const { data: own } = useProductionEntryByIdQuery(id);
  const { data: bomsData } = useBomsQuery();
  const boms = bomsData?.getBoms || [];
  const { data: woData } = useWorkOrdersQuery();
  const workOrders = woData?.getWorkOrders || [];
  const { data: productData } = useProductServicesQuery();
  const products = useOfflineStock(productData?.getProductServices ?? [], branchId);
  const { number: offlineNo, noDevice } = useOfflineNumber("production", !isEdit);

  const [f, setF] = useState({ billdate: todayYMD(), workorderid: "", bomid: "", runs: 1 as number | string, labourcost: "" as number | string, overhead: "" as number | string, qcstatus: "", batchnumber: "", serials: "", notes: "" });
  const [components, setComponents] = useState<MfgLine[]>([]);
  const [outputs, setOutputs] = useState<MfgLine[]>([]);
  const [byproducts, setByproducts] = useState<MfgLine[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [billNumber, setBillNumber] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [filled, setFilled] = useState(false);

  // Lines for `runs` of a BOM: wastage added to components, labour from its operations.
  const fillFromBom = (bom: any, runs: number) => {
    if (!bom) return;
    const scale = (l: any, w = true) => ({ ...toMfgLines([l])[0], qty: round(Number(l.qty || 0) * runs * (w ? 1 + Number(l.wastage || 0) / 100 : 1)), wastage: "" });
    setComponents((bom.items || []).map((l: any) => scale(l)));
    setByproducts((bom.byproducts || []).map((l: any) => scale(l, false)));
    setOutputs([{ productserviceid: idOf(bom.productserviceid) || "", variantid: idOf(bom.variantid), salesunitid: idOf(bom.salesunitid), qty: round(Number(bom.qty || 1) * runs) }]);
    const labour = (bom.operations || []).reduce((s: number, o: any) => s + (Number(o.minutes || 0) / 60) * Number(o.costperhour || 0), 0) * runs;
    setF((x) => ({ ...x, bomid: bom.id, labourcost: labour ? round(labour) : "", overhead: bom.overhead ? round(Number(bom.overhead) * runs) : "" }));
  };

  const fromWorkOrder = (w: any) => {
    if (!w) return setF((x) => ({ ...x, workorderid: "" }));
    const bom = boms.find((b: any) => b.id === w.bomid) || boms.find((b: any) => idOf(b.productserviceid) === idOf(w.productserviceid));
    const pending = Math.max(Number(w.qty) - Number(w.qtyproduced || 0), 0) || Number(w.qty);
    const runs = bom ? round(pending / (Number(bom.qty) || 1)) : 1;
    setF((x) => ({ ...x, workorderid: w.id, runs }));
    if (bom) fillFromBom(bom, runs);
    else setOutputs([{ productserviceid: idOf(w.productserviceid) || "", variantid: idOf(w.variantid), salesunitid: idOf(w.salesunitid), qty: pending }]);
  };

  useEffect(() => {
    const p = own?.getProductionEntryById;
    if (!isEdit || !p || filled) return;
    setFilled(true);
    setF({
      billdate: p.billdate || todayYMD(), workorderid: p.workorderid || "", bomid: p.bomid || "", runs: "",
      labourcost: p.labourcost ?? "", overhead: p.overhead ?? "", qcstatus: p.qcstatus || "", batchnumber: p.batchnumber || "",
      serials: (p.serials || []).join("\n"), notes: p.notes || "",
    });
    setComponents(toMfgLines(p.components));
    setOutputs(toMfgLines(p.outputs));
    setByproducts(toMfgLines(p.byproducts));
    setTests((p.qctests || []).map((t: any) => ({ ...t })));
    setBillNumber(mfgNo(p, "PE-"));
  }, [isEdit, own, filled]);

  // From a work order's "Record Production".
  useEffect(() => {
    if (isEdit || filled || !workOrderId || !workOrders.length || !bomsData) return;
    setFilled(true);
    fromWorkOrder(workOrders.find((w: any) => w.id === workOrderId));
  }, [isEdit, filled, workOrderId, workOrders.length, bomsData]);

  useEffect(() => {
    if (!isEdit) setBillNumber(offlineNo || "");
  }, [isEdit, offlineNo]);

  const cost = useMemo(() => {
    const material = components.reduce((s, l) => s + lineCost(products, l), 0);
    const byValue = byproducts.reduce((s, l) => s + Number(l.rate || 0) * Number(l.qty || 0), 0);
    const total = material + Number(f.labourcost || 0) + Number(f.overhead || 0);
    const outQty = outputs.reduce((s, l) => s + Number(l.qty || 0), 0);
    return { material, byValue, total, perUnit: outQty ? Math.max(total - byValue, 0) / outQty : 0 };
  }, [components, byproducts, outputs, f.labourcost, f.overhead, products]);

  const short = components.filter((l) => {
    const v = variantOf(products, l.productserviceid, l.variantid);
    return v && baseQtyOf(products, l) > Number(v.currentstock || 0);
  }).length;
  const editTest = (i: number, patch: Partial<Test>) => setTests(tests.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  const save = async () => {
    const e: Record<string, string> = {};
    if (!f.billdate) e.billdate = "Date is required";
    if (!mfgInput(outputs).length) e.outputs = "Add the item produced and its quantity";
    if (short && settings?.allowNegativeStock !== true) e.components = `${short} component${short > 1 ? "s are" : " is"} short of stock`;
    setErrors(e);
    if (Object.keys(e).length) return;
    const serials = f.serials.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    const input: any = {
      billdate: f.billdate,
      branchid: branchId || undefined,
      workorderid: f.workorderid || null,
      bomid: f.bomid || null,
      components: mfgInput(components),
      outputs: mfgInput(outputs),
      byproducts: mfgInput(byproducts),
      labourcost: f.labourcost === "" ? undefined : Number(f.labourcost),
      overhead: f.overhead === "" ? undefined : Number(f.overhead),
      qcstatus: f.qcstatus || undefined,
      qctests: tests.filter((t) => t.parameter.trim()).map((t) => ({ parameter: t.parameter.trim(), expected: t.expected || undefined, actual: t.actual || undefined, ok: !!t.ok })),
      serials: serials.length ? serials : undefined,
      batchnumber: f.batchnumber || undefined,
      notes: f.notes || undefined,
    };
    if (!isEdit && offlineNo) input.billnumber = offlineNo;
    setSaving(true);
    try {
      if (isEdit && id) {
        const r = await editProductionEntry({ variables: { id, input, expectedUpdatedAt: own?.getProductionEntryById?.updatedAt } });
        dispatch(showMessage({ message: savedOffline(r?.data?.editProductionEntry) ? OFFLINE_SAVED_MESSAGE : "Production updated.", type: "success" }));
      } else {
        const r = await addProductionEntry({ variables: { input } });
        dispatch(showMessage({ message: isOfflineSaved(r?.data?.addProductionEntry) ? OFFLINE_SAVED_MESSAGE : "Production saved. Stock updated.", type: "success" }));
      }
      navigate("/production");
    } catch (err: any) {
      dispatch(showMessage({ message: err?.message || "Could not save the production entry.", type: "error" }));
    } finally {
      setSaving(false);
    }
  };

  const openWos = workOrders.filter((w: any) => !["cancelled", "completed"].includes(w.workStatus) || w.id === f.workorderid);

  return (
    <HomeLayout>
      <FormPage breadcrumb="Production" title={isEdit ? `Edit ${billNumber}` : "Add Production"} onSave={save} onCancel={() => navigate(-1)}
        saveLabel={isEdit ? "Update Production" : "Save Production"} saveDisabled={saving}>
        <form onSubmit={(ev) => ev.preventDefault()} className="space-y-6">
          <fieldset className="border rounded-xl p-4 space-y-4">
            <legend className="text-sm font-medium px-2">Production Details</legend>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <FormField label="Entry No." name="billNumber" type="text" value={billNumber || (isEdit ? "" : "Auto")} onChange={() => {}} disabled />
              <FormField label="Date" name="billdate" type="date" value={f.billdate} error={errors.billdate} onChange={(e: any) => setF((x) => ({ ...x, billdate: e.target.value }))} />
              <div className="md:col-span-2">
                <FormField label="Work Order" name="workorderid" type="select" searchable value={f.workorderid}
                  options={openWos.map((w: any) => ({ value: w.id, label: `${mfgNo(w, "WO-")} - ${itemName(w)} - ${Math.max(Number(w.qty) - Number(w.qtyproduced || 0), 0)} pending` }))}
                  onChange={(e: any) => fromWorkOrder(workOrders.find((w: any) => w.id === e.target.value))} />
              </div>
              <OfflineNumberNote show={!isEdit && noDevice} />
              <div className="md:col-span-2">
                <FormField label="BOM" name="bomid" type="select" searchable value={f.bomid}
                  options={boms.map((b: any) => ({ value: b.id, label: `${itemName(b)}${b.name ? ` - ${b.name}` : ""}` }))}
                  onChange={(e: any) => fillFromBom(boms.find((b: any) => b.id === e.target.value), Number(f.runs) || 1)} />
              </div>
              <FormField label="Runs of BOM" name="runs" type="number" value={f.runs}
                onChange={(e: any) => {
                  setF((x) => ({ ...x, runs: e.target.value }));
                  const bom = boms.find((b: any) => b.id === f.bomid);
                  if (bom && Number(e.target.value) > 0) fillFromBom(bom, Number(e.target.value));
                }} />
              <p className="self-end pb-2 text-[12px] text-slate-500">Picking a BOM fills the lines; change any quantity to what was actually used.</p>
            </div>
          </fieldset>

          <MfgLines title="Produced (Comes into Stock)" lines={outputs} setLines={setOutputs} products={products} error={errors.outputs} />
          <MfgLines title="Raw Material Used (Goes out of Stock)" lines={components} setLines={setComponents} products={products} stock error={errors.components} />
          <MfgLines title="By-Products / Scrap" lines={byproducts} setLines={setByproducts} products={products} rate rateLabel="Value / Unit (₹)" />

          <fieldset className="border rounded-xl p-4 space-y-3">
            <legend className="text-sm font-medium px-2">Quality Check</legend>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <FormField label="QC Status" name="qcstatus" type="select" searchable value={f.qcstatus}
                options={Object.entries(QC_STATUS).map(([value, label]) => ({ value, label }))}
                onChange={(e: any) => setF((x) => ({ ...x, qcstatus: e.target.value }))} />
              <FormField label="Batch No." name="batchnumber" type="text" value={f.batchnumber} onChange={(e: any) => setF((x) => ({ ...x, batchnumber: e.target.value }))} />
              <div className="md:col-span-2">
                <FormField label="Serial Nos. (one per line)" name="serials" type="text" multiline value={f.serials} onChange={(e: any) => setF((x) => ({ ...x, serials: e.target.value }))} />
              </div>
            </div>
            {tests.length > 0 && (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[12px] text-slate-500"><th className="py-1">Test</th><th className="py-1">Expected</th><th className="py-1">Actual</th><th className="w-16 py-1">Pass</th><th className="w-8" /></tr>
                </thead>
                <tbody>
                  {tests.map((t, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="py-1 pr-2"><input className="h-8 w-full rounded-md border border-slate-300 px-2" value={t.parameter} placeholder="Test" onChange={(e) => editTest(i, { parameter: e.target.value })} /></td>
                      <td className="py-1 pr-2"><input className="h-8 w-full rounded-md border border-slate-300 px-2" value={t.expected || ""} onChange={(e) => editTest(i, { expected: e.target.value })} /></td>
                      <td className="py-1 pr-2"><input className="h-8 w-full rounded-md border border-slate-300 px-2" value={t.actual || ""} onChange={(e) => editTest(i, { actual: e.target.value })} /></td>
                      <td className="py-1"><input type="checkbox" checked={!!t.ok} onChange={(e) => editTest(i, { ok: e.target.checked })} /></td>
                      <td className="py-1">
                        <button type="button" title="Remove" className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => setTests(tests.filter((_, j) => j !== i))}>
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <button type="button" onClick={() => setTests([...tests, { parameter: "" }])} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed border-indigo-300 px-3 text-[13px] font-medium text-indigo-600 hover:bg-indigo-50">
              <Plus size={14} /> Add Test
            </button>
          </fieldset>

          <fieldset className="border rounded-xl p-4 space-y-3">
            <legend className="text-sm font-medium px-2">Cost</legend>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <FormField label="Labour Cost (₹)" name="labourcost" type="number" value={f.labourcost} onChange={(e: any) => setF((x) => ({ ...x, labourcost: e.target.value }))} />
              <FormField label="Overhead (₹)" name="overhead" type="number" value={f.overhead} onChange={(e: any) => setF((x) => ({ ...x, overhead: e.target.value }))} />
              <div className="md:col-span-2">
                <FormField label="Notes" name="notes" type="text" value={f.notes} onChange={(e: any) => setF((x) => ({ ...x, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-6 text-[13px] text-slate-600">
              <span>Material ₹{money(cost.material)}</span>
              {cost.byValue > 0 && <span>By-Products −₹{money(cost.byValue)}</span>}
              <span>Total ₹{money(cost.total)}</span>
              <span className="font-semibold text-slate-900">Cost / Unit ₹{money(cost.perUnit)}</span>
            </div>
            <p className="text-right text-[11px] text-slate-400">Estimate at purchase rates; on save the branch average cost of each material is used.</p>
          </fieldset>
        </form>
      </FormPage>
    </HomeLayout>
  );
};

export default AddEditProduction;
