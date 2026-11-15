// Where each Business Settings section lives, and the words people search for. Data stays in AdminSettings.
export type SettingsTab = "general" | "modules" | "permissions" | "formpermissions" | "print" | "ai" | "leadsources";

export type SettingsEntry = { label: string; tab: SettingsTab; section: string; words?: string };

export const SETTINGS_TABS: Array<[SettingsTab, string]> = [
  ["general", "General"],
  ["modules", "Business Modules"],
  ["permissions", "Business Permissions"],
  ["formpermissions", "Business Form Permissions"],
  ["print", "Print & Formats"],
  ["ai", "AI & Agent"],
  ["leadsources", "Lead Sources"],
];

// Section title → its tab. Sections not listed stay on General.
// Business Modules sections carry the switches of their modules (see MODULE_SWITCHES).
export const SECTION_HOME: Record<string, SettingsTab> = {
  "Sales": "modules",
  "Accounts": "modules",
  "Distribution": "modules",
  "Accounting": "modules",
  "HR & Staff": "modules",
  "Service": "modules",
  "AI Assistant": "ai",
  "Quotation Format": "print",
  "Invoice Print": "print",
  "Form Extras": "formpermissions",
};

export const sectionId = (title: string) => "set-" + title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const S = (label: string, section: string, words = ""): SettingsEntry => ({ label, section, words, tab: SECTION_HOME[section] || "general" });

export const SETTINGS_INDEX: SettingsEntry[] = [
  S("Auto-deduct / add stock on bills", "Stock & Inventory", "stock invoice purchase return auto"),
  S("Allow negative stock", "Stock & Inventory", "negative minus stock"),
  S("Restrict order qty by stock", "Stock & Inventory", "cart limit stock"),
  S("Show stock on App / Website", "Stock & Inventory", "display stock"),
  S("GST tracking", "Orders & Pricing", "gst tax"),
  S("Show prices on App / Website", "Orders & Pricing", "price display website app"),
  S("Price-list discount, salesman extra discount, delivery boy", "Sales", "price list discount salesman delivery boy order"),
  S("Party manages downline, party stock", "Accounts", "party downline sub party stock channel"),
  S("Discount & commission on payment, last payment", "Accounting", "payment discount commission outstanding last"),
  S("Payments & accounts", "Payments & Accounts", "invoice delete inside"),
  S("App & website display", "App & Website Display", "app website display catalogue"),
  S("Leaderboard, geo-fencing", "Distribution", "salesman leaderboard geo fence route"),
  S("Selfie on punch in, auto punch-out", "HR & Staff", "selfie punch attendance auto"),
  S("Login & signup", "Login & Signup", "login otp signup register"),
  S("Online booking", "Service", "booking appointment slot website app"),
  S("GST profile (e-Invoice / e-Way Bill)", "GST Profile (e-Invoice / e-Way Bill)", "gstin einvoice ewaybill state igst"),
  S("CRM stages, sources, lost reasons", "CRM (Leads)", "crm lead stage source lost reason"),
  S("Website storefront & checkout", "Website Storefront", "website store slug domain checkout payment cod"),
  S("Email (SMTP) for OTP mails", "Email (SMTP) — OTP mails from your own email", "email smtp mail otp"),
  S("Screen capture protection", "Screen Capture Protection", "screen capture watermark record"),
  S("AI assistant, key, model, monthly cap", "AI Assistant", "ai gemini key model cap agent chat"),
  S("Quotation format", "Quotation Format", "quotation quote format terms heading colour"),
  S("Invoice print options", "Invoice Print", "print invoice header terms hsn gst column signature"),
  S("Extra fields (product / lead)", "Form Extras", "custom extra field product lead"),
  S("Spec fields per category", "Form Extras", "spec specification category size grade"),
  S("Extra product fields (MOQ, warranty, documents)", "Form Extras", "moq warranty alternate spare documents extras"),
];

export const searchSettings = (q: string): SettingsEntry[] => {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return SETTINGS_INDEX.filter((e) => {
    const hay = `${e.label} ${e.section} ${e.words}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  }).slice(0, 8);
};

// Feature switches shown under their module on Business Modules (saved in AdminSettings as before).
export type ModuleSwitch = {
  module: string; key: string; label: string; hint?: string;
  value: (s: any) => boolean; patch: (v: boolean) => Record<string, any>;
  /** Shown only while this is true (e.g. sub-switch of Party manages downline). */
  when?: (s: any) => boolean;
};
const flag = (module: string, key: string, label: string, hint = "", defaultOn = false, when?: (s: any) => boolean): ModuleSwitch => ({
  module, key, label, hint, when,
  value: (s) => (defaultOn ? s?.[key] !== false : !!s?.[key]),
  patch: (v) => ({ [key]: v }),
});

export const MODULE_SWITCHES: ModuleSwitch[] = [
  flag("appointments", "onlineBookingAllowed", "Online Booking", "Customers book a service slot from the App & Website. The owner sets hours in Settings → General."),
  flag("salesorder", "salesmanPriceListDiscount", "Price-list discount on salesman orders", "On: orders a salesman / staff takes get the party's price-list discount. Off: only the party's own App / Website orders get it.", true),
  flag("salesorder", "salesmanOrderDiscountEnabled", "Salesman extra discount on order", "The salesman app cart shows an Extra discount (₹ or %) on the whole order."),
  {
    module: "salesorder", key: "deliveryMode", label: "Deliver via Delivery Boy", hint: "Off: the salesman delivers on his route.",
    value: (s) => s?.deliveryMode === "deliveryboy", patch: (v) => ({ deliveryMode: v ? "deliveryboy" : "salesman" }),
  },
  flag("accounts", "partyManagesDownline", "Party manages downline", "A channel party handles its sub-parties' orders and payments."),
  flag("accounts", "directPartyOrdersOnly", "Company sees direct-party orders only", "Sales Orders shows only orders of your direct parties; sub-party orders are handled by their parent party.", false, (s) => !!s?.partyManagesDownline),
  flag("accounts", "trackPartyStock", "Track party stock", "Each party gets its own stock, moved by invoices to it and by its own conversions.", false, (s) => !!s?.partyManagesDownline),
  flag("payments", "enablePaymentDiscountCommission", "Discount & Commission on payment", "Enter a discount / commission per invoice while collecting a payment."),
  flag("payments", "showLastPaymentOnStatement", "Last payment on Outstanding reports", "Adds last payment date, amount and days ago to Customer / Vendor Outstanding."),
  flag("salesroutes", "salesmanLeaderboardEnabled", "Team Leaderboard (salesman app)", "Salesmen see each other's target, sales and rank.", true),
  flag("salesroutes", "geoFenceEnabled", "Geo-fencing for salesmen", "Orders / no-order calls only within the set distance of the party's saved location."),
  flag("attendance", "attendanceSelfieRequired", "Selfie on Punch In", "Punch In from the app needs a front-camera selfie."),
  flag("attendance", "autoPunchOutEnabled", "Auto punch-out", "Anyone still punched in at this time is punched out automatically.", true),
];
