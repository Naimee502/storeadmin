import { useState } from "react";
import { Link, useParams } from "react-router";
import { useMutation, useQuery } from "@apollo/client";
import { CalendarClock, Pill, Printer, Stethoscope } from "lucide-react";
import { API_CONFIG } from "../../config/apiconfig";
import { GET_MY_PRESCRIPTION, GET_MY_PRESCRIPTIONS, MY_PRESCRIPTION_PRINT_LINK } from "../../graphql/queries/myservice";
import { Empty, Loading, ServicePage, dateLabel } from "./shared";

const TIMING: Record<string, string> = { before: "Before food", after: "After food", empty: "Empty stomach", bedtime: "At bedtime" };
const dr = (r: any) => (r?.doctorname ? (/^dr\.?\s/i.test(r.doctorname) ? r.doctorname : `Dr. ${r.doctorname}`) : "Doctor");

/** Patient's prescriptions, newest first. */
export function MyPrescriptionsPage() {
  const { data, loading } = useQuery(GET_MY_PRESCRIPTIONS, { fetchPolicy: "cache-and-network" });
  const rows: any[] = data?.getMyPrescriptions || [];
  return (
    <ServicePage title="My Prescriptions">
      {loading && !rows.length ? <Loading /> : !rows.length ? <Empty text="No prescriptions yet." /> : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Link key={r.id} to={`/account/prescriptions/${r.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-brand-700"><Stethoscope className="h-5 w-5" /></span>
                  <div>
                    <p className="font-semibold text-ink-900">{dr(r)}</p>
                    <p className="text-xs text-slate-500">RX-{r.rxnumber} · {dateLabel(r.billdate)}</p>
                    {(r.diagnosis || r.complaints) && <p className="mt-1 text-sm text-slate-600">{r.diagnosis || r.complaints}</p>}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-slate-500">{r.medicines.length} medicine{r.medicines.length === 1 ? "" : "s"}</span>
              </div>
              {r.nextvisit && <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-brand-700"><CalendarClock className="h-3.5 w-3.5" /> Next visit {dateLabel(r.nextvisit)}</p>}
            </Link>
          ))}
        </div>
      )}
    </ServicePage>
  );
}

/** One prescription with its medicines and a print copy. */
export function MyPrescriptionPage() {
  const { id = "" } = useParams();
  const { data, loading, error } = useQuery(GET_MY_PRESCRIPTION, { variables: { id }, fetchPolicy: "cache-and-network" });
  const [printLink, { loading: printing }] = useMutation(MY_PRESCRIPTION_PRINT_LINK);
  const [msg, setMsg] = useState("");
  const r = data?.getMyPrescription;
  const print = async () => {
    const w = window.open("", "_blank");
    try {
      const { data: p } = await printLink({ variables: { id } });
      const url = `${API_CONFIG.SERVER_URL}${p?.myPrescriptionPrintLink}`;
      if (w) w.location.href = url; else window.location.href = url;
    } catch (e: any) { w?.close(); setMsg(e?.message || "Could not open the prescription."); }
  };
  const v = r?.vitals || {};
  const vitals = [["BP", v.bp], ["Pulse", v.pulse], ["Temp", v.temperature], ["Weight", v.weight], ["SpO2", v.spo2], ["Sugar", v.sugar]].filter(([, x]) => x);
  return (
    <ServicePage title={r ? `RX-${r.rxnumber}` : "Prescription"} back="/account/prescriptions" crumbs={[{ label: "My Prescriptions", to: "/account/prescriptions" }]}
      action={r && <button type="button" onClick={print} disabled={printing} className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-ink-900 hover:bg-slate-50"><Printer className="h-4 w-4" /> Print</button>}>
      {loading && !r ? <Loading /> : !r ? <p className="text-sm text-rose-600">{error?.message || "Prescription not found."}</p> : (
        <div className="space-y-4">
          {msg && <p className="text-sm text-rose-600">{msg}</p>}
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <p className="text-base font-semibold text-ink-900">{dr(r)}{r.doctorqualification ? <span className="font-normal text-slate-500">, {r.doctorqualification}</span> : null}</p>
            <p className="text-xs text-slate-500">{dateLabel(r.billdate)}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {r.complaints && <div><p className="text-xs text-slate-500">Complaints</p><p className="font-medium text-ink-900">{r.complaints}</p></div>}
              {r.diagnosis && <div><p className="text-xs text-slate-500">Diagnosis</p><p className="font-medium text-ink-900">{r.diagnosis}</p></div>}
            </div>
            {vitals.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {vitals.map(([l, x]) => <span key={l} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">{l}: <b>{x}</b></span>)}
              </div>
            )}
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <p className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-ink-900"><Pill className="h-4 w-4 text-brand-700" /> Medicines</p>
            {!r.medicines.length ? <p className="p-4 text-sm text-slate-500">No medicines.</p> : (
              <ul className="divide-y divide-slate-100">
                {r.medicines.map((m: any, i: number) => (
                  <li key={i} className="px-4 py-3 text-sm">
                    <p className="font-semibold text-ink-900">{m.name}</p>
                    <p className="text-slate-600">{[m.dose, m.frequency, TIMING[m.timing] || m.timing, m.days ? `${m.days} days` : ""].filter(Boolean).join(" · ")}</p>
                    {m.notes && <p className="text-xs text-slate-500">{m.notes}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {(r.tests || r.advice || r.nextvisit) && (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-sm">
              {r.tests && <p><span className="text-slate-500">Tests: </span><span className="font-medium text-ink-900">{r.tests}</span></p>}
              {r.advice && <p><span className="text-slate-500">Advice: </span><span className="font-medium text-ink-900">{r.advice}</span></p>}
              {r.nextvisit && <p className="flex items-center gap-1.5 font-medium text-brand-700"><CalendarClock className="h-4 w-4" /> Next visit {dateLabel(r.nextvisit)}</p>}
            </div>
          )}
        </div>
      )}
    </ServicePage>
  );
}
