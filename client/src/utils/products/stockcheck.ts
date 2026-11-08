import type { InvoiceProduct } from "../../components/productsection";

// Stock shortfall check over the whole invoice list (catches pre-filled lines); mirrors server stockguard.

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

/** Base qty this variant already holds on the saved invoice being edited (credited back, as the server does). */
export const getReservedBaseQty = (
  originalProducts: InvoiceProduct[] | undefined,
  productId: string,
  variantId: string,
  variant: any
): number => {
  if (!originalProducts?.length) return 0;
  return originalProducts.reduce((sum, line) => {
    if (idOf(line.productserviceid) !== productId) return sum;
    if (idOf(line.variantid) !== variantId) return sum;
    return sum + lineBaseQty(line, variant);
  }, 0);
};

/** One entry per variant whose invoice total exceeds branch stock. */
export const getStockShortfalls = (
  products: InvoiceProduct[],
  productData: any[],
  opts: {
    isService?: boolean;
    /** Saved lines of the bill being edited; credited back before comparing. */
    originalProducts?: InvoiceProduct[];
  } = {}
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
    // No variant record: nothing to compare, the server lets it through too.
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
    // Quantity already reserved by this invoice counts as available.
    const reserved = getReservedBaseQty(
      opts.originalProducts,
      String(product.id ?? product._id ?? ""),
      String(variant.id ?? variant._id ?? ""),
      variant
    );
    const available = Number(variant.currentstock ?? 0) + reserved;
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
