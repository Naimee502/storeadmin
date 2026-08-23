import type ExcelJS from "exceljs";
import {
  buildProductSheetSchema,
  headerIndex,
  masterIdRange,
  masterNameRange,
  MASTER_SHEET,
  META_SHEET,
  MASTER_LABELS,
  type ColumnDef,
  type MasterKey,
  type ProductSheetSchema,
  type SheetId,
} from "./productschema";

/**
 * Writes the product workbook — both the blank template and the populated
 * export, because they are the same file with and without rows.
 *
 * ExcelJS rather than SheetJS: the xlsx@0.18.5 community build reads data
 * validation but cannot write it, so a template made with it would have no
 * dropdowns at all. ExcelJS is loaded with a dynamic import so its ~900KB
 * stays out of the main bundle until someone actually clicks Import or Export.
 */

export interface MasterOption {
  id: string;
  name: string;
  parentid?: string | null;
}

export type MasterLists = Record<MasterKey, MasterOption[]>;

export interface WorkbookMeta {
  adminid: string;
  branchid?: string | null;
  branchname?: string;
  /** Field ids switched off, recorded so import can explain a missing column. */
  disabledFields: string[];
}

/** Bump when the sheet layout changes in a way an old file can't satisfy. */
export const SCHEMA_VERSION = 1;

/** Rows of dropdown validation to lay down — generous, so pasting works. */
const VALIDATED_ROWS = 5000;

const ENUM_SHEET_KEY = "__enums__";

const colLetter = (index: number): string => {
  let n = index;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
};

/* ------------------------------------------------------------------ *
 * Reference columns get TWO columns: the visible name and a hidden id.
 *
 * The hidden one is an INDEX/MATCH against the master sheet, so it resolves
 * live as the user picks from the dropdown. Import reads the id first and
 * falls back to matching the name — which is what makes it impossible to
 * attach a product to the wrong record just because two of them share a name.
 * ------------------------------------------------------------------ */

export const idColumnHeader = (col: ColumnDef) => `${col.header}_ID`;

interface LaidOutColumn {
  def: ColumnDef;
  /** 1-based position of the visible column. */
  index: number;
  /** 1-based position of the hidden id column, for `ref` types. */
  idIndex?: number;
}

const layoutColumns = (columns: ColumnDef[]): LaidOutColumn[] => {
  const out: LaidOutColumn[] = [];
  let cursor = 1;
  for (const def of columns) {
    const entry: LaidOutColumn = { def, index: cursor };
    cursor += 1;
    if (def.type === "ref") {
      entry.idIndex = cursor;
      cursor += 1;
    }
    out.push(entry);
  }
  return out;
};

/* ------------------------------------------------------------------ *
 * Hidden master sheet
 * ------------------------------------------------------------------ */

const writeMasterSheet = (
  workbook: ExcelJS.Workbook,
  masters: Partial<MasterLists>,
  mastersUsed: MasterKey[],
  enumValues: string[][]
) => {
  const sheet = workbook.addWorksheet(MASTER_SHEET);

  let column = 1;

  for (const key of mastersUsed) {
    const options = masters[key] ?? [];
    const nameCol = colLetter(column);
    const idCol = colLetter(column + 1);

    sheet.getCell(`${nameCol}1`).value = MASTER_LABELS[key];
    sheet.getCell(`${idCol}1`).value = `${MASTER_LABELS[key]} id`;

    options.forEach((option, i) => {
      sheet.getCell(`${nameCol}${i + 2}`).value = option.name;
      sheet.getCell(`${idCol}${i + 2}`).value = option.id;
    });

    const last = Math.max(options.length + 1, 2);
    workbook.definedNames.add(`${MASTER_SHEET}!$${nameCol}$2:$${nameCol}$${last}`, masterNameRange(key));
    workbook.definedNames.add(`${MASTER_SHEET}!$${idCol}$2:$${idCol}$${last}`, masterIdRange(key));

    column += 2;
  }

  // Enum lists (Active/Inactive, Yes/No, Fixed/Percentage) live here too, so
  // every dropdown in the file has a real source range rather than an inline
  // list — inline lists silently break past 255 characters.
  const enumRanges = new Map<string, string>();
  enumValues.forEach((values, i) => {
    const letter = colLetter(column + i);
    sheet.getCell(`${letter}1`).value = "Options";
    values.forEach((value, r) => {
      sheet.getCell(`${letter}${r + 2}`).value = value;
    });
    const name = `${ENUM_SHEET_KEY}_${i}`.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    workbook.definedNames.add(
      `${MASTER_SHEET}!$${letter}$2:$${letter}$${values.length + 1}`,
      name
    );
    enumRanges.set(values.join("|"), name);
  });

  sheet.state = "veryHidden";
  return enumRanges;
};

const writeMetaSheet = (workbook: ExcelJS.Workbook, meta: WorkbookMeta) => {
  const sheet = workbook.addWorksheet(META_SHEET);
  const rows: [string, string][] = [
    ["schemaVersion", String(SCHEMA_VERSION)],
    ["adminid", meta.adminid],
    ["branchid", meta.branchid ?? ""],
    ["branchname", meta.branchname ?? ""],
    ["generatedAt", new Date().toISOString()],
    ["disabledFields", meta.disabledFields.join(",")],
  ];
  rows.forEach(([k, v], i) => {
    sheet.getCell(`A${i + 1}`).value = k;
    sheet.getCell(`B${i + 1}`).value = v;
  });
  sheet.state = "veryHidden";
};

/* ------------------------------------------------------------------ *
 * Data sheets
 * ------------------------------------------------------------------ */

const HEADER_FILL = "FF1F3B4D";
const REQUIRED_FILL = "FF7A3E00";

const writeDataSheet = (
  workbook: ExcelJS.Workbook,
  sheetId: SheetId,
  columns: ColumnDef[],
  rows: Record<string, any>[],
  enumRanges: Map<string, string>
) => {
  const sheet = workbook.addWorksheet(sheetId, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  const laidOut = layoutColumns(columns);

  // Header row.
  for (const { def, index, idIndex } of laidOut) {
    const cell = sheet.getCell(1, index);
    cell.value = def.required ? `${def.header} *` : def.header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: def.required ? REQUIRED_FILL : HEADER_FILL },
    };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    sheet.getColumn(index).width = def.width ?? 18;

    if (def.hint) {
      cell.note = def.hint;
    }

    if (idIndex) {
      const idCell = sheet.getCell(1, idIndex);
      idCell.value = idColumnHeader(def);
      idCell.font = { bold: true, color: { argb: "FF9AA6B2" }, size: 9 };
      const column = sheet.getColumn(idIndex);
      column.width = 26;
      column.hidden = true;
    }
  }
  sheet.getRow(1).height = 22;

  // Data rows.
  rows.forEach((row, rowIndex) => {
    const excelRow = rowIndex + 2;
    for (const { def, index, idIndex } of laidOut) {
      const value = row[def.key];
      if (value !== undefined && value !== null && value !== "") {
        sheet.getCell(excelRow, index).value = value as any;
      }
      if (idIndex) {
        const idValue = row[`${def.key}__id`];
        if (idValue) sheet.getCell(excelRow, idIndex).value = String(idValue);
      }
    }
  });

  // Validation + the id formula, applied down the sheet so pasting works.
  const lastRow = Math.max(rows.length + 1, VALIDATED_ROWS);

  for (const { def, index, idIndex } of laidOut) {
    const letter = colLetter(index);

    if (def.type === "ref" && def.master) {
      const nameRange = masterNameRange(def.master);
      for (let r = 2; r <= lastRow; r++) {
        sheet.getCell(r, index).dataValidation = {
          type: "list",
          allowBlank: !def.required,
          formulae: [`=${nameRange}`],
          showErrorMessage: true,
          errorStyle: "stop",
          errorTitle: `Pick a ${MASTER_LABELS[def.master]}`,
          error: `Choose a ${MASTER_LABELS[def.master]} from the list. To use a new one, add it under Masters first, then download the template again.`,
        };
      }

      if (idIndex) {
        const idRange = masterIdRange(def.master);
        const nameRangeRef = masterNameRange(def.master);
        for (let r = 2; r <= lastRow; r++) {
          const target = `${letter}${r}`;
          sheet.getCell(r, idIndex).value = {
            formula: `IF(${target}="","",IFERROR(INDEX(${idRange},MATCH(${target},${nameRangeRef},0)),""))`,
          } as any;
        }
      }
      continue;
    }

    if (def.type === "enum" && def.options?.length) {
      const rangeName = enumRanges.get(def.options.join("|"));
      for (let r = 2; r <= lastRow; r++) {
        sheet.getCell(r, index).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [rangeName ? `=${rangeName}` : `"${def.options.join(",")}"`],
          showErrorMessage: true,
          errorStyle: "stop",
          errorTitle: `Pick a ${def.header}`,
          error: `${def.header} must be one of: ${def.options.join(", ")}.`,
        };
      }
      continue;
    }

    if (def.type === "number" || def.type === "integer") {
      sheet.getColumn(index).numFmt = def.type === "integer" ? "0" : "0.00";
      for (let r = 2; r <= lastRow; r++) {
        sheet.getCell(r, index).dataValidation = {
          type: "decimal",
          allowBlank: true,
          operator: "greaterThanOrEqual",
          formulae: [0],
          showErrorMessage: true,
          errorStyle: "stop",
          errorTitle: `${def.header} must be a number`,
          error: `Enter a number of 0 or more for ${def.header}.`,
        };
      }
      continue;
    }

    if (def.type === "date") {
      sheet.getColumn(index).numFmt = "dd/mm/yyyy";
    }
  }

  return sheet;
};

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

export interface BuildWorkbookArgs {
  permissions: Record<string, boolean | undefined>;
  masters: Partial<MasterLists>;
  meta: WorkbookMeta;
  /** Rows per sheet. Omit for a blank template. */
  data?: Partial<Record<SheetId, Record<string, any>[]>>;
}

export const buildProductWorkbook = async (
  args: BuildWorkbookArgs
): Promise<{ blob: Blob; schema: ProductSheetSchema }> => {
  const ExcelJSModule = (await import("exceljs")).default;
  const workbook: ExcelJS.Workbook = new ExcelJSModule.Workbook();
  workbook.creator = "Product Import";
  workbook.created = new Date();

  const schema = buildProductSheetSchema(args.permissions);

  // Collect the distinct enum option sets so each gets one named range.
  const enumSets = new Map<string, string[]>();
  for (const sheet of schema.sheets) {
    for (const col of sheet.columns) {
      if (col.type === "enum" && col.options?.length) {
        enumSets.set(col.options.join("|"), col.options);
      }
    }
  }

  const enumRanges = writeMasterSheet(
    workbook,
    args.masters,
    schema.mastersUsed,
    Array.from(enumSets.values())
  );

  for (const sheet of schema.sheets) {
    writeDataSheet(
      workbook,
      sheet.id,
      sheet.columns,
      args.data?.[sheet.id] ?? [],
      enumRanges
    );
  }

  writeMetaSheet(workbook, args.meta);

  // The master sheet is added first so named ranges exist before the data
  // sheets reference them, but the user should land on Products.
  const products = workbook.getWorksheet("Products");
  if (products) workbook.views = [{ activeTab: products.id - 1 } as any];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  return { blob, schema };
};

/* ------------------------------------------------------------------ *
 * Turning live products into sheet rows
 * ------------------------------------------------------------------ */

const idOf = (value: any): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  return String(value.id ?? value._id ?? "");
};

const nameOf = (value: any, ...fields: string[]): string => {
  if (!value || typeof value !== "object") return "";
  for (const field of fields) {
    if (value[field]) return String(value[field]);
  }
  return "";
};

const dateOf = (value: any): Date | "" => {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d;
};

/**
 * Flatten the products list into the four sheets.
 *
 * ProductRef is the first variant's product code where one exists, so a file
 * exported here can be edited and re-imported without the user inventing keys.
 */
export const productsToSheetRows = (
  products: any[]
): Partial<Record<SheetId, Record<string, any>[]>> => {
  const productRows: Record<string, any>[] = [];
  const variantRows: Record<string, any>[] = [];
  const conversionRows: Record<string, any>[] = [];
  const priceRows: Record<string, any>[] = [];

  products.forEach((product: any, productIndex: number) => {
    if (product?.isservice) return; // services get their own template later

    const variants: any[] = Array.isArray(product.productvariants) ? product.productvariants : [];
    const productRef =
      variants.find((v: any) => v?.productcode)?.productcode || `P${productIndex + 1}`;

    const imageUrls: string[] = Array.isArray(product.imageurls) && product.imageurls.length
      ? product.imageurls
      : product.imageurl
        ? [product.imageurl]
        : [];

    productRows.push({
      productref: productRef,
      name: product.name ?? "",
      description: product.description ?? "",
      imageurls: imageUrls.join(", "),
      imagefiles: "",
      categoryid: nameOf(product.categoryid, "categoryname"),
      categoryid__id: idOf(product.categoryid),
      subcategoryid: nameOf(product.subcategoryid, "subcategoryname"),
      subcategoryid__id: idOf(product.subcategoryid),
      brandid: nameOf(product.brandid, "brandname"),
      brandid__id: idOf(product.brandid),
      modelid: nameOf(product.modelid, "modelname"),
      modelid__id: idOf(product.modelid),
      sizeid: nameOf(product.sizeid, "sizename"),
      sizeid__id: idOf(product.sizeid),
      groupid: nameOf(product.groupid, "productgroupname"),
      groupid__id: idOf(product.groupid),
      metatitle: product.seo?.metatitle ?? "",
      metadescription: product.seo?.metadescription ?? "",
      keywords: Array.isArray(product.seo?.keywords) ? product.seo.keywords.join(", ") : "",
      slug: product.seo?.slug ?? "",
      status: product.status === false ? "Inactive" : "Active",
      isserialised: product.isserialised ? "Yes" : "No",
      salesaccountid: nameOf(product.salesaccountid, "ledgername"),
      salesaccountid__id: idOf(product.salesaccountid),
      purchaseaccountid: nameOf(product.purchaseaccountid, "ledgername"),
      purchaseaccountid__id: idOf(product.purchaseaccountid),
    });

    variants.forEach((variant: any, variantIndex: number) => {
      const variantRef = variant?.sku || String(variantIndex + 1);

      variantRows.push({
        productref: productRef,
        variantref: variantRef,
        name: variant.name ?? "",
        sku: variant.sku ?? "",
        productcode: variant.productcode ?? "",
        batchnumber: variant.batchnumber ?? "",
        manufacturedate: dateOf(variant.manufacturedate),
        expirydate: dateOf(variant.expirydate),
        gst: variant.gst ?? "",
        hsncode: variant.hsncode ?? "",
        openingstock: variant.openingstock ?? "",
        openingstockamount: variant.openingstockamount ?? "",
        currentstock: variant.currentstock ?? "",
        currentstockamount: variant.currentstockamount ?? "",
        closingstock: variant.closingstock ?? "",
        closingstockamount: variant.closingstockamount ?? "",
        minimumstock: variant.minimumstock ?? "",
        reorderlevel: variant.reorderlevel ?? "",
        racklocation: variant.racklocation ?? "",
        baseunitid: nameOf(variant.baseunitid, "unitname"),
        baseunitid__id: idOf(variant.baseunitid),
        purchaseunitid: nameOf(variant.purchaseunitid, "unitname"),
        purchaseunitid__id: idOf(variant.purchaseunitid),
        purchaserate: variant.purchaserate ?? "",
      });

      (variant.unitconversions || []).forEach((conv: any) => {
        conversionRows.push({
          productref: productRef,
          variantref: variantRef,
          unitid: nameOf(conv.unitid, "unitname"),
          unitid__id: idOf(conv.unitid),
          factor: conv.factor ?? "",
        });
      });

      (variant.unitprices || []).forEach((price: any) => {
        priceRows.push({
          productref: productRef,
          variantref: variantRef,
          quantity: price.quantity ?? "",
          unitid: nameOf(price.unitid, "unitname"),
          unitid__id: idOf(price.unitid),
          mrp: price.mrp ?? "",
          salesrate: price.salesrate ?? "",
          discount: price.discount ?? "",
          discounttype: price.discounttype === "percentage" ? "Percentage" : "Fixed",
          offerprice: price.offerprice ?? "",
        });
      });
    });
  });

  return {
    Products: productRows,
    Variants: variantRows,
    UnitConversions: conversionRows,
    UnitPrices: priceRows,
  };
};

export { headerIndex };
