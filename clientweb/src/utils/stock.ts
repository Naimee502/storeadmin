import type { SampleProduct } from "../data/sampleData";

// Same rule ProductCard and the product page use for the "Out of stock"
// label: only a known stock number at or below zero counts. Sample/fallback
// products with no stock number stay "available".
export const isOutOfStock = (p: Pick<SampleProduct, "stock">) =>
  typeof p.stock === "number" && p.stock <= 0;

/**
 * Storefront rule (Amazon / Flipkart style): out-of-stock products are never
 * shown above an in-stock one. Stable — each group keeps whatever order it
 * already had (admin picks, newest, the shopper's chosen sort, ...).
 */
export function inStockFirst<T extends Pick<SampleProduct, "stock">>(list: T[]): T[] {
  const inStock: T[] = [];
  const out: T[] = [];
  for (const p of list) (isOutOfStock(p) ? out : inStock).push(p);
  return out.length ? [...inStock, ...out] : list;
}

/** Wraps a sort comparator so out-of-stock always sorts last first. */
export const stockAware =
  <T extends Pick<SampleProduct, "stock">>(cmp: (a: T, b: T) => number) =>
  (a: T, b: T) => {
    const d = Number(isOutOfStock(a)) - Number(isOutOfStock(b));
    return d !== 0 ? d : cmp(a, b);
  };
