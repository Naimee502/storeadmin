import { useState } from "react";
import { Link, useParams } from "react-router";
import { useMutation, useQuery } from "@apollo/client";
import { Check, Printer, ShieldCheck, Wrench, X } from "lucide-react";
import { API_CONFIG } from "../../config/apiconfig";
import { GET_MY_JOBCARD, GET_MY_JOBCARDS, MY_JOBCARD_PRINT_LINK, RESPOND_MY_ESTIMATE } from "../../graphql/queries/myservice";
import { Badge, Empty, Loading, ServicePage, dateLabel, rupees } from "./shared";

const STEPS = ["received", "diagnosing", "waitingapproval", "inprogress", "ready", "delivered"];
export const JOB_STATUS: Record<string, { label: string; cls: string }> = {
  received: { label: "Received", cls: "bg-slate-100 text-slate-700" },
  diagnosing: { label: "Checking", cls: "bg-sky-50 text-sky-700" },
  waitingapproval: { label: "Waiting for Your Approval", cls: "bg-amber-50 text-amber-700" },
  inprogress: { label: "Repairing", cls: "bg-indigo-50 text-indigo-700" },
  ready: { label: "Ready to Collect", cls: "bg-emerald-50 text-emerald-700" },
  delivered: { label: "Delivered", cls: "bg-emerald-50 text-emerald-700" },
  cancelled: { label: "Cancelled", cls: "bg-rose-50 text-rose-700" },
};
const STEP_LABEL: Record<string, string> = { received: "Received", diagnosing: "Checking", waitingapproval: "Estimate", inprogress: "Repairing", ready: "Ready", delivered: "Delivered" };

/** Customer's repair jobs. */
export function MyRepairsPage() {
  const { data, loading } = useQuery(GET_MY_JOBCARDS, { fetchPolicy: "cache-and-network" });
  const rows: any[] = data?.getMyJobCards || [];
  return (
    <ServicePage title="My Repairs">
      {loading && !rows.length ? <Loading /> : !rows.length ? <Empty text="No repair jobs yet." /> : (
        <div className="space-y-2">
          {rows.map((j) => {
            const st = JOB_STATUS[j.jobStatus] || JOB_STATUS.received;
            return (
              <Link key={j.id} to={`/account/repairs/${j.id}`} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700"><Wrench className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-ink-900">{j.device || "Repair"}{j.serial ? <span className="font-normal text-slate-500"> · {j.serial}</span> : null}</span>
                    <Badge cls={st.cls}>{st.label}</Badge>
                  </div>
                  <div className="text-xs text-slate-500">{j.billnumber} · {dateLabel(j.billdate)}{j.promisedate ? ` · Promised ${dateLabel(j.promisedate)}` : ""}</div>
                  {j.problem && <p className="mt-1 line-clamp-1 text-sm text-slate-600">{j.problem}</p>}
                  {j.canApprove && <p className="mt-1 text-sm font-semibold text-amber-700">Estimate {rupees(j.estimatetotal)} is waiting for your approval</p>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </ServicePage>
  );
}

/** One repair: status steps, details, estimate approval and job sheet print. */
export function MyRepairPage() {
  const { id = "" } = useParams();
  const { data, loading, error } = useQuery(GET_MY_JOBCARD, { variables: { id }, fetchPolicy: "cache-and-network" });
  const [respond, { loading: answering }] = useMutation(RESPOND_MY_ESTIMATE);
  const [printLink, { loading: printing }] = useMutation(MY_JOBCARD_PRINT_LINK);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const j = data?.getMyJobCard;

  const answer = async (approve: boolean) => {
    if (!approve && !window.confirm("Reject this estimate? The shop will contact you.")) return;
    setMsg(null);
    try {
      await respond({ variables: { id, approve, note: note.trim() || undefined } });
      setNote("");
      setMsg({ ok: true, text: approve ? "Thank you. Repair work will start now." : "We have told the shop. They will contact you." });
    } catch (e: any) { setMsg({ ok: false, text: e?.message || "Could not send your answer." }); }
  };
  const print = async () => {
    const w = window.open("", "_blank");
    try {
      const { data: r } = await printLink({ variables: { id } });
      const url = `${API_CONFIG.SERVER_URL}${r?.myJobCardPrintLink}`;
      if (w) w.location.href = url; else window.location.href = url;
    } catch (e: any) { w?.close(); setMsg({ ok: false, text: e?.message || "Could not open the job sheet." }); }
  };

  const at = j ? (j.jobStatus === "cancelled" ? -1 : STEPS.indexOf(j.jobStatus)) : -1;
  const info = (label: string, value?: string | null) => value ? <div><div className="text-xs text-slate-500">{label}</div><div className="text-sm font-medium text-ink-900">{value}</div></div> : null;

  return (
    <ServicePage title={j ? j.billnumber : "Repair"} back="/account/repairs" crumbs={[{ label: "My Repairs", to: "/account/repairs" }]}
      action={j && <button type="button" onClick={print} disabled={printing} className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-ink-900 hover:bg-slate-50"><Printer className="h-4 w-4" /> Job Sheet</button>}>
      {loading && !j ? <Loading /> : !j ? <p className="text-sm text-rose-600">{error?.message || "Repair job not found."}</p> : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-ink-900">{j.device || "Repair"}</h2>
              <Badge cls={(JOB_STATUS[j.jobStatus] || JOB_STATUS.received).cls}>{(JOB_STATUS[j.jobStatus] || JOB_STATUS.received).label}</Badge>
            </div>
            {j.jobStatus === "cancelled" ? <p className="text-sm text-rose-600">This repair job was cancelled.</p> : (
              <ol className="flex items-start">
                {STEPS.map((s, i) => (
                  <li key={s} className="flex flex-1 flex-col items-center text-center">
                    <div className="flex w-full items-center">
                      <div className={`h-0.5 flex-1 ${i === 0 ? "opacity-0" : i <= at ? "bg-brand-600" : "bg-slate-200"}`} />
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${i <= at ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-400"}`}>{i < at ? <Check className="h-4 w-4" /> : i + 1}</span>
                      <div className={`h-0.5 flex-1 ${i === STEPS.length - 1 ? "opacity-0" : i < at ? "bg-brand-600" : "bg-slate-200"}`} />
                    </div>
                    <span className={`mt-1 text-[11px] ${i <= at ? "font-semibold text-ink-900" : "text-slate-400"}`}>{STEP_LABEL[s]}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
            {info("Job No.", j.billnumber)}{info("Received On", dateLabel(j.billdate))}{info("Promised Date", j.promisedate ? dateLabel(j.promisedate) : null)}
            {info("Serial / IMEI", j.serial)}{info("Technician", j.technician)}{info("Accessories Given", j.accessories)}
            {j.deliveredAt && info("Delivered On", dateLabel(j.deliveredAt))}
            {j.warrantydays ? info("Repair Warranty", `${j.warrantydays} days${j.warrantyTill ? ` (till ${dateLabel(j.warrantyTill)})` : ""}`) : null}
            <div className="col-span-2 sm:col-span-3">{info("Problem Reported", j.problem)}</div>
          </div>

          {j.estimate.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-ink-900">Estimate</h3>
                {j.approved === true && <Badge cls="bg-emerald-50 text-emerald-700">Approved{j.approvedAt ? ` · ${dateLabel(j.approvedAt)}` : ""}</Badge>}
                {j.approved === false && <Badge cls="bg-rose-50 text-rose-700">Rejected{j.approvedAt ? ` · ${dateLabel(j.approvedAt)}` : ""}</Badge>}
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-2">Item / Work</th><th className="px-4 py-2 text-right">Qty</th><th className="px-4 py-2 text-right">Rate</th><th className="px-4 py-2 text-right">Amount</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {j.estimate.map((l: any, i: number) => <tr key={i}><td className="px-4 py-2">{l.name}</td><td className="px-4 py-2 text-right">{l.qty}</td><td className="px-4 py-2 text-right">{rupees(l.rate)}</td><td className="px-4 py-2 text-right">{rupees(l.amount)}</td></tr>)}
                </tbody>
                <tfoot><tr className="border-t border-slate-200 font-bold text-ink-900"><td className="px-4 py-2" colSpan={3}>Estimate Total</td><td className="px-4 py-2 text-right">{rupees(j.estimatetotal)}</td></tr></tfoot>
              </table>
              {j.canApprove && (
                <div className="space-y-3 border-t border-slate-100 bg-amber-50/50 p-4">
                  <p className="text-sm text-amber-900">Please approve this estimate so we can start the repair.</p>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Message for the shop (optional)" className="w-full rounded-lg border border-slate-300 p-3 text-sm" />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={answering} onClick={() => answer(true)} className="flex h-10 items-center gap-1.5 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"><Check className="h-4 w-4" /> Approve {rupees(j.estimatetotal)}</button>
                    <button type="button" disabled={answering} onClick={() => answer(false)} className="flex h-10 items-center gap-1.5 rounded-lg border border-rose-200 px-5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"><X className="h-4 w-4" /> Reject</button>
                  </div>
                </div>
              )}
            </div>
          )}
          {msg && <p className={`text-sm ${msg.ok ? "text-emerald-700" : "text-rose-600"}`}>{msg.text}</p>}
          {j.notes && <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm"><div className="mb-1 text-xs text-slate-500">Notes</div><p className="whitespace-pre-line text-slate-700">{j.notes}</p></div>}
          {j.warrantyTill && <p className="flex items-center gap-1.5 text-sm text-emerald-700"><ShieldCheck className="h-4 w-4" /> Repair warranty till {dateLabel(j.warrantyTill)}</p>}
        </>
      )}
    </ServicePage>
  );
}
