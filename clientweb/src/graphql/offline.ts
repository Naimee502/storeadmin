// Offline sales for clientapp and clientweb (OFFLINE.md, "Apps"). Keep both copies identical.
import { ApolloLink } from '@apollo/client/core';
import { parse, print } from 'graphql';

export type OfflineStorage = {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
};
export type OfflineState = { online: boolean; pending: number; message: string };

// Creates carry clientRequestId, so a retry or a timed-out request never saves twice.
const CREATES: Record<string, string> = {
  AddSalesOrder: 'SalesOrder', AddPayment: 'Payment', AddSalesReturn: 'SalesReturn', AddExpenseClaim: 'ExpenseClaim',
  AddAccount: 'Account', AddVisit: 'Visit', AddTransaction: 'Transaction',
};
const QUEUED = new Set([
  ...Object.keys(CREATES), 'EditSalesOrder', 'MarkSalesInvoiceDelivered', 'MarkSalesOrderDelivered', 'MarkVisit',
  'punch', 'EditExpenseClaim', 'CancelExpenseClaim', 'MarkAnnouncementRead', 'addLeaveRequest', 'cancelLeaveRequest',
  'EditAccount', 'ConfirmSalesOrder', 'CancelSalesOrder', 'DeleteSalesOrder', 'MarkSalesOrderDispatched', 'MarkSalesInvoiceDispatched',
  'AssignOrderDeliveryBoy', 'AssignInvoiceDeliveryBoy', 'ConvertSalesOrderToInvoice', 'MarkNotificationRead', 'MarkAllNotificationsRead', 'UpdateSalesRoute',
  'AddLocationPings',
]);
// Background entries: kept and synced like the rest, but not counted or announced (route points).
const SILENT = new Set(['AddLocationPings']);
// List queries that show pending creates on top of the last synced rows.
const LISTS: Record<string, string> = {
  getSalesOrders: 'AddSalesOrder', getPayments: 'AddPayment', getMySalesReturns: 'AddSalesReturn', getMyExpenseClaims: 'AddExpenseClaim', getAccounts: 'AddAccount',
};
// Status of a pending create when the type's status is not a plain flag.
const PENDING_STATUS: Record<string, string> = { ExpenseClaim: 'pending' };
// A photo taken offline: uploaded on sync before the entry that uses it (apps' uploadImage makes it).
export const UPLOAD_PREFIX = 'pending-upload:';
const PENDING_NUMBER = 'Pending sync';
const TEMP = 'offline-';
const QUEUE_KEY = 'offline:queue';
const CHUNK = 1_000_000;
const WARM_MS = 15 * 60_000;
// Arguments that page or sort a list; an offline read of a saved list applies offset/limit itself.
const PAGING = new Set(['limit', 'offset', 'instockfirst', 'includeDownline', 'directOnly', 'includeConverted']);
const CREATE_TIMEOUT_MS = 3000;
const RETRY_MS = 30_000;

type Item = { id: string; uid: string; name: string; query: string; variables: any; at: string };

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
const opDef = (doc: any) => doc.definitions.find((d: any) => d.kind === 'OperationDefinition');
const rootField = (doc: any) => opDef(doc).selectionSet.selections[0];
const keyOf = (f: any) => f.alias?.value || f.name.value;
const hasTemp = (v: any) => {
  const s = JSON.stringify(v ?? null);
  return s.includes(`"${TEMP}`) || s.includes(`"${UPLOAD_PREFIX}`);
};
const swapId = (v: any, from: string, to: string) => JSON.parse(JSON.stringify(v).split(from).join(to));

// Replaces offline photo markers with uploaded URLs (each upload once).
async function withUploads(v: any, upload: (marker: string) => Promise<string>): Promise<any> {
  if (typeof v === 'string') return v.startsWith(UPLOAD_PREFIX) ? upload(v) : v;
  if (Array.isArray(v)) {
    const out = [];
    for (const x of v) out.push(await withUploads(x, upload));
    return out;
  }
  if (v && typeof v === 'object') {
    const out: any = {};
    for (const k of Object.keys(v)) out[k] = await withUploads(v[k], upload);
    return out;
  }
  return v;
}

// User id from the JWT, so one user's queue and cache are never used by another.
const uidOf = (token: string | null) => {
  if (!token) return '';
  try {
    const p = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return String(JSON.parse((globalThis as any).atob(p + '==='.slice((p.length + 3) % 4))).id || '');
  } catch {
    return '';
  }
};

// No response at all (or a gateway error): the device is treated as offline.
const isNetworkError = (e: any) => {
  const status = e?.statusCode ?? e?.response?.status;
  return !e?.graphQLErrors?.length && !e?.errors?.length && (!status || status >= 502);
};

// Object shaped like a selection; ids and cache refs are resolved from the saved entities.
function fill(set: any, src: any, entities: Record<string, any>, byId: Map<string, any>): any {
  const out: any = {};
  for (const s of set.selections) {
    if (s.kind === 'InlineFragment') Object.assign(out, fill(s.selectionSet, src, entities, byId));
    if (s.kind !== 'Field') continue;
    const v = src?.[s.name.value];
    const obj = (x: any) => {
      const e = x?.__ref ? entities[x.__ref] : typeof x === 'string' ? byId.get(x) : x;
      return e && typeof e === 'object' ? fill(s.selectionSet, e, entities, byId) : null;
    };
    out[keyOf(s)] = s.selectionSet ? (Array.isArray(v) ? v.map(obj) : obj(v)) : v ?? null;
  }
  return out;
}

// A field's argument values with variables filled in.
const valueOf = (n: any, vars: any): any => {
  if (n.kind === 'Variable') return vars?.[n.name.value];
  if (n.kind === 'ObjectValue') return Object.fromEntries(n.fields.map((f: any) => [f.name.value, valueOf(f.value, vars)]));
  if (n.kind === 'ListValue') return n.values.map((x: any) => valueOf(x, vars));
  if (n.kind === 'NullValue') return null;
  if (n.kind === 'IntValue' || n.kind === 'FloatValue') return Number(n.value);
  return n.value;
};
const argsOf = (f: any, vars: any) => Object.fromEntries((f.arguments || []).map((a: any) => [a.name.value, valueOf(a.value, vars)]));
// Nested arguments as one level ({ filter: { partyacc } } -> { partyacc }).
const flat = (o: any, out: Record<string, any> = {}): Record<string, any> => {
  for (const [k, v] of Object.entries(o || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, out);
    else if (v !== undefined) out[k] = v;
  }
  return out;
};

// True when rank a beats rank b, compared left to right.
const better = (a: number[], b: number[]) => {
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
};

const indexById = (entities: Record<string, any>) => {
  const map = new Map<string, any>();
  for (const k of Object.keys(entities)) if (entities[k]?.id) map.set(String(entities[k].id), entities[k]);
  return map;
};

export function createOffline(opts: {
  Observable: any;
  storage: OfflineStorage;
  getToken: () => string | null;
  notify?: (message: string) => void;
  // Uploads an offline photo marker and returns its URL (app only).
  upload?: (marker: string) => Promise<string>;
  // Largest saved cache in characters (the store's size limit).
  cacheLimit?: number;
}) {
  const { Observable, storage, getToken, notify, upload } = opts;
  const cacheLimit = opts.cacheLimit ?? 3_500_000;
  let warmOps: Array<{ query: any; variables?: any }> = [];
  let warmTimer: any = null;
  let restoredFor = '';
  let client: any = null;
  let queue: Item[] = [];
  let state: OfflineState = { online: true, pending: 0, message: '' };
  let saved: { uid: string; data: any } = { uid: '', data: null };
  let scratch: { version: number; cache: any } | null = null;
  let version = 0;
  let saveTimer: any = null;
  let flushing = false;
  const listeners = new Set<() => void>();

  const uid = () => uidOf(getToken());
  const mine = () => queue.filter((i) => i.uid === uid());
  const set = (next: Partial<OfflineState>) => {
    state = { ...state, ...next, pending: mine().filter((i) => !SILENT.has(i.name)).length };
    if (next.message) notify?.(next.message);
    listeners.forEach((l) => l());
  };
  const cacheKey = (u: string) => `offline:cache:${u}`;
  // Saved and current entities, so pending rows show party, product and ledger names.
  const entitiesNow = () => ({ ...(saved.uid === uid() ? saved.data : null), ...client.cache.extract() });
  const saveQueue = () => Promise.resolve(storage.setItem(QUEUE_KEY, JSON.stringify(queue))).catch(() => undefined);
  const loaded = Promise.resolve(storage.getItem(QUEUE_KEY))
    .then((raw) => { queue = raw ? JSON.parse(raw) : []; set({}); })
    .catch(() => undefined);

  // Last saved cache of this user, split in parts: Android AsyncStorage rows hold about 2 MB.
  async function savedData() {
    const u = uid();
    if (saved.uid !== u) {
      saved = { uid: u, data: null };
      try {
        const count = Number(await storage.getItem(cacheKey(u))) || 0;
        let raw = '';
        for (let i = 0; i < count; i += 1) raw += (await storage.getItem(`${cacheKey(u)}:${i}`)) || '';
        saved.data = raw ? JSON.parse(raw) : null;
      } catch { /* a bad saved cache only means fewer offline reads */ }
    }
    return saved.data;
  }

  // Saved rows plus this session's rows; the live cache never gets old rows, so online reads stay fresh.
  async function snapshot() {
    const old = (await savedData()) || {};
    const now = client.cache.extract();
    return { ...old, ...now, ROOT_QUERY: { ...old.ROOT_QUERY, ...now.ROOT_QUERY } };
  }

  function saveSoon() {
    version += 1;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const u = uid();
      if (!client || !u) return;
      try {
        const data = await snapshot();
        const raw = JSON.stringify(data);
        if (raw.length > cacheLimit) return;
        const parts = Math.ceil(raw.length / CHUNK);
        for (let i = 0; i < parts; i += 1) await storage.setItem(`${cacheKey(u)}:${i}`, raw.slice(i * CHUNK, (i + 1) * CHUNK));
        await storage.setItem(cacheKey(u), String(parts));
        saved = { uid: u, data };
      } catch { /* storage full: keep the last saved copy */ }
    }, 5000);
  }

  async function fromCache(op: any) {
    if (!scratch || scratch.version !== version || saved.uid !== uid()) {
      const { typePolicies, possibleTypes } = client.cache.config || {};
      const cache = new client.cache.constructor({ typePolicies, possibleTypes });
      cache.restore(await snapshot());
      scratch = { version, cache };
    }
    const { cache } = scratch;
    // A keyArgs list is stored whole from row 0, so a later page is cut from a saved list instead of read whole again.
    const laterPage = opDef(op.query).selectionSet.selections.some((f: any) => {
      if (f.kind !== 'Field' || !(Number(flat(argsOf(f, op.variables)).offset) > 0)) return false;
      const k = cache.policies?.getStoreFieldName?.({ typename: 'Query', fieldName: f.name.value, field: f, variables: op.variables });
      return typeof k === 'string' && k.startsWith(`${f.name.value}:`) && !k.includes('"offset"');
    });
    let data: any = null;
    if (!laterPage) {
      try {
        data = cache.readQuery({ query: op.query, variables: op.variables });
      } catch { /* not saved with these arguments */ }
    }
    return data ? { data } : fromSavedList(op, cache.extract());
  }

  // Offline read with other arguments: the broadest saved list of the field, filtered here like the server.
  function fromSavedList(op: any, snap: any) {
    const root = snap.ROOT_QUERY || {};
    const byId = indexById(snap);
    const data: any = {};
    for (const f of opDef(op.query).selectionSet.selections) {
      if (f.kind !== 'Field') return null;
      const name = f.name.value;
      const want = flat(argsOf(f, op.variables));
      // Filters applied to the rows here: a name search, or a field the query selects.
      const selected = new Set((f.selectionSet?.selections || []).map((s: any) => s.name?.value));
      const appliedHere = (a: string) => a === 'name_contains' || a === 'search' || selected.has(a);
      let best: string | null = null;
      let have: Record<string, any> = {};
      let rank: number[] = [];
      for (const k of Object.keys(root)) {
        // Apollo keys a field with keyArgs as name:{...}, otherwise as name({...}).
        if (k !== name && !k.startsWith(`${name}(`) && !k.startsWith(`${name}:`)) continue;
        let h: Record<string, any> = {};
        try { h = k === name ? {} : flat(JSON.parse(k.slice(name.length + 1).replace(/\)$/, ''))); } catch { continue; }
        // A page that does not start at row 0, or a list narrower than the request, cannot answer it.
        if (Number(h.offset) > 0) continue;
        if (Object.keys(h).some((a) => !PAGING.has(a) && h[a] != null && String(h[a]) !== String(want[a] ?? ''))) continue;
        // Best list: has the filters that cannot be applied here, then holds every row, then the most filters.
        const missing = Object.keys(want).filter((a) => !PAGING.has(a) && want[a] != null && h[a] == null && !appliedHere(a)).length;
        const count = Array.isArray(root[k]) ? root[k].length : 0;
        const whole = !Number(h.limit) || count < Number(h.limit) ? 1 : 0;
        const filters = Object.keys(h).filter((a) => !PAGING.has(a) && h[a] != null).length;
        const score = [-missing, whole, whole ? 0 : count, filters];
        if (!best || better(score, rank)) { best = k; have = h; rank = score; }
      }
      // A by-id read (detail screen) is answered from the record any saved list holds.
      if (!best && typeof want.id === 'string' && byId.has(want.id)) {
        data[keyOf(f)] = fill(f.selectionSet, byId.get(want.id), snap, byId);
        continue;
      }
      if (!best) return null;
      const v = root[best];
      if (!Array.isArray(v)) {
        data[keyOf(f)] = v && typeof v === 'object' ? fill(f.selectionSet, v.__ref ? snap[v.__ref] : v, snap, byId) : v ?? null;
        continue;
      }
      let rows = v.map((x: any) => (x && typeof x === 'object' ? fill(f.selectionSet, x.__ref ? snap[x.__ref] : x, snap, byId) : x));
      for (const [a, val] of Object.entries(want)) {
        if (PAGING.has(a) || val == null || have[a] != null) continue;
        if (a === 'name_contains' || a === 'search') {
          // The server matches name_contains on the name only; search spans several fields, so the whole row.
          const t = String(val).toLowerCase();
          const text = (r: any) => (a === 'name_contains' && typeof r?.name === 'string' ? r.name : JSON.stringify(r));
          rows = rows.filter((r: any) => text(r).toLowerCase().includes(t));
          continue;
        }
        rows = rows.filter((r: any) => r?.[a] === undefined || String(r[a]?.id ?? r[a]) === String(val));
      }
      // Same order as the server's instockfirst: stock totalled over the variants, 0 or less goes last, each group in saved order.
      if (want.instockfirst) {
        const outOfStock = (r: any) => {
          const vs = (r?.productvariants || []).filter((v: any) => typeof v?.currentstock === 'number');
          return vs.length && vs.reduce((t: number, v: any) => t + v.currentstock, 0) <= 0 ? 1 : 0;
        };
        rows = rows.map((r: any, i: number) => ({ r, i, o: outOfStock(r) })).sort((x: any, y: any) => x.o - y.o || x.i - y.i).map((x: any) => x.r);
      }
      const offset = Number(want.offset) || 0;
      const limit = Number(want.limit) || 0;
      data[keyOf(f)] = limit > 0 ? rows.slice(offset, offset + limit) : rows.slice(offset);
    }
    return { data };
  }

  // Saved data into the live cache at start, so screens show it at once and refresh from the server.
  async function restore() {
    const u = uid();
    if (!client || !u || restoredFor === u) return;
    restoredFor = u;
    try {
      client.cache.restore(await snapshot());
      client.cache.broadcastWatches?.();
    } catch { /* screens load from the server as before */ }
  }

  // Fills the cache with what this user's screens read, so they work offline from the first visit.
  async function warm() {
    if (!client || !uid() || flushing) return;
    for (const o of warmOps) {
      try {
        await client.query({ query: o.query, variables: o.variables, fetchPolicy: 'network-only' });
      } catch (e: any) {
        if (isNetworkError(e?.networkError ?? e)) return;
      }
    }
  }

  // Pending create as the document the server would return.
  const pendingDoc = (item: Item) => ({
    ...item.variables.input,
    __typename: CREATES[item.name],
    id: `${TEMP}${item.id}`,
    billnumber: PENDING_NUMBER,
    paymentcode: PENDING_NUMBER,
    claimnumber: PENDING_NUMBER,
    accountcode: PENDING_NUMBER,
    transactioncode: PENDING_NUMBER,
    status: item.variables.input?.status ?? PENDING_STATUS[CREATES[item.name]] ?? true,
    cancelStatus: false,
    createdAt: item.at,
    updatedAt: item.at,
  });

  // Adds pending creates to list results and answers by-id reads of a pending document.
  function overlay(op: any, result: any) {
    if (!result?.data) return result;
    const entities = entitiesNow();
    const byId = indexById(entities);
    const pending = mine().filter((i) => CREATES[i.name]);
    const data = { ...result.data };
    for (const f of opDef(op.query).selectionSet.selections) {
      if (f.kind !== 'Field') continue;
      const key = keyOf(f);
      const create = LISTS[f.name.value];
      if (create && Array.isArray(data[key])) {
        const vars = op.variables || {};
        const rows = pending
          .filter((i) => i.name === create)
          .filter((i) => Object.entries(vars).every(([k, v]) => v == null || typeof v === 'object' || !(k in i.variables.input) || String(i.variables.input[k]) === String(v)))
          .map((i) => fill(f.selectionSet, pendingDoc(i), entities, byId));
        // Old pending rows (saved in the cache) are replaced by the current queue.
        data[key] = [...rows, ...data[key].filter((r: any) => !String(r?.id || '').startsWith(TEMP))];
      }
      // Punch state follows the last unsynced punch, so the screen never offers the same punch twice.
      const punch = f.name.value === 'getOpenPunch' ? mine().filter((i) => i.name === 'punch').pop() : null;
      if (punch) {
        const p = punch.variables.input || {};
        data[key] = p.type === 'out' ? null : fill(f.selectionSet, { __typename: 'AttendancePunch', id: `${TEMP}${punch.id}`, ...p }, entities, byId);
      }
    }
    return { ...result, data };
  }

  // A punch-state read with no saved copy can still be answered from the queue.
  const onlyOpenPunch = (op: any) =>
    mine().some((i) => i.name === 'punch') && opDef(op.query).selectionSet.selections.every((f: any) => f.name?.value === 'getOpenPunch');

  function answerTemp(op: any) {
    const entities = entitiesNow();
    const byId = indexById(entities);
    const docs = new Map(mine().filter((i) => CREATES[i.name]).map((i) => [`${TEMP}${i.id}`, pendingDoc(i)]));
    const data: any = {};
    for (const f of opDef(op.query).selectionSet.selections) {
      if (f.kind !== 'Field') continue;
      const id = Object.values(op.variables || {}).find((v) => typeof v === 'string' && docs.has(v)) as string | undefined;
      data[keyOf(f)] = id && f.selectionSet ? fill(f.selectionSet, docs.get(id), entities, byId) : null;
    }
    return { data };
  }

  // Lists are read again through the link, so they show (or stop showing) pending rows.
  const dropLists = () => {
    for (const fieldName of Object.keys(LISTS)) client.cache.evict({ id: 'ROOT_QUERY', fieldName });
    client.cache.gc();
  };

  async function enqueue(op: any, offlineNow: boolean) {
    const field = rootField(op.query);
    // A punch saved without network is flagged so the admin sees its time came from the phone.
    const variables = op.operationName === 'punch' && op.variables?.input ? { ...op.variables, input: { ...op.variables.input, offline: true } } : op.variables;
    const item: Item = { id: op.variables?.input?.clientRequestId || newId(), uid: uid(), name: op.operationName, query: print(op.query), variables, at: new Date().toISOString() };
    await loaded;
    queue.push(item);
    await saveQueue();
    if (CREATES[item.name]) dropLists();
    set({ ...(offlineNow ? { online: false } : {}), ...(SILENT.has(item.name) ? {} : { message: 'Saved on this device. It will sync when the connection is back.' }) });
    if (!field.selectionSet) return { data: { [keyOf(field)]: true } };
    const src = CREATES[item.name] ? pendingDoc(item) : { ...op.variables?.input, ...op.variables };
    const entities = entitiesNow();
    return { data: { [keyOf(field)]: fill(field.selectionSet, src, entities, indexById(entities)) } };
  }

  // Edit or delete of a document that has not synced yet changes the queued create instead.
  async function changePending(op: any) {
    await loaded;
    const field = rootField(op.query);
    const temp = String(op.variables?.id || '');
    const item = mine().find((i) => CREATES[i.name] && `${TEMP}${i.id}` === temp);
    if (!item || !(/^Delete/.test(op.operationName) || op.variables?.input)) return enqueue(op, !state.online);
    if (/^Delete/.test(op.operationName)) queue = queue.filter((i) => i !== item);
    else item.variables = { ...item.variables, input: { ...op.variables.input, clientRequestId: item.id } };
    await saveQueue();
    dropLists();
    set({});
    if (!field.selectionSet) return { data: { [keyOf(field)]: true } };
    const entities = entitiesNow();
    return { data: { [keyOf(field)]: fill(field.selectionSet, pendingDoc(item), entities, indexById(entities)) } };
  }

  async function flush() {
    if (flushing || !client) return;
    flushing = true;
    let synced = 0;
    let shown = 0;
    try {
      await loaded;
      for (const id of mine().map((i) => i.id)) {
        const item = queue.find((i) => i.id === id);
        if (!item) continue;
        try {
          if (JSON.stringify(item.variables).includes(`"${UPLOAD_PREFIX}`)) {
            if (!upload) break;
            item.variables = await withUploads(item.variables, upload);
            await saveQueue();
          }
          const res = await client.mutate({ mutation: parse(item.query), variables: item.variables, context: { offlineReplay: true } });
          queue = queue.filter((i) => i.id !== id);
          synced += 1;
          if (!SILENT.has(item.name)) shown += 1;
          // Later entries that point at this offline document get its server id.
          const savedId = (Object.values(res?.data || {})[0] as any)?.id;
          if (CREATES[item.name] && savedId) queue = queue.map((i) => ({ ...i, variables: swapId(i.variables, `${TEMP}${item.id}`, String(savedId)) }));
        } catch (e: any) {
          if (isNetworkError(e?.networkError ?? e)) break;
          queue = queue.filter((i) => i.id !== id);
          set({ message: `An offline entry could not be saved: ${e?.message || 'unknown error'}` });
        }
        await saveQueue();
      }
    } finally {
      flushing = false;
    }
    if (synced) {
      dropLists();
      set({ online: true, ...(shown ? { message: `${shown} offline ${shown === 1 ? 'entry' : 'entries'} synced.` } : {}) });
      Promise.resolve(client.refetchQueries({ include: 'active' })).catch(() => undefined);
    } else set({});
  }

  const link = new ApolloLink((op: any, forward: any) => {
    const kind = opDef(op.query)?.operation;
    const replay = op.getContext?.().offlineReplay;
    const name = op.operationName;
    if (kind === 'mutation' && CREATES[name] && op.variables?.input && !op.variables.input.clientRequestId) {
      op.variables = { ...op.variables, input: { ...op.variables.input, clientRequestId: newId() } };
    }
    return new Observable((observer: any) => {
      let done = false;
      let sub: any = null;
      let timer: any = null;
      const answer = (p: Promise<any>, e?: any) => {
        done = true;
        clearTimeout(timer);
        p.then((r) => {
          if (!r) return observer.error(e);
          observer.next(r);
          observer.complete();
        }, () => observer.error(e));
      };
      // A document that exists only on this device never goes to the server.
      if (!replay && hasTemp(op.variables)) {
        answer(Promise.resolve().then(() => (kind === 'query' ? answerTemp(op) : op.variables?.id?.startsWith?.(TEMP) ? changePending(op) : enqueue(op, !state.online))));
        return () => undefined;
      }
      if (!replay && kind === 'mutation' && CREATES[name]) {
        // No answer in time: keep it on the device; the request id makes a late save harmless.
        timer = setTimeout(() => {
          if (done) return;
          sub?.unsubscribe();
          answer(enqueue(op, false));
        }, CREATE_TIMEOUT_MS);
      }
      sub = forward(op).subscribe({
        next: (r: any) => {
          if (done) return;
          clearTimeout(timer);
          if (!state.online) set({ online: true });
          if (kind === 'query') saveSoon();
          if (queue.length && !replay) flush();
          observer.next(kind === 'query' && !replay ? overlay(op, r) : r);
        },
        error: (e: any) => {
          if (done) return;
          clearTimeout(timer);
          if (replay || !isNetworkError(e)) return observer.error(e);
          if (state.online) set({ online: false });
          const local = kind === 'query' ? fromCache(op).then((r) => (r ? overlay(op, r) : onlyOpenPunch(op) ? overlay(op, { data: {} }) : null)) : kind === 'mutation' && QUEUED.has(name) ? enqueue(op, true) : Promise.resolve(null);
          answer(local, e);
        },
        complete: () => { if (!done) observer.complete(); },
      });
      return () => { clearTimeout(timer); sub?.unsubscribe(); };
    });
  });

  return {
    link,
    flush,
    // Device network signal (browser online/offline events), so the status changes without a request.
    setOnline(online: boolean) {
      if (online !== state.online) set({ online });
      if (online) flush();
    },
    attach(c: any) {
      client = c;
      setInterval(() => { if (mine().length) flush(); }, RETRY_MS);
      loaded.then(flush);
    },
    restore,
    // Queries to keep on the device for the signed-in user; refreshed every 15 minutes while online.
    warmup(ops: Array<{ query: any; variables?: any }>) {
      warmOps = ops;
      clearInterval(warmTimer);
      warmTimer = setInterval(warm, WARM_MS);
      restore().then(warm);
    },
    getState: () => state,
    subscribe(l: () => void) {
      listeners.add(l);
      return () => { listeners.delete(l); };
    },
  };
}
