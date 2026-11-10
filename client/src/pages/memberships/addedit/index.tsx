import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import FormField from "../../../components/formfiled";
import FormPage from "../../../components/formpage";
import HomeLayout from "../../../layouts/home";
import { PARTY_QUERIES, useAddNew } from "../../../hooks/useaddnew";
import { useAccountsLiteQuery } from "../../../graphql/hooks/accounts";
import { addDaysYMD, useMembershipByIdQuery, useMembershipPlansQuery, useServiceBranch, useServiceMutations } from "../../../graphql/hooks/service";
import { useAppDispatch } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";
import { partyLabel } from "../../../utils/partylabel";
import { todayYMD } from "../../../utils/helper";
import { OFFLINE_SAVED_MESSAGE, isOfflineSaved, savedOffline } from "../../../offline/billing";

const idOf = (v: any) => (v && typeof v === "object" ? v.id : v) || null;

const AddEditMembership = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const addParty = useAddNew("/accounts/addedit", PARTY_QUERIES);
  const dispatch = useAppDispatch();
  const branchId = useServiceBranch();
  const { addMembership, editMembership } = useServiceMutations();
  const { data: own } = useMembershipByIdQuery(id);
  const { data: accountData } = useAccountsLiteQuery();
  const { data: planData } = useMembershipPlansQuery();
  const plans = planData?.getMembershipPlans || [];

  const [f, setF] = useState({ planid: "", partyacc: "", customername: "", customermobile: "", startdate: todayYMD(), enddate: "", sessions: "", amount: "", memberStatus: "active", notes: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [filled, setFilled] = useState(false);
  const set = (k: keyof typeof f) => (e: any) => setF((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => {
    const m = own?.getMembershipById;
    if (!isEdit || !m || filled) return;
    setFilled(true);
    setF({
      planid: idOf(m.planid) || "", partyacc: idOf(m.partyacc) || "", customername: m.customername || "", customermobile: m.customermobile || "",
      startdate: m.startdate, enddate: m.enddate || "", sessions: m.sessions ? String(m.sessions) : "", amount: m.amount ? String(m.amount) : "",
      memberStatus: m.memberStatus || "active", notes: m.notes || "",
    });
  }, [isEdit, own, filled]);

  // Picking a plan fills sessions, price and the end date from its validity.
  const pickPlan = (planid: string, startdate = f.startdate) => {
    const p = plans.find((x: any) => x.id === planid);
    setF((x) => ({
      ...x, planid, startdate,
      sessions: p?.sessions ? String(p.sessions) : "",
      amount: p?.price ? String(p.price) : x.amount,
      enddate: p?.validitydays ? addDaysYMD(startdate, Number(p.validitydays) - 1) : x.enddate,
    }));
  };

  const save = async () => {
    const e: Record<string, string> = {};
    if (!f.planid) e.planid = "Pick a plan";
    if (!f.partyacc && !f.customername.trim()) e.customer = "Pick a party or type the member name";
    if (f.enddate && f.enddate < f.startdate) e.enddate = "Valid till is before the start date";
    setErrors(e);
    if (Object.keys(e).length) return;
    const input: any = {
      planid: f.planid, partyacc: f.partyacc || null,
      customername: f.partyacc ? "" : f.customername.trim(), customermobile: f.partyacc ? "" : f.customermobile.trim(),
      startdate: f.startdate, enddate: f.enddate || null, sessions: f.sessions ? Number(f.sessions) : null,
      amount: f.amount ? Number(f.amount) : null, memberStatus: f.memberStatus, notes: f.notes || undefined, branchid: branchId || undefined,
    };
    setSaving(true);
    try {
      if (isEdit && id) {
        const r = await editMembership({ variables: { id, input, expectedUpdatedAt: own?.getMembershipById?.updatedAt } });
        dispatch(showMessage({ message: savedOffline(r?.data?.editMembership) ? OFFLINE_SAVED_MESSAGE : "Membership updated.", type: "success" }));
      } else {
        const r = await addMembership({ variables: { input } });
        dispatch(showMessage({ message: isOfflineSaved(r?.data?.addMembership) ? OFFLINE_SAVED_MESSAGE : "Membership saved.", type: "success" }));
      }
      navigate("/memberships");
    } catch (err: any) {
      dispatch(showMessage({ message: err?.message || "Could not save the membership.", type: "error" }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <HomeLayout>
      <FormPage breadcrumb="Memberships" title={isEdit ? "Edit Membership" : "Sell Membership"} onSave={save} onCancel={() => navigate(-1)}
        saveLabel={isEdit ? "Update Membership" : "Save Membership"} saveDisabled={saving}>
        <form onSubmit={(ev) => ev.preventDefault()} className="space-y-6">
          <fieldset className="border rounded-xl p-4 space-y-4">
            <legend className="text-sm font-medium px-2">Membership</legend>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <FormField label="Plan" name="planid" type="select" searchable error={errors.planid} value={f.planid}
                  options={plans.map((p: any) => ({ value: p.id, label: p.name }))} onChange={(e: any) => pickPlan(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <FormField label="Party" name="partyacc" type="select" searchable addable onAddNew={addParty} error={errors.customer} value={f.partyacc}
                  options={(accountData?.getAccounts || []).map((a: any) => ({ value: a.id, label: partyLabel(a) }))} onChange={set("partyacc")} />
              </div>
              {!f.partyacc && <FormField label="Member Name" name="customername" type="text" value={f.customername} onChange={set("customername")} />}
              {!f.partyacc && <FormField label="Mobile" name="customermobile" type="tel" value={f.customermobile} onChange={set("customermobile")} />}
              <FormField label="Start Date" name="startdate" type="date" value={f.startdate} onChange={(e: any) => (f.planid ? pickPlan(f.planid, e.target.value) : set("startdate")(e))} />
              <FormField label="Valid Till" name="enddate" type="date" value={f.enddate} error={errors.enddate} onChange={set("enddate")} />
              <FormField label="Sessions (blank = unlimited)" name="sessions" type="number" value={f.sessions} onChange={set("sessions")} />
              <FormField label="Amount (₹)" name="amount" type="number" value={f.amount} onChange={set("amount")} />
              <FormField label="Status" name="memberStatus" type="select" searchable value={f.memberStatus}
                options={[{ value: "active", label: "Active" }, { value: "cancelled", label: "Cancelled" }]} onChange={set("memberStatus")} />
              <div className="md:col-span-3"><FormField label="Notes" name="notes" type="text" value={f.notes} onChange={set("notes")} /></div>
            </div>
            <p className="text-[12px] text-slate-500">Each appointment marked Done with this membership uses one session.</p>
          </fieldset>
        </form>
      </FormPage>
    </HomeLayout>
  );
};

export default AddEditMembership;
