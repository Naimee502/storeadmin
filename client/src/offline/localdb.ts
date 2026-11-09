// One IndexedDB database for offline billing: pulled records, the outbox and meta, plus pull sync.
import { gql, type ApolloClient, type NormalizedCacheObject } from "@apollo/client";
import { store } from "../redux/store";
import { currentUserKey } from "./userkey";
import { planPull, type PullChange } from "./core";

const DB_NAME = "storeadmin-offline";
const DB_VERSION = 3;
export const RECORDS_STORE = "records";
export const OUTBOX_STORE = "outbox";
// Device identity, number counters, temp-id map and pull times (keyPath "key").
export const META_STORE = "meta";

export const COLLECTIONS = [
  "salesinvoice",
  "salesorder",
  "salesreturn",
  "payment",
  "product",
  "account",
  "ledger",
  "unit",
  "category",
  "subcategory",
  "brand",
  "model",
  "size",
  "productgroup",
  "branch",
  "staff",
  "pricelist",
  "priceassignment",
  "chargerule",
  "adminsettings",
  "purchaseinvoice",
  "purchaseorder",
  "purchasereturn",
  "stockadjustment",
  "transferstock",
  "deliverychallan",
  "expensenote",
  "transaction",
  "accountgroup",
  "channel",
  "salesroute",
  "holiday",
  "leavetype",
];

const SYNC_PULL = gql`
  query SyncPull($collections: [String!]!, $since: String) {
    syncPull(collections: $collections, since: $since) {
      serverTime
      changes {
        collection
        docs
        deletedIds
        nextSince
      }
    }
  }
`;

const PULL_INTERVAL_MS = 5 * 60 * 1000;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        // v2 kept an Apollo cache snapshot; pulled records replace it.
        if (db.objectStoreNames.contains("cache")) db.deleteObjectStore("cache");
        if (!db.objectStoreNames.contains(OUTBOX_STORE)) db.createObjectStore(OUTBOX_STORE, { keyPath: "id" });
        if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: "key" });
        if (!db.objectStoreNames.contains(RECORDS_STORE)) db.createObjectStore(RECORDS_STORE, { keyPath: "key" }).createIndex("scope", "scope");
      };
      req.onsuccess = () => {
        const db = req.result;
        // Let a newer tab upgrade the schema; reopen on next use.
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error("IndexedDB blocked"));
    } catch (e) {
      reject(e);
    }
  }).catch((e) => {
    dbPromise = null;
    throw e;
  });
  return dbPromise;
}

function tx<T>(stores: string[], mode: IDBTransactionMode, fn: (t: IDBTransaction) => IDBRequest | void): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(stores, mode);
        const req = fn(t);
        t.oncomplete = () => resolve(req ? (req.result as T) : (undefined as T));
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error || new Error("IndexedDB transaction aborted"));
      })
  );
}

export const idbGet = <T>(store: string, key: string) => tx<T | undefined>([store], "readonly", (t) => t.objectStore(store).get(key));
export const idbGetAll = <T>(store: string) => tx<T[]>([store], "readonly", (t) => t.objectStore(store).getAll());
export const idbPut = (store: string, value: unknown) => tx<void>([store], "readwrite", (t) => t.objectStore(store).put(value));
export const idbDelete = (store: string, key: string) => tx<void>([store], "readwrite", (t) => t.objectStore(store).delete(key));

// Read-modify-write of one record in a single transaction; returning undefined writes nothing.
export function idbUpdate<T>(store: string, key: string, fn: (current: T | undefined) => T | undefined): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const t = db.transaction(store, "readwrite");
        const s = t.objectStore(store);
        let next: T | undefined;
        const req = s.get(key);
        req.onsuccess = () => {
          try {
            next = fn(req.result as T | undefined);
            if (next !== undefined) s.put(next);
          } catch (e) {
            t.abort();
            reject(e);
          }
        };
        t.oncomplete = () => resolve(next);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error || new Error("IndexedDB transaction aborted"));
      })
  );
}

// ---------- Records (business + login scope) ----------

type RecordRow = { key: string; scope: string; doc: any };
// Product stock in pulled docs is for the branch the pull was sent under.
type PullMeta = { key: string; since: string | null; at: number; branch: string };

const adminOf = (s: any): string | undefined => {
  const { type, admin, branch, staff } = s?.auth || {};
  return type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : type === "staff" ? staff?.admin?.id : undefined;
};

export function scopeKey(): string | null {
  const user = currentUserKey();
  const adminid = adminOf(store.getState());
  return user && adminid ? `${adminid}|${user}` : null;
}

const pullKey = (scope: string) => `pull:${scope}`;

// In-memory copy of the current scope's records, keyed "collection:id".
let mirror = new Map<string, any>();
let mirrorScope: string | null = null;
let mirrorPulled = false;
let loading: Promise<void> | null = null;

async function loadMirror(scope: string): Promise<void> {
  const rows = await tx<RecordRow[]>([RECORDS_STORE], "readonly", (t) => t.objectStore(RECORDS_STORE).index("scope").getAll(scope));
  const meta = await idbGet<PullMeta>(META_STORE, pullKey(scope));
  if (scopeKey() !== scope) return;
  const prefix = `${scope}|`;
  mirror = new Map(rows.map((r) => [r.key.slice(prefix.length), r.doc]));
  mirrorScope = scope;
  mirrorPulled = !!meta;
}

// Resolves once the in-memory records belong to the current login. Never rejects.
export function localReady(): Promise<void> {
  const scope = scopeKey();
  if (!scope) {
    mirror = new Map();
    mirrorScope = null;
    mirrorPulled = false;
    return Promise.resolve();
  }
  if (mirrorScope === scope) return Promise.resolve();
  if (!loading) loading = loadMirror(scope).catch(() => {}).finally(() => (loading = null));
  return loading;
}

const current = () => mirrorScope !== null && mirrorScope === scopeKey();

// Pulled docs of a collection; null until this login has pulled at least once.
export function localDocs(collection: string): any[] | null {
  if (!current() || !mirrorPulled) return null;
  const prefix = `${collection}:`;
  const out: any[] = [];
  for (const [k, d] of mirror) if (k.startsWith(prefix)) out.push(d);
  return out;
}

export function localDoc(collection: string, id: string): any | null {
  return current() && id ? mirror.get(`${collection}:${id}`) ?? null : null;
}

// Logout: drops this login's records and pull time.
export async function clearScope(scope: string | null = scopeKey()): Promise<void> {
  if (!scope) return;
  if (mirrorScope === scope) {
    mirror = new Map();
    mirrorScope = null;
  }
  await tx<void>([RECORDS_STORE, META_STORE], "readwrite", (t) => {
    const req = t.objectStore(RECORDS_STORE).index("scope").openCursor(IDBKeyRange.only(scope));
    req.onsuccess = () => {
      const c = req.result;
      if (c) {
        c.delete();
        c.continue();
      }
    };
    t.objectStore(META_STORE).delete(pullKey(scope));
  }).catch(() => {});
}

// Turning offline billing off on this device: drops every login's records.
export async function clearAllRecords(): Promise<void> {
  mirror = new Map();
  mirrorScope = null;
  await tx<void>([RECORDS_STORE, META_STORE], "readwrite", (t) => {
    t.objectStore(RECORDS_STORE).clear();
    const req = t.objectStore(META_STORE).getAllKeys();
    req.onsuccess = () => {
      for (const k of req.result) if (String(k).startsWith("pull:")) t.objectStore(META_STORE).delete(k);
    };
  }).catch(() => {});
}

// ---------- Pull sync ----------

let client: ApolloClient<NormalizedCacheObject> | null = null;
let pulling = false;
let again = false;
let timer: ReturnType<typeof setInterval> | null = null;
let unsubscribe: (() => void) | null = null;
let lastScope: string | null = null;

const branchHeader = () => {
  try {
    return localStorage.getItem("branchid") || "";
  } catch {
    return "";
  }
};

async function fetchPull(collections: string[], since: string | null): Promise<{ serverTime: string | null; changes: PullChange[] } | null> {
  const res: any = await client!.query({
    query: SYNC_PULL,
    variables: { collections, since },
    fetchPolicy: "no-cache",
    context: { offlineSync: true },
  });
  return res?.data?.syncPull ?? null;
}

async function applyPull(scope: string, changes: PullChange[], full: boolean, meta: PullMeta | null): Promise<void> {
  const plan = planPull(mirror.keys(), changes, full);
  await tx<void>([RECORDS_STORE, META_STORE], "readwrite", (t) => {
    const rs = t.objectStore(RECORDS_STORE);
    for (const k of plan.remove) rs.delete(`${scope}|${k}`);
    for (const [k, doc] of Object.entries(plan.put)) rs.put({ key: `${scope}|${k}`, scope, doc } satisfies RecordRow);
    if (meta) t.objectStore(META_STORE).put(meta);
  });
  for (const k of plan.remove) mirror.delete(k);
  for (const [k, doc] of Object.entries(plan.put)) mirror.set(k, doc);
}

// Full pull first, then deltas since the last serverTime; cut collections are fetched on. Never rejects.
export async function pullNow(): Promise<void> {
  if (!client || navigator.onLine === false) return;
  if (pulling) {
    again = true;
    return;
  }
  const scope = scopeKey();
  if (!scope) return;
  pulling = true;
  try {
    await localReady();
    const meta = await idbGet<PullMeta>(META_STORE, pullKey(scope));
    const branch = branchHeader();
    const still = () => scopeKey() === scope && mirrorScope === scope;
    // Branch switched: products again in full for that branch's stock.
    if (meta && (meta.branch ?? "") !== branch) {
      const p = await fetchPull(["product"], null);
      if (!p || !still()) return;
      await applyPull(scope, p.changes, true, null);
    }
    const since = meta?.since ?? null;
    const r = await fetchPull(COLLECTIONS, since);
    if (!r || !still()) return;
    await applyPull(scope, r.changes, since == null, null);
    let cut = (r.changes || []).filter((c) => c.nextSince);
    for (let guard = 0; cut.length && guard < 100; guard++) {
      const next: PullChange[] = [];
      for (const c of cut) {
        const more = await fetchPull([c.collection], c.nextSince!);
        if (!more || !still()) return;
        await applyPull(scope, more.changes, false, null);
        next.push(...(more.changes || []).filter((m) => m.nextSince));
      }
      cut = next;
    }
    await applyPull(scope, [], false, { key: pullKey(scope), since: r.serverTime ?? null, at: Date.now(), branch });
    mirrorPulled = true;
  } catch {
    // Next tick, reconnect or start tries again.
  } finally {
    pulling = false;
    if (again) {
      again = false;
      void pullNow();
    }
  }
}

const onOnline = () => void pullNow();

// On start, on reconnect, on a login/business change and every 5 minutes.
export function startPull(c: ApolloClient<NormalizedCacheObject>): void {
  client = c;
  if (timer) return;
  timer = setInterval(() => void pullNow(), PULL_INTERVAL_MS);
  window.addEventListener("online", onOnline);
  const key = () => `${scopeKey() || ""}#${(store.getState() as any)?.selectedBranch?.branchId || ""}`;
  lastScope = key();
  unsubscribe = store.subscribe(() => {
    const k = key();
    if (k === lastScope) return;
    lastScope = k;
    if (scopeKey()) void pullNow();
  });
  void pullNow();
}

export function stopPull(): void {
  if (timer) clearInterval(timer);
  timer = null;
  window.removeEventListener("online", onOnline);
  unsubscribe?.();
  unsubscribe = null;
}
