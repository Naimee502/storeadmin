import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useCatalog } from "../../hooks/useCatalog";
import { useTenant } from "../../contexts/tenant";
import SectionHeader from "../sectionheader";
import { useAutoScrollX } from "../../hooks/useAutoScrollX";

type Cat = ReturnType<typeof useCatalog>["categories"][number];

// Ticker speed — slow enough to read a card and click it while it moves.
const TICKER_PX_PER_SEC = 40;
const RESUME_AFTER_TOUCH_MS = 1500;

function CategoryCard({ cat, fixedWidth }: { cat: Cat; fixedWidth?: boolean }) {
  const Icon = cat.icon;
  return (
    <Link
      to={`/shop?category=${cat.id}`}
      className={`group flex shrink-0 flex-col items-center rounded-2xl border border-slate-100 bg-white p-4 text-center transition hover:-translate-y-1 hover:border-brand-200 hover:shadow-lg ${
        fixedWidth ? "w-40" : "w-32 sm:w-auto"
      }`}
    >
      <div
        className="mb-3 grid h-16 w-16 place-items-center overflow-hidden rounded-2xl transition group-hover:scale-105"
        style={cat.image ? undefined : { background: `linear-gradient(135deg, ${cat.from}, ${cat.to})` }}
      >
        {cat.image ? (
          <img src={cat.image} alt={cat.name} className="h-full w-full object-cover" />
        ) : (
          <Icon className="h-8 w-8 text-ink-800" />
        )}
      </div>
      <p className="text-sm font-semibold text-ink-900">{cat.name}</p>
      <p className="mt-0.5 text-xs text-slate-400">{cat.items} items</p>
    </Link>
  );
}

/**
 * Business Settings -> "Auto-scroll the category row" ON: the categories drift
 * along by themselves in a seamless loop — but the row is still an ordinary
 * scrollable strip, so it can be scrolled / swiped by hand at any time.
 * Hover, touch or wheel pauses the drift. The set of cards is repeated until
 * it is at least as wide as the row, then drawn twice so the loop folds back
 * onto an identical picture.
 */
function CategoryTicker({ categories }: { categories: Cat[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const setRef = useRef<HTMLDivElement>(null);
  const [setW, setSetW] = useState(0);
  const [viewW, setViewW] = useState(0);

  useEffect(() => {
    const measure = () => {
      if (wrapRef.current) setViewW(wrapRef.current.clientWidth);
      if (setRef.current) setSetW(setRef.current.scrollWidth);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    if (setRef.current) ro.observe(setRef.current);
    return () => ro.disconnect();
  }, [categories.length]);

  // How many copies of the set make one unit at least as wide as the row.
  const repeats = setW > 0 && viewW > 0 ? Math.max(1, Math.ceil(viewW / setW)) : 1;
  useAutoScrollX(wrapRef, { enabled: setW > 0, speed: TICKER_PX_PER_SEC, loop: true, resumeMs: RESUME_AFTER_TOUCH_MS });

  // Each set carries its own trailing gap (pr-4) so set widths add up exactly
  // and the loop seam is invisible.
  const sets = Array.from({ length: repeats * 2 }, (_, i) => (
    <div
      key={i}
      ref={i === 0 ? setRef : undefined}
      aria-hidden={i > 0 ? true : undefined}
      className="flex shrink-0 gap-4 pr-4"
    >
      {categories.map((cat) => (
        <CategoryCard key={`${i}-${cat.id}`} cat={cat} fixedWidth />
      ))}
    </div>
  ));

  return (
    <div ref={wrapRef} className="no-scrollbar -mx-4 overflow-x-auto px-4 py-2 sm:mx-0 sm:px-0">
      <div className="flex w-max">{sets}</div>
    </div>
  );
}

export default function CategoryGrid() {
  const { categories, loading } = useCatalog();
  const { categoryAutoScroll } = useTenant();

  if (!loading && categories.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <SectionHeader
        eyebrow="Browse"
        title="Shop by Category"
        subtitle="Every department your customers ask for, in one place."
        action="View all categories"
      />
      {categoryAutoScroll && categories.length > 0 ? (
        <CategoryTicker categories={categories} />
      ) : (
        <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:px-0 md:grid-cols-5">
          {categories.map((cat) => (
            <CategoryCard key={cat.id} cat={cat} />
          ))}
        </div>
      )}
    </section>
  );
}
