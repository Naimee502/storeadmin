import { ADMIN_REGISTER_MODULES, DEFAULT_ON_MODULE_IDS } from "./modules";

// Business types, one list for Admin Register, the admin edit form and Business Settings.
// Each type is also a one-click module preset; applying one only turns modules ON, never off.
// `id` is the value saved as Admin.businesstype; `types` also matches values saved earlier.
export type BusinessProfile = { id: string; label: string; group: string; types: string[]; modules: string[]; note: string };

const CORE = [
  "categories", "subcategories", "brands", "units", "products",
  "accountgroups", "accountledgers", "staffaccounts", "accounts",
  "salesinvoice", "salesreturn", "purchaseinvoice", "purchasereturn",
  "stockadjustments", "transferstock", "payments", "transactions", "expensenote", "attendance",
  "reports.pulse", "reports.sales", "reports.purchase", "reports.stock", "reports.product",
  "reports.gst", "reports.accounting", "reports.party", "reports.attendance",
];
const GST_DOCS = ["einvoice", "ewaybill", "reports.einvoice", "reports.ewaybill"];
const CRM = ["crmdashboard", "leads", "followups", "leadsources", "quotations", "reports.crm", "reports.quotation"];

export const BUSINESS_PROFILES: BusinessProfile[] = [
  {
    id: "retail", label: "Retail Shop", group: "Trading", types: ["retail"],
    note: "POS billing, sizes and models, charge rules.",
    modules: [...CORE, "posdashboard", "sizes", "models", "productgroups", "pricelists", "chargerules", "reports.analytical"],
  },
  {
    id: "wholesale", label: "Wholesale / Distributor", group: "Trading", types: ["wholesale", "trader"],
    note: "Orders, challans, channels, price lists, routes and field staff.",
    modules: [...CORE, ...GST_DOCS, "salesorder", "purchaseorder", "deliverychallan", "channels", "salesroutes",
      "pricelists", "priceassignments", "chargerules", "productgroups", "models", "sizes", "announcements",
      "reports.salesmen", "reports.salesmanfield", "reports.delivery", "reports.deliverychallan"],
  },
  {
    id: "exporter", label: "Exporter", group: "Trading", types: ["exporter"],
    note: "Quotations, orders, challans, e-Invoice and e-Way Bill, price lists and CRM.",
    modules: [...CORE, ...GST_DOCS, ...CRM, "salesorder", "purchaseorder", "deliverychallan", "pricelists",
      "priceassignments", "productgroups", "reports.deliverychallan"],
  },
  {
    id: "manufacturer", label: "Manufacturer", group: "Manufacturing", types: ["manufacturer"],
    note: "BOM, work orders, production, quotations and CRM.",
    modules: [...CORE, ...GST_DOCS, ...CRM, "salesorder", "purchaseorder", "deliverychallan", "bom", "workorders",
      "production", "materialplanning", "reports.production", "pricelists", "priceassignments", "productgroups",
      "reports.deliverychallan"],
  },
  {
    id: "pharma", label: "Pharma / Food (batch and expiry)", group: "Industry", types: ["pharma"],
    note: "Counter billing, orders and challans; batch and expiry on items.",
    modules: [...CORE, ...GST_DOCS, "posdashboard", "salesorder", "purchaseorder", "deliverychallan", "pricelists",
      "priceassignments", "chargerules", "productgroups", "reports.analytical", "reports.deliverychallan"],
  },
  {
    id: "hardware", label: "Hardware / Building Material", group: "Industry", types: ["hardware"],
    note: "Counter billing, quotations, orders and challans, sizes and models.",
    modules: [...CORE, ...GST_DOCS, "posdashboard", "quotations", "reports.quotation", "salesorder", "purchaseorder",
      "deliverychallan", "sizes", "models", "productgroups", "pricelists", "priceassignments", "reports.deliverychallan"],
  },
  {
    id: "repair", label: "Repair / Service Centre", group: "Services", types: ["repair"],
    note: "Job cards, AMC contracts, spare parts billing, support tickets and CRM.",
    modules: [...CORE, ...CRM, "services", "jobcards", "contracts", "reports.service", "supporttickets"],
  },
  {
    id: "clinic", label: "Clinic / Salon / Spa", group: "Services", types: ["clinic"],
    note: "Appointments, services and memberships.",
    modules: [...CORE, "services", "appointments", "memberships", "leads", "followups", "reports.service", "reports.crm"],
  },
  {
    id: "service", label: "Other Services", group: "Services", types: ["service"],
    note: "Services, appointments, job cards, AMC, memberships and support tickets.",
    modules: [...CORE, ...CRM, "services", "appointments", "jobcards", "contracts", "memberships", "reports.service", "supporttickets"],
  },
  {
    id: "other", label: "Other (choose modules yourself)", group: "Other", types: ["other"],
    note: "Starts with billing, stock, accounts and reports; tick any other module you need.",
    modules: [...CORE],
  },
];

/** Options for every Business Type dropdown. */
export const BUSINESS_TYPE_OPTIONS = BUSINESS_PROFILES.map((p) => ({ value: p.id, label: p.label }));

const known = new Set(ADMIN_REGISTER_MODULES.map((m) => m.id));

/** Module ids a profile turns on (only ids the register knows, plus default-on modules). */
export const profileModules = (p: BusinessProfile): string[] =>
  Array.from(new Set([...p.modules, ...DEFAULT_ON_MODULE_IDS])).filter((id) => known.has(id) || DEFAULT_ON_MODULE_IDS.includes(id));

export const profileForType = (type: string): BusinessProfile | undefined =>
  BUSINESS_PROFILES.find((p) => p.types.includes(String(type || "").toLowerCase()));

/** The list value for a saved type (older "trader" shows as Wholesale / Distributor). */
export const businessTypeValue = (type: string) => profileForType(type)?.id || String(type || "");

/** Display label for a saved type. */
export const businessTypeLabel = (type: string) =>
  profileForType(type)?.label || (type ? type[0].toUpperCase() + type.slice(1) : "-");
