import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { SlidersHorizontal, X, ChevronDown } from "lucide-react";
import Breadcrumb from "../../components/breadcrumb";
import ProductCard from "../../components/productcard";
import { useCatalog } from "../../hooks/useCatalog";
import { formatPrice } from "../../utils/format";

type SortKey = "popularity" | "price-asc" | "price-desc" | "rating" | "newest";

const sortOptions: { id: SortKey; label: string }[] = [
  { id: "popularity", label: "Popularity" },
  { id: "newest", label: "Newest first" },
  { id: "price-asc", label: "Price: Low to High" },
  { id: "price-desc", label: "Price: High to Low" },
  { id: "rating", label: "Customer Rating" },
];

const PAGE_SIZE = 8;
const DEFAULT_MAX_PRICE = 30000;

export default function ShopPage() {
  const { categories, products, loading } = useCatalog();
  const [searchParams] = useSearchParams();

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [priceMax, setPriceMax] = useState(DEFAULT_MAX_PRICE);
  const [sortBy, setSortBy] = useState<SortKey>("popularity");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);

  // Support /shop?category=<id> links from CategoryGrid / Header nav.
  useEffect(() => {
    const fromUrl = searchParams.get("category");
    if (fromUrl) setSelectedCategories([fromUrl]);
  }, [searchParams]);

  const maxPrice = useMemo(
    () => Math.max(DEFAULT_MAX_PRICE, ...products.map((p) => p.price)),
    [products]
  );

  // Once real products load, make sure the price slider actually covers
  // their full range instead of clipping at the placeholder default.
  useEffect(() => {
    setPriceMax((prev) => (prev === DEFAULT_MAX_PRICE ? maxPrice : prev));
  }, [maxPrice]);

  const brands = useMemo(
    () => Array.from(new Set(products.map((p) => p.brand).filter(Boolean))),
    [products]
  );

  const toggle = (list: string[], value: string, setter: (v: string[]) => void) => {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
    setPage(1);
  };

  const filtered = useMemo(() => {
    let result = products.filter((p) => {
      if (selectedCategories.length && !selectedCategories.includes(p.category)) return false;
      if (selectedBrands.length && !selectedBrands.includes(p.brand)) return false;
      if (p.price > priceMax) return false;
      return true;
    });

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "price-asc":
          return a.price - b.price;
        case "price-desc":
          return b.price - a.price;
        case "rating":
          return b.rating - a.rating;
        case "newest":
          return a.badge === "NEW" ? -1 : b.badge === "NEW" ? 1 : 0;
        default:
          return b.ratingCount - a.ratingCount;
      }
    });

    return result;
  }, [products, selectedCategories, selectedBrands, priceMax, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const clearFilters = () => {
    setSelectedCategories([]);
    setSelectedBrands([]);
    setPriceMax(maxPrice);
    setPage(1);
  };

  const FiltersPanel = (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink-900">Filters</h3>
        <button onClick={clearFilters} className="text-xs font-semibold text-brand-700 hover:text-brand-800">
          Clear all
        </button>
      </div>

      <div>
        <h4 className="mb-3 text-sm font-semibold text-ink-900">Category</h4>
        <div className="space-y-2.5">
          {categories.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={selectedCategories.includes(c.id)}
                onChange={() => toggle(selectedCategories, c.id, setSelectedCategories)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              {c.name}
              <span className="ml-auto text-xs text-slate-400">{c.items}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-100 pt-5">
        <h4 className="mb-3 text-sm font-semibold text-ink-900">Brand</h4>
        <div className="space-y-2.5">
          {brands.map((b) => (
            <label key={b} className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={selectedBrands.includes(b)}
                onChange={() => toggle(selectedBrands, b, setSelectedBrands)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              {b}
            </label>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-100 pt-5">
        <h4 className="mb-3 text-sm font-semibold text-ink-900">Max Price: {formatPrice(priceMax)}</h4>
        <input
          type="range"
          min={500}
          max={maxPrice}
          step={500}
          value={priceMax}
          onChange={(e) => {
            setPriceMax(Number(e.target.value));
            setPage(1);
          }}
          className="w-full accent-brand-600"
        />
      </div>
    </div>
  );

  return (
    <div>
      <Breadcrumb items={[{ label: "Shop" }]} />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-ink-900 sm:text-3xl">All Products</h1>
            <p className="mt-1 text-sm text-slate-500">{filtered.length} products across every category</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileFiltersOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-ink-900 lg:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" /> Filters
            </button>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 text-sm font-medium text-ink-900 outline-none focus:border-brand-500"
              >
                {sortOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    Sort: {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-slate-400" />
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
          <aside className="hidden lg:block">{FiltersPanel}</aside>

          <div>
            {loading ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-64 animate-pulse rounded-2xl bg-slate-100" />
                ))}
              </div>
            ) : paged.length === 0 ? (
              <div className="rounded-2xl border border-slate-100 py-20 text-center">
                <p className="text-lg font-semibold text-ink-900">No products match your filters</p>
                <p className="mt-1 text-sm text-slate-500">Try clearing some filters to see more results.</p>
                <button
                  onClick={clearFilters}
                  className="mt-4 rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {paged.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={`h-9 w-9 rounded-lg text-sm font-semibold ${
                      page === n ? "bg-brand-700 text-white" : "border border-slate-200 text-ink-900 hover:bg-slate-50"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile filters drawer */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileFiltersOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] overflow-y-auto bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink-900">Filters</h2>
              <button onClick={() => setMobileFiltersOpen(false)} aria-label="Close filters">
                <X className="h-5 w-5" />
              </button>
            </div>
            {FiltersPanel}
            <button
              onClick={() => setMobileFiltersOpen(false)}
              className="mt-6 w-full rounded-lg bg-brand-700 py-2.5 text-sm font-semibold text-white"
            >
              Show {filtered.length} results
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
