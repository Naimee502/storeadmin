import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { MessageCircle, Phone, Plus, Trash2, UserCheck } from "lucide-react";
import FormField from "../../../components/formfiled";
import FormPage from "../../../components/formpage";
import HomeLayout from "../../../layouts/home";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { selectIsModuleAllowed, selectModuleActions } from "../../../redux/slices/permissions";
import { showMessage } from "../../../redux/slices/message";
import { useStaffListQuery } from "../../../graphql/hooks/staffaccounts";
import { useAccountsLiteQuery } from "../../../graphql/hooks/accounts";
import { useProductServicesQuery } from "../../../graphql/hooks/products";
import {
  TEMPERATURES, leadNo, useCrmLists, useFollowupsQuery, useLeadByIdQuery, useLeadMutations, useLeadsQuery,
} from "../../../graphql/hooks/lead";
import { stateOptions } from "../../../utils/constants";
import CustomFieldsSection, { cleanCustomFields, missingCustomFields, useCustomFieldDefs, type CustomFieldValue } from "../../../components/customfields";
import { formatDateDMY, formatDateTimeDMY, timeMs } from "../../../utils/helper";
import { partyLabel } from "../../../utils/partylabel";
import { isOfflineSaved, savedOffline, OFFLINE_SAVED_MESSAGE } from "../../../offline/billing";
import { isOfflineId } from "../../../offline/core";
import { LostReasonDialog, useChangeStage, waLink } from "..";
import { CompleteDialog, FollowupDialog, FollowupRow, ShortcutButton } from "../../followups";
import { QUOTATION_STATUS, quotationNo, useQuotationsQuery } from "../../../graphql/hooks/quotation";

// unit = "<unitid>--<pack qty>", the same value the Sales Invoice unit picker uses.
type ProductLine = { productid: string; variantid: string; unit: string; name: string; qty: string; note: string };
const NEW_LINE: ProductLine = { productid: "", variantid: "", unit: "", name: "", qty: "", note: "" };
const unitKey = (id?: string, qty?: number | null) => (id ? `${id}--${qty ?? 1}` : "");
// Sales units of a variant (its unit prices), as on the invoice; base unit when none are set.
const unitsOf = (v: any) => {
  const list = (v?.unitprices || []).map((up: any) => ({
    value: unitKey(up.unitid?.id ?? up.unitid, up.quantity),
    label: `${up.quantity} ${up.unitid?.unitname || "Unit"}`,
  }));
  if (!list.length && v?.baseunitid?.id) list.push({ value: unitKey(v.baseunitid.id, 1), label: `1 ${v.baseunitid.unitname}` });
  return Array.from(new Map(list.map((u: any) => [u.value, u])).values()) as { value: string; label: string }[];
};
const EMPTY = {
  name: "", company: "", mobile: "", altmobile: "", email: "", gstin: "",
  address: "", city: "", state: "", pincode: "",
  source: "", subsource: "", requirement: "", expectedvalue: "", temperature: "warm", ownerid: "", tags: "", notes: "",
};
const last10 = (m?: string) => String(m || "").replace(/\D/g, "").slice(-10);

const AddEditLead = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const actions = useAppSelector((s) => selectModuleActions(s, "leads"));
  const fuActions = useAppSelector((s) => selectModuleActions(s, "followups"));
  const fuOn = useAppSelector((s: any) => selectIsModuleAllowed(s, "followups"));
  const qtOn = useAppSelector((s: any) => selectIsModuleAllowed(s, "quotations"));
  const qtActions = useAppSelector((s) => selectModuleActions(s, "quotations"));
  const authType = useAppSelector((s: any) => s.auth.type);
  // Business Settings → Business Form Permissions → Lead Fields.
  const formPerms = useAppSelector((s) => s.permissions.permissions?.formPermissions?.leads || {});
  const on = (field: string) => formPerms[field] !== false;

  const { stages, sources, stageOf } = useCrmLists();
  const { addLead, editLead, convertLead } = useLeadMutations();
  const change = useChangeStage();
  const { data: own } = useLeadByIdQuery(id);
  const lead = own?.getLeadById;
  const { data: allLeads } = useLeadsQuery();
  const { data: fuData } = useFollowupsQuery(id, !id);
  const { data: qtData } = useQuotationsQuery(id, !id || !qtOn);
  const { data: staffData } = useStaffListQuery();
  const { data: accountData } = useAccountsLiteQuery();
  const { data: productData } = useProductServicesQuery();

  const [f, setF] = useState({ ...EMPTY });
  const [stage, setStage] = useState("");
  const [products, setProducts] = useState<ProductLine[]>([]);
  const [custom, setCustom] = useState<CustomFieldValue[]>([]);
  const leadCustomDefs = useCustomFieldDefs("lead");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [booking, setBooking] = useState(false);
  const [doneOf, setDoneOf] = useState<any>(null);
  const [lost, setLost] = useState<any>(null);
  const [linking, setLinking] = useState(false);
  const linkedOnce = useRef(false);
  const set = (k: keyof typeof EMPTY) => (e: any) => setF((x) => ({ ...x, [k]: e.target.value }));

  // Filled once per lead: a refetch after a stage change or a Follow Up must not wipe what is being typed.
  const filledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!isEdit || !lead || filledFor.current === lead.id) return;
    filledFor.current = lead.id;
    setF({
      name: lead.name || "", company: lead.company || "", mobile: lead.mobile || "", altmobile: lead.altmobile || "",
      email: lead.email || "", gstin: lead.gstin || "", address: lead.address || "", city: lead.city || "",
      state: lead.state || "", pincode: lead.pincode || "", source: lead.source || "", subsource: lead.subsource || "",
      requirement: lead.requirement || "", expectedvalue: lead.expectedvalue ?? "", temperature: lead.temperature || "",
      ownerid: lead.ownerid?.id || "", tags: (lead.tags || []).join(", "), notes: lead.notes || "",
    } as any);
    setStage(lead.stage || "");
    setCustom((lead.customfields || []).map((c: any) => ({ key: c.key, value: c.value ?? "" })));
    setProducts((lead.products || []).map((p: any) => ({
      productid: p.productid?.id || "", variantid: p.variantid || "", unit: unitKey(p.unitid?.id, p.unitqty),
      name: p.name || p.productid?.name || "", qty: p.qty ?? "", note: p.note || "",
    })));
  }, [isEdit, lead]);

  // Lines saved before units were asked get the product's first sales unit once products load.
  useEffect(() => {
    if (!productList.length) return;
    setProducts((ps) => {
      let changed = false;
      const next = ps.map((p) => {
        if (!p.productid || p.unit) return p;
        const u = unitsOf(variantOf(p.productid, p.variantid))[0]?.value;
        if (!u) return p;
        changed = true;
        return { ...p, unit: u };
      });
      return changed ? next : ps;
    });
  }, [productData, products.length]);

  // Back from the Party Account form with the new party: link it once.
  useEffect(() => {
    const partyid = (location.state as any)?.linkPartyId;
    if (!partyid || !lead || linkedOnce.current || lead.partyid?.id === partyid) return;
    linkedOnce.current = true;
    convertLead({ variables: { id: lead.id, partyid, expectedUpdatedAt: lead.updatedAt } })
      .then(() => dispatch(showMessage({ message: "Party created and linked to this lead.", type: "success" })))
      .catch((e: any) => dispatch(showMessage({ message: e?.message || "Could not link the party.", type: "error" })));
  }, [location.state, lead]);

  // Same mobile on another lead (checked on this device, so it works offline too).
  const duplicates = useMemo(() => {
    const m = last10(f.mobile);
    if (m.length !== 10) return [];
    return (allLeads?.getLeads || []).filter((l: any) => l.id !== id && (last10(l.mobile) === m || last10(l.altmobile) === m));
  }, [allLeads, f.mobile, id]);
  const partyMatches = useMemo(() => {
    const m = last10(f.mobile);
    return m.length === 10 ? (accountData?.getAccounts || []).filter((a: any) => last10(a.mobile) === m) : [];
  }, [accountData, f.mobile]);

  const staffOptions = (staffData?.getStaffAccounts || []).map((s: any) => ({ value: s.id, label: s.name }));
  const productList: any[] = productData?.getProductServices || [];
  // One pick for product and variant, like the Sales Invoice product field.
  const productOptions = productList.flatMap((p: any) =>
    (p.productvariants?.length ? p.productvariants : [{ id: "" }]).map((v: any) => ({
      value: `${p.id}::${v.id || ""}`,
      label: v.name ? `${p.name} - ${v.name}` : p.name,
    }))
  );
  const productOf = (id: string) => productList.find((p: any) => p.id === id);
  const variantOf = (pid: string, vid: string) => (productOf(pid)?.productvariants || []).find((v: any) => v.id === vid);
  const editLine = (i: number, patch: Partial<ProductLine>) => setProducts((ps) => ps.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  // Picking a product fills its first sales unit.
  const pickProduct = (i: number, value: string) => {
    const [pid, vid = ""] = String(value || "").split("::");
    editLine(i, { productid: pid, variantid: vid, name: productOf(pid)?.name || "", unit: unitsOf(variantOf(pid, vid))[0]?.value || "" });
  };
  const sourceOptions = sources.map((s: string) => ({ value: s, label: s }));

  const buildInput = () => ({
    name: f.name.trim(),
    company: f.company, mobile: f.mobile, altmobile: f.altmobile, email: f.email, gstin: f.gstin,
    address: f.address, city: f.city, state: f.state, pincode: f.pincode,
    source: f.source, subsource: f.subsource, requirement: f.requirement,
    expectedvalue: f.expectedvalue === "" ? null : Number(f.expectedvalue),
    temperature: f.temperature || null,
    ownerid: f.ownerid || null,
    tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
    notes: f.notes,
    stage: stage || stages[0]?.key,
    lostreason: lead?.lostreason || null,
    customfields: cleanCustomFields(leadCustomDefs, custom),
    products: products
      .filter((p) => p.productid || p.name.trim())
      .map((p) => ({
        productid: p.productid || null, variantid: p.variantid || null,
        unitid: p.unit ? p.unit.split("--")[0] : null, unitqty: p.unit ? Number(p.unit.split("--")[1]) || 1 : null,
        name: p.name || undefined, qty: p.qty === "" ? null : Number(p.qty), note: p.note || undefined,
      })),
  });

  const save = async () => {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = "Name is required";
    if (!f.mobile.trim() && !f.email.trim()) e.mobile = "Give a mobile or an email";
    const missing = missingCustomFields(leadCustomDefs, custom);
    if (missing.length) e.custom = `Fill in: ${missing.join(", ")}`;
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      const input = buildInput();
      if (isEdit && id) {
        const r = await editLead({ variables: { id, input, expectedUpdatedAt: lead?.updatedAt } });
        dispatch(showMessage({ message: savedOffline(r?.data?.editLead) ? OFFLINE_SAVED_MESSAGE : "Lead updated.", type: "success" }));
        navigate("/leads");
      } else {
        const r = await addLead({ variables: { input } });
        const saved = r?.data?.addLead;
        dispatch(showMessage({ message: isOfflineSaved(saved) ? OFFLINE_SAVED_MESSAGE : "Lead saved. Book the first Follow Up.", type: "success" }));
        // Straight to the lead, so the first Follow Up is one click away.
        navigate(saved?.id ? `/leads/addedit/${saved.id}` : "/leads", { replace: true });
      }
    } catch (err: any) {
      dispatch(showMessage({ message: err?.message || "Could not save the lead.", type: "error" }));
    } finally {
      setSaving(false);
    }
  };

  const createParty = () =>
    navigate("/accounts/addedit", {
      state: {
        prefill: { name: f.company || f.name, mobile: last10(f.mobile), email: f.email, address: f.address, city: f.city, state: f.state, pincode: f.pincode, gstnumber: f.gstin },
        returnTo: `/leads/addedit/${id}`,
      },
    });

  const linkParty = async (partyid: string) => {
    try {
      await convertLead({ variables: { id, partyid, expectedUpdatedAt: lead?.updatedAt } });
      dispatch(showMessage({ message: "Party linked.", type: "success" }));
      setLinking(false);
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Could not link the party.", type: "error" }));
    }
  };

  const followups = (fuData?.getFollowups || []).slice().sort((a: any, b: any) => {
    if (!a.doneAt !== !b.doneAt) return a.doneAt ? 1 : -1;
    return timeMs(a.doneAt ? b.doneAt : a.dueAt) - timeMs(a.doneAt ? a.doneAt : b.dueAt);
  });
  const current = stageOf(stage);

  return (
    <HomeLayout>
      <FormPage
        breadcrumb="Leads"
        title={isEdit ? `${leadNo(lead)} — ${lead?.name || ""}` : "Add Lead"}
        onSave={save}
        onCancel={() => navigate("/leads")}
        saveLabel={isEdit ? "Update Lead" : "Save Lead"}
        saveDisabled={saving || (isEdit ? !actions.showEdit : !actions.showAdd)}
      >
        <form onSubmit={(ev) => ev.preventDefault()} className="space-y-6">
          {isEdit && lead && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[13px]">
              <span className="font-medium text-slate-600">Stage</span>
              {stages.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  disabled={!actions.showEdit}
                  onClick={async () => {
                    if (s.key === stage) return;
                    if (s.kind === "lost") return setLost(s);
                    if (await change(lead, s)) setStage(s.key);
                  }}
                  className={`h-7 rounded-full px-3 text-[12px] font-medium ring-1 ${
                    s.key === stage
                      ? s.kind === "won" ? "bg-emerald-600 text-white ring-emerald-600" : s.kind === "lost" ? "bg-slate-600 text-white ring-slate-600" : "bg-indigo-600 text-white ring-indigo-600"
                      : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-100"
                  }`}
                >
                  {s.label}
                </button>
              ))}
              {current?.kind === "lost" && lead.lostreason && <span className="text-slate-500">Reason: {lead.lostreason}</span>}
              <span className="ml-auto flex items-center gap-3">
                {f.mobile && <a href={`tel:${last10(f.mobile)}`} className="inline-flex items-center gap-1 text-indigo-600"><Phone size={14} /> Call</a>}
                {f.mobile && <a href={waLink(f.mobile)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-600"><MessageCircle size={14} /> WhatsApp</a>}
                {lead.partyid?.id ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700"><UserCheck size={14} /> Party: {lead.partyid.name}</span>
                ) : actions.showConvert && !isOfflineId(lead.id) ? (
                  <button type="button" className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-300 bg-white px-2 text-[12px] font-medium hover:bg-slate-50" onClick={() => setLinking(true)}>
                    <UserCheck size={13} /> Convert to Party
                  </button>
                ) : null}
              </span>
            </div>
          )}

          <fieldset className="border rounded-xl p-4 space-y-4">
            <legend className="text-sm font-medium px-2">Contact</legend>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <FormField label="Name" name="name" type="text" value={f.name} onChange={set("name")} error={errors.name} required />
              {on("company") && <FormField label="Company" name="company" type="text" value={f.company} onChange={set("company")} />}
              {on("mobile") && <FormField label="Mobile" name="mobile" type="tel" value={f.mobile} onChange={set("mobile")} error={errors.mobile} />}
              {on("altmobile") && <FormField label="Alternate Mobile" name="altmobile" type="tel" value={f.altmobile} onChange={set("altmobile")} />}
              {on("email") && <FormField label="Email" name="email" type="email" value={f.email} onChange={set("email")} />}
              {on("gstin") && <FormField label="GSTIN" name="gstin" type="text" value={f.gstin} onChange={(e: any) => setF((x) => ({ ...x, gstin: String(e.target.value).toUpperCase() }))} />}
            </div>
            {(duplicates.length > 0 || partyMatches.length > 0) && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                {duplicates.length > 0 && (
                  <div>
                    Same mobile on {duplicates.length === 1 ? "lead" : "leads"}:{" "}
                    {duplicates.slice(0, 3).map((d: any, i: number) => (
                      <button key={d.id} type="button" className="font-semibold underline" onClick={() => navigate(`/leads/addedit/${d.id}`)}>
                        {i ? ", " : ""}{leadNo(d)} {d.name}{d.ownerid?.name ? ` (${d.ownerid.name})` : ""}
                      </button>
                    ))}
                  </div>
                )}
                {partyMatches.length > 0 && <div>Already a party: {partyMatches.slice(0, 3).map((a: any) => partyLabel(a)).join(", ")}</div>}
              </div>
            )}
          </fieldset>

          {(on("address") || on("city") || on("state") || on("pincode")) && (
            <fieldset className="border rounded-xl p-4">
              <legend className="text-sm font-medium px-2">Address</legend>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {on("address") && <div className="md:col-span-2"><FormField label="Address" name="address" type="text" value={f.address} onChange={set("address")} /></div>}
                {on("city") && <FormField label="City" name="city" type="text" value={f.city} onChange={set("city")} />}
                {on("state") && <FormField label="State" name="state" type="select" value={f.state} onChange={set("state")} options={stateOptions} searchable />}
                {on("pincode") && <FormField label="Pincode" name="pincode" type="text" value={f.pincode} onChange={(e: any) => setF((x) => ({ ...x, pincode: String(e.target.value).replace(/\D/g, "").slice(0, 6) }))} />}
              </div>
            </fieldset>
          )}

          <fieldset className="border rounded-xl p-4 space-y-4">
            <legend className="text-sm font-medium px-2">Enquiry</legend>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {on("source") && <FormField label="Source" name="source" type="select" value={f.source} onChange={set("source")} options={sourceOptions} searchable />}
              {on("subsource") && <FormField label="Campaign / Ad" name="subsource" type="text" value={f.subsource} onChange={set("subsource")} />}
              {on("expectedvalue") && <FormField label="Expected Value (₹)" name="expectedvalue" type="number" value={f.expectedvalue} onChange={set("expectedvalue")} />}
              {on("temperature") && <FormField label="Hot / Warm / Cold" name="temperature" type="select" searchable value={f.temperature} onChange={set("temperature")} options={TEMPERATURES} />}
              {on("owner") && authType !== "staff" && <FormField label="Owner" name="ownerid" type="select" value={f.ownerid} onChange={set("ownerid")} options={staffOptions} searchable />}
              {!isEdit && <FormField label="Stage" name="stage" type="select" searchable value={stage || stages[0]?.key} onChange={(e: any) => setStage(e.target.value)} options={stages.filter((s) => s.kind === "open").map((s) => ({ value: s.key, label: s.label }))} />}
              {on("tags") && <FormField label="Tags (comma separated)" name="tags" type="text" value={f.tags} onChange={set("tags")} />}
            </div>
            {on("requirement") && <FormField label="Requirement" name="requirement" type="text" multiline value={f.requirement} onChange={set("requirement")} placeholder="What the customer asked for" />}
            {on("products") && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-slate-700">Products of interest</span>
                  <button type="button" className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-300 px-2 text-[12px] hover:bg-slate-50" onClick={() => setProducts((p) => [...p, { ...NEW_LINE }])}>
                    <Plus size={13} /> Add
                  </button>
                </div>
                {products.map((p, i) => (
                  <div key={i} className="grid grid-cols-12 items-end gap-2">
                    <div className="col-span-12 md:col-span-5">
                      <FormField label="Product" name={`p${i}`} type="select" searchable options={productOptions}
                        value={p.productid ? `${p.productid}::${p.variantid || ""}` : ""} onChange={(e: any) => pickProduct(i, e.target.value)} />
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <FormField label="Unit" name={`u${i}`} type="select" searchable value={p.unit} options={unitsOf(variantOf(p.productid, p.variantid))}
                        onChange={(e: any) => editLine(i, { unit: e.target.value })} />
                    </div>
                    <div className="col-span-6 md:col-span-1">
                      <FormField label="Qty" name={`q${i}`} type="number" value={p.qty} onChange={(e: any) => editLine(i, { qty: e.target.value })} />
                    </div>
                    <div className="col-span-11 md:col-span-3">
                      <FormField label="Note (size, spec)" name={`n${i}`} type="text" value={p.note} onChange={(e: any) => editLine(i, { note: e.target.value })} />
                    </div>
                    <button type="button" title="Remove" className="col-span-1 mb-1 inline-flex h-8 items-center justify-center text-rose-600" onClick={() => setProducts((ps) => ps.filter((_, j) => j !== i))}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {on("notes") && <FormField label="Notes" name="notes" type="text" multiline value={f.notes} onChange={set("notes")} />}
          </fieldset>

          <CustomFieldsSection entity="lead" title="More Details" values={custom} onChange={setCustom} />
          {errors.custom && <p className="text-[12px] text-rose-600">{errors.custom}</p>}

          {isEdit && lead && fuOn && (
            <fieldset className="border rounded-xl p-4 space-y-3">
              <legend className="text-sm font-medium px-2">Follow Ups</legend>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-slate-500">
                  {timeMs(lead.nextfollowupAt) ? `Next: ${formatDateTimeDMY(lead.nextfollowupAt)}` : "No Follow Up booked."}
                </span>
                {fuActions.showAdd && (
                  <ShortcutButton label="Book Follow Up" keyCode="F" onClick={() => setBooking(true)} />
                )}
              </div>
              {followups.length === 0 && <div className="text-[13px] text-slate-500">No Follow Ups yet.</div>}
              <div className="space-y-2">
                {followups.map((x: any) => <FollowupRow key={x.id} f={x} canEdit={fuActions.showEdit} onDone={setDoneOf} />)}
              </div>
            </fieldset>
          )}
          {isEdit && lead && qtOn && (
            <fieldset className="border rounded-xl p-4 space-y-3">
              <legend className="text-sm font-medium px-2">Quotations</legend>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-slate-500">Lead's details and products fill the quotation.</span>
                {qtActions.showAdd && !isOfflineId(lead.id) && (
                  <ShortcutButton label="Create Quotation" keyCode="Q" onClick={() => navigate(`/quotations/addedit?leadId=${lead.id}`)} />
                )}
              </div>
              {(qtData?.getQuotations || []).length === 0 && <div className="text-[13px] text-slate-500">No quotations yet.</div>}
              <div className="space-y-2">
                {(qtData?.getQuotations || []).filter((q: any) => q.quotationStatus !== "revised").map((q: any) => (
                  <button key={q.id} type="button" onClick={() => navigate(`/quotations/addedit/${q.id}`)}
                    className="flex w-full flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-[13px] hover:border-indigo-300">
                    <span className="w-36 font-semibold text-slate-800">{quotationNo(q)}</span>
                    <span className="w-24 text-slate-600">{formatDateDMY(q.billdate)}</span>
                    <span className="flex-1 truncate text-slate-500">{q.subject || ""}</span>
                    <span className="w-28 text-right font-medium text-slate-800">₹{Number(q.totalamount || 0).toLocaleString("en-IN")}</span>
                    <span className="w-24 text-right text-[12px] text-slate-500">{QUOTATION_STATUS[q.quotationStatus] || "Draft"}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}
        </form>
      </FormPage>

      {booking && id && <FollowupDialog leadId={id} onClose={() => setBooking(false)} />}
      {doneOf && <CompleteDialog followup={doneOf} onClose={() => setDoneOf(null)} />}
      {lost && lead && <LostReasonDialog lead={lead} stage={lost} onDone={(ok) => { if (ok) setStage(lost.key); setLost(null); }} />}
      {linking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setLinking(false)}>
          <div className="w-full max-w-md space-y-3 rounded-lg bg-white p-4 text-[13px] shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold text-slate-800">Convert {f.name} to a Party Account</div>
            {partyMatches.length > 0 && (
              <div className="space-y-1">
                <div className="text-slate-600">This mobile is already a party — link it:</div>
                {partyMatches.map((a: any) => (
                  <button key={a.id} type="button" className="block w-full rounded-md border border-slate-200 px-3 py-2 text-left hover:border-indigo-300" onClick={() => linkParty(a.id)}>
                    {partyLabel(a)}
                  </button>
                ))}
              </div>
            )}
            <FormField label="Or link any party" name="linkparty" type="select" value="" searchable
              options={(accountData?.getAccounts || []).map((a: any) => ({ value: a.id, label: partyLabel(a) }))}
              onChange={(e: any) => e.target.value && linkParty(e.target.value)} />
            <div className="flex justify-between gap-2 pt-1">
              <button type="button" className="h-8 rounded-md border border-slate-300 px-3" onClick={() => setLinking(false)}>Cancel</button>
              <button type="button" className="h-8 rounded-md bg-indigo-600 px-3 font-semibold text-white hover:bg-indigo-700" onClick={createParty}>
                Create New Party
              </button>
            </div>
          </div>
        </div>
      )}
    </HomeLayout>
  );
};

export default AddEditLead;
