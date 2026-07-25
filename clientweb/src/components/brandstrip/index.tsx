import { useMemo } from "react";
import { useCatalog } from "../../hooks/useCatalog";

export default function BrandStrip() {
  const { products } = useCatalog();

  // Real brand names pulled from this admin's own products (brandid.brandname)
  // instead of the old hardcoded demo list — hide the whole strip if none of
  // this admin's products have a brand set yet.
  const brands = useMemo(
    () => Array.from(new Set(products.map((p) => p.brand).filter(Boolean))),
    [products]
  );

  if (brands.length === 0) return null;

  const items = [...brands, ...brands];
  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <p className="mb-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
        Trusted by leading brands across categories
      </p>
      <div className="no-scrollbar overflow-hidden">
        <div className="marquee-track flex w-max items-center gap-10">
          {items.map((brand, i) => (
            <span key={`${brand}-${i}`} className="shrink-0 text-lg font-bold text-slate-300">
              {brand}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
