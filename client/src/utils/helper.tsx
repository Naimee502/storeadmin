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

// ✅ converts Date or string to DD-MM-YYYY (display format used in listings & prints)
// Also safely accepts an already-formatted "DD-MM-YYYY" string (returned as-is).
export const formatDateDMY = (date: Date | string | number | null | undefined): string => {
  if (!date) return "-";
  const s = typeof date === "string" ? date.trim() : "";
  const dmy = s.match(/^(\d{2})-(\d{2})-(\d{4})/);
  if (dmy) return `${dmy[1]}-${dmy[2]}-${dmy[3]}`;
  const d = toDate(date);
  if (isNaN(d.getTime())) return String(date);
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
};

// ✅ DD-MM-YYYY hh:mm AM/PM — date comes from `date`; the time-of-day comes from
// `timeSource` (e.g. createdAt) because bill dates are stored without a time.
export const formatDateTimeDMY = (
  date: Date | string | number | null | undefined,
  timeSource?: Date | string | number | null
): string => {
  const datePart = formatDateDMY(date);
  const t = toDate(timeSource ?? date);
  if (isNaN(t.getTime())) return datePart;
  let h = t.getHours();
  const m = String(t.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${datePart} ${String(h).padStart(2, "0")}:${m} ${ampm}`;
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

// ✅ Indian financial year (1 Apr – 31 Mar) for a given date
export const getFinancialYear = (d: Date = new Date()) => {
  const startYear = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  const start = new Date(startYear, 3, 1);
  const end = new Date(startYear + 1, 2, 31);
  return { start, end, label: `FY ${startYear}-${String(startYear + 1).slice(2)}` };
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
