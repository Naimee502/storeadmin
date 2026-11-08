// Self-contained "Offline mode (this device)" switch for the settings screen.
import { useState } from "react";
import { WifiOff } from "lucide-react";
import { isOfflineEnabled, setOfflineEnabled } from "./settings";
import { countOutboxForCurrentUser } from "./outbox";
import { clearAllCacheSnapshots } from "./persist";
import { unregisterServiceWorker } from "./sw";

export default function OfflineModeCard() {
  const [enabled] = useState(isOfflineEnabled);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const toggle = async () => {
    if (busy) return;
    setNote(null);
    if (!enabled) {
      if (!window.confirm("Turn on offline mode for this device? The page will reload.")) return;
      setOfflineEnabled(true);
      window.location.reload();
      return;
    }
    setBusy(true);
    try {
      let counts = { mine: 0, others: 0 };
      try {
        counts = await countOutboxForCurrentUser();
      } catch {
        // Storage unreadable: nothing can be synced from it either.
      }
      if (counts.mine > 0) {
        setNote(`${counts.mine} saved document(s) are still waiting to sync or failed. Sync or discard them before turning offline mode off.`);
        window.alert(`${counts.mine} saved document(s) have not reached the server yet. Sync or discard them first.`);
        return;
      }
      const extra = counts.others > 0 ? ` ${counts.others} document(s) saved by another login on this device will stay unsynced until offline mode is turned on again and that login signs in.` : "";
      if (!window.confirm(`Turn off offline mode for this device? The page will reload.${extra}`)) return;
      await clearAllCacheSnapshots();
      unregisterServiceWorker();
      setOfflineEnabled(false);
      window.location.reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px]">
      <div className="flex min-w-0 items-start gap-2">
        <WifiOff size={16} className="mt-0.5 shrink-0 text-slate-500" />
        <div className="min-w-0">
          <div className="font-medium text-slate-800">Offline mode (this device)</div>
          <div className="text-[12px] text-slate-500">
            Keeps the app and recently viewed data on this browser and saves new sales invoices and orders while offline, syncing them when the internet is back.
          </div>
          {note && <div className="mt-1 text-[12px] text-rose-600">{note}</div>}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Offline mode (this device)"
        disabled={busy}
        onClick={toggle}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${enabled ? "bg-indigo-600" : "bg-slate-300"}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-4" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}
