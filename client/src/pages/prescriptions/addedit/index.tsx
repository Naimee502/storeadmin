import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { Copy, Plus, Trash2 } from "lucide-react";
import FormField from "../../../components/formfiled";
import FormPage from "../../../components/formpage";
import HomeLayout from "../../../layouts/home";
import { PartyQuickAdd } from "../../../components/posaddcustomer";
import { useAccountsLiteQuery } from "../../../graphql/hooks/accounts";
import { useProductServicesPickerQuery } from "../../../graphql/hooks/products";
import { useStaffListQuery } from "../../../graphql/hooks/staffaccounts";
import { addDaysYMD, usePrescriptionByIdQuery, usePrescriptionsQuery, useServiceBranch, useServiceMutations } from "../../../graphql/hooks/service";
import { useAddNew, ITEM_QUERIES } from "../../../hooks/useaddnew";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";
import { partyLabel } from "../../../utils/partylabel";
import { formatDateDMY, todayYMD } from "../../../utils/helper";
import { FormRules } from "../../../hooks/useformmode";
import { TIMING, printPrescription, rxNo } from "..";
import { useCompany } from "../../deliverychallan";

const idOf = (v: any) => (v && typeof v === "object" ? v.id : v) || "";
const OWNER = "__owner";
const FREQ = ["1-0-1", "1-0-0", "0-0-1", "0-1-0", "1-1-1", "1-1-1-1", "SOS", "Once a week"];
const EMPTY_MED = { productserviceid: "", name: "", dose: "", frequency: "1-0-1", timing: "after", days: "5", qty: "", notes: "" };
const VITALS: [string, string][] = [["bp", "BP"], ["pulse", "Pulse"], ["temperature", "Temperature"], ["weight", "Weight"], ["spo2", "SpO2"], ["sugar", "Sugar"]];

const AddEditPrescription = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const appointment = (useLocation().state as any)?.appointment;
  const branchId = useServiceBranch();
  const auth = useAppSelector((s: any) => s.auth);
  const settings = useAppSelector((s: any) => s.adminsettings.settings);
  const company = useCompany();
  const { addPrescription, editPrescription } = useServiceMutations();
  const { data: own } = usePrescriptionByIdQuery(id);
  const { data: accountData } = useAccountsLiteQuery();
  const partyOptions = useMemo(() => (accountData?.getAccounts || []).map((a: any) => ({ value: a.id, label: partyLabel(a) })), [accountData]);
  const { data: staffData } = useStaffListQuery();
  const { data: productData } = useProductServicesPickerQuery();
  const addItem = useAddNew("/products/addedit", ITEM_QUERIES);
  const [partyOpen, setPartyOpen] = useState(false);

  const isStaff = String(auth?.type || "").toLowerCase() === "staff";
  const doctors = (staffData?.getStaffAccounts || []).filter((s: any) => s.doctor && s.status !== false);
  const ownerName = settings?.ownerDoctor?.name || auth?.admin?.name || "Owner";
  const doctorOptions = [{ value: OWNER, label: `${ownerName} (Owner)` }, ...doctors.map((d: any) => ({ value: d.id, label: [d.name, d.doctor?.specialization].filter(Boolean).join(" - ") }))];
  const items = useMemo(() => (productData?.getProductServices || []).filter((p: any) => !p.isservice), [productData]);
  const itemOptions = useMemo(() => items.map((p: any) => ({ value: p.id, label: p.name })), [items]);

  const [f, setF] = useState<any>({
    partyacc: "", customername: "", customermobile: "", staffid: isStaff ? auth?.staff?.id || "" : OWNER, billdate: todayYMD(), appointmentid: "",
    complaints: "", diagnosis: "", vitals: {}, medicines: [{ ...EMPTY_MED }], tests: "", advice: "", nextvisit: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [filled, setFilled] = useState(false);
  const set = (k: string) => (e: any) => setF((x: any) => ({ ...x, [k]: e.target.value }));
  const setVital = (k: string, v: string) => setF((x: any) => ({ ...x, vitals: { ...x.vitals, [k]: v } }));
  const setMed = (i: number, k: string, v: any) => setF((x: any) => ({ ...x, medicines: x.medicines.map((m: any, j: number) => (j === i ? { ...m, [k]: v } : m)) }));
  const medsFrom = (list: any[]) => (list || []).map((m: any) => ({ ...EMPTY_MED, ...m, productserviceid: idOf(m.productserviceid), days: m.days ?? "", qty: m.qty ?? "", dose: m.dose || "", notes: m.notes || "" }));

  // Edit: load the saved prescription. New from an appointment: patient, doctor and date from the visit.
  useEffect(() => {
    if (filled) return;
    const r = own?.getPrescriptionById;
    if (isEdit && r) {
      setFilled(true);
      setF({
        partyacc: idOf(r.partyacc), customername: r.customername || "", customermobile: r.customermobile || "", staffid: idOf(r.staffid) || OWNER,
        billdate: r.billdate, appointmentid: r.appointmentid || "", complaints: r.complaints || "", diagnosis: r.diagnosis || "",
        vitals: r.vitals ? { ...r.vitals, __typename: undefined } : {}, medicines: medsFrom(r.medicines).length ? medsFrom(r.medicines) : [{ ...EMPTY_MED }],
        tests: r.tests || "", advice: r.advice || "", nextvisit: r.nextvisit || "",
      });
    } else if (!isEdit && appointment) {
      setFilled(true);
      const doc = appointment.staffid?.id && doctors.some((d: any) => d.id === appointment.staffid.id) ? appointment.staffid.id : undefined;
      setF((x: any) => ({ ...x, partyacc: idOf(appointment.partyacc), customername: appointment.customername || "", customermobile: appointment.customermobile || "",
        appointmentid: appointment.id, billdate: appointment.billdate || x.billdate, staffid: doc || x.staffid, complaints: appointment.notes || "" }));
    }
  }, [isEdit, own, appointment, filled, doctors.length]);

  // Earlier visits of this patient, to see what was given and copy it.
  const { data: pastData } = usePrescriptionsQuery({ partyacc: f.partyacc }, !f.partyacc);
  const past = useMemo(() => (pastData?.getPrescriptions || []).filter((r: any) => r.id !== id).slice(0, 3), [pastData, id]);

  const save = async () => {
    const e: Record<string, string> = {};
    if (!f.partyacc && !f.customername.trim()) e.customer = "Pick a patient or type the name";
    if (f.nextvisit && f.nextvisit < f.billdate) e.nextvisit = "Next visit is before the date";
    setErrors(e);
    if (Object.keys(e).length) return;
    const num = (v: any) => (v === "" || v === null || v === undefined ? null : Number(v));
    const { __typename, ...vitals } = f.vitals || {};
    const input: any = {
      partyacc: f.partyacc || null, customername: f.partyacc ? "" : f.customername.trim(), customermobile: f.partyacc ? "" : f.customermobile.trim(),
      staffid: f.staffid && f.staffid !== OWNER ? f.staffid : null, billdate: f.billdate, appointmentid: f.appointmentid || null,
      complaints: f.complaints, diagnosis: f.diagnosis, vitals, tests: f.tests, advice: f.advice, nextvisit: f.nextvisit || null, branchid: branchId || undefined,
      medicines: f.medicines.filter((m: any) => m.name.trim()).map((m: any) => ({
        productserviceid: m.productserviceid || null, name: m.name.trim(), dose: m.dose, frequency: m.frequency, timing: m.timing, days: num(m.days), qty: num(m.qty), notes: m.notes,
      })),
    };
    setSaving(true);
    try {
      const r = isEdit && id
        ? (await editPrescription({ variables: { id, input, expectedUpdatedAt: own?.getPrescriptionById?.updatedAt } }))?.data?.editPrescription
        : (await addPrescription({ variables: { input } }))?.data?.addPrescription;
      dispatch(showMessage({ message: `${rxNo(r)} saved.`, type: "success" }));
      if (r && window.confirm("Print this prescription now?")) printPrescription(r, company, settings);
      navigate("/prescriptions");
    } catch (err: any) {
      dispatch(showMessage({ message: err?.message || "Could not save the prescription.", type: "error" }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <HomeLayout>
      <FormPage breadcrumb="Prescriptions" title={isEdit ? "Edit Prescription" : "Write Prescription"} onSave={save} onCancel={() => navigate(-1)}
        saveLabel={isEdit ? "Update Prescription" : "Save Prescription"} saveDisabled={saving}>
        <form onSubmit={(ev) => ev.preventDefault()} className="space-y-6">
          <fieldset className="border rounded-xl p-4 space-y-4">
            <legend className="text-sm font-medium px-2">Patient &amp; Visit</legend>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <FormField label="Patient" name="partyacc" type="select" searchable addable onAddNew={() => setPartyOpen(true)} error={errors.customer} value={f.partyacc}
                  options={partyOptions} onChange={set("partyacc")} />
              </div>
              {!f.partyacc && <FormField label="Patient Name" name="customername" type="text" value={f.customername} onChange={set("customername")} />}
              {!f.partyacc && <FormField label="Mobile" name="customermobile" type="tel" value={f.customermobile} onChange={set("customermobile")} />}
              <FormField label="Doctor" name="staffid" type="select" searchable value={f.staffid} options={doctorOptions} onChange={set("staffid")} disabled={isStaff} />
              <FormField label="Date" name="billdate" type="date" value={f.billdate} onChange={set("billdate")} />
              <div className="md:col-span-2"><FormField label="Complaints" name="complaints" type="text" value={f.complaints} placeholder="Fever, cough for 3 days" onChange={set("complaints")} /></div>
              <div className="md:col-span-2"><FormField label="Diagnosis" name="diagnosis" type="text" value={f.diagnosis} onChange={set("diagnosis")} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {VITALS.map(([k, label]) => (
                <FormField key={k} label={label} name={`vital_${k}`} type="text" value={f.vitals?.[k] || ""} onChange={(e: any) => setVital(k, e.target.value)} />
              ))}
            </div>
          </fieldset>

          {past.length > 0 && (
            <fieldset className="border rounded-xl p-4 space-y-2">
              <legend className="text-sm font-medium px-2">Earlier Visits</legend>
              {past.map((r: any) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2 text-[13px]">
                  <span className="text-slate-700">
                    <b>{formatDateDMY(r.billdate)}</b> · {r.doctorname || "—"} · {r.diagnosis || r.complaints || "—"}
                    <span className="text-slate-500"> · {(r.medicines || []).map((m: any) => m.name).join(", ") || "No medicines"}</span>
                  </span>
                  {(r.medicines || []).length > 0 && (
                    <button type="button" onClick={() => setF((x: any) => ({ ...x, medicines: medsFrom(r.medicines) }))}
                      className="inline-flex h-7 items-center gap-1 rounded border border-indigo-200 bg-white px-2 text-[12px] font-medium text-indigo-700 hover:bg-indigo-50">
                      <Copy size={12} /> Copy Medicines
                    </button>
                  )}
                </div>
              ))}
            </fieldset>
          )}

          <fieldset className="border rounded-xl p-4 space-y-3">
            <legend className="text-sm font-medium px-2">Medicines</legend>
            {f.medicines.map((m: any, i: number) => (
              <div key={i} className="grid grid-cols-2 items-end gap-2 rounded-md border border-slate-200 p-2 md:grid-cols-12">
                <div className="col-span-2 md:col-span-3">
                  <FormField label="Item (optional)" name={`med_item_${i}`} type="select" searchable addable onAddNew={addItem} value={m.productserviceid}
                    options={itemOptions}
                    onChange={(e: any) => { const p = items.find((x: any) => x.id === e.target.value); setMed(i, "productserviceid", e.target.value); if (p) setMed(i, "name", p.name); }} />
                </div>
                <div className="col-span-2 md:col-span-3"><FormField label="Medicine" name={`med_name_${i}`} type="text" value={m.name} placeholder="Tab. Paracetamol 500" onChange={(e: any) => setMed(i, "name", e.target.value)} /></div>
                <FormField label="Dose" name={`med_dose_${i}`} type="text" value={m.dose} placeholder="1 tab" onChange={(e: any) => setMed(i, "dose", e.target.value)} />
                <div className="md:col-span-2">
                  <FormField label="When" name={`med_freq_${i}`} type="select" searchable value={m.frequency}
                    options={[...new Set([...FREQ, m.frequency].filter(Boolean))].map((x) => ({ value: x, label: x }))} onChange={(e: any) => setMed(i, "frequency", e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <FormField label="Food" name={`med_timing_${i}`} type="select" searchable value={m.timing}
                    options={Object.entries(TIMING).map(([value, label]) => ({ value, label }))} onChange={(e: any) => setMed(i, "timing", e.target.value)} />
                </div>
                <div className="flex items-end gap-1">
                  <div className="flex-1"><FormField label="Days" name={`med_days_${i}`} type="number" value={m.days} onChange={(e: any) => setMed(i, "days", e.target.value)} /></div>
                  <button type="button" title="Remove" onClick={() => setF((x: any) => ({ ...x, medicines: x.medicines.filter((_: any, j: number) => j !== i) }))}
                    className="grid h-8 w-8 place-items-center rounded-md border border-slate-300 text-rose-600 hover:bg-rose-50"><Trash2 size={14} /></button>
                </div>
                <div className="col-span-2 md:col-span-12"><FormField label="Note" name={`med_notes_${i}`} type="text" value={m.notes} placeholder="Optional" onChange={(e: any) => setMed(i, "notes", e.target.value)} /></div>
              </div>
            ))}
            <button type="button" onClick={() => setF((x: any) => ({ ...x, medicines: [...x.medicines, { ...EMPTY_MED }] }))}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 text-[13px] font-medium text-indigo-700 hover:bg-indigo-100">
              <Plus size={14} /> Add Medicine
            </button>
          </fieldset>

          <fieldset className="border rounded-xl p-4 space-y-4">
            <legend className="text-sm font-medium px-2">Advice &amp; Follow Up</legend>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2"><FormField label="Tests" name="tests" type="text" value={f.tests} placeholder="CBC, Blood Sugar" onChange={set("tests")} /></div>
              <div className="md:col-span-2"><FormField label="Advice" name="advice" type="text" value={f.advice} placeholder="Rest, drink fluids" onChange={set("advice")} /></div>
              <FormField label="Next Visit" name="nextvisit" type="date" value={f.nextvisit} error={errors.nextvisit} onChange={set("nextvisit")} />
              <div className="md:col-span-3 flex items-end gap-1.5">
                {[3, 7, 15, 30].map((d) => (
                  <button key={d} type="button" onClick={() => setF((x: any) => ({ ...x, nextvisit: addDaysYMD(x.billdate, d) }))}
                    className="h-8 rounded-md border border-slate-300 px-2.5 text-[12px] text-slate-700 hover:bg-slate-50">+{d} Days</button>
                ))}
              </div>
            </div>
            <p className="text-[12px] text-slate-500">The patient gets a reminder a day before the next visit (App &amp; Website).</p>
          </fieldset>
        </form>
        <PartyQuickAdd open={partyOpen} onClose={() => setPartyOpen(false)} onPicked={(pid) => set("partyacc")({ target: { value: pid } })} />
      </FormPage>
    </HomeLayout>
  );
};

const AddEditPrescriptionWithRules = (props: any) => (
  <FormRules module="prescriptions">
    <AddEditPrescription {...props} />
  </FormRules>
);

export default AddEditPrescriptionWithRules;
