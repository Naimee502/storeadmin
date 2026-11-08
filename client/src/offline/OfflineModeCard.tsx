// "Offline billing (this device)" override for the settings screen: follow the business, or force on / off.
import { useState, useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";
import { getDeviceMode, modeStore, setDeviceMode, type DeviceMode } from "./settings";
import { useAppSelector } from "../redux/hooks";
import { countOutboxForCurrentUser } from "./outbox";
import { clearAllRecords } from "./localdb";
import { unregisterServiceWorker } from "./sw";

const OPTIONS: Array<[DeviceMode, string]> = [
  ["follow", "Business setting"],
  ["on", "On"],
  ["off", "Off"],
];

export default function OfflineModeCard() {
  const mode = useSyncExternalStore(modeStore.subscribe, getDeviceMode);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const business = useAppSelector((s: any) => s.adminsettings?.settings?.offlineBilling === true);
  const modeOn = (m: DeviceMode) => m === "on" || (m === "follow" && business);
  const active = modeOn(mode);

  const choose = async (next: DeviceMode) => {
    if (busy || next === mode) return;
    setNote(null);
    if (!active || modeOn(next)) {
      setDeviceMode(next);
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
        setNote(`${counts.mine} saved document(s) are still waiting to sync or failed. Sync or discard them before turning offline billing off.`);
        return;
      }
      if (!window.confirm("Turn off offline billing on this device? Data stored for offline use is removed.")) return;
      setDeviceMode(next);
      await clearAllRecords();
      unregisterServiceWorker();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px]">
      <div className="flex min-w-0 items-start gap-2">
        <WifiOff size={16} className="mt-0.5 shrink-0 text-slate-500" />
        <div className="min-w-0">
          <div className="font-medium text-slate-800">
            Offline billing (this device) <span className={active ? "text-emerald-600" : "text-slate-500"}>· {active ? "On" : "Off"}</span>
          </div>
          <div className="text-[12px] text-slate-500">
            Sales invoices, orders, returns and receipts are saved on this browser first and sync when the internet is back. Business setting: {business ? "On" : "Off"}.
          </div>
          {note && <div className="mt-1 text-[12px] text-rose-600">{note}</div>}
        </div>
      </div>
      <div role="radiogroup" aria-label="Offline billing (this device)" className="flex shrink-0 overflow-hidden rounded-md border border-slate-300">
        {OPTIONS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mode === value}
            disabled={busy}
            onClick={() => void choose(value)}
            className={`h-8 px-2.5 text-[12px] font-medium disabled:opacity-50 ${mode === value ? "bg-indigo-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
