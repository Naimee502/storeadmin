import { brandStrip } from "../../data/sampleData";

export default function BrandStrip() {
  const items = [...brandStrip, ...brandStrip];
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
