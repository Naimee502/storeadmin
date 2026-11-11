// Single source of truth for module ids, labels and actions; missing keys deny by default.

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
  | "rearrange"
  | "reset"
  | "clear"
  // Expense Notes only: field staff can file Expense Claims (app) and the
  // Expense Claims tab shows. Off for businesses that do not reimburse staff.
  | "claims";

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
  rearrange: "Rearrange",
  reset: "Reset",
  clear: "Clear",
  claims: "Claims",
};

// Default action sets per module category.
const FULL_TXN_ACTIONS: ModuleAction[] = [
  "add", "edit", "delete", "print", "return", "whatsapp", "reset",
];
// Orders get print + whatsapp (they are the bill without invoicing); returns get no "return".
const RETURN_TXN_ACTIONS: ModuleAction[] = FULL_TXN_ACTIONS.filter((a) => a !== "return");
const ORDER_ACTIONS: ModuleAction[] = [
  "add", "edit", "delete", "print", "whatsapp", "cancel", "convert", "reset",
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
  // Whether this module shows in the admin register's Allowed Modules list.
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
  | "service"
  | "crm"
  | "hr"
  | "communication"
  | "reports"
  | "system";

const MODULE_LIST: ModuleDef[] = [
  // Master / Setup ("rearrange" = category order on app and website)
  { id: "categories",     label: "Categories",      section: "master", actions: [...CRUD_ACTIONS, "rearrange"], inAdminRegister: true },
  // "rearrange" = sub-category order inside each category.
  { id: "subcategories",  label: "Sub Categories",  section: "master", actions: [...CRUD_ACTIONS, "rearrange"], inAdminRegister: true },
  { id: "brands",         label: "Brands",          section: "master", actions: CRUD_ACTIONS, inAdminRegister: true },
  { id: "models",         label: "Models",          section: "master", actions: CRUD_ACTIONS, inAdminRegister: true },
  { id: "productgroups",  label: "Product Groups",  section: "master", actions: CRUD_ACTIONS, inAdminRegister: true },
  { id: "sizes",          label: "Sizes",           section: "master", actions: CRUD_ACTIONS, inAdminRegister: true },
  { id: "units",          label: "Units",           section: "master", actions: CRUD_ACTIONS, inAdminRegister: true },
  { id: "products",       label: "Products",        section: "master", actions: CRUD_WITH_IMPORT_EXPORT_ACTIONS, inAdminRegister: true },

  // Accounts
  { id: "accountgroups",  label: "Account Groups",  section: "accounts", actions: CRUD_ACTIONS, inAdminRegister: true },
  { id: "accountledgers", label: "Account Ledgers", section: "accounts", actions: CRUD_ACTIONS, inAdminRegister: true },
  // "view" = the View button on the list; off until ticked.
  { id: "staffaccounts",  label: "Staff Accounts",  section: "accounts", actions: ["view", ...CRUD_ACTIONS], inAdminRegister: true },
  { id: "accounts",       label: "Party Accounts",  section: "accounts", actions: ["view", ...CRUD_WITH_IMPORT_EXPORT_ACTIONS], inAdminRegister: true },

  // Sales pipeline
  { id: "salesorder",     label: "Sales Orders",    section: "sales", actions: ORDER_ACTIONS, inAdminRegister: true },
  { id: "salesinvoice",   label: "Sales Invoices",  section: "sales", actions: FULL_TXN_ACTIONS, inAdminRegister: true },
  { id: "salesreturn",    label: "Sales Returns",   section: "sales", actions: RETURN_TXN_ACTIONS, inAdminRegister: true },
  // Goods sent with a challan (Rule 55); "convert" makes the invoice from it.
  { id: "deliverychallan", label: "Delivery Challans", section: "sales", actions: ["add", "edit", "delete", "print", "convert", "reset"], inAdminRegister: true },

  // Point of Sale
  { id: "posdashboard",   label: "POS Dashboard",   section: "pos", actions: ["view"], inAdminRegister: true },

  // Purchase pipeline
  { id: "purchaseorder",   label: "Purchase Orders",   section: "purchase", actions: ORDER_ACTIONS, inAdminRegister: true },
  { id: "purchaseinvoice", label: "Purchase Invoices", section: "purchase", actions: FULL_TXN_ACTIONS, inAdminRegister: true },
  { id: "purchasereturn",  label: "Purchase Returns",  section: "purchase", actions: RETURN_TXN_ACTIONS, inAdminRegister: true },

  // Inventory operations
  { id: "transferstock",     label: "Transfer Stock",     section: "inventory", actions: CRUD_ACTIONS, inAdminRegister: true },
  { id: "stockadjustments",  label: "Stock Adjustments",  section: "inventory", actions: CRUD_ACTIONS, inAdminRegister: true },

  // Distribution
  { id: "channels",       label: "Channels",        section: "distribution", actions: CRUD_ACTIONS, inAdminRegister: true },
  { id: "salesroutes",    label: "Sales Routes",    section: "distribution", actions: CRUD_ACTIONS, inAdminRegister: true },

  // Pricing
  { id: "pricelists",       label: "Price Lists",        section: "pricing", actions: CRUD_ACTIONS, inAdminRegister: true },
  { id: "priceassignments", label: "Price Assignments",  section: "pricing", actions: CRUD_ACTIONS, inAdminRegister: true },
  { id: "chargerules",      label: "Charge Rules",       section: "pricing", actions: CRUD_ACTIONS, inAdminRegister: true },

  // Accounting / cross-cutting
  { id: "transactions",  label: "Transactions",  section: "accounting", actions: CRUD_ACTIONS, inAdminRegister: true },
  { id: "payments",      label: "Payments",      section: "accounting", actions: CRUD_ACTIONS, inAdminRegister: true },
  // GST portal work: e-Invoice (IRN, QR; turnover above Rs 5 crore) and e-Way Bill (goods above Rs 50,000).
  // Add = make the JSON and save the portal's number the first time; Edit = change saved details or cancel the IRN.
  { id: "einvoice",      label: "e-Invoice",     section: "accounting", actions: ["add", "edit"], inAdminRegister: true },
  { id: "ewaybill",      label: "e-Way Bill",    section: "accounting", actions: ["add", "edit"], inAdminRegister: true },
  { id: "expensenote",   label: "Expense Notes", section: "accounting", actions: [...CRUD_ACTIONS, "claims"], inAdminRegister: true },

  // HR & Staff
  { id: "attendance",    label: "Attendance & Leave", section: "hr", actions: CRUD_ACTIONS, inAdminRegister: true },

  // Communication (opt-in, not default-on)
  { id: "announcements", label: "Announcements", section: "communication", actions: CRUD_ACTIONS, inAdminRegister: true },

  // CRM. Leads "view" = see every lead; without it staff see only their own.
  // AI assistant and the daily "who to contact" list.
  { id: "crmdashboard", label: "CRM Dashboard", section: "crm", actions: ["view"], inAdminRegister: true },
  { id: "leads",       label: "Leads",       section: "crm", actions: ["view", "add", "edit", "delete", "convert", "import", "export", "reset"], inAdminRegister: true },
  { id: "followups",   label: "Follow Ups",  section: "crm", actions: CRUD_ACTIONS, inAdminRegister: true },
  // Portal keys and webhook links (IndiaMART, JustDial, Meta, WhatsApp, website).
  { id: "leadsources", label: "Lead Sources", section: "crm", actions: ["edit"], inAdminRegister: true },
  // "convert" = make a Sales Order from an accepted quotation.
  { id: "quotations",  label: "Quotations",  section: "crm", actions: ["add", "edit", "delete", "print", "whatsapp", "convert", "reset"], inAdminRegister: true },

  // Manufacturing (BOM / Production)
  { id: "bom",         label: "Bill of Materials", section: "manufacturing", actions: CRUD_ACTIONS, inAdminRegister: true },
  { id: "workorders",  label: "Work Orders",        section: "manufacturing", actions: CRUD_ACTIONS, inAdminRegister: true },
  { id: "production",  label: "Production",         section: "manufacturing", actions: CRUD_ACTIONS, inAdminRegister: true },
  // Raw material still needed for open work orders (view + export).
  { id: "materialplanning", label: "Material Planning", section: "manufacturing", actions: REPORT_ACTIONS, inAdminRegister: true },

  // Service (salon, clinic, repair centre, AMC)
  { id: "services",     label: "Services",       section: "service", actions: CRUD_ACTIONS, inAdminRegister: true },
  { id: "appointments", label: "Appointments",   section: "service", actions: [...CRUD_ACTIONS, "convert"], inAdminRegister: true },
  // "convert" = make a Sales Invoice from a job card.
  { id: "jobcards",     label: "Job Cards",      section: "service", actions: [...CRUD_ACTIONS, "print", "convert"], inAdminRegister: true },
  { id: "contracts",    label: "AMC / Warranty", section: "service", actions: CRUD_ACTIONS, inAdminRegister: true },
  { id: "memberships",  label: "Memberships",    section: "service", actions: CRUD_ACTIONS, inAdminRegister: true },

  // Reports — sub-divided so each can be granted/denied
  { id: "reports.sales",      label: "Sales Reports",       section: "reports", actions: REPORT_ACTIONS, inAdminRegister: true },
  { id: "reports.purchase",   label: "Purchase Reports",    section: "reports", actions: REPORT_ACTIONS, inAdminRegister: true },
  { id: "reports.stock",      label: "Stock Reports",       section: "reports", actions: REPORT_ACTIONS, inAdminRegister: true },
  { id: "reports.gst",        label: "GST Reports",         section: "reports", actions: REPORT_ACTIONS, inAdminRegister: true },
  { id: "reports.product",    label: "Product Statement", section: "reports", actions: REPORT_ACTIONS, inAdminRegister: true },
  { id: "reports.accounting", label: "Accounting / Finance", section: "reports", actions: REPORT_ACTIONS, inAdminRegister: true },
  { id: "reports.party",      label: "Party / Vendor Reports", section: "reports", actions: REPORT_ACTIONS, inAdminRegister: true },
  { id: "reports.salesmen",   label: "Salesmen Reports",    section: "reports", actions: REPORT_ACTIONS, inAdminRegister: true },
  { id: "reports.salesmanfield", label: "Salesman Field Report", section: "reports", actions: REPORT_ACTIONS, inAdminRegister: true },
  { id: "reports.delivery",   label: "Delivery Boy Report",  section: "reports", actions: REPORT_ACTIONS, inAdminRegister: true },
  { id: "reports.analytical", label: "Analytical Reports",  section: "reports", actions: REPORT_ACTIONS, inAdminRegister: true },
  { id: "reports.attendance", label: "Attendance & Leave Reports", section: "reports", actions: REPORT_ACTIONS, inAdminRegister: true },
  { id: "reports.deliverychallan", label: "Delivery Challan Reports", section: "reports", actions: REPORT_ACTIONS, inAdminRegister: true },
  { id: "reports.einvoice",   label: "e-Invoice Reports",   section: "reports", actions: REPORT_ACTIONS, inAdminRegister: true },
  { id: "reports.ewaybill",   label: "e-Way Bill Reports",  section: "reports", actions: REPORT_ACTIONS, inAdminRegister: true },
  { id: "reports.crm",        label: "CRM Reports",         section: "reports", actions: REPORT_ACTIONS, inAdminRegister: true },
  { id: "reports.quotation",  label: "Quotation Reports",   section: "reports", actions: REPORT_ACTIONS, inAdminRegister: true },
  { id: "reports.production", label: "Production Reports",  section: "reports", actions: REPORT_ACTIONS, inAdminRegister: true },
  { id: "reports.service",    label: "Service Reports",     section: "reports", actions: REPORT_ACTIONS, inAdminRegister: true },

  // System (always granted, never gated by allowedmodules)
  { id: "branches",      label: "Branches",        section: "system", actions: CRUD_ACTIONS, inAdminRegister: false },
  { id: "settings",      label: "Settings",        section: "system", actions: ["edit"], inAdminRegister: false },
  { id: "permissions",   label: "Permissions",     section: "system", actions: ["edit"], inAdminRegister: false },
];

// "Clear" hides a deleted entry for good (kept in the database).
const CLEARABLE_MODULE_IDS = [
  "categories", "subcategories", "brands", "models", "productgroups", "sizes", "units",
  "products", "accountgroups", "accountledgers", "staffaccounts", "accounts", "branches",
  "salesorder", "salesinvoice", "salesreturn", "deliverychallan", "purchaseorder", "purchaseinvoice", "purchasereturn",
  "transferstock", "stockadjustments", "channels", "salesroutes", "pricelists", "priceassignments",
  "chargerules", "transactions", "payments", "expensenote", "attendance", "announcements", "leads", "followups", "quotations", "bom", "workorders", "production",
  "appointments", "jobcards", "contracts", "memberships",
];

export const MODULES: ModuleDef[] = MODULE_LIST.map((m) =>
  CLEARABLE_MODULE_IDS.includes(m.id) && !m.actions.includes("clear")
    ? { ...m, actions: [...m.actions, "clear"] }
    : m
);

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
  service: "Service",
  crm: "CRM",
  hr: "HR & Staff",
  communication: "Communication",
  reports: "Reports",
  system: "System",
};

export const findModule = (id: string) => MODULES.find((m) => m.id === id);

// Core modules visible by default, even for tenants saved before they existed.
export const DEFAULT_ON_MODULE_IDS: string[] = ["branches"];

export const ADMIN_REGISTER_MODULES = MODULES.filter((m) => m.inAdminRegister);
export const MODULES_BY_SECTION = (() => {
  const map: Record<ModuleSection, ModuleDef[]> = {
    master: [], accounts: [], sales: [], pos: [], purchase: [], inventory: [], distribution: [], pricing: [],
    accounting: [], manufacturing: [], service: [], crm: [], hr: [], communication: [], reports: [], system: [],
  };
  MODULES.forEach((m) => map[m.section].push(m));
  return map;
})();
