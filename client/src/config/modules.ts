// Single source of truth for module ids, labels, and the action set each
// module supports. Consumed by:
//   - components/sidebar     (which links to render)
//   - pages/adminregister    (which checkboxes to show)
//   - pages/settings         (Permissions matrix and Modules tab)
//   - hooks/usePermission    (enumerating actions)
//
// Adding a new module here makes it appear everywhere automatically.
// Removing a module is safe — anything referring to a missing key falls
// back to "no permission" (deny by default).

export type ModuleAction =
  | "view"
  | "add"
  | "edit"
  | "delete"
  | "print"
  | "return"
  | "cancel"
  | "convert"
  | "whatsapp"
  | "import"
  | "export"
  | "exportexcel"
  | "exportcsv"
  | "exportpdf"
  | "reset";

export const ACTION_LABELS: Record<ModuleAction, string> = {
  view: "View",
  add: "Add",
  edit: "Edit",
  delete: "Delete",
  print: "Print",
  return: "Return",
  cancel: "Cancel",
  convert: "Convert",
  whatsapp: "WhatsApp",
  import: "Import",
  export: "Export",
  exportexcel: "Export Excel",
  exportcsv: "Export CSV",
  exportpdf: "Export PDF",
  reset: "Reset",
};

// Default action sets per module category. Sales/Purchase invoices get
// the full set; master data only gets CRUD; reports only get view+export.
const FULL_TXN_ACTIONS: ModuleAction[] = [
  "add", "edit", "delete", "print", "return", "whatsapp", "reset",
];
const ORDER_ACTIONS: ModuleAction[] = [
  "add", "edit", "delete", "cancel", "convert", "reset",
];
const CRUD_ACTIONS: ModuleAction[] = [
  "add", "edit", "delete", "reset",
];
const CRUD_WITH_IMPORT_EXPORT_ACTIONS: ModuleAction[] = [
  "add", "edit", "delete", "import", "export", "reset",
];
const REPORT_ACTIONS: ModuleAction[] = ["exportexcel", "exportcsv", "exportpdf"];

export interface ModuleDef {
  id: string;          // permission key
  label: string;       // user-facing label
  section: ModuleSection;
  actions: ModuleAction[];
  // Whether this module appears as a checkable item in the
  // admin register's Allowed Modules list. Some keys (like report
  // sub-modules) are admin-relevant; others are branch/staff only.
  inAdminRegister: boolean;
}

export type ModuleSection =
  | "master"
  | "accounts"
  | "sales"
  | "pos"
  | "purchase"
  | "inventory"
  | "distribution"
  | "pricing"
  | "accounting"
  | "manufacturing"
  | "hr"
  | "reports"
  | "system";

export const MODULES: ModuleDef[] = [
  // ───────────── Master / Setup ─────────────
  { id: "categories",     label: "Categories",      section: "master", actions: CRUD_ACTIONS, inAdminRegister: true },
  { id: "subcategories",  label: "Sub Categories",  section: "master", actions: CRUD_ACTIONS, inAdminRegister: true },
  { id: "brands",         label: "Brands",          section: "master", actions: CRUD_ACTIONS, inAdminRegister: true },
  { id: "models",         label: "Models",          section: "master", actions: CRUD_ACTIONS, inAdminRegister: true },
  { id: "productgroups",  label: "Product Groups",  section: "master", actions: CRUD_ACTIONS, inAdminRegister: true },
  { id: "sizes",          label: "Sizes",           section: "master", actions: CRUD_ACTIONS, inAdminRegister: true },
  { id: "units",          label: "Units",           section: "master", actions: CRUD_ACTIONS, inAdminRegister: true },
  { id: "products",       label: "Products",        section: "master", actions: CRUD_WITH_IMPORT_EXPORT_ACTIONS, inAdminRegister: true },

  // ───────────── Accounts ─────────────
  { id: "accountgroups",  label: "Account Groups",  section: "accounts", actions: CRUD_ACTIONS, inAdminRegister: true },
  { id: "accountledgers", label: "Account Ledgers", section: "accounts", actions: CRUD_ACTIONS, inAdminRegister: true },
  { id: "staffaccounts",  label: "Staff Accounts",  section: "accounts", actions: CRUD_ACTIONS, inAdminRegister: true },
  { id: "accounts",       label: "Party Accounts",  section: "accounts", actions: CRUD_WITH_IMPORT_EXPORT_ACTIONS, inAdminRegister: true },

  // ───────────── Sales pipeline ─────────────
  { id: "salesorder",     label: "Sales Orders",    section: "sales", actions: ORDER_ACTIONS, inAdminRegister: true },
  { id: "salesinvoice",   label: "Sales Invoices",  section: "sales", actions: FULL_TXN_ACTIONS, inAdminRegister: true },
  { id: "salesreturn",    label: "Sales Returns",   section: "sales", actions: FULL_TXN_ACTIONS, inAdminRegister: true },

  // ───────────── Point of Sale ─────────────
  { id: "posdashboard",   label: "POS Dashboard",   section: "pos", actions: ["view"], inAdminRegister: true },

  // ───────────── Purchase pipeline ─────────────
  { id: "purchaseorder",   label: "Purchase Orders",   section: "purchase", actions: ORDER_ACTIONS, inAdminRegister: true },
  { id: "purchaseinvoice", label: "Purchase Invoices", section: "purchase", actions: FULL_TXN_ACTIONS, inAdminRegister: true },
  { id: "purchasereturn",  label: "Purchase Returns",  section: "purchase", actions: FULL_TXN_ACTIONS, inAdminRegister: true },

  // ───────────── Inventory operations ─────────────
  { id: "transferstock",     label: "Transfer Stock",     section: "inventory", actions: CRUD_ACTIONS, inAdminRegister: true },
  { id: "stockadjustments",  label: "Stock Adjustments",  section: "inventory", actions: CRUD_ACTIONS, inAdminRegister: true },

  // ───────────── Distribution ─────────────
  { id: "channels",       label: "Channels",        section: "distribution", actions: CRUD_ACTIONS, inAdminRegister: true },
  { id: "salesroutes",    label: "Sales Routes",    section: "distribution", actions: CRUD_ACTIONS, inAdminRegister: true },

  // ───────────── Pricing ─────────────
  { id: "pricelists",       label: "Price Lists",        section: "pricing", actions: CRUD_ACTIONS, inAdminRegister: true },
  { id: "priceassignments", label: "Price Assignments",  section: "pricing", actions: CRUD_ACTIONS, inAdminRegister: true },
  { id: "chargerules",      label: "Charge Rules",       section: "pricing", actions: CRUD_ACTIONS, inAdminRegister: true },

  // ───────────── Accounting / cross-cutting ─────────────
  { id: "transactions",  label: "Transactions",  section: "accounting", actions: CRUD_ACTIONS, inAdminRegister: true },
  { id: "payments",      label: "Payments",      section: "accounting", actions: CRUD_ACTIONS, inAdminRegister: true },
  { id: "expensenote",   label: "Expense Notes", section: "accounting", actions: CRUD_ACTIONS, inAdminRegister: true },

  // ───────────── HR & Staff ─────────────
  { id: "attendance",    label: "Attendance & Leave", section: "hr", actions: CRUD_ACTIONS, inAdminRegister: true },

  // ───────────── Manufacturing (BOM / Production) ─────────────
  { id: "bom",         label: "Bill of Materials", section: "manufacturing", actions: CRUD_ACTIONS, inAdminRegister: true },
  { id: "production",  label: "Production",         section: "manufacturing", actions: CRUD_ACTIONS, inAdminRegister: true },

  // ───────────── Reports — sub-divided so each can be granted/denied ─────────────
  { id: "reports.sales",      label: "Sales Reports",       section: "reports", actions: REPORT_ACTIONS, inAdminRegister: true },
  { id: "reports.purchase",   label: "Purchase Reports",    section: "reports", actions: REPORT_ACTIONS, inAdminRegister: true },
  { id: "reports.stock",      label: "Stock Reports",       section: "reports", actions: REPORT_ACTIONS, inAdminRegister: true },
  { id: "reports.gst",        label: "GST Reports",         section: "reports", actions: REPORT_ACTIONS, inAdminRegister: true },
  { id: "reports.accounting", label: "Accounting / Finance", section: "reports", actions: REPORT_ACTIONS, inAdminRegister: true },
  { id: "reports.party",      label: "Party / Vendor Reports", section: "reports", actions: REPORT_ACTIONS, inAdminRegister: true },
  { id: "reports.salesmen",   label: "Salesmen Reports",    section: "reports", actions: REPORT_ACTIONS, inAdminRegister: true },
  { id: "reports.salesmanfield", label: "Salesman Field Report", section: "reports", actions: REPORT_ACTIONS, inAdminRegister: true },
  { id: "reports.delivery",   label: "Delivery Boy Report",  section: "reports", actions: REPORT_ACTIONS, inAdminRegister: true },
  { id: "reports.analytical", label: "Analytical Reports",  section: "reports", actions: REPORT_ACTIONS, inAdminRegister: true },
  { id: "reports.attendance", label: "Attendance & Leave Reports", section: "reports", actions: REPORT_ACTIONS, inAdminRegister: true },

  // ───────────── System (always granted, never gated by allowedmodules) ─────────────
  { id: "branches",      label: "Branches",        section: "system", actions: CRUD_ACTIONS, inAdminRegister: false },
  { id: "settings",      label: "Settings",        section: "system", actions: ["edit"], inAdminRegister: false },
  { id: "permissions",   label: "Permissions",     section: "system", actions: ["edit"], inAdminRegister: false },
];

export const SECTION_LABELS: Record<ModuleSection, string> = {
  master: "Master Setup",
  accounts: "Accounts",
  sales: "Sales",
  pos: "Point of Sale",
  purchase: "Purchase",
  inventory: "Inventory",
  distribution: "Distribution",
  pricing: "Pricing",
  accounting: "Accounting",
  manufacturing: "Manufacturing",
  hr: "HR & Staff",
  reports: "Reports",
  system: "System",
};

export const findModule = (id: string) => MODULES.find((m) => m.id === id);

// Newly-added "core" modules that should be visible by default even for
// tenants whose allowedmodules array was saved before the module existed.
// They bypass the business-level allowedmodules gate (so they show up in the
// sidebar, the Business Modules checklist and the Permissions matrix), while
// still honoring branch/staff-level restrictions and per-action permissions.
export const DEFAULT_ON_MODULE_IDS: string[] = ["branches"];

export const ADMIN_REGISTER_MODULES = MODULES.filter((m) => m.inAdminRegister);
export const MODULES_BY_SECTION = (() => {
  const map: Record<ModuleSection, ModuleDef[]> = {
    master: [], accounts: [], sales: [], pos: [], purchase: [], inventory: [], distribution: [], pricing: [],
    accounting: [], manufacturing: [], hr: [], reports: [], system: [],
  };
  MODULES.forEach((m) => map[m.section].push(m));
  return map;
})();
