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
