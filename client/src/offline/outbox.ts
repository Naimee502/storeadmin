// Outbox of billing changes saved by the offline link, plus the sync engine and its store.
import { gql, type ApolloClient, type NormalizedCacheObject } from "@apollo/client";
import { META_STORE, OUTBOX_STORE, idbDelete, idbGet, idbGetAll, idbPut } from "./idb";
import { currentUserKey } from "./userkey";
import {
  byAge,
  chainStamps,
  collectOfflineIds,
  findQueuedCreate,
  mapItemIds,
  normalizeItem,
  offlineIdFor,
  pickNext,
  withExpected,
  type OutboxItem,
  type Plan,
} from "./core";

export type { OutboxItem, OutboxStatus } from "./core";

export interface OfflineSnapshot {
  online: boolean;
  syncing: boolean;
  // Items waiting to be sent.
  pending: number;
  failed: OutboxItem[];
  // Edits that hit a newer version on the server (first sync won).
  review: OutboxItem[];
  // Every item of the current login, oldest first.
  items: OutboxItem[];
  lastSyncAt: number | null;
}

const SYNC_INTERVAL_MS = 30000;
const LOCK_NAME = "storeadmin-offline-sync";
const CHANNEL_NAME = "storeadmin-offline";
// A send older than this is treated as interrupted (tab closed mid-request).
const SENDING_STALE_MS = 60000;

let client: ApolloClient<NormalizedCacheObject> | null = null;
let snapshot: OfflineSnapshot = {
  online: typeof navigator === "undefined" ? true : navigator.onLine !== false,
  syncing: false,
  pending: 0,
  failed: [],
  review: [],
  items: [],
  lastSyncAt: null,
};
const listeners = new Set<() => void>();
const syncListeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;
let running = false;
let started = false;

function setSnapshot(patch: Partial<OfflineSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((l) => l());
}

// useSyncExternalStore(offlineStore.subscribe, offlineStore.getSnapshot)
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

export const getOfflineClient = () => client;

// Called after a sync run that sent at least one item.
export function onSyncComplete(cb: () => void): () => void {
  syncListeners.add(cb);
  return () => {
    syncListeners.delete(cb);
  };
}

export function newRequestId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    // Not a secure context; fall through.
  }
  const rnd = () => Math.random().toString(16).slice(2, 10);
  return `${Date.now().toString(16)}-${rnd()}-${rnd()}-${rnd()}`;
}

export const isSending = (i: OutboxItem) => i.sendingSince != null && Date.now() - i.sendingSince < SENDING_STALE_MS;

// Current login's items, upgraded to v2, oldest first.
export async function loadItems(): Promise<OutboxItem[]> {
  const key = currentUserKey();
  const all = await idbGetAll<any>(OUTBOX_STORE);
  return all
    .map(normalizeItem)
    .filter((i): i is OutboxItem => !!i && i.userKey === key)
    .map((i) => (i.sendingSince != null && !isSending(i) ? { ...i, sendingSince: null } : i))
    .sort(byAge);
}

export async function refreshOutbox(): Promise<void> {
  try {
    const items = await loadItems();
    setSnapshot({
      items,
      pending: items.filter((i) => i.status === "pending").length,
      failed: items.filter((i) => i.status === "failed"),
      review: items.filter((i) => i.status === "review"),
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

// Writes a plan from core.planChange.
export async function applyPlan(plan: Plan): Promise<void> {
  for (const id of plan.remove) await idbDelete(OUTBOX_STORE, id);
  for (const item of plan.put) await idbPut(OUTBOX_STORE, item);
  if (plan.put.length || plan.remove.length) announce();
}

// Number of queued or failed items for the current login.
export async function countOutboxForCurrentUser(): Promise<{ mine: number; others: number }> {
  const key = currentUserKey();
  const all = await idbGetAll<OutboxItem>(OUTBOX_STORE);
  const mine = all.filter((i) => i.userKey === key).length;
  return { mine, others: all.length - mine };
}

// ---------- Temp id -> real id map (per login) ----------

type IdMapRecord = { key: string; map: Record<string, string> };
const MAX_ID_MAP = 1000;
const idMapKey = () => `idmap:${currentUserKey() || ""}`;
let idMapCache: { key: string; map: Record<string, string> } | null = null;

export async function loadIdMap(): Promise<Record<string, string>> {
  const key = idMapKey();
  if (idMapCache?.key === key) return idMapCache.map;
  let map: Record<string, string> = {};
  try {
    map = (await idbGet<IdMapRecord>(META_STORE, key))?.map || {};
  } catch {
    // Start empty.
  }
  idMapCache = { key, map };
  return map;
}

// Sync, from memory: real id for a temp id already synced in this tab or loaded before.
export function mappedId(id: string): string | null {
  return idMapCache?.key === idMapKey() ? idMapCache.map[id] ?? null : null;
}

async function addIdMapping(tempId: string, realId: string) {
  const key = idMapKey();
  let current: Record<string, string> = {};
  try {
    current = (await idbGet<IdMapRecord>(META_STORE, key))?.map || {};
  } catch {
    current = idMapCache?.key === key ? idMapCache.map : {};
  }
  const entries = Object.entries({ ...current, [tempId]: realId });
  const map = Object.fromEntries(entries.slice(-MAX_ID_MAP));
  idMapCache = { key, map };
  try {
    await idbPut(META_STORE, { key, map } satisfies IdMapRecord);
  } catch {
    // Kept in memory for this tab.
  }
}

// Waits while another sync is sending this item; "gone" once it has synced or been removed.
export async function waitUntilNotSending(id: string, timeoutMs = 30000): Promise<"free" | "gone" | "busy"> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const raw = await idbGet<any>(OUTBOX_STORE, id);
    const item = normalizeItem(raw);
    if (!item) return "gone";
    if (!isSending(item)) return "free";
    if (Date.now() > until) return "busy";
    await new Promise((r) => setTimeout(r, 250));
  }
}

// ---------- Sync ----------

function evictSynthetic(item: OutboxItem) {
  try {
    if (!client || item.kind !== "create" || !item.clientRequestId) return;
    client.cache.evict({ id: `${item.typename}:${offlineIdFor(item.clientRequestId)}` });
    client.cache.gc();
  } catch {
    // Nothing to evict.
  }
}

type Outcome = { kind: "conflict"; message: string; current: any } | { kind: "failed"; message: string } | { kind: "transient"; message: string };

function classify(e: any): Outcome {
  const gqlErrors = e?.graphQLErrors?.length ? e.graphQLErrors : e?.networkError?.result?.errors;
  if (Array.isArray(gqlErrors) && gqlErrors.length) {
    const g = gqlErrors[0] || {};
    const ext = g.extensions || {};
    const message = g.message || "Rejected by server";
    if (ext.code === "CONFLICT") return { kind: "conflict", message, current: ext.current ?? ext.exception?.current ?? null };
    // Session refresh failed: try again later rather than marking the bill failed.
    if (ext.code === "UNAUTHENTICATED") return { kind: "transient", message };
    return { kind: "failed", message };
  }
  const ne = e?.networkError;
  const status = ne?.statusCode;
  if (typeof status === "number") {
    const permanent = status >= 400 && status < 500 && status !== 408 && status !== 429;
    return { kind: permanent ? "failed" : "transient", message: `HTTP ${status}` };
  }
  return { kind: "transient", message: ne?.message || e?.message || "Network error" };
}

async function sendItem(original: OutboxItem, map: Record<string, string>): Promise<"done" | "next" | "stop"> {
  if (!client) return "stop";
  const item = mapItemIds([original], map)[0] || original;
  const sending: OutboxItem = { ...item, sendingSince: Date.now(), attempts: item.attempts + 1 };
  await idbPut(OUTBOX_STORE, sending);
  try {
    const res = await client.mutate({
      mutation: gql(item.query),
      variables: item.variables,
      context: { offlineSync: true, offlineBranch: item.branchHeader },
      fetchPolicy: "no-cache",
    });
    const data: any = res.data ? (res.data as any)[item.field] ?? Object.values(res.data as any)[0] : null;
    await idbDelete(OUTBOX_STORE, item.id);
    const rest = (await loadItems()).filter((i) => i.id !== item.id);
    let changed: OutboxItem[] = [];
    if (item.kind === "create" && item.clientRequestId && typeof data?.id === "string") {
      const tempId = offlineIdFor(item.clientRequestId);
      await addIdMapping(tempId, data.id);
      changed = mapItemIds(rest, { [tempId]: data.id });
      evictSynthetic(item);
    } else {
      const stamp = typeof data?.updatedAt === "string" ? data.updatedAt : null;
      changed = chainStamps(rest, item, stamp, item.targetId);
    }
    for (const c of changed) await idbPut(OUTBOX_STORE, c);
    announce();
    return "done";
  } catch (e) {
    const out = classify(e);
    const base: OutboxItem = { ...sending, sendingSince: null, lastError: out.message };
    if (out.kind === "conflict") await idbPut(OUTBOX_STORE, { ...base, status: "review", conflict: out.current });
    else if (out.kind === "failed") await idbPut(OUTBOX_STORE, { ...base, status: "failed" });
    else await idbPut(OUTBOX_STORE, base);
    announce();
    return out.kind === "transient" ? "stop" : "next";
  }
}

async function processQueue(): Promise<void> {
  if (!client) return;
  let synced = false;
  setSnapshot({ syncing: true });
  try {
    for (let guard = 0; guard < 1000; guard++) {
      if (navigator.onLine === false) break;
      const items = await loadItems();
      const map = await loadIdMap();
      const { next, orphans } = pickNext(items, map);
      for (const o of orphans) {
        await idbPut(OUTBOX_STORE, { ...o, status: "failed", lastError: "A document it depends on was discarded." });
      }
      if (orphans.length) announce();
      if (!next) break;
      const r = await sendItem(next, map);
      if (r === "done") synced = true;
      if (r === "stop") break;
    }
  } finally {
    setSnapshot({ syncing: false });
  }
  if (synced) {
    setSnapshot({ lastSyncAt: Date.now() });
    try {
      await client.refetchQueries({ include: "active" });
    } catch {
      // Lists refresh on their next fetch.
    }
    syncListeners.forEach((cb) => {
      try {
        cb();
      } catch {
        // Listener errors never stop sync.
      }
    });
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

async function findItem(id: string): Promise<OutboxItem | undefined> {
  return (await loadItems()).find((i) => i.id === id);
}

// Failed item: send it again as is.
export async function retryItem(id: string): Promise<void> {
  const item = await findItem(id);
  if (!item) return;
  await idbPut(OUTBOX_STORE, { ...item, status: "pending", lastError: null, conflict: null });
  announce();
  void syncNow();
}

// Removes an item; a dropped create takes its follow-up ops with it.
export async function discardItem(id: string): Promise<void> {
  const items = await loadItems();
  const item = items.find((i) => i.id === id);
  if (!item) return;
  await idbDelete(OUTBOX_STORE, id);
  if (item.kind === "create" && item.clientRequestId) {
    const tempId = offlineIdFor(item.clientRequestId);
    for (const other of items) {
      if (other.id === id) continue;
      if (other.targetId === tempId) await idbDelete(OUTBOX_STORE, other.id);
      else if (collectOfflineIds(other.variables).has(tempId) && !findQueuedCreate(items.filter((i) => i.id !== id), tempId)) {
        await idbPut(OUTBOX_STORE, { ...other, status: "failed", lastError: "A document it depends on was discarded." });
      }
    }
    evictSynthetic(item);
  }
  announce();
}

// Review: send my change again without the version check (mine wins).
export async function applyMine(id: string): Promise<void> {
  const item = await findItem(id);
  if (!item || item.status !== "review") return;
  await idbPut(OUTBOX_STORE, { ...withExpected(item, null), status: "pending", lastError: null, conflict: null });
  announce();
  void syncNow();
}

// Review: drop my change and show the server version.
export async function discardMine(id: string): Promise<void> {
  const item = await findItem(id);
  if (!item) return;
  await idbDelete(OUTBOX_STORE, id);
  announce();
  try {
    await client?.refetchQueries({ include: "active" });
  } catch {
    // Shown on the next fetch.
  }
}

export const offlineActions = {
  retry: retryItem,
  discard: discardItem,
  applyMine,
  discardMine,
  syncNow,
};

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
  void loadIdMap().finally(() => refreshOutbox().then(() => syncNow()));
}
