import { ADMIN_REGISTER_MODULES, DEFAULT_ON_MODULE_IDS } from "./modules";

// Business types, one list for Admin Register, the admin edit form and Business Settings.
// Each type is also a one-click module preset; applying one only turns modules ON, never off.
// `id` is the value saved as Admin.businesstype; `types` also matches values saved earlier.
// `switches`: Business Settings switches the type also turns on (never off).
// `fields`: product / service form fields the type shows (true) or hides (false); others are left as they are.
// `kinds`: optional Business Kind under the type; it adds to the type's modules, switches, fields and starter masters.
export type FieldPreset = Record<string, Record<string, boolean>>;
/** Unit name and its GST unit code (UQC). */
export type StarterUnit = [string, string];
type Preset = { modules: string[]; note: string; switches?: Record<string, any>; fields?: FieldPreset; units?: StarterUnit[]; categories?: string[] };
export type BusinessKind = Preset & { id: string; label: string };
export type BusinessProfile = Preset & { id: string; label: string; group: string; types: string[]; kinds?: BusinessKind[] };

// Product master batch / expiry is a single value; trading types use Batch & Expiry stock instead (or none).
const NO_MASTER_BATCH = { batchnumber: false, manufacturedate: false, expirydate: false };

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

const U: Record<string, StarterUnit> = {
  pcs: ["Pcs", "PCS"], nos: ["Nos", "NOS"], kg: ["Kg", "KGS"], gm: ["Gram", "GMS"], ltr: ["Ltr", "LTR"], ml: ["Ml", "MLT"],
  box: ["Box", "BOX"], pack: ["Pack", "PAC"], doz: ["Dozen", "DOZ"], pair: ["Pair", "PRS"], set: ["Set", "SET"], mtr: ["Meter", "MTR"],
  sqft: ["Sq Ft", "SQF"], bag: ["Bag", "BAG"], ton: ["Ton", "TON"], qtl: ["Quintal", "QTL"], ctn: ["Carton", "CTN"], btl: ["Bottle", "BTL"],
  strip: ["Strip", "PAC"], roll: ["Roll", "ROL"], drum: ["Drum", "DRM"], plate: ["Plate", "NOS"],
};
const k = (id: string, label: string, note: string, rest: Partial<Preset> = {}): BusinessKind => ({ id, label, note, modules: [], ...rest });
const EXPIRY = { modules: ["batches"] };

const RETAIL_KINDS = [
  k("kirana", "Kirana / General Store", "Batch & expiry for packed goods, loose items in Kg / Ltr.", { ...EXPIRY,
    fields: { products: { sizeid: false, modelid: false } }, units: [U.pcs, U.kg, U.gm, U.ltr, U.ml, U.pack, U.box, U.doz],
    categories: ["Grocery", "Staples", "Snacks", "Beverages", "Personal Care", "Household"] }),
  k("clothes", "Clothes / Garments", "Sizes and brands on every item.", {
    fields: { products: { sizeid: true, brandid: true, modelid: false } }, units: [U.pcs, U.set, U.mtr],
    categories: ["Men", "Women", "Kids", "Accessories"] }),
  k("footwear", "Footwear", "Sizes and brands, sold by pair.", {
    fields: { products: { sizeid: true, brandid: true, modelid: false } }, units: [U.pair, U.pcs],
    categories: ["Men", "Women", "Kids", "Sports"] }),
  k("stationery", "Stationery / Books", "Simple items sold by piece, pack or box.", {
    fields: { products: { sizeid: false, modelid: false } }, units: [U.pcs, U.pack, U.box, U.doz],
    categories: ["Stationery", "Books", "Office Supplies", "School Supplies"] }),
  k("cosmetics", "Cosmetics / Beauty", "Batch & expiry on every item.", { ...EXPIRY,
    fields: { products: { sizeid: false, brandid: true } }, units: [U.pcs, U.ml, U.gm],
    categories: ["Skin Care", "Hair Care", "Makeup", "Fragrance"] }),
  k("gift", "Gift / Toys", "Items by piece or set.", {
    fields: { products: { sizeid: false } }, units: [U.pcs, U.set], categories: ["Toys", "Gifts", "Home Decor"] }),
  k("furniture", "Furniture / Home", "Models and sets, quotations for big orders.", { modules: ["quotations", "reports.quotation"],
    fields: { products: { modelid: true, sizeid: false } }, units: [U.pcs, U.set], categories: ["Living Room", "Bedroom", "Office", "Decor"] }),
];

const WHOLESALE_KINDS = [
  k("fmcg", "FMCG / Grocery Distributor", "Batch & expiry, cartons and boxes.", { ...EXPIRY,
    units: [U.pcs, U.box, U.ctn, U.kg, U.ltr], categories: ["Grocery", "Snacks", "Beverages", "Personal Care", "Household"] }),
  k("textile", "Textile / Garments Wholesale", "Sizes, sold by piece, set or meter.", {
    fields: { products: { sizeid: true, brandid: true } }, units: [U.pcs, U.set, U.mtr], categories: ["Fabric", "Men", "Women", "Kids"] }),
  k("electrical", "Electrical / Hardware Distributor", "Models, sold by piece, box, meter or roll.", {
    fields: { products: { modelid: true } }, units: [U.pcs, U.box, U.mtr, U.roll], categories: ["Wires & Cables", "Switches", "Lighting", "Fittings"] }),
  k("agri", "Grain / Agri Trader", "Sold by Kg, Quintal, Ton or bag.", {
    fields: { products: { sizeid: false, modelid: false } }, units: [U.kg, U.qtl, U.ton, U.bag], categories: ["Grains", "Pulses", "Spices", "Seeds"] }),
];

const MFG_KINDS = [
  k("food", "Food / Beverage", "Batch & expiry on finished goods.", { ...EXPIRY,
    units: [U.kg, U.gm, U.ltr, U.pcs, U.box, U.pack], categories: ["Raw Material", "Packing Material", "Finished Goods"] }),
  k("garments", "Garments / Textile", "Sizes on finished goods.", { modules: ["sizes"],
    fields: { products: { sizeid: true } }, units: [U.pcs, U.mtr, U.set, U.kg], categories: ["Fabric", "Trims", "Finished Goods"] }),
  k("engineering", "Engineering / Fabrication", "Models and serial numbers on machines.", { modules: ["serials", "models"],
    fields: { products: { modelid: true, isserialised: true } }, units: [U.pcs, U.nos, U.kg, U.set], categories: ["Raw Material", "Components", "Finished Goods"] }),
  k("chemical", "Chemical / Plastic / Paint", "Batch & expiry, sold by Kg, Ltr or drum.", { ...EXPIRY,
    units: [U.kg, U.ltr, U.ton, U.drum, U.bag], categories: ["Raw Material", "Packing Material", "Finished Goods"] }),
  k("furniture", "Furniture / Wood", "Models and sets.", { modules: ["models"],
    fields: { products: { modelid: true } }, units: [U.pcs, U.set, U.sqft], categories: ["Raw Material", "Hardware", "Finished Goods"] }),
];

const PHARMA_KINDS = [
  k("store", "Medical Store", "Counter billing with batch & expiry.", { units: [U.strip, U.btl, U.box, U.pcs], categories: ["Tablets", "Syrups", "Injections", "OTC", "Surgical"] }),
  k("distributor", "Pharma Distributor", "Routes, salesmen and party channels.", { modules: ["salesroutes", "channels", "reports.salesmen"],
    units: [U.strip, U.btl, U.box, U.ctn], categories: ["Tablets", "Syrups", "Injections", "OTC", "Surgical"] }),
];

const ELECTRONICS_KINDS = [
  k("mobile", "Mobile Shop", "IMEI on every phone, repair job cards.", { units: [U.pcs], categories: ["Mobiles", "Accessories", "Chargers & Cables", "Covers"] }),
  k("appliances", "Electronics / Appliances", "Serial numbers, warranty and AMC.", { units: [U.pcs], categories: ["TV", "Refrigerator", "Washing Machine", "AC", "Small Appliances"] }),
  k("computer", "Computer / Laptop", "Serial numbers, repair job cards.", { units: [U.pcs, U.nos], categories: ["Laptops", "Desktops", "Accessories", "Printers"] }),
];

const HARDWARE_KINDS = [
  k("hardware", "Hardware Store", "Sold by piece, Kg, box or meter.", { units: [U.pcs, U.kg, U.box, U.mtr], categories: ["Tools", "Fasteners", "Fittings", "Pipes"] }),
  k("tiles", "Tiles & Sanitary", "Sold by Sq Ft and box.", { units: [U.sqft, U.box, U.pcs], categories: ["Floor Tiles", "Wall Tiles", "Sanitary", "Fittings"] }),
  k("paint", "Paint", "Sold by Ltr, Kg or piece.", { units: [U.ltr, U.kg, U.pcs], categories: ["Interior", "Exterior", "Primer", "Tools"] }),
  k("plywood", "Plywood / Laminates", "Sold by Sq Ft and sheet.", { units: [U.sqft, U.pcs], categories: ["Plywood", "Laminates", "Boards", "Hardware"] }),
  k("electrical", "Electrical", "Sold by piece, meter, box or roll.", { units: [U.pcs, U.mtr, U.box, U.roll], categories: ["Wires & Cables", "Switches", "Lighting", "Fans"] }),
  k("building", "Cement / Steel / Building Material", "Sold by bag, Kg or ton.", { units: [U.bag, U.kg, U.ton], categories: ["Cement", "Steel", "Sand & Aggregate", "Bricks"] }),
];

const FOOD_KINDS = [
  k("restaurant", "Restaurant / Dhaba", "Counter billing by plate.", { units: [U.plate, U.pcs], categories: ["Starters", "Main Course", "Breads", "Beverages", "Desserts"] }),
  k("cafe", "Cafe / Fast Food", "Quick counter billing.", { units: [U.pcs, U.plate], categories: ["Coffee & Tea", "Snacks", "Burgers & Pizza", "Beverages"] }),
  k("bakery", "Bakery / Cake Shop", "Sold by piece, Kg or box; orders for cakes.", { units: [U.pcs, U.kg, U.box], categories: ["Cakes", "Breads", "Cookies", "Snacks"] }),
  k("sweets", "Sweet Shop", "Sold by Kg, Gram or box.", { units: [U.kg, U.gm, U.box, U.pcs], categories: ["Sweets", "Namkeen", "Dry Fruits"] }),
];

const DOCTOR_KINDS = [
  k("general", "General Physician", "Consultation and follow-up visits."),
  k("dentist", "Dentist", "Treatments with materials used and next visit due.", { fields: { services: { materials: true, nextduedays: true } } }),
  k("eye", "Eye Clinic / Optical", "Consultation plus counter sales of frames and lenses.", { modules: ["posdashboard", "models"],
    fields: { products: { modelid: true, brandid: true } }, units: [U.pcs, U.pair], categories: ["Frames", "Lenses", "Sunglasses", "Accessories"] }),
  k("physio", "Physiotherapy", "Session packages as memberships.", { modules: ["memberships"], fields: { services: { capacity: true } } }),
  k("ayush", "Ayurveda / Homeopathy", "Consultation plus own medicines with batch & expiry.", { modules: ["batches", "posdashboard"],
    units: [U.btl, U.pcs, U.gm], categories: ["Medicines", "Oils", "Powders"] }),
];

const SALON_KINDS = [
  k("salon", "Salon / Parlour", "Appointments, staff commission, product sales.", { units: [U.pcs, U.ml], categories: ["Hair Care", "Skin Care", "Makeup"] }),
  k("spa", "Spa", "Timed appointments and packages.", { fields: { services: { bufferminutes: true } } }),
  k("gym", "Gym / Fitness", "Memberships with renewals and attendance.", { fields: { services: { isRecurring: true, capacity: true } }, units: [U.pcs], categories: ["Supplements", "Accessories"] }),
  k("classes", "Yoga / Dance / Classes", "Batches by slot, monthly memberships.", { fields: { services: { isRecurring: true, capacity: true, availabilityslots: true } } }),
];

const TAILOR_KINDS = [
  k("gents", "Gents Tailor", "Stitching orders and measurements.", { units: [U.mtr, U.pcs], categories: ["Shirting", "Suiting", "Accessories"] }),
  k("boutique", "Ladies Boutique / Designer", "Stitching orders plus ready-made sales by size.", {
    fields: { products: { sizeid: true, brandid: false } }, units: [U.pcs, U.mtr, U.set], categories: ["Fabric", "Ready-made", "Accessories"] }),
];

const REPAIR_KINDS = [
  k("mobile", "Mobile Repair", "Job cards with device and IMEI, spare parts with IMEI.", { modules: ["serials"],
    fields: { jobcards: { devicename: true, serial: true, accessories: true } }, units: [U.pcs], categories: ["Spare Parts", "Accessories"] }),
  k("appliance", "AC / Appliance Service", "Home visits, visit charge and AMC.", {
    fields: { services: { locationType: true, visitcharge: true, isRecurring: true }, jobcards: { devicename: true, serial: true } },
    units: [U.pcs, U.mtr], categories: ["Spare Parts", "Gas & Consumables"] }),
  k("vehicle", "Vehicle Garage", "Job cards per vehicle, spare parts and labour.", {
    fields: { jobcards: { devicename: true, serial: true, accessories: true }, services: { locationType: false } },
    units: [U.pcs, U.ltr, U.set], categories: ["Spare Parts", "Oils & Lubricants", "Tyres"] }),
  k("computer", "Computer / Laptop Repair", "Job cards with device and serial, spare parts.", {
    fields: { jobcards: { devicename: true, serial: true, accessories: true } }, units: [U.pcs], categories: ["Spare Parts", "Accessories"] }),
];

const SERVICE_KINDS = [
  k("consultancy", "Consultancy / Professional", "Fees, appointments and follow ups.", { fields: { services: { materials: false, capacity: false, visitcharge: false } } }),
  k("coaching", "Coaching / Tuition", "Monthly fees as memberships, batches by slot.", { fields: { services: { isRecurring: true, capacity: true, availabilityslots: true } } }),
  k("event", "Event / Decorator", "Quotations, advance and job cards per event.", { fields: { services: { locationType: true, materials: true } } }),
  k("cleaning", "Cleaning / Pest Control", "Home visits, AMC with repeat visits.", { fields: { services: { locationType: true, visitcharge: true, isRecurring: true, checklist: true } } }),
  k("travel", "Travel Agency", "Bookings billed as services.", { fields: { services: { capacity: false, materials: false } } }),
];

export const BUSINESS_PROFILES: BusinessProfile[] = [
  {
    id: "retail", label: "Retail Shop", group: "Trading", types: ["retail", "garments"],
    kinds: RETAIL_KINDS, units: [U.pcs, U.box],
    note: "POS billing, sizes and models, charge rules.",
    fields: { products: { ...NO_MASTER_BATCH, itemtype: false, sizeid: true } },
    modules: [...CORE, "posdashboard", "sizes", "models", "productgroups", "pricelists", "chargerules", "reports.analytical"],
  },
  {
    id: "wholesale", label: "Wholesale / Distributor / Trader", group: "Trading", types: ["wholesale", "trader"],
    kinds: WHOLESALE_KINDS, units: [U.pcs, U.box, U.ctn],
    note: "Orders, challans, channels, price lists, routes and field staff.",
    fields: { products: { ...NO_MASTER_BATCH, itemtype: false } },
    modules: [...CORE, ...GST_DOCS, "salesorder", "purchaseorder", "deliverychallan", "channels", "salesroutes",
      "pricelists", "priceassignments", "chargerules", "productgroups", "models", "sizes", "announcements",
      "reports.salesmen", "reports.salesmanfield", "reports.delivery", "reports.deliverychallan", "deliveryboard"],
  },
  {
    id: "manufacturer", label: "Manufacturer", group: "Manufacturing", types: ["manufacturer"],
    kinds: MFG_KINDS, units: [U.pcs, U.kg],
    note: "BOM, work orders, production, quotations and CRM.",
    fields: { products: { ...NO_MASTER_BATCH, itemtype: true } },
    modules: [...CORE, ...GST_DOCS, ...CRM, "salesorder", "purchaseorder", "deliverychallan", "bom", "workorders",
      "production", "materialplanning", "reports.production", "pricelists", "priceassignments", "productgroups",
      "reports.deliverychallan"],
  },
  {
    id: "exporter", label: "Exporter", group: "Trading", types: ["exporter"],
    units: [U.pcs, U.kg, U.ctn],
    note: "Quotations, orders, challans, e-Invoice and e-Way Bill, price lists and CRM.",
    fields: { products: { ...NO_MASTER_BATCH, itemtype: false } },
    modules: [...CORE, ...GST_DOCS, ...CRM, "salesorder", "purchaseorder", "deliverychallan", "pricelists",
      "priceassignments", "productgroups", "reports.deliverychallan"],
  },
  {
    id: "pharma", label: "Pharmacy / Medical Store", group: "Trading", types: ["pharma"],
    kinds: PHARMA_KINDS, units: [U.strip, U.btl, U.box],
    note: "Counter billing, orders and challans; batch and expiry on items.",
    fields: { products: { ...NO_MASTER_BATCH, sizeid: false, modelid: false, isserialised: false, itemtype: false } },
    modules: [...CORE, ...GST_DOCS, "batches", "posdashboard", "salesorder", "purchaseorder", "deliverychallan", "pricelists",
      "priceassignments", "chargerules", "productgroups", "reports.analytical", "reports.deliverychallan"],
  },
  {
    id: "electronics", label: "Electronics / Mobile Shop", group: "Trading", types: ["electronics"],
    kinds: ELECTRONICS_KINDS, units: [U.pcs],
    note: "POS billing, models, warranty / AMC and repair job cards.",
    fields: {
      products: { ...NO_MASTER_BATCH, modelid: true, isserialised: true, itemtype: false },
      services: { warrantydays: true, materials: true, checklist: true, visitcharge: true, capacity: false, availabilityslots: false, isRecurring: false },
    },
    modules: [...CORE, ...GST_DOCS, "serials", "posdashboard", "models", "productgroups", "pricelists", "services", "jobcards", "contracts",
      "reports.service", "reports.analytical"],
  },
  {
    id: "jewellery", label: "Jewellery", group: "Trading", types: ["jewellery"],
    units: [U.pcs, U.gm, U.set], categories: ["Gold", "Silver", "Diamond", "Platinum"],
    note: "Counter billing, quotations, product groups and price lists.",
    fields: { products: { ...NO_MASTER_BATCH, sizeid: false, isserialised: false, itemtype: false } },
    modules: [...CORE, "jewellery", "posdashboard", "quotations", "reports.quotation", "productgroups", "models", "pricelists", "reports.analytical"],
  },
  {
    id: "hardware", label: "Hardware / Building Material", group: "Industry", types: ["hardware"],
    kinds: HARDWARE_KINDS, units: [U.pcs, U.kg],
    note: "Counter billing, quotations, orders and challans, sizes and models.",
    fields: { products: { ...NO_MASTER_BATCH, isserialised: false, itemtype: false } },
    modules: [...CORE, ...GST_DOCS, "posdashboard", "quotations", "reports.quotation", "salesorder", "purchaseorder",
      "deliverychallan", "sizes", "models", "productgroups", "pricelists", "priceassignments", "reports.deliverychallan"],
  },
  {
    id: "restaurant", label: "Restaurant / Food", group: "Services", types: ["restaurant"],
    kinds: FOOD_KINDS, units: [U.pcs, U.plate],
    note: "Tables with KOT and running bills, counter billing, charge rules and item groups.",
    fields: {
      products: { ...NO_MASTER_BATCH, brandid: false, modelid: false, sizeid: false, isserialised: false, itemtype: false },
      services: { visitcharge: false, warrantydays: false, materials: false, locationType: false },
    },
    modules: [...CORE, "restaurant", "posdashboard", "salesorder", "productgroups", "chargerules", "reports.analytical"],
  },
  {
    id: "doctor", label: "Doctor / Clinic", group: "Services", types: ["doctor"],
    kinds: DOCTOR_KINDS,
    note: "Appointments, doctors and prescriptions.",
    switches: { onlineBookingAllowed: true },
    fields: {
      products: { ...NO_MASTER_BATCH, sizeid: false, modelid: false, isserialised: false, itemtype: false },
      services: { duration: true, requiresappointment: true, availabilityslots: true, staffids: true, nextduedays: true,
        visitcharge: false, materials: false, warrantydays: false, isRecurring: false, checklist: false, locationType: false, capacity: false },
    },
    modules: [...CORE, "services", "appointments", "prescriptions", "leads", "followups", "reports.service", "reports.crm"],
  },
  {
    // Saved as "clinic" before Doctor / Clinic had its own type.
    id: "salon", label: "Salon / Spa / Gym", group: "Services", types: ["salon", "clinic"],
    kinds: SALON_KINDS,
    note: "Appointments, services and memberships.",
    switches: { onlineBookingAllowed: true },
    fields: {
      products: { ...NO_MASTER_BATCH, modelid: false, isserialised: false, itemtype: false },
      services: { duration: true, requiresappointment: true, staffids: true, commission: true, materials: true, capacity: true,
        visitcharge: false, warrantydays: false },
    },
    modules: [...CORE, "posdashboard", "services", "appointments", "memberships", "leads", "followups", "reports.service", "reports.crm"],
  },
  {
    id: "tailor", label: "Tailor / Boutique", group: "Services", types: ["tailor"],
    kinds: TAILOR_KINDS, units: [U.mtr, U.pcs],
    note: "Counter sales plus customer measurements and stitching orders.",
    modules: [...CORE, "posdashboard", "services", "tailoring", "sizes", "productgroups", "pricelists", "reports.analytical"],
    fields: {
      products: { ...NO_MASTER_BATCH, modelid: false, isserialised: false, itemtype: false },
      services: { staffids: true, commission: true, duration: false, requiresappointment: false, availabilityslots: false, capacity: false,
        bufferminutes: false, visitcharge: false, locationType: false, warrantydays: false, nextduedays: false, isRecurring: false },
    },
  },
  {
    id: "repair", label: "Repair / Service Centre", group: "Services", types: ["repair"],
    kinds: REPAIR_KINDS, units: [U.pcs],
    note: "Job cards, AMC contracts, spare parts billing, support tickets and CRM.",
    fields: {
      products: { ...NO_MASTER_BATCH, modelid: true, isserialised: true, itemtype: false },
      services: { visitcharge: true, warrantydays: true, materials: true, checklist: true, locationType: true,
        capacity: false, availabilityslots: false, isRecurring: false },
    },
    modules: [...CORE, ...CRM, "services", "jobcards", "contracts", "reports.service", "supporttickets"],
  },
  {
    id: "service", label: "Other Services", group: "Services", types: ["service"],
    kinds: SERVICE_KINDS,
    note: "Services, appointments, job cards, AMC, memberships and support tickets.",
    fields: { products: { ...NO_MASTER_BATCH, itemtype: false } },
    modules: [...CORE, ...CRM, "services", "appointments", "jobcards", "contracts", "memberships", "reports.service", "supporttickets"],
  },
  {
    id: "other", label: "Other", group: "Other", types: ["other"],
    units: [U.pcs],
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

/** Form fields the type would change, against the business's current form permissions. */
export const fieldChanges = (p: BusinessProfile | undefined, formPermissions: Record<string, any> = {}) => {
  const out: { module: string; field: string; on: boolean }[] = [];
  for (const [module, fields] of Object.entries(p?.fields || {})) {
    for (const [field, on] of Object.entries(fields)) {
      const v = formPermissions?.[module]?.[field];
      const now = v === undefined ? true : typeof v === "object" ? v.add !== false || v.edit !== false : v !== false;
      if (now !== on) out.push({ module, field, on });
    }
  }
  return out;
};

/** Form permissions with the changes applied (one value for Add and Edit). */
export const withFieldChanges = (formPermissions: Record<string, any> = {}, changes: { module: string; field: string; on: boolean }[]) => {
  const next: Record<string, any> = { ...formPermissions };
  for (const c of changes) next[c.module] = { ...(next[c.module] || {}), [c.field]: c.on };
  return next;
};

export const profileForType = (type: string): BusinessProfile | undefined =>
  BUSINESS_PROFILES.find((p) => p.types.includes(String(type || "").toLowerCase()));

/** Business Kind options of a type (empty when the type has none). */
export const kindOptions = (type: string) => (profileForType(type)?.kinds || []).map((x) => ({ value: x.id, label: x.label }));

/** The type with its kind added on top; a kind never removes anything the type turns on. */
export const withKind = (p: BusinessProfile | undefined, kindId?: string | null): BusinessProfile | undefined => {
  const kind = p?.kinds?.find((x) => x.id === kindId);
  if (!p || !kind) return p;
  const fields: FieldPreset = { ...(p.fields || {}) };
  for (const [m, f] of Object.entries(kind.fields || {})) fields[m] = { ...(fields[m] || {}), ...f };
  const units = [...(p.units || []), ...(kind.units || [])].filter((u, i, a) => a.findIndex((x) => x[0] === u[0]) === i);
  return { ...p, note: kind.note, modules: [...p.modules, ...kind.modules], switches: { ...(p.switches || {}), ...(kind.switches || {}) },
    fields, units, categories: kind.categories || p.categories };
};

/** Starter units and categories a preset adds when the business has none of that name. */
export const starterMasters = (p?: BusinessProfile) => ({
  units: (p?.units || []).map(([name, uqc]) => ({ name, uqc })),
  categories: p?.categories || [],
});

/** The list value for a saved type (older "trader" shows as Wholesale / Distributor / Trader). */
export const businessTypeValue = (type: string) => profileForType(type)?.id || String(type || "");

/** Display label for a saved type. */
export const businessTypeLabel = (type: string) =>
  profileForType(type)?.label || (type ? type[0].toUpperCase() + type.slice(1) : "-");
