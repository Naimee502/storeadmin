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
export const SECTION_HOME: Record<string, SettingsTab> = {
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
  S("Price-list discount on salesman orders", "Orders & Pricing", "price list discount salesman"),
  S("Payments & accounts", "Payments & Accounts", "payment advance outstanding reminder"),
  S("App & website display", "App & Website Display", "app website display catalogue"),
  S("Salesman & staff rules", "Salesman & Staff", "salesman staff geo fence selfie punch attendance delivery boy"),
  S("Login & signup", "Login & Signup", "login otp signup register"),
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
