import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";

export type StatusOption = { label: string; value: string };

// badge bg/text + a solid dot colour per status
const STYLES: Record<string, { badge: string; dot: string }> = {
  pending:    { badge: "bg-amber-50 text-amber-700 ring-amber-200",  dot: "bg-amber-500" },
  confirmed:  { badge: "bg-blue-50 text-blue-700 ring-blue-200",     dot: "bg-blue-500" },
  dispatched: { badge: "bg-sky-50 text-sky-700 ring-sky-200",        dot: "bg-sky-500" },
  delivered:  { badge: "bg-green-50 text-green-700 ring-green-200",   dot: "bg-green-500" },
  cancelled:  { badge: "bg-rose-50 text-rose-700 ring-rose-200",      dot: "bg-rose-500" },
  returned:   { badge: "bg-purple-50 text-purple-700 ring-purple-200", dot: "bg-purple-500" },
};
const FALLBACK = { badge: "bg-gray-50 text-gray-700 ring-gray-200", dot: "bg-gray-400" };
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "—");

const StatusDropdown: React.FC<{
  current: string;
  options: StatusOption[];
  onSelect: (value: string) => void;
  disabled?: boolean;
}> = ({ current, options, onSelect, disabled }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const key = (current || "").toLowerCase();
  const st = STYLES[key] || FALLBACK;

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: r.left, width: r.width });
  };

  useLayoutEffect(() => { if (open) place(); }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  const Badge = (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${st.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
      {cap(current)}
    </span>
  );

  if (disabled) return Badge;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset transition hover:brightness-95 ${st.badge}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
        {cap(current)}
        <svg className="w-3 h-3 opacity-60" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, minWidth: Math.max(pos.width, 150) }}
          className="z-[1000] bg-white border border-gray-200 rounded-xl shadow-xl py-1 overflow-hidden"
        >
          {options.map((o) => {
            const active = o.value.toLowerCase() === key;
            const ost = STYLES[o.value.toLowerCase()] || FALLBACK;
            return (
              <button
                key={o.value}
                type="button"
                disabled={active}
                className={`flex items-center gap-2 w-full text-left px-3 py-2 text-xs ${active ? "opacity-50 cursor-default" : "hover:bg-gray-50"}`}
                onClick={() => { setOpen(false); onSelect(o.value); }}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${ost.dot}`} />
                <span className="font-medium text-gray-700">{o.label}</span>
                {active && <span className="ml-auto text-[10px] text-gray-400">current</span>}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
};

export default StatusDropdown;
