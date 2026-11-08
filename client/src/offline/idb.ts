// Minimal IndexedDB helpers for the offline cache snapshot and outbox.
const DB_NAME = "storeadmin-offline";
const DB_VERSION = 1;
export const CACHE_STORE = "cache";
export const OUTBOX_STORE = "outbox";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(CACHE_STORE)) db.createObjectStore(CACHE_STORE, { keyPath: "key" });
        if (!db.objectStoreNames.contains(OUTBOX_STORE)) db.createObjectStore(OUTBOX_STORE, { keyPath: "id" });
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

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | void): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req ? (req.result as T) : (undefined as T));
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted"));
      })
  );
}

export const idbGet = <T>(store: string, key: string) => run<T | undefined>(store, "readonly", (s) => s.get(key));
export const idbGetAll = <T>(store: string) => run<T[]>(store, "readonly", (s) => s.getAll());
export const idbPut = (store: string, value: unknown) => run<void>(store, "readwrite", (s) => s.put(value));
export const idbDelete = (store: string, key: string) => run<void>(store, "readwrite", (s) => s.delete(key));
export const idbClear = (store: string) => run<void>(store, "readwrite", (s) => s.clear());
