import type { InvoiceProduct } from "../components/productsection";

// Parse a value that may be a Date, an ISO string, OR an epoch-millisecond
// string (GraphQL serializes Mongo Date fields like `paymentdate` as epoch ms).
// `new Date("1751713200000")` is Invalid, so numeric strings must go through Number().
const toDate = (date: Date | string | number | null | undefined): Date => {
  if (date instanceof Date) return date;
  const s = String(date).trim();
  if (/^\d+$/.test(s)) return new Date(Number(s)); // epoch millis
  return new Date(s);
};

// ✅ converts Date or string to DD/MM/YYYY
export const normalizeToDMY = (date: Date | string | null | undefined): string | null => {
  if (!date) return null;
  const d = toDate(date);
  if (isNaN(d.getTime())) return null;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

// ✅ converts Date or string to YYYY-MM-DD
export const normalizeToYMD = (date: Date | string | null | undefined): string | null => {
  if (!date) return null;
  const d = toDate(date);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// ✅ converts Date or string to MM/DD/YYYY
export const normalizeToMDY = (date: Date | string | null | undefined): string | null => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
};

// ✅ Date Shortcut (still returns DMY format unless you change)
export const applyDateShortcut = (
  type: "daily" | "weekly" | "monthly" | "yearly"
): { from: string | null; to: string | null } => {
  const today = new Date();
  const to = normalizeToDMY(today);
  let from = to;

  if (type === "weekly") {
    const f = new Date();
    f.setDate(today.getDate() - 6);
    from = normalizeToDMY(f);
  } else if (type === "monthly") {
    const f = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    from = normalizeToDMY(f);
  } else if (type === "yearly") {
    const f = new Date(today.getFullYear(), 0, 1);
    from = normalizeToDMY(f);
  }

  return { from, to };
};

export const getNextBillNumber = (invoices) => {
  if (!invoices || invoices.length === 0) return "000001";

  const nums = invoices
    .map((inv) => parseInt(inv.billnumber || "0", 10))
    .filter((n) => !isNaN(n));

  if (nums.length === 0) return "000001";

  const next = Math.max(...nums) + 1;
  return next.toString().padStart(6, "0");
};

export const getBaseQuantity = (
  qty: number,
  unitId: string,
  variant: any
) => {
  const conversion = variant.unitconversions.find(
    (uc: any) => (uc.unitid?.id ?? uc.unitid) === unitId
  );

  const factor = Number(conversion?.factor ?? 1);
  return qty * factor; // 🔥 base unit qty
};

export const getCartItemBaseQty = (item, variant) => {
  return getBaseQuantity(
    item.qty,
    item.unitId,
    {
      unitconversions: variant.conversions.map((c) => ({
        unitid: c.unitId,
        factor: c.factor,
      })),
    }
  );
};

export const getInvoiceLineBaseQty = (line: InvoiceProduct, variant: any) => {
  const unitId = line.salesunitid || variant.baseunitid;
  return getBaseQuantity(
    Number(line.quantity),
    unitId!,
    variant
  );
};
