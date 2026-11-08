// Pure offline-billing logic (no browser or Apollo access) so it can be unit tested.

export type DocType =
  | "salesinvoice"
  | "salesorder"
  | "salesreturn"
  | "payment"
  | "purchaseinvoice"
  | "purchaseorder"
  | "purchasereturn"
  | "stockadjustment"
  | "transferstock"
  | MasterType;
// Masters and expenses (Phase 3): no device numbers; named after their localdb collections.
export type MasterType =
  | "product"
  | "account"
  | "ledger"
  | "unit"
  | "category"
  | "subcategory"
  | "brand"
  | "model"
  | "size"
  | "productgroup"
  | "expensenote"
  | "transaction";
export const MASTER_TYPES: MasterType[] = [
  "product", "account", "ledger", "unit", "category", "subcategory", "brand", "model", "size", "productgroup", "expensenote", "transaction",
];
export const isMasterType = (t: string): t is MasterType => (MASTER_TYPES as string[]).includes(t);
// "action": a status change (confirm, dispatch, deliver, assign) whose local effect is `patch`.
export type OpKind = "create" | "edit" | "cancel" | "reopen" | "delete" | "action";
export type OutboxStatus = "pending" | "failed" | "review";

export const DOC_TYPES: DocType[] = [
  "salesinvoice",
  "salesorder",
  "salesreturn",
  "payment",
  "purchaseinvoice",
  "purchaseorder",
  "purchasereturn",
  "stockadjustment",
  "transferstock",
];
export const OFFLINE_ID_PREFIX = "offline-";

export interface OpSpec {
  field: string;
  kind: OpKind;
  docType: DocType;
  typename: string;
  label: string;
  // False: the server has no expectedUpdatedAt for it, so it is only handled for offline docs.
  conflictCheck: boolean;
  // Fields an action sets on the document, from its variables.
  patch?: (vars: any) => Record<string, any>;
}

const spec = (field: string, kind: OpKind, docType: DocType, typename: string, label: string, conflictCheck = true): OpSpec => ({
  field,
  kind,
  docType,
  typename,
  label,
  conflictCheck,
});

const action = (field: string, docType: DocType, typename: string, label: string, patch: (vars: any) => Record<string, any>): OpSpec => ({
  ...spec(field, "action", docType, typename, label),
  patch,
});
const boy = (v: any) => ({ deliveryboyid: v?.deliveryboyid ?? null });

// Root mutation fields the engine handles, keyed by field name.
export const OP_SPECS: Record<string, OpSpec> = {
  addSalesInvoice: spec("addSalesInvoice", "create", "salesinvoice", "SalesInvoice", "Sales Invoice"),
  editSalesInvoice: spec("editSalesInvoice", "edit", "salesinvoice", "SalesInvoice", "Sales Invoice"),
  cancelSalesInvoice: spec("cancelSalesInvoice", "cancel", "salesinvoice", "SalesInvoice", "Sales Invoice"),
  reopenSalesInvoice: spec("reopenSalesInvoice", "reopen", "salesinvoice", "SalesInvoice", "Sales Invoice"),
  deleteSalesInvoice: spec("deleteSalesInvoice", "delete", "salesinvoice", "SalesInvoice", "Sales Invoice"),
  addSalesOrder: spec("addSalesOrder", "create", "salesorder", "SalesOrder", "Sales Order"),
  confirmSalesOrder: action("confirmSalesOrder", "salesorder", "SalesOrder", "Sales Order", () => ({ orderStatus: "confirmed" })),
  markSalesOrderDispatched: action("markSalesOrderDispatched", "salesorder", "SalesOrder", "Sales Order", (v) => ({ orderStatus: "dispatched", deliveryStatus: "dispatched", ...(v?.deliveryboyid ? boy(v) : {}) })),
  markSalesOrderDelivered: action("markSalesOrderDelivered", "salesorder", "SalesOrder", "Sales Order", () => ({ orderStatus: "delivered", deliveryStatus: "delivered" })),
  assignOrderDeliveryBoy: action("assignOrderDeliveryBoy", "salesorder", "SalesOrder", "Sales Order", boy),
  markSalesInvoiceDispatched: action("markSalesInvoiceDispatched", "salesinvoice", "SalesInvoice", "Sales Invoice", (v) => ({ deliveryStatus: "dispatched", ...(v?.deliveryboyid ? boy(v) : {}) })),
  markSalesInvoiceDelivered: action("markSalesInvoiceDelivered", "salesinvoice", "SalesInvoice", "Sales Invoice", () => ({ deliveryStatus: "delivered" })),
  assignInvoiceDeliveryBoy: action("assignInvoiceDeliveryBoy", "salesinvoice", "SalesInvoice", "Sales Invoice", boy),
  confirmPurchaseOrder: action("confirmPurchaseOrder", "purchaseorder", "PurchaseOrder", "Purchase Order", () => ({ orderStatus: "confirmed" })),
  markPurchaseOrderReceived: action("markPurchaseOrderReceived", "purchaseorder", "PurchaseOrder", "Purchase Order", () => ({ orderStatus: "received" })),
  editSalesOrder: spec("editSalesOrder", "edit", "salesorder", "SalesOrder", "Sales Order"),
  cancelSalesOrder: spec("cancelSalesOrder", "cancel", "salesorder", "SalesOrder", "Sales Order"),
  reopenSalesOrder: spec("reopenSalesOrder", "reopen", "salesorder", "SalesOrder", "Sales Order"),
  deleteSalesOrder: spec("deleteSalesOrder", "delete", "salesorder", "SalesOrder", "Sales Order"),
  addSalesReturn: spec("addSalesReturn", "create", "salesreturn", "SalesReturn", "Sales Return"),
  editSalesReturn: spec("editSalesReturn", "edit", "salesreturn", "SalesReturn", "Sales Return", false),
  deleteSalesReturn: spec("deleteSalesReturn", "delete", "salesreturn", "SalesReturn", "Sales Return", false),
  addPayment: spec("addPayment", "create", "payment", "Payment", "Payment"),
  editPayment: spec("editPayment", "edit", "payment", "Payment", "Payment"),
  deletePayment: spec("deletePayment", "delete", "payment", "Payment", "Payment"),
  addPurchaseInvoice: spec("addPurchaseInvoice", "create", "purchaseinvoice", "PurchaseInvoice", "Purchase Invoice"),
  editPurchaseInvoice: spec("editPurchaseInvoice", "edit", "purchaseinvoice", "PurchaseInvoice", "Purchase Invoice"),
  cancelPurchaseInvoice: spec("cancelPurchaseInvoice", "cancel", "purchaseinvoice", "PurchaseInvoice", "Purchase Invoice"),
  reopenPurchaseInvoice: spec("reopenPurchaseInvoice", "reopen", "purchaseinvoice", "PurchaseInvoice", "Purchase Invoice", false),
  deletePurchaseInvoice: spec("deletePurchaseInvoice", "delete", "purchaseinvoice", "PurchaseInvoice", "Purchase Invoice"),
  addPurchaseOrder: spec("addPurchaseOrder", "create", "purchaseorder", "PurchaseOrder", "Purchase Order"),
  editPurchaseOrder: spec("editPurchaseOrder", "edit", "purchaseorder", "PurchaseOrder", "Purchase Order"),
  cancelPurchaseOrder: spec("cancelPurchaseOrder", "cancel", "purchaseorder", "PurchaseOrder", "Purchase Order"),
  reopenPurchaseOrder: spec("reopenPurchaseOrder", "reopen", "purchaseorder", "PurchaseOrder", "Purchase Order", false),
  deletePurchaseOrder: spec("deletePurchaseOrder", "delete", "purchaseorder", "PurchaseOrder", "Purchase Order"),
  addPurchaseReturn: spec("addPurchaseReturn", "create", "purchasereturn", "PurchaseReturn", "Purchase Return"),
  editPurchaseReturn: spec("editPurchaseReturn", "edit", "purchasereturn", "PurchaseReturn", "Purchase Return"),
  deletePurchaseReturn: spec("deletePurchaseReturn", "delete", "purchasereturn", "PurchaseReturn", "Purchase Return"),
  createStockAdjustment: spec("createStockAdjustment", "create", "stockadjustment", "StockAdjustment", "Stock Adjustment"),
  updateStockAdjustment: spec("updateStockAdjustment", "edit", "stockadjustment", "StockAdjustment", "Stock Adjustment"),
  // Cancel reverses the stock and deactivates, same as delete.
  cancelStockAdjustment: spec("cancelStockAdjustment", "delete", "stockadjustment", "StockAdjustment", "Stock Adjustment"),
  deleteStockAdjustment: spec("deleteStockAdjustment", "delete", "stockadjustment", "StockAdjustment", "Stock Adjustment"),
  addTransferStock: spec("addTransferStock", "create", "transferstock", "TransferStock", "Transfer Stock"),
  editTransferStock: spec("editTransferStock", "edit", "transferstock", "TransferStock", "Transfer Stock"),
  deleteTransferStock: spec("deleteTransferStock", "delete", "transferstock", "TransferStock", "Transfer Stock"),
  addProductService: spec("addProductService", "create", "product", "ProductService", "Product"),
  updateProductService: spec("updateProductService", "edit", "product", "ProductService", "Product"),
  deleteProductService: spec("deleteProductService", "delete", "product", "ProductService", "Product"),
  addAccount: spec("addAccount", "create", "account", "Account", "Account"),
  editAccount: spec("editAccount", "edit", "account", "Account", "Account"),
  deleteAccount: spec("deleteAccount", "delete", "account", "Account", "Account"),
  addAccountLedger: spec("addAccountLedger", "create", "ledger", "AccountLedger", "Ledger"),
  editAccountLedger: spec("editAccountLedger", "edit", "ledger", "AccountLedger", "Ledger"),
  deleteAccountLedger: spec("deleteAccountLedger", "delete", "ledger", "AccountLedger", "Ledger"),
  addUnit: spec("addUnit", "create", "unit", "Unit", "Unit"),
  editUnit: spec("editUnit", "edit", "unit", "Unit", "Unit"),
  deleteUnit: spec("deleteUnit", "delete", "unit", "Unit", "Unit"),
  addCategory: spec("addCategory", "create", "category", "Category", "Category"),
  editCategory: spec("editCategory", "edit", "category", "Category", "Category"),
  deleteCategory: spec("deleteCategory", "delete", "category", "Category", "Category"),
  addSubCategory: spec("addSubCategory", "create", "subcategory", "SubCategory", "Sub Category"),
  editSubCategory: spec("editSubCategory", "edit", "subcategory", "SubCategory", "Sub Category"),
  deleteSubCategory: spec("deleteSubCategory", "delete", "subcategory", "SubCategory", "Sub Category"),
  addBrand: spec("addBrand", "create", "brand", "Brand", "Brand"),
  editBrand: spec("editBrand", "edit", "brand", "Brand", "Brand"),
  deleteBrand: spec("deleteBrand", "delete", "brand", "Brand", "Brand"),
  addModel: spec("addModel", "create", "model", "Model", "Model"),
  editModel: spec("editModel", "edit", "model", "Model", "Model"),
  deleteModel: spec("deleteModel", "delete", "model", "Model", "Model"),
  addSize: spec("addSize", "create", "size", "Size", "Size"),
  editSize: spec("editSize", "edit", "size", "Size", "Size"),
  deleteSize: spec("deleteSize", "delete", "size", "Size", "Size"),
  addProductGroup: spec("addProductGroup", "create", "productgroup", "ProductGroup", "Product Group"),
  editProductGroup: spec("editProductGroup", "edit", "productgroup", "ProductGroup", "Product Group"),
  deleteProductGroup: spec("deleteProductGroup", "delete", "productgroup", "ProductGroup", "Product Group"),
  addExpenseNote: spec("addExpenseNote", "create", "expensenote", "ExpenseNote", "Expense Note"),
  editExpenseNote: spec("editExpenseNote", "edit", "expensenote", "ExpenseNote", "Expense Note"),
  deleteExpenseNote: spec("deleteExpenseNote", "delete", "expensenote", "ExpenseNote", "Expense Note"),
  addTransaction: spec("addTransaction", "create", "transaction", "Transaction", "Transaction"),
  editTransaction: spec("editTransaction", "edit", "transaction", "Transaction", "Transaction"),
  deleteTransaction: spec("deleteTransaction", "delete", "transaction", "Transaction", "Transaction"),
};

// Old (v1) items only stored the operation name.
export const FIELD_BY_OPERATION: Record<string, string> = {
  AddSalesInvoice: "addSalesInvoice",
  AddSalesOrder: "addSalesOrder",
};

export const NUMBER_FIELD: Partial<Record<DocType, "billnumber" | "paymentcode" | "vouchernumber">> = {
  salesinvoice: "billnumber",
  salesorder: "billnumber",
  salesreturn: "billnumber",
  payment: "paymentcode",
  purchaseinvoice: "billnumber",
  purchaseorder: "billnumber",
  purchasereturn: "billnumber",
  stockadjustment: "vouchernumber",
  transferstock: "vouchernumber",
};

// Their edit input type is partial, so an edit of a queued create keeps the create's other fields.
const PARTIAL_EDIT: DocType[] = ["stockadjustment"];

export const isOrderType = (t: DocType) => t === "salesorder" || t === "purchaseorder";

// Same patterns the server accepts (server/src/utils/offlinesync.ts).
const DEVICE_NUMBER_RX: Partial<Record<DocType, RegExp>> = {
  salesinvoice: /^([A-Z]{1,3})\/(\d{6})$/,
  salesorder: /^([A-Z]{1,3})\/(\d{6})$/,
  salesreturn: /^CN-([A-Z]{1,3})\/(\d{6})$/,
  payment: /^#PAY-([A-Z]{1,3})\/(\d{6})$/,
  purchaseinvoice: /^([A-Z]{1,3})\/(\d{6})$/,
  purchaseorder: /^([A-Z]{1,3})\/(\d{6})$/,
  purchasereturn: /^DN-([A-Z]{1,3})\/(\d{6})$/,
  stockadjustment: /^SA-([A-Z]{1,3})\/(\d{6})$/,
  transferstock: /^TR-([A-Z]{1,3})\/(\d{6})$/,
};

const PREFIX: Partial<Record<DocType, string>> = {
  salesinvoice: "",
  salesorder: "",
  salesreturn: "CN-",
  payment: "#PAY-",
  purchaseinvoice: "",
  purchaseorder: "",
  purchasereturn: "DN-",
  stockadjustment: "SA-",
  transferstock: "TR-",
};

export const MAX_SEQ = 999999;

// A/000123, CN-A/000012, #PAY-A/000012, DN-, SA-, TR-; null when the sequence does not fit 6 digits.
export function formatDeviceNumber(type: DocType, code: string, seq: number): string | null {
  if (PREFIX[type] === undefined || !/^[A-Z]{1,3}$/.test(code) || !Number.isInteger(seq) || seq < 1 || seq > MAX_SEQ) return null;
  return `${PREFIX[type]}${code}/${String(seq).padStart(6, "0")}`;
}

export function parseDeviceNumber(type: DocType, value: unknown): { code: string; seq: number } | null {
  if (typeof value !== "string") return null;
  const m = DEVICE_NUMBER_RX[type]?.exec(value);
  return m ? { code: m[1], seq: parseInt(m[2], 10) } : null;
}

export type SeqMap = Partial<Record<DocType, number>>;

// Highest of each counter; used to raise local counters from the server's lastSeq.
export function maxSeq(a: SeqMap | null | undefined, b: unknown): SeqMap {
  const out: SeqMap = { ...(a || {}) };
  const src: any = b && typeof b === "object" ? b : {};
  for (const t of DOC_TYPES) {
    const n = Number(src[t]);
    if (Number.isInteger(n) && n > (out[t] || 0)) out[t] = n;
  }
  return out;
}

// Increment-and-return on a counter map (the caller persists the returned map).
export function bumpSeq(seqs: SeqMap | null | undefined, type: DocType): { seqs: SeqMap; seq: number } {
  const next = (seqs?.[type] || 0) + 1;
  return { seqs: { ...(seqs || {}), [type]: next }, seq: next };
}

export const isOfflineId = (v: unknown): v is string => typeof v === "string" && v.startsWith(OFFLINE_ID_PREFIX);
export const offlineIdFor = (clientRequestId: string) => `${OFFLINE_ID_PREFIX}${clientRequestId}`;

// Every offline-… string anywhere in a value.
export function collectOfflineIds(value: unknown, out: Set<string> = new Set()): Set<string> {
  if (isOfflineId(value)) out.add(value);
  else if (Array.isArray(value)) value.forEach((v) => collectOfflineIds(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => collectOfflineIds(v, out));
  return out;
}

// Copy of a value with mapped temp ids replaced by real ids.
export function replaceIds<T>(value: T, map: Record<string, string>): T {
  if (typeof value === "string") return ((map as any)[value] ?? value) as any;
  if (Array.isArray(value)) return value.map((v) => replaceIds(v, map)) as any;
  if (value && typeof value === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(value)) out[k] = replaceIds(v, map);
    return out;
  }
  return value;
}

export interface OutboxItem {
  v: 2;
  id: string;
  kind: OpKind;
  docType: DocType;
  field: string;
  operationName: string;
  query: string;
  variables: Record<string, any>;
  // Edit/cancel/reopen/delete: the document id (server id or offline-…).
  targetId: string | null;
  // Creates only.
  clientRequestId: string | null;
  // Device number of a create; for other ops the document's number when cached (display only).
  number: string | null;
  // Version the change was based on; null sends without the check.
  expectedUpdatedAt: string | null;
  createdAt: number;
  attempts: number;
  lastError: string | null;
  status: OutboxStatus;
  // CONFLICT: the server's current document.
  conflict: any;
  // Set while a sync is sending it, so a merge waits instead of racing.
  sendingSince: number | null;
  userKey: string | null;
  branchHeader: string;
  typename: string;
  label: string;
  partyName: string | null;
  amount: number | null;
  billdate: string | null;
}

// Upgrades a v1 item (create only) to the v2 shape.
export function normalizeItem(raw: any): OutboxItem | null {
  if (!raw || typeof raw !== "object" || typeof raw.id !== "string") return null;
  if (raw.v === 2) return raw as OutboxItem;
  const field = FIELD_BY_OPERATION[raw.operationName] || "";
  const s = OP_SPECS[field];
  if (!s) return null;
  return {
    v: 2,
    id: raw.id,
    kind: "create",
    docType: s.docType,
    field,
    operationName: raw.operationName,
    query: raw.query,
    variables: raw.variables || {},
    targetId: null,
    clientRequestId: raw.variables?.input?.clientRequestId || raw.id,
    number: null,
    expectedUpdatedAt: null,
    createdAt: raw.createdAt || Date.now(),
    attempts: raw.attempts || 0,
    lastError: raw.lastError ?? null,
    status: raw.status === "failed" ? "failed" : "pending",
    conflict: null,
    sendingSince: null,
    userKey: raw.userKey ?? null,
    branchHeader: raw.branchHeader || "",
    typename: raw.typename || s.typename,
    label: raw.label || s.label,
    partyName: raw.partyName ?? null,
    amount: raw.amount ?? null,
    billdate: raw.billdate ?? null,
  };
}

// The id a document is known by while its create is queued.
export const docKeyOf = (item: OutboxItem): string | null =>
  item.kind === "create" ? (item.clientRequestId ? offlineIdFor(item.clientRequestId) : null) : item.targetId;

export const byAge = (a: OutboxItem, b: OutboxItem) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function findQueuedCreate(items: OutboxItem[], offlineId: string): OutboxItem | undefined {
  return items.find((i) => i.kind === "create" && i.clientRequestId && offlineIdFor(i.clientRequestId) === offlineId);
}

// Result of planning a change against the queue.
export interface Plan {
  // Items to write (new or changed) and ids to delete.
  put: OutboxItem[];
  remove: string[];
  // What happened, for the synthetic result.
  outcome: "queued" | "merged" | "dropped" | "noop" | "notfound";
  // The create the change was merged into, if any.
  create?: OutboxItem;
}

const isOpen = (i: OutboxItem) => i.sendingSince == null;

// Merges a change into the queue (offline docs: edit/delete fold into the create; server docs: later ops replace pending ones).
export function planChange(items: OutboxItem[], incoming: OutboxItem): Plan {
  const sorted = [...items].sort(byAge);
  if (incoming.kind === "create") return { put: [incoming], remove: [], outcome: "queued" };
  const target = incoming.targetId;
  if (!target) return { put: [incoming], remove: [], outcome: "queued" };
  const forTarget = sorted.filter((i) => i.kind !== "create" && i.targetId === target);

  if (isOfflineId(target)) {
    const create = findQueuedCreate(sorted, target);
    if (!create) return { put: [], remove: [], outcome: "notfound" };
    if (incoming.kind === "edit") {
      const num = create.number;
      const nf = NUMBER_FIELD[create.docType];
      const base = PARTIAL_EDIT.includes(create.docType) ? create.variables?.input : {};
      const input = { ...base, ...(incoming.variables?.input || {}), clientRequestId: create.clientRequestId };
      if (nf && num) input[nf] = num;
      else if (nf) delete input[nf];
      const merged: OutboxItem = {
        ...create,
        variables: { ...create.variables, input },
        status: create.status === "failed" ? "pending" : create.status,
        lastError: create.status === "failed" ? null : create.lastError,
        partyName: incoming.partyName ?? create.partyName,
        amount: incoming.amount ?? create.amount,
        billdate: incoming.billdate ?? create.billdate,
      };
      return { put: [merged], remove: [], outcome: "merged", create: merged };
    }
    if (incoming.kind === "delete") {
      return { put: [], remove: [create.id, ...forTarget.map((i) => i.id)], outcome: "dropped", create };
    }
    if (incoming.kind === "cancel") {
      const last = [...forTarget].reverse().find((i) => i.kind === "cancel" || i.kind === "reopen");
      if (last?.kind === "cancel") return { put: [], remove: [], outcome: "noop", create };
      return { put: [incoming], remove: [], outcome: "queued", create };
    }
    if (incoming.kind === "reopen") {
      const last = [...forTarget].reverse().find((i) => i.kind === "cancel" || i.kind === "reopen");
      if (last?.kind === "cancel" && last.status !== "review" && isOpen(last)) {
        return { put: [], remove: [last.id], outcome: "merged", create };
      }
      return { put: [incoming], remove: [], outcome: "queued", create };
    }
    return { put: [incoming], remove: [], outcome: "queued", create };
  }

  // Server document.
  const pendingOps = forTarget.filter((i) => i.status === "pending" && isOpen(i));
  const lastOp = forTarget[forTarget.length - 1];
  if (incoming.kind === "edit" && lastOp && lastOp.kind === "edit" && lastOp.status === "pending" && isOpen(lastOp)) {
    const merged: OutboxItem = {
      ...lastOp,
      variables: { ...lastOp.variables, input: incoming.variables?.input },
      partyName: incoming.partyName ?? lastOp.partyName,
      amount: incoming.amount ?? lastOp.amount,
      billdate: incoming.billdate ?? lastOp.billdate,
    };
    return { put: [merged], remove: [], outcome: "merged" };
  }
  if (incoming.kind === "delete" && pendingOps.length && pendingOps.length === forTarget.length) {
    const base = pendingOps[0].expectedUpdatedAt ?? incoming.expectedUpdatedAt;
    const del = withExpected({ ...incoming, createdAt: pendingOps[0].createdAt }, base);
    return { put: [del], remove: pendingOps.map((i) => i.id), outcome: "queued" };
  }
  if ((incoming.kind === "cancel" || incoming.kind === "reopen") && lastOp && lastOp.status === "pending" && isOpen(lastOp)) {
    const opposite = incoming.kind === "cancel" ? "reopen" : "cancel";
    if (lastOp.kind === opposite) return { put: [], remove: [lastOp.id], outcome: "merged" };
    if (lastOp.kind === incoming.kind) return { put: [], remove: [], outcome: "noop" };
  }
  // Later ops on the same doc share the oldest base version; sync chains it forward.
  const base = forTarget.length ? forTarget[0].expectedUpdatedAt : incoming.expectedUpdatedAt;
  return { put: [withExpected(incoming, base ?? incoming.expectedUpdatedAt)], remove: [], outcome: "queued" };
}

export function withExpected(item: OutboxItem, stamp: string | null): OutboxItem {
  const variables = { ...item.variables };
  if (stamp) variables.expectedUpdatedAt = stamp;
  else delete variables.expectedUpdatedAt;
  return { ...item, expectedUpdatedAt: stamp, variables };
}

// After an op on a doc succeeds: later ops based on the same version move to the new one.
export function chainStamps(items: OutboxItem[], done: OutboxItem, newStamp: string | null, realTarget: string | null): OutboxItem[] {
  const target = realTarget || done.targetId;
  if (!target || done.kind === "create") return [];
  const changed: OutboxItem[] = [];
  for (const i of items) {
    if (i.id === done.id || i.kind === "create" || i.targetId !== target) continue;
    if (i.expectedUpdatedAt !== done.expectedUpdatedAt) continue;
    changed.push(withExpected(i, newStamp));
  }
  return changed;
}

// Rewrites temp ids to real ids in queued items; returns only the changed items.
export function mapItemIds(items: OutboxItem[], map: Record<string, string>): OutboxItem[] {
  const changed: OutboxItem[] = [];
  for (const i of items) {
    const variables = replaceIds(i.variables, map);
    const targetId = i.targetId ? map[i.targetId] ?? i.targetId : i.targetId;
    if (targetId !== i.targetId || JSON.stringify(variables) !== JSON.stringify(i.variables)) {
      changed.push({ ...i, variables, targetId });
    }
  }
  return changed;
}

// Temp ids an item still needs resolved (its own create id excluded).
export function pendingRefs(item: OutboxItem, map: Record<string, string>): string[] {
  const own = item.kind === "create" && item.clientRequestId ? offlineIdFor(item.clientRequestId) : null;
  const ids = collectOfflineIds(item.variables);
  if (item.targetId && isOfflineId(item.targetId)) ids.add(item.targetId);
  return [...ids].filter((id) => id !== own && !map[id]);
}

// Next item to send: oldest pending one with resolvable temp ids and nothing older on the same doc.
export function pickNext(items: OutboxItem[], map: Record<string, string>): { next: OutboxItem | null; orphans: OutboxItem[] } {
  const sorted = [...items].sort(byAge);
  const orphans: OutboxItem[] = [];
  let next: OutboxItem | null = null;
  for (let idx = 0; idx < sorted.length; idx++) {
    const item = sorted[idx];
    // Skips an item being sent right now (e.g. a create waiting for its 3 s answer).
    if (item.status !== "pending" || item.sendingSince != null) continue;
    const refs = pendingRefs(item, map);
    if (refs.some((r) => !findQueuedCreate(sorted, r))) {
      orphans.push(item);
      continue;
    }
    if (refs.length || next) continue;
    const key = docKeyOf(item);
    const mappedKey = key ? map[key] ?? key : null;
    const blocked = sorted.slice(0, idx).some((o) => {
      const ok = docKeyOf(o);
      return ok != null && (ok === key || (map[ok] ?? ok) === mappedKey);
    });
    if (!blocked) next = item;
  }
  return { next, orphans };
}

// ---------- Overlays ----------

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const idOf = (v: any): string => (!v ? "" : typeof v === "string" ? v : String(v.id ?? v._id ?? ""));

// Queued creates still alive, with their effective cancel state.
export function liveCreates(items: OutboxItem[], statuses: OutboxStatus[] = ["pending", "review"]): Array<{ item: OutboxItem; cancelled: boolean }> {
  const sorted = [...items].sort(byAge);
  const out: Array<{ item: OutboxItem; cancelled: boolean }> = [];
  for (const c of sorted) {
    if (c.kind !== "create" || !statuses.includes(c.status) || !c.clientRequestId) continue;
    const key = offlineIdFor(c.clientRequestId);
    let cancelled = false;
    for (const f of sorted) {
      if (f.targetId !== key) continue;
      if (f.kind === "cancel") cancelled = true;
      if (f.kind === "reopen") cancelled = false;
    }
    out.push({ item: c, cancelled });
  }
  return out;
}

// Base-unit quantity of a line (sales, purchase, transfer or adjustment), same rule as utils/products/stockcheck lineBaseQty.
export function lineBaseQty(line: any, variant?: any): number {
  const qty = num(line?.qty ?? line?.transferqty ?? line?.quantity) * (line?.unitqty ? num(line.unitqty) : 1);
  if (!variant) return qty;
  const unitId = idOf(line?.salesunitid) || idOf(line?.purchaseunitid) || idOf(line?.transferunitid) || idOf(variant.baseunitid);
  const baseUnitId = idOf(variant.baseunitid);
  if (!unitId || unitId === baseUnitId) return qty;
  const conv = (variant.unitconversions || []).find((uc: any) => idOf(uc.unitid) === unitId);
  return qty * Number(conv?.factor ?? 1);
}

const STOCK_SIGN: Partial<Record<DocType, number>> = { salesinvoice: -1, salesreturn: 1, purchaseinvoice: 1, purchasereturn: -1 };

// Branch, sign and lines of each stock move a queued document makes; orders and services make none.
export function stockMoves(type: DocType, input: any): Array<[string, number, any[]]> {
  if (type === "transferstock") {
    const lines = input?.items || [];
    return [[idOf(input?.frombranchid), -1, lines], [idOf(input?.tobranchid), 1, lines]];
  }
  if (type === "stockadjustment") return [[idOf(input?.branchid), input?.type === "Excess" ? 1 : -1, input?.items || []]];
  const sign = STOCK_SIGN[type];
  if (!sign || input?.isservice) return [];
  return [[idOf(input?.branchid), sign, input?.productservice || []]];
}

// Unsynced stock change for a variant in a branch (all branches when null).
export function stockDelta(items: OutboxItem[], productId: string, variantId: string | null, branchId: string | null, variant?: any): number {
  let total = 0;
  for (const { item, cancelled } of liveCreates(items)) {
    if (cancelled) continue;
    for (const [branch, sign, lines] of stockMoves(item.docType, item.variables?.input || {})) {
      if (branchId && branch && branch !== branchId) continue;
      for (const line of lines) {
        if (idOf(line?.productserviceid ?? line?.productid) !== productId) continue;
        if (variantId && idOf(line?.variantid) !== variantId) continue;
        total += sign * lineBaseQty(line, variant);
      }
    }
  }
  return total;
}

// Unsynced balance change (debit positive): sales invoices add (total - received), purchase invoices subtract (total - paid), returns and payments the other way.
export function partyDelta(items: OutboxItem[], partyId: string): number {
  let total = 0;
  for (const { item, cancelled } of liveCreates(items)) {
    if (cancelled) continue;
    const input = item.variables?.input || {};
    if (item.docType === "salesinvoice") {
      if (idOf(input.partyacc) !== partyId) continue;
      const t = num(input.totalamount);
      const pay = String(input.paymenttype || "").toLowerCase();
      const received = pay === "credit" ? 0 : Math.min(Math.max(num(input.received), 0), t);
      total += t - received;
    } else if (item.docType === "salesreturn") {
      if (idOf(input.partyacc) !== partyId) continue;
      const pay = String(input.paymenttype || "").toLowerCase();
      const mode = String(input.refundMode || "auto").toLowerCase();
      if (mode === "auto" && (pay === "cash" || pay === "bank")) continue;
      total -= num(input.totalamount);
    } else if (item.docType === "purchaseinvoice") {
      if (idOf(input.partyacc) !== partyId) continue;
      const t = num(input.totalamount);
      const pay = String(input.paymenttype || "").toLowerCase();
      const paid = pay === "credit" ? 0 : Math.min(Math.max(num(input.paid), 0), t);
      total -= t - paid;
    } else if (item.docType === "purchasereturn") {
      if (idOf(input.partyacc) !== partyId) continue;
      const pay = String(input.paymenttype || "").toLowerCase();
      const mode = String(input.refundMode || "auto").toLowerCase();
      if (mode === "auto" && (pay === "cash" || pay === "bank")) continue;
      total += num(input.totalamount);
    } else if (item.docType === "payment") {
      if (idOf(input.partyid) !== partyId) continue;
      const v = num(input.amount) + num(input.discount) + num(input.commission);
      total += String(input.type || "").toLowerCase() === "receipt" ? -v : v;
    }
  }
  return total;
}

// ---------- Pull sync and local reads ----------

export interface PullChange {
  collection: string;
  docs: any;
  deletedIds?: string[] | null;
  // Set when the server cut this collection at its cap: pull it again from here.
  nextSince?: string | null;
}

export const recordKey = (collection: string, id: string) => `${collection}:${id}`;
export const docId = (d: any): string => (d && (d.id ?? d._id) != null ? String(d.id ?? d._id) : "");

function docsOf(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (typeof v !== "string") return [];
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Records to write and keys to drop for one syncPull result; a full pull also drops what it no longer sends (uncut collections only).
export function planPull(existingKeys: Iterable<string>, changes: PullChange[] | null | undefined, full: boolean): { put: Record<string, any>; remove: string[] } {
  const put: Record<string, any> = {};
  const remove = new Set<string>();
  const pulled = new Set<string>();
  for (const ch of changes || []) {
    if (!ch?.collection) continue;
    if (!ch.nextSince) pulled.add(ch.collection);
    for (const d of docsOf(ch.docs)) {
      const id = docId(d);
      if (id) put[recordKey(ch.collection, id)] = d;
    }
    for (const id of ch.deletedIds || []) {
      const k = recordKey(ch.collection, String(id));
      delete put[k];
      remove.add(k);
    }
  }
  if (full) {
    for (const k of existingKeys) {
      if (pulled.has(k.slice(0, k.indexOf(":"))) && !(k in put)) remove.add(k);
    }
  }
  return { put, remove: [...remove] };
}

export function createdTime(d: any): number {
  const v = d?.createdAt;
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : Date.parse(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
}

export function newestFirst(rows: any[]): any[] {
  return [...rows].sort((a, b) => createdTime(b) - createdTime(a) || (docId(b) > docId(a) ? 1 : docId(b) < docId(a) ? -1 : 0));
}

// One page of already sorted rows; search and column filter values match anywhere in the row.
export function pageRows(rows: any[], v: { page?: number; pageSize?: number; search?: string; columnFilters?: any[] } = {}): { items: any[]; total: number } {
  const terms = [String(v.search || ""), ...((v.columnFilters || []) as any[]).map((f) => String(f?.value ?? ""))]
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const matched = terms.length ? rows.filter((r) => terms.every((t) => JSON.stringify(r).toLowerCase().includes(t))) : rows;
  const size = Math.min(Math.max(Number(v.pageSize) || 10, 1), 200);
  const start = (Math.max(Number(v.page) || 1, 1) - 1) * size;
  return { items: matched.slice(start, start + size), total: matched.length };
}

// ---------- Hybrid numbers ----------

export type PushOutcome = { kind: "answered"; data: any } | { kind: "rejected"; error: any } | { kind: "timeout" } | { kind: "noNetwork" };

// Resolves with the outcome, or "timeout" when it takes longer than ms.
export function withTimeout(p: Promise<PushOutcome>, ms: number): Promise<PushOutcome> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve({ kind: "timeout" }), ms);
    p.then(
      (r) => {
        clearTimeout(t);
        resolve(r);
      },
      () => {
        clearTimeout(t);
        resolve({ kind: "noNetwork" });
      }
    );
  });
}

// Server answered in time: its document and main number; rejected: show the error; otherwise the device series.
export function numberSource(online: boolean, outcome: PushOutcome["kind"] | null): "server" | "device" | "error" {
  if (!online || !outcome) return "device";
  if (outcome === "answered") return "server";
  if (outcome === "rejected") return "error";
  return "device";
}
