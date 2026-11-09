import type { InvoiceProduct } from "../components/productsection";

// Accepts a Date, ISO string or epoch-ms string (GraphQL sends dates as epoch ms).
const toDate = (date: Date | string | number | null | undefined): Date => {
  if (date instanceof Date) return date;
  const s = String(date).trim();
  if (/^\d+$/.test(s)) return new Date(Number(s)); // epoch millis
  return new Date(s);
};

// converts Date or string to DD/MM/YYYY
export const normalizeToDMY = (date: Date | string | null | undefined): string | null => {
  if (!date) return null;
  const d = toDate(date);
  if (isNaN(d.getTime())) return null;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

// converts Date or string to YYYY-MM-DD
export const normalizeToYMD = (date: Date | string | null | undefined): string | null => {
  if (!date) return null;
  const d = toDate(date);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Today as local "YYYY-MM-DD"; toISOString() would give yesterday before 5:30am IST.
export const todayYMD = (): string => normalizeToYMD(new Date())!;

/** Today shifted by N days (negative = past), still on the local calendar. */
export const shiftDaysYMD = (days: number, from: Date = new Date()): string =>
  normalizeToYMD(
    new Date(from.getFullYear(), from.getMonth(), from.getDate() + days)
  )!;

// Date or string → DD-MM-YYYY; an already formatted string is returned as-is.
export const formatDateDMY = (date: Date | string | number | null | undefined): string => {
  if (!date) return "-";
  const s = typeof date === "string" ? date.trim() : "";
  const dmy = s.match(/^(\d{2})-(\d{2})-(\d{4})/);
  if (dmy) return `${dmy[1]}-${dmy[2]}-${dmy[3]}`;
  const d = toDate(date);
  if (isNaN(d.getTime())) return String(date);
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
};

// Date from `date`, time from `timeSource` since bill dates have no time.
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

// converts Date or string to MM/DD/YYYY
export const normalizeToMDY = (date: Date | string | null | undefined): string | null => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
};

// Date Shortcut (still returns DMY format unless you change)
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

// Last 5 documents of a party as dropdown history rows.
export const getLastPartyDocRows = (
  docs: any[],
  partyId?: string,
  excludeId?: string,
  prefix: string = "INV"
): string[][] => {
  if (!partyId || !docs?.length) return [];
  return docs
    .filter((d: any) => d.partyacc?.id === partyId && d.id !== excludeId)
    .slice()
    .sort(
      (a: any, b: any) =>
        (new Date(b.billdate).getTime() || Number(b.createdAt) || 0) -
        (new Date(a.billdate).getTime() || Number(a.createdAt) || 0)
    )
    .slice(0, 5)
    .map((d: any) => {
      const items = d.productservice || [];
      const qty = items.reduce((s: number, p: any) => s + (p.qty || 0), 0);
      const disc = Number(d.totaldiscount || 0) + Number(d.invoicediscount || 0);
      const num = String(d.billnumber || "");
      return [
        num.startsWith(`${prefix}-`) ? num : `${prefix}-${num}`,
        formatDateDMY(d.billdate),
        String(qty),
        disc.toFixed(2),
        Number(d.totalamount || 0).toFixed(2),
      ];
    });
};

// Indian financial year (1 Apr – 31 Mar) for a given date
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
  return qty * factor; // base unit qty
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

/** Rupee amount with Indian grouping: 121192 → "₹1,21,192.00". */
export const formatINR = (n: number | null | undefined): string =>
  `₹${(Number(n) || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// Title-case each word: "new delhi" → "New Delhi".
export const toTitleCase = (value: string | null | undefined): string =>
  String(value ?? "")
    .toLowerCase()
    .replace(/(^|[\s/-])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());

// Date as a sortable number; NaN if unusable so the caller can drop the row.
export const timestampOf = (d: any): number => {
  if (d === null || d === undefined || d === "") return NaN;
  const str = String(d).trim();
  return /^\d+$/.test(str) ? Number(str) : new Date(str).getTime();
};

/** A row of a running statement, as far as its ordering is concerned. */
export type StatementSortable = {
  /** The voucher date. */
  t: number;
  /** When the voucher was actually entered — the same-day tie-break. */
  seq?: number;
  /** Document number, the last resort when even `seq` ties. */
  ref?: string;
};

// Running-statement order: date, then entry order (seq), then document number.
export const compareStatementRows = (
  x: StatementSortable,
  y: StatementSortable
): number => {
  if (x.t !== y.t) return x.t - y.t;

  const xs = x.seq;
  const ys = y.seq;
  const comparable =
    xs !== undefined && ys !== undefined && !isNaN(xs) && !isNaN(ys);
  if (comparable && xs !== ys) return xs - ys;
  if (comparable && x.ref && y.ref) return String(x.ref).localeCompare(String(y.ref));
  return 0;
};

// CGST + SGST inside the state, IGST across states; same rule as the server journal.
export const gstSplit = (companyState: any, partyState: any, gst: number) => {
  const theirs = String(partyState || "gujarat").toLowerCase();
  const inter = theirs !== "default" && theirs !== String(companyState || "gujarat").toLowerCase();
  const cgst = inter ? 0 : Math.round((gst / 2) * 100) / 100;
  return { inter, igst: inter ? gst : 0, cgst, sgst: inter ? 0 : Math.round((gst - cgst) * 100) / 100 };
};
