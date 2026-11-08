// Queue of create mutations saved while offline, plus the sync engine.
import { gql, type ApolloClient, type NormalizedCacheObject } from "@apollo/client";
import { OUTBOX_STORE, idbDelete, idbGetAll, idbPut } from "./idb";
import { currentUserKey } from "./userkey";

export type OutboxStatus = "pending" | "failed";

export interface OutboxItem {
  id: string;
  operationName: string;
  query: string;
  variables: Record<string, any>;
  createdAt: number;
  attempts: number;
  lastError: string | null;
  status: OutboxStatus;
  userKey: string | null;
  branchHeader: string;
  typename: string;
  label: string;
  partyName: string | null;
  amount: number | null;
  billdate: string | null;
}

export interface OfflineSnapshot {
  online: boolean;
  syncing: boolean;
  pending: number;
  failed: OutboxItem[];
}

const SYNC_INTERVAL_MS = 30000;
const LOCK_NAME = "storeadmin-offline-sync";
const CHANNEL_NAME = "storeadmin-offline";

let client: ApolloClient<NormalizedCacheObject> | null = null;
let snapshot: OfflineSnapshot = {
  online: typeof navigator === "undefined" ? true : navigator.onLine !== false,
  syncing: false,
  pending: 0,
  failed: [],
};
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;
let running = false;
let started = false;

function setSnapshot(patch: Partial<OfflineSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((l) => l());
}

export const offlineStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot(): OfflineSnapshot {
    return snapshot;
  },
};

export function newRequestId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    // Not a secure context; fall through.
  }
  const rnd = () => Math.random().toString(16).slice(2, 10);
  return `${Date.now().toString(16)}-${rnd()}-${rnd()}-${rnd()}`;
}

async function itemsForCurrentUser(): Promise<OutboxItem[]> {
  const key = currentUserKey();
  const all = await idbGetAll<OutboxItem>(OUTBOX_STORE);
  return all.filter((i) => i.userKey === key).sort((a, b) => a.createdAt - b.createdAt);
}

export async function refreshOutbox(): Promise<void> {
  try {
    const items = await itemsForCurrentUser();
    setSnapshot({
      pending: items.filter((i) => i.status === "pending").length,
      failed: items.filter((i) => i.status === "failed"),
    });
  } catch {
    // Storage unavailable; keep the last known counts.
  }
}

function announce() {
  try {
    channel?.postMessage("changed");
  } catch {
    // Channel closed.
  }
  void refreshOutbox();
}

export async function enqueue(item: OutboxItem): Promise<void> {
  await idbPut(OUTBOX_STORE, item);
  announce();
}

// Number of queued or failed items for the current login.
export async function countOutboxForCurrentUser(): Promise<{ mine: number; others: number }> {
  const key = currentUserKey();
  const all = await idbGetAll<OutboxItem>(OUTBOX_STORE);
  const mine = all.filter((i) => i.userKey === key).length;
  return { mine, others: all.length - mine };
}

function evictSynthetic(item: OutboxItem) {
  try {
    const crid = item.variables?.input?.clientRequestId;
    if (!client || !crid) return;
    client.cache.evict({ id: `${item.typename}:offline-${crid}` });
    client.cache.gc();
  } catch {
    // Nothing to evict.
  }
}

function classify(e: any): { transient: boolean; message: string } {
  const gqlErrors = e?.graphQLErrors;
  if (Array.isArray(gqlErrors) && gqlErrors.length) {
    return { transient: false, message: gqlErrors[0]?.message || "Rejected by server" };
  }
  const ne = e?.networkError;
  const status = ne?.statusCode;
  if (typeof status === "number") {
    const msg = ne?.result?.errors?.[0]?.message || `HTTP ${status}`;
    const permanent = status >= 400 && status < 500 && status !== 408 && status !== 429;
    return { transient: !permanent, message: msg };
  }
  return { transient: true, message: ne?.message || e?.message || "Network error" };
}

async function processQueue(): Promise<void> {
  if (!client) return;
  let synced = false;
  setSnapshot({ syncing: true });
  try {
    for (;;) {
      if (navigator.onLine === false) break;
      const items = await itemsForCurrentUser();
      const item = items.find((i) => i.status === "pending");
      if (!item) break;
      item.attempts += 1;
      try {
        await client.mutate({
          mutation: gql(item.query),
          variables: item.variables,
          context: { offlineSync: true, offlineBranch: item.branchHeader },
          fetchPolicy: "no-cache",
        });
        await idbDelete(OUTBOX_STORE, item.id);
        evictSynthetic(item);
        synced = true;
        announce();
      } catch (e) {
        const { transient, message } = classify(e);
        item.lastError = message;
        if (!transient) item.status = "failed";
        await idbPut(OUTBOX_STORE, item);
        announce();
        if (transient) break;
      }
    }
  } finally {
    setSnapshot({ syncing: false });
  }
  if (synced) {
    try {
      await client.refetchQueries({ include: "active" });
    } catch {
      // Lists refresh on their next fetch.
    }
  }
}

export async function syncNow(): Promise<void> {
  if (!client || running || navigator.onLine === false) return;
  running = true;
  try {
    const locks: any = (navigator as any).locks;
    if (locks?.request) {
      await locks.request(LOCK_NAME, { ifAvailable: true }, async (lock: unknown) => {
        if (lock) await processQueue();
      });
    } else {
      await processQueue();
    }
  } catch {
    // Retry on the next tick.
  } finally {
    running = false;
    void refreshOutbox();
  }
}

export async function retryItem(id: string): Promise<void> {
  const items = await itemsForCurrentUser();
  const item = items.find((i) => i.id === id);
  if (!item) return;
  item.status = "pending";
  await idbPut(OUTBOX_STORE, item);
  announce();
  void syncNow();
}

export async function discardItem(id: string): Promise<void> {
  const items = await itemsForCurrentUser();
  const item = items.find((i) => i.id === id);
  if (!item) return;
  await idbDelete(OUTBOX_STORE, id);
  evictSynthetic(item);
  announce();
}

// Starts the sync engine once per page load (offline mode only).
export function startOutbox(c: ApolloClient<NormalizedCacheObject>): void {
  client = c;
  if (started) return;
  started = true;
  try {
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = () => void refreshOutbox();
    }
  } catch {
    channel = null;
  }
  window.addEventListener("online", () => {
    setSnapshot({ online: true });
    void syncNow();
  });
  window.addEventListener("offline", () => setSnapshot({ online: false }));
  setInterval(() => {
    void refreshOutbox().then(() => {
      if (navigator.onLine !== false && snapshot.pending > 0) void syncNow();
    });
  }, SYNC_INTERVAL_MS);
  void refreshOutbox().then(() => syncNow());
}
