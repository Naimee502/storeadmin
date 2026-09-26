import type ExcelJS from "exceljs";
import {
  buildProductSheetSchema,
  MASTER_LABELS,
  META_SHEET,
  SHEET_ORDER,
  headerForField,
  isCreatableMaster,
  NAME_KEY_BY_FIELD,
  masterNameKey,
  INTERNAL_LINK_KEY,
  LEGACY_PRODUCT_IMAGE_HEADERS,
  PRODUCT_CODE_HEADER,
  PRODUCT_LINK_HEADER,
  VARIANT_CODE_HEADER,
  VARIANT_REF_HEADER,
  type ColumnDef,
  type MasterKey,
  type SheetId,
} from "./productschema";
import { idColumnHeader, type MasterLists, type MasterOption } from "./exportproducts";
import { validateProduct, type ValidationIssue } from "../products/validateproduct";
import { cellKey, readCellImages } from "./embeddedimages";

/**
 * Reads an uploaded workbook back into product payloads.
 *
 * The order of business per reference cell is: hidden ID column first, then an
 * exact (trimmed, case-insensitive) name match, then a row error. Nothing is
 * ever guessed — a value that can't be resolved is reported with the sheet,
 * row, column and the text that was actually in the cell, so the user can fix
 * it rather than wonder which of 400 rows was the problem.
 */

export interface RowError {
  sheet: SheetId | "File";
  /** 1-based spreadsheet row, matching what the user sees in Excel. */
  row: number | null;
  column: string | null;
  value: string;
  message: string;
  /** ProductRef the error belongs to, for grouping. */
  ref?: string;
}

export interface ParsedImport {
  products: any[];
  /** ProductRef per product, parallel to `products`. */
  refs: string[];
  errors: RowError[];
  warnings: string[];
  /** Rows read per sheet, for the review summary. */
  counts: Record<string, number>;
  /** Image file names referenced but not yet uploaded. */
  imageFiles: Map<string, string[]>;
  /**
   * Typed master names per product, parallel to `products` — categoryname,
   * subcategoryname, brandname... plus categoryimage / subcategoryimage. The
   * server uses them to find or create a master when the sheet has no id.
   */
  masterNames: Record<string, any>[];
  /**
   * Category / Sub Category image FILE names (from a .zip) still to upload.
   * Key is `${productIndex}:${field}` so the uploaded URL lands back on the
   * right entry of `masterNames`.
   */
  masterImageFiles: Map<string, string[]>;
  /**
   * Pictures placed inside the workbook's cells (Insert → Pictures → Place in
   * Cell, or dropped onto a cell), by the generated file name the sheet
   * fields now refer to. Uploaded like any picked image — no path, no zip.
   */
  embeddedImages: Map<string, File>;
  meta: Record<string, string>;
}

/** Messages shared word-for-word with the server so the review list shows each problem once. */
export const IMPORT_MESSAGES = {
  productCodeDuplicate: (code: string) =>
    `Product code ${code} is used more than once in this file.`,
  subNeedsCategory: (sub: string) =>
    `Sub Category "${sub}" is new, so it needs a Category on the same row.`,
  subSplitCategory: (sub: string, first: string, here: string) =>
    `New Sub Category "${sub}" is under Category "${first}" on another row but under "${here}" here. A Sub Category can only belong to one Category.`,
  ledgerSplitRole: (name: string, first: string, here: string) =>
    `New account "${name}" is used as a ${first} Account and as a ${here} Account. A new account can only be one of them — use two names, or create it under Account Ledgers first.`,
  subWrongCategory: (sub: string, actual: string, given: string) =>
    `Sub Category "${sub}" belongs to Category "${actual}", not "${given}". Pick the right Category, or use a different Sub Category name.`,
};

/**
 * A web address or one of our own /uploads paths. Anything else is a picture
 * the user supplies — named in the cell, picked with "Select Images" or zipped.
 * Deliberately NOT "anything starting with /": a Mac path like
 * /Users/me/Pictures/oil.jpg is a local file, not a URL.
 */
const isImageUrl = (value: string) => /^(https?:\/\/|\/uploads\/)/i.test(value);

/**
 * "C:\Users\me\Pictures\oil.jpg" → "oil.jpg". People paste the full path
 * (Shift+right-click → Copy as path adds quotes too); the browser can never
 * open that path, so only the file name is used to match a picked image.
 */
export const imageFileName = (value: string): string =>
  norm(value).replace(/^"+|"+$/g, "").split(/[\\/]/).pop()?.trim() ?? "";

type RawRow = { row: number; values: Record<string, any> };

const norm = (value: any): string =>
  value === null || value === undefined ? "" : String(value).trim();

const normKey = (value: any): string => norm(value).toLowerCase();

/** ExcelJS gives back rich text / formula objects; flatten to a scalar. */
const cellValue = (cell: ExcelJS.Cell): any => {
  const v: any = cell?.value;
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    if ("result" in v) return v.result ?? "";
    if ("text" in v) return v.text ?? "";
    if ("richText" in v) return (v.richText || []).map((t: any) => t.text).join("");
    if ("hyperlink" in v) return v.text ?? v.hyperlink ?? "";
    return "";
  }
  return v;
};

/**
 * Files made before the Product Code moved to the Products sheet used
 * "ProductRef" as a pure join key (P1, #PRD0001...) and kept the code on the
 * Variants sheet as "Product Code". Read them with the meaning they had:
 * the old ProductRef only links rows, it never becomes a code.
 */
const LEGACY_HEADERS: Partial<Record<SheetId, Record<string, string>>> = {
  Products: { ProductRef: INTERNAL_LINK_KEY },
  Variants: { ProductRef: PRODUCT_LINK_HEADER, "Product Code": VARIANT_CODE_HEADER },
  UnitConversions: { ProductRef: PRODUCT_LINK_HEADER },
  UnitPrices: { ProductRef: PRODUCT_LINK_HEADER },
};

const readSheet = (
  workbook: ExcelJS.Workbook,
  sheetId: SheetId
): { rows: RawRow[]; headers: string[]; columnOf: Map<string, number> } => {
  const sheet = workbook.getWorksheet(sheetId);
  if (!sheet) return { rows: [], headers: [], columnOf: new Map() };

  const headers: string[] = [];
  const headerRow = sheet.getRow(1);
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    // "Name *" in the template means required — strip the marker.
    headers[colNumber] = norm(cellValue(cell)).replace(/\s*\*$/, "");
  });
  // A file made before the Product Code moved to the Products sheet is
  // recognised by its "ProductRef" column — and only then are its headers
  // renamed, because in those files a Variants "Product Code" meant the
  // variant's own code, not the link to the product.
  if (headers.includes("ProductRef")) {
    const aliases = LEGACY_HEADERS[sheetId] ?? {};
    for (let i = 0; i < headers.length; i++) {
      if (headers[i] && aliases[headers[i]]) headers[i] = aliases[headers[i]];
    }
  }

  const rows: RawRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const values: Record<string, any> = {};
    let hasContent = false;
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const header = headers[colNumber];
      if (!header) return;
      const value = cellValue(cell);
      values[header] = value;
      if (norm(value) !== "") hasContent = true;
    });
    if (hasContent) rows.push({ row: rowNumber, values });
  });

  const columnOf = new Map<string, number>();
  headers.forEach((header, col) => {
    if (header && !columnOf.has(header)) columnOf.set(header, col);
  });
  return { rows, headers: headers.filter(Boolean), columnOf };
};

/* ------------------------------------------------------------------ *
 * Reference resolution
 * ------------------------------------------------------------------ */

interface MasterIndex {
  byId: Set<string>;
  byName: Map<string, MasterOption[]>;
}

const indexMasters = (masters: Partial<MasterLists>): Record<string, MasterIndex> => {
  const out: Record<string, MasterIndex> = {};
  for (const [key, options] of Object.entries(masters)) {
    const byId = new Set<string>();
    const byName = new Map<string, MasterOption[]>();
    for (const option of options ?? []) {
      byId.add(String(option.id));
      const nameKey = masterNameKey(option.name);
      const bucket = byName.get(nameKey) ?? [];
      bucket.push(option);
      byName.set(nameKey, bucket);
    }
    out[key] = { byId, byName };
  }
  return out;
};

const resolveRef = (
  col: ColumnDef,
  values: Record<string, any>,
  masterIndex: Record<string, MasterIndex>,
  sheet: SheetId,
  rowNumber: number,
  errors: RowError[],
  ref: string
): string | null => {
  const master = col.master as MasterKey;
  const index = masterIndex[master];
  const label = MASTER_LABELS[master];

  const displayValue = norm(values[col.header]);
  const hiddenId = norm(values[idColumnHeader(col)]);

  // 1. The hidden id, when it is one we actually own.
  if (hiddenId && index?.byId.has(hiddenId)) return hiddenId;

  // 2. Fall back to matching the visible name.
  if (displayValue) {
    const matches = index?.byName.get(masterNameKey(displayValue)) ?? [];
    if (matches.length === 1) return matches[0].id;
    if (matches.length > 1) {
      errors.push({
        sheet,
        row: rowNumber,
        column: col.header,
        value: displayValue,
        ref,
        message: `More than one ${label} is named "${displayValue}". Rename one of them, or pick from the dropdown so the file carries its id.`,
      });
      return null;
    }
    // Category, Brand, Size... — not in the list means "create it". The name
    // travels to the server in masterNames, which checks it against every
    // record (inactive ones too) and creates it once, however many rows use it.
    if (isCreatableMaster(master)) return null;

    errors.push({
      sheet,
      row: rowNumber,
      column: col.header,
      value: displayValue,
      ref,
      message: `${label} "${displayValue}" does not exist. Add it under Masters first, then download a fresh template.`,
    });
    return null;
  }

  // 3. A hidden id that survived from another business's file.
  if (hiddenId) {
    errors.push({
      sheet,
      row: rowNumber,
      column: col.header,
      value: hiddenId,
      ref,
      message: `This ${label} does not belong to your business.`,
    });
  }

  return null;
};

/* ------------------------------------------------------------------ *
 * Cell coercion
 * ------------------------------------------------------------------ */

const toNumber = (
  raw: any,
  col: ColumnDef,
  sheet: SheetId,
  rowNumber: number,
  errors: RowError[],
  ref: string
): number | undefined => {
  const value = norm(raw);
  if (value === "") return undefined;
  // Tolerate "1,200" and "₹1200" — people paste from other systems.
  const cleaned = value.replace(/[₹,\s]/g, "");
  const num = Number(cleaned);
  if (Number.isNaN(num)) {
    errors.push({
      sheet,
      row: rowNumber,
      column: col.header,
      value,
      ref,
      message: `${col.header} must be a number.`,
    });
    return undefined;
  }
  return num;
};

const toDate = (
  raw: any,
  col: ColumnDef,
  sheet: SheetId,
  rowNumber: number,
  errors: RowError[],
  ref: string
): Date | undefined => {
  if (!raw) return undefined;
  if (raw instanceof Date) return raw;
  const value = norm(raw);
  if (!value) return undefined;

  // DD/MM/YYYY is what the form shows, so it is what people type. Parsed
  // explicitly because new Date("03/04/2026") is month-first in most engines
  // and would silently read 3 April as 4 March.
  const dmy = value.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    const parsed = new Date(year, Number(m) - 1, Number(d));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  errors.push({
    sheet,
    row: rowNumber,
    column: col.header,
    value,
    ref,
    message: `${col.header} is not a date. Use DD/MM/YYYY.`,
  });
  return undefined;
};

const splitList = (raw: any): string[] =>
  norm(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/* ------------------------------------------------------------------ *
 * Main parse
 * ------------------------------------------------------------------ */

export interface ParseArgs {
  file: File | ArrayBuffer;
  permissions: Record<string, boolean | undefined>;
  masters: Partial<MasterLists>;
  /** Current admin/branch, so a file from elsewhere can be flagged. */
  adminid: string;
  branchid?: string | null;
}

export const parseProductWorkbook = async (args: ParseArgs): Promise<ParsedImport> => {
  const ExcelJSModule = (await import("exceljs")).default;
  const workbook: ExcelJS.Workbook = new ExcelJSModule.Workbook();

  const buffer =
    args.file instanceof ArrayBuffer ? args.file : await (args.file as File).arrayBuffer();
  await workbook.xlsx.load(buffer);

  const schema = buildProductSheetSchema(args.permissions);
  const masterIndex = indexMasters(args.masters);

  const errors: RowError[] = [];
  const warnings: string[] = [];
  const imageFiles = new Map<string, string[]>();

  /* ---- meta sheet ---- */
  const meta: Record<string, string> = {};
  const metaSheet = workbook.getWorksheet(META_SHEET);
  if (metaSheet) {
    metaSheet.eachRow((row) => {
      const key = norm(cellValue(row.getCell(1)));
      if (key) meta[key] = norm(cellValue(row.getCell(2)));
    });
  }
  if (meta.adminid && meta.adminid !== args.adminid) {
    warnings.push(
      "This file was exported from a different business account. Its category, brand and unit ids will not match — check the review list carefully."
    );
  }
  if (meta.branchid && args.branchid && meta.branchid !== args.branchid) {
    warnings.push(
      `This file was exported from a different branch${meta.branchname ? ` (${meta.branchname})` : ""}. Everything will be imported into the branch you have selected now.`
    );
  }

  /* ---- missing sheets ---- */
  for (const sheetId of SHEET_ORDER) {
    if (!workbook.getWorksheet(sheetId)) {
      errors.push({
        sheet: "File",
        row: null,
        column: null,
        value: sheetId,
        message: `The "${sheetId}" sheet is missing. Download a fresh template and paste your data into it.`,
      });
    }
  }
  if (errors.length) {
    return {
      products: [],
      refs: [],
      errors,
      warnings,
      counts: {},
      imageFiles,
      masterNames: [],
      masterImageFiles: new Map(),
      embeddedImages: new Map(),
      meta,
    };
  }

  /* ---- read the four sheets ---- */
  const sheets = Object.fromEntries(
    SHEET_ORDER.map((id) => [id, readSheet(workbook, id)])
  ) as Record<SheetId, { rows: RawRow[]; headers: string[]; columnOf: Map<string, number> }>;

  // Pictures inside the Products sheet's cells, re-keyed by row + header so
  // the assembler can ask "the picture in this row's Category Image cell".
  const byCell = await readCellImages(buffer, workbook, "Products");
  const cellImages = new Map<string, File[]>();
  for (const [header, col] of sheets.Products.columnOf) {
    for (const row of sheets.Products.rows) {
      const files = byCell.get(cellKey(row.row, col));
      if (files?.length) cellImages.set(`${row.row}|${header}`, files);
    }
  }

  return assembleProducts(
    sheets, schema, masterIndex, args, errors, warnings, imageFiles, meta, args.masters, cellImages
  );
};

/**
 * Turn four sets of raw rows into product payloads.
 *
 * Split out of parseProductWorkbook so the CSV adapter — which produces the
 * same four row sets from a flat grid — runs through identical grouping,
 * reference resolution and validation. Only the reading differs between the
 * two formats; everything after it is shared.
 */
const assembleProducts = (
  sheets: Record<SheetId, { rows: RawRow[]; headers: string[] }>,
  schema: ReturnType<typeof buildProductSheetSchema>,
  masterIndex: Record<string, MasterIndex>,
  args: { permissions: Record<string, boolean | undefined> },
  errors: RowError[],
  warnings: string[],
  imageFiles: Map<string, string[]>,
  meta: Record<string, string>,
  masterIndexLists: Partial<MasterLists>,
  /** `${row}|${header}` → pictures inside that Products cell (xlsx only). */
  cellImages: Map<string, File[]> = new Map()
): ParsedImport => {
  const embeddedImages = new Map<string, File>();

  const counts: Record<string, number> = {};
  for (const id of SHEET_ORDER) counts[id] = sheets[id].rows.length;

  /* ---- columns present in the file but switched off in settings ---- */
  for (const sheetDef of schema.sheets) {
    const known = new Set(
      sheetDef.columns.flatMap((c) =>
        c.type === "ref" ? [c.header, idColumnHeader(c)] : [c.header]
      )
    );
    if (sheetDef.columns.some((c) => c.key === "productimage")) {
      LEGACY_PRODUCT_IMAGE_HEADERS.forEach((h) => known.add(h));
    }
    const unknown = sheets[sheetDef.id].headers.filter((h) => h && !h.startsWith("__") && !known.has(h));
    if (unknown.length) {
      warnings.push(
        `${sheetDef.id}: ignoring ${unknown.length} column${unknown.length > 1 ? "s" : ""} not enabled in your form settings — ${unknown.join(", ")}.`
      );
    }
  }

  /* ---- helper to read one row against a sheet's schema ---- */
  const readRow = (
    sheetId: SheetId,
    raw: RawRow,
    ref: string
  ): Record<string, any> => {
    const out: Record<string, any> = {};
    for (const col of schema.bySheet(sheetId)) {
      // ProductRef / VariantRef are join keys for this file only. They are read
      // straight off raw.values where they're needed for grouping, and must NOT
      // land on the payload — ProductVariantInput has no such fields, and
      // GraphQL rejects the whole request with a 400 if they appear.
      if (col.structural) continue;

      const value = raw.values[col.header];

      switch (col.type) {
        case "ref":
          out[col.key] = resolveRef(col, raw.values, masterIndex, sheetId, raw.row, errors, ref);
          break;
        case "number":
        case "integer":
          out[col.key] = toNumber(value, col, sheetId, raw.row, errors, ref);
          break;
        case "date":
          out[col.key] = toDate(value, col, sheetId, raw.row, errors, ref);
          break;
        case "boolean":
          out[col.key] = /^(yes|true|1|active)$/i.test(norm(value));
          break;
        case "enum": {
          const text = norm(value);
          if (!text) break;
          const match = (col.options || []).find((o) => normKey(o) === normKey(text));
          if (!match) {
            errors.push({
              sheet: sheetId,
              row: raw.row,
              column: col.header,
              value: text,
              ref,
              message: `${col.header} must be one of: ${(col.options || []).join(", ")}.`,
            });
          } else {
            out[col.key] = match;
          }
          break;
        }
        case "masterimage":
          out[col.key] = norm(value);
          break;
        case "productimage": {
          // One cell, mixed: web addresses stay as they are, anything else is
          // a file name (a pasted path is cut down to its name). Older files
          // had these as two columns — read those too.
          const items = [
            ...splitList(value),
            ...LEGACY_PRODUCT_IMAGE_HEADERS.flatMap((h) => splitList(raw.values[h])),
          ];
          out.imageurls = items.filter(isImageUrl);
          out.imagefiles = items.filter((item) => !isImageUrl(item)).map(imageFileName).filter(Boolean);
          break;
        }
        case "imagefiles":
          out[col.key] = splitList(value).map(imageFileName).filter(Boolean);
          break;
        case "keywords":
        case "imageurls":
          out[col.key] = splitList(value);
          break;
        default:
          out[col.key] = norm(value);
      }
    }
    return out;
  };

  /* ---- how rows find their product and variant ---- */
  //
  // Products sheet: "Product Code" (may be blank → next #PRD) and Name.
  // Other sheets: "Product" = that code, or the Name when the code is blank;
  // "VariantRef" only when the product has more than one variant.
  const nameHeader = schema.bySheet("Products").find((c) => c.key === "name")?.header ?? "Name";

  interface ProductEntry {
    row: RawRow;
    code: string;
    name: string;
    /** Label used in error reports and to key images — unique per product. */
    ref: string;
    variants: RawRow[];
  }
  const entries: ProductEntry[] = [];
  const byCode = new Map<string, ProductEntry>();
  const byName = new Map<string, ProductEntry[]>();
  const usedRefs = new Set<string>();

  for (const row of sheets.Products.rows) {
    const code = norm(row.values[PRODUCT_CODE_HEADER]);
    const link = norm(row.values[INTERNAL_LINK_KEY]); // legacy files / CSV only
    const name = norm(row.values[nameHeader]);

    if (!code && !link && !name) {
      errors.push({
        sheet: "Products",
        row: row.row,
        column: nameHeader,
        value: "",
        message: "This row has neither a Product Code nor a Name.",
      });
      continue;
    }

    const codeKey = normKey(code);
    if (code && byCode.has(codeKey)) {
      errors.push({
        sheet: "Products",
        row: row.row,
        column: PRODUCT_CODE_HEADER,
        value: code,
        ref: code,
        message: IMPORT_MESSAGES.productCodeDuplicate(code),
      });
      continue;
    }

    let ref = code || link || name;
    if (usedRefs.has(normKey(ref))) ref = `${ref} (row ${row.row})`;
    usedRefs.add(normKey(ref));

    const entry: ProductEntry = { row, code, name, ref, variants: [] };
    entries.push(entry);
    if (code) byCode.set(codeKey, entry);
    if (link && !byCode.has(normKey(link))) byCode.set(normKey(link), entry);
    if (name) {
      const bucket = byName.get(masterNameKey(name)) ?? [];
      bucket.push(entry);
      byName.set(masterNameKey(name), bucket);
    }
  }

  /** Find the product a child row points at, reporting why when it can't. */
  const productFor = (sheetId: SheetId, row: RawRow): ProductEntry | null => {
    const value = norm(row.values[PRODUCT_LINK_HEADER]);
    const fail = (message: string) => {
      errors.push({ sheet: sheetId, row: row.row, column: PRODUCT_LINK_HEADER, value, ref: value || undefined, message });
      return null;
    };
    if (!value) {
      return fail("Product Code is blank — write the product's Product Code from the Products sheet, or its Name if the code was left blank there.");
    }
    const byCodeMatch = byCode.get(normKey(value));
    if (byCodeMatch) return byCodeMatch;
    const named = byName.get(masterNameKey(value)) ?? [];
    if (named.length === 1) return named[0];
    if (named.length > 1) {
      return fail(`More than one product on the Products sheet is named "${value}". Give them Product Codes and use the code here.`);
    }
    return fail(`No product on the Products sheet has the Product Code or Name "${value}".`);
  };

  for (const row of sheets.Variants.rows) {
    const entry = productFor("Variants", row);
    if (entry) entry.variants.push(row);
  }

  // VariantRef is only needed to tell several variants of one product apart.
  const variantRefOf = (row: RawRow) => norm(row.values[VARIANT_REF_HEADER]);
  for (const entry of entries) {
    if (entry.variants.length < 2) continue;
    const seen = new Set<string>();
    for (const row of entry.variants) {
      const vRef = variantRefOf(row);
      if (!vRef) {
        errors.push({
          sheet: "Variants", row: row.row, column: VARIANT_REF_HEADER, value: "", ref: entry.ref,
          message: "VariantRef is needed here — this product has more than one variant, so each needs its own label (1, 2, 3 or the SKU).",
        });
      } else if (seen.has(normKey(vRef))) {
        errors.push({
          sheet: "Variants", row: row.row, column: VARIANT_REF_HEADER, value: vRef, ref: entry.ref,
          message: `VariantRef "${vRef}" is used twice for this product.`,
        });
      }
      seen.add(normKey(vRef));
    }
  }

  // Conversion and price rows, attached to their variant row.
  const childRows = new Map<RawRow, { UnitConversions: RawRow[]; UnitPrices: RawRow[] }>();
  const childBucket = (variant: RawRow) => {
    let bucket = childRows.get(variant);
    if (!bucket) {
      bucket = { UnitConversions: [], UnitPrices: [] };
      childRows.set(variant, bucket);
    }
    return bucket;
  };
  for (const sheetId of ["UnitConversions", "UnitPrices"] as const) {
    for (const row of sheets[sheetId].rows) {
      const entry = productFor(sheetId, row);
      if (!entry || !entry.variants.length) continue; // the product itself is already reported
      const vRef = variantRefOf(row);
      let variant: RawRow | undefined;
      if (!vRef && entry.variants.length === 1) {
        variant = entry.variants[0];
      } else if (!vRef) {
        errors.push({
          sheet: sheetId, row: row.row, column: VARIANT_REF_HEADER, value: "", ref: entry.ref,
          message: "VariantRef is needed here — this product has more than one variant. Repeat the VariantRef from the Variants sheet.",
        });
        continue;
      } else {
        variant =
          entry.variants.find((v) => normKey(variantRefOf(v)) === normKey(vRef)) ??
          // One variant with no VariantRef of its own: a label here still means it.
          (entry.variants.length === 1 && !variantRefOf(entry.variants[0]) ? entry.variants[0] : undefined);
      }
      if (!variant) {
        errors.push({
          sheet: sheetId, row: row.row, column: VARIANT_REF_HEADER, value: vRef, ref: entry.ref,
          message: `This product has no variant with VariantRef "${vRef}" on the Variants sheet.`,
        });
        continue;
      }
      childBucket(variant)[sheetId].push(row);
    }
  }

  /* ---- assemble ---- */
  const products: any[] = [];
  const refs: string[] = [];
  const masterNames: Record<string, any>[] = [];
  const masterImageFiles = new Map<string, string[]>();

  // Creatable reference columns on the Products sheet, e.g. Category, Brand.
  const creatableCols = schema
    .bySheet("Products")
    .filter((c) => c.type === "ref" && isCreatableMaster(c.master));
  const subCategoryCol = creatableCols.find((c) => c.master === "subcategories");
  const categoryCol = creatableCols.find((c) => c.master === "categories");

  // Lookups for the Category ↔ Sub Category checks.
  const categoryNameById = new Map(
    (masterIndexLists.categories ?? []).map((o) => [String(o.id), o.name])
  );
  const subCategoryById = new Map(
    (masterIndexLists.subcategories ?? []).map((o) => [String(o.id), o])
  );
  // A new Sub Category typed on several rows must name the same Category each
  // time — otherwise which one should it be created under?
  const newSubParent = new Map<string, { category: string; row: number }>();
  // A new Account Ledger is filed under Sales or Purchase by its column, so
  // the same new name cannot be used in both.
  const newLedgerRole = new Map<string, { role: string; name: string }>();

  // Every code the file assigns (Products "Product Code" + Variants "Variant
  // Code"), lower-cased, so two products can't claim the same one.
  const seenProductCodes = new Set<string>();
  const variantCodeHeader = schema.bySheet("Variants").find((c) => c.key === "productcode")?.header;

  // Headers of the unit columns inside the variant sheets.
  const unitHeader = (sheet: SheetId, key: string) =>
    schema.bySheet(sheet).find((c) => c.key === key)?.header;
  const baseUnitHeader = unitHeader("Variants", "baseunitid");
  const purchaseUnitHeader = unitHeader("Variants", "purchaseunitid");
  const conversionUnitHeader = unitHeader("UnitConversions", "unitid");
  const priceUnitHeader = unitHeader("UnitPrices", "unitid");

  // Product Codes are already unique among themselves (checked above); seed
  // them so an extra variant's Variant Code can't reuse one.
  for (const entry of entries) if (entry.code) seenProductCodes.add(normKey(entry.code));

  for (const entry of entries) {
    const productRow = entry.row;
    const ref = entry.ref;

    const fields = readRow("Products", productRow, ref);

    /* ---- pictures placed inside this row's image cells ---- */
    // A picture in the cell wins over any text there: it is exactly what the
    // person chose. Each gets a generated file name and joins the same upload
    // path as picked / zipped images.
    const picturesIn = (key: string, extraHeaders: string[] = []): string[] => {
      const header = schema.bySheet("Products").find((c) => c.key === key)?.header;
      if (!header) return [];
      const files = [header, ...extraHeaders].flatMap(
        (h) => cellImages.get(`${productRow.row}|${h}`) ?? []
      );
      return files.map((file) => {
        embeddedImages.set(file.name.toLowerCase(), file);
        return file.name;
      });
    };
    const productPictures = picturesIn("productimage", LEGACY_PRODUCT_IMAGE_HEADERS);
    if (productPictures.length) {
      fields.imagefiles = [...(Array.isArray(fields.imagefiles) ? fields.imagefiles : []), ...productPictures];
    }
    for (const key of ["categoryimage", "subcategoryimage"]) {
      const [picture] = picturesIn(key);
      if (picture) fields[key] = picture;
    }

    /* ---- typed master names (for find-or-create on the server) ---- */
    const names: Record<string, any> = {};
    for (const col of creatableCols) {
      const nameKey = NAME_KEY_BY_FIELD[col.key];
      const typed = norm(productRow.values[col.header]);
      if (nameKey && typed) names[nameKey] = typed;
    }

    /* ---- a new ledger is either a Sales or a Purchase account ---- */
    for (const [field, role] of [["salesaccountid", "Sales"], ["purchaseaccountid", "Purchase"]] as const) {
      const col = creatableCols.find((c) => c.key === field);
      const typed = names[NAME_KEY_BY_FIELD[field]];
      if (!col || !typed || fields[field]) continue; // not typed, or an existing ledger
      const key = masterNameKey(typed);
      const first = newLedgerRole.get(key);
      if (!first) {
        newLedgerRole.set(key, { role, name: typed });
      } else if (first.role !== role) {
        errors.push({
          sheet: "Products",
          row: productRow.row,
          column: col.header,
          value: typed,
          ref,
          message: IMPORT_MESSAGES.ledgerSplitRole(first.name, first.role, role),
        });
      }
    }

    for (const field of ["categoryimage", "subcategoryimage"]) {
      const value = norm(fields[field]);
      if (!value) continue;
      if (isImageUrl(value)) names[field] = value;
      else masterImageFiles.set(`${products.length}:${field}`, [imageFileName(value)]);
    }

    /* ---- Category ↔ Sub Category must agree ---- */
    if (subCategoryCol && names.subcategoryname) {
      const subName = names.subcategoryname;
      const catName = names.categoryname ?? "";
      const subId = fields.subcategoryid as string | null;

      if (subId) {
        // Existing Sub Category: its parent must be this row's Category.
        const parentId = subCategoryById.get(String(subId))?.parentid;
        const rowCatId = fields.categoryid as string | null;
        const parentName = parentId ? categoryNameById.get(String(parentId)) : undefined;
        if (parentId && catName && String(parentId) !== String(rowCatId ?? "") && parentName) {
          errors.push({
            sheet: "Products",
            row: productRow.row,
            column: subCategoryCol.header,
            value: subName,
            ref,
            message: IMPORT_MESSAGES.subWrongCategory(subName, parentName, catName),
          });
        }
      } else if (!catName) {
        errors.push({
          sheet: "Products",
          row: productRow.row,
          column: subCategoryCol.header,
          value: subName,
          ref,
          message: IMPORT_MESSAGES.subNeedsCategory(subName),
        });
      } else {
        const key = masterNameKey(subName);
        const first = newSubParent.get(key);
        if (!first) {
          newSubParent.set(key, { category: catName, row: productRow.row });
        } else if (masterNameKey(first.category) !== masterNameKey(catName)) {
          errors.push({
            sheet: "Products",
            row: productRow.row,
            column: subCategoryCol.header,
            value: subName,
            ref,
            message: IMPORT_MESSAGES.subSplitCategory(subName, first.category, catName),
          });
        }
      }
    }

    if (Array.isArray(fields.imagefiles) && fields.imagefiles.length) {
      imageFiles.set(ref, fields.imagefiles);
    }

    const variantRows = entry.variants;
    if (!variantRows.length) {
      errors.push({
        sheet: "Products",
        row: productRow.row,
        column: entry.code ? PRODUCT_CODE_HEADER : nameHeader,
        value: entry.code || entry.name,
        ref,
        message: `No row on the Variants sheet points at this product. Add one with Product Code "${entry.code || entry.name}" — every product needs at least one variant.`,
      });
    }

    // Unit names typed in the sheet that matched nothing, by payload path
    // ("0.baseunitid", "0.unitprices.2") — the server finds or creates them.
    const newUnits: { path: string; name: string }[] = [];
    const noteUnit = (id: any, header: string | undefined, raw: RawRow, path: string) => {
      if (id || !header) return;
      const typed = norm(raw.values[header]);
      if (typed) newUnits.push({ path, name: typed });
    };

    const productvariants = variantRows.map((variantRow, vIndex) => {
      const variantFields = readRow("Variants", variantRow, ref);
      const children = childRows.get(variantRow) ?? { UnitConversions: [], UnitPrices: [] };

      // The first variant carries the product's code from the Products sheet.
      // Its Variant Code cell may be blank or repeat the same code; a
      // different code there would leave it unclear which one is meant.
      const variantCode = norm(variantFields.productcode);
      if (vIndex === 0 && entry.code) {
        if (variantCode && normKey(variantCode) !== normKey(entry.code)) {
          errors.push({
            sheet: "Variants",
            row: variantRow.row,
            column: variantCodeHeader ?? VARIANT_CODE_HEADER,
            value: variantCode,
            ref,
            message: `Variant Code "${variantCode}" differs from the Product Code "${entry.code}" on the Products sheet. For the first variant leave Variant Code blank — the Product Code is used.`,
          });
        }
        variantFields.productcode = entry.code;
      } else if (variantCode) {
        // An extra variant's own code (or a legacy file's code) is kept by the
        // server, so two rows carrying the same one would clash.
        if (seenProductCodes.has(normKey(variantCode))) {
          errors.push({
            sheet: "Variants",
            row: variantRow.row,
            column: variantCodeHeader ?? VARIANT_CODE_HEADER,
            value: variantCode,
            ref,
            message: IMPORT_MESSAGES.productCodeDuplicate(variantCode),
          });
        } else {
          seenProductCodes.add(normKey(variantCode));
        }
      }

      noteUnit(variantFields.baseunitid, baseUnitHeader, variantRow, `${vIndex}.baseunitid`);
      noteUnit(variantFields.purchaseunitid, purchaseUnitHeader, variantRow, `${vIndex}.purchaseunitid`);

      const unitconversions = children.UnitConversions.map((r, cIndex) => {
        const conv = readRow("UnitConversions", r, ref);
        noteUnit(conv.unitid, conversionUnitHeader, r, `${vIndex}.unitconversions.${cIndex}`);
        return conv;
      });
      const unitprices = children.UnitPrices.map((r, pIndex) => {
        const price = readRow("UnitPrices", r, ref);
        noteUnit(price.unitid, priceUnitHeader, r, `${vIndex}.unitprices.${pIndex}`);
        if (price.discounttype) {
          price.discounttype = normKey(price.discounttype) === "percentage" ? "percentage" : "fixed";
        }
        // quantity is Float! in the schema. A blank cell must still travel to
        // the server so the dry run can report it as a row error — sending
        // undefined would fail variable coercion and the user would get an
        // opaque 400 instead of "Quantity must be greater than 0".
        if (price.quantity === undefined || price.quantity === null) price.quantity = 0;
        return price;
      });

      return { ...variantFields, unitconversions, unitprices };
    });

    // Pictures are only written when the sheet actually carries some.
    //
    // This used to send `imageurls: fields.imageurls ?? []` unconditionally,
    // which meant a sheet WITHOUT an "Image URLs" column — the ordinary case,
    // since the export fills it but nobody maintains it by hand — set every
    // imported product's images to empty. Re-importing a price list to update
    // rates therefore silently stripped the photos off every product it
    // touched, and the app then drew a placeholder box for a product that had
    // a perfectly good picture the day before.
    //
    // Leaving the keys out entirely is what restores it: updateProductService
    // applies the input with Mongoose's `.set()`, which only writes the keys
    // it is given, so an absent imageurl keeps whatever is already stored. A
    // spreadsheet has no way to say "remove the picture" anyway — a blank cell
    // means "not specified here", never "delete it".
    const hasImages = Array.isArray(fields.imageurls) && fields.imageurls.length > 0;

    const product: any = {
      name: fields.name,
      description: fields.description,
      ...(hasImages ? {
        imageurls: fields.imageurls,
        imageurl: fields.imageurls[0],
      } : {}),
      categoryid: fields.categoryid,
      subcategoryid: fields.subcategoryid,
      brandid: fields.brandid,
      modelid: fields.modelid,
      sizeid: fields.sizeid,
      groupid: fields.groupid,
      salesaccountid: fields.salesaccountid,
      purchaseaccountid: fields.purchaseaccountid,
      isservice: false,
      isserialised: normKey(fields.isserialised) === "yes",
      status: normKey(fields.status) !== "inactive",
      seo: {
        metatitle: fields.metatitle || "",
        metadescription: fields.metadescription || "",
        keywords: fields.keywords ?? [],
        slug: fields.slug || "",
      },
      productvariants,
    };

    // Same rules the add/edit form applies, so nothing gets in through the
    // spreadsheet that the form itself would have rejected. A Category typed
    // as a new name has no id yet but IS given — the server creates it — so
    // the "Category is required" rule must not fire for it.
    if (newUnits.length) names.units = newUnits;

    const { issues } = validateProduct(validationView(product, names, !!categoryCol), args.permissions);
    for (const issue of issues) {
      // "No variant" is already reported above, with what to write.
      if (issue.field === "productvariants" && !variantRows.length) continue;
      errors.push(
        mapIssueToRow(issue, ref, productRow, variantRows, (variant, sheetId) =>
          childRows.get(variant)?.[sheetId] ?? []
        )
      );
    }

    products.push(product);
    refs.push(ref);
    masterNames.push(names);
  }

  return {
    products,
    refs,
    errors,
    warnings,
    counts,
    imageFiles,
    masterNames,
    masterImageFiles,
    embeddedImages,
    meta,
  };
};

/**
 * The product as the validator should see it: a master typed as a NEW name
 * has no id yet but IS given (the server creates it), so it must not trip
 * "Category is required" / "Base unit is required". Each new name gets a
 * stable placeholder id, so rules that compare units (purchase rate vs the
 * price unit's factor) still see the same unit as the same unit.
 */
const validationView = (
  product: any,
  names: Record<string, any>,
  categoryOn: boolean
): any => {
  const placeholder = (name: string) => `__new__:${masterNameKey(name)}`;
  const view: any = {
    ...product,
    productvariants: (product.productvariants || []).map((v: any) => ({
      ...v,
      unitconversions: (v.unitconversions || []).map((c: any) => ({ ...c })),
      unitprices: (v.unitprices || []).map((p: any) => ({ ...p })),
    })),
  };

  if (categoryOn && !view.categoryid && names.categoryname) view.categoryid = placeholder(names.categoryname);
  if (!view.salesaccountid && names.salesaccountname) view.salesaccountid = placeholder(names.salesaccountname);
  if (!view.purchaseaccountid && names.purchaseaccountname) view.purchaseaccountid = placeholder(names.purchaseaccountname);

  for (const { path, name } of (names.units ?? []) as { path: string; name: string }[]) {
    const [v, slot, i] = path.split(".");
    const variant = view.productvariants[Number(v)];
    if (!variant) continue;
    if (slot === "baseunitid" || slot === "purchaseunitid") variant[slot] = placeholder(name);
    else if (variant[slot]?.[Number(i)]) variant[slot][Number(i)].unitid = placeholder(name);
  }
  return view;
};

/**
 * CSV entry point.
 *
 * The flat grid is exploded into the same four row sets the xlsx reader
 * produces, then handed to the identical assembler — so grouping, reference
 * resolution, validation and the error report are shared, and only the reading
 * differs between the two formats.
 */
export const parseProductCsv = async (
  args: Omit<ParseArgs, "file"> & { text: string }
): Promise<ParsedImport> => {
  const { csvToSheetRows } = await import("./csvadapter");

  const schema = buildProductSheetSchema(args.permissions);
  const masterIndex = indexMasters(args.masters);

  const errors: RowError[] = [];
  const imageFiles = new Map<string, string[]>();

  const exploded = csvToSheetRows(args.text, args.permissions);
  const warnings: string[] = [...exploded.warnings];

  const sheets = {
    Products: { rows: exploded.Products, headers: [] as string[], columnOf: new Map<string, number>() },
    Variants: { rows: exploded.Variants, headers: [] as string[], columnOf: new Map<string, number>() },
    UnitConversions: { rows: exploded.UnitConversions, headers: [] as string[], columnOf: new Map<string, number>() },
    UnitPrices: { rows: exploded.UnitPrices, headers: [] as string[], columnOf: new Map<string, number>() },
  } as Record<SheetId, { rows: RawRow[]; headers: string[] }>;

  return assembleProducts(sheets, schema, masterIndex, args, errors, warnings, imageFiles, {}, args.masters);
};

/**
 * Turn a validator issue into a spreadsheet coordinate the user can navigate
 * to. Without this the report says "salesrate must be greater than 0" with no
 * indication of which of 900 rows it means.
 */
const mapIssueToRow = (
  issue: ValidationIssue,
  ref: string,
  productRow: RawRow,
  variantRows: RawRow[],
  childRowsOf: (variant: RawRow, sheetId: "UnitConversions" | "UnitPrices") => RawRow[]
): RowError => {
  const base = { value: "", ref, message: issue.message };

  // The validator names fields by payload key ("baseunitid"); the workbook
  // calls that column "Base Unit". buildErrorWorkbook matches on the header,
  // so without the translation the cell is never highlighted.
  const columnFor = (sheet: SheetId) => headerForField(sheet, issue.field) ?? issue.field;

  if (issue.scope === "product") {
    return { ...base, sheet: "Products", row: productRow.row, column: columnFor("Products") };
  }

  const variantRow = issue.variantIndex !== undefined ? variantRows[issue.variantIndex] : undefined;

  if (issue.scope === "variant") {
    return { ...base, sheet: "Variants", row: variantRow?.row ?? null, column: columnFor("Variants") };
  }

  const sheetId = issue.scope === "unitprice" ? "UnitPrices" : "UnitConversions";
  const rows = variantRow ? childRowsOf(variantRow, sheetId) : [];
  const target = issue.rowIndex !== undefined ? rows[issue.rowIndex] : undefined;

  return { ...base, sheet: sheetId, row: target?.row ?? null, column: columnFor(sheetId) };
};

/* ------------------------------------------------------------------ *
 * Corrected-file download
 * ------------------------------------------------------------------ */

/**
 * Hand the user back their own file with the bad cells filled red, a note on
 * each explaining the problem, and an _Errors column per sheet. Fixing in
 * place and re-uploading beats hunting by row number.
 */
export const buildErrorWorkbook = async (
  file: File | ArrayBuffer,
  errors: RowError[]
): Promise<Blob> => {
  const ExcelJSModule = (await import("exceljs")).default;
  const workbook: ExcelJS.Workbook = new ExcelJSModule.Workbook();
  const buffer = file instanceof ArrayBuffer ? file : await (file as File).arrayBuffer();
  await workbook.xlsx.load(buffer);

  const bySheet = new Map<string, RowError[]>();
  for (const error of errors) {
    if (error.sheet === "File") continue;
    const bucket = bySheet.get(error.sheet) ?? [];
    bucket.push(error);
    bySheet.set(error.sheet, bucket);
  }

  for (const [sheetName, sheetErrors] of bySheet) {
    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet) continue;

    // Header lookup so we can colour the exact offending cell.
    const headerToCol = new Map<string, number>();
    sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const text = norm(cellValue(cell)).replace(/\s*\*$/, "");
      if (text) headerToCol.set(text.toLowerCase(), colNumber);
    });

    const errorCol = sheet.columnCount + 1;
    const headerCell = sheet.getCell(1, errorCol);
    headerCell.value = "_Errors";
    headerCell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF99302B" } };
    sheet.getColumn(errorCol).width = 60;

    const byRow = new Map<number, RowError[]>();
    for (const error of sheetErrors) {
      if (!error.row) continue;
      const bucket = byRow.get(error.row) ?? [];
      bucket.push(error);
      byRow.set(error.row, bucket);
    }

    for (const [rowNumber, rowErrors] of byRow) {
      sheet.getCell(rowNumber, errorCol).value = rowErrors.map((e) => e.message).join(" | ");

      for (const error of rowErrors) {
        if (!error.column) continue;
        const colNumber = headerToCol.get(error.column.toLowerCase());
        if (!colNumber) continue;
        const cell = sheet.getCell(rowNumber, colNumber);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7E7E5" } };
        cell.border = {
          top: { style: "thin", color: { argb: "FF99302B" } },
          left: { style: "thin", color: { argb: "FF99302B" } },
          bottom: { style: "thin", color: { argb: "FF99302B" } },
          right: { style: "thin", color: { argb: "FF99302B" } },
        };
        cell.note = error.message;
      }
    }
  }

  const out = await workbook.xlsx.writeBuffer();
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
};
