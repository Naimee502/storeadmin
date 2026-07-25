import { Link } from "react-router";
import { categoryTiles } from "../../data/sampleData";
import SectionHeader from "../sectionheader";

export default function CategoryGrid() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <SectionHeader
        eyebrow="Browse"
        title="Shop by Category"
        subtitle="Every department your customers ask for, in one place."
        action="View all categories"
      />
      <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:px-0 md:grid-cols-5">
        {categoryTiles.map((cat) => {
          const Icon = cat.icon;
          return (
            <Link
              key={cat.id}
              to="/shop"
              className="group flex w-32 shrink-0 flex-col items-center rounded-2xl border border-slate-100 p-4 text-center transition hover:-translate-y-1 hover:border-brand-200 hover:shadow-lg sm:w-auto"
            >
              <div
                className="mb-3 grid h-16 w-16 place-items-center rounded-2xl transition group-hover:scale-105"
                style={{ background: `linear-gradient(135deg, ${cat.from}, ${cat.to})` }}
              >
                <Icon className="h-8 w-8 text-ink-800" />
              </div>
              <p className="text-sm font-semibold text-ink-900">{cat.name}</p>
              <p className="mt-0.5 text-xs text-slate-400">{cat.items} items</p>
              {cat.discount && (
                <span className="mt-1.5 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                  {cat.discount}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
