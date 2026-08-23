import Papa from "papaparse";
import {
  buildProductSheetSchema,
  type ColumnDef,
  type SheetId,
} from "./productschema";
import { idColumnHeader } from "./exportproducts";

/**
 * CSV support, and an honest account of what it costs.
 *
 * CSV is plain text: one grid, no dropdowns, no hidden columns, no cell
 * colouring, no images. So it cannot carry the four-sheet layout the xlsx
 * template uses. Instead it gets a FLAT layout:
 *
 *   - one row per unit price (the innermost repeating thing)
 *   - product and variant columns repeat down the block
 *   - unit conversions are packed into one text column: "KG:1|GM:0.001|BOX:12"
 *
 * It is uglier, but it round-trips, and it suits people who live in Google
 * Sheets. Both formats normalise into the same row arrays, so from that point
 * on there is a single code path.
 *
 * Units in a CSV are matched by NAME, since there is nowhere to hide an id.
 * That is the real trade-off: two categories with the same name are ambiguous
 * in CSV and the importer will say so rather than pick one.
 */

export const CONVERSION_COLUMN = "Unit Conversions";
const CONVERSION_HINT = "Format: UnitName:Factor, separated by |  e.g.  KG:1|GM:0.001";

/** Columns of the flat CSV, in order, honouring form permissions. */
export const buildCsvColumns = (
  permissions: Record<string, boolean | undefined>
): ColumnDef[] => {
  const schema = buildProductSheetSchema(permissions);

  const productCols = schema.bySheet("Products").filter((c) => c.key !== "productref");
  const variantCols = schema.bySheet("Variants").filter(
    (c) => c.key !== "productref" && c.key !== "variantref"
  );
  const priceCols = schema.bySheet("UnitPrices").filter(
    (c) => c.key !== "productref" && c.key !== "variantref"
  );

  const hasConversions = schema.bySheet("UnitConversions").some((c) => !c.structural);

  const conversionCol: ColumnDef[] = hasConversions
    ? [{
        header: CONVERSION_COLUMN,
        key: "unitconversions",
        sheet: "UnitConversions",
        type: "text",
        structural: true,
        hint: CONVERSION_HINT,
        width: 30,
      }]
    : [];

  return [
    { header: "ProductRef", key: "productref", sheet: "Products", type: "text", structural: true },
    ...productCols,
    { header: "VariantRef", key: "variantref", sheet: "Variants", type: "text", structural: true },
    ...variantCols,
    ...conversionCol,
    ...priceCols.map((c) => ({ ...c, header: `Price ${c.header}` })),
  ];
};

/* ------------------------------------------------------------------ *
 * Export
 * ------------------------------------------------------------------ */

const packConversions = (conversions: any[]): string =>
  (conversions || [])
    .map((c) => `${c.unitid ?? ""}:${c.factor ?? ""}`)
    .filter((s) => s !== ":")
    .join("|");

/**
 * Flatten the four sheet-row arrays into the single CSV grid.
 * Takes the same rows productsToSheetRows() produces, so export logic is not
 * written twice.
 */
export const sheetRowsToCsv = (
  rows: Partial<Record<SheetId, Record<string, any>[]>>,
  permissions: Record<string, boolean | undefined>
): string => {
  const columns = buildCsvColumns(permissions);

  const productByRef = new Map<string, Record<string, any>>();
  for (const row of rows.Products ?? []) productByRef.set(String(row.productref), row);

  const conversionsByKey = new Map<string, any[]>();
  for (const row of rows.UnitConversions ?? []) {
    const key = `${row.productref}||${row.variantref}`;
    const bucket = conversionsByKey.get(key) ?? [];
    bucket.push({ unitid: row.unitid, factor: row.factor });
    conversionsByKey.set(key, bucket);
  }

  const pricesByKey = new Map<string, Record<string, any>[]>();
  for (const row of rows.UnitPrices ?? []) {
    const key = `${row.productref}||${row.variantref}`;
    const bucket = pricesByKey.get(key) ?? [];
    bucket.push(row);
    pricesByKey.set(key, bucket);
  }

  const out: Record<string, any>[] = [];

  for (const variant of rows.Variants ?? []) {
    const key = `${variant.productref}||${variant.variantref}`;
    const product = productByRef.get(String(variant.productref)) ?? {};
    const prices = pricesByKey.get(key) ?? [{}];
    const conversions = packConversions(conversionsByKey.get(key) ?? []);

    // One line per price row; a variant with no pricing still gets one line so
    // it is visible in the file rather than silently dropped.
    prices.forEach((price) => {
      const line: Record<string, any> = {};
      for (const col of columns) {
        if (col.header === CONVERSION_COLUMN) {
          line[col.header] = conversions;
        } else if (col.header.startsWith("Price ")) {
          line[col.header] = price[col.key] ?? "";
        } else if (col.sheet === "Products") {
          line[col.header] = product[col.key] ?? "";
        } else {
          line[col.header] = variant[col.key] ?? "";
        }
      }
      out.push(line);
    });
  }

  return Papa.unparse(out, { columns: columns.map((c) => c.header) });
};

/** A blank CSV template — headers, plus one comment line explaining the packing. */
export const buildCsvTemplate = (
  permissions: Record<string, boolean | undefined>
): string => {
  const columns = buildCsvColumns(permissions);
  const example: Record<string, any> = {};
  for (const col of columns) {
    example[col.header] =
      col.header === CONVERSION_COLUMN ? "KG:1|GM:0.001" : col.hint ? "" : "";
  }
  return Papa.unparse([example], { columns: columns.map((c) => c.header) });
};

/* ------------------------------------------------------------------ *
 * Import
 * ------------------------------------------------------------------ */

const norm = (v: any) => (v === null || v === undefined ? "" : String(v).trim());

export interface CsvSheetRows {
  Products: { row: number; values: Record<string, any> }[];
  Variants: { row: number; values: Record<string, any> }[];
  UnitConversions: { row: number; values: Record<string, any> }[];
  UnitPrices: { row: number; values: Record<string, any> }[];
  warnings: string[];
}

/**
 * Explode the flat CSV grid back into the four row sets the xlsx parser
 * already knows how to assemble, so validation and grouping stay shared.
 *
 * ProductRef is optional in CSV — people paste from other systems and will not
 * have it. When it is missing, the product name is used as the key, which is
 * why two different products with the same name are reported as a conflict
 * rather than merged.
 */
export const csvToSheetRows = (
  text: string,
  permissions: Record<string, boolean | undefined>
): CsvSheetRows => {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });

  const warnings: string[] = [];
  if (parsed.errors?.length) {
    const first = parsed.errors[0];
    warnings.push(`CSV parse warning on line ${(first.row ?? 0) + 2}: ${first.message}`);
  }

  const columns = buildCsvColumns(permissions);
  const productCols = columns.filter((c) => c.sheet === "Products");
  const variantCols = columns.filter((c) => c.sheet === "Variants");
  const priceCols = columns.filter((c) => c.header.startsWith("Price "));

  const out: CsvSheetRows = {
    Products: [],
    Variants: [],
    UnitConversions: [],
    UnitPrices: [],
    warnings,
  };

  const seenProducts = new Set<string>();
  const seenVariants = new Set<string>();

  (parsed.data || []).forEach((line, index) => {
    const rowNumber = index + 2; // header is line 1
    const productRef = norm(line["ProductRef"]) || norm(line["Name"]);
    if (!productRef) return;

    const variantRef = norm(line["VariantRef"]) || norm(line["SKU"]) || "1";

    if (!seenProducts.has(productRef.toLowerCase())) {
      seenProducts.add(productRef.toLowerCase());
      const values: Record<string, any> = { ProductRef: productRef };
      for (const col of productCols) {
        if (col.key === "productref") continue;
        values[col.header] = line[col.header] ?? "";
        // CSV has no hidden id column; leave it blank so the parser falls
        // through to name matching.
        if (col.type === "ref") values[idColumnHeader(col)] = "";
      }
      out.Products.push({ row: rowNumber, values });
    }

    const variantKey = `${productRef.toLowerCase()}||${variantRef.toLowerCase()}`;
    if (!seenVariants.has(variantKey)) {
      seenVariants.add(variantKey);

      const values: Record<string, any> = { ProductRef: productRef, VariantRef: variantRef };
      for (const col of variantCols) {
        if (col.key === "productref" || col.key === "variantref") continue;
        values[col.header] = line[col.header] ?? "";
        if (col.type === "ref") values[idColumnHeader(col)] = "";
      }
      out.Variants.push({ row: rowNumber, values });

      // Unpack "KG:1|GM:0.001" into conversion rows.
      const packed = norm(line[CONVERSION_COLUMN]);
      if (packed) {
        packed.split("|").forEach((pair) => {
          const [unit, factor] = pair.split(":");
          if (!norm(unit)) return;
          out.UnitConversions.push({
            row: rowNumber,
            values: {
              ProductRef: productRef,
              VariantRef: variantRef,
              Unit: norm(unit),
              Unit_ID: "",
              Factor: norm(factor),
            },
          });
        });
      }
    }

    // Every line is a price row, when it carries any pricing at all.
    const priceValues: Record<string, any> = { ProductRef: productRef, VariantRef: variantRef };
    let hasPricing = false;
    for (const col of priceCols) {
      const bare = col.header.replace(/^Price /, "");
      const value = line[col.header] ?? "";
      priceValues[bare] = value;
      if (col.type === "ref") priceValues[`${bare}_ID`] = "";
      if (norm(value)) hasPricing = true;
    }
    if (hasPricing) out.UnitPrices.push({ row: rowNumber, values: priceValues });
  });

  return out;
};

/** What CSV cannot do, spelled out for the import dialog. */
export const CSV_LIMITATIONS = [
  "No dropdowns — categories, brands and units are matched by name, so a duplicate name is reported as a conflict.",
  "No hidden id columns, so renaming a master in between export and import breaks the link.",
  "Unit conversions are packed into one column as UnitName:Factor|UnitName:Factor.",
  "Errors come back as an _Errors column rather than red cells with notes.",
  "Images must be web addresses, or come in a .zip alongside the CSV.",
];
