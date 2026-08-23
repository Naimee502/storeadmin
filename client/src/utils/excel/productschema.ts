import { FORM_PERMISSIONS_CONFIG } from "../../config/formpermissions";

/**
 * The single source of truth for what the product spreadsheet looks like.
 *
 * Every consumer — the blank template writer, the export writer, the import
 * parser, the validator and the error report — builds its columns from this
 * one function. That is what makes "only the fields enabled in Business
 * Settings appear in the file" true everywhere at once instead of in four
 * places that slowly disagree.
 */

export type SheetId = "Products" | "Variants" | "UnitConversions" | "UnitPrices";

export type ColumnType =
  | "text"
  | "number"
  | "integer"
  | "date"
  | "boolean"
  | "ref"
  | "enum"
  | "imageurls"
  | "imagefiles"
  | "keywords";

/** Master lists a `ref` column can point at. */
export type MasterKey =
  | "categories"
  | "subcategories"
  | "brands"
  | "models"
  | "sizes"
  | "groups"
  | "units"
  | "ledgers";

export interface ColumnDef {
  /** Spreadsheet header text. */
  header: string;
  /** Property this maps to on the product / variant / row object. */
  key: string;
  sheet: SheetId;
  type: ColumnType;
  /** Form-permission field id. Omitted for structural columns. */
  permissionId?: string;
  /** For `ref` columns: which master list backs the dropdown. */
  master?: MasterKey;
  /** For `enum` columns: the allowed display values. */
  options?: string[];
  /** Structural columns are never removed by form permissions. */
  structural?: boolean;
  /** Shown in the template's help row. */
  hint?: string;
  required?: boolean;
  width?: number;
}

/* ------------------------------------------------------------------ *
 * The full column map, before permissions are applied.
 * ------------------------------------------------------------------ */

const ALL_COLUMNS: ColumnDef[] = [
  /* ---------------- Products ---------------- */
  {
    header: "ProductRef", key: "productref", sheet: "Products", type: "text",
    structural: true, width: 14,
    hint: "Join key. Existing product: its Product Code. New product: any short token you also type on the other sheets (P1, P2...).",
  },
  { header: "Name", key: "name", sheet: "Products", type: "text", permissionId: "name", required: true, width: 28 },
  { header: "Description", key: "description", sheet: "Products", type: "text", permissionId: "description", width: 34 },
  {
    header: "Image URLs", key: "imageurls", sheet: "Products", type: "imageurls",
    permissionId: "imageurl", width: 34,
    hint: "Comma-separated web addresses.",
  },
  {
    header: "Image Files", key: "imagefiles", sheet: "Products", type: "imagefiles",
    permissionId: "imageurl", width: 28,
    hint: "Comma-separated file names from the images/ folder of an uploaded .zip.",
  },
  { header: "Category", key: "categoryid", sheet: "Products", type: "ref", master: "categories", permissionId: "categoryid", required: true, width: 22 },
  { header: "Sub Category", key: "subcategoryid", sheet: "Products", type: "ref", master: "subcategories", permissionId: "subcategoryid", width: 24 },
  { header: "Brand", key: "brandid", sheet: "Products", type: "ref", master: "brands", permissionId: "brandid", width: 20 },
  { header: "Model", key: "modelid", sheet: "Products", type: "ref", master: "models", permissionId: "modelid", width: 20 },
  { header: "Size", key: "sizeid", sheet: "Products", type: "ref", master: "sizes", permissionId: "sizeid", width: 16 },
  { header: "Product Group", key: "groupid", sheet: "Products", type: "ref", master: "groups", permissionId: "groupid", width: 22 },
  { header: "Meta Title", key: "metatitle", sheet: "Products", type: "text", permissionId: "metatitle", width: 24 },
  { header: "Meta Description", key: "metadescription", sheet: "Products", type: "text", permissionId: "metadescription", width: 30 },
  { header: "Keywords", key: "keywords", sheet: "Products", type: "keywords", permissionId: "keywords", width: 26, hint: "Comma-separated." },
  { header: "Slug", key: "slug", sheet: "Products", type: "text", permissionId: "slug", width: 22, hint: "Leave blank to generate from the name." },
  { header: "Status", key: "status", sheet: "Products", type: "enum", options: ["Active", "Inactive"], permissionId: "status", width: 12 },
  { header: "Is Serialised", key: "isserialised", sheet: "Products", type: "enum", options: ["Yes", "No"], permissionId: "isserialised", width: 14 },
  { header: "Sales Account", key: "salesaccountid", sheet: "Products", type: "ref", master: "ledgers", permissionId: "salesaccount", required: true, width: 24 },
  { header: "Purchase Account", key: "purchaseaccountid", sheet: "Products", type: "ref", master: "ledgers", permissionId: "purchaseaccount", required: true, width: 24 },

  /* ---------------- Variants ---------------- */
  { header: "ProductRef", key: "productref", sheet: "Variants", type: "text", structural: true, width: 14 },
  {
    header: "VariantRef", key: "variantref", sheet: "Variants", type: "text",
    structural: true, width: 14,
    hint: "Join key for the pricing sheets. Use the SKU, or 1, 2, 3 within each product.",
  },
  { header: "Variant Name", key: "name", sheet: "Variants", type: "text", permissionId: "variant_name", width: 24 },
  { header: "SKU", key: "sku", sheet: "Variants", type: "text", permissionId: "sku", width: 18 },
  {
    header: "Product Code", key: "productcode", sheet: "Variants", type: "text",
    permissionId: "productcode", width: 16,
    hint: "Leave blank for a new product — the system generates #PRD0001 and up.",
  },
  { header: "Batch Number", key: "batchnumber", sheet: "Variants", type: "text", permissionId: "batchnumber", width: 16 },
  { header: "Manufacture Date", key: "manufacturedate", sheet: "Variants", type: "date", permissionId: "manufacturedate", width: 18 },
  { header: "Expiry Date", key: "expirydate", sheet: "Variants", type: "date", permissionId: "expirydate", width: 16 },
  { header: "GST %", key: "gst", sheet: "Variants", type: "number", permissionId: "gst", width: 10 },
  { header: "HSN Code", key: "hsncode", sheet: "Variants", type: "text", permissionId: "hsncode", width: 14 },
  { header: "Opening Stock", key: "openingstock", sheet: "Variants", type: "number", permissionId: "openingstock", width: 15 },
  { header: "Opening Stock Amount", key: "openingstockamount", sheet: "Variants", type: "number", permissionId: "openingstockamount", width: 20 },
  { header: "Current Stock", key: "currentstock", sheet: "Variants", type: "number", permissionId: "currentstock", width: 14 },
  { header: "Current Stock Amount", key: "currentstockamount", sheet: "Variants", type: "number", permissionId: "currentstockamount", width: 20 },
  { header: "Closing Stock", key: "closingstock", sheet: "Variants", type: "number", permissionId: "closingstock", width: 14 },
  { header: "Closing Stock Amount", key: "closingstockamount", sheet: "Variants", type: "number", permissionId: "closingstockamount", width: 20 },
  { header: "Minimum Stock", key: "minimumstock", sheet: "Variants", type: "number", permissionId: "minimumstock", width: 15 },
  { header: "Reorder Level", key: "reorderlevel", sheet: "Variants", type: "number", permissionId: "reorderlevel", width: 14 },
  { header: "Rack Location", key: "racklocation", sheet: "Variants", type: "text", permissionId: "racklocation", width: 16 },
  { header: "Base Unit", key: "baseunitid", sheet: "Variants", type: "ref", master: "units", permissionId: "baseunitid", required: true, width: 18 },
  { header: "Purchase Unit", key: "purchaseunitid", sheet: "Variants", type: "ref", master: "units", permissionId: "purchaseunitid", required: true, width: 18 },
  { header: "Purchase Rate", key: "purchaserate", sheet: "Variants", type: "number", permissionId: "purchaserate", required: true, width: 15 },

  /* ---------------- Unit Conversions ---------------- */
  { header: "ProductRef", key: "productref", sheet: "UnitConversions", type: "text", structural: true, width: 14 },
  { header: "VariantRef", key: "variantref", sheet: "UnitConversions", type: "text", structural: true, width: 14 },
  { header: "Unit", key: "unitid", sheet: "UnitConversions", type: "ref", master: "units", permissionId: "unitconversions_unitid", required: true, width: 18 },
  {
    header: "Factor", key: "factor", sheet: "UnitConversions", type: "number",
    permissionId: "factor", required: true, width: 12,
    hint: "How many base units this unit contains. Base unit itself is 1.",
  },

  /* ---------------- Unit Prices ---------------- */
  { header: "ProductRef", key: "productref", sheet: "UnitPrices", type: "text", structural: true, width: 14 },
  { header: "VariantRef", key: "variantref", sheet: "UnitPrices", type: "text", structural: true, width: 14 },
  { header: "Quantity", key: "quantity", sheet: "UnitPrices", type: "number", permissionId: "quantity", required: true, width: 12 },
  { header: "Unit", key: "unitid", sheet: "UnitPrices", type: "ref", master: "units", permissionId: "unitprices_unitid", required: true, width: 18 },
  { header: "MRP", key: "mrp", sheet: "UnitPrices", type: "number", permissionId: "mrp", width: 12 },
  { header: "Sales Rate", key: "salesrate", sheet: "UnitPrices", type: "number", permissionId: "salesrate", required: true, width: 13 },
  { header: "Discount", key: "discount", sheet: "UnitPrices", type: "number", permissionId: "discount", width: 12 },
  { header: "Discount Type", key: "discounttype", sheet: "UnitPrices", type: "enum", options: ["Fixed", "Percentage"], permissionId: "discounttype", width: 16 },
  { header: "Offer Price", key: "offerprice", sheet: "UnitPrices", type: "number", permissionId: "offerprice", width: 13 },
];

export const SHEET_ORDER: SheetId[] = ["Products", "Variants", "UnitConversions", "UnitPrices"];

/** Hidden sheet holding the dropdown source lists. */
export const MASTER_SHEET = "_Master";
/** Hidden sheet recording which admin / branch / settings the file came from. */
export const META_SHEET = "_Meta";

export interface SheetSchema {
  id: SheetId;
  columns: ColumnDef[];
}

export interface ProductSheetSchema {
  sheets: SheetSchema[];
  /** Every master list actually referenced by an enabled column. */
  mastersUsed: MasterKey[];
  bySheet: (sheet: SheetId) => ColumnDef[];
}

/** All field ids the products form declares, in config order. */
export const PRODUCT_FORM_FIELD_IDS: string[] = (() => {
  const form = FORM_PERMISSIONS_CONFIG.find((f) => f.moduleId === "products");
  if (!form) return [];
  return form.sections.flatMap((section) => section.fields.map((field) => field.id));
})();

/**
 * Build the workbook schema for the current form settings.
 *
 * A field that is switched off in Business Settings loses its column
 * everywhere. Structural columns (the join keys) always survive, because they
 * are plumbing rather than form fields.
 */
export const buildProductSheetSchema = (
  permissions: Record<string, boolean | undefined> = {}
): ProductSheetSchema => {
  const isOn = (col: ColumnDef) => {
    if (col.structural) return true;
    if (!col.permissionId) return true;
    return permissions[col.permissionId] !== false;
  };

  const enabledColumns = ALL_COLUMNS.filter(isOn);

  const sheets: SheetSchema[] = SHEET_ORDER.map((id) => ({
    id,
    columns: enabledColumns.filter((c) => c.sheet === id),
  }));

  const mastersUsed = Array.from(
    new Set(enabledColumns.map((c) => c.master).filter(Boolean) as MasterKey[])
  );

  return {
    sheets,
    mastersUsed,
    bySheet: (sheet: SheetId) => enabledColumns.filter((c) => c.sheet === sheet),
  };
};

/**
 * Required fields, after permissions. A required field that has been switched
 * off stops being required — otherwise the importer would demand something the
 * form itself no longer collects.
 */
export const requiredKeysFor = (
  schema: ProductSheetSchema,
  sheet: SheetId
): string[] =>
  schema.bySheet(sheet).filter((c) => c.required).map((c) => c.key);

/** Header text → column definition, for reading an uploaded file. */
export const headerIndex = (columns: ColumnDef[]): Map<string, ColumnDef> => {
  const map = new Map<string, ColumnDef>();
  columns.forEach((col) => map.set(col.header.trim().toLowerCase(), col));
  return map;
};

/** Excel named range holding a master's display names. */
export const masterNameRange = (master: MasterKey) => `MST_${master}_NAME`;
/** Excel named range holding a master's ids, parallel to the name range. */
export const masterIdRange = (master: MasterKey) => `MST_${master}_ID`;

/** Human label for a master list, used in help text and error messages. */
export const MASTER_LABELS: Record<MasterKey, string> = {
  categories: "Category",
  subcategories: "Sub Category",
  brands: "Brand",
  models: "Model",
  sizes: "Size",
  groups: "Product Group",
  units: "Unit",
  ledgers: "Account Ledger",
};
