import { ADMIN_REGISTER_MODULES, DEFAULT_ON_MODULE_IDS } from "./modules";

// Business profiles: one-click module presets. Applying one only turns modules ON, never off.
export type BusinessProfile = { id: string; label: string; types: string[]; modules: string[]; note: string };

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
    id: "trader", label: "Trader / Wholesaler / Distributor", types: ["trader", "wholesale"],
    note: "Orders, challans, channels, price lists, routes and field staff.",
    modules: [...CORE, ...GST_DOCS, "salesorder", "purchaseorder", "deliverychallan", "channels", "salesroutes",
      "pricelists", "priceassignments", "chargerules", "productgroups", "models", "sizes", "announcements",
      "reports.salesmen", "reports.salesmanfield", "reports.delivery", "reports.deliverychallan"],
  },
  {
    id: "manufacturer", label: "Manufacturer", types: ["manufacturer"],
    note: "BOM, work orders, production, quotations and CRM.",
    modules: [...CORE, ...GST_DOCS, ...CRM, "salesorder", "purchaseorder", "deliverychallan", "bom", "workorders",
      "production", "materialplanning", "reports.production", "pricelists", "priceassignments", "productgroups",
      "reports.deliverychallan"],
  },
  {
    id: "retail", label: "Retail / Shop", types: ["retail"],
    note: "POS billing, sizes and models, charge rules.",
    modules: [...CORE, "posdashboard", "sizes", "models", "productgroups", "pricelists", "chargerules", "reports.analytical"],
  },
  {
    id: "service", label: "Service (Repair / Clinic / Salon)", types: ["service"],
    note: "Services, appointments, job cards, AMC and memberships.",
    modules: [...CORE, ...CRM, "services", "appointments", "jobcards", "contracts", "memberships", "reports.service"],
  },
];

const known = new Set(ADMIN_REGISTER_MODULES.map((m) => m.id));

/** Module ids a profile turns on (only ids the register knows, plus default-on modules). */
export const profileModules = (p: BusinessProfile): string[] =>
  Array.from(new Set([...p.modules, ...DEFAULT_ON_MODULE_IDS])).filter((id) => known.has(id) || DEFAULT_ON_MODULE_IDS.includes(id));

export const profileForType = (type: string): BusinessProfile | undefined =>
  BUSINESS_PROFILES.find((p) => p.types.includes(String(type || "").toLowerCase()));
