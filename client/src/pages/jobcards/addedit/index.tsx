import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import FormField from "../../../components/formfiled";
import FormPage from "../../../components/formpage";
import ServiceLines, { type SvcLine, svcInput, svcTotal, toSvcLines } from "../../../components/servicelines";
import HomeLayout from "../../../layouts/home";
import { PARTY_QUERIES, useAddNew } from "../../../hooks/useaddnew";
import { useAccountsLiteQuery } from "../../../graphql/hooks/accounts";
import { useProductServicesQuery } from "../../../graphql/hooks/products";
import { useStaffListQuery } from "../../../graphql/hooks/staffaccounts";
import { jobCardNo, useJobCardByIdQuery, useServiceBranch, useServiceMutations } from "../../../graphql/hooks/service";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";
import { partyLabel } from "../../../utils/partylabel";
import { todayYMD } from "../../../utils/helper";
import { OFFLINE_SAVED_MESSAGE, OfflineNumberNote, isOfflineSaved, savedOffline, useOfflineNumber, useOfflineStock } from "../../../offline/billing";

const idOf = (v: any) => (v && typeof v === "object" ? v.id : v) || null;

const AddEditJobCard = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const addParty = useAddNew("/accounts/addedit", PARTY_QUERIES);
  const dispatch = useAppDispatch();
  const branchId = useServiceBranch();
  const settings = useAppSelector((s: any) => s.adminsettings.settings);
  const { addJobCard, editJobCard } = useServiceMutations();
  const { data: own } = useJobCardByIdQuery(id);
  const { data: accountData } = useAccountsLiteQuery();
  const accounts = accountData?.getAccounts || [];
  const { data: staffData } = useStaffListQuery();
  const { data: productData } = useProductServicesQuery();
  const products = useOfflineStock(productData?.getProductServices ?? [], branchId);
  const { number: offlineNo, noDevice } = useOfflineNumber("jobcard", !isEdit);

  const [f, setF] = useState({
    partyacc: "", customername: "", customermobile: "", billdate: todayYMD(), productserviceid: "", devicename: "", serial: "", problem: "",
    accessories: "", approved: false, approvedAt: "", technicianid: "", promisedate: "", warrantydays: "", notes: "",
  });
  const [estimate, setEstimate] = useState<SvcLine[]>([{ productserviceid: null, qty: 1, rate: 0 }]);
  const [spares, setSpares] = useState<SvcLine[]>([]);
  const [billNumber, setBillNumber] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [filled, setFilled] = useState(false);
  const set = (k: keyof typeof f) => (e: any) => setF((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => {
    const j = own?.getJobCardById;
    if (!isEdit || !j || filled) return;
    setFilled(true);
    setF({
      partyacc: idOf(j.partyacc) || "", customername: j.customername || "", customermobile: j.customermobile || "", billdate: j.billdate,
      productserviceid: idOf(j.productserviceid) || "", devicename: j.devicename || "", serial: j.serial || "", problem: j.problem || "",
      accessories: j.accessories || "", approved: !!j.approved, approvedAt: j.approvedAt || "", technicianid: idOf(j.technicianid) || "",
      promisedate: j.promisedate || "", warrantydays: j.warrantydays ? String(j.warrantydays) : "", notes: j.notes || "",
    });
    setEstimate(toSvcLines(j.estimate));
    setSpares(toSvcLines(j.spares));
    setBillNumber(jobCardNo(j));
  }, [isEdit, own, filled]);
  useEffect(() => {
    if (!isEdit) setBillNumber(offlineNo || "");
  }, [isEdit, offlineNo]);

  const shortSpares = spares.filter((l) => {
    const p = products.find((x: any) => x.id === l.productserviceid);
    const v = p && !p.isservice ? p.productvariants?.find((x: any) => x.id === l.variantid) || p.productvariants?.[0] : null;
    return v && Number(l.qty) > Number(v.currentstock || 0);
  }).length;

  // Warranty fills from the services' own warranty days, when empty.
  const pickEstimate = (l: SvcLine[]) => {
    setEstimate(l);
    const days = Math.max(0, ...l.map((x) => Number(products.find((p: any) => p.id === x.productserviceid)?.servicevariants?.find((v: any) => v.id === x.variantid)?.warrantydays || 0)));
    if (days > 0) setF((x: any) => (x.warrantydays ? x : { ...x, warrantydays: String(days) }));
  };

  const save = async () => {
    const e: Record<string, string> = {};
    if (!f.partyacc && !f.customername.trim()) e.customer = "Pick a party or type the customer name";
    if (!f.billdate) e.billdate = "Date is required";
    if (!f.productserviceid && !f.devicename.trim()) e.device = "Pick the item or type the device";
    if (shortSpares && settings?.allowNegativeStock !== true) e.spares = "Some spares are short of stock";
    setErrors(e);
    if (Object.keys(e).length) return;
    const input: any = {
      partyacc: f.partyacc || null,
      customername: f.partyacc ? "" : f.customername.trim(),
      customermobile: f.partyacc ? "" : f.customermobile.trim(),
      billdate: f.billdate,
      productserviceid: f.productserviceid || null,
      devicename: f.devicename || undefined,
      serial: f.serial || undefined,
      problem: f.problem || undefined,
      accessories: f.accessories || undefined,
      estimate: svcInput(estimate),
      estimatetotal: svcTotal(estimate),
      approved: f.approved,
      approvedAt: f.approved ? f.approvedAt || todayYMD() : null,
      spares: svcInput(spares).filter((l) => l.productserviceid),
      technicianid: f.technicianid || null,
      promisedate: f.promisedate || null,
      warrantydays: f.warrantydays ? Number(f.warrantydays) : null,
      notes: f.notes || undefined,
      branchid: branchId || undefined,
    };
    if (!isEdit && offlineNo) input.billnumber = offlineNo;
    setSaving(true);
    try {
      if (isEdit && id) {
        const r = await editJobCard({ variables: { id, input, expectedUpdatedAt: own?.getJobCardById?.updatedAt } });
        dispatch(showMessage({ message: savedOffline(r?.data?.editJobCard) ? OFFLINE_SAVED_MESSAGE : "Job card updated.", type: "success" }));
      } else {
        const r = await addJobCard({ variables: { input } });
        dispatch(showMessage({ message: isOfflineSaved(r?.data?.addJobCard) ? OFFLINE_SAVED_MESSAGE : "Job card saved.", type: "success" }));
      }
      navigate("/jobcards");
    } catch (err: any) {
      dispatch(showMessage({ message: err?.message || "Could not save the job card.", type: "error" }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <HomeLayout>
      <FormPage breadcrumb="Job Cards" title={isEdit ? `Edit ${billNumber}` : "Add Job Card"} onSave={save} onCancel={() => navigate(-1)}
        saveLabel={isEdit ? "Update Job Card" : "Save Job Card"} saveDisabled={saving}>
        <form onSubmit={(ev) => ev.preventDefault()} className="space-y-6">
          <fieldset className="border rounded-xl p-4 space-y-4">
            <legend className="text-sm font-medium px-2">Customer &amp; Device</legend>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <FormField label="Job No." name="billNumber" type="text" value={billNumber || (isEdit ? "" : "Auto")} onChange={() => {}} disabled />
              <FormField label="Date" name="billdate" type="date" value={f.billdate} error={errors.billdate} onChange={set("billdate")} />
              <div className="md:col-span-2">
                <FormField label="Party" name="partyacc" type="select" searchable addable onAddNew={addParty} error={errors.customer} value={f.partyacc}
                  options={accounts.map((a: any) => ({ value: a.id, label: partyLabel(a) }))} onChange={set("partyacc")} />
              </div>
              <OfflineNumberNote show={!isEdit && noDevice} />
              {!f.partyacc && <FormField label="Walk-in Name" name="customername" type="text" value={f.customername} onChange={set("customername")} />}
              {!f.partyacc && <FormField label="Mobile" name="customermobile" type="tel" value={f.customermobile} onChange={set("customermobile")} />}
              <div className="md:col-span-2">
                <FormField label="Item (from your products)" name="productserviceid" type="select" searchable error={errors.device} value={f.productserviceid}
                  options={products.map((p: any) => ({ value: p.id, label: p.name }))} onChange={set("productserviceid")} />
              </div>
              <FormField label="Device / Model" name="devicename" type="text" value={f.devicename} placeholder="Device / Model" onChange={set("devicename")} />
              <FormField label="Serial / IMEI" name="serial" type="text" value={f.serial} onChange={set("serial")} />
              <div className="md:col-span-2">
                <FormField label="Problem Reported" name="problem" type="text" multiline value={f.problem} onChange={set("problem")} />
              </div>
              <div className="md:col-span-2">
                <FormField label="Accessories Received" name="accessories" type="text" multiline value={f.accessories} placeholder="Accessories Received" onChange={set("accessories")} />
              </div>
            </div>
          </fieldset>

          <ServiceLines title="Estimate" lines={estimate} setLines={pickEstimate} products={products} freeText
            hint="Labour and parts quoted to the customer; Make Sales Invoice copies these lines." />

          <fieldset className="border rounded-xl p-4 space-y-4">
            <legend className="text-sm font-medium px-2">Approval &amp; Work</legend>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <label className="flex items-end gap-2 pb-1.5 text-[13px] text-slate-700">
                <button type="button" role="switch" aria-checked={f.approved} onClick={() => setF((x) => ({ ...x, approved: !x.approved, approvedAt: !x.approved ? x.approvedAt || todayYMD() : "" }))}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${f.approved ? "bg-emerald-500" : "bg-slate-300"}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${f.approved ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                </button>
                Customer Approved Estimate
              </label>
              {f.approved && <FormField label="Approved On" name="approvedAt" type="date" value={f.approvedAt} onChange={set("approvedAt")} />}
              <FormField label="Technician" name="technicianid" type="select" searchable value={f.technicianid}
                options={(staffData?.getStaffAccounts || []).map((s: any) => ({ value: s.id, label: s.name }))} onChange={set("technicianid")} />
              <FormField label="Promised Date" name="promisedate" type="date" value={f.promisedate} onChange={set("promisedate")} />
              <FormField label="Warranty on Repair (Days)" name="warrantydays" type="number" value={f.warrantydays} onChange={set("warrantydays")} />
            </div>
          </fieldset>

          <ServiceLines title="Spares Used (Goes out of Stock)" lines={spares} setLines={setSpares} products={products} kind="goods" stock />
          {errors.spares && <p className="-mt-4 text-[12px] text-rose-600">{errors.spares}</p>}

          <fieldset className="border rounded-xl p-4">
            <legend className="text-sm font-medium px-2">Notes</legend>
            <FormField label="" name="notes" type="text" multiline value={f.notes} onChange={set("notes")} />
          </fieldset>
        </form>
      </FormPage>
    </HomeLayout>
  );
};

export default AddEditJobCard;
