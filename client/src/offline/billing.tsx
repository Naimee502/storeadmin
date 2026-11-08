// Screen helpers for offline billing; every hook returns today's values when offline mode is off.
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { isOfflineEnabled } from "./settings";
import { offlineStore, type OfflineSnapshot } from "./outbox";
import { getDeviceCode, peekDeviceNumber } from "./device";
import { partyDelta, stockDelta, type DocType } from "./core";

export function useOfflineSnapshot(): OfflineSnapshot {
  return useSyncExternalStore(offlineStore.subscribe, offlineStore.getSnapshot);
}

// Device number for a new bill when offline; null online, noDevice when no code yet.
export function useOfflineNumber(type: DocType, active = true): { number: string | null; noDevice: boolean } {
  const snap = useOfflineSnapshot();
  const offline = snap.enabled && active && !snap.online;
  const [number, setNumber] = useState<string | null>(null);
  const [noDevice, setNoDevice] = useState(false);
  useEffect(() => {
    if (!offline) {
      setNumber(null);
      setNoDevice(false);
      return;
    }
    let live = true;
    void peekDeviceNumber(type)
      .catch(() => null)
      .then((n) => {
        if (!live) return;
        setNumber(n);
        setNoDevice(!n && !getDeviceCode());
      });
    return () => {
      live = false;
    };
  }, [offline, type, snap.items]);
  return { number, noDevice };
}

// One-line note shown when the device has no number series yet.
export function OfflineNumberNote({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="text-[12px] text-amber-700">Offline: the number will be given when this syncs.</div>
  );
}

const idOf = (v: any): string => (!v ? "" : typeof v === "string" ? v : String(v.id ?? v._id ?? ""));

// Product list with each variant's currentstock plus unsynced stock moves; same array when nothing changes.
export function adjustProductsStock(list: any[], branchId: string | null | undefined, items: OfflineSnapshot["items"]): any[] {
  if (!Array.isArray(list) || !list.length || !items.length) return list;
  let changed = false;
  const out = list.map((p: any) => {
    const variants = p?.productvariants;
    if (!Array.isArray(variants) || !variants.length) return p;
    let touched = false;
    const next = variants.map((v: any) => {
      // Base units via the variant's unit conversions, same rule as utils/products/stockcheck.
      const d = stockDelta(items, idOf(p), idOf(v), branchId || null, v);
      if (!d) return v;
      touched = true;
      return { ...v, currentstock: Number(v.currentstock ?? 0) + d };
    });
    if (!touched) return p;
    changed = true;
    return { ...p, productvariants: next };
  });
  return changed ? out : list;
}

// Stock overlay for screens that show or check stock; returns the input untouched when offline mode is off.
export function useOfflineStock(list: any[], branchId: string | null | undefined): any[] {
  const snap = useOfflineSnapshot();
  const on = snap.enabled;
  return useMemo(() => (on ? adjustProductsStock(list, branchId, snap.items) : list), [on, list, branchId, snap.items]);
}

// Unsynced change to a party's outstanding (0 when offline mode is off).
export function useOfflinePartyDelta(partyId: string | null | undefined): number {
  const snap = useOfflineSnapshot();
  if (!snap.enabled || !partyId) return 0;
  return partyDelta(snap.items, partyId);
}

export const OFFLINE_SAVED_MESSAGE = "Saved offline — will sync automatically";

// True when a mutation result is the placeholder returned for a queued save.
export function isOfflineSaved(doc: any): boolean {
  return typeof doc?.id === "string" && doc.id.startsWith("offline-");
}

const subscribeNetwork = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

/** Browser network state, re-rendering on change. */
export const useNetworkOnline = () => useSyncExternalStore(subscribeNetwork, () => navigator.onLine, () => true);

// True when a save was queued on this device (offline id, or offline mode with no network).
export function savedOffline(doc: any): boolean {
  if (isOfflineSaved(doc)) return true;
  return isOfflineEnabled() && typeof navigator !== "undefined" && navigator.onLine === false;
}
