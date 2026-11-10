import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Plus, Trash2 } from "lucide-react";
import FormField from "../../../components/formfiled";
import FormPage from "../../../components/formpage";
import HomeLayout from "../../../layouts/home";
import { PARTY_QUERIES, useAddNew } from "../../../hooks/useaddnew";
import { useAccountsLiteQuery } from "../../../graphql/hooks/accounts";
import { useProductServicesQuery } from "../../../graphql/hooks/products";
import { CONTRACT_TYPE, addDaysYMD, useContractByIdQuery, useServiceBranch, useServiceMutations } from "../../../graphql/hooks/service";
import { useAppDispatch } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";
import { partyLabel } from "../../../utils/partylabel";
import { todayYMD } from "../../../utils/helper";
import { OFFLINE_SAVED_MESSAGE, isOfflineSaved, savedOffline } from "../../../offline/billing";

type Item = { productserviceid?: string; serial?: string; note?: string };
const idOf = (v: any) => (v && typeof v === "object" ? v.id : v) || null;

const AddEditContract = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const addParty = useAddNew("/accounts/addedit", PARTY_QUERIES);
  const dispatch = useAppDispatch();
  const branchId = useServiceBranch();
  const { addContract, editContract } = useServiceMutations();
  const { data: own } = useContractByIdQuery(id);
  const { data: accountData } = useAccountsLiteQuery();
  const { data: productData } = useProductServicesQuery();
  const products = productData?.getProductServices || [];

  const [f, setF] = useState({
    partyacc: "", title: "", contractType: "amc", startdate: todayYMD(), enddate: addDaysYMD(todayYMD(), 364), visitsallowed: "", visitsdone: "", amount: "", contractStatus: "active", notes: "",
  });
  const [items, setItems] = useState<Item[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [filled, setFilled] = useState(false);
  const set = (k: keyof typeof f) => (e: any) => setF((x) => ({ ...x, [k]: e.target.value }));
  const editItem = (i: number, patch: Partial<Item>) => setItems(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  useEffect(() => {
    const c = own?.getContractById;
    if (!isEdit || !c || filled) return;
    setFilled(true);
    setF({
      partyacc: idOf(c.partyacc) || "", title: c.title || "", contractType: c.contractType || "amc", startdate: c.startdate, enddate: c.enddate,
      visitsallowed: c.visitsallowed ? String(c.visitsallowed) : "", visitsdone: c.visitsdone ? String(c.visitsdone) : "",
      amount: c.amount ? String(c.amount) : "", contractStatus: c.contractStatus || "active", notes: c.notes || "",
    });
    setItems((c.items || []).map((x: any) => ({ productserviceid: idOf(x.productserviceid) || "", serial: x.serial || "", note: x.note || "" })));
  }, [isEdit, own, filled]);

  const save = async () => {
    const e: Record<string, string> = {};
    if (!f.partyacc) e.partyacc = "Pick the party";
    if (!f.startdate || !f.enddate) e.enddate = "Start and end dates are required";
    else if (f.enddate < f.startdate) e.enddate = "End date is before the start date";
    setErrors(e);
    if (Object.keys(e).length) return;
    const num = (v: string) => (v === "" ? null : Number(v));
    const input: any = {
      partyacc: f.partyacc, title: f.title || undefined, contractType: f.contractType, startdate: f.startdate, enddate: f.enddate,
      visitsallowed: num(f.visitsallowed), visitsdone: num(f.visitsdone), amount: num(f.amount), contractStatus: f.contractStatus, notes: f.notes || undefined,
      items: items.filter((x) => x.productserviceid || x.serial).map((x) => ({ productserviceid: x.productserviceid || null, serial: x.serial || undefined, note: x.note || undefined })),
      branchid: branchId || undefined,
    };
    setSaving(true);
    try {
      if (isEdit && id) {
        const r = await editContract({ variables: { id, input, expectedUpdatedAt: own?.getContractById?.updatedAt } });
        dispatch(showMessage({ message: savedOffline(r?.data?.editContract) ? OFFLINE_SAVED_MESSAGE : "Contract updated.", type: "success" }));
      } else {
        const r = await addContract({ variables: { input } });
        dispatch(showMessage({ message: isOfflineSaved(r?.data?.addContract) ? OFFLINE_SAVED_MESSAGE : "Contract saved.", type: "success" }));
      }
      navigate("/contracts");
    } catch (err: any) {
      dispatch(showMessage({ message: err?.message || "Could not save the contract.", type: "error" }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <HomeLayout>
      <FormPage breadcrumb="AMC / Warranty" title={isEdit ? "Edit Contract" : "Add AMC / Warranty"} onSave={save} onCancel={() => navigate(-1)}
        saveLabel={isEdit ? "Update Contract" : "Save Contract"} saveDisabled={saving}>
        <form onSubmit={(ev) => ev.preventDefault()} className="space-y-6">
          <fieldset className="border rounded-xl p-4 space-y-4">
            <legend className="text-sm font-medium px-2">Contract</legend>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <FormField label="Party" name="partyacc" type="select" searchable addable onAddNew={addParty} error={errors.partyacc} value={f.partyacc}
                  options={(accountData?.getAccounts || []).map((a: any) => ({ value: a.id, label: partyLabel(a) }))} onChange={set("partyacc")} />
              </div>
              <FormField label="Type" name="contractType" type="select" searchable value={f.contractType}
                options={Object.entries(CONTRACT_TYPE).map(([value, label]) => ({ value, label }))} onChange={set("contractType")} />
              <FormField label="Status" name="contractStatus" type="select" searchable value={f.contractStatus}
                options={[{ value: "active", label: "Active" }, { value: "cancelled", label: "Cancelled" }]} onChange={set("contractStatus")} />
              <div className="md:col-span-2">
                <FormField label="Title" name="title" type="text" value={f.title} placeholder="Title" onChange={set("title")} />
              </div>
              <FormField label="Start Date" name="startdate" type="date" value={f.startdate} onChange={set("startdate")} />
              <FormField label="End Date" name="enddate" type="date" value={f.enddate} error={errors.enddate} onChange={set("enddate")} />
              <FormField label="Visits Allowed" name="visitsallowed" type="number" value={f.visitsallowed} onChange={set("visitsallowed")} />
              <FormField label="Visits Done" name="visitsdone" type="number" value={f.visitsdone} onChange={set("visitsdone")} />
              <FormField label="Amount (₹)" name="amount" type="number" value={f.amount} onChange={set("amount")} />
            </div>
          </fieldset>

          <fieldset className="border rounded-xl p-4 space-y-2">
            <legend className="text-sm font-medium px-2">Items Covered</legend>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[12px] text-slate-500"><th className="py-1">Item</th><th className="py-1">Serial No.</th><th className="py-1">Note</th><th className="w-8" /></tr>
              </thead>
              <tbody>
                {items.map((x, i) => (
                  <tr key={i} className="border-t border-slate-100 align-top">
                    <td className="py-1 pr-2 min-w-[220px]">
                      <FormField label="" name={`ci${i}`} type="select" searchable value={x.productserviceid || ""}
                        options={products.map((p: any) => ({ value: p.id, label: p.name }))} onChange={(e: any) => editItem(i, { productserviceid: e.target.value })} />
                    </td>
                    <td className="py-1 pr-2"><input className="h-8 w-full rounded-md border border-slate-300 px-2" value={x.serial || ""} onChange={(e) => editItem(i, { serial: e.target.value })} /></td>
                    <td className="py-1 pr-2"><input className="h-8 w-full rounded-md border border-slate-300 px-2" value={x.note || ""} placeholder="Note" onChange={(e) => editItem(i, { note: e.target.value })} /></td>
                    <td className="py-1">
                      <button type="button" title="Remove" className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" onClick={() => setItems([...items, {}])} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed border-indigo-300 px-3 text-[13px] font-medium text-indigo-600 hover:bg-indigo-50">
              <Plus size={14} /> Add Item
            </button>
          </fieldset>

          <fieldset className="border rounded-xl p-4">
            <legend className="text-sm font-medium px-2">Notes</legend>
            <FormField label="" name="notes" type="text" multiline value={f.notes} onChange={set("notes")} />
          </fieldset>
        </form>
      </FormPage>
    </HomeLayout>
  );
};

export default AddEditContract;
