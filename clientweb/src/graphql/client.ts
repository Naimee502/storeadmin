import { ApolloClient, InMemoryCache, HttpLink, Observable, from } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { API_CONFIG } from "../config/apiconfig";
import { createOffline } from "./offline";
import { GET_ACCOUNT, GET_ACCOUNT_LEDGERS, GET_PARTY_STOCK, GET_PAYMENTS, GET_SALES_ORDERS } from "./queries/accounts";
import { GET_STORE_CATEGORIES, GET_STORE_PRODUCTS } from "./queries/catalog";
import { GET_MY_ANNOUNCEMENTS } from "./queries/announcements";

// Anonymous storefront browsing (catalog, storefront info, OTP request)
// doesn't need this — but once a party account logs in (sendOTP/verifyOTP),
// requests like getAccountById/getSalesOrders/getPayments and any mutation
// that records createdby_type need the same Bearer token clientapp sends,
// otherwise the server can't tell the request came from an authenticated
// party. Mirrors clientapp/src/apollo/client.ts's token-getter pattern.
let _getToken: (() => string | null) | null = null;

export const setTokenGetter = (fn: () => string | null) => {
  _getToken = fn;
};

/** The signed-in party's token — for the one call made outside Apollo (image upload). */
export const getAuthToken = (): string | null => (_getToken ? _getToken() : null);

// IndexedDB holds the offline data (localStorage is too small); earlier localStorage values are still read.
const idbStorage = (() => {
  let db: Promise<IDBDatabase> | null = null;
  const open = () =>
    (db ??= new Promise((resolve, reject) => {
      const r = indexedDB.open("clientweb-offline", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    }));
  const run = <T,>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) =>
    open().then(
      (d) =>
        new Promise<T>((resolve, reject) => {
          const t = d.transaction("kv", mode);
          const q = fn(t.objectStore("kv"));
          t.oncomplete = () => resolve(q.result);
          t.onerror = () => reject(t.error);
        })
    );
  return {
    getItem: (k: string) => run<any>("readonly", (s) => s.get(k)).then((v) => v ?? localStorage.getItem(k)),
    setItem: (k: string, v: string) => run("readwrite", (s) => s.put(v, k)).then(() => undefined),
  };
})();

export const offline = createOffline({
  Observable,
  storage: typeof indexedDB !== "undefined" ? idbStorage : localStorage,
  getToken: () => (_getToken ? _getToken() : null),
  cacheLimit: 50_000_000,
});

// What a signed-in party's pages read, kept on this browser so the shop works offline (OFFLINE.md, "Apps").
export function warmupFor(partyId: string | null, adminid: string | null) {
  if (!partyId || !adminid) return [];
  return [
    { query: GET_STORE_PRODUCTS, variables: { adminid, limit: 5000, offset: 0 } },
    { query: GET_STORE_CATEGORIES, variables: { adminId: adminid } },
    { query: GET_ACCOUNT, variables: { id: partyId, adminId: adminid } },
    { query: GET_SALES_ORDERS, variables: { adminid, partyacc: partyId } },
    { query: GET_PAYMENTS, variables: { adminid, partyid: partyId } },
    { query: GET_PARTY_STOCK, variables: { partyid: partyId } },
    { query: GET_ACCOUNT_LEDGERS, variables: { adminId: adminid } },
    { query: GET_MY_ANNOUNCEMENTS },
  ];
}

// dev → local, build → live (see config/apiconfig.ts)
const httpLink = new HttpLink({ uri: API_CONFIG.GRAPHQL_URL });

const authLink = setContext((_, { headers }) => {
  const token = _getToken ? _getToken() : null;
  return {
    headers: {
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
});

const apolloClient = new ApolloClient({
  link: from([offline.link, authLink, httpLink]),
  cache: new InMemoryCache(),
  // Saved data shows at once and the server refreshes it (offline-first).
  defaultOptions: { watchQuery: { fetchPolicy: "cache-and-network" } },
});

offline.attach(apolloClient);
window.addEventListener("online", () => offline.setOnline(true));
window.addEventListener("offline", () => offline.setOnline(false));
if (!navigator.onLine) offline.setOnline(false);

export default apolloClient;
