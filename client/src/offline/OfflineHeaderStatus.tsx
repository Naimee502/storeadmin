// Header dot (Online / Offline) with the pending count; hidden while offline billing is off and nothing is queued.
import { useSyncExternalStore } from "react";
import { offlineStore } from "./outbox";
import { openOfflinePanel, panelStore } from "./OfflineStatusBar";

export default function OfflineHeaderStatus() {
  const snap = useSyncExternalStore(offlineStore.subscribe, offlineStore.getSnapshot);
  const open = useSyncExternalStore(panelStore.subscribe, panelStore.getSnapshot);
  if (!snap.enabled && !snap.items.length) return null;
  const attention = snap.review.length + snap.failed.length;
  const tab = snap.review.length ? "review" : snap.failed.length ? "failed" : "waiting";
  return (
    <button
      type="button"
      onClick={() => openOfflinePanel(open ? null : tab)}
      className="flex h-8 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2 text-[12px] font-medium text-slate-200 transition-colors hover:bg-slate-800"
      title={snap.online ? "Online. Click to see changes waiting to sync." : "Offline. Bills are saved on this device and sync when the internet is back."}
    >
      <span className={`h-2 w-2 rounded-full ${snap.online ? "bg-emerald-400" : "bg-rose-500"}`} />
      <span className="hidden sm:inline">{snap.online ? "Online" : "Offline"}</span>
      {snap.pending > 0 && <span className="rounded bg-slate-700 px-1 tabular-nums text-slate-100">{snap.pending} pending</span>}
      {attention > 0 && <span className="rounded bg-amber-500 px-1 tabular-nums text-slate-950">{attention}</span>}
    </button>
  );
}

