// Date-range filter helpers — same presets and rules as the app's
// components/daterangesheet.tsx, so a party sees the same ranges on both.
// Ranges are whole local days: `from` / `to` are YYYY-MM-DD (inclusive);
// null on both = all time.

export type DatePreset = "all" | "today" | "yesterday" | "last7" | "thisMonth" | "lastMonth" | "custom";
export type DateRange = { preset: DatePreset; from: string | null; to: string | null };

export const ALL_TIME: DateRange = { preset: "all", from: null, to: null };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export const PRESETS: { key: DatePreset; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7", label: "Last 7 days" },
  { key: "thisMonth", label: "This month" },
  { key: "lastMonth", label: "Last month" },
  { key: "custom", label: "Custom range" },
];

/** Resolve a preset to concrete days (evaluated now, so "Today" is always today). */
export function presetRange(preset: DatePreset): DateRange {
  const now = new Date();
  switch (preset) {
    case "today": return { preset, from: ymd(now), to: ymd(now) };
    case "yesterday": { const y = addDays(now, -1); return { preset, from: ymd(y), to: ymd(y) }; }
    case "last7": return { preset, from: ymd(addDays(now, -6)), to: ymd(now) };
    case "thisMonth": return { preset, from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: ymd(now) };
    case "lastMonth": return {
      preset,
      from: ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: ymd(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
    default: return ALL_TIME;
  }
}

/** Server dates come as epoch-ms strings or ISO strings. */
export function parseServerDate(d: string | number | null | undefined): Date | null {
  if (d === null || d === undefined || d === "") return null;
  const dt = typeof d === "number" || /^\d+$/.test(String(d).trim()) ? new Date(Number(d)) : new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
}

/** Is a date inside the range? */
export function inRange(d: Date | null, r: DateRange): boolean {
  if (!r.from && !r.to) return true;
  if (!d) return false;
  const k = ymd(d);
  return (!r.from || k >= r.from) && (!r.to || k <= r.to);
}

const fmtDay = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}${y !== new Date().getFullYear() ? ` ${y}` : ""}`;
};

/** Short label for the filter button: "This month", "3 Oct – 18 Oct". */
export function rangeLabel(r: DateRange): string {
  if (r.preset !== "custom") return PRESETS.find((p) => p.key === r.preset)?.label ?? "All time";
  if (!r.from) return "All time";
  return r.from === r.to ? fmtDay(r.from) : `${fmtDay(r.from)} – ${fmtDay(r.to ?? r.from)}`;
}
