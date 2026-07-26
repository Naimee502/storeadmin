// Shared helpers for anything that displays a SalesOrder — Account page's
// order list, Order Detail, Order Edit. Ported from the app's
// utils/formatters.ts + party Orders screen so the website shows orders in
// exactly the same shape (status derivation, bill number format, dates).

export type FilterKey = "all" | "pending" | "confirmed" | "dispatched" | "delivered" | "cancelled";

// Same derivation the app's Orders/Home/OrderDetail screens use — real
// lifecycle first (cancelled/delivered/dispatched), then the server's
// orderStatus, falling back to isConverted/pending.
export function orderStatus(order: any): FilterKey {
  if (order.cancelStatus === "cancelled") return "cancelled";
  if (order.deliveryStatus === "delivered") return "delivered";
  if (order.deliveryStatus === "dispatched") return "dispatched";
  const os = String(order.orderStatus || "").toLowerCase();
  if (os) return os as FilterKey;
  if (order.isConverted) return "confirmed";
  return "pending";
}

// "SO-000123" for orders, "INV-000123" (the real invoice number) once
// converted — mirrors formatBillNumber() in the app.
export function formatBillNumber(order: any): string {
  const raw = order.isConverted && order.invoicenumber ? order.invoicenumber : order.billnumber ?? "";
  const num = raw ? String(parseInt(raw, 10) || raw).padStart(6, "0") : "000000";
  return order.isConverted ? `INV-${num}` : `SO-${num}`;
}

export function formatDate(d: string | number | null | undefined): string {
  if (d === null || d === undefined || d === "") return "—";
  const dt = /^\d+$/.test(String(d).trim()) ? new Date(Number(d)) : new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export const titleCase = (s?: string | null) => (!s ? "" : s.charAt(0).toUpperCase() + s.slice(1).toLowerCase());

// Can this order be edited from the website? Same rule as the app's party
// OrderDetail: not converted to an invoice yet, and not cancelled. (Every
// order a logged-in customer sees on the website is already their own, so
// there's no separate "isOwnOrder" check like the app needs for
// salesman/downline cases.)
export function canEditOrder(order: any): boolean {
  return !!order && !order.isConverted && order.cancelStatus !== "cancelled";
}
