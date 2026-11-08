// Queued offline documents shaped like server rows, and server documents with pending local changes on top.
import type { DocumentNode } from "graphql";
import { GET_SALES_INVOICES_PAGE } from "../graphql/queries/salesinvoice";
import { GET_SALES_ORDERS_PAGE } from "../graphql/queries/salesorder";
import { GET_SALES_RETURNS_PAGE } from "../graphql/queries/salesreturn";
import { GET_PAYMENTS_PAGE } from "../graphql/queries/payments";
import { GET_PURCHASE_INVOICES_PAGE } from "../graphql/queries/purchaseinvoice";
import { GET_PURCHASE_ORDERS_PAGE } from "../graphql/queries/purchaseorder";
import { GET_PURCHASE_RETURNS_PAGE } from "../graphql/queries/purchasereturn";
import { GET_STOCK_ADJUSTMENTS_PAGE } from "../graphql/queries/stockadjustments";
import { GET_TRANSFER_STOCKS_PAGE } from "../graphql/queries/transferstock";
import { byAge, docId, isMasterType, isOrderType, liveCreates, offlineIdFor, type DocType, type OutboxItem, type OutboxStatus } from "./core";
import { selectionAt, shapeBySelection } from "./gql";
import { getOfflineClient, offlineStore } from "./outbox";
import { localDoc, localDocs } from "./localdb";

const PAGE: Partial<Record<DocType, DocumentNode>> = {
  salesinvoice: GET_SALES_INVOICES_PAGE,
  salesorder: GET_SALES_ORDERS_PAGE,
  salesreturn: GET_SALES_RETURNS_PAGE,
  payment: GET_PAYMENTS_PAGE,
  purchaseinvoice: GET_PURCHASE_INVOICES_PAGE,
  purchaseorder: GET_PURCHASE_ORDERS_PAGE,
  purchasereturn: GET_PURCHASE_RETURNS_PAGE,
  stockadjustment: GET_STOCK_ADJUSTMENTS_PAGE,
  transferstock: GET_TRANSFER_STOCKS_PAGE,
};

const LINE_TYPENAME: Partial<Record<DocType, string>> = {
  salesinvoice: "SalesInvoiceProductService",
  salesorder: "SalesOrderProductService",
  salesreturn: "SalesReturnProductService",
  payment: "",
  purchaseinvoice: "PurchaseInvoiceProductService",
  purchaseorder: "PurchaseOrderProductService",
  purchasereturn: "PurchaseReturnProductService",
  stockadjustment: "StockAdjustmentItem",
  transferstock: "TransferStockItem",
};

// Extra fields on every offline document.
export interface OfflineDocMeta {
  isOffline: true;
  offlineStatus: OutboxStatus;
  offlineItemId: string;
  offlineError: string | null;
}

type CacheData = Record<string, any>;

function cacheData(): CacheData {
  try {
    return (getOfflineClient()?.cache.extract() as CacheData) || {};
  } catch {
    return {};
  }
}

const idOf = (v: any): string => (!v ? "" : typeof v === "string" ? v : String(v.id ?? v._id ?? ""));

const COLLECTION_OF: Record<string, string> = {
  Account: "account",
  StaffAccount: "staff",
  ProductService: "product",
  Unit: "unit",
  AccountLedger: "ledger",
  Branch: "branch",
};

function localVariant(id: string): any {
  for (const p of localDocs("product") || []) {
    const v = (p?.productvariants || []).find((x: any) => idOf(x) === id);
    if (v) return v;
  }
  return null;
}

// Entity by id: pulled records first, then the Apollo cache (likely typenames first).
function entity(data: CacheData, id: string, types: string[]): any {
  if (!id) return null;
  for (const t of types) {
    const d = COLLECTION_OF[t] ? localDoc(COLLECTION_OF[t], id) : t === "ProductVariant" ? localVariant(id) : null;
    if (d) return d;
  }
  for (const t of types) if (data[`${t}:${id}`]) return data[`${t}:${id}`];
  const suffix = `:${id}`;
  for (const k of Object.keys(data)) if (k.endsWith(suffix) && k !== "ROOT_QUERY") return data[k];
  return null;
}

const str = (v: any) => (typeof v === "string" ? v : null);
const nameOf = (e: any): string | null =>
  str(e?.name) ?? str(e?.accountname) ?? str(e?.ledgername) ?? str(e?.unitname) ?? str(e?.channelName) ?? null;

// Reference object ({ id, name, … }) filled from the cache.
function ref(data: CacheData, raw: any, types: string[], typename: string): any {
  const id = idOf(raw);
  if (!id) return null;
  const e = entity(data, id, types) || {};
  const n = nameOf(e) ?? (typeof raw === "object" ? nameOf(raw) : null);
  return {
    __typename: typename,
    id,
    name: n,
    accountname: n,
    ledgername: n,
    unitname: n,
    mobile: str(e.mobile),
    address: str(e.address),
    city: str(e.city),
    state: str(e.state),
    gstnumber: str(e.gstnumber),
    imageurl: str(e.imageurl),
    latitude: typeof e.latitude === "number" ? e.latitude : null,
    longitude: typeof e.longitude === "number" ? e.longitude : null,
  };
}

const PARTY = ["Account", "SimpleRef", "PartyBalance"];
const STAFF = ["StaffAccount", "Staff", "SimpleRef"];
const PRODUCT = ["ProductService", "SimpleRef"];
const VARIANT = ["ProductVariant", "SimpleRef"];
const UNIT = ["Unit", "SimpleRef"];
const LEDGER = ["AccountLedger", "SimpleRef"];

function scalars(input: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(input || {})) {
    if (v === null || ["string", "number", "boolean"].includes(typeof v)) out[k] = v;
  }
  delete out.clientRequestId;
  return out;
}

// Full document for a queued create, built from its input and cached names.
export function buildRichDoc(
  item: OutboxItem,
  opts: { cancelled?: boolean; id?: string; data?: CacheData; input?: Record<string, any> } = {}
): any {
  const data = opts.data ?? cacheData();
  const input = opts.input ?? item.variables?.input ?? {};
  const id = opts.id ?? (item.clientRequestId ? offlineIdFor(item.clientRequestId) : item.targetId);
  const created = new Date(item.createdAt).toISOString();
  const cancelled = !!opts.cancelled;
  const meta: OfflineDocMeta = {
    isOffline: true,
    offlineStatus: item.status,
    offlineItemId: item.id,
    offlineError: item.lastError,
  };
  // A master is its input as sent; bare ids are filled in when the row is shaped.
  if (isMasterType(item.docType)) {
    return { ...input, __typename: item.typename, id, status: input.status ?? true, createdAt: created, updatedAt: created, ...meta };
  }
  if (item.docType === "payment") {
    return {
      ...scalars(input),
      __typename: "Payment",
      id,
      paymentcode: item.number ?? str(input.paymentcode),
      partyid: input.partyid ? { ...ref(data, input.partyid, PARTY, "Account") } : null,
      ledgerid: ref(data, input.ledgerid, LEDGER, "AccountLedger"),
      counterledgerid: input.counterledgerid ? ref(data, input.counterledgerid, LEDGER, "AccountLedger") : null,
      invoices: (input.invoices || []).map((l: any) => ({ __typename: "PaymentInvoice", allocatedat: null, ...l })),
      status: input.status ?? true,
      createdAt: created,
      updatedAt: created,
      ...meta,
    };
  }
  const lineType = LINE_TYPENAME[item.docType];
  const base = { ...scalars(input), __typename: item.typename, id, status: input.status ?? true, createdAt: created, updatedAt: created, ...meta };
  if (item.docType === "stockadjustment") {
    const branch = idOf(input.branchid);
    return {
      ...base,
      vouchernumber: item.number ?? str(input.vouchernumber),
      adminid: input.adminid ? { __typename: "StockAdjustmentAdminRef", id: idOf(input.adminid), name: null } : null,
      branchid: branch ? { __typename: "StockAdjustmentBranchRef", id: branch, branchname: str(entity(data, branch, ["Branch"])?.branchname) } : null,
      items: (input.items || []).map((l: any) => ({
        ...scalars(l),
        __typename: lineType,
        productid: { ...ref(data, l.productid, PRODUCT, "ProductService") },
        variantid: idOf(l.variantid) || null,
      })),
    };
  }
  if (item.docType === "transferstock") {
    return {
      ...base,
      vouchernumber: item.number ?? str(input.vouchernumber),
      frombranchid: idOf(input.frombranchid),
      tobranchid: idOf(input.tobranchid),
      items: (input.items || []).map((l: any) => ({ ...scalars(l), __typename: lineType })),
      admin: input.admin ? { __typename: "Admin", id: idOf(input.admin), name: null, email: null } : null,
    };
  }
  const productservice = (input.productservice || []).map((l: any) => ({
    ...scalars(l),
    __typename: lineType,
    productserviceid: ref(data, l.productserviceid, PRODUCT, "SimpleRef"),
    variantid: l.variantid ? ref(data, l.variantid, VARIANT, "SimpleRef") : null,
    salesunitid: l.salesunitid ? ref(data, l.salesunitid, UNIT, "SimpleRef") : null,
    purchaseunitid: l.purchaseunitid ? ref(data, l.purchaseunitid, UNIT, "SimpleRef") : null,
    salesaccountid: l.salesaccountid ? ref(data, l.salesaccountid, LEDGER, "SimpleRef") : null,
    purchaseaccountid: l.purchaseaccountid ? ref(data, l.purchaseaccountid, LEDGER, "SimpleRef") : null,
    serviceaccountid: l.serviceaccountid ? ref(data, l.serviceaccountid, LEDGER, "SimpleRef") : null,
  }));
  const othercharges = (input.othercharges || []).map((c: any) => ({
    ...scalars(c),
    __typename: "OtherCharge",
    ledgerid: ref(data, c.ledgerid, LEDGER, "SimpleRef"),
    ledgername: c.ledgername ?? nameOf(entity(data, idOf(c.ledgerid), LEDGER)),
  }));
  const doc: any = {
    ...scalars(input),
    __typename: item.typename,
    id,
    billnumber: item.number ?? str(input.billnumber),
    partyacc: ref(data, input.partyacc, PARTY, "SimpleRef"),
    salesmenid: input.salesmenid ? ref(data, input.salesmenid, STAFF, "SimpleRef") : null,
    purchasemenid: input.purchasemenid ? ref(data, input.purchasemenid, STAFF, "SimpleRef") : null,
    productservice,
    othercharges,
    isservice: !!input.isservice,
    autocreate: !!input.autocreate,
    status: input.status ?? true,
    cancelStatus: cancelled ? "cancelled" : "open",
    cancelReason: null,
    cancelledAt: null,
    cancelledByName: null,
    deliveryStatus: null,
    createdAt: created,
    updatedAt: created,
    ...meta,
  };
  if (isOrderType(item.docType)) {
    doc.orderStatus = cancelled ? "cancelled" : "pending";
    doc.isConverted = false;
    doc.invoicenumber = null;
  }
  if (item.docType === "salesinvoice" || item.docType === "purchaseinvoice") {
    doc.sourceorderno = null;
    doc.received = typeof input.received === "number" ? input.received : null;
  }
  if (item.docType === "salesreturn") doc.sourceOrderNumber = null;
  return doc;
}

const items = () => offlineStore.getSnapshot().items;

function withTypename(sel: any, src: any, typename: string) {
  const shaped = shapeBySelection(sel, src, "null");
  return { ...shaped, __typename: typename };
}

const metaOf = (d: any): OfflineDocMeta => ({
  isOffline: true,
  offlineStatus: d.offlineStatus,
  offlineItemId: d.offlineItemId,
  offlineError: d.offlineError,
});

// Unsynced documents of a type, newest first, shaped like page rows plus offline flags.
export function listOfflineDocs(type: DocType, source: OutboxItem[] = items()): any[] {
  const page = PAGE[type];
  if (!page) return [];
  const sel = selectionAt(page, ["items"]);
  const data = cacheData();
  return liveCreates(source, ["pending", "failed", "review"])
    .filter(({ item }) => item.docType === type)
    .reverse()
    .map(({ item, cancelled }) => {
      const rich = buildRichDoc(item, { cancelled, data });
      return { ...withTypename(sel, rich, item.typename), ...metaOf(rich) };
    });
}

// Queued changes to a server document, oldest first (for row badges).
export function queuedChangesFor(id: string, source: OutboxItem[] = items()): Array<Pick<OutboxItem, "id" | "kind" | "status" | "lastError">> {
  return source
    .filter((i) => i.kind !== "create" && i.targetId === id)
    .map((i) => ({ id: i.id, kind: i.kind, status: i.status, lastError: i.lastError }));
}

// A queued edit, cancel or re-open applied to a server document.
function applyOp(doc: any, op: OutboxItem): any {
  if (op.kind === "edit") {
    const input = op.variables?.input || {};
    const rich = buildRichDoc(op, { id: docId(doc), input });
    const patch: any = {};
    for (const k of Object.keys(input)) if (k !== "clientRequestId" && rich[k] !== undefined) patch[k] = rich[k];
    return { ...doc, ...patch };
  }
  const cancelled = op.kind === "cancel";
  if (!cancelled && op.kind !== "reopen") return doc;
  const out = { ...doc, cancelStatus: cancelled ? "cancelled" : "open" };
  if (isOrderType(op.docType)) out.orderStatus = cancelled ? "cancelled" : "pending";
  return out;
}

// Server documents with this device's pending changes applied; `creates` adds queued new ones.
export function withQueued(type: DocType, docs: any[], source: OutboxItem[] = items(), creates = true): any[] {
  const ops = new Map<string, OutboxItem[]>();
  for (const i of [...source].sort(byAge)) {
    if (i.kind === "create" || i.docType !== type || !i.targetId || (i.status !== "pending" && i.status !== "review")) continue;
    ops.set(i.targetId, [...(ops.get(i.targetId) || []), i]);
  }
  const out: any[] = [];
  for (const d of docs) {
    const list = ops.get(docId(d));
    if (!list) {
      out.push(d);
      continue;
    }
    if (list.some((o) => o.kind === "delete")) continue;
    out.push(list.reduce(applyOp, d));
  }
  if (!creates) return out;
  const data = cacheData();
  for (const { item, cancelled } of liveCreates(source, ["pending", "failed", "review"])) {
    if (item.docType === type) out.push(buildRichDoc(item, { cancelled, data }));
  }
  return out;
}
