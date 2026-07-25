import { useMemo, useState } from "react";
import { Flame } from "lucide-react";
import HeroBanner from "../../components/herobanner";
import CategoryGrid from "../../components/categorygrid";
import PromoBanners from "../../components/promobanners";
import ValueProps from "../../components/valueprops";
import BrandStrip from "../../components/brandstrip";
import Newsletter from "../../components/newsletter";
import SectionHeader from "../../components/sectionheader";
import ProductCard from "../../components/productcard";
import DealTimer from "../../components/dealtimer";
import { sampleProducts, categoryTiles } from "../../data/sampleData";

const tabs = [
  { id: "all", label: "All" },
  ...categoryTiles.slice(0, 5).map((c) => ({ id: c.id, label: c.name })),
];

export default function HomePage() {
  const [activeTab, setActiveTab] = useState("all");

  const featured = useMemo(
    () => (activeTab === "all" ? sampleProducts : sampleProducts.filter((p) => p.category === activeTab)),
    [activeTab]
  );

  const dealProducts = useMemo(() => sampleProducts.filter((p) => p.badge === "SALE" || p.badge === "BESTSELLER"), []);
  const newArrivals = useMemo(() => sampleProducts.filter((p) => p.badge === "NEW"), []);

  return (
    <div>
      <HeroBanner />
      <CategoryGrid />

      {/* Deal of the day */}
      <section className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-accent-600 to-rose-600 p-6 sm:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-white">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15">
                <Flame className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xl font-bold sm:text-2xl">Deal of the Day</h2>
                <p className="text-xs text-white/80 sm:text-sm">Grab it before the clock runs out</p>
              </div>
            </div>
            <DealTimer />
          </div>
          <div className="no-scrollbar flex gap-4 overflow-x-auto">
            {dealProducts.map((p) => (
              <div key={p.id} className="w-56 shrink-0 rounded-2xl bg-white/95 p-1">
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured products with category tabs */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <SectionHeader eyebrow="Popular right now" title="Featured Products" subtitle="Hand-picked across every category on Rudra.">
          <div className="no-scrollbar hidden gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1 sm:flex">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === t.id ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-ink-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </SectionHeader>

        {/* Mobile tabs */}
        <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto sm:hidden">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold ${
                activeTab === t.id
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-slate-200 text-slate-500"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      <PromoBanners />

      {/* New arrivals */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <SectionHeader eyebrow="Just landed" title="New Arrivals" subtitle="Freshly added across the catalog." />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {newArrivals.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      <ValueProps />
      <BrandStrip />
      <Newsletter />
    </div>
  );
}
