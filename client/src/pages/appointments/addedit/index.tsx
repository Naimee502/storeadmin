import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import FormField from "../../../components/formfiled";
import FormPage from "../../../components/formpage";
import ServiceLines, { type SvcLine, serviceMinutes, svcInput, toSvcLines } from "../../../components/servicelines";
import HomeLayout from "../../../layouts/home";
import { PARTY_QUERIES, useAddNew } from "../../../hooks/useaddnew";
import { useAccountsLiteQuery } from "../../../graphql/hooks/accounts";
import { useProductServicesQuery } from "../../../graphql/hooks/products";
import { useStaffListQuery } from "../../../graphql/hooks/staffaccounts";
import {
  sessionsLeft, useAppointmentByIdQuery, useAppointmentsQuery, useMembershipsQuery, useServiceBranch, useServiceMutations,
} from "../../../graphql/hooks/service";
import { useAppDispatch } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";
import { partyLabel } from "../../../utils/partylabel";
import { todayYMD } from "../../../utils/helper";
import { OFFLINE_SAVED_MESSAGE, isOfflineSaved, savedOffline } from "../../../offline/billing";

const idOf = (v: any) => (v && typeof v === "object" ? v.id : v) || null;
const DURATIONS = [15, 30, 45, 60, 90, 120, 180].map((m) => ({ value: String(m), label: m < 60 ? `${m} min` : `${m / 60} hr${m > 60 ? "s" : ""}` }));

const AddEditAppointment = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const date = new URLSearchParams(useLocation().search).get("date");
  const navigate = useNavigate();
  const addParty = useAddNew("/accounts/addedit", PARTY_QUERIES);
  const dispatch = useAppDispatch();
  const branchId = useServiceBranch();
  const { addAppointment, editAppointment } = useServiceMutations();
  const { data: own } = useAppointmentByIdQuery(id);
  const { data: accountData } = useAccountsLiteQuery();
  const accounts = accountData?.getAccounts || [];
  const { data: staffData } = useStaffListQuery();
  const { data: productData } = useProductServicesQuery();
  const products = productData?.getProductServices || [];

  const [f, setF] = useState({ partyacc: "", customername: "", customermobile: "", staffid: "", billdate: date || todayYMD(), starttime: "10:00", duration: "30", membershipid: "", notes: "" });
  const [services, setServices] = useState<SvcLine[]>([{ productserviceid: null, qty: 1, rate: 0 }]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [filled, setFilled] = useState(false);
  const set = (k: keyof typeof f) => (e: any) => setF((x) => ({ ...x, [k]: e.target.value }));

  const { data: memberData } = useMembershipsQuery(f.partyacc ? { partyacc: f.partyacc } : {}, !f.partyacc && !f.customermobile);
  const { data: apptData } = useAppointmentsQuery({}, !f.membershipid);
  const memberships = (memberData?.getMemberships || []).filter((m: any) =>
    m.memberStatus !== "cancelled" && (f.partyacc ? idOf(m.partyacc) === f.partyacc : m.customermobile && m.customermobile === f.customermobile));

  useEffect(() => {
    const a = own?.getAppointmentById;
    if (!isEdit || !a || filled) return;
    setFilled(true);
    setF({
      partyacc: idOf(a.partyacc) || "", customername: a.customername || "", customermobile: a.customermobile || "", staffid: idOf(a.staffid) || "",
      billdate: a.billdate, starttime: a.starttime, duration: String(a.duration || 30), membershipid: a.membershipid || "", notes: a.notes || "",
    });
    setServices(toSvcLines(a.services));
  }, [isEdit, own, filled]);

  // Staff limited to those every picked service allows (a service with no list allows all).
  const allowed = services
    .map((l) => products.find((p: any) => p.id === l.productserviceid)?.servicevariants?.find((v: any) => v.id === l.variantid)?.staffids)
    .filter((ids: any) => ids?.length);
  const staffOptions = (staffData?.getStaffAccounts || [])
    .filter((s: any) => allowed.every((ids: string[]) => ids.includes(s.id)) || s.id === f.staffid)
    .map((s: any) => ({ value: s.id, label: s.name }));

  // Duration follows the services picked, when they carry one.
  const setLines = (l: SvcLine[]) => {
    setServices(l);
    const mins = l.reduce((s, x) => s + serviceMinutes(products.find((p: any) => p.id === x.productserviceid), x.variantid) * (Number(x.qty) || 1), 0);
    if (mins > 0) setF((x) => ({ ...x, duration: String(mins) }));
  };

  const save = async () => {
    const e: Record<string, string> = {};
    if (!f.partyacc && !f.customername.trim()) e.customer = "Pick a party or type the customer name";
    if (!f.billdate) e.billdate = "Date is required";
    if (!/^\d{2}:\d{2}$/.test(f.starttime)) e.starttime = "Pick a time";
    setErrors(e);
    if (Object.keys(e).length) return;
    const input: any = {
      partyacc: f.partyacc || null,
      customername: f.partyacc ? "" : f.customername.trim(),
      customermobile: f.partyacc ? "" : f.customermobile.trim(),
      staffid: f.staffid || null,
      billdate: f.billdate,
      starttime: f.starttime,
      duration: Number(f.duration) || 30,
      membershipid: f.membershipid || null,
      services: svcInput(services),
      notes: f.notes || undefined,
      branchid: branchId || undefined,
    };
    setSaving(true);
    try {
      if (isEdit && id) {
        const r = await editAppointment({ variables: { id, input, expectedUpdatedAt: own?.getAppointmentById?.updatedAt } });
        dispatch(showMessage({ message: savedOffline(r?.data?.editAppointment) ? OFFLINE_SAVED_MESSAGE : "Appointment updated.", type: "success" }));
      } else {
        const r = await addAppointment({ variables: { input } });
        dispatch(showMessage({ message: isOfflineSaved(r?.data?.addAppointment) ? OFFLINE_SAVED_MESSAGE : "Appointment booked.", type: "success" }));
      }
      navigate("/appointments");
    } catch (err: any) {
      dispatch(showMessage({ message: err?.message || "Could not save the appointment.", type: "error" }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <HomeLayout>
      <FormPage breadcrumb="Appointments" title={isEdit ? "Edit Appointment" : "Book Appointment"} onSave={save} onCancel={() => navigate(-1)}
        saveLabel={isEdit ? "Update Appointment" : "Save Appointment"} saveDisabled={saving}>
        <form onSubmit={(ev) => ev.preventDefault()} className="space-y-6">
          <fieldset className="border rounded-xl p-4 space-y-4">
            <legend className="text-sm font-medium px-2">Customer &amp; Slot</legend>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <FormField label="Party" name="partyacc" type="select" searchable addable onAddNew={addParty} error={errors.customer} value={f.partyacc}
                  options={accounts.map((a: any) => ({ value: a.id, label: partyLabel(a) }))}
                  onChange={(e: any) => setF((x) => ({ ...x, partyacc: e.target.value || "", membershipid: "" }))} />
              </div>
              {!f.partyacc && <FormField label="Walk-in Name" name="customername" type="text" value={f.customername} onChange={set("customername")} />}
              {!f.partyacc && <FormField label="Mobile" name="customermobile" type="tel" value={f.customermobile} onChange={set("customermobile")} />}
              <FormField label="Staff" name="staffid" type="select" searchable options={staffOptions} value={f.staffid} onChange={set("staffid")} />
              <FormField label="Date" name="billdate" type="date" value={f.billdate} error={errors.billdate} onChange={set("billdate")} />
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[12px] font-medium text-slate-600">Start Time</span>
                  <input type="time" className="h-8 rounded-md border border-slate-300 px-2 text-[13px]" value={f.starttime} onChange={set("starttime")} />
                  {errors.starttime && <span className="text-[11px] text-rose-600">{errors.starttime}</span>}
                </div>
                <FormField label="Duration" name="duration" type="select" searchable value={f.duration}
                  options={DURATIONS.some((d) => d.value === f.duration) ? DURATIONS : [...DURATIONS, { value: f.duration, label: `${f.duration} min` }]}
                  onChange={set("duration")} />
              </div>
              {memberships.length > 0 && (
                <FormField label="Use Membership" name="membershipid" type="select" searchable value={f.membershipid}
                  options={memberships.map((m: any) => {
                    const left = sessionsLeft(m, apptData?.getAppointments || []);
                    return { value: m.id, label: `${m.planid?.name || "Plan"}${left === null ? "" : ` - ${left} left`}` };
                  })}
                  onChange={set("membershipid")} />
              )}
            </div>
          </fieldset>

          <ServiceLines title="Services" lines={services} setLines={setLines} products={products} kind="service"
            hint="Duration fills from the services' own duration; one staff member cannot be booked twice in the same slot." />

          <fieldset className="border rounded-xl p-4">
            <legend className="text-sm font-medium px-2">Notes</legend>
            <FormField label="" name="notes" type="text" multiline value={f.notes} onChange={set("notes")} />
          </fieldset>
        </form>
      </FormPage>
    </HomeLayout>
  );
};

export default AddEditAppointment;
