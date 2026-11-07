// Read-only check: every server-paged admin list must show the same rows as the old full list.
// Usage: VERIFY_TOKEN="Bearer <token>" npx ts-node --transpile-only src/scripts/verify-paging.ts [module ...]
// Modules: keys below (e.g. salesorder accounts) or page query names (e.g. getUnitsPage); none = all.
// Optional env: VERIFY_URL (default http://localhost:4000/graphql),
//   VERIFY_BRANCH_ID (branch the admin has selected; default none = "All Branches").
// Writes nothing: it only sends GraphQL queries, never mutations.

const URL_ = process.env.VERIFY_URL || "http://localhost:4000/graphql";
const RAW_TOKEN = (process.env.VERIFY_TOKEN || "").trim().replace(/^Bearer\s+/i, "");
const PAGE_SIZE = 200;

type Row = Record<string, any>;

// What the logged-in user's token says, plus the branch picked in the header.
export type Scope = {
  type: string;
  adminid?: string;
  /** branchid the list hooks send: selected branch for admin, own branch for branch/staff. */
  branchid?: string;
  /** state.selectedBranch.branchId in the browser ("" = All Branches). */
  selectedBranch: string;
};

type Ctx = Record<string, any>;

export type ModuleConfig = {
  key: string;
  oldQuery: string;
  oldField: string;
  oldVars: (s: Scope, ctx: Ctx) => Row;
  /** Browser-side filter the old page applied before showing rows. */
  oldTransform?: (rows: Row[], ctx: Ctx) => Row[];
  /** Old page did [...list].reverse() before rendering. */
  reversed: boolean;
  pageQuery: string;
  pageField: string;
  pageVars: (s: Scope, ctx: Ctx) => Row;
  /** Text the list shows for the row in one searchable column. */
  searchText: (row: Row) => string;
  getId?: (row: Row) => string;
  /** Extra lookups a module needs before building variables. */
  prepare?: (s: Scope) => Promise<Ctx>;
  /** Not a default view: runs only when named on the command line. */
  optIn?: boolean;
};

// ---------- token and scope ----------

function decodeJwt(token: string): Row {
  const part = token.split(".")[1];
  if (!part) throw new Error("VERIFY_TOKEN is not a JWT");
  const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
}

// Same rules as the client hooks: admin uses its own id and the selected branch.
function buildScope(payload: Row): Scope {
  const type = String(payload.type || "");
  const envBranch = (process.env.VERIFY_BRANCH_ID || "").trim();
  if (type === "admin") {
    return { type, adminid: payload.id, branchid: envBranch, selectedBranch: envBranch };
  }
  if (type === "branch") {
    const own = payload.id;
    return { type, adminid: payload.adminid, branchid: own, selectedBranch: envBranch || own };
  }
  if (type === "staff") {
    const own = payload.branchid;
    return { type, adminid: payload.adminid, branchid: own, selectedBranch: envBranch || own || "" };
  }
  return { type, adminid: undefined, branchid: undefined, selectedBranch: envBranch };
}

// ---------- transport ----------

let branchHeader = "";

async function gql(query: string, variables: Row): Promise<any> {
  const res = await fetch(URL_, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RAW_TOKEN}`,
      "x-branch-id": branchHeader,
    },
    body: JSON.stringify({ query, variables }),
  });
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  if (json.errors?.length) throw new Error(json.errors.map((e: any) => e.message).join("; "));
  if (!json.data) throw new Error(`HTTP ${res.status}: no data`);
  return json.data;
}

// ---------- documents ----------

const pageDoc = (name: string, field: string, args: string, fields: string, extraArgs = "") => `query ${name}(${args}, $page: Int, $pageSize: Int, $search: String, $columnFilters: [ColumnFilter!]${extraArgs ? ", " + extraArgs : ""}) {
  ${field}(${args.replace(/\$(\w+):[^,]+/g, "$1: $$$1")}, page: $page, pageSize: $pageSize, search: $search, columnFilters: $columnFilters${extraArgs ? ", " + extraArgs.replace(/\$(\w+):[^,]+/g, "$1: $$$1") : ""}) { total items { ${fields} } }
}`;

const listDoc = (name: string, field: string, args: string, fields: string) => `query ${name}(${args}) {
  ${field}(${args.replace(/\$(\w+):[^,]+/g, "$1: $$$1")}) { ${fields} }
}`;

export const SETTINGS_QUERY = `query VerifyAdminSettings($adminid: ID!) { getAdminSettings(adminid: $adminid) { partyManagesDownline directPartyOrdersOnly } }`;

// Default page variables the new list pages send (page/pageSize/search added by the runner).
const paging = { columnFilters: [] as Row[] };

// Standard filter of the transaction-style hooks.
const scopeFilter = (s: Scope) => ({ adminid: s.adminid, branchid: s.branchid });

const BILL = "id billnumber";

export const MODULES: ModuleConfig[] = [
  {
    key: "salesinvoice",
    oldQuery: listDoc("OldSalesInvoices", "getSalesInvoices", "$filter: SalesInvoiceFilterInput", BILL),
    oldField: "getSalesInvoices",
    oldVars: (s) => ({ filter: scopeFilter(s) }),
    reversed: true,
    pageQuery: pageDoc("NewSalesInvoices", "getSalesInvoicesPage", "$filter: SalesInvoiceFilterInput", BILL),
    pageField: "getSalesInvoicesPage",
    pageVars: (s) => ({ filter: { ...scopeFilter(s), includeCancelled: true }, ...paging }),
    searchText: (r) => `INV-${r.billnumber}`,
  },
  {
    key: "salesorder",
    oldQuery: listDoc("OldSalesOrders", "getSalesOrders", "$filter: SalesOrderFilterInput", BILL),
    oldField: "getSalesOrders",
    oldVars: (s) => ({ filter: scopeFilter(s) }),
    reversed: true,
    pageQuery: pageDoc("NewSalesOrders", "getSalesOrdersPage", "$filter: SalesOrderFilterInput", BILL),
    pageField: "getSalesOrdersPage",
    pageVars: (s) => ({ filter: scopeFilter(s), ...paging }),
    searchText: (r) => `SO-${r.billnumber}`,
  },
  {
    key: "salesreturn",
    oldQuery: listDoc("OldSalesReturns", "getSalesReturns", "$filter: SalesReturnFilterInput", BILL),
    oldField: "getSalesReturns",
    oldVars: (s) => ({ filter: scopeFilter(s) }),
    reversed: true,
    pageQuery: pageDoc("NewSalesReturns", "getSalesReturnsPage", "$filter: SalesReturnFilterInput", BILL),
    pageField: "getSalesReturnsPage",
    pageVars: (s) => ({ filter: scopeFilter(s), ...paging }),
    searchText: (r) => String(r.billnumber ?? ""),
  },
  {
    key: "purchaseinvoice",
    oldQuery: listDoc("OldPurchaseInvoices", "getPurchaseInvoices", "$filter: PurchaseInvoiceFilterInput", BILL),
    oldField: "getPurchaseInvoices",
    // Old hook sent only adminid/branchid; includeCancelled only skipped a browser filter.
    oldVars: (s) => ({ filter: scopeFilter(s) }),
    reversed: true,
    pageQuery: pageDoc("NewPurchaseInvoices", "getPurchaseInvoicesPage", "$filter: PurchaseInvoiceFilterInput", BILL),
    pageField: "getPurchaseInvoicesPage",
    pageVars: (s) => ({ filter: { ...scopeFilter(s), includeCancelled: true }, ...paging }),
    searchText: (r) => `INV-${r.billnumber}`,
  },
  {
    key: "purchaseorder",
    oldQuery: listDoc("OldPurchaseOrders", "getPurchaseOrders", "$filter: PurchaseOrderFilterInput", BILL),
    oldField: "getPurchaseOrders",
    oldVars: (s) => ({ filter: scopeFilter(s) }),
    reversed: true,
    pageQuery: pageDoc("NewPurchaseOrders", "getPurchaseOrdersPage", "$filter: PurchaseOrderFilterInput", BILL),
    pageField: "getPurchaseOrdersPage",
    pageVars: (s) => ({ filter: scopeFilter(s), ...paging }),
    searchText: (r) => `PO-${r.billnumber}`,
  },
  {
    key: "purchasereturn",
    oldQuery: listDoc("OldPurchaseReturns", "getPurchaseReturns", "$filter: PurchaseReturnFilterInput", BILL),
    oldField: "getPurchaseReturns",
    oldVars: (s) => ({ filter: scopeFilter(s) }),
    reversed: true,
    pageQuery: pageDoc("NewPurchaseReturns", "getPurchaseReturnsPage", "$filter: PurchaseReturnFilterInput", BILL),
    pageField: "getPurchaseReturnsPage",
    pageVars: (s) => ({ filter: scopeFilter(s), ...paging }),
    searchText: (r) => String(r.billnumber ?? ""),
  },
  {
    key: "products",
    oldQuery: listDoc("OldProducts", "getProductServices", "$filter: ProductServiceFilterInput, $limit: Int, $offset: Int", "id name"),
    oldField: "getProductServices",
    oldVars: (s) => ({ filter: { ...scopeFilter(s), status: true }, limit: 0, offset: 0 }),
    reversed: false,
    pageQuery: pageDoc("NewProducts", "getProductServicesPage", "$filter: ProductServiceFilterInput", "id name", "$lowStock: Boolean"),
    pageField: "getProductServicesPage",
    pageVars: (s) => ({ filter: { ...scopeFilter(s), status: true }, ...paging, lowStock: false }),
    searchText: (r) => String(r.name ?? ""),
  },
  {
    // Not the default view: the dashboard "Low Stock Alert" link (?filter=lowstock).
    key: "products-lowstock",
    optIn: true,
    oldQuery: listDoc(
      "OldProductsLowStock",
      "getProductServices",
      "$filter: ProductServiceFilterInput, $limit: Int, $offset: Int",
      "id name isservice productvariants { currentstock minimumstock }"
    ),
    oldField: "getProductServices",
    oldVars: (s) => ({ filter: { ...scopeFilter(s), status: true }, limit: 0, offset: 0 }),
    oldTransform: (rows) =>
      rows.filter(
        (p) =>
          !p.isservice &&
          (p.productvariants ?? []).some((v: Row) => (v.currentstock ?? 0) < (v.minimumstock ?? 0))
      ),
    reversed: false,
    pageQuery: pageDoc("NewProductsLowStock", "getProductServicesPage", "$filter: ProductServiceFilterInput", "id name", "$lowStock: Boolean"),
    pageField: "getProductServicesPage",
    pageVars: (s) => ({ filter: { ...scopeFilter(s), status: true }, ...paging, lowStock: true }),
    searchText: (r) => String(r.name ?? ""),
  },
  {
    key: "accounts",
    oldQuery: listDoc("OldAccounts", "getAccounts", "$filter: AccountFilterInput", "id accountcode name assignaccountid { id }"),
    oldField: "getAccounts",
    oldVars: (s) => ({ filter: { admin: s.adminid, status: true } }),
    // Default view hides sub-parties when downline + direct-only are both on.
    oldTransform: (rows, ctx) => (ctx.directOnly ? rows.filter((a) => !a.assignaccountid?.id) : rows),
    reversed: true,
    pageQuery: pageDoc("NewAccounts", "getAccountsPage", "$filter: AccountFilterInput", "id accountcode name", "$directPartiesOnly: Boolean"),
    pageField: "getAccountsPage",
    pageVars: (s, ctx) => ({ filter: { admin: s.adminid, status: true }, ...paging, directPartiesOnly: !!ctx.directOnly }),
    searchText: (r) => String(r.accountcode || r.name || ""),
    prepare: async (s) => {
      if (!s.adminid) return { directOnly: false };
      try {
        const st = (await gql(SETTINGS_QUERY, { adminid: s.adminid })).getAdminSettings || {};
        return { directOnly: !!st.directPartyOrdersOnly && !!st.partyManagesDownline };
      } catch (e: any) {
        report("WARN", "accounts", `settings not read (${e?.message || e}); assuming all parties shown`);
        return { directOnly: false };
      }
    },
  },
  {
    key: "staffaccounts",
    oldQuery: listDoc("OldStaff", "getStaffAccounts", "$filter: StaffFilterInput", "id name"),
    oldField: "getStaffAccounts",
    oldVars: (s) => ({ filter: { adminId: s.adminid } }),
    reversed: true,
    pageQuery: pageDoc("NewStaff", "getStaffAccountsPage", "$filter: StaffFilterInput", "id name"),
    pageField: "getStaffAccountsPage",
    pageVars: (s) => ({ filter: { adminId: s.adminid }, ...paging }),
    searchText: (r) => String(r.name ?? ""),
  },
  {
    key: "branches",
    oldQuery: listDoc("OldBranches", "getBranches", "$adminId: ID", "id branchcode branchname"),
    oldField: "getBranches",
    oldVars: (s) => (s.adminid ? { adminId: s.adminid } : {}),
    reversed: true,
    pageQuery: pageDoc("NewBranches", "getBranchesPage", "$adminId: ID", "id branchcode branchname"),
    pageField: "getBranchesPage",
    pageVars: (s) => ({ ...(s.adminid ? { adminId: s.adminid } : {}), ...paging }),
    searchText: (r) => String(r.branchcode || r.branchname || ""),
  },
  {
    key: "transactions",
    oldQuery: listDoc("OldTransactions", "getTransactions", "$filter: TransactionFilterInput", "id transactioncode"),
    oldField: "getTransactions",
    oldVars: (s) => ({ filter: scopeFilter(s) }),
    reversed: true,
    pageQuery: pageDoc("NewTransactions", "getTransactionsPage", "$filter: TransactionFilterInput", "id transactioncode"),
    pageField: "getTransactionsPage",
    pageVars: (s) => ({ filter: scopeFilter(s), ...paging }),
    searchText: (r) => String(r.transactioncode ?? ""),
  },
  {
    key: "payments",
    oldQuery: listDoc("OldPayments", "getPayments", "$filter: PaymentFilterInput", "id paymentcode"),
    oldField: "getPayments",
    oldVars: (s) => ({ filter: scopeFilter(s) }),
    reversed: true,
    pageQuery: pageDoc("NewPayments", "getPaymentsPage", "$filter: PaymentFilterInput", "id paymentcode"),
    pageField: "getPaymentsPage",
    pageVars: (s) => ({ filter: scopeFilter(s), ...paging }),
    searchText: (r) => String(r.paymentcode ?? ""),
  },
  {
    key: "expensenote",
    oldQuery: listDoc("OldExpenseNotes", "getExpenseNotes", "$filter: ExpenseNoteFilterInput", "id expensenumber"),
    oldField: "getExpenseNotes",
    oldVars: (s) => ({ filter: scopeFilter(s) }),
    reversed: false,
    pageQuery: pageDoc("NewExpenseNotes", "getExpenseNotesPage", "$filter: ExpenseNoteFilterInput", "id expensenumber"),
    pageField: "getExpenseNotesPage",
    pageVars: (s) => ({ filter: scopeFilter(s), ...paging }),
    searchText: (r) => String(r.expensenumber ?? ""),
  },
  {
    key: "stockadjustments",
    oldQuery: listDoc("OldStockAdjustments", "getStockAdjustments", "$filter: StockAdjustmentFilterInput, $limit: Int, $offset: Int", "id vouchernumber"),
    oldField: "getStockAdjustments",
    oldVars: (s) => ({ filter: { ...scopeFilter(s), status: true }, limit: 0, offset: 0 }),
    reversed: false,
    pageQuery: pageDoc("NewStockAdjustments", "getStockAdjustmentsPage", "$filter: StockAdjustmentFilterInput", "id vouchernumber"),
    pageField: "getStockAdjustmentsPage",
    pageVars: (s) => ({ filter: { ...scopeFilter(s), status: true }, ...paging }),
    searchText: (r) => String(r.vouchernumber ?? ""),
  },
  {
    key: "transferstock",
    oldQuery: listDoc("OldTransferStocks", "getTransferStocks", "$adminId: ID, $frombranchid: ID", "id vouchernumber"),
    oldField: "getTransferStocks",
    oldVars: (s) => ({ adminId: s.adminid, frombranchid: s.branchid }),
    reversed: false,
    pageQuery: pageDoc("NewTransferStocks", "getTransferStocksPage", "$adminId: ID, $frombranchid: ID", "id vouchernumber"),
    pageField: "getTransferStocksPage",
    pageVars: (s) => ({ adminId: s.adminid, frombranchid: s.branchid, ...paging }),
    searchText: (r) => String(r.vouchernumber ?? ""),
  },
  ...(
    [
      ["units", "Units", "unitname"],
      ["sizes", "Sizes", "sizename"],
      ["brands", "Brands", "brandname"],
      ["models", "Models", "modelname"],
      ["productgroups", "ProductGroups", "productgroupname"],
      ["accountgroups", "AccountGroups", "accountgroupname"],
      ["accountledgers", "AccountLedgers", "ledgername"],
    ] as const
  ).map(
    ([key, name, nameField]): ModuleConfig => ({
      key,
      oldQuery: listDoc(`Old${name}`, `get${name}`, "$adminId: ID", `id ${nameField}`),
      oldField: `get${name}`,
      oldVars: (s) => ({ adminId: s.adminid }),
      reversed: true,
      pageQuery: pageDoc(`New${name}`, `get${name}Page`, "$adminId: ID", `id ${nameField}`),
      pageField: `get${name}Page`,
      pageVars: (s) => ({ adminId: s.adminid, ...paging }),
      searchText: (r) => String(r[nameField] ?? ""),
    })
  ),
  {
    key: "pricelists",
    oldQuery: listDoc("OldPriceLists", "getPriceLists", "$adminid: ID!", "id name"),
    oldField: "getPriceLists",
    oldVars: (s) => ({ adminid: s.adminid }),
    reversed: false,
    pageQuery: pageDoc("NewPriceLists", "getPriceListsPage", "$adminid: ID!", "id name"),
    pageField: "getPriceListsPage",
    pageVars: (s) => ({ adminid: s.adminid, ...paging }),
    searchText: (r) => String(r.name ?? ""),
  },
  {
    key: "salesroutes",
    oldQuery: listDoc("OldSalesRoutes", "getSalesRoutes", "$filter: SalesRouteFilterInput, $limit: Int, $offset: Int", "id routecode routename"),
    oldField: "getSalesRoutes",
    oldVars: (s) => ({ filter: { ...routeFilter(s), status: true }, limit: 0, offset: 0 }),
    reversed: false,
    pageQuery: pageDoc("NewSalesRoutes", "getSalesRoutesPage", "$filter: SalesRouteFilterInput", "id routecode routename"),
    pageField: "getSalesRoutesPage",
    pageVars: (s) => ({ filter: { ...routeFilter(s), status: true }, ...paging }),
    searchText: (r) => String(r.routecode || r.routename || ""),
  },
];

// Sales routes page builds its own scope: staff gets no adminId there.
function routeFilter(s: Scope) {
  const adminId = s.type === "admin" || s.type === "branch" ? s.adminid : undefined;
  const branchId = s.selectedBranch || (s.type === "branch" ? s.branchid : undefined);
  return { adminId, branchId };
}

/** Every GraphQL document this script can send (for offline schema validation). */
export const DOCUMENTS: string[] = [SETTINGS_QUERY, ...MODULES.flatMap((m) => [m.oldQuery, m.pageQuery])];

// ---------- runner ----------

const counts = { OK: 0, WARN: 0, FAIL: 0 };
const failed = new Set<string>();

function report(level: "OK" | "WARN" | "FAIL", key: string, msg: string) {
  counts[level]++;
  if (level === "FAIL") failed.add(key);
  console.log(`${level.padEnd(4)} ${key.padEnd(18)} ${msg}`);
}

const clean = (v: Row) => JSON.parse(JSON.stringify(v));
const few = (ids: string[]) => ids.slice(0, 5).join(", ") + (ids.length > 5 ? ` (+${ids.length - 5} more)` : "");

async function fetchAllPages(m: ModuleConfig, base: Row, search: string): Promise<{ rows: Row[]; total: number }> {
  const rows: Row[] = [];
  let total = 0;
  for (let page = 1; page <= 10000; page++) {
    const r = (await gql(m.pageQuery, clean({ ...base, page, pageSize: PAGE_SIZE, search })))[m.pageField];
    total = r.total;
    rows.push(...r.items);
    if (!r.items.length || rows.length >= total) break;
  }
  return { rows, total };
}

async function runModule(m: ModuleConfig, scope: Scope) {
  const idOf = m.getId || ((r: Row) => String(r.id));
  try {
    const ctx = m.prepare ? await m.prepare(scope) : {};
    if (m.key === "accounts") console.log(`     ${m.key.padEnd(18)} default view direct parties only: ${!!ctx.directOnly}`);

    // Old: full list, browser filter, browser order.
    let oldRows: Row[] = (await gql(m.oldQuery, clean(m.oldVars(scope, ctx))))[m.oldField] || [];
    if (m.oldTransform) oldRows = m.oldTransform(oldRows, ctx);
    const shown = m.reversed ? [...oldRows].reverse() : oldRows;
    const oldIds = shown.map(idOf);

    // New: every page of the default view.
    const base = m.pageVars(scope, ctx);
    const { rows: newRows, total } = await fetchAllPages(m, base, "");
    const newIds = newRows.map(idOf);

    if (total === oldIds.length) report("OK", m.key, `total ${total} = old rows ${oldIds.length}`);
    else report("FAIL", m.key, `total ${total} != old rows ${oldIds.length}`);

    const dupes = newIds.filter((id, i) => newIds.indexOf(id) !== i);
    if (dupes.length) report("FAIL", m.key, `duplicate ids across pages: ${few([...new Set(dupes)])}`);
    else report("OK", m.key, `no duplicate ids in ${newIds.length} collected rows`);

    const oldSet = new Set(oldIds);
    const newSet = new Set(newIds);
    const missing = oldIds.filter((id) => !newSet.has(id));
    const extra = newIds.filter((id) => !oldSet.has(id));
    if (missing.length || extra.length) {
      report("FAIL", m.key, `id sets differ: missing ${missing.length} [${few(missing)}], extra ${extra.length} [${few(extra)}]`);
    } else {
      report("OK", m.key, "same id set as old list");
    }

    if (!missing.length && !extra.length && !dupes.length) {
      const at = oldIds.findIndex((id, i) => newIds[i] !== id);
      if (at < 0) report("OK", m.key, `order matches old page (${m.reversed ? "old list reversed" : "old list as-is"})`);
      else report("WARN", m.key, `order differs from old page at row ${at + 1}: old ${oldIds[at]} vs new ${newIds[at]}`);
    }

    // Search: one visible value of a row that both lists show.
    const sample =
      [...shown.slice(Math.floor(shown.length / 2)), ...shown].find((r) => newSet.has(idOf(r)) && m.searchText(r).trim()) ||
      shown.find((r) => m.searchText(r).trim());
    if (!sample) {
      report("WARN", m.key, "search not checked: no rows with searchable text");
    } else {
      const text = m.searchText(sample).trim();
      const found = await fetchAllPages(m, base, text);
      if (found.rows.some((r) => idOf(r) === idOf(sample))) report("OK", m.key, `search "${text}" finds row ${idOf(sample)} (${found.total} hits)`);
      else report("FAIL", m.key, `search "${text}" did not find row ${idOf(sample)} (${found.total} hits)`);
    }
  } catch (e: any) {
    report("FAIL", m.key, `query error: ${e?.message || e}`);
  }
}

async function main() {
  if (!RAW_TOKEN) {
    console.error('Set VERIFY_TOKEN="Bearer <token>" (the accessToken from the admin panel).');
    process.exit(1);
  }
  const scope = buildScope(decodeJwt(RAW_TOKEN));
  branchHeader = scope.selectedBranch || "";
  if (!["admin", "branch", "staff"].includes(scope.type)) {
    console.log(`WARN token type "${scope.type}" is not an admin panel login; scope may not match the pages.`);
  }
  console.log(`url ${URL_} | login ${scope.type} | adminid ${scope.adminid || "-"} | branchid ${scope.branchid || "(all)"}`);

  const wanted = process.argv.slice(2);
  const unknown = wanted.filter((w) => !MODULES.some((m) => m.key === w || m.pageField === w));
  if (unknown.length) {
    console.error(`Unknown module(s): ${unknown.join(", ")}. Known: ${MODULES.map((m) => m.key).join(", ")}`);
    process.exit(1);
  }
  const selected = wanted.length
    ? MODULES.filter((m) => wanted.includes(m.key) || (!m.optIn && wanted.includes(m.pageField)))
    : MODULES.filter((m) => !m.optIn);

  for (const m of selected) await runModule(m, scope);

  console.log(`\nSummary: ${counts.OK} OK, ${counts.WARN} WARN, ${counts.FAIL} FAIL across ${selected.length} module(s).`);
  if (failed.size) console.log(`Failed modules: ${[...failed].join(", ")}`);
  process.exit(counts.FAIL ? 1 : 0);
}

if (require.main === module) {
  main().catch((e) => {
    console.error("Verification error:", e?.message || e);
    process.exit(1);
  });
}
