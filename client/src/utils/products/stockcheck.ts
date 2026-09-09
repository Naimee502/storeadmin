import type { InvoiceProduct } from "../../components/productsection";

/**
 * Sales stock shortfall check for a whole invoice line list.
 *
 * The Add Products box already blocks a hand-typed quantity that exceeds
 * stock, but lines that arrive PRE-FILLED never pass through it — Convert to
 * Invoice from a Sales Order punched on the app or the website, where the
 * catalogue only shows "in stock / out of stock" and never caps the number.
 * This runs over the finished list instead, so those lines are caught too, and
 * it mirrors the server guard (server utils/stockguard) line for line:
 * quantity x unit-quantity, converted to base units, summed per variant.
 */

export interface StockShortfall {
  productname: string;
  variantname?: string | null;
  required: number;
  available: number;
  /** Indices in the products array that make up this shortfall. */
  lineIndexes: number[];
}

const idOf = (value: any): string =>
  !value ? "" : typeof value === "string" ? value : String(value.id ?? "");

/** qty x unit-qty, converted to the variant's base unit — same as the server. */
export const lineBaseQty = (line: InvoiceProduct, variant: any): number => {
  const qty = Number(line.quantity || 0) * Number(line.unitquantity || 1);
  if (!variant) return qty;
  const unitId = idOf(line.salesunitid) || idOf(variant.baseunitid);
  const baseUnitId = idOf(variant.baseunitid);
  if (!unitId || unitId === baseUnitId) return qty;
  const conversion = (variant.unitconversions || []).find(
    (uc: any) => idOf(uc.unitid) === unitId
  );
  return qty * Number(conversion?.factor ?? 1);
};

/**
 * Returns one entry per variant whose total quantity on this invoice exceeds
 * the branch stock. Empty array = nothing to warn about.
 */
export const getStockShortfalls = (
  products: InvoiceProduct[],
  productData: any[],
  opts: { isService?: boolean } = {}
): StockShortfall[] => {
  if (opts.isService) return [];
  if (!products?.length || !productData?.length) return [];

  const byVariant = new Map<
    string,
    { product: any; variant: any; qty: number; lineIndexes: number[] }
  >();

  products.forEach((line, index) => {
    const product = productData.find((p: any) => p.id === idOf(line.productserviceid));
    if (!product) return;
    const variant = (product.productvariants || []).find(
      (v: any) => String(v.id ?? v._id) === idOf(line.variantid)
    );
    // No variant record means no stock record to compare against — the server
    // treats it the same way and lets it through.
    if (!variant) return;

    const key = `${product.id}:${variant.id ?? variant._id}`;
    const entry = byVariant.get(key);
    const qty = lineBaseQty(line, variant);
    if (entry) {
      entry.qty += qty;
      entry.lineIndexes.push(index);
    } else {
      byVariant.set(key, { product, variant, qty, lineIndexes: [index] });
    }
  });

  const shortfalls: StockShortfall[] = [];
  byVariant.forEach(({ product, variant, qty, lineIndexes }) => {
    const available = Number(variant.currentstock ?? 0);
    if (qty > available) {
      shortfalls.push({
        productname: product.name || "Unknown product",
        variantname: variant.name || null,
        required: parseFloat(qty.toFixed(2)),
        available: parseFloat(available.toFixed(2)),
        lineIndexes,
      });
    }
  });

  return shortfalls;
};
