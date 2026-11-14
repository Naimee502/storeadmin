import { useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "@apollo/client";
import { BadgeCheck, CalendarClock, ShieldCheck, Wrench } from "lucide-react";
import { GET_MY_CONTRACTS, GET_MY_MEMBERSHIPS, REQUEST_CONTRACT_SERVICE } from "../../graphql/queries/myservice";
import { Badge, Empty, Loading, ServicePage, dateLabel, rupees, time12 } from "./shared";

const STATE: Record<string, { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-emerald-50 text-emerald-700" },
  expiring: { label: "Ending Soon", cls: "bg-amber-50 text-amber-700" },
  expired: { label: "Expired", cls: "bg-rose-50 text-rose-700" },
  cancelled: { label: "Cancelled", cls: "bg-slate-100 text-slate-700" },
  used: { label: "All Sessions Used", cls: "bg-slate-100 text-slate-700" },
};
const daysText = (d: number | null | undefined) => d == null ? "" : d < 0 ? `Ended ${-d} day${d === -1 ? "" : "s"} ago` : d === 0 ? "Ends today" : `${d} day${d === 1 ? "" : "s"} left`;

/** Time used between start and end, as a percent. */
const usedPct = (start: string, end: string) => {
  const s = Date.parse(`${start}T00:00:00Z`), e = Date.parse(`${end}T00:00:00Z`), now = Date.now();
  return e > s ? Math.min(100, Math.max(0, ((now - s) / (e - s)) * 100)) : 100;
};

/** Customer's AMC and warranty plans, with a service request for an active one. */
export function MyContractsPage() {
  const navigate = useNavigate();
  const { data, loading } = useQuery(GET_MY_CONTRACTS, { fetchPolicy: "cache-and-network" });
  const [request, { loading: sending }] = useMutation(REQUEST_CONTRACT_SERVICE);
  const [asking, setAsking] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const rows: any[] = data?.getMyContracts || [];

  const submit = async (id: string) => {
    if (!text.trim()) return setError("Tell us what needs service.");
    setError("");
    try {
      const { data: r } = await request({ variables: { id, message: text.trim() } });
      setAsking(""); setText("");
      navigate(`/account/tickets/${r?.requestMyContractService?.id}`);
    } catch (e: any) { setError(e?.message || "Could not send the request."); }
  };

  return (
    <ServicePage title="AMC / Warranty">
      {loading && !rows.length ? <Loading /> : !rows.length ? <Empty text="No AMC or warranty yet." /> : (
        <div className="space-y-3">
          {rows.map((c) => {
            const st = STATE[c.state] || STATE.active;
            const live = c.state === "active" || c.state === "expiring";
            return (
              <div key={c.id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-brand-700"><ShieldCheck className="h-5 w-5" /></span>
                    <div>
                      <div className="font-semibold text-ink-900">{c.title || (c.contractType === "warranty" ? "Warranty" : "AMC")}</div>
                      <div className="text-xs text-slate-500">{c.contractType === "warranty" ? "Warranty" : "Annual Maintenance Contract"}{c.amount ? ` · ${rupees(c.amount)}` : ""}</div>
                    </div>
                  </div>
                  <Badge cls={st.cls}>{st.label}</Badge>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs text-slate-500"><span>{dateLabel(c.startdate)}</span><span className="font-semibold text-ink-900">{daysText(c.daysleft)}</span><span>{dateLabel(c.enddate)}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full ${c.state === "expiring" ? "bg-amber-500" : c.state === "active" ? "bg-brand-600" : "bg-slate-300"}`} style={{ width: `${usedPct(c.startdate, c.enddate)}%` }} /></div>
                </div>
                {c.visitsallowed ? <p className="text-sm text-slate-600">Service visits: <b className="text-ink-900">{c.visitsdone || 0}</b> of {c.visitsallowed} used</p> : null}
                {c.items.length > 0 && (
                  <div className="rounded-lg bg-slate-50 p-3 text-sm">
                    <div className="mb-1 text-xs font-semibold uppercase text-slate-500">Covered Items</div>
                    <ul className="space-y-0.5">{c.items.map((i: any, k: number) => <li key={k}>{i.name || "Item"}{i.serial ? <span className="text-slate-500"> · S/N {i.serial}</span> : null}{i.note ? <span className="text-slate-500"> · {i.note}</span> : null}</li>)}</ul>
                  </div>
                )}
                {c.notes && <p className="text-sm text-slate-600">{c.notes}</p>}
                {live && (asking === c.id ? (
                  <div className="space-y-2">
                    <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} autoFocus placeholder="What needs service? (e.g. AC in bedroom not cooling)" className="w-full rounded-lg border border-slate-300 p-3 text-sm" />
                    {error && <p className="text-sm text-rose-600">{error}</p>}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => submit(c.id)} disabled={sending} className="h-9 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">{sending ? "Sending..." : "Send Request"}</button>
                      <button type="button" onClick={() => { setAsking(""); setError(""); }} className="h-9 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => { setAsking(c.id); setText(""); setError(""); }} className="flex h-9 items-center gap-1.5 rounded-lg border border-brand-600 px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50"><Wrench className="h-4 w-4" /> Request Service</button>
                ))}
                {c.state === "expired" && <p className="text-sm text-rose-600">This plan has ended. Contact us to renew it.</p>}
              </div>
            );
          })}
        </div>
      )}
    </ServicePage>
  );
}

const VISIT: Record<string, string> = { booked: "Booked", confirmed: "Confirmed", arrived: "Arrived", done: "Used", noshow: "Missed", cancelled: "Cancelled" };

/** Customer's memberships: plan, validity, sessions and visits. */
export function MyMembershipsPage() {
  const { data, loading } = useQuery(GET_MY_MEMBERSHIPS, { fetchPolicy: "cache-and-network" });
  const rows: any[] = data?.getMyMemberships || [];
  return (
    <ServicePage title="My Membership">
      {loading && !rows.length ? <Loading /> : !rows.length ? <Empty text="No membership yet." /> : (
        <div className="space-y-3">
          {rows.map((m) => {
            const st = STATE[m.state] || STATE.active;
            return (
              <div key={m.id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-brand-700"><BadgeCheck className="h-5 w-5" /></span>
                    <div>
                      <div className="font-semibold text-ink-900">{m.plan}</div>
                      <div className="text-xs text-slate-500">From {dateLabel(m.startdate)}{m.enddate ? ` to ${dateLabel(m.enddate)}` : ""}{m.amount ? ` · ${rupees(m.amount)}` : ""}</div>
                    </div>
                  </div>
                  <Badge cls={st.cls}>{st.label}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {m.sessions ? (
                    <div className="rounded-lg bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Sessions left</div>
                      <div className="text-xl font-bold text-ink-900">{m.sessionsleft} <span className="text-sm font-normal text-slate-500">of {m.sessions}</span></div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-brand-600" style={{ width: `${Math.min(100, (m.sessionsused / m.sessions) * 100)}%` }} /></div>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Visits used</div><div className="text-xl font-bold text-ink-900">{m.sessionsused}</div></div>
                  )}
                  {m.daysleft != null && <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Validity</div><div className="text-base font-bold text-ink-900">{daysText(m.daysleft)}</div></div>}
                </div>
                {m.services.length > 0 && <p className="text-sm text-slate-600">Covers: {m.services.join(", ")}</p>}
                {m.visits.length > 0 && (
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase text-slate-500">Visits</div>
                    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100 text-sm">
                      {m.visits.map((v: any) => (
                        <li key={v.id} className="flex items-center justify-between gap-2 px-3 py-2">
                          <span className="flex items-center gap-1.5"><CalendarClock className="h-4 w-4 text-slate-400" /> {dateLabel(v.billdate)}{v.starttime ? `, ${time12(v.starttime)}` : ""}{v.service ? <span className="text-slate-500"> · {v.service}</span> : null}</span>
                          <span className="text-xs font-semibold text-slate-600">{VISIT[v.apptStatus] || v.apptStatus}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {m.state === "expiring" && <p className="text-sm text-amber-700">Your membership is ending soon. Contact us to renew.</p>}
              </div>
            );
          })}
        </div>
      )}
    </ServicePage>
  );
}
