// Saves and restores the Apollo cache per login while offline mode is on.
import type { ApolloClient, NormalizedCacheObject } from "@apollo/client";
import { CACHE_STORE, idbClear, idbDelete, idbGet, idbPut } from "./idb";
import { currentUserKey } from "./userkey";

const SAVE_DELAY_MS = 2000;
const RESTORE_TIMEOUT_MS = 1500;
const MAX_JSON_CHARS = 40 * 1024 * 1024;

type Snapshot = { key: string; data: string; savedAt: number };

let client: ApolloClient<NormalizedCacheObject> | null = null;
// The login whose data is in memory; saves under any other key are skipped.
let sessionKey: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

const storageKey = (userKey: string) => `apollo:${userKey}`;

export async function restoreCache(c: ApolloClient<NormalizedCacheObject>): Promise<void> {
  client = c;
  sessionKey = currentUserKey();
  if (!sessionKey) return;
  const key = sessionKey;
  const load = (async () => {
    const snap = await idbGet<Snapshot>(CACHE_STORE, storageKey(key));
    if (snap?.data) c.cache.restore(JSON.parse(snap.data));
  })().catch(() => {});
  await Promise.race([load, new Promise((r) => setTimeout(r, RESTORE_TIMEOUT_MS))]);
}

async function saveNow(): Promise<void> {
  timer = null;
  if (!client) return;
  const key = currentUserKey();
  if (!key) return;
  if (sessionKey && key !== sessionKey) return;
  sessionKey = key;
  try {
    const data = JSON.stringify(client.cache.extract());
    if (data.length > MAX_JSON_CHARS) return;
    await idbPut(CACHE_STORE, { key: storageKey(key), data, savedAt: Date.now() } satisfies Snapshot);
  } catch {
    // Quota or serialisation failure: keep running without a snapshot.
  }
}

export function scheduleCacheSave(): void {
  if (!client) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void saveNow(), SAVE_DELAY_MS);
}

export function flushCacheSave(): void {
  if (timer) {
    clearTimeout(timer);
    void saveNow();
  }
}

// Logout: drop this login's snapshot and the in-memory data.
export async function clearCacheOnLogout(): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = null;
  const key = currentUserKey() || sessionKey;
  sessionKey = null;
  try {
    if (key) await idbDelete(CACHE_STORE, storageKey(key));
  } catch {
    // Nothing stored or storage unavailable.
  }
  try {
    await client?.clearStore();
  } catch {
    // Ignore; the next login refetches anyway.
  }
}

// Turning offline mode off removes every stored snapshot on this device.
export async function clearAllCacheSnapshots(): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = null;
  client = null;
  try {
    await idbClear(CACHE_STORE);
  } catch {
    // Storage unavailable.
  }
}
