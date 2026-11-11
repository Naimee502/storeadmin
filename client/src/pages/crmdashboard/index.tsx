import { useState } from "react";
import { useNavigate } from "react-router";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import {
  ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, Tooltip,
} from "chart.js";
import { Check, MessageCircle, Phone, RefreshCw, Sparkles, UserPlus, X } from "lucide-react";
import HomeLayout from "../../layouts/home";
import FormField from "../../components/formfiled";
import AiAgent from "../../components/aiagent";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectModuleActions } from "../../redux/slices/permissions";
import { showMessage } from "../../redux/slices/message";
import { OPPORTUNITY_KINDS, useCrmDashboardQuery, useCrmMutations, useOpportunitiesQuery, waLink } from "../../graphql/hooks/crm";
import { formatDateDMY } from "../../utils/helper";
import { partyLabel } from "../../utils/partylabel";

ChartJS.register(ArcElement, BarElement, CategoryScale, Legend, LinearScale, LineElement, PointElement, Tooltip);

const money = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const short = (n: any) => {
  const v = Number(n || 0);
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)} Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(2)} L`;
  return money(v);
};
const RANGES = [7, 30, 90, 365].map((d) => ({ value: String(d), label: d === 365 ? "Last Year" : `Last ${d} Days` }));
const PALETTE = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#ec4899"];

const Card = ({ label, value, sub, tone = "text-slate-900", onClick }: { label: string; value: string; sub?: string; tone?: string; onClick?: () => void }) => (
  <div onClick={onClick}
    className={`rounded-md border border-slate-200 bg-white px-2 py-1.5 ${onClick ? "cursor-pointer hover:border-indigo-300" : ""}`}>
    <p className="truncate text-[10.5px] font-medium leading-tight text-slate-500">{label}</p>
    <p className={`truncate text-[15px] font-semibold leading-tight ${tone}`}>{value}</p>
    {sub && <p className="truncate text-[10px] leading-tight text-slate-400">{sub}</p>}
  </div>
);

const Panel = ({ title, sub, children, right }: { title: string; sub?: string; children: any; right?: any }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-2.5">
    <div className="mb-2 flex items-start justify-between gap-2 border-b border-slate-200 pb-2">
      <div className="min-w-0">
        <h3 className="text-[13px] font-semibold text-slate-900">{title}</h3>
        {sub && <p className="truncate text-[11px] text-slate-500">{sub}</p>}
      </div>
      {right}
    </div>
    {children}
  </div>
);

const axes = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: { y: { beginAtZero: true, ticks: { precision: 0, font: { size: 10 } } }, x: { ticks: { font: { size: 10 } } } },
};

const CrmDashboard = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  // The dashboard is view-only; only "make a lead" needs its own permission.
  const leadActions = useAppSelector((s) => selectModuleActions(s, "leads"));
  const [days, setDays] = useState(30);
  const [kind, setKind] = useState("");
  const { data, loading } = useCrmDashboardQuery(days);
  const { data: oppData, refetch: refetchOpps } = useOpportunitiesQuery(kind);
  const { refreshOpportunities, setOpportunityState, convertOpportunityToLead, aiDraftForOpportunity } = useCrmMutations();
  const [scanning, setScanning] = useState(false);
  const [drafting, setDrafting] = useState("");

  const d = data?.getCrmDashboard;
  const opps: any[] = oppData?.getOpportunities || [];

  const scan = async () => {
    setScanning(true);
    try {
      const r = await refreshOpportunities();
      const n = r?.data?.refreshOpportunities?.found ?? 0;
      dispatch(showMessage({ message: n ? `${n} customers worth contacting.` : "Nothing new to follow up right now.", type: "success" }));
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Could not scan.", type: "error" }));
    } finally {
      setScanning(false);
    }
  };

  const act = async (o: any, state: string) => {
    try {
      await setOpportunityState({ variables: { id: o.id, state } });
      await refetchOpps();
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Could not update.", type: "error" }));
    }
  };

  const toLead = async (o: any) => {
    try {
      const r = await convertOpportunityToLead({ variables: { id: o.id } });
      const id = r?.data?.convertOpportunityToLead?.id;
      dispatch(showMessage({ message: "Lead created.", type: "success" }));
      if (id) navigate(`/leads/addedit/${id}`);
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Could not create the lead.", type: "error" }));
    }
  };

  // The draft is written, shown on the card, and sent only when the staff taps WhatsApp.
  const draft = async (o: any) => {
    setDrafting(o.id);
    try {
      const r = await aiDraftForOpportunity({ variables: { id: o.id } });
      const res = r?.data?.aiDraftForOpportunity;
      if (!res?.ok) dispatch(showMessage({ message: res?.reason || "Could not write a draft.", type: "error" }));
      await refetchOpps();
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Could not write a draft.", type: "error" }));
    } finally {
      setDrafting("");
    }
  };

  const funnel = {
    labels: (d?.stages || []).filter((s: any) => s.kind === "open").map((s: any) => s.label),
    datasets: [{
      data: (d?.stages || []).filter((s: any) => s.kind === "open").map((s: any) => s.count),
      backgroundColor: PALETTE, borderRadius: 4, barThickness: 22,
    }],
  };
  const sources = {
    labels: (d?.sources || []).map((s: any) => s.label),
    datasets: [{ data: (d?.sources || []).map((s: any) => s.count), backgroundColor: PALETTE, borderWidth: 0 }],
  };
  const trend = {
    labels: (d?.trend || []).map((t: any) => formatDateDMY(t.date).slice(0, 5)),
    datasets: [{
      data: (d?.trend || []).map((t: any) => t.count),
      borderColor: "#4f46e5", backgroundColor: "rgba(79,70,229,0.12)", fill: true, tension: 0.35, pointRadius: 2,
    }],
  };

  return (
    <HomeLayout>
      <div className="w-full space-y-2.5 p-2 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold text-slate-900">CRM Dashboard</h1>
            <p className="truncate text-[11px] text-slate-500">Leads, follow ups and quotations, with an assistant that reads your own data.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="w-36">
              <FormField label="" name="days" type="select" value={String(days)} options={RANGES}
                onChange={(e: any) => e.target.value && setDays(Number(e.target.value))} />
            </div>
            <button type="button" onClick={scan} disabled={scanning}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-indigo-600 px-3 text-[13px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              <RefreshCw size={14} className={scanning ? "animate-spin" : ""} /> Find Leads
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-8">
          <Card label="Open Leads" value={String(d?.openLeads ?? 0)} sub={`${d?.newLeads ?? 0} new`} onClick={() => navigate("/leads")} />
          <Card label="Due Today" value={String(d?.followupsDueToday ?? 0)} sub="follow ups" onClick={() => navigate("/followups")} />
          <Card label="Overdue" value={String(d?.followupsOverdue ?? 0)} sub="follow ups"
            tone={d?.followupsOverdue ? "text-rose-600" : "text-slate-900"} onClick={() => navigate("/followups")} />
          <Card label="To Contact" value={String(d?.opportunities ?? 0)} sub={short(d?.opportunityValue)} tone="text-indigo-700" />
          <Card label="Quotations" value={String(d?.quotationsSent ?? 0)} sub={short(d?.quotationsValue)} onClick={() => navigate("/quotations")} />
          <Card label="Quote Win" value={`${d?.quoteWinRate ?? 0}%`} sub={`${d?.quotationsAccepted ?? 0} accepted`} />
          <Card label="Won" value={String(d?.wonLeads ?? 0)} sub={short(d?.wonValue)} tone="text-emerald-600" />
          <Card label="Conversion" value={`${d?.conversion ?? 0}%`} sub={`${d?.lostLeads ?? 0} lost`} />
        </div>

        <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-3">
          <div className="space-y-2.5 xl:col-span-2">
            <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-3">
              <Panel title="Lead Funnel" sub="Open leads by stage">
                <div className="h-44">{d ? <Bar data={funnel} options={axes} /> : null}</div>
              </Panel>
              <Panel title="Where Leads Come From" sub={`Last ${days} days`}>
                <div className="h-44">
                  {d?.sources?.length
                    ? <Doughnut data={sources} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { font: { size: 10 }, boxWidth: 10 } } } }} />
                    : <p className="pt-16 text-center text-[12px] text-slate-400">No leads yet.</p>}
                </div>
              </Panel>
              <Panel title="New Leads" sub={`Last ${days} days`}>
                <div className="h-44">{d ? <Line data={trend} options={axes} /> : null}</div>
              </Panel>
            </div>

            <Panel
              title="Customers Worth Contacting"
              sub="Found in your own data — no outside list"
              right={
                <div className="w-44 shrink-0">
                  <FormField label="" name="kind" type="select" placeholder="All kinds" value={kind}
                    options={Object.entries(OPPORTUNITY_KINDS).map(([value, k]) => ({ value, label: k.label }))}
                    onChange={(e: any) => setKind(e.target.value || "")} />
                </div>
              }
            >
              {!opps.length ? (
                <p className="py-6 text-center text-[12.5px] text-slate-400">
                  Nothing here yet. Tap <b>Find Leads</b> to scan your customers, quotations and service history.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {opps.map((o) => {
                    const k = OPPORTUNITY_KINDS[o.kind] || { label: o.kind, tone: "bg-slate-50 text-slate-700 ring-slate-200" };
                    return (
                      <div key={o.id} className="rounded-md border border-slate-200 p-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="truncate text-[13px] font-semibold text-slate-800">
                                {partyLabel({ name: o.name, mobile: o.mobile, city: o.city })}
                              </span>
                              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${k.tone}`}>{k.label}</span>
                              {!!o.value && <span className="text-[11px] font-medium text-slate-500">{short(o.value)}</span>}
                            </div>
                            <p className="mt-0.5 text-[12px] text-slate-600">{o.title}</p>
                            <p className="text-[11.5px] text-slate-500">{o.reason}</p>
                            {o.draftmessage && (
                              <p className="mt-1 rounded border border-indigo-100 bg-indigo-50/60 px-2 py-1 text-[11.5px] text-slate-700">{o.draftmessage}</p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            {(
                              <button type="button" title="Write a message" disabled={drafting === o.id} onClick={() => draft(o)}
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-indigo-600 hover:bg-indigo-50 disabled:opacity-50">
                                <Sparkles size={13} className={drafting === o.id ? "animate-pulse" : ""} />
                              </button>
                            )}
                            {o.mobile && (
                              <>
                                <a href={`tel:${o.mobile}`} title="Call"
                                  className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50">
                                  <Phone size={13} />
                                </a>
                                <a href={waLink(o.mobile, o.draftmessage || "")} target="_blank" rel="noreferrer" title="WhatsApp"
                                  className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-emerald-600 hover:bg-emerald-50">
                                  <MessageCircle size={13} />
                                </a>
                              </>
                            )}
                            {leadActions.showAdd && (
                              <button type="button" title="Make a lead" onClick={() => toLead(o)}
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-sky-600 hover:bg-sky-50">
                                <UserPlus size={13} />
                              </button>
                            )}
                            {(
                              <>
                                <button type="button" title="Done" onClick={() => act(o, "done")}
                                  className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-emerald-600 hover:bg-emerald-50">
                                  <Check size={13} />
                                </button>
                                <button type="button" title="Not interested" onClick={() => act(o, "dismissed")}
                                  className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                                  <X size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>

          <div className="space-y-2.5">
            <div className="h-[420px]"><AiAgent /></div>

            <Panel title="Today's Follow Ups" sub={`${d?.followupsOverdue ?? 0} overdue`}
              right={<button type="button" onClick={() => navigate("/followups")} className="shrink-0 text-[12px] font-medium text-indigo-600 hover:underline">Open</button>}>
              {!d?.todayFollowups?.length ? (
                <p className="py-4 text-center text-[12.5px] text-slate-400">Nothing due today.</p>
              ) : (
                <div className="space-y-1">
                  {d.todayFollowups.map((f: any) => (
                    <div key={f.id} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-2 py-1.5">
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-medium text-slate-800">
                          {f.leadid ? partyLabel({ name: f.leadid.company || f.leadid.name, mobile: f.leadid.mobile, city: f.leadid.city }) : "—"}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">{f.note || f.type}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {f.overdue && <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 ring-1 ring-rose-200">Overdue</span>}
                        {f.leadid?.mobile && (
                          <a href={`tel:${f.leadid.mobile}`} title="Call" className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50">
                            <Phone size={13} />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Hot Leads" sub="Biggest open leads"
              right={<button type="button" onClick={() => navigate("/leads")} className="shrink-0 text-[12px] font-medium text-indigo-600 hover:underline">Open</button>}>
              {!d?.hotLeads?.length ? (
                <p className="py-4 text-center text-[12.5px] text-slate-400">No open leads.</p>
              ) : (
                <div className="space-y-1">
                  {d.hotLeads.map((l: any) => (
                    <button key={l.id} type="button" onClick={() => navigate(`/leads/addedit/${l.id}`)}
                      className="flex w-full items-center justify-between gap-2 rounded-md border border-slate-200 px-2 py-1.5 text-left hover:border-indigo-300">
                      <span className="min-w-0 truncate text-[12.5px] font-medium text-slate-800">
                        {partyLabel({ name: l.company || l.name, mobile: l.mobile, city: l.city })}
                      </span>
                      {!!l.expectedvalue && <span className="shrink-0 text-[11.5px] font-semibold text-slate-600">{short(l.expectedvalue)}</span>}
                    </button>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </div>
        {loading && !d && <p className="py-6 text-center text-[13px] text-slate-400">Loading…</p>}
      </div>
    </HomeLayout>
  );
};

export default CrmDashboard;
