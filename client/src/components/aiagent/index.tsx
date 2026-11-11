import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles } from "lucide-react";
import { useAiStatusQuery, useCrmMutations } from "../../graphql/hooks/crm";

type Turn = { me: boolean; text: string; steps?: string[] };

const CRM_STARTERS = [
  "Aaj kis ko call karna chahiye?",
  "આ મહિને કેટલા લીડ આવ્યા અને કેટલા જીત્યા?",
  "Kaun se customer bahut dino se nahi aaye?",
  "Which quotations are still waiting for a reply?",
];

const BUSINESS_STARTERS = [
  "Is mahine ka sale kitna hua, pichle mahine se kitna farak?",
  "કોના કેટલા પૈસા બાકી છે?",
  "Kaun sa salesman achha perform kar raha he?",
  "Which items are about to run out?",
];

const STEP_LABEL: Record<string, string> = {
  crm_summary: "CRM summary",
  list_leads: "Leads",
  list_opportunities: "Opportunities",
  list_followups: "Follow ups",
  top_customers: "Top customers",
  sales_summary: "Sales",
  outstanding: "Outstanding",
  stock_alerts: "Stock",
  salesman_performance: "Salesmen",
  business_pulse: "Business Pulse",
};

/** The agent: answers from this business's own data and changes nothing. */
const AiAgent = ({ compact = false, scope = "crm" }: { compact?: boolean; scope?: "crm" | "business" }) => {
  const starters = scope === "business" ? BUSINESS_STARTERS : CRM_STARTERS;
  const { data: statusData, refetch: refetchStatus } = useAiStatusQuery();
  const status = statusData?.getAiStatus;
  const { askAi } = useCrmMutations();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [turns, busy]);

  const ask = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    setTurns((t) => [...t, { me: true, text: question }]);
    setQ("");
    setBusy(true);
    try {
      const r = await askAi({ variables: { question } });
      const a = r?.data?.askAi;
      setTurns((t) => [...t, { me: false, text: a?.ok ? a.answer : a?.reason || "The assistant could not answer that.", steps: a?.steps || [] }]);
    } catch (e: any) {
      setTurns((t) => [...t, { me: false, text: e?.message || "The assistant is not reachable." }]);
    } finally {
      setBusy(false);
      refetchStatus();
    }
  };

  const off = status && !status.on;

  return (
    <div className="flex h-full flex-col rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
        <span className="flex h-6 w-6 items-center justify-center rounded bg-indigo-50 text-indigo-600">
          <Bot size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] font-semibold text-slate-900">{scope === "business" ? "Business Assistant" : "CRM Assistant"}</h3>
          <p className="truncate text-[11px] text-slate-500">Asks your own data. It prepares; you send.</p>
        </div>
        {status?.on && (
          <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-medium text-slate-600" title="AI actions left this month">
            {status.left} left
          </span>
        )}
      </div>

      <div className={`flex-1 space-y-2 overflow-y-auto px-3 py-2 ${compact ? "max-h-[320px]" : "max-h-[520px]"}`}>
        {off && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[12px] text-amber-800">
            {status?.reason}
            <div className="mt-1 text-[11px] text-amber-700">Business Settings → AI Assistant.</div>
          </div>
        )}
        {!turns.length && !off && (
          <div className="space-y-1.5 pt-1">
            <p className="text-[12px] text-slate-500">Try asking:</p>
            {starters.map((s) => (
              <button key={s} type="button" onClick={() => ask(s)}
                className="flex w-full items-start gap-1.5 rounded-md border border-slate-200 px-2 py-1.5 text-left text-[12px] text-slate-700 hover:border-indigo-300 hover:bg-indigo-50">
                <Sparkles size={12} className="mt-0.5 shrink-0 text-indigo-500" /> {s}
              </button>
            ))}
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={t.me ? "flex justify-end" : ""}>
            <div className={`max-w-[92%] whitespace-pre-wrap rounded-lg px-2.5 py-1.5 text-[12.5px] leading-relaxed ${
              t.me ? "bg-indigo-600 text-white" : "border border-slate-200 bg-slate-50 text-slate-800"
            }`}>
              {t.text}
              {!!t.steps?.length && (
                <div className="mt-1 flex flex-wrap gap-1 border-t border-slate-200 pt-1">
                  {[...new Set(t.steps)].map((s) => (
                    <span key={s} className="rounded bg-white px-1.5 py-0.5 text-[10px] text-slate-500 ring-1 ring-slate-200">
                      {STEP_LABEL[s] || s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && <div className="px-1 text-[12px] text-slate-400">Reading your data…</div>}
        <div ref={endRef} />
      </div>

      <form
        className="flex items-center gap-1.5 border-t border-slate-200 p-2"
        onSubmit={(e) => { e.preventDefault(); ask(q); }}
      >
        <input
          className="h-8 min-w-0 flex-1 rounded-md border border-slate-300 px-2 text-[13px] outline-none focus:border-indigo-500"
          placeholder={off ? "AI is switched off" : "Gujarati, Hindi ya English me poochho…"}
          value={q}
          disabled={!!off || busy}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="submit" disabled={!!off || busy || !q.trim()} title="Ask"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40">
          <Send size={14} />
        </button>
      </form>
    </div>
  );
};

export default AiAgent;
