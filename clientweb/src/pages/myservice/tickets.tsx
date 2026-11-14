import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery } from "@apollo/client";
import { LifeBuoy, Plus, Send } from "lucide-react";
import { ADD_MY_TICKET, GET_MY_TICKET, GET_MY_TICKETS, REPLY_MY_TICKET, SET_MY_TICKET_STATUS } from "../../graphql/queries/myservice";
import { Badge, Empty, Loading, ServicePage, whenLabel } from "./shared";

export const TICKET_STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: "Open", cls: "bg-amber-50 text-amber-700" },
  inprogress: { label: "In Progress", cls: "bg-sky-50 text-sky-700" },
  waiting: { label: "Waiting for You", cls: "bg-violet-50 text-violet-700" },
  resolved: { label: "Resolved", cls: "bg-emerald-50 text-emerald-700" },
  closed: { label: "Closed", cls: "bg-slate-100 text-slate-700" },
};
const CATEGORIES = ["Product Issue", "Service / Repair", "Billing / Payment", "Delivery", "AMC", "Warranty", "Other"];

/** Customer's support tickets: list and raise a new one. */
export function MyTicketsPage() {
  const navigate = useNavigate();
  const { data, loading, refetch } = useQuery(GET_MY_TICKETS, { fetchPolicy: "cache-and-network" });
  const [add, { loading: saving }] = useMutation(ADD_MY_TICKET);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subject: "", category: "", description: "", priority: "normal" });
  const [error, setError] = useState("");
  const rows: any[] = data?.getSupportTickets || [];

  const submit = async () => {
    if (!form.subject.trim()) return setError("Write a short subject.");
    setError("");
    try {
      const { data: r } = await add({ variables: { input: { ...form, subject: form.subject.trim() } } });
      setOpen(false);
      setForm({ subject: "", category: "", description: "", priority: "normal" });
      await refetch();
      if (r?.addSupportTicket?.id) navigate(`/account/tickets/${r.addSupportTicket.id}`);
    } catch (e: any) {
      setError(e?.message || "Could not raise the ticket.");
    }
  };

  return (
    <ServicePage title="Support Tickets" action={
      <button type="button" onClick={() => setOpen(true)} className="flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
        <Plus className="h-4 w-4" /> Raise a Ticket
      </button>
    }>
      {open && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-ink-900">New Ticket</h2>
          <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} maxLength={200} placeholder="Subject (e.g. AC not cooling)"
            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-10 rounded-lg border border-slate-300 px-3 text-sm">
              <option value="">Category (optional)</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="h-10 rounded-lg border border-slate-300 px-3 text-sm">
              <option value="low">Low priority</option><option value="normal">Normal priority</option><option value="high">High priority</option><option value="urgent">Urgent</option>
            </select>
          </div>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} placeholder="Tell us what happened"
            className="w-full rounded-lg border border-slate-300 p-3 text-sm" />
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="button" onClick={submit} disabled={saving} className="h-9 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">{saving ? "Sending..." : "Submit Ticket"}</button>
          </div>
        </div>
      )}
      {loading && !rows.length ? <Loading /> : !rows.length ? <Empty text="No tickets yet. Raise one if you need help." /> : (
        <div className="space-y-2">
          {rows.map((t) => {
            const st = TICKET_STATUS[t.ticketstatus] || TICKET_STATUS.open;
            const last = t.comments[t.comments.length - 1];
            return (
              <Link key={t.id} to={`/account/tickets/${t.id}`} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700"><LifeBuoy className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-ink-900">{t.subject}</span>
                    <Badge cls={st.cls}>{st.label}</Badge>
                  </div>
                  <div className="text-xs text-slate-500">{t.ticketno}{t.category ? ` · ${t.category}` : ""} · {whenLabel(t.createdAt)}</div>
                  {last && <p className="mt-1 line-clamp-1 text-sm text-slate-600"><span className="font-medium">{last.bytype === "party" ? "You" : last.byname || "Support"}:</span> {last.text}</p>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </ServicePage>
  );
}

/** One ticket: details, conversation, reply, close or reopen. */
export function MyTicketPage() {
  const { id = "" } = useParams();
  const { data, loading, error } = useQuery(GET_MY_TICKET, { variables: { id }, fetchPolicy: "cache-and-network", pollInterval: 30000 });
  const [reply, { loading: sending }] = useMutation(REPLY_MY_TICKET);
  const [setStatus, { loading: changing }] = useMutation(SET_MY_TICKET_STATUS);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const t = data?.getSupportTicketById;
  const done = t && ["resolved", "closed"].includes(t.ticketstatus);

  const send = async () => {
    if (!text.trim()) return;
    setMsg("");
    try { await reply({ variables: { id, text: text.trim() } }); setText(""); }
    catch (e: any) { setMsg(e?.message || "Could not send."); }
  };
  const status = async (s: string) => {
    setMsg("");
    try { await setStatus({ variables: { id, ticketstatus: s } }); } catch (e: any) { setMsg(e?.message || "Could not update."); }
  };

  return (
    <ServicePage title={t ? t.ticketno : "Ticket"} back="/account/tickets" crumbs={[{ label: "Support Tickets", to: "/account/tickets" }]}
      action={t && (done
        ? <button type="button" disabled={changing} onClick={() => status("open")} className="h-9 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-ink-900 hover:bg-slate-50">Reopen Ticket</button>
        : <button type="button" disabled={changing} onClick={() => status("closed")} className="h-9 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-ink-900 hover:bg-slate-50">Close Ticket</button>)}>
      {loading && !t ? <Loading /> : !t ? <p className="text-sm text-rose-600">{error?.message || "Ticket not found."}</p> : (
        <>
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-ink-900">{t.subject}</h2>
              <Badge cls={(TICKET_STATUS[t.ticketstatus] || TICKET_STATUS.open).cls}>{(TICKET_STATUS[t.ticketstatus] || TICKET_STATUS.open).label}</Badge>
            </div>
            <div className="text-xs text-slate-500">Raised {whenLabel(t.createdAt)}{t.category ? ` · ${t.category}` : ""} · {t.priority.charAt(0).toUpperCase() + t.priority.slice(1)} priority</div>
            {t.description && <p className="whitespace-pre-line text-sm text-slate-700">{t.description}</p>}
          </div>

          <div className="space-y-3">
            {t.comments.map((c: any) => {
              const mine = c.bytype === "party";
              return (
                <div key={c.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${mine ? "bg-brand-600 text-white" : "border border-slate-200 bg-white text-ink-900"}`}>
                    <div className={`mb-0.5 text-xs ${mine ? "text-white/80" : "text-slate-500"}`}>{mine ? "You" : c.byname || "Support"} · {whenLabel(c.createdAt)}</div>
                    <div className="whitespace-pre-line">{c.text}</div>
                  </div>
                </div>
              );
            })}
            {!t.comments.length && <p className="text-center text-sm text-slate-500">No replies yet. We will get back to you soon.</p>}
          </div>

          {msg && <p className="text-sm text-rose-600">{msg}</p>}
          {done ? <p className="rounded-lg bg-slate-50 p-3 text-center text-sm text-slate-600">This ticket is {t.ticketstatus}. Reopen it to write again.</p> : (
            <div className="flex items-end gap-2">
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Write a reply"
                className="flex-1 rounded-lg border border-slate-300 p-3 text-sm" />
              <button type="button" onClick={send} disabled={sending || !text.trim()} className="flex h-10 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                <Send className="h-4 w-4" /> Send
              </button>
            </div>
          )}
        </>
      )}
    </ServicePage>
  );
}
