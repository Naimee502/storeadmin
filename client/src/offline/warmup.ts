// Loads what the billing screens need into the (persisted) cache, with the same variables as their hooks.
import type { DocumentNode } from "graphql";
import { store } from "../redux/store";
import { GET_PRODUCT_SERVICES } from "../graphql/queries/products";
import { GET_ACCOUNTS, GET_ACCOUNTS_LITE, GET_PARTY_OUTSTANDING_SUMMARY } from "../graphql/queries/accounts";
import { GET_ACCOUNTLEDGERS } from "../graphql/queries/accountledgers";
import { GET_BRANCHES } from "../graphql/queries/branches";
import { GET_ADMIN_SETTINGS } from "../graphql/queries/adminsettings";
import { GET_PRICE_ASSIGNMENTS, GET_PRICE_LISTS } from "../graphql/queries/pricelists";
import { GET_CHARGE_RULES } from "../graphql/queries/chargerules";
import { GET_UNITS } from "../graphql/queries/units";
import { GET_STAFF, GET_STAFF_LIST } from "../graphql/queries/staffaccounts";
import { GET_CATEGORIES } from "../graphql/queries/categories";
import { GET_SUBCATEGORIES } from "../graphql/queries/subcategories";
import { GET_BRANDS } from "../graphql/queries/brands";
import { GET_MODELS } from "../graphql/queries/models";
import { GET_SIZES } from "../graphql/queries/sizes";
import { GET_PRODUCTGROUPS } from "../graphql/queries/productgroups";
import { GET_SALES_INVOICES, GET_SALES_INVOICES_LIST, GET_SALES_INVOICES_PAGE, GET_SALES_INVOICES_SETTLE } from "../graphql/queries/salesinvoice";
import { GET_SALES_ORDERS, GET_SALES_ORDERS_LIST, GET_SALES_ORDERS_PAGE } from "../graphql/queries/salesorder";
import { GET_SALES_RETURNS, GET_SALES_RETURNS_PAGE } from "../graphql/queries/salesreturn";
import { GET_PAYMENTS, GET_PAYMENTS_LIST, GET_PAYMENTS_PAGE } from "../graphql/queries/payments";
import { GET_TRANSACTIONS } from "../graphql/queries/transactions";
import { GET_PURCHASE_RETURNS } from "../graphql/queries/purchasereturn";
import { GET_PURCHASE_INVOICES_SETTLE } from "../graphql/queries/purchaseinvoice";
import { GET_EXPENSE_NOTES } from "../graphql/queries/expensenote";
import { isOfflineEnabled } from "./settings";
import { currentUserKey } from "./userkey";
import { getOfflineClient } from "./outbox";
import { ensureDevice, heartbeat } from "./device";
import { scheduleCacheSave } from "./persist";

const WARMUP_INTERVAL_MS = 10 * 60 * 1000;
const MIN_GAP_MS = 60 * 1000;
const CONCURRENCY = 3;

type Job = { name: string; query: DocumentNode; variables: Record<string, any> };

// Same tenant/branch rules as the graphql hooks.
function scopeOf(state: any) {
  const { type, admin, branch, staff } = state?.auth || {};
  const selectedBranchId = state?.selectedBranch?.branchId;
  const adminid = type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : type === "staff" ? staff?.admin?.id : undefined;
  const branchid = type === "admin" ? selectedBranchId : type === "branch" ? branch?.id : type === "staff" ? staff?.branchid?.id : undefined;
  // Price lists, charge rules and branches read state.auth.admin directly.
  const authAdminId = admin?.id;
  return { type, adminid, branchid, authAdminId };
}

// The queries (and exact variables) the billing screens run, so cache keys match.
export function warmupJobs(state: any): Job[] {
  const { adminid, branchid, authAdminId } = scopeOf(state);
  if (!adminid) return [];
  const filter = { adminid, branchid };
  const firstPage = { page: 1, pageSize: 10, search: "", columnFilters: [] as any[] };
  const party = { filter: { admin: adminid, status: true } };
  const jobs: Job[] = [
    { name: "products", query: GET_PRODUCT_SERVICES, variables: { filter: { adminid, branchid, status: true }, limit: 0, offset: 0 } },
    { name: "accountsLite", query: GET_ACCOUNTS_LITE, variables: party },
    { name: "accounts", query: GET_ACCOUNTS, variables: party },
    { name: "outstanding", query: GET_PARTY_OUTSTANDING_SUMMARY, variables: party },
    { name: "ledgers", query: GET_ACCOUNTLEDGERS, variables: { adminId: adminid } },
    { name: "branches", query: GET_BRANCHES, variables: authAdminId ? { adminId: authAdminId } : {} },
    { name: "adminSettings", query: GET_ADMIN_SETTINGS, variables: { adminid } },
    { name: "units", query: GET_UNITS, variables: { adminId: adminid } },
    { name: "staff", query: GET_STAFF, variables: { filter: { adminId: adminid } } },
    { name: "staffList", query: GET_STAFF_LIST, variables: { filter: { adminId: adminid } } },
    { name: "categories", query: GET_CATEGORIES, variables: { adminId: adminid } },
    { name: "subcategories", query: GET_SUBCATEGORIES, variables: { adminId: adminid } },
    { name: "brands", query: GET_BRANDS, variables: { adminId: adminid } },
    { name: "models", query: GET_MODELS, variables: { adminId: adminid } },
    { name: "sizes", query: GET_SIZES, variables: { adminId: adminid } },
    { name: "productGroups", query: GET_PRODUCTGROUPS, variables: { adminId: adminid } },
    { name: "salesInvoices", query: GET_SALES_INVOICES, variables: { filter } },
    { name: "salesInvoicesList", query: GET_SALES_INVOICES_LIST, variables: { filter } },
    { name: "salesInvoicesSettle", query: GET_SALES_INVOICES_SETTLE, variables: { filter } },
    { name: "salesOrders", query: GET_SALES_ORDERS, variables: { filter } },
    { name: "salesOrdersList", query: GET_SALES_ORDERS_LIST, variables: { filter } },
    { name: "salesReturns", query: GET_SALES_RETURNS, variables: { filter } },
    { name: "payments", query: GET_PAYMENTS, variables: { filter } },
    { name: "paymentsList", query: GET_PAYMENTS_LIST, variables: { filter } },
    { name: "transactions", query: GET_TRANSACTIONS, variables: { filter } },
    { name: "purchaseReturns", query: GET_PURCHASE_RETURNS, variables: { filter } },
    { name: "purchaseInvoicesSettle", query: GET_PURCHASE_INVOICES_SETTLE, variables: { filter } },
    { name: "expenseNotes", query: GET_EXPENSE_NOTES, variables: { filter } },
    { name: "salesInvoicesPage", query: GET_SALES_INVOICES_PAGE, variables: { filter: { adminid, branchid, includeCancelled: true }, ...firstPage } },
    { name: "salesOrdersPage", query: GET_SALES_ORDERS_PAGE, variables: { filter, ...firstPage } },
    { name: "salesReturnsPage", query: GET_SALES_RETURNS_PAGE, variables: { filter, ...firstPage } },
    { name: "paymentsPage", query: GET_PAYMENTS_PAGE, variables: { filter, ...firstPage } },
  ];
  if (authAdminId) {
    jobs.push(
      { name: "priceLists", query: GET_PRICE_LISTS, variables: { adminid: authAdminId } },
      { name: "priceAssignments", query: GET_PRICE_ASSIGNMENTS, variables: { adminid: authAdminId } },
      { name: "chargeRules", query: GET_CHARGE_RULES, variables: { adminid: authAdminId } }
    );
  }
  return jobs;
}

export interface WarmupStatus {
  running: boolean;
  lastRunAt: number | null;
  failed: string[];
}

let status: WarmupStatus = { running: false, lastRunAt: null, failed: [] };
let lastKey = "";
let started = false;
let timer: ReturnType<typeof setTimeout> | null = null;

export const getWarmupStatus = () => status;

const scopeKey = () => {
  const s = scopeOf(store.getState());
  return `${currentUserKey() || ""}|${s.adminid || ""}|${s.branchid || ""}`;
};

// Runs every warm-up query once (network-only). Never rejects.
export async function runWarmup(): Promise<WarmupStatus> {
  const client = getOfflineClient();
  if (!client || status.running || !isOfflineEnabled() || !currentUserKey() || navigator.onLine === false) return status;
  const jobs = warmupJobs(store.getState());
  if (!jobs.length) return status;
  status = { ...status, running: true };
  const failed: string[] = [];
  try {
    await ensureDevice();
    let next = 0;
    const worker = async () => {
      while (next < jobs.length && navigator.onLine !== false) {
        const job = jobs[next++];
        try {
          await client.query({
            query: job.query,
            variables: job.variables,
            fetchPolicy: "network-only",
            context: { offlineNoFallback: true },
          });
        } catch {
          failed.push(job.name);
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    await heartbeat();
  } finally {
    status = { running: false, lastRunAt: Date.now(), failed };
    scheduleCacheSave();
  }
  return status;
}

function schedule(delay: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    lastKey = scopeKey();
    void runWarmup();
  }, delay);
}

// After login or a branch switch, when back online, and every 10 minutes.
export function startWarmup(): void {
  if (started) return;
  started = true;
  store.subscribe(() => {
    const key = scopeKey();
    if (key !== lastKey && currentUserKey()) {
      lastKey = key;
      schedule(2000);
    }
  });
  window.addEventListener("online", () => {
    if (!status.lastRunAt || Date.now() - status.lastRunAt > MIN_GAP_MS) schedule(3000);
  });
  setInterval(() => void runWarmup(), WARMUP_INTERVAL_MS);
  if (currentUserKey()) schedule(3000);
}
