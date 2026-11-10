// Apollo link: a pass-through while offline billing is off; when on, billing writes go local first and reads fall back to localdb.
import { ApolloLink, Observable, gql, type FetchResult, type NextLink, type Operation } from "@apollo/client";
import { print, type DocumentNode, type FieldNode } from "graphql";
import {
  DOC_TYPES,
  NUMBER_FIELD,
  isOrderType,
  OP_SPECS,
  collectOfflineIds,
  docId,
  findQueuedCreate,
  inDateRange,
  isMasterType,
  isOfflineId,
  liveCreates,
  newestFirst,
  numberSource,
  pageRows,
  parseDeviceNumber,
  planChange,
  replaceIds,
  type DocType,
  type OpKind,
  type OpSpec,
  type OutboxItem,
  type Plan,
  type PushOutcome,
} from "./core";
import { mainOperation, rootField, shapeBySelection, withExpectedUpdatedAt } from "./gql";
import {
  applyPlan,
  discardItem,
  getOfflineClient,
  isSending,
  loadIdMap,
  loadItems,
  newRequestId,
  offlineStore,
  pushNow,
  refreshOutbox,
  setCreateNumber,
  syncNow,
  waitUntilNotSending,
} from "./outbox";
import { getDeviceCode, nextDeviceNumber, noteUsedNumber } from "./device";
import { buildRichDoc, withQueued } from "./docs";
import { localDoc, localDocs, localReady } from "./localdb";
import { isOfflineEnabled } from "./settings";
import { currentUserKey } from "./userkey";

// By-id queries answered from the outbox for documents not synced yet.
const BY_ID_FIELDS = new Set([
  "getSalesInvoiceById",
  "getSalesOrderById",
  "getSalesReturnById",
  "getPaymentById",
  "getPurchaseInvoiceById",
  "getPurchaseOrderById",
  "getPurchaseReturnById",
  "getStockAdjustmentById",
  "getTransferStockById",
  "getDeliveryChallanById",
  "getQuotationById",
  "getWorkOrderById",
  "getProductionEntryById",
  "getJobCardById",
]);

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
      complete: () => resolve(last ?? { data: null }),
    });
  });
}

// ---------- Local reads ----------

type Kind = "list" | "page" | "byId" | "one";
type LocalSpec = { c: string; kind: Kind; typename: string; page?: string };

const doc = (c: string, typename: string, list: string, page: string, byId: string): Record<string, LocalSpec> => ({
  [list]: { c, kind: "list", typename },
  [page]: { c, kind: "page", typename, page: `${typename}Page` },
  [byId]: { c, kind: "byId", typename },
});
const list = (c: string, typename: string): LocalSpec => ({ c, kind: "list", typename });

// Root query fields answered from localdb without network.
const LOCAL_QUERIES: Record<string, LocalSpec> = {
  ...doc("salesinvoice", "SalesInvoice", "getSalesInvoices", "getSalesInvoicesPage", "getSalesInvoiceById"),
  ...doc("salesorder", "SalesOrder", "getSalesOrders", "getSalesOrdersPage", "getSalesOrderById"),
  ...doc("salesreturn", "SalesReturn", "getSalesReturns", "getSalesReturnsPage", "getSalesReturnById"),
  ...doc("payment", "Payment", "getPayments", "getPaymentsPage", "getPaymentById"),
  ...doc("purchaseinvoice", "PurchaseInvoice", "getPurchaseInvoices", "getPurchaseInvoicesPage", "getPurchaseInvoiceById"),
  ...doc("purchaseorder", "PurchaseOrder", "getPurchaseOrders", "getPurchaseOrdersPage", "getPurchaseOrderById"),
  ...doc("purchasereturn", "PurchaseReturn", "getPurchaseReturns", "getPurchaseReturnsPage", "getPurchaseReturnById"),
  ...doc("stockadjustment", "StockAdjustment", "getStockAdjustments", "getStockAdjustmentsPage", "getStockAdjustmentById"),
  ...doc("transferstock", "TransferStock", "getTransferStocks", "getTransferStocksPage", "getTransferStockById"),
  ...doc("deliverychallan", "DeliveryChallan", "getDeliveryChallans", "getDeliveryChallansPage", "getDeliveryChallanById"),
  ...doc("expensenote", "ExpenseNote", "getExpenseNotes", "getExpenseNotesPage", "getExpenseNoteById"),
  ...doc("transaction", "Transaction", "getTransactions", "getTransactionsPage", "getTransactionById"),
  getProductServicesPage: { c: "product", kind: "page", typename: "ProductService", page: "ProductServicePage" },
  getAccountsPage: { c: "account", kind: "page", typename: "Account", page: "AccountPage" },
  getAccountLedgersPage: { c: "ledger", kind: "page", typename: "AccountLedger", page: "AccountLedgerPage" },
  getUnitsPage: { c: "unit", kind: "page", typename: "Unit", page: "UnitPage" },
  getBrandsPage: { c: "brand", kind: "page", typename: "Brand", page: "BrandPage" },
  getModelsPage: { c: "model", kind: "page", typename: "Model", page: "ModelPage" },
  getSizesPage: { c: "size", kind: "page", typename: "Size", page: "SizePage" },
  getProductGroupsPage: { c: "productgroup", kind: "page", typename: "ProductGroup", page: "ProductGroupPage" },
  getProductServiceById: { c: "product", kind: "byId", typename: "ProductService" },
  getServicesPage: { c: "product", kind: "page", typename: "ProductService", page: "ProductServicePage" },
  getServiceById: { c: "product", kind: "byId", typename: "ProductService" },
  getAccountById: { c: "account", kind: "byId", typename: "Account" },
  getAccountLedgerById: { c: "ledger", kind: "byId", typename: "AccountLedger" },
  getUnitById: { c: "unit", kind: "byId", typename: "Unit" },
  getCategoryById: { c: "category", kind: "byId", typename: "Category" },
  getSubCategoryById: { c: "subcategory", kind: "byId", typename: "SubCategory" },
  getBrandById: { c: "brand", kind: "byId", typename: "Brand" },
  getModelById: { c: "model", kind: "byId", typename: "Model" },
  getSizeById: { c: "size", kind: "byId", typename: "Size" },
  getProductGroupById: { c: "productgroup", kind: "byId", typename: "ProductGroup" },
  getProductServices: list("product", "ProductService"),
  getAccounts: list("account", "Account"),
  getAccountLedgers: list("ledger", "AccountLedger"),
  getUnits: list("unit", "Unit"),
  getCategories: list("category", "Category"),
  getSubCategories: list("subcategory", "SubCategory"),
  getBrands: list("brand", "Brand"),
  getModels: list("model", "Model"),
  getSizes: list("size", "Size"),
  getProductGroups: list("productgroup", "ProductGroup"),
  getBranches: list("branch", "Branch"),
  getStaffAccounts: list("staff", "StaffAccount"),
  getPriceLists: list("pricelist", "PriceList"),
  getPriceAssignments: list("priceassignment", "PriceAssignment"),
  getChargeRules: list("chargerule", "ChargeRule"),
  getChargeRuleById: { c: "chargerule", kind: "byId", typename: "ChargeRule" },
  getPriceListsPage: { c: "pricelist", kind: "page", typename: "PriceList", page: "PriceListPage" },
  getAccountGroups: list("accountgroup", "AccountGroup"),
  getAccountGroupsPage: { c: "accountgroup", kind: "page", typename: "AccountGroup", page: "AccountGroupPage" },
  getAccountGroupById: { c: "accountgroup", kind: "byId", typename: "AccountGroup" },
  getChannels: list("channel", "Channel"),
  getChannelById: { c: "channel", kind: "byId", typename: "Channel" },
  ...doc("salesroute", "SalesRoute", "getSalesRoutes", "getSalesRoutesPage", "getSalesRouteById"),
  ...doc("quotation", "Quotation", "getQuotations", "getQuotationsPage", "getQuotationById"),
  ...doc("bom", "Bom", "getBoms", "getBomsPage", "getBomById"),
  ...doc("workorder", "WorkOrder", "getWorkOrders", "getWorkOrdersPage", "getWorkOrderById"),
  ...doc("production", "ProductionEntry", "getProductionEntries", "getProductionEntriesPage", "getProductionEntryById"),
  ...doc("appointment", "Appointment", "getAppointments", "getAppointmentsPage", "getAppointmentById"),
  ...doc("jobcard", "JobCard", "getJobCards", "getJobCardsPage", "getJobCardById"),
  ...doc("contract", "Contract", "getContracts", "getContractsPage", "getContractById"),
  ...doc("membership", "Membership", "getMemberships", "getMembershipsPage", "getMembershipById"),
  getMembershipPlans: list("membershipplan", "MembershipPlan"),
  getMembershipPlanById: { c: "membershipplan", kind: "byId", typename: "MembershipPlan" },
  ...doc("lead", "Lead", "getLeads", "getLeadsPage", "getLeadById"),
  ...doc("followup", "Followup", "getFollowups", "getFollowupsPage", "getFollowupById"),
  getHolidays: list("holiday", "Holiday"),
  getHolidayById: { c: "holiday", kind: "byId", typename: "Holiday" },
  getLeaveTypes: list("leavetype", "LeaveType"),
  getLeaveTypeById: { c: "leavetype", kind: "byId", typename: "LeaveType" },
  getPriceListById: { c: "pricelist", kind: "byId", typename: "PriceList" },
  getAdminSettings: { c: "adminsettings", kind: "one", typename: "AdminSettings" },
};

export const isLocalQuery = (doc: DocumentNode) => !!LOCAL_QUERIES[rootField(doc)?.name.value ?? ""];

const idOf = (v: any): string => (!v ? "" : typeof v === "string" ? v : String(v.id ?? v._id ?? ""));

// Same scoping the screens send: branch, party and category; soft-deleted documents never show.
// Filter fields a master list compares by value (party/vendor type, branch, group, category, channel).
const MASTER_FILTER_KEYS = ["type", "branchid", "accountgroupid", "category", "categoryid", "channel", "leadid", "staffid", "partyacc"];
const same = (a: any, b: any) => idOf(a).toLowerCase() === String(b).toLowerCase();

function matches(d: any, vars: any, isDoc: boolean, master = false): boolean {
  const f = vars?.filter || {};
  if (!inDateRange(d, f)) return false;
  if (master) {
    if (typeof f.status !== "boolean" && d?.status === false) return false;
    for (const k of MASTER_FILTER_KEYS) if (f[k] && d?.[k] !== undefined && d[k] !== null && !same(d[k], f[k])) return false;
  }
  if (typeof f.isservice === "boolean" && !!d?.isservice !== f.isservice) return false;
  if (isDoc && d?.status === false) return false;
  if (typeof f.status === "boolean" && d?.status !== undefined && d.status !== f.status) return false;
  for (const k of ["branchid", "partyacc", "partyid", "leadid"]) {
    // A document saved with no branch belongs to every branch.
    if (k === "branchid" && !d?.[k]) continue;
    if (isDoc && f[k] && d?.[k] !== undefined && idOf(d[k]) !== String(f[k])) return false;
  }
  // Transfer lists take the branch as a top-level argument.
  if (isDoc && vars?.frombranchid && d?.frombranchid !== undefined && idOf(d.frombranchid) !== String(vars.frombranchid)) return false;
  const cat = vars?.categoryId;
  const dcat = d?.categoryid ?? d?.categoryId;
  if (cat && dcat !== undefined && idOf(dcat) !== String(cat)) return false;
  return true;
}

// Collections a bare id on an offline master can point at.
const REF_COLLECTIONS = ["bom", "membershipplan", "unit", "category", "subcategory", "brand", "model", "size", "productgroup", "ledger", "account", "branch", "staff", "product", "lead"];
function refById(id: string): any {
  for (const c of REF_COLLECTIONS) {
    const d = localDoc(c, id);
    if (d) return d;
  }
  const create = isOfflineId(id) ? findQueuedCreate(offlineStore.getSnapshot().items, id) : null;
  return create ? buildRichDoc(create) : null;
}

const shapeRow = (sel: any, d: any, typename: string, ref?: (id: string) => any) => ({ ...shapeBySelection(sel, d, "null", ref), __typename: d?.__typename || typename });

function localResult(field: FieldNode, spec: LocalSpec, vars: any): any {
  const all = localDocs(spec.c);
  if (!all) return null;
  const key = field.alias?.value ?? field.name.value;
  const isDoc = (DOC_TYPES as string[]).includes(spec.c);
  const master = isMasterType(spec.c);
  const queued = isDoc || master;
  const source = offlineStore.getSnapshot().items;
  const rows = (creates: boolean) => {
    const own = queued ? withQueued(spec.c as DocType, all, source, creates) : all;
    return own.filter((d) => matches(d, vars, isDoc, master));
  };
  const ref = master ? refById : undefined;
  const shape = (sel: any, d: any, typename: string) => shapeRow(sel, d, typename, ref);
  if (spec.kind === "one") return all[0] ? { [key]: shape(field.selectionSet, all[0], spec.typename) } : null;
  if (spec.kind === "byId") {
    const id = String(vars?.id ?? "");
    const d = queued ? withQueued(spec.c as DocType, all, source, true).find((x) => docId(x) === id) : localDoc(spec.c, id);
    return d ? { [key]: shape(field.selectionSet, d, spec.typename) } : null;
  }
  if (spec.kind === "page") {
    // Online the list screens add queued new documents to page 1 themselves.
    let sorted = newestFirst(rows(!isOnline()));
    if ((spec.c === "salesinvoice" || spec.c === "purchaseinvoice") && !vars?.filter?.includeCancelled) sorted = sorted.filter((d) => d.cancelStatus !== "cancelled");
    const { items, total } = pageRows(sorted, vars || {});
    const sel = field.selectionSet?.selections.find((s: any) => s.kind === "Field" && s.name.value === "items") as FieldNode | undefined;
    return { [key]: { __typename: spec.page, items: items.map((d) => shape(sel?.selectionSet, d, spec.typename)), total } };
  }
  let out = isDoc ? newestFirst(rows(true)).reverse() : rows(true);
  const limit = Number(vars?.limit) || 0;
  if (limit > 0) out = out.slice(Number(vars?.offset) || 0, (Number(vars?.offset) || 0) + limit);
  return { [key]: out.map((d) => shape(field.selectionSet, d, spec.typename)) };
}

function readFromCache(operation: Operation): any {
  try {
    return getOfflineClient()?.cache.readQuery({ query: operation.query, variables: operation.variables }) ?? null;
  } catch {
    return null;
  }
}

// Without network: localdb for registered queries, else whatever this session already loaded.
async function answerLocally(operation: Operation): Promise<any> {
  await Promise.all([localReady(), refreshOutbox()]);
  const field = rootField(operation.query);
  const spec = field ? LOCAL_QUERIES[field.name.value] : undefined;
  return (field && spec ? localResult(field, spec, operation.variables) : null) ?? readFromCache(operation);
}

function cancelledOffline(items: OutboxItem[], offlineId: string): boolean {
  return !!liveCreates(items, ["pending", "failed", "review"]).find(
    (c) => c.item.clientRequestId && `offline-${c.item.clientRequestId}` === offlineId && c.cancelled
  );
}

function handleQuery(operation: Operation, forward: NextLink): Observable<FetchResult> {
  return new Observable<FetchResult>((observer) => {
    let closed = false;
    let sub: { unsubscribe: () => void } | null = null;
    const done = (r: FetchResult) => {
      if (closed) return;
      observer.next(r);
      observer.complete();
    };
    const local = (original: unknown) =>
      answerLocally(operation).then(
        (data) => (closed ? undefined : data ? done({ data }) : observer.error(original)),
        () => !closed && observer.error(original)
      );
    const run = async () => {
      if (collectOfflineIds(operation.variables).size) {
        // A synced temp id is swapped for the real one; an unsynced by-id read is answered from the outbox.
        const map = await loadIdMap();
        const field = rootField(operation.query);
        const id = operation.variables?.id;
        if (field && BY_ID_FIELDS.has(field.name.value) && isOfflineId(id) && !map[id]) {
          const items = await loadItems();
          const create = findQueuedCreate(items, id);
          const key = field.alias?.value ?? field.name.value;
          const rich = create ? buildRichDoc(create, { cancelled: cancelledOffline(items, id) }) : null;
          return done({ data: { [key]: rich ? shapeBySelection(field.selectionSet, rich, "null") : null } });
        }
        operation.variables = replaceIds(operation.variables, map);
      }
      if (closed) return;
      if (!isOnline()) return void local(new Error("No internet connection"));
      sub = forward(operation).subscribe({
        next: (r) => observer.next(r),
        error: (e) => (isNoResponse(e) ? void local(e) : observer.error(e)),
        complete: () => observer.complete(),
      });
    };
    run().catch((e) => !closed && observer.error(e));
    return () => {
      closed = true;
      sub?.unsubscribe();
    };
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

// Document typename to its collection (doc types are named after their collections).
const COLLECTION_OF_TYPE: Record<string, string> = Object.fromEntries(Object.values(OP_SPECS).map((s) => [s.typename, s.docType]));

// Field of a document from the Apollo cache, else from pulled records.
function knownField(typename: string, id: string, field: string): any {
  try {
    const data: any = getOfflineClient()?.cache.extract() || {};
    const v = data[`${typename}:${id}`]?.[field];
    if (v != null) return v;
  } catch {
    // Fall back to records.
  }
  return localDoc(COLLECTION_OF_TYPE[typename] || "", id)?.[field] ?? null;
}

function cachedUpdatedAt(typename: string, id: string): string | null {
  try {
    const r: any = getOfflineClient()?.cache.readFragment({ id: `${typename}:${id}`, fragment: stampFragment(typename) });
    if (typeof r?.updatedAt === "string" && r.updatedAt) return r.updatedAt;
  } catch {
    // Fall back to records.
  }
  const v = knownField(typename, id, "updatedAt");
  return typeof v === "string" && v ? v : null;
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
  // Set when the item is pushed at once, so a background sync leaves it alone.
  sending?: boolean;
}): OutboxItem {
  const input = p.variables?.input || {};
  const label = p.spec.docType === "payment" ? (String(input.type || "").toLowerCase() === "receipt" ? "Receipt" : "Payment") : p.spec.label;
  const amount = typeof input.totalamount === "number" ? input.totalamount : typeof input.amount === "number" ? input.amount : null;
  const date = input.billdate ?? input.returndate ?? input.paymentdate ?? input.adjustmentdate ?? input.transferdate;
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
    sendingSince: p.sending ? Date.now() : null,
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

// A device number for a create: one typed from this device's series, else the next one; null without a code.
async function deviceNumber(spec: OpSpec, given: unknown): Promise<string | null> {
  const code = getDeviceCode();
  if (code && parseDeviceNumber(spec.docType, given)?.code === code) {
    await noteUsedNumber(spec.docType, given).catch(() => {});
    return given as string;
  }
  return nextDeviceNumber(spec.docType).catch(() => null);
}

// Server rejected the change within the wait: forget it and show the server's error as today.
async function rejected(item: OutboxItem, error: any): Promise<FetchResult> {
  await discardItem(item.id).catch(() => {});
  const errors = error?.graphQLErrors;
  if (Array.isArray(errors) && errors.length) return { data: null, errors };
  throw error;
}

const syntheticCreate = (field: FieldNode, item: OutboxItem): FetchResult => ({
  data: { [resultKey(field)]: shapeBySelection(field.selectionSet, buildRichDoc(item), "null") },
});

// Local first: queue the create; online it is sent at once and keeps the server's number if answered within 3 s.
async function createLocalFirst(operation: Operation, field: FieldNode, spec: OpSpec, variables: Record<string, any>, crid: string): Promise<FetchResult> {
  const nf = NUMBER_FIELD[spec.docType];
  const input = { ...variables.input };
  const items = await loadItems().catch(() => [] as OutboxItem[]);
  const existing = items.find((i) => i.id === crid);
  // A create that points at an unsynced document waits in the queue behind it.
  const unresolved = collectOfflineIds(variables).size > 0;
  const push = isOnline() && !unresolved && !existing;
  let number: string | null = existing?.number ?? null;
  if (nf && !push && !number) number = await deviceNumber(spec, input[nf]);
  // No device code yet: the server numbers it on sync.
  if (nf && number) input[nf] = number;
  else if (nf && !push) delete input[nf];
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
    reason: push ? null : unresolved ? "Waiting for an earlier document to sync" : "Saved while offline",
    sending: push,
  });
  await applyPlan({ put: [item], remove: [], outcome: "queued" });
  if (!push) {
    void syncNow();
    return syntheticCreate(field, item);
  }
  const { out, late } = pushNow(item);
  const outcome = await out;
  const source = numberSource(true, outcome.kind);
  if (source === "server") return { data: { [resultKey(field)]: (outcome as Extract<PushOutcome, { kind: "answered" }>).data } };
  if (source === "error") return rejected(item, (outcome as Extract<PushOutcome, { kind: "rejected" }>).error);
  // No answer in time: a master stays queued as it is; a bill takes the device series.
  if (!nf) return syntheticCreate(field, item);
  const numbered = await setCreateNumber(item.id, nf, await deviceNumber(spec, input[nf]));
  if (numbered) return syntheticCreate(field, numbered);
  // Synced while the number was being set: use the server's answer.
  const final = await late;
  if (final.kind === "answered") return { data: { [resultKey(field)]: final.data } };
  return syntheticCreate(field, item);
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
  } else if (kind === "action") {
    src = { __typename: spec.typename, id: target, ...(spec.patch?.(variables) || {}) };
  } else if (kind === "cancel") {
    src = { __typename: spec.typename, id: target, cancelStatus: "cancelled", cancelReason: variables.reason ?? "", cancelledAt: now };
    if (isOrderType(spec.docType)) src.orderStatus = "cancelled";
  } else {
    src = { __typename: spec.typename, id: target, cancelStatus: "open", cancelReason: null, cancelledAt: null };
    if (isOrderType(spec.docType)) src.orderStatus = "pending";
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

  const push = online && !unresolved && !queuedForTarget;
  const nf = NUMBER_FIELD[spec.docType];
  const docNumber = nf ? knownField(spec.typename, target, nf) : null;
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
    reason: push ? null : reason,
    sending: push,
  });
  const plan = planChange(items, base);
  await applyPlan(plan);
  if (push && plan.put[0]) {
    const outcome = await pushNow(plan.put[0]).out;
    if (outcome.kind === "answered") {
      writeStamp(spec.typename, target, outcome.data?.updatedAt);
      return { data: { [resultKey(field)]: outcome.data } };
    }
    if (outcome.kind === "rejected") return rejected(base, outcome.error);
  } else {
    void syncNow();
  }
  return syntheticChange(field, spec, spec.kind, target, variables, plan, items, base);
}

async function handleMutation(operation: Operation, forward: NextLink, field: FieldNode, spec: OpSpec): Promise<FetchResult> {
  const original = operation.variables || {};
  if (spec.kind !== "create") return handleChange(operation, forward, field, spec, original);
  if (!original.input || typeof original.input !== "object" || !getOfflineClient()) return sendOnce(operation, forward);
  const variables = replaceIds(original, await loadIdMap());
  const crid: string = variables.input.clientRequestId || newRequestId();
  return createLocalFirst(operation, field, spec, { ...variables, input: { ...variables.input, clientRequestId: crid } }, crid);
}

export const offlineLink = new ApolloLink((operation, forward) => {
  const ctx = operation.getContext();
  if (ctx.offlineSync) {
    // Replay from the outbox or a pull: send under the branch it was saved with.
    if (typeof ctx.offlineBranch === "string") {
      operation.setContext(({ headers = {} }: any) => ({ headers: { ...headers, "x-branch-id": ctx.offlineBranch } }));
    }
    return forward(operation);
  }
  // Offline billing off: untouched.
  if (!isOfflineEnabled()) return forward(operation);
  const op = mainOperation(operation.query);
  if (op?.operation === "query") return handleQuery(operation, forward);
  const field = op?.operation === "mutation" ? rootField(operation.query) : null;
  const spec = field ? OP_SPECS[field.name.value] : undefined;
  if (!field || !spec) return forward(operation);
  return fromPromise(() => handleMutation(operation, forward, field, spec));
});
