// Starts and stops offline billing as its switch changes (no reload); does nothing more while it stays off.
import type { ApolloClient, NormalizedCacheObject } from "@apollo/client";
import { persistor } from "../redux/store";
import { isOfflineEnabled, modeStore } from "./settings";
import { countOutboxForCurrentUser, offlineStore, onSyncComplete, setEnabledFlag, startOutbox } from "./outbox";
import { clearScope, pullNow, startPull, stopPull } from "./localdb";
import { registerServiceWorker, unregisterServiceWorker } from "./sw";
import { startDevice } from "./device";
import { isLocalQuery } from "./offlinelink";

// Set once offline billing has run on this browser; without it nothing touches IndexedDB.
const USED_KEY = "offline:used";
const usedBefore = () => {
  try {
    return localStorage.getItem(USED_KEY) === "1" || localStorage.getItem("offline:enabled") === "true";
  } catch {
    return false;
  }
};

let client: ApolloClient<NormalizedCacheObject> | null = null;
let running = false;
let refetchTimer: ReturnType<typeof setTimeout> | null = null;

// Without network, re-answers the open lists from localdb after a disconnect or a local save.
function refreshLocalQueries() {
  if (refetchTimer) clearTimeout(refetchTimer);
  refetchTimer = setTimeout(() => {
    refetchTimer = null;
    if (!client || !running || navigator.onLine !== false) return;
    client.getObservableQueries("active").forEach((q) => {
      if (isLocalQuery(q.query)) void q.refetch().catch(() => {});
    });
  }, 300);
}

function apply() {
  if (!client) return;
  const on = isOfflineEnabled();
  setEnabledFlag(on);
  if (on && !running) {
    running = true;
    try {
      localStorage.setItem(USED_KEY, "1");
    } catch {
      // Only skips the leftover check below.
    }
    startOutbox(client);
    startDevice();
    startPull(client);
    if (import.meta.env.PROD) registerServiceWorker();
  } else if (!on && running) {
    running = false;
    stopPull();
  } else if (!on && usedBefore()) {
    // Bills saved before it was turned off still sync.
    void countOutboxForCurrentUser()
      .then((c) => c.mine > 0 && client && startOutbox(client))
      .catch(() => {});
  }
}

// Called once from index.tsx; waits for the persisted business settings before deciding.
export function startOffline(c: ApolloClient<NormalizedCacheObject>): void {
  client = c;
  const signature = () => JSON.stringify(offlineStore.getSnapshot().items.map((i) => [i.id, i.status, i.number, i.variables]));
  let last = signature();
  offlineStore.subscribe(() => {
    if (navigator.onLine !== false) return;
    const next = signature();
    if (next !== last) refreshLocalQueries();
    last = next;
  });
  onSyncComplete(() => void pullNow());
  window.addEventListener("offline", refreshLocalQueries);
  const first = () => {
    apply();
    if (!isOfflineEnabled()) unregisterServiceWorker();
    modeStore.subscribe(apply);
  };
  if (persistor.getState().bootstrapped) first();
  else {
    const unsub = persistor.subscribe(() => {
      if (!persistor.getState().bootstrapped) return;
      unsub();
      first();
    });
  }
}

// Called from logout before the session keys are removed.
export function offlineOnLogout(): void {
  if (running || usedBefore()) void clearScope();
}
