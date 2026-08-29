import { siteConfig } from "../config/site";

// Indian Rupee formatting used across every page — one place to change if
// the number grouping or currency symbol ever needs to move.
export function formatPrice(amount: number): string {
  return `${siteConfig.currency}${Math.round(amount).toLocaleString("en-IN")}`;
}

export function discountPercent(price: number, mrp: number): number {
  if (!mrp || mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

// Category names come straight from each admin's own catalog, so their casing
// is whatever that business typed — some enter them in full caps ("MAGIC CAR"),
// which reads as shouting next to a normally-cased label like "All Categories".
// Only all-caps names are re-cased; anything carrying a lowercase letter is the
// business's deliberate choice ("Fruits & Vegetables", "iPhone Accessories") and
// is returned untouched. Capitalises after any non-letter, so "A/C" and
// "FRUITS & VEGETABLES" survive intact.
export function titleCaseIfShouting(name: string): string {
  if (!name || !/\p{Lu}/u.test(name) || name !== name.toUpperCase()) return name;
  return name
    .toLowerCase()
    .replace(/(^|[^\p{L}])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}
