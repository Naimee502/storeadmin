import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Plus, Trash2 } from "lucide-react";
import FormField from "../../../components/formfiled";
import FormPage from "../../../components/formpage";
import FormSwitch from "../../../components/formswitch";
import MfgLines, { type MfgLine, mfgInput, toMfgLines } from "../../../components/mfglines";
import HomeLayout from "../../../layouts/home";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";
import { useCategoriesQuery } from "../../../graphql/hooks/categories";
import { useAccountLedgersQuery } from "../../../graphql/hooks/accountledgers";
import { useStaffListQuery } from "../../../graphql/hooks/staffaccounts";
import { useProductServicesQuery } from "../../../graphql/hooks/products";
import { PRICING_UNITS, useServiceByIdQuery, useServiceMasterMutations } from "../../../graphql/hooks/services";
import { useAddNew } from "../../../hooks/useaddnew";
import { OFFLINE_SAVED_MESSAGE, isOfflineSaved, savedOffline } from "../../../offline/billing";

type Slot = { day: string[]; from: string; to: string };
type Variant = {
  id?: string; servicecode?: string; servicebarcode?: string;
  name: string; servicerate: string | number; pricingunit: string; gst: string | number; saccode: string; taxinclusive: boolean; visitcharge: string | number; uom: string;
  durationAmount: string | number; durationUnit: string; bufferminutes: string | number; capacity: string | number;
  requiresappointment: boolean; locationType: string; staffids: string[]; commission: string | number;
  nextduedays: string | number; warrantydays: string | number; isRecurring: boolean; recurrenceInterval: string; recurrenceCount: string | number;
  materials: MfgLine[]; checklist: string; remarks: string; slots: Slot[];
};

const DAYS = [["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"], ["fri", "Fri"], ["sat", "Sat"], ["sun", "Sun"]].map(([value, label]) => ({ value, label }));
const WHERE = [
  { value: "offsite", label: "At Business Location" },
  { value: "onsite", label: "At Customer Location" },
  { value: "remote", label: "Online / Remote" },
];
const GST_RATES = ["0", "5", "12", "18", "28"].map((v) => ({ value: v, label: `${v}%` }));
const blank = (): Variant => ({
  name: "", servicerate: "", pricingunit: "fixed", gst: "18", saccode: "", taxinclusive: false, visitcharge: "", uom: "",
  durationAmount: 30, durationUnit: "minutes", bufferminutes: "", capacity: "", requiresappointment: true, locationType: "offsite",
  staffids: [], commission: "", nextduedays: "", warrantydays: "", isRecurring: false, recurrenceInterval: "monthly", recurrenceCount: 1,
  materials: [], checklist: "", remarks: "", slots: [],
});
const num = (v: any) => (v === "" || v === null || v === undefined ? undefined : Number(v));

// Saved slots are one row per day; the form groups same times together.
const groupSlots = (slots: any[] = []): Slot[] => {
  const m = new Map<string, Slot>();
  for (const s of slots) {
    const k = `${s.from}|${s.to}`;
    const g = m.get(k) || { day: [], from: s.from || "", to: s.to || "" };
    g.day.push(s.day);
    m.set(k, g);
  }
  return [...m.values()];
};

const fromSaved = (v: any): Variant => ({
  ...blank(),
  id: v.id, servicecode: v.servicecode || undefined, servicebarcode: v.servicebarcode || undefined,
  name: v.name || "", servicerate: v.servicerate ?? "", pricingunit: v.pricingunit || "fixed", gst: v.gst ?? "", saccode: v.saccode || "",
  taxinclusive: !!v.taxinclusive, visitcharge: v.visitcharge ?? "", uom: v.uom || "",
  durationAmount: v.duration?.amount ?? "", durationUnit: v.duration?.unit || "minutes", bufferminutes: v.bufferminutes ?? "", capacity: v.capacity ?? "",
  requiresappointment: v.requiresappointment !== false, locationType: v.locationType || "offsite", staffids: v.staffids || [], commission: v.commission ?? "",
  nextduedays: v.nextduedays ?? "", warrantydays: v.warrantydays ?? "", isRecurring: !!v.isRecurring,
  recurrenceInterval: v.recurrence?.interval || "monthly", recurrenceCount: v.recurrence?.count ?? 1,
  materials: toMfgLines(v.materials || []), checklist: (v.checklist || []).join("\n"), remarks: v.remarks || "", slots: groupSlots(v.availabilityslots),
});

// Same small heading the Product form uses inside a variant card.
const Sub = ({ title, children, first = false }: { title: string; children: any; first?: boolean }) => (
  <div className={`space-y-2 pb-3 ${first ? "pt-1" : "border-t border-slate-200 pt-3"}`}>
    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</h4>
    {children}
  </div>
);

const AddEditService = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  // Business Settings → Form Permissions → Service Form.
  const perms = useAppSelector((s: any) => s.permissions.permissions?.formPermissions?.services || {});
  const on = (f: string) => perms[f] !== false;
  const { addService, updateService } = useServiceMasterMutations();
  const { data: own } = useServiceByIdQuery(id);
  const { data: catData } = useCategoriesQuery();
  const { data: ledgerData } = useAccountLedgersQuery();
  const { data: staffData } = useStaffListQuery();
  const { data: productData } = useProductServicesQuery();
  const goods = useMemo(() => (productData?.getProductServices || []).filter((p: any) => !p.isservice), [productData]);
  const addCategory = useAddNew("/categories", ["GetCategories"]);
  const addLedger = useAddNew("/accountledgers", ["GetAccountLedgers"]);

  const ledgers: any[] = ledgerData?.getAccountLedgers || [];
  const autoLedger = ledgers.find((l: any) => /^service\s*(sales|account|income)?$/i.test(String(l.ledgername || "").trim()))?.id || "";
  const [g, setG] = useState({ name: "", categoryid: "", serviceaccountid: "", description: "", status: true });
  const [variants, setVariants] = useState<Variant[]>([blank()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    const s = own?.getServiceById;
    if (!isEdit || !s || filled) return;
    setFilled(true);
    setG({ name: s.name || "", categoryid: s.categoryid?.id || "", serviceaccountid: s.serviceaccountid?.id || "", description: s.description || "", status: s.status !== false });
    setVariants((s.servicevariants || []).length ? s.servicevariants.map(fromSaved) : [blank()]);
  }, [isEdit, own, filled]);
  useEffect(() => {
    if (!isEdit && autoLedger) setG((x) => (x.serviceaccountid ? x : { ...x, serviceaccountid: autoLedger }));
  }, [isEdit, autoLedger]);

  const setV = (i: number, patch: Partial<Variant>) => setVariants((vs) => vs.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  const staffOptions = (staffData?.getStaffAccounts || []).map((s: any) => ({ value: s.id, label: s.name }));

  const save = async () => {
    const e: Record<string, string> = {};
    if (!g.name.trim()) e.name = "Name is required";
    variants.forEach((v, i) => {
      if (!(Number(v.servicerate) >= 0) || v.servicerate === "") e[`v${i}rate`] = "Rate is required";
    });
    setErrors(e);
    if (Object.keys(e).length) return;
    const input: any = {
      name: g.name.trim(),
      description: on("description") ? g.description : undefined,
      categoryid: on("categoryid") && g.categoryid ? g.categoryid : undefined,
      serviceaccountid: on("serviceaccount") && g.serviceaccountid ? g.serviceaccountid : undefined,
      status: g.status,
      servicevariants: variants.map((v) => ({
        name: v.name.trim() || g.name.trim(),
        servicecode: v.servicecode,
        servicebarcode: v.servicebarcode,
        servicerate: Number(v.servicerate) || 0,
        pricingunit: v.pricingunit || undefined,
        gst: num(v.gst),
        saccode: v.saccode.trim() || undefined,
        taxinclusive: v.taxinclusive || undefined,
        visitcharge: num(v.visitcharge),
        uom: v.uom || undefined,
        duration: { amount: Number(v.durationAmount) || 0, unit: v.durationUnit || "minutes" },
        bufferminutes: num(v.bufferminutes),
        capacity: num(v.capacity),
        requiresappointment: v.requiresappointment,
        locationType: v.locationType,
        staffids: v.staffids.length ? v.staffids : undefined,
        commission: num(v.commission),
        nextduedays: num(v.nextduedays),
        warrantydays: num(v.warrantydays),
        isRecurring: v.isRecurring,
        recurrence: { interval: v.recurrenceInterval, count: Number(v.recurrenceCount) || 1 },
        materials: mfgInput(v.materials).map(({ productserviceid, variantid, salesunitid, qty }) => ({ productserviceid, variantid, salesunitid, qty })),
        checklist: v.checklist.split("\n").map((x) => x.trim()).filter(Boolean),
        remarks: v.remarks || undefined,
        availabilityslots: v.slots.flatMap((s) => s.day.map((day) => ({ day, from: s.from, to: s.to }))),
      })),
    };
    setSaving(true);
    try {
      if (isEdit && id) {
        const r = await updateService({ variables: { id, input, expectedUpdatedAt: own?.getServiceById?.updatedAt } });
        dispatch(showMessage({ message: savedOffline(r?.data?.updateService) ? OFFLINE_SAVED_MESSAGE : "Service updated.", type: "success" }));
      } else {
        const r = await addService({ variables: { input } });
        dispatch(showMessage({ message: isOfflineSaved(r?.data?.addService) ? OFFLINE_SAVED_MESSAGE : "Service saved.", type: "success" }));
      }
      navigate("/services");
    } catch (err: any) {
      dispatch(showMessage({ message: err?.message || "Could not save the service.", type: "error" }));
    } finally {
      setSaving(false);
    }
  };

  const grid = "grid grid-cols-1 gap-x-3 gap-y-2 md:grid-cols-5";
  const field = (i: number, key: keyof Variant, label: string, type: any = "text") => (
    <FormField label={label} name={`servicevariants.${i}.${String(key)}`} type={type} placeholder={label} value={(variants[i] as any)[key] ?? ""}
      error={key === "servicerate" ? errors[`v${i}rate`] : undefined} onChange={(e: any) => setV(i, { [key]: e.target.value } as any)} />
  );

  return (
    <HomeLayout>
      <FormPage breadcrumb="Services" title={isEdit ? "Edit Service" : "Add Service"} onSave={save} onCancel={() => navigate(-1)}
        saveLabel={isEdit ? "Update Service" : "Add Service"} saveDisabled={saving}>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="space-y-6">
            <fieldset className="border rounded-xl p-4 space-y-4">
              <legend className="text-sm font-medium px-2">General Details</legend>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <FormField label="Name" name="name" type="text" placeholder="Enter service name" value={g.name} error={errors.name}
                  onChange={(e: any) => setG((x) => ({ ...x, name: e.target.value }))} />
                {on("categoryid") && (
                  <FormField label="Category" name="categoryid" type="select" placeholder="Select category" addable onAddNew={addCategory} value={g.categoryid}
                    options={(catData?.getCategories || []).map((c: any) => ({ value: c.id, label: c.categoryname }))}
                    onChange={(e: any) => setG((x) => ({ ...x, categoryid: e.target.value }))} />
                )}
              </div>
              {on("description") && (
                <FormField label="Description" name="description" type="text" multiline placeholder="Enter description" value={g.description}
                  onChange={(e: any) => setG((x) => ({ ...x, description: e.target.value }))} />
              )}
            </fieldset>
          </div>
          <div className="space-y-6">
            <fieldset className="border rounded-xl p-4 space-y-4">
              <legend className="text-sm font-medium px-2">Options</legend>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <FormSwitch label="Status" name="status" checked={g.status} onChange={(v) => setG((x) => ({ ...x, status: v }))} />
              </div>
            </fieldset>
            {on("serviceaccount") && (
              <fieldset className="border rounded-xl p-4 space-y-4">
                <legend className="text-sm font-medium px-2">Accounts</legend>
                <FormField label="Service Account" name="serviceaccountid" type="select" placeholder="Select service account" addable onAddNew={addLedger} value={g.serviceaccountid}
                  options={ledgers.map((l: any) => ({ value: l.id, label: l.ledgername }))}
                  onChange={(e: any) => setG((x) => ({ ...x, serviceaccountid: e.target.value }))} />
              </fieldset>
            )}
          </div>
        </div>

        <div className="mt-3 space-y-6">
          {variants.map((v, i) => (
            <fieldset key={v.id || i} className="border rounded-xl p-4 mb-4 relative">
              <legend className="text-sm font-semibold px-2">Service Variant {i + 1}</legend>
              {variants.length > 1 && (
                <button type="button" onClick={() => setVariants(variants.filter((_, j) => j !== i))}
                  className="absolute top-1.5 right-2 inline-flex h-7 items-center rounded-md border border-rose-200 bg-white px-2.5 text-[12px] font-medium text-rose-600 hover:bg-rose-50">
                  Remove Service Variant
                </button>
              )}

              <Sub title="Price & Tax" first>
                <div className={grid}>
                  {isEdit && v.servicecode && <FormField label="Service Code" name={`v${i}code`} type="text" value={v.servicecode} onChange={() => {}} disabled />}
                  {field(i, "name", "Name")}
                  {field(i, "servicerate", "Service Rate", "number")}
                  {on("pricingunit") && (
                    <FormField label="Price Basis" name={`v${i}basis`} type="select" placeholder="Price Basis" value={v.pricingunit} options={PRICING_UNITS}
                      onChange={(e: any) => setV(i, { pricingunit: e.target.value })} />
                  )}
                  {on("gst") && (
                    <FormField label="GST %" name={`v${i}gst`} type="select" placeholder="GST %" value={String(v.gst ?? "")} options={GST_RATES}
                      onChange={(e: any) => setV(i, { gst: e.target.value })} />
                  )}
                  {on("saccode") && field(i, "saccode", "SAC Code")}
                  {on("visitcharge") && field(i, "visitcharge", "Visit Charge", "number")}
                  {on("uom") && field(i, "uom", "Unit of Measure")}
                  {on("taxinclusive") && <FormSwitch label="Rate Includes GST" name={`v${i}incl`} checked={v.taxinclusive} onChange={(x) => setV(i, { taxinclusive: x })} />}
                </div>
              </Sub>

              <Sub title="Booking">
                <div className={grid}>
                  {on("duration") && field(i, "durationAmount", "Duration", "number")}
                  {on("duration") && (
                    <FormField label="Duration Unit" name={`v${i}durunit`} type="select" value={v.durationUnit}
                      options={[{ value: "minutes", label: "Minutes" }, { value: "hours", label: "Hours" }]} onChange={(e: any) => setV(i, { durationUnit: e.target.value })} />
                  )}
                  {on("bufferminutes") && field(i, "bufferminutes", "Buffer Minutes", "number")}
                  {on("capacity") && field(i, "capacity", "Capacity Per Slot", "number")}
                  {on("locationType") && (
                    <FormField label="Location Type" name={`v${i}where`} type="select" placeholder="Location Type" value={v.locationType} options={WHERE}
                      onChange={(e: any) => setV(i, { locationType: e.target.value })} />
                  )}
                  {on("staffids") && (
                    <div className="md:col-span-2">
                      <FormField label="Allowed Staff" name={`v${i}staff`} type="multiselect" placeholder="All staff" value={v.staffids} options={staffOptions}
                        onChange={(e: any) => setV(i, { staffids: e.target.value || [] })} />
                    </div>
                  )}
                  {on("commission") && field(i, "commission", "Staff Commission %", "number")}
                  {on("requiresappointment") && <FormSwitch label="Requires Appointment" name={`v${i}appt`} checked={v.requiresappointment} onChange={(x) => setV(i, { requiresappointment: x })} />}
                </div>
              </Sub>

              {on("availabilityslots") && (
                <Sub title="Availability Slots">
                  {v.slots.map((s, k) => (
                    <div key={k} className="grid grid-cols-1 items-end gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 md:grid-cols-[2fr_1fr_1fr_auto]">
                      <FormField label="Day" name={`v${i}s${k}day`} type="multiselect" placeholder="Day" value={s.day} options={DAYS}
                        onChange={(e: any) => setV(i, { slots: v.slots.map((x, j) => (j === k ? { ...x, day: e.target.value || [] } : x)) })} />
                      <FormField label="From" name={`v${i}s${k}from`} type="time" value={s.from} onChange={(e: any) => setV(i, { slots: v.slots.map((x, j) => (j === k ? { ...x, from: e.target.value } : x)) })} />
                      <FormField label="To" name={`v${i}s${k}to`} type="time" value={s.to} onChange={(e: any) => setV(i, { slots: v.slots.map((x, j) => (j === k ? { ...x, to: e.target.value } : x)) })} />
                      <button type="button" title="Remove" className="flex h-8 w-8 items-center justify-center rounded-md border border-rose-200 bg-white text-rose-600 hover:bg-rose-50" onClick={() => setV(i, { slots: v.slots.filter((_, j) => j !== k) })}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setV(i, { slots: [...v.slots, { day: [], from: "", to: "" }] })}
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-dashed border-slate-300 bg-white px-2.5 text-[12px] font-medium text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50">
                    <Plus size={12} /> Add Slot
                  </button>
                </Sub>
              )}

              <Sub title="After Service">
                <div className={grid}>
                  {on("nextduedays") && field(i, "nextduedays", "Next Service Due (Days)", "number")}
                  {on("warrantydays") && field(i, "warrantydays", "Warranty (Days)", "number")}
                  {on("isRecurring") && <FormSwitch label="Is Recurring" name={`v${i}rec`} checked={v.isRecurring} onChange={(x) => setV(i, { isRecurring: x })} />}
                  {on("isRecurring") && v.isRecurring && (
                    <FormField label="Recurrence Interval" name={`v${i}rint`} type="select" value={v.recurrenceInterval}
                      options={[{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }]} onChange={(e: any) => setV(i, { recurrenceInterval: e.target.value })} />
                  )}
                  {on("isRecurring") && v.isRecurring && field(i, "recurrenceCount", "Recurrence Count", "number")}
                  {on("remarks") && field(i, "remarks", "Remarks")}
                </div>
                {on("checklist") && (
                  <FormField label="Checklist" name={`v${i}check`} type="text" multiline placeholder="One item per line" value={v.checklist}
                    onChange={(e: any) => setV(i, { checklist: e.target.value })} />
                )}
              </Sub>

              {on("materials") && (
                <MfgLines bare title="Materials Used" lines={v.materials} setLines={(l) => setV(i, { materials: l })} products={goods} />
              )}
            </fieldset>
          ))}

          <button type="button" onClick={() => setVariants([...variants, blank()])}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-dashed border-slate-300 bg-white px-2.5 text-[12px] font-medium text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50">
            + Add Service Variant
          </button>
        </div>
      </FormPage>
    </HomeLayout>
  );
};

export default AddEditService;
