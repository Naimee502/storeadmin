import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import FormField from "../../components/formfiled";
import { partyLabel } from "../../utils/partylabel";
import { useAddNew } from "../../hooks/useaddnew";
import { CheckCircle2, MessageCircle, Phone, Plus } from "lucide-react";
import HomeLayout from "../../layouts/home";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectModuleActions } from "../../redux/slices/permissions";
import { showMessage } from "../../redux/slices/message";
import { useStaffListQuery } from "../../graphql/hooks/staffaccounts";
import { FOLLOWUP_TYPES, useFollowupsQuery, useLeadMutations, useLeadsQuery } from "../../graphql/hooks/lead";
import { formatDateDMY, timeMs } from "../../utils/helper";
import { isOfflineSaved, OFFLINE_SAVED_MESSAGE } from "../../offline/billing";
import { waLink } from "../leads";
import { isOfflineId } from "../../offline/core";

const input = "h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-[13px] outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";
const btn = "inline-flex h-8 shrink-0 items-center whitespace-nowrap gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const primary = "inline-flex h-8 shrink-0 items-center whitespace-nowrap gap-1.5 rounded-md bg-indigo-600 px-3 text-[13px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50";
/** Primary add button with its keyboard shortcut shown, like the list screens (Alt+N there). */
export function ShortcutButton({ label, keyCode, onClick }: { label: string; keyCode: string; onClick: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // e.code: on Mac ⌥ changes the typed letter, not the key position.
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === `Key${keyCode}` && !e.defaultPrevented) {
        e.preventDefault();
        onClick();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keyCode, onClick]);
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label} (Alt+${keyCode})`}
      className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-indigo-600 px-3.5 text-[13px] font-semibold text-white shadow-sm hover:bg-indigo-700"
    >
      <Plus size={13} /> {label}
      <kbd className="ml-1 rounded border border-white/40 px-1 text-[10px] font-medium leading-4 text-white/80">Alt+{keyCode}</kbd>
    </button>
  );
}

export const OUTCOMES = ["Interested", "Call back later", "Quotation asked", "Not reachable", "Not interested", "Order confirmed"];

const pad = (n: number) => String(n).padStart(2, "0");
/** Local "YYYY-MM-DDTHH:MM" for a datetime-local input. */
export const localDT = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const tomorrow10 = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return localDT(d);
};
const timeOf = (iso?: string) => (iso ? new Date(timeMs(iso)).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "");
const leadName = (f: any) => f.leadid?.name || f.partyid?.name || "—";
const leadMobile = (f: any) => f.leadid?.mobile || f.partyid?.mobile || "";

/** Book a Follow Up for a lead (picked here when not given). */
export function FollowupDialog({ leadId, onClose }: { leadId?: string; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const { addFollowup } = useLeadMutations();
  const { data: leadsData } = useLeadsQuery(!!leadId);
  const { data: staffData } = useStaffListQuery();
  const addLead = useAddNew("/leads/addedit", ["GetLeads", "GetLeadsPage"]);
  const authType = useAppSelector((s: any) => s.auth.type);
  const [f, setF] = useState({ leadid: leadId || "", type: "call", dueAt: tomorrow10(), note: "", assignedto: "" });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: any) => setF((x) => ({ ...x, [k]: e.target.value }));

  const save = async () => {
    if (!f.leadid) return dispatch(showMessage({ message: "Pick a lead.", type: "error" }));
    if (!f.dueAt) return dispatch(showMessage({ message: "Pick the date and time.", type: "error" }));
    setSaving(true);
    try {
      const r = await addFollowup({
        variables: { input: { leadid: f.leadid, type: f.type, dueAt: new Date(f.dueAt).toISOString(), note: f.note || undefined, assignedto: f.assignedto || undefined } },
      });
      dispatch(showMessage({ message: isOfflineSaved(r?.data?.addFollowup) ? OFFLINE_SAVED_MESSAGE : "Follow Up booked.", type: "success" }));
      onClose();
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Could not save.", type: "error" }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md space-y-3 rounded-lg bg-white p-4 text-[13px] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="font-semibold text-slate-800">Book a Follow Up</div>
        {!leadId && (
          <FormField label="Lead" name="leadid" type="select" searchable addable onAddNew={addLead} value={f.leadid}
            options={(leadsData?.getLeads || []).map((l: any) => ({ value: l.id, label: partyLabel({ name: l.name, mobile: l.mobile, city: l.city }) }))}
            onChange={set("leadid")} />
        )}
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Type" name="type" type="select" searchable value={f.type} options={FOLLOWUP_TYPES} onChange={set("type")} />
          <label>When<input type="datetime-local" className={input} value={f.dueAt} onChange={set("dueAt")} /></label>
        </div>
        {authType !== "staff" && (
          <FormField label="Assign To" name="assignedto" type="select" searchable placeholder="Me / lead owner" value={f.assignedto}
            options={(staffData?.getStaffAccounts || []).map((s: any) => ({ value: s.id, label: s.name }))} onChange={set("assignedto")} />
        )}
        <label className="block">Note<input className={input} value={f.note} onChange={set("note")} placeholder="What to talk about" /></label>
        <div className="flex justify-end gap-2">
          <button type="button" className={btn} onClick={onClose}>Cancel</button>
          <button type="button" className={primary} disabled={saving} onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}

/** Close a Follow Up with its outcome; the next one is booked in the same step so no lead goes quiet. */
export function CompleteDialog({ followup, onClose }: { followup: any; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const { completeFollowup, addFollowup, editFollowup } = useLeadMutations();
  const [outcome, setOutcome] = useState(OUTCOMES[0]);
  const [note, setNote] = useState("");
  const [next, setNext] = useState(true);
  const [nextType, setNextType] = useState(followup.type || "call");
  const [nextDue, setNextDue] = useState(tomorrow10());
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (next && !nextDue) return dispatch(showMessage({ message: "Pick when to follow up next.", type: "error" }));
    setSaving(true);
    try {
      if (isOfflineId(followup.id)) {
        // Still on this device: finish it inside its queued save.
        await editFollowup({ variables: { id: followup.id, input: {
          leadid: followup.leadid?.id, type: followup.type, dueAt: new Date(timeMs(followup.dueAt)).toISOString(), note: note || followup.note || undefined,
          assignedto: followup.assignedto?.id || undefined, doneAt: new Date().toISOString(), outcome,
        } } });
      } else {
        await completeFollowup({ variables: { id: followup.id, outcome, note: note || undefined, expectedUpdatedAt: followup.updatedAt } });
      }
      const leadid = followup.leadid?.id;
      if (next && leadid) {
        await addFollowup({ variables: { input: { leadid, type: nextType, dueAt: new Date(nextDue).toISOString(), assignedto: followup.assignedto?.id || undefined } } });
      }
      dispatch(showMessage({ message: next ? "Done; next Follow Up booked." : "Follow Up done.", type: "success" }));
      onClose();
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Could not save.", type: "error" }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md space-y-3 rounded-lg bg-white p-4 text-[13px] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="font-semibold text-slate-800">Done — {leadName(followup)}</div>
        <FormField label="Outcome" name="outcome" type="select" searchable value={outcome}
          options={OUTCOMES.map((o) => ({ value: o, label: o }))} onChange={(e: any) => setOutcome(e.target.value)} />
        <label className="block">Note<input className={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was discussed" /></label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={next} onChange={(e) => setNext(e.target.checked)} />
          Book the next Follow Up
        </label>
        {next && (
          <div className="grid grid-cols-2 gap-2">
            <FormField label="" name="nextType" type="select" searchable value={nextType} options={FOLLOWUP_TYPES} onChange={(e: any) => setNextType(e.target.value)} />
            <input type="datetime-local" className={input} value={nextDue} onChange={(e) => setNextDue(e.target.value)} />
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className={btn} onClick={onClose}>Cancel</button>
          <button type="button" className={primary} disabled={saving} onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}

/** One Follow Up row with call, WhatsApp and done. */
export function FollowupRow({ f, canEdit, onDone, onOpen }: { f: any; canEdit: boolean; onDone: (f: any) => void; onOpen?: (f: any) => void }) {
  const overdue = !f.doneAt && f.dueAt && timeMs(f.dueAt) < Date.now();
  const mobile = leadMobile(f);
  const type = FOLLOWUP_TYPES.find((t) => t.value === f.type)?.label || f.type;
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-md border bg-white px-3 py-2 text-[13px] ${overdue ? "border-rose-200" : "border-slate-200"}`}>
      <div className="min-w-[180px] flex-1 cursor-pointer" onClick={() => onOpen?.(f)}>
        <div className="font-semibold text-slate-800">{leadName(f)}</div>
        <div className="text-[12px] text-slate-500">{[mobile, f.leadid?.city].filter(Boolean).join(" · ")}</div>
      </div>
      <div className="w-24 text-slate-600">{type}</div>
      <div className={`w-36 ${overdue ? "font-semibold text-rose-600" : "text-slate-600"}`}>
        {formatDateDMY(f.doneAt || f.dueAt)} {timeOf(f.doneAt || f.dueAt)}
      </div>
      <div className="min-w-[140px] flex-1 text-slate-500">{f.doneAt ? f.outcome || "Done" : f.note || ""}</div>
      <div className="w-28 text-[12px] text-slate-400">{f.assignedto?.name || ""}</div>
      <div className="flex items-center gap-2">
        {mobile && <a href={`tel:${mobile.replace(/\D/g, "")}`} title="Call" className="text-indigo-600 hover:text-indigo-800"><Phone size={15} /></a>}
        {mobile && <a href={waLink(mobile)} target="_blank" rel="noreferrer" title="WhatsApp" className="text-emerald-600 hover:text-emerald-800"><MessageCircle size={15} /></a>}
        {!f.doneAt && canEdit && (
          <button type="button" className="inline-flex h-7 items-center gap-1 rounded-md bg-emerald-600 px-2 text-[12px] font-semibold text-white hover:bg-emerald-700" onClick={() => onDone(f)}>
            <CheckCircle2 size={13} /> Done
          </button>
        )}
      </div>
    </div>
  );
}

const TABS = [
  { id: "today", label: "Today" },
  { id: "overdue", label: "Overdue" },
  { id: "upcoming", label: "Upcoming" },
  { id: "done", label: "Done" },
];

const Followups = () => {
  const navigate = useNavigate();
  const actions = useAppSelector((s) => selectModuleActions(s, "followups"));
  const [tab, setTab] = useState("today");
  const [adding, setAdding] = useState(false);
  const [doneOf, setDoneOf] = useState<any>(null);
  const [search, setSearch] = useState("");
  const { data, loading } = useFollowupsQuery();

  const groups = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    const g: Record<string, any[]> = { today: [], overdue: [], upcoming: [], done: [] };
    const term = search.trim().toLowerCase();
    for (const f of data?.getFollowups || []) {
      if (term && ![leadName(f), leadMobile(f), f.note, f.outcome].some((v) => String(v || "").toLowerCase().includes(term))) continue;
      const due = timeMs(f.dueAt);
      if (f.doneAt) g.done.push(f);
      else if (due < start.getTime()) g.overdue.push(f);
      else if (due < end.getTime()) g.today.push(f);
      else g.upcoming.push(f);
    }
    g.done.sort((a, b) => timeMs(b.doneAt) - timeMs(a.doneAt));
    return g;
  }, [data, search]);

  const all = groups[tab] || [];
  // Same pager as the other lists, in memory (follow ups are read from the device).
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  useEffect(() => setPage(1), [tab, search, size]);
  const pages = Math.max(1, Math.ceil(all.length / size));
  const cur = Math.min(page, pages);
  const list = all.slice((cur - 1) * size, cur * size);
  const near = Array.from({ length: pages }, (_, i) => i + 1).filter((p) => p === 1 || p === pages || Math.abs(p - cur) <= 1);

  return (
    <HomeLayout>
      <div className="w-full px-2 pb-6 pt-4 sm:px-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-[15px] font-semibold text-slate-800">Follow Ups</h1>
          <div className="flex gap-2">
            <input className={`${input} w-56 min-w-0`} placeholder="Search name, mobile, note…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {actions.showAdd && <ShortcutButton label="Add Follow Up" keyCode="N" onClick={() => setAdding(true)} />}
          </div>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium ${tab === t.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
            >
              {t.label}
              <span className={`rounded px-1.5 text-[11px] ${t.id === "overdue" && groups.overdue.length ? "bg-rose-600 text-white" : tab === t.id ? "bg-white/20" : "bg-slate-100 text-slate-600"}`}>
                {groups[t.id].length}
              </span>
            </button>
          ))}
        </div>
        {loading && !list.length && <div className="text-[13px] text-slate-500">Loading…</div>}
        {!loading && !list.length && <div className="rounded-md border border-dashed border-slate-300 p-6 text-center text-[13px] text-slate-500">Nothing here.</div>}
        <div className="space-y-2">
          {list.map((f) => (
            <FollowupRow
              key={f.id}
              f={f}
              canEdit={actions.showEdit}
              onDone={setDoneOf}
              onOpen={(x) => x.leadid?.id && navigate(`/leads/addedit/${x.leadid.id}`)}
            />
          ))}
        </div>
        {all.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-slate-500">
            <span>{(cur - 1) * size + 1}–{Math.min(cur * size, all.length)} of {all.length}</span>
            <select value={size} onChange={(e) => setSize(Number(e.target.value))} className="h-7 rounded border border-slate-300 bg-white px-1.5 text-[12px] outline-none" title="Rows per page">
              {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n} / page</option>)}
            </select>
            <div className="ml-auto flex items-center gap-1">
              <button type="button" onClick={() => setPage(cur - 1)} disabled={cur <= 1} className="h-7 rounded border border-slate-300 bg-white px-2 hover:bg-slate-50 disabled:opacity-40">‹ Prev</button>
              {near.map((p, i) => (
                <span key={p} className="flex items-center gap-1">
                  {i > 0 && p - near[i - 1] > 1 && <span className="px-1">…</span>}
                  <button type="button" onClick={() => setPage(p)} className={`h-7 min-w-7 rounded px-2 ${p === cur ? "bg-indigo-600 font-semibold text-white" : "border border-slate-300 bg-white hover:bg-slate-50"}`}>{p}</button>
                </span>
              ))}
              <button type="button" onClick={() => setPage(cur + 1)} disabled={cur >= pages} className="h-7 rounded border border-slate-300 bg-white px-2 hover:bg-slate-50 disabled:opacity-40">Next ›</button>
            </div>
          </div>
        )}
      </div>
      {adding && <FollowupDialog onClose={() => setAdding(false)} />}
      {doneOf && <CompleteDialog followup={doneOf} onClose={() => setDoneOf(null)} />}
    </HomeLayout>
  );
};

export default Followups;
