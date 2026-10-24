import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarRange, ChevronDown, X, ClipboardList, IndianRupee, TrendingUp, Check } from "lucide-react";
import { ALL_TIME, PRESETS, presetRange, rangeLabel, ymd, type DateRange } from "../../utils/daterange";

/** ₹ without paise, and lakh / crore for big numbers so it fits a stat tile. */
export function compactINR(n: number): string {
  const v = Math.round(n || 0);
  if (v >= 1e7) return `₹${Number((v / 1e7).toFixed(2))}Cr`;
  if (v >= 1e5) return `₹${Number((v / 1e5).toFixed(2))}L`;
  return `₹${v.toLocaleString("en-IN")}`;
}

type Props = {
  caption: string;
  /** The orders currently listed (after scope / status / date filters). */
  orders: any[];
  range: DateRange;
  onRangeChange: (r: DateRange) => void;
};

/**
 * Orders summary card — same as the app's OrdersSummaryCard: date-range
 * filter on top, what the visible list adds up to below (count, value,
 * average; cancelled orders don't count toward the value).
 */
export default function OrdersSummaryCard({ caption, orders, range, onRangeChange }: Props) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(range.from ?? "");
  const [to, setTo] = useState(range.to ?? "");
  const wrapRef = useRef<HTMLDivElement>(null);
  const dateActive = range.preset !== "all";
  const today = ymd(new Date());

  // Close on outside click / Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [open]);

  useEffect(() => { if (open) { setFrom(range.from ?? ""); setTo(range.to ?? ""); } }, [open, range.from, range.to]);

  const { total, avg } = useMemo(() => {
    let sum = 0; let n = 0;
    for (const o of orders) {
      if (o?.cancelStatus === "cancelled") continue;
      sum += Number(o?.totalamount) || 0; n += 1;
    }
    return { total: sum, avg: n ? sum / n : 0 };
  }, [orders]);

  const applyCustom = () => {
    if (!from) return;
    const a = from; const b = to || from;
    onRangeChange({ preset: "custom", from: a <= b ? a : b, to: a <= b ? b : a });
    setOpen(false);
  };

  const stats = [
    { icon: ClipboardList, tint: "text-blue-500 bg-blue-50", value: String(orders.length), label: orders.length === 1 ? "Order" : "Orders" },
    { icon: IndianRupee, tint: "text-brand-700 bg-brand-50", value: compactINR(total), label: "Order value" },
    { icon: TrendingUp, tint: "text-amber-500 bg-amber-50", value: compactINR(avg), label: "Avg / order" },
  ];

  return (
    <div className="mb-5 rounded-2xl border border-slate-100 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-sm font-semibold text-slate-500">{caption}</p>

        <div ref={wrapRef} className="relative">
          <div
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              dateActive ? "border-brand-700 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-700 hover:border-brand-400"
            }`}
          >
            <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5">
              <CalendarRange className="h-4 w-4 text-brand-700" />
              <span className="max-w-[160px] truncate">{rangeLabel(range)}</span>
              {!dateActive && <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>
            {dateActive && (
              <button type="button" aria-label="Clear date filter" onClick={() => onRangeChange(ALL_TIME)}>
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {open && (
            <div className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-slate-100 bg-white p-2 shadow-lg">
              {PRESETS.filter((p) => p.key !== "custom").map((p) => {
                const active = range.preset === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => { onRangeChange(presetRange(p.key)); setOpen(false); }}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                      active ? "bg-brand-50 font-semibold text-brand-700" : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {p.label}
                    {active && <Check className="h-4 w-4" />}
                  </button>
                );
              })}
              <div className="mt-1 border-t border-slate-100 px-1 pt-2">
                <p className="mb-1.5 px-2 text-xs font-semibold text-slate-500">Custom range</p>
                <div className="grid grid-cols-2 gap-2 px-1">
                  <label className="text-[11px] text-slate-500">
                    From
                    <input type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)}
                      className="mt-0.5 w-full rounded-md border border-slate-200 px-1.5 py-1 text-xs text-ink-900" />
                  </label>
                  <label className="text-[11px] text-slate-500">
                    To
                    <input type="date" value={to} min={from || undefined} max={today} onChange={(e) => setTo(e.target.value)}
                      className="mt-0.5 w-full rounded-md border border-slate-200 px-1.5 py-1 text-xs text-ink-900" />
                  </label>
                </div>
                <button
                  type="button"
                  disabled={!from}
                  onClick={applyCustom}
                  className="mt-2 w-full rounded-lg bg-brand-700 py-2 text-xs font-semibold text-white transition hover:bg-brand-800 disabled:opacity-40"
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="my-3 h-px bg-slate-100" />

      <div className="grid grid-cols-3 divide-x divide-slate-100">
        {stats.map(({ icon: Icon, tint, value, label }) => (
          <div key={label} className="flex min-w-0 items-center gap-2 px-2 first:pl-0">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tint}`}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink-900">{value}</p>
              <p className="truncate text-[11px] text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
