import type ExcelJS from "exceljs";
import {
  buildProductSheetSchema,
  MASTER_LABELS,
  META_SHEET,
  SHEET_ORDER,
  type ColumnDef,
  type MasterKey,
  type SheetId,
} from "./productschema";
import { idColumnHeader, type MasterLists, type MasterOption } from "./exportproducts";
import { validateProduct, type ValidationIssue } from "../products/validateproduct";

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
  meta: Record<string, string>;
}

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

const readSheet = (
  workbook: ExcelJS.Workbook,
  sheetId: SheetId
): { rows: RawRow[]; headers: string[] } => {
  const sheet = workbook.getWorksheet(sheetId);
  if (!sheet) return { rows: [], headers: [] };

  const headers: string[] = [];
  const headerRow = sheet.getRow(1);
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    // "Name *" in the template means required — strip the marker.
    headers[colNumber] = norm(cellValue(cell)).replace(/\s*\*$/, "");
  });

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

  return { rows, headers: headers.filter(Boolean) };
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
      const nameKey = normKey(option.name);
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
    const matches = index?.byName.get(normKey(displayValue)) ?? [];
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
    return { products: [], refs: [], errors, warnings, counts: {}, imageFiles, meta };
  }

  /* ---- read the four sheets ---- */
  const sheets = Object.fromEntries(
    SHEET_ORDER.map((id) => [id, readSheet(workbook, id)])
  ) as Record<SheetId, { rows: RawRow[]; headers: string[] }>;

  return assembleProducts(sheets, schema, masterIndex, args, errors, warnings, imageFiles, meta);
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
  meta: Record<string, string>
): ParsedImport => {

  const counts: Record<string, number> = {};
  for (const id of SHEET_ORDER) counts[id] = sheets[id].rows.length;

  /* ---- columns present in the file but switched off in settings ---- */
  for (const sheetDef of schema.sheets) {
    const known = new Set(
      sheetDef.columns.flatMap((c) =>
        c.type === "ref" ? [c.header, idColumnHeader(c)] : [c.header]
      )
    );
    const unknown = sheets[sheetDef.id].headers.filter((h) => h && !known.has(h));
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
        case "keywords":
        case "imageurls":
        case "imagefiles":
          out[col.key] = splitList(value);
          break;
        default:
          out[col.key] = norm(value);
      }
    }
    return out;
  };

  /* ---- group the child sheets by their join keys ---- */
  const groupBy = (rows: RawRow[], keyOf: (r: RawRow) => string) => {
    const map = new Map<string, RawRow[]>();
    for (const row of rows) {
      const key = keyOf(row);
      const bucket = map.get(key) ?? [];
      bucket.push(row);
      map.set(key, bucket);
    }
    return map;
  };

  const refKey = (productRef: string, variantRef: string) =>
    `${normKey(productRef)}||${normKey(variantRef)}`;

  const variantsByProduct = groupBy(sheets.Variants.rows, (r) => normKey(r.values["ProductRef"]));
  const conversionsByVariant = groupBy(sheets.UnitConversions.rows, (r) =>
    refKey(r.values["ProductRef"], r.values["VariantRef"])
  );
  const pricesByVariant = groupBy(sheets.UnitPrices.rows, (r) =>
    refKey(r.values["ProductRef"], r.values["VariantRef"])
  );

  /* ---- orphan child rows: a real user mistake worth naming ---- */
  const productRefs = new Set(sheets.Products.rows.map((r) => normKey(r.values["ProductRef"])));
  const flagOrphans = (sheetId: SheetId, rows: RawRow[]) => {
    for (const row of rows) {
      const pRef = normKey(row.values["ProductRef"]);
      if (!pRef) {
        errors.push({
          sheet: sheetId,
          row: row.row,
          column: "ProductRef",
          value: "",
          message: "ProductRef is blank — this row is not attached to any product.",
        });
      } else if (!productRefs.has(pRef)) {
        errors.push({
          sheet: sheetId,
          row: row.row,
          column: "ProductRef",
          value: norm(row.values["ProductRef"]),
          ref: norm(row.values["ProductRef"]),
          message: `No product on the Products sheet has this ProductRef.`,
        });
      }
    }
  };
  flagOrphans("Variants", sheets.Variants.rows);
  flagOrphans("UnitConversions", sheets.UnitConversions.rows);
  flagOrphans("UnitPrices", sheets.UnitPrices.rows);

  /* ---- assemble ---- */
  const products: any[] = [];
  const refs: string[] = [];
  const seenRefs = new Set<string>();

  for (const productRow of sheets.Products.rows) {
    const ref = norm(productRow.values["ProductRef"]);

    if (!ref) {
      errors.push({
        sheet: "Products",
        row: productRow.row,
        column: "ProductRef",
        value: "",
        message: "ProductRef is required — it is how the variant and pricing rows find this product.",
      });
      continue;
    }
    if (seenRefs.has(normKey(ref))) {
      errors.push({
        sheet: "Products",
        row: productRow.row,
        column: "ProductRef",
        value: ref,
        ref,
        message: `ProductRef "${ref}" is used more than once on the Products sheet.`,
      });
      continue;
    }
    seenRefs.add(normKey(ref));

    const fields = readRow("Products", productRow, ref);

    if (Array.isArray(fields.imagefiles) && fields.imagefiles.length) {
      imageFiles.set(ref, fields.imagefiles);
    }

    const variantRows = variantsByProduct.get(normKey(ref)) ?? [];
    if (!variantRows.length) {
      errors.push({
        sheet: "Products",
        row: productRow.row,
        column: "ProductRef",
        value: ref,
        ref,
        message: `No rows on the Variants sheet use ProductRef "${ref}". Every product needs at least one variant.`,
      });
    }

    const productvariants = variantRows.map((variantRow) => {
      const variantRef = norm(variantRow.values["VariantRef"]);
      const variantFields = readRow("Variants", variantRow, ref);
      const key = refKey(ref, variantRef);

      if (!variantRef) {
        errors.push({
          sheet: "Variants",
          row: variantRow.row,
          column: "VariantRef",
          value: "",
          ref,
          message: "VariantRef is required — it is how the pricing rows find this variant.",
        });
      }

      const unitconversions = (conversionsByVariant.get(key) ?? []).map((r) =>
        readRow("UnitConversions", r, ref)
      );
      const unitprices = (pricesByVariant.get(key) ?? []).map((r) => {
        const price = readRow("UnitPrices", r, ref);
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

    const product: any = {
      name: fields.name,
      description: fields.description,
      imageurls: fields.imageurls ?? [],
      imageurl: (fields.imageurls ?? [])[0] ?? "",
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
    // spreadsheet that the form itself would have rejected.
    const { issues } = validateProduct(product, args.permissions);
    for (const issue of issues) {
      errors.push(mapIssueToRow(issue, ref, sheets, productRow, variantRows, refKey));
    }

    products.push(product);
    refs.push(ref);
  }

  return { products, refs, errors, warnings, counts, imageFiles, meta };
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
    Products: { rows: exploded.Products, headers: [] as string[] },
    Variants: { rows: exploded.Variants, headers: [] as string[] },
    UnitConversions: { rows: exploded.UnitConversions, headers: [] as string[] },
    UnitPrices: { rows: exploded.UnitPrices, headers: [] as string[] },
  } as Record<SheetId, { rows: RawRow[]; headers: string[] }>;

  return assembleProducts(sheets, schema, masterIndex, args, errors, warnings, imageFiles, {});
};

/**
 * Turn a validator issue into a spreadsheet coordinate the user can navigate
 * to. Without this the report says "salesrate must be greater than 0" with no
 * indication of which of 900 rows it means.
 */
const mapIssueToRow = (
  issue: ValidationIssue,
  ref: string,
  sheets: Record<SheetId, { rows: RawRow[] }>,
  productRow: RawRow,
  variantRows: RawRow[],
  refKey: (p: string, v: string) => string
): RowError => {
  const base = { value: "", ref, message: issue.message };

  if (issue.scope === "product") {
    return { ...base, sheet: "Products", row: productRow.row, column: issue.field };
  }

  const variantRow = issue.variantIndex !== undefined ? variantRows[issue.variantIndex] : undefined;

  if (issue.scope === "variant") {
    return { ...base, sheet: "Variants", row: variantRow?.row ?? null, column: issue.field };
  }

  const sheetId: SheetId = issue.scope === "unitprice" ? "UnitPrices" : "UnitConversions";
  const variantRef = norm(variantRow?.values["VariantRef"]);
  const key = refKey(ref, variantRef);
  const childRows = sheets[sheetId].rows.filter(
    (r) => refKey(norm(r.values["ProductRef"]), norm(r.values["VariantRef"])) === key
  );
  const target = issue.rowIndex !== undefined ? childRows[issue.rowIndex] : undefined;

  return { ...base, sheet: sheetId, row: target?.row ?? null, column: issue.field };
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
