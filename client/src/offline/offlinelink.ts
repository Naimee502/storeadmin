// Apollo link (offline mode only): queues billing changes without network, adds version checks, serves cached reads.
import { ApolloLink, Observable, gql, type FetchResult, type NextLink, type Operation } from "@apollo/client";
import { print, type DocumentNode, type FieldNode } from "graphql";
import {
  NUMBER_FIELD,
  OP_SPECS,
  collectOfflineIds,
  findQueuedCreate,
  isOfflineId,
  liveCreates,
  parseDeviceNumber,
  planChange,
  replaceIds,
  type OpKind,
  type OpSpec,
  type OutboxItem,
  type Plan,
} from "./core";
import { mainOperation, rootField, shapeBySelection, withExpectedUpdatedAt } from "./gql";
import { applyPlan, getOfflineClient, isSending, loadIdMap, loadItems, newRequestId, syncNow, waitUntilNotSending } from "./outbox";
import { getDeviceCode, nextDeviceNumber, noteUsedNumber } from "./device";
import { buildRichDoc } from "./docs";
import { scheduleCacheSave } from "./persist";
import { currentUserKey } from "./userkey";
import { GET_SALES_INVOICES_LIST } from "../graphql/queries/salesinvoice";
import { GET_SALES_ORDERS_LIST } from "../graphql/queries/salesorder";
import { GET_SALES_RETURNS_LIST } from "../graphql/queries/salesreturn";
import { GET_PAYMENTS_LIST } from "../graphql/queries/payments";

export { OFFLINE_ID_PREFIX } from "./core";

// By-id queries answered from the outbox for documents not synced yet.
const BY_ID_FIELDS = new Set(["getSalesInvoiceById", "getSalesOrderById", "getSalesReturnById", "getPaymentById"]);

// Network failure with no HTTP response at all (not a GraphQL or HTTP error).
function isNoResponse(err: any): boolean {
  if (!err) return false;
  if (err.name === "AbortError") return false;
  return typeof err.statusCode !== "number" && !err.response && !err.result;
}

const isOnline = () => typeof navigator === "undefined" || navigator.onLine !== false;

function fromPromise(run: () => Promise<FetchResult>): Observable<FetchResult> {
  return new Observable<FetchResult>((observer) => {
    let closed = false;
    run().then(
      (r) => {
        if (closed) return;
        observer.next(r);
        observer.complete();
      },
      (e) => !closed && observer.error(e)
    );
    return () => {
      closed = true;
    };
  });
}

// Sends the operation and resolves with its (single) result.
function sendOnce(operation: Operation, forward: NextLink): Promise<FetchResult> {
  return new Promise<FetchResult>((resolve, reject) => {
    let last: FetchResult | null = null;
    forward(operation).subscribe({
      next: (r) => {
        last = r;
      },
      error: reject,
      complete: () => {
        scheduleCacheSave();
        resolve(last ?? { data: null });
      },
    });
  });
}

function passthrough(operation: Operation, forward: NextLink): Observable<FetchResult> {
  return new Observable<FetchResult>((observer) => {
    const sub = forward(operation).subscribe({
      next: (r) => observer.next(r),
      error: (e) => observer.error(e),
      complete: () => {
        scheduleCacheSave();
        observer.complete();
      },
    });
    return () => sub.unsubscribe();
  });
}

function readFromCache(operation: Operation): any {
  try {
    return getOfflineClient()?.cache.readQuery({ query: operation.query, variables: operation.variables }) ?? null;
  } catch {
    return null;
  }
}

// Paged lists that can be served offline from the cached full list (newest first).
const LOCAL_PAGES: Record<string, { list: DocumentNode; field: string; typename: string }> = {
  getSalesInvoicesPage: { list: GET_SALES_INVOICES_LIST, field: "getSalesInvoices", typename: "SalesInvoicePage" },
  getSalesOrdersPage: { list: GET_SALES_ORDERS_LIST, field: "getSalesOrders", typename: "SalesOrderPage" },
  getSalesReturnsPage: { list: GET_SALES_RETURNS_LIST, field: "getSalesReturns", typename: "SalesReturnPage" },
  getPaymentsPage: { list: GET_PAYMENTS_LIST, field: "getPayments", typename: "PaymentPage" },
};

// A page that was never loaded online: slice it out of the cached full list.
function localPage(operation: Operation): any {
  const root = rootField(operation.query);
  const spec = root ? LOCAL_PAGES[root.name.value] : undefined;
  if (!root || !spec) return null;
  const v: any = operation.variables || {};
  const { includeCancelled: _ignored, ...filter } = v.filter || {};
  let rows: any[] | undefined;
  try {
    rows = (getOfflineClient()?.cache.readQuery({ query: spec.list, variables: { filter } }) as any)?.[spec.field];
  } catch {
    rows = undefined;
  }
  if (!Array.isArray(rows)) return null;
  const terms = [String(v.search || ""), ...((v.columnFilters || []) as any[]).map((f) => String(f?.value || ""))]
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const matched = [...rows].reverse().filter((row) => {
    if (!terms.length) return true;
    const text = JSON.stringify(row).toLowerCase();
    return terms.every((t) => text.includes(t));
  });
  const size = Math.min(Math.max(Number(v.pageSize) || 10, 1), 200);
  const start = (Math.max(Number(v.page) || 1, 1) - 1) * size;
  const itemsSel = root.selectionSet?.selections.find((s: any) => s.kind === "Field" && s.name.value === "items") as FieldNode | undefined;
  const items = matched.slice(start, start + size).map((row) => shapeBySelection(itemsSel?.selectionSet, row));
  const key = root.alias?.value ?? root.name.value;
  return { [key]: { __typename: spec.typename, items, total: matched.length } };
}

// Queries: without network, answer from the cache when it has the full result.
function queryWithFallback(operation: Operation, forward: NextLink, fallback: boolean): Observable<FetchResult> {
  if (!fallback) return passthrough(operation, forward);
  return new Observable<FetchResult>((observer) => {
    let sub: { unsubscribe: () => void } | null = null;
    const fromCache = (original: unknown) => {
      const data = readFromCache(operation) ?? localPage(operation);
      if (data) {
        observer.next({ data });
        observer.complete();
      } else observer.error(original);
    };
    if (!isOnline()) {
      fromCache(new Error("No internet connection"));
      return;
    }
    sub = forward(operation).subscribe({
      next: (r) => observer.next(r),
      error: (e) => (isNoResponse(e) ? fromCache(e) : observer.error(e)),
      complete: () => {
        scheduleCacheSave();
        observer.complete();
      },
    });
    return () => sub?.unsubscribe();
  });
}

function cancelledOffline(items: OutboxItem[], offlineId: string): boolean {
  return !!liveCreates(items, ["pending", "failed", "review"]).find(
    (c) => c.item.clientRequestId && `offline-${c.item.clientRequestId}` === offlineId && c.cancelled
  );
}

function handleQuery(operation: Operation, forward: NextLink): Observable<FetchResult> {
  const ctx = operation.getContext();
  const fallback = !ctx.offlineNoFallback;
  const temps = collectOfflineIds(operation.variables);
  if (!temps.size) return queryWithFallback(operation, forward, fallback);
  // A synced temp id is swapped for the real one; an unsynced by-id read is answered from the outbox.
  return fromPromise(async () => {
    const map = await loadIdMap();
    const field = rootField(operation.query);
    const id = operation.variables?.id;
    if (field && BY_ID_FIELDS.has(field.name.value) && isOfflineId(id) && !map[id]) {
      const items = await loadItems();
      const create = findQueuedCreate(items, id);
      const key = field.alias?.value ?? field.name.value;
      if (!create) return { data: { [key]: null } };
      const rich = buildRichDoc(create, { cancelled: cancelledOffline(items, id) });
      return { data: { [key]: shapeBySelection(field.selectionSet, rich, "null") } };
    }
    operation.variables = replaceIds(operation.variables, map);
    return new Promise<FetchResult>((resolve, reject) => {
      queryWithFallback(operation, forward, fallback).subscribe({ next: resolve, error: reject });
    });
  });
}

// ---------- Mutations ----------

const branchHeader = () => {
  try {
    return localStorage.getItem("branchid") || "";
  } catch {
    return "";
  }
};

const stampFragments = new Map<string, DocumentNode>();
const stampFragment = (typename: string) => {
  let f = stampFragments.get(typename);
  if (!f) {
    f = gql`fragment OfflineStamp${typename} on ${typename} { updatedAt }`;
    stampFragments.set(typename, f);
  }
  return f;
};

function cachedUpdatedAt(typename: string, id: string): string | null {
  try {
    const r: any = getOfflineClient()?.cache.readFragment({ id: `${typename}:${id}`, fragment: stampFragment(typename) });
    return typeof r?.updatedAt === "string" && r.updatedAt ? r.updatedAt : null;
  } catch {
    return null;
  }
}

// Keeps the cached version current after cancel/reopen, whose results do not select it.
function writeStamp(typename: string, id: string, updatedAt: unknown) {
  if (typeof updatedAt !== "string" || !updatedAt) return;
  try {
    getOfflineClient()?.cache.writeFragment({
      id: `${typename}:${id}`,
      fragment: stampFragment(typename),
      data: { __typename: typename, updatedAt },
    });
  } catch {
    // Read again on the next fetch.
  }
}

function cachedField(typename: string, id: string, field: string): any {
  try {
    const data: any = getOfflineClient()?.cache.extract() || {};
    return data[`${typename}:${id}`]?.[field] ?? null;
  } catch {
    return null;
  }
}

function makeItem(p: {
  spec: OpSpec;
  operation: Operation;
  query: DocumentNode;
  variables: Record<string, any>;
  kind: OpKind;
  id: string;
  targetId: string | null;
  clientRequestId: string | null;
  number: string | null;
  expectedUpdatedAt: string | null;
  reason: string | null;
}): OutboxItem {
  const input = p.variables?.input || {};
  const label = p.spec.docType === "payment" ? (String(input.type || "").toLowerCase() === "receipt" ? "Receipt" : "Payment") : p.spec.label;
  const amount = typeof input.totalamount === "number" ? input.totalamount : typeof input.amount === "number" ? input.amount : null;
  const date = input.billdate ?? input.returndate ?? input.paymentdate;
  const item: OutboxItem = {
    v: 2,
    id: p.id,
    kind: p.kind,
    docType: p.spec.docType,
    field: p.spec.field,
    operationName: p.operation.operationName,
    query: print(p.query),
    variables: p.variables,
    targetId: p.targetId,
    clientRequestId: p.clientRequestId,
    number: p.number,
    expectedUpdatedAt: p.expectedUpdatedAt,
    createdAt: Date.now(),
    attempts: 0,
    lastError: p.reason,
    status: "pending",
    conflict: null,
    sendingSince: null,
    userKey: currentUserKey(),
    branchHeader: branchHeader(),
    typename: p.spec.typename,
    label,
    partyName: null,
    amount,
    billdate: typeof date === "string" ? date : null,
  };
  try {
    const rich = buildRichDoc(item, { id: p.targetId ?? "x" });
    item.partyName = rich?.partyacc?.name ?? rich?.partyid?.name ?? null;
  } catch {
    // Name is optional.
  }
  return item;
}

const resultKey = (field: FieldNode) => field.alias?.value ?? field.name.value;

async function queueCreate(
  operation: Operation,
  field: FieldNode,
  spec: OpSpec,
  variables: Record<string, any>,
  crid: string,
  reason: string
): Promise<FetchResult> {
  const nf = NUMBER_FIELD[spec.docType];
  const input = { ...variables.input };
  const items = await loadItems().catch(() => [] as OutboxItem[]);
  const existing = items.find((i) => i.id === crid);
  let number: string | null = existing?.number ?? null;
  if (!number) {
    const given = input[nf];
    const code = getDeviceCode();
    if (code && parseDeviceNumber(spec.docType, given)?.code === code) {
      number = given;
      await noteUsedNumber(spec.docType, given).catch(() => {});
    } else {
      number = await nextDeviceNumber(spec.docType).catch(() => null);
    }
  }
  // No device code yet: the server numbers it on sync.
  if (number) input[nf] = number;
  else delete input[nf];
  const item = makeItem({
    spec,
    operation,
    query: operation.query,
    variables: { ...variables, input },
    kind: "create",
    id: crid,
    targetId: null,
    clientRequestId: crid,
    number,
    expectedUpdatedAt: null,
    reason,
  });
  await applyPlan({ put: [item], remove: [], outcome: "queued" });
  void syncNow();
  const rich = buildRichDoc(item);
  return { data: { [resultKey(field)]: shapeBySelection(field.selectionSet, rich, "null") } };
}

// Only the fields the edit sent, so a cache write never touches the rest of the document.
function pick(src: any, keys: string[]) {
  const out: any = { __typename: src.__typename, id: src.id };
  for (const k of keys) if (k in src && src[k] !== undefined) out[k] = src[k];
  return out;
}

function syntheticChange(
  field: FieldNode,
  spec: OpSpec,
  kind: OpKind,
  target: string,
  variables: Record<string, any>,
  plan: Plan,
  items: OutboxItem[],
  item: OutboxItem
): FetchResult {
  const key = resultKey(field);
  if (kind === "delete") return { data: { [key]: true } };
  const now = new Date().toISOString();
  let src: any;
  if (kind === "edit") {
    if (isOfflineId(target) && plan.create) {
      src = buildRichDoc(plan.create, { cancelled: cancelledOffline(items, target) });
    } else {
      const input = variables.input || {};
      const rich = buildRichDoc(item, { id: target, input });
      src = pick(rich, Object.keys(input).filter((k) => k !== "clientRequestId"));
    }
  } else if (kind === "cancel") {
    src = { __typename: spec.typename, id: target, cancelStatus: "cancelled", cancelReason: variables.reason ?? "", cancelledAt: now };
    if (spec.docType === "salesorder") src.orderStatus = "cancelled";
  } else {
    src = { __typename: spec.typename, id: target, cancelStatus: "open", cancelReason: null, cancelledAt: null };
    if (spec.docType === "salesorder") src.orderStatus = "pending";
  }
  const mode = isOfflineId(target) && kind === "edit" ? "null" : "omit";
  return { data: { [key]: shapeBySelection(field.selectionSet, src, mode) } };
}

async function handleChange(
  operation: Operation,
  forward: NextLink,
  field: FieldNode,
  spec: OpSpec,
  original: Record<string, any>
): Promise<FetchResult> {
  let map = await loadIdMap();
  let variables = replaceIds(original, map);
  let target: string | null = typeof variables.id === "string" ? variables.id : null;
  if (!target) {
    operation.variables = variables;
    return sendOnce(operation, forward);
  }

  if (isOfflineId(target)) {
    // A sync may be sending this create right now: wait, then treat it as a server doc.
    const create = findQueuedCreate(await loadItems().catch(() => [] as OutboxItem[]), target);
    if (create && isSending(create)) {
      const w = await waitUntilNotSending(create.id);
      if (w === "busy") throw new Error("This document is syncing right now. Please try again in a moment.");
      map = await loadIdMap();
      variables = replaceIds(original, map);
      target = variables.id;
    }
  }

  const reason = isOnline() ? "Waiting for earlier changes to sync" : "Saved while offline";

  if (isOfflineId(target)) {
    const items = await loadItems();
    const item = makeItem({
      spec,
      operation,
      query: withExpectedUpdatedAt(operation.query, { arg: spec.conflictCheck, selectUpdatedAt: true }),
      variables,
      kind: spec.kind,
      id: newRequestId(),
      targetId: target,
      clientRequestId: null,
      number: null,
      expectedUpdatedAt: null,
      reason,
    });
    const plan = planChange(items, item);
    if (plan.outcome === "notfound") throw new Error("This document is no longer saved on this device.");
    await applyPlan(plan);
    if (plan.outcome === "dropped") {
      try {
        getOfflineClient()?.cache.evict({ id: `${spec.typename}:${target}` });
      } catch {
        // Gone on the next refresh.
      }
    }
    const after = await loadItems().catch(() => items);
    return syntheticChange(field, spec, spec.kind, target, variables, plan, after, item);
  }

  const online = isOnline();
  const unresolved = collectOfflineIds(variables).size > 0;

  if (!spec.conflictCheck) {
    if (!online) throw new Error("Connect to the internet to change this document.");
    operation.variables = variables;
    return sendOnce(operation, forward);
  }

  const expected = typeof variables.expectedUpdatedAt === "string" && variables.expectedUpdatedAt ? variables.expectedUpdatedAt : cachedUpdatedAt(spec.typename, target);
  // Storage trouble must not block an online save.
  const items = await loadItems().catch(() => [] as OutboxItem[]);
  const queuedForTarget = items.some((i) => i.kind !== "create" && i.targetId === target);

  if (online && !unresolved && !queuedForTarget) {
    operation.query = withExpectedUpdatedAt(operation.query, { arg: !!expected, selectUpdatedAt: true });
    operation.variables = expected ? { ...variables, expectedUpdatedAt: expected } : variables;
    try {
      const r = await sendOnce(operation, forward);
      writeStamp(spec.typename, target, (r.data as any)?.[resultKey(field)]?.updatedAt);
      return r;
    } catch (e) {
      if (!isNoResponse(e)) throw e;
    }
  }

  const docNumber = cachedField(spec.typename, target, NUMBER_FIELD[spec.docType]);
  const base = makeItem({
    spec,
    operation,
    query: withExpectedUpdatedAt(operation.query, { arg: true, selectUpdatedAt: true }),
    variables: expected ? { ...variables, expectedUpdatedAt: expected } : variables,
    kind: spec.kind,
    id: newRequestId(),
    targetId: target,
    clientRequestId: null,
    number: typeof docNumber === "string" ? docNumber : null,
    expectedUpdatedAt: expected,
    reason,
  });
  const plan = planChange(items, base);
  await applyPlan(plan);
  void syncNow();
  return syntheticChange(field, spec, spec.kind, target, variables, plan, items, base);
}

async function handleMutation(operation: Operation, forward: NextLink, field: FieldNode, spec: OpSpec): Promise<FetchResult> {
  const original = operation.variables || {};
  if (spec.kind !== "create") return handleChange(operation, forward, field, spec, original);

  const input0 = original.input;
  if (!input0 || typeof input0 !== "object") return sendOnce(operation, forward);
  const map = await loadIdMap();
  const variables = replaceIds(original, map);
  const crid: string = variables.input.clientRequestId || newRequestId();
  const withId = { ...variables, input: { ...variables.input, clientRequestId: crid } };
  // A create that points at an unsynced document waits in the queue behind it.
  const unresolved = collectOfflineIds(withId).size > 0;
  let reason = "Saved while offline";
  if (isOnline() && !unresolved) {
    operation.variables = withId;
    try {
      return await sendOnce(operation, forward);
    } catch (e: any) {
      if (!isNoResponse(e)) throw e;
      reason = e?.message || "Network error";
    }
  } else if (unresolved) {
    reason = "Waiting for an earlier document to sync";
  }
  return queueCreate(operation, field, spec, withId, crid, reason);
}

export const offlineLink = new ApolloLink((operation, forward) => {
  const ctx = operation.getContext();
  if (ctx.offlineSync) {
    // Replay from the outbox: send under the branch it was saved with.
    if (typeof ctx.offlineBranch === "string") {
      operation.setContext(({ headers = {} }: any) => ({ headers: { ...headers, "x-branch-id": ctx.offlineBranch } }));
    }
    return forward(operation);
  }
  const op = mainOperation(operation.query);
  if (op?.operation === "query") return handleQuery(operation, forward);
  const field = op?.operation === "mutation" ? rootField(operation.query) : null;
  const spec = field ? OP_SPECS[field.name.value] : undefined;
  if (!field || !spec) return passthrough(operation, forward);
  return fromPromise(() => handleMutation(operation, forward, field, spec));
});
