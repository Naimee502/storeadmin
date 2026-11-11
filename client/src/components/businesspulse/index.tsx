import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "@apollo/client";
import { AlertTriangle, Bot, Check, MessageCircle, Package, Phone, RefreshCw, TrendingDown, Wallet, X } from "lucide-react";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { showMessage } from "../../redux/slices/message";
import { selectIsModuleAllowed } from "../../redux/slices/permissions";
import { waLink } from "../../graphql/hooks/crm";
import { GET_BUSINESS_PULSE, SCAN_BUSINESS_PULSE, SET_INSIGHT_STATE } from "../../graphql/queries/insight";
import AiAgent from "../aiagent";

// needs: the module whose records the card is read from, so a login that cannot
// see payments does not get payment cards.
const KINDS: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string; needs: string }> = {
  slipping: { label: "Buying Less", icon: <TrendingDown size={11} />, color: "text-amber-600", bg: "bg-amber-50", needs: "salesinvoice" },
  paymentrisk: { label: "Payment Risk", icon: <Wallet size={11} />, color: "text-rose-600", bg: "bg-rose-50", needs: "payments" },
  stoppeditem: { label: "Stopped Item", icon: <Package size={11} />, color: "text-violet-600", bg: "bg-violet-50", needs: "salesinvoice" },
  stockout: { label: "Running Out", icon: <AlertTriangle size={11} />, color: "text-sky-600", bg: "bg-sky-50", needs: "products" },
};
const money = (n: any) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
const chip = "inline-flex h-6 items-center gap-1 whitespace-nowrap rounded border border-slate-200 bg-white px-1.5 text-[10.5px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50";

const BusinessPulse: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const fullState = useAppSelector((state: any) => state);
  const allowed = selectIsModuleAllowed(fullState, "reports.pulse");
  const canSee = (kind: string) => selectIsModuleAllowed(fullState, KINDS[kind]?.needs || "");
  const [kind, setKind] = useState("all");

  const { data, loading } = useQuery(GET_BUSINESS_PULSE, { variables: { limit: 12 }, skip: !allowed, fetchPolicy: "cache-and-network" });
  const [scan, { loading: scanning }] = useMutation(SCAN_BUSINESS_PULSE, { refetchQueries: ["GetBusinessPulse"] });
  const [setState] = useMutation(SET_INSIGHT_STATE, { refetchQueries: ["GetBusinessPulse"] });

  const pulse = data?.getBusinessPulse;
  const visible = useMemo(
    () => (pulse?.insights || []).filter((i: any) => canSee(i.kind)),
    [pulse, fullState]
  );
  const insights = useMemo(
    () => visible.filter((i: any) => kind === "all" || i.kind === kind),
    [visible, kind]
  );
  const counts: Record<string, number> = useMemo(() => {
    const c: Record<string, number> = {};
    for (const i of visible) c[i.kind] = (c[i.kind] || 0) + 1;
    return c;
  }, [visible]);
  const tabs = useMemo(() => ["all", ...Object.keys(KINDS).filter((k) => counts[k]), "ai"], [counts]);
  const atStake = useMemo(() => visible.reduce((t: number, i: any) => t + (Number(i.value) || 0), 0), [visible]);

  if (!allowed) return null;

  const act = async (id: string, state: string) => {
    try {
      await setState({ variables: { id, state } });
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Could not update.", type: "error" }));
    }
  };
  const runScan = async () => {
    try {
      const r = await scan();
      const n = r?.data?.scanBusinessPulse?.insights?.length ?? 0;
      dispatch(showMessage({ message: n ? `${n} thing(s) need a look.` : "Nothing needs attention right now.", type: "success" }));
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Scan failed.", type: "error" }));
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5 font-sans">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 border-b border-slate-200 pb-2 mb-2">
        <div className="min-w-0 lg:flex-1">
          <h2 className="text-[13px] font-semibold text-slate-900">
            Business Pulse
            {kind !== "ai" && atStake > 0 && <span className="ml-1.5 font-medium text-slate-500">{money(atStake)} at stake</span>}
          </h2>
          <p className="truncate text-[11px] text-slate-500">
            {kind === "ai"
              ? "Ask about sales, customers, payments, stock or staff — it reads your own data"
              : "Customers buying less, payments running late, items dropped, and stock about to run out"}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1 lg:flex-nowrap">
          {tabs.map((t) => {
            const k = KINDS[t];
            const isActive = kind === t;
            return (
              <button
                key={t}
                onClick={() => setKind(t)}
                className={`inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-md border px-2 text-[12px] font-medium transition-colors ${
                  isActive
                    ? "border-slate-900 bg-slate-900 text-white"
                    : t === "ai"
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {t === "ai" ? <Bot size={12} /> : k ? k.icon : null}
                {t === "ai" ? "AI Assistant" : k ? k.label : "All"}
                {t !== "ai" && (
                  <span className={isActive ? "text-slate-300" : "text-slate-400"}>
                    {t === "all" ? visible.length : counts[t]}
                  </span>
                )}
              </button>
            );
          })}
          {kind !== "ai" && (
            <button
              onClick={runScan}
              disabled={scanning}
              className="inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-md border border-slate-300 bg-white px-2 text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={12} className={scanning ? "animate-spin" : ""} /> Scan
            </button>
          )}
        </div>
      </div>

      {kind === "ai" ? (
        <div className="h-[380px]"><AiAgent scope="business" /></div>
      ) : loading && !pulse ? (
        <p className="py-4 text-center text-[11px] text-slate-400">Loading…</p>
      ) : !insights.length ? (
        <p className="py-4 text-center text-[11px] text-slate-400">
          Nothing needs attention right now. Tap Scan to look again.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2 xl:grid-cols-3">
          {insights.map((i: any) => {
            const k = KINDS[i.kind];
            return (
              <div key={i.id} className="rounded-md border border-slate-200 bg-white p-2">
                <div className="flex items-start justify-between gap-1.5">
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-semibold text-slate-900">{i.name}</p>
                    <p className="truncate text-[10px] text-slate-400">
                      {[i.mobile, i.city].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${k?.bg} ${k?.color}`}>
                    {k?.icon} {money(i.value)}
                  </span>
                </div>

                <p className="mt-1 truncate text-[11px] font-medium text-slate-700">{i.title}</p>
                <p className="mt-0.5 text-[10.5px] leading-snug text-slate-500">{i.reason}</p>

                {!!i.evidence?.length && (
                  <div className="mt-1.5 rounded border border-slate-100 bg-slate-50 px-1.5 py-1">
                    {i.evidence.map((e: any, n: number) => (
                      <div key={n} className="flex items-center justify-between gap-2 text-[10px] leading-tight">
                        <span className="truncate text-slate-500">
                          {e.label}
                          {e.detail ? <span className="text-slate-400"> · {e.detail}</span> : null}
                        </span>
                        {e.amount != null && <span className="shrink-0 font-medium text-slate-700">{money(e.amount)}</span>}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  {i.mobile && (
                    <a href={`tel:${i.mobile}`} className={chip}><Phone size={11} /> Call</a>
                  )}
                  {i.mobile && (
                    <a href={waLink(i.mobile, i.draftmessage)} target="_blank" rel="noreferrer" className={chip}>
                      <MessageCircle size={11} /> WhatsApp
                    </a>
                  )}
                  {i.kind === "stockout" && (
                    <button type="button" className={chip} onClick={() => navigate("/purchaseorder/addedit")}>
                      <Package size={11} /> Purchase Order
                    </button>
                  )}
                  <button type="button" className={`${chip} ml-auto`} onClick={() => act(i.id, "done")}>
                    <Check size={11} /> Done
                  </button>
                  <button type="button" className={chip} title="Not relevant" onClick={() => act(i.id, "dismissed")}>
                    <X size={11} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BusinessPulse;
