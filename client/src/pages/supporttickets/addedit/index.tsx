import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import FormField from "../../../components/formfiled";
import FormPage from "../../../components/formpage";
import HomeLayout from "../../../layouts/home";
import { PartyQuickAdd } from "../../../components/posaddcustomer";
import { useAccountsLiteQuery } from "../../../graphql/hooks/accounts";
import { useStaffListQuery } from "../../../graphql/hooks/staffaccounts";
import { TICKET_PRIORITY, TICKET_STATUS, useSupportTicketMutations, useSupportTicketQuery } from "../../../graphql/hooks/supportticket";
import { useAppDispatch } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";
import { partyLabel } from "../../../utils/partylabel";

const EMPTY = { subject: "", description: "", category: "", priority: "normal", partyid: "", assignedto: "" };
const when = (v?: string) => (v ? new Date(v).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "");

/** Add or work on one support ticket: details, status, and the conversation. */
const AddEditSupportTicket = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { data, refetch } = useSupportTicketQuery(id);
  const ticket = data?.getSupportTicketById;
  const { add, edit, setStatus, comment } = useSupportTicketMutations();
  const { data: accountData } = useAccountsLiteQuery();
  const { data: staffData } = useStaffListQuery();
  const [f, setF] = useState(EMPTY);
  const [errors, setErrors] = useState<{ subject?: string }>({});
  const [saving, setSaving] = useState(false);
  const [partyOpen, setPartyOpen] = useState(false);
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const say = (message: string, type: "success" | "error" = "success") => dispatch(showMessage({ message, type }));

  useEffect(() => {
    if (!ticket) return;
    setF({
      subject: ticket.subject || "", description: ticket.description || "", category: ticket.category || "",
      priority: ticket.priority || "normal", partyid: ticket.party?.id || "", assignedto: ticket.assignedto?.id || "",
    });
  }, [ticket]);

  const set = (k: keyof typeof EMPTY) => (e: any) => setF((x) => ({ ...x, [k]: e?.target?.value ?? "" }));

  const save = async () => {
    if (!f.subject.trim()) return setErrors({ subject: "Subject is required" });
    setSaving(true);
    const input = { ...f, partyid: f.partyid || null, assignedto: f.assignedto || null };
    try {
      if (id) await edit({ variables: { id, input } });
      else {
        const res = await add({ variables: { input } });
        const newId = res.data?.addSupportTicket?.id;
        say(`Ticket ${res.data?.addSupportTicket?.ticketno || ""} created.`);
        if (newId) return navigate(`/supporttickets/addedit/${newId}`, { replace: true });
      }
      say("Ticket saved.");
      await refetch();
    } catch (e: any) {
      say(e?.message || "Could not save the ticket.", "error");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (ticketstatus: string) => {
    try { await setStatus({ variables: { id, ticketstatus } }); await refetch(); }
    catch (e: any) { say(e?.message || "Could not change the status.", "error"); }
  };

  const send = async () => {
    if (!reply.trim()) return;
    try {
      await comment({ variables: { id, text: reply.trim(), internal } });
      setReply("");
      await refetch();
    } catch (e: any) { say(e?.message || "Could not add the comment.", "error"); }
  };

  return (
    <HomeLayout>
      <FormPage breadcrumb="Support Tickets" title={id ? `Ticket ${ticket?.ticketno || ""}` : "Add Ticket"} onSave={save}
        onCancel={() => navigate("/supporttickets")} saveLabel={id ? "Update Ticket" : "Save Ticket"} saveDisabled={saving}>
        <form onSubmit={(ev) => ev.preventDefault()} className="space-y-6">
          <fieldset className="border rounded-xl p-4 space-y-4">
            <legend className="text-sm font-medium px-2">Ticket</legend>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <FormField label="Subject" name="subject" type="text" value={f.subject} error={errors.subject} onChange={set("subject")} />
              </div>
              <FormField label="Category" name="category" type="text" value={f.category} placeholder="e.g. Delivery, Billing, Repair" onChange={set("category")} />
              <FormField label="Priority" name="priority" type="select" searchable value={f.priority}
                options={Object.entries(TICKET_PRIORITY).map(([value, label]) => ({ value, label }))} onChange={set("priority")} />
              <div className="md:col-span-2">
                <FormField label="Party" name="partyid" type="select" searchable addable onAddNew={() => setPartyOpen(true)} value={f.partyid}
                  options={(accountData?.getAccounts || []).map((a: any) => ({ value: a.id, label: partyLabel(a) }))} onChange={set("partyid")} />
              </div>
              <div className="md:col-span-2">
                <FormField label="Assigned To" name="assignedto" type="select" searchable value={f.assignedto}
                  options={(staffData?.getStaffAccounts || []).map((s: any) => ({ value: s.id, label: s.name }))} onChange={set("assignedto")} />
              </div>
              <div className="md:col-span-4">
                <FormField label="Details" name="description" type="text" multiline value={f.description} onChange={set("description")} />
              </div>
            </div>
          </fieldset>

          {id && ticket && (
            <fieldset className="border rounded-xl p-4 space-y-3">
              <legend className="text-sm font-medium px-2">Status</legend>
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <span className="text-slate-600">Now: <b className="text-slate-900">{TICKET_STATUS[ticket.ticketstatus] || ticket.ticketstatus}</b></span>
                {Object.entries(TICKET_STATUS).filter(([k]) => k !== ticket.ticketstatus).map(([k, label]) => (
                  <button key={k} type="button" onClick={() => changeStatus(k)}
                    className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 font-medium text-slate-700 hover:bg-slate-50">{label}</button>
                ))}
              </div>
              {ticket.raisedby?.name && <div className="text-[12px] text-slate-500">Raised by {ticket.raisedby.name} on {when(ticket.createdAt)}</div>}
            </fieldset>
          )}

          {id && ticket && (
            <fieldset className="border rounded-xl p-4 space-y-3">
              <legend className="text-sm font-medium px-2">Conversation</legend>
              {ticket.comments.length ? ticket.comments.map((c: any) => (
                <div key={c.id} className={`rounded-md border p-2 text-[13px] ${c.internal ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}>
                  <div className="mb-1 text-[12px] text-slate-500">
                    <b className="text-slate-700">{c.byname || c.bytype || "-"}</b> · {when(c.createdAt)}{c.internal ? " · internal note" : ""}
                  </div>
                  <div className="whitespace-pre-line text-slate-900">{c.text}</div>
                </div>
              )) : <div className="text-[12px] text-slate-500">No comments yet.</div>}
              <FormField label="Reply" name="reply" type="text" multiline value={reply} onChange={(e: any) => setReply(e.target.value)} />
              <div className="flex items-center gap-3">
                <button type="button" onClick={send}
                  className="inline-flex h-8 items-center rounded-md bg-indigo-600 px-3 text-[13px] font-semibold text-white hover:bg-indigo-700">Add Comment</button>
                <label className="flex items-center gap-2 text-[13px] text-slate-700">
                  <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> Internal note (customer does not see it)
                </label>
              </div>
            </fieldset>
          )}
        </form>
        <PartyQuickAdd open={partyOpen} onClose={() => setPartyOpen(false)} onPicked={(pid) => setF((x) => ({ ...x, partyid: pid }))} />
      </FormPage>
    </HomeLayout>
  );
};

export default AddEditSupportTicket;
