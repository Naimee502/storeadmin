import { useState } from "react";
import { useQuery } from "@apollo/client";
import { BarChart3, Play, Square, Sunrise } from "lucide-react";
import { GET_AI_USAGE, GET_BRIEFING } from "../../graphql/queries/crm";
import { AI_LANGS, canSpeak, getAiLang, setAiLang, speak, stopSpeaking, type AiLang } from "./voice";

const money = (n: any) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;

/** Today's briefing: the most important things, read aloud on tap. Works with AI off (list only). */
export const BriefingCard = () => {
  const [lang, setLang] = useState<AiLang>(getAiLang());
  const [playing, setPlaying] = useState(false);
  const [showUsage, setShowUsage] = useState(false);
  const { data, loading, error } = useQuery(GET_BRIEFING, { variables: { language: lang }, fetchPolicy: "cache-and-network" });
  const b = data?.getBriefing;
  const items: any[] = b?.items || [];
  const spoken = b?.script || items.map((i) => `${i.title}. ${i.detail || ""}`).join(" ");
  const play = () => {
    if (playing) { stopSpeaking(); setPlaying(false); return; }
    speak(spoken, lang);
    setPlaying(true);
    const tick = setInterval(() => {
      if (!window.speechSynthesis.speaking) { setPlaying(false); clearInterval(tick); }
    }, 500);
  };
  if (error) return null;
  return (
    <div className="rounded-lg border border-indigo-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
        <span className="flex h-6 w-6 items-center justify-center rounded bg-amber-50 text-amber-600"><Sunrise size={14} /></span>
        <h3 className="flex-1 text-[13px] font-semibold text-slate-900">Today's Briefing</h3>
        <select value={lang} onChange={(e) => { const l = e.target.value as AiLang; setLang(l); setAiLang(l); }} aria-label="Briefing language"
          className="h-7 rounded border border-slate-200 bg-white px-1 text-[12px] text-slate-600">
          {AI_LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {canSpeak && items.length > 0 && (
          <button type="button" onClick={play}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-indigo-600 px-2.5 text-[12px] font-semibold text-white hover:bg-indigo-700">
            {playing ? <Square size={12} /> : <Play size={12} />} {playing ? "Stop" : "Play"}
          </button>
        )}
        <button type="button" title="AI usage" onClick={() => setShowUsage((v) => !v)}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 px-2 text-[12px] text-slate-600 hover:bg-slate-50">
          <BarChart3 size={12} /> Usage
        </button>
      </div>
      <div className="space-y-1 px-3 py-2">
        {loading && !b && <p className="text-[12px] text-slate-400">Preparing today's briefing…</p>}
        {b && !items.length && <p className="text-[12px] text-slate-500">Nothing urgent today.</p>}
        {items.map((i, n) => (
          <div key={n} className="flex items-start gap-2 text-[12.5px]">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">{n + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-slate-800">{i.title}</div>
              {i.detail && <div className="text-[11.5px] text-slate-500">{i.detail}</div>}
            </div>
            {i.value > 0 && i.kind !== "followups" && i.kind !== "latework" && <span className="shrink-0 text-[11.5px] font-medium text-slate-700">{money(i.value)}</span>}
          </div>
        ))}
        {b?.script && <p className="border-t border-slate-100 pt-1.5 text-[11.5px] italic text-slate-500">{b.script}</p>}
      </div>
      {showUsage && <AiUsagePanel />}
    </div>
  );
};

/** AI calls per day for the last 30 days. */
export const AiUsagePanel = () => {
  const { data, loading } = useQuery(GET_AI_USAGE, { variables: { days: 30 }, fetchPolicy: "network-only" });
  const u = data?.getAiUsage;
  const total = (u?.days || []).reduce((s: number, d: any) => s + d.calls, 0);
  return (
    <div className="border-t border-slate-200 px-3 py-2 text-[12px]">
      <div className="mb-1 font-semibold text-slate-700">AI usage — last 30 days: {loading ? "…" : `${total} calls`}</div>
      {!!u?.tasks?.length && <div className="mb-1 text-slate-500">{u.tasks.map((t: any) => `${t.task}: ${t.calls}`).join(" · ")}</div>}
      <div className="max-h-40 overflow-y-auto">
        <table className="w-full">
          <thead className="text-left text-[11px] uppercase text-slate-400"><tr><th>Date</th><th>Calls</th><th>Failed</th><th>Tokens</th></tr></thead>
          <tbody>
            {(u?.days || []).map((d: any) => (
              <tr key={d.date} className="border-t border-slate-100"><td>{d.date}</td><td>{d.calls}</td><td>{d.failed || ""}</td><td>{(d.intokens + d.outtokens).toLocaleString("en-IN")}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
