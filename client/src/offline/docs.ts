// Queued offline documents shaped like the server's list rows and by-id results (for lists, print and WhatsApp).
import type { DocumentNode } from "graphql";
import { GET_SALES_INVOICE_BY_ID, GET_SALES_INVOICES_PAGE } from "../graphql/queries/salesinvoice";
import { GET_SALES_ORDER_BY_ID, GET_SALES_ORDERS_PAGE } from "../graphql/queries/salesorder";
import { GET_SALES_RETURN_BY_ID, GET_SALES_RETURNS_PAGE } from "../graphql/queries/salesreturn";
import { GET_PAYMENT_BY_ID, GET_PAYMENTS_PAGE } from "../graphql/queries/payments";
import { findQueuedCreate, isOfflineId, liveCreates, offlineIdFor, type DocType, type OutboxItem, type OutboxStatus } from "./core";
import { selectionAt, shapeBySelection } from "./gql";
import { getOfflineClient, offlineStore } from "./outbox";

const BY_ID: Record<DocType, DocumentNode> = {
  salesinvoice: GET_SALES_INVOICE_BY_ID,
  salesorder: GET_SALES_ORDER_BY_ID,
  salesreturn: GET_SALES_RETURN_BY_ID,
  payment: GET_PAYMENT_BY_ID,
};

const PAGE: Record<DocType, DocumentNode> = {
  salesinvoice: GET_SALES_INVOICES_PAGE,
  salesorder: GET_SALES_ORDERS_PAGE,
  salesreturn: GET_SALES_RETURNS_PAGE,
  payment: GET_PAYMENTS_PAGE,
};

const LINE_TYPENAME: Record<DocType, string> = {
  salesinvoice: "SalesInvoiceProductService",
  salesorder: "SalesOrderProductService",
  salesreturn: "SalesReturnProductService",
  payment: "",
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

// Cached entity by id, trying the likely typenames first.
function entity(data: CacheData, id: string, types: string[]): any {
  if (!id) return null;
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

/**
 * Full document (superset of the by-id fields) for a queued create, built from its
 * input plus cached party, product, unit and ledger names.
 */
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
  const productservice = (input.productservice || []).map((l: any) => ({
    ...scalars(l),
    __typename: lineType,
    productserviceid: ref(data, l.productserviceid, PRODUCT, "SimpleRef"),
    variantid: l.variantid ? ref(data, l.variantid, VARIANT, "SimpleRef") : null,
    salesunitid: l.salesunitid ? ref(data, l.salesunitid, UNIT, "SimpleRef") : null,
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
  if (item.docType === "salesorder") {
    doc.orderStatus = cancelled ? "cancelled" : "pending";
    doc.isConverted = false;
    doc.invoicenumber = null;
  }
  if (item.docType === "salesinvoice") {
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

/**
 * Queued (not yet synced) documents of a type, newest first, shaped like the
 * module's page query rows plus { isOffline, offlineStatus, offlineItemId, offlineError }.
 * Includes failed and review creates; deleted ones are already gone from the queue.
 */
export function listOfflineDocs(type: DocType, source: OutboxItem[] = items()): any[] {
  const sel = selectionAt(PAGE[type], ["items"]);
  const data = cacheData();
  return liveCreates(source, ["pending", "failed", "review"])
    .filter(({ item }) => item.docType === type)
    .reverse()
    .map(({ item, cancelled }) => {
      const rich = buildRichDoc(item, { cancelled, data });
      return { ...withTypename(sel, rich, item.typename), ...metaOf(rich) };
    });
}

/**
 * A queued document by its offline id, shaped like the module's by-id query result
 * (GET_SALES_INVOICE_BY_ID etc.) plus the offline meta fields; null when not queued.
 */
export function getOfflineDoc(id: string, source: OutboxItem[] = items()): any | null {
  if (!isOfflineId(id)) return null;
  const create = findQueuedCreate(source, id);
  if (!create) return null;
  const state = liveCreates(source, ["pending", "failed", "review"]).find((c) => c.item.id === create.id);
  const rich = buildRichDoc(create, { cancelled: !!state?.cancelled });
  return { ...withTypename(selectionAt(BY_ID[create.docType]), rich, create.typename), ...metaOf(rich) };
}

// Same as getOfflineDoc but every built field (a superset of the by-id query).
export function getOfflineDocFull(id: string, source: OutboxItem[] = items()): any | null {
  const create = isOfflineId(id) ? findQueuedCreate(source, id) : undefined;
  if (!create) return null;
  const state = liveCreates(source, ["pending", "failed", "review"]).find((c) => c.item.id === create.id);
  return buildRichDoc(create, { cancelled: !!state?.cancelled });
}

/**
 * Queued changes to a server document (oldest first), e.g. to mark a list row as
 * "edited offline", "cancel pending" or "delete pending", or "needs review".
 */
export function queuedChangesFor(id: string, source: OutboxItem[] = items()): Array<Pick<OutboxItem, "id" | "kind" | "status" | "lastError">> {
  return source
    .filter((i) => i.kind !== "create" && i.targetId === id)
    .map((i) => ({ id: i.id, kind: i.kind, status: i.status, lastError: i.lastError }));
}
