import type ExcelJS from "exceljs";
import {
  buildProductSheetSchema,
  headerIndex,
  isCreatableMaster,
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
  enumRanges: Map<string, string>,
  /** The Products sheet's product keys, for the child sheets' "Product Code" dropdown. */
  productListFormula?: string,
  /** Products sheet only: where to write the hidden per-row key the list reads. */
  productKey?: { index: number; codeLetter: string; nameLetter: string },
  /** Where Product Code / VariantRef sit on the Variants sheet, for the VariantRef dropdown. */
  variantsCols?: { productLetter: string; refLetter: string }
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

    // "Product Code" on the child sheets: a live dropdown of every product on
    // the Products sheet — its code, or its name while the code is blank. A
    // code typed there appears here at once. Typing is still allowed.
    // VariantRef on the conversion / price sheets: a dropdown of just the
    // chosen product's variants. OFFSET+MATCH+COUNTIF rather than FILTER, so
    // it works in every Excel version — it expects a product's variant rows to
    // sit together on the Variants sheet (as exported, and as people type
    // them). Typing stays allowed and the importer checks every VariantRef.
    if (
      def.structural && def.key === "variantref" && variantsCols &&
      (sheetId === "UnitConversions" || sheetId === "UnitPrices")
    ) {
      const productCol = laidOut.find((c) => c.def.key === "productref");
      if (productCol) {
        const own = colLetter(productCol.index);
        const { productLetter: vp, refLetter: vr } = variantsCols;
        for (let r = 2; r <= lastRow; r++) {
          sheet.getCell(r, index).dataValidation = {
            type: "list",
            allowBlank: true,
            formulae: [
              `OFFSET(Variants!$${vr}$1,MATCH(${own}${r},Variants!$${vp}:$${vp},0)-1,0,MAX(COUNTIF(Variants!$${vp}:$${vp},${own}${r}),1),1)`,
            ],
            showErrorMessage: false,
          };
        }
      }
      continue;
    }

    if (def.structural && def.key === "productref" && sheetId !== "Products" && productListFormula) {
      for (let r = 2; r <= lastRow; r++) {
        sheet.getCell(r, index).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [productListFormula],
          showErrorMessage: false,
        };
      }
      continue;
    }

    if (def.type === "ref" && def.master) {
      const nameRange = masterNameRange(def.master);
      const label = MASTER_LABELS[def.master];
      // Category, Brand, Unit... accept a typed name that is not in the list —
      // the import creates it. The dropdown stays, but no popup: Excel can't
      // remember an accepted value (the list lives on the hidden master sheet),
      // so it would ask again on every cell. The import review lists every
      // new record once instead — that is the real confirmation.
      const creatable = isCreatableMaster(def.master);
      const validation = creatable
        ? {
            showErrorMessage: false,
            errorStyle: "information" as const,
          }
        : {
            showErrorMessage: true,
            errorStyle: "stop" as const,
            errorTitle: `Pick a ${label}`,
            error: `Choose a ${label} from the list. To use a new one, add it under Masters first, then download the template again.`,
          };
      for (let r = 2; r <= lastRow; r++) {
        sheet.getCell(r, index).dataValidation = {
          type: "list",
          allowBlank: !def.required,
          formulae: [`=${nameRange}`],
          ...validation,
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

    // Image cells: Excel can't open a file picker from a cell without macros,
    // so the next best thing — a tooltip the moment the cell is selected,
    // saying exactly where the picture option is.
    if (def.type === "productimage" || def.type === "masterimage") {
      for (let r = 2; r <= lastRow; r++) {
        sheet.getCell(r, index).dataValidation = {
          type: "custom",
          allowBlank: true,
          formulae: ["TRUE"],
          showErrorMessage: false,
          showInputMessage: true,
          promptTitle: "Add a picture",
          // Excel caps an input message at 255 characters.
          // Worded for every Excel: "Place in Cell" only exists in recent
          // Microsoft 365; Office 2019/2021 can only float a picture over the
          // cell — which the import reads just the same.
          prompt: def.type === "productimage"
            ? "Insert > Pictures > This Device. Shrink the picture and keep its top-left corner in this cell (hold Alt while resizing to snap to the cell). Several pictures: put them all here. Newer Microsoft 365: Place in Cell."
            : "Insert > Pictures > This Device. Shrink the picture and keep its top-left corner in this cell (hold Alt while resizing to snap to the cell). Newer Microsoft 365: Place in Cell. Or paste a web address.",
        };
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
      // "General", not "0.00": a factor of 1 should read 1, and 0.001 (grams
      // per kg) must not be displayed as 0.00. The stored value was always
      // right; the fixed two-decimal format just hid it.
      sheet.getColumn(index).numFmt = def.type === "integer" ? "0" : "General";
      // Whole-number columns (Quantity) refuse 1.5 at the cell, so the
      // mistake never reaches the import.
      const whole = def.type === "integer";
      for (let r = 2; r <= lastRow; r++) {
        sheet.getCell(r, index).dataValidation = {
          type: whole ? "whole" : "decimal",
          allowBlank: true,
          operator: "greaterThanOrEqual",
          formulae: [whole ? 1 : 0],
          showErrorMessage: true,
          errorStyle: "stop",
          errorTitle: whole ? `${def.header} must be a whole number` : `${def.header} must be a number`,
          error: whole
            ? `Enter a whole number of 1 or more for ${def.header} (1, 2, 3…) — no decimals.`
            : `Enter a number of 0 or more for ${def.header}.`,
        };
      }
      continue;
    }

    if (def.type === "date") {
      sheet.getColumn(index).numFmt = "dd/mm/yyyy";
    }
  }

  // Products sheet: a hidden column holding each row's key — the Product Code,
  // or the Name while the code is blank — which the child sheets' dropdown
  // lists. "&''" keeps a numeric code as text so COUNTIF(…,"?*") counts it.
  // It sits in the same row as the product, so sorting the sheet keeps it
  // right. The importer ignores it (its header starts with "__").
  if (sheetId === "Products" && productKey) {
    const { index, codeLetter, nameLetter } = productKey;
    const header = sheet.getCell(1, index);
    header.value = PRODUCT_KEY_HEADER;
    sheet.getColumn(index).hidden = true;
    for (let r = 2; r <= lastRow; r++) {
      const data = rows[r - 2];
      const result = data ? String(data.productref || data.name || "") : "";
      sheet.getCell(r, index).value = {
        formula: `IF(${codeLetter}${r}<>"",${codeLetter}${r}&"",IF(${nameLetter}${r}<>"",${nameLetter}${r}&"",""))`,
        result,
      } as any;
    }
  }

  return sheet;
};

/** Hidden helper column on the Products sheet (never imported). */
const PRODUCT_KEY_HEADER = "__productkey";

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

  // The child sheets' "Product Code" dropdown reads a hidden key column on
  // the Products sheet (code, or name while the code is blank), placed after
  // the last real column. OFFSET/COUNTIF keeps the list to filled rows only.
  const productLayout = layoutColumns(schema.bySheet("Products"));
  const codeColumn = productLayout.find((c) => c.def.key === "productref");
  const nameColumn = productLayout.find((c) => c.def.key === "name");
  const keyIndex = Math.max(...productLayout.map((c) => c.idIndex ?? c.index)) + 1;
  const keyLetter = colLetter(keyIndex);
  const productKey =
    codeColumn && nameColumn
      ? { index: keyIndex, codeLetter: colLetter(codeColumn.index), nameLetter: colLetter(nameColumn.index) }
      : undefined;
  const variantLayout = layoutColumns(schema.bySheet("Variants"));
  const vProduct = variantLayout.find((c) => c.def.key === "productref");
  const vRef = variantLayout.find((c) => c.def.key === "variantref");
  const variantsCols =
    vProduct && vRef ? { productLetter: colLetter(vProduct.index), refLetter: colLetter(vRef.index) } : undefined;

  const listEnd = Math.max((args.data?.Products?.length ?? 0) + 1, VALIDATED_ROWS);
  const productListFormula = productKey
    ? `OFFSET(Products!$${keyLetter}$2,0,0,MAX(COUNTIF(Products!$${keyLetter}$2:$${keyLetter}$${listEnd},"?*"),1),1)`
    : undefined;

  for (const sheet of schema.sheets) {
    writeDataSheet(
      workbook,
      sheet.id,
      sheet.columns,
      args.data?.[sheet.id] ?? [],
      enumRanges,
      productListFormula,
      sheet.id === "Products" ? productKey : undefined,
      variantsCols
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
    // The product's code lives on the Products sheet. The other sheets point
    // back with that code — or the name, for a product that has none.
    const productCode: string = variants[0]?.productcode || "";
    const productLink: string = productCode || product.name || `Product ${productIndex + 1}`;

    const imageUrls: string[] = Array.isArray(product.imageurls) && product.imageurls.length
      ? product.imageurls
      : product.imageurl
        ? [product.imageurl]
        : [];

    productRows.push({
      productref: productCode,
      name: product.name ?? "",
      description: product.description ?? "",
      // The current pictures as web addresses: re-importing keeps them.
      productimage: imageUrls.join(", "),
      categoryid: nameOf(product.categoryid, "categoryname"),
      categoryid__id: idOf(product.categoryid),
      categoryimage: nameOf(product.categoryid, "image"),
      subcategoryid: nameOf(product.subcategoryid, "subcategoryname"),
      subcategoryid__id: idOf(product.subcategoryid),
      subcategoryimage: nameOf(product.subcategoryid, "image"),
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
      // A VariantRef only when there is more than one variant to tell apart.
      const skuIsUnique =
        !!variant?.sku && variants.filter((v: any) => v?.sku === variant.sku).length === 1;
      const variantRef =
        variants.length > 1 ? (skuIsUnique ? variant.sku : String(variantIndex + 1)) : "";

      variantRows.push({
        productref: productLink,
        variantref: variantRef,
        name: variant.name ?? "",
        sku: variant.sku ?? "",
        // The first variant's code is the Product Code on the Products sheet.
        productcode: variantIndex === 0 ? "" : variant.productcode ?? "",
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
          productref: productLink,
          variantref: variantRef,
          unitid: nameOf(conv.unitid, "unitname"),
          unitid__id: idOf(conv.unitid),
          factor: conv.factor ?? "",
        });
      });

      (variant.unitprices || []).forEach((price: any) => {
        priceRows.push({
          productref: productLink,
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
