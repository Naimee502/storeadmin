// Sync side panel (opened from the header dot) and the disconnect alert.
import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, RefreshCw, RotateCcw, Trash2, WifiOff, X } from "lucide-react";
import { isOfflineEnabled, setDeviceMode } from "./settings";
import { offlineActions, offlineStore, type OutboxItem } from "./outbox";
import { useAppDispatch } from "../redux/hooks";
import { showMessage } from "../redux/slices/message";

export type PanelTab = "review" | "failed" | "waiting";

let panelTab: PanelTab | null = null;
const panelListeners = new Set<() => void>();

export const panelStore = {
  subscribe(l: () => void) {
    panelListeners.add(l);
    return () => {
      panelListeners.delete(l);
    };
  },
  getSnapshot: (): PanelTab | null => panelTab,
};

export function openOfflinePanel(next: PanelTab | null) {
  panelTab = next;
  panelListeners.forEach((l) => l());
}

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
  ["adjustmentdate", "Date"],
  ["transferdate", "Date"],
  ["type", "Type"],
  ["tobranchid", "To branch"],
  ["paymenttype", "Payment type"],
  ["billtype", "Bill type"],
  ["productservice", "Items"],
  ["items", "Items"],
  ["subtotal", "Subtotal"],
  ["totaldiscount", "Discount"],
  ["totalgst", "Tax"],
  ["othercharges", "Other charges"],
  ["roundoff", "Round off"],
  ["totalamount", "Total"],
  ["received", "Received"],
  ["paid", "Paid"],
  ["refundMode", "Refund mode"],
  ["notes", "Notes"],
  ["reason", "Reason"],
  ["narration", "Narration"],
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
  if (key === "productservice" || key === "items") {
    const lines = Array.isArray(v) ? v : [];
    const q = (l: any) => l?.qty ?? l?.transferqty ?? l?.quantity;
    const qty = lines.reduce((s: number, l: any) => s + (Number(q(l)) || 0), 0);
    const cmp = JSON.stringify(lines.map((l: any) => [idOf(l?.productserviceid ?? l?.productid), idOf(l?.variantid), num(q(l)), num(l?.rate), num(l?.discount)]));
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
  if (typeof v === "number" || ["subtotal", "totaldiscount", "totalgst", "roundoff", "totalamount", "received", "paid", "amount", "discount", "commission"].includes(key)) {
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

// Once per disconnect: a toast when offline billing is on, else an offer to turn it on for this device.
function DisconnectAlert() {
  const dispatch = useAppDispatch();
  const [ask, setAsk] = useState(false);
  useEffect(() => {
    const onOffline = () => {
      if (isOfflineEnabled()) {
        dispatch(showMessage({ message: "You're offline — bills are saved on this device and will sync.", type: "success", duration: 5000 }));
      } else {
        setAsk(true);
      }
    };
    const onOnline = () => setAsk(false);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [dispatch]);
  if (!ask) return null;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-900/40 p-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-sm space-y-3 rounded-lg bg-white p-4 text-[13px] shadow-xl">
        <div className="flex items-center gap-2 font-semibold text-slate-900">
          <WifiOff size={16} className="text-rose-500" /> No internet. Turn on offline billing for this device?
        </div>
        <div className="text-[12px] text-slate-500">Only data already synced or loaded on this device will be available.</div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setAsk(false)} className={`${outline} h-8`}>
            Not now
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => {
              setDeviceMode("on");
              setAsk(false);
            }}
            className={`${primary} h-8`}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OfflineStatusBar() {
  const tab = useSyncExternalStore(panelStore.subscribe, panelStore.getSnapshot);
  const snap = useSyncExternalStore(offlineStore.subscribe, offlineStore.getSnapshot);
  return (
    <>
      {tab && (snap.enabled || snap.items.length > 0) && <Panel tab={tab} />}
      <DisconnectAlert />
    </>
  );
}
