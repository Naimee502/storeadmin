// Floating status pill and the sync side panel for offline mode; renders nothing when the mode is off.
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { useLocation } from "react-router";
import { AlertTriangle, Check, CloudOff, RefreshCw, RotateCcw, Trash2, X } from "lucide-react";
import { isOfflineEnabled } from "./settings";
import { offlineActions, offlineStore, type OutboxItem } from "./outbox";
import { openOfflinePanel, panelStore, type PanelTab } from "./panel";

const KIND_LABEL: Record<OutboxItem["kind"], string> = {
  create: "New",
  edit: "Edit",
  cancel: "Cancel",
  reopen: "Re-open",
  delete: "Delete",
};

const fmtAmount = (n: number | null) =>
  n == null ? "" : n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (item: OutboxItem) => {
  const d = item.billdate ? new Date(item.billdate) : new Date(item.createdAt);
  return Number.isNaN(d.getTime()) ? item.billdate || "" : d.toLocaleDateString("en-IN");
};

// ---------- Mine vs server ----------

const DOC_FIELDS: Array<[string, string]> = [
  ["partyacc", "Party"],
  ["billdate", "Date"],
  ["returndate", "Date"],
  ["paymenttype", "Payment type"],
  ["billtype", "Bill type"],
  ["productservice", "Items"],
  ["subtotal", "Subtotal"],
  ["totaldiscount", "Discount"],
  ["totalgst", "Tax"],
  ["othercharges", "Other charges"],
  ["roundoff", "Round off"],
  ["totalamount", "Total"],
  ["received", "Received"],
  ["refundMode", "Refund mode"],
  ["notes", "Notes"],
  ["status", "Active"],
];

const PAYMENT_FIELDS: Array<[string, string]> = [
  ["paymentdate", "Date"],
  ["type", "Type"],
  ["mode", "Mode"],
  ["partyid", "Party"],
  ["ledgerid", "Ledger"],
  ["counterledgerid", "Against ledger"],
  ["amount", "Amount"],
  ["discount", "Discount"],
  ["commission", "Commission"],
  ["invoices", "Bills settled"],
  ["reference", "Reference"],
  ["remarks", "Remarks"],
];

const idOf = (v: any): string => (!v ? "" : typeof v === "string" ? v : String(v.id ?? v._id ?? ""));
const nameOf = (v: any): string => (v && typeof v === "object" ? v.accountname || v.name || v.ledgername || "" : "");
const num = (v: any) => Math.round((Number(v) || 0) * 100) / 100;

function dayOf(v: any): string {
  if (v === null || v === undefined || v === "") return "";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = /^\d+$/.test(s) ? new Date(Number(s)) : new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10);
}

// Comparable key and display text for one field value.
function view(key: string, v: any, side: "mine" | "server", item: OutboxItem): { cmp: string; text: string } {
  if (key === "productservice") {
    const lines = Array.isArray(v) ? v : [];
    const qty = lines.reduce((s: number, l: any) => s + (Number(l?.qty) || 0), 0);
    const cmp = JSON.stringify(lines.map((l: any) => [idOf(l?.productserviceid), idOf(l?.variantid), num(l?.qty), num(l?.rate), num(l?.discount)]));
    return { cmp, text: `${lines.length} line${lines.length === 1 ? "" : "s"} · qty ${qty}` };
  }
  if (key === "invoices" || key === "othercharges") {
    const rows = Array.isArray(v) ? v : [];
    const field = key === "invoices" ? "settledamount" : "totalamount";
    const total = rows.reduce((s: number, r: any) => s + (Number(r?.[field]) || 0), 0);
    const cmp = JSON.stringify(rows.map((r: any) => [idOf(r?.invoiceid ?? r?.ledgerid), num(r?.[field])]));
    return { cmp, text: rows.length ? `${rows.length} · ${fmtAmount(total)}` : "None" };
  }
  if (key === "partyacc" || key === "partyid" || key === "ledgerid" || key === "counterledgerid") {
    const id = idOf(v);
    const name = nameOf(v) || (side === "mine" && (key === "partyacc" || key === "partyid") ? item.partyName || "" : "");
    return { cmp: id, text: name || (id ? `…${id.slice(-6)}` : "—") };
  }
  if (key.endsWith("date")) {
    const d = dayOf(v);
    return { cmp: d, text: d ? d.split("-").reverse().join("-") : "—" };
  }
  if (typeof v === "number" || ["subtotal", "totaldiscount", "totalgst", "roundoff", "totalamount", "received", "amount", "discount", "commission"].includes(key)) {
    if (v === null || v === undefined || v === "") return { cmp: "", text: "—" };
    return { cmp: String(num(v)), text: fmtAmount(num(v)) };
  }
  if (typeof v === "boolean") return { cmp: String(v), text: v ? "Yes" : "No" };
  const s = v === null || v === undefined ? "" : String(v).trim();
  return { cmp: s.toLowerCase(), text: s || "—" };
}

type DiffRow = { label: string; mine: string; server: string };

function diffRows(item: OutboxItem): DiffRow[] | null {
  const server = item.conflict;
  if (!server || typeof server !== "object") return null;
  if (item.kind !== "edit") {
    const state = server.cancelStatus === "cancelled" ? "Cancelled" : server.orderStatus ? String(server.orderStatus) : "Open";
    return [{ label: "Action", mine: KIND_LABEL[item.kind], server: `Changed, now ${state}` }];
  }
  const mine = item.variables?.input || {};
  const fields = item.docType === "payment" ? PAYMENT_FIELDS : DOC_FIELDS;
  const rows: DiffRow[] = [];
  for (const [key, label] of fields) {
    if (!(key in mine)) continue;
    const a = view(key, mine[key], "mine", item);
    const b = view(key, server[key], "server", item);
    if (a.cmp !== b.cmp) rows.push({ label, mine: a.text, server: b.text });
  }
  return rows;
}

// ---------- Panel ----------

const btn = "inline-flex h-7 items-center gap-1 rounded border px-2 text-[12px] font-medium disabled:opacity-50";
const primary = `${btn} border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700`;
const outline = `${btn} border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
const danger = `${btn} border-rose-600 bg-rose-600 text-white hover:bg-rose-700`;

function ItemHead({ item }: { item: OutboxItem }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-semibold text-slate-800">
          {item.label} {item.number || (item.kind === "create" ? "(number on sync)" : "")}
        </span>
        <span className="shrink-0 tabular-nums text-slate-700">{fmtAmount(item.amount)}</span>
      </div>
      <div className="text-[12px] text-slate-500">
        {item.partyName || "—"} · {KIND_LABEL[item.kind]} · {fmtDate(item)}
      </div>
    </div>
  );
}

type Pending = { id: string; action: "apply" | "discardMine" | "discard" } | null;

function Confirm({ text, onYes, onNo, busy }: { text: string; onYes: () => void; onNo: () => void; busy: boolean }) {
  return (
    <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-[12px] text-amber-900">
      <div>{text}</div>
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={onYes} className={danger}>
          Yes, continue
        </button>
        <button type="button" disabled={busy} onClick={onNo} className={outline}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function Panel({ tab }: { tab: PanelTab }) {
  const snap = useSyncExternalStore(offlineStore.subscribe, offlineStore.getSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Pending>(null);
  const waiting = snap.items.filter((i) => i.status === "pending");

  const run = async (item: OutboxItem, fn: (id: string) => Promise<void>) => {
    setBusy(item.id);
    try {
      await fn(item.id);
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  };

  const tabs: Array<[PanelTab, string, number]> = [
    ["review", "Needs review", snap.review.length],
    ["failed", "Failed", snap.failed.length],
    ["waiting", "Waiting", waiting.length],
  ];

  const empty = (text: string) => <div className="px-4 py-8 text-center text-slate-400">{text}</div>;

  return (
    <aside className="fixed bottom-0 right-0 top-12 z-[60] flex w-[420px] max-w-full flex-col border-l border-slate-200 bg-white text-[13px] shadow-xl">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-slate-200 px-3">
        <span className="inline-flex items-center gap-2 font-semibold text-slate-800">
          <span className={`h-2 w-2 rounded-full ${snap.online ? "bg-emerald-500" : "bg-rose-500"}`} />
          Offline sync
          <span className="font-normal text-slate-500">{snap.online ? (snap.syncing ? "Syncing…" : "Online") : "No internet"}</span>
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!snap.online || snap.syncing}
            onClick={() => void offlineActions.syncNow()}
            className={outline}
            title="Send waiting changes now"
          >
            <RefreshCw size={12} className={snap.syncing ? "animate-spin" : ""} /> Sync now
          </button>
          <button type="button" onClick={() => openOfflinePanel(null)} className="grid h-7 w-7 place-items-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800" title="Close">
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="flex shrink-0 gap-1 border-b border-slate-200 px-2">
        {tabs.map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            onClick={() => openOfflinePanel(key)}
            className={`h-8 border-b-2 px-2 text-[12px] font-medium ${tab === key ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            {label}
            {count > 0 && <span className="ml-1 rounded bg-slate-100 px-1 tabular-nums text-slate-700">{count}</span>}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {tab === "review" &&
          (snap.review.length === 0
            ? empty("Nothing needs review.")
            : (
              <ul className="divide-y divide-slate-100">
                {snap.review.map((item) => {
                  const rows = diffRows(item);
                  const asking = confirm?.id === item.id ? confirm.action : null;
                  return (
                    <li key={item.id} className="space-y-2 px-3 py-3">
                      <ItemHead item={item} />
                      <div className="text-[12px] text-amber-800">Changed on another device after this change was made.</div>
                      {rows === null ? (
                        <div className="text-[12px] text-slate-500">The server version could not be loaded; compare on the document itself.</div>
                      ) : rows.length === 0 ? (
                        <div className="text-[12px] text-slate-500">No listed field differs; only other details changed on the server.</div>
                      ) : (
                        <table className="w-full table-fixed border border-slate-200 text-[12px]">
                          <thead className="bg-slate-50 text-slate-500">
                            <tr>
                              <th className="w-1/4 px-2 py-1 text-left font-medium">Field</th>
                              <th className="px-2 py-1 text-left font-medium">Mine</th>
                              <th className="px-2 py-1 text-left font-medium">On server</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r) => (
                              <tr key={r.label} className="border-t border-slate-100">
                                <td className="px-2 py-1 text-slate-500">{r.label}</td>
                                <td className="truncate px-2 py-1 font-medium text-indigo-700" title={r.mine}>{r.mine}</td>
                                <td className="truncate px-2 py-1 text-slate-800" title={r.server}>{r.server}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      {asking === "apply" ? (
                        <Confirm
                          text="Save your change over the newer version on the server?"
                          busy={busy === item.id}
                          onYes={() => void run(item, offlineActions.applyMine)}
                          onNo={() => setConfirm(null)}
                        />
                      ) : asking === "discardMine" ? (
                        <Confirm
                          text="Discard your change and keep the version saved on the server?"
                          busy={busy === item.id}
                          onYes={() => void run(item, offlineActions.discardMine)}
                          onNo={() => setConfirm(null)}
                        />
                      ) : (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={busy === item.id || !snap.online}
                            title={snap.online ? undefined : "Needs internet"}
                            onClick={() => setConfirm({ id: item.id, action: "apply" })}
                            className={primary}
                          >
                            <Check size={12} /> Apply mine
                          </button>
                          <button type="button" disabled={busy === item.id} onClick={() => setConfirm({ id: item.id, action: "discardMine" })} className={outline}>
                            <Trash2 size={12} /> Discard mine
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ))}
        {tab === "failed" &&
          (snap.failed.length === 0
            ? empty("Nothing failed.")
            : (
              <ul className="divide-y divide-slate-100">
                {snap.failed.map((item) => (
                  <li key={item.id} className="space-y-2 px-3 py-3">
                    <ItemHead item={item} />
                    <div className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[12px] text-rose-700">{item.lastError || "Rejected by the server."}</div>
                    {confirm?.id === item.id ? (
                      <Confirm
                        text={`Discard this ${item.label.toLowerCase()} change? It will not be saved to the server.`}
                        busy={busy === item.id}
                        onYes={() => void run(item, offlineActions.discard)}
                        onNo={() => setConfirm(null)}
                      />
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busy === item.id || !snap.online}
                          title={snap.online ? undefined : "Needs internet"}
                          onClick={() => void run(item, offlineActions.retry)}
                          className={primary}
                        >
                          <RotateCcw size={12} /> Retry
                        </button>
                        <button type="button" disabled={busy === item.id} onClick={() => setConfirm({ id: item.id, action: "discard" })} className={outline}>
                          <Trash2 size={12} /> Discard
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ))}
        {tab === "waiting" &&
          (waiting.length === 0
            ? empty("Everything is synced.")
            : (
              <ul className="divide-y divide-slate-100">
                {waiting.map((item) => (
                  <li key={item.id} className="space-y-1 px-3 py-2.5">
                    <ItemHead item={item} />
                    {item.lastError && <div className="text-[12px] text-slate-500">{item.lastError}</div>}
                  </li>
                ))}
              </ul>
            ))}
      </div>
    </aside>
  );
}

function Pill({ onPos }: { onPos: boolean }) {
  const snap = useSyncExternalStore(offlineStore.subscribe, offlineStore.getSnapshot);
  const failed = snap.failed;
  const review = snap.review;
  // The header dot covers POS, so the pill never sits over its footer buttons.
  if (onPos) return null;
  if (snap.online && snap.pending === 0 && failed.length === 0 && review.length === 0) return null;
  const chip = (children: ReactNode, cls: string, tab: PanelTab) => (
    <button type="button" onClick={() => openOfflinePanel(tab)} className={`inline-flex h-6 items-center gap-1 rounded px-2 font-medium ${cls}`}>
      {children}
    </button>
  );
  return (
    <div className="fixed bottom-3 right-3 z-50 text-[13px]">
      <div className="flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 shadow-sm">
        {!snap.online && (
          <span className="inline-flex items-center gap-1 font-medium text-slate-700">
            <CloudOff size={14} className="text-slate-500" /> Offline
          </span>
        )}
        {snap.pending > 0 &&
          chip(
            <>
              <RefreshCw size={13} className={snap.syncing ? "animate-spin text-indigo-600" : "text-slate-500"} />
              {snap.syncing ? `Syncing ${snap.pending}…` : `${snap.pending} waiting to sync`}
            </>,
            "text-slate-700 hover:bg-slate-50",
            "waiting"
          )}
        {review.length > 0 &&
          chip(
            <>
              <AlertTriangle size={13} /> {review.length} need review
            </>,
            "bg-amber-50 text-amber-800 hover:bg-amber-100",
            "review"
          )}
        {failed.length > 0 &&
          chip(
            <>
              <AlertTriangle size={13} /> {failed.length} failed
            </>,
            "bg-rose-50 text-rose-700 hover:bg-rose-100",
            "failed"
          )}
      </div>
    </div>
  );
}

function StatusBar() {
  const tab = useSyncExternalStore(panelStore.subscribe, panelStore.getSnapshot);
  const { pathname } = useLocation();
  const onPos = pathname.toLowerCase().startsWith("/posdashboard");
  return (
    <>
      {!tab && <Pill onPos={onPos} />}
      {tab && <Panel tab={tab} />}
    </>
  );
}

export default function OfflineStatusBar() {
  if (!isOfflineEnabled()) return null;
  return <StatusBar />;
}
