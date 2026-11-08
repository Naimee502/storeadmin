// Small floating status pill for offline mode; renders nothing when the mode is off.
import { useState, useSyncExternalStore } from "react";
import { AlertTriangle, CloudOff, RefreshCw, RotateCcw, Trash2, X } from "lucide-react";
import { isOfflineEnabled } from "./settings";
import { discardItem, offlineStore, retryItem, type OutboxItem } from "./outbox";

const fmtAmount = (n: number | null) =>
  n == null ? "" : n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (item: OutboxItem) => {
  const d = item.billdate ? new Date(item.billdate) : new Date(item.createdAt);
  return Number.isNaN(d.getTime()) ? item.billdate || "" : d.toLocaleDateString("en-IN");
};

function StatusBar() {
  const snap = useSyncExternalStore(offlineStore.subscribe, offlineStore.getSnapshot);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const failed = snap.failed;

  if (snap.online && snap.pending === 0 && failed.length === 0) return null;

  const onDiscard = async (item: OutboxItem) => {
    if (!window.confirm(`Discard this ${item.label.toLowerCase()}? It will not be saved to the server.`)) return;
    setBusy(item.id);
    try {
      await discardItem(item.id);
    } finally {
      setBusy(null);
    }
  };

  const onRetry = async (item: OutboxItem) => {
    setBusy(item.id);
    try {
      await retryItem(item.id);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed bottom-3 right-3 z-50 flex flex-col items-end gap-2 text-[13px]">
      {open && failed.length > 0 && (
        <div className="w-80 max-w-[calc(100vw-24px)] rounded-md border border-slate-200 bg-white shadow-lg">
          <div className="flex h-8 items-center justify-between border-b border-slate-200 px-3">
            <span className="font-semibold text-slate-800">Failed to sync</span>
            <button type="button" onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-800" title="Close">
              <X size={14} />
            </button>
          </div>
          <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
            {failed.map((item) => (
              <li key={item.id} className="space-y-1 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-slate-800">{item.partyName || item.label}</span>
                  <span className="shrink-0 tabular-nums text-slate-700">{fmtAmount(item.amount)}</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  {item.label} · {fmtDate(item)}
                </div>
                {item.lastError && <div className="text-[12px] text-rose-600">{item.lastError}</div>}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    disabled={busy === item.id || !snap.online}
                    onClick={() => onRetry(item)}
                    className="inline-flex h-7 items-center gap-1 rounded border border-indigo-600 px-2 text-[12px] font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
                  >
                    <RotateCcw size={12} /> Retry
                  </button>
                  <button
                    type="button"
                    disabled={busy === item.id}
                    onClick={() => onDiscard(item)}
                    className="inline-flex h-7 items-center gap-1 rounded border border-slate-300 px-2 text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Trash2 size={12} /> Discard
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 shadow-sm">
        {!snap.online && (
          <span className="inline-flex items-center gap-1 font-medium text-slate-700">
            <CloudOff size={14} className="text-slate-500" /> Offline
          </span>
        )}
        {snap.pending > 0 && (
          <span className="inline-flex items-center gap-1 text-slate-700">
            <RefreshCw size={13} className={snap.syncing ? "animate-spin text-indigo-600" : "text-slate-500"} />
            {snap.syncing ? `Syncing ${snap.pending}…` : `${snap.pending} waiting to sync`}
          </span>
        )}
        {failed.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-6 items-center gap-1 rounded bg-rose-50 px-2 font-medium text-rose-700 hover:bg-rose-100"
          >
            <AlertTriangle size={13} /> {failed.length} failed
          </button>
        )}
      </div>
    </div>
  );
}

export default function OfflineStatusBar() {
  if (!isOfflineEnabled()) return null;
  return <StatusBar />;
}
