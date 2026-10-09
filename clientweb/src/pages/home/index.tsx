import { useMemo, useState } from "react";
import { Flame } from "lucide-react";
import HeroBanner from "../../components/herobanner";
import CategoryGrid from "../../components/categorygrid";
import PromoBanners from "../../components/promobanners";
import ValueProps from "../../components/valueprops";
import Newsletter from "../../components/newsletter";
import SectionHeader from "../../components/sectionheader";
import ProductCard from "../../components/productcard";
import DealTimer from "../../components/dealtimer";
import { useCatalog } from "../../hooks/useCatalog";
import { useTenant } from "../../contexts/tenant";
import { siteConfig } from "../../config/site";
import { discountPercent } from "../../utils/format";
import { inStockFirst, isOutOfStock, stockAware } from "../../utils/stock";
import type { SampleProduct } from "../../data/sampleData";

// Shared by Featured Products / New Arrivals / Deal of the Day — each is
// an independent admin pick list (Settings → General on the admin panel)
// of {productid, unitid}. Resolves picks to real products, reordering
// each product's unitPrices so the admin-picked unit/variant shows as the
// default price, in the order the admin added them.
function resolvePickedProducts(
  items: { productid: string; unitid?: string | null }[],
  products: SampleProduct[]
): SampleProduct[] {
  return items
    .map((item) => {
      const product = products.find((p) => p.id === item.productid);
      if (!product) return null;
      if (!item.unitid || !product.unitPrices) return product;

      const idx = product.unitPrices.findIndex((u) => u.unitid === item.unitid);
      if (idx <= 0) return product;

      const reordered = [
        product.unitPrices[idx],
        ...product.unitPrices.slice(0, idx),
        ...product.unitPrices.slice(idx + 1),
      ];
      return {
        ...product,
        unitPrices: reordered,
        unit: reordered[0].label,
        units: reordered.map((u) => u.label),
        price: reordered[0].price,
        mrp: reordered[0].mrp,
      };
    })
    .filter((p): p is SampleProduct => p !== null);
}

export default function HomePage() {
  const tenant = useTenant();
  const { companyName, dealOfDayEnabled, dealOfDayTitle, dealOfDaySubtitle } = tenant;
  const brandName = companyName || siteConfig.name;
  const { products, categories } = useCatalog();
  const [activeTab, setActiveTab] = useState("all");

  // Admin's Settings → General "Hero Banner" slides — fully replaces the
  // carousel when the admin has added any; leave empty to keep the
  // automatic catalog-driven slides instead.
  const heroOverrideSlides = useMemo(
    () =>
      tenant.heroBannerSlides
        // A slide counts once it has a title OR an image. An image-only slide
        // is a finished banner artwork (text already in the picture) — it
        // used to be dropped here, which is why an uploaded banner never
        // showed. Untitled slides get no eyebrow/CTA, only the picture.
        .filter((s) => s.title || s.image)
        .map((s) => ({
          eyebrow: s.title ? "Featured" : "",
          title: s.title || "",
          body: s.subtitle || "",
          cta: s.title ? s.cta || "Shop Now" : "",
          link: s.link || "/shop",
          image: s.image || undefined,
        })),
    [tenant.heroBannerSlides]
  );

  const tabs = useMemo(
    () => [{ id: "all", label: "All" }, ...categories.slice(0, 5).map((c) => ({ id: c.id, label: c.name }))],
    [categories]
  );

  // Featured Products — admin's explicit picks (Settings → General) take
  // over completely when set (category tabs are hidden, since an explicit
  // list makes tab-browsing redundant); otherwise the live catalog with
  // category tabs is shown, same as before.
  const curatedFeatured = useMemo(
    () => inStockFirst(resolvePickedProducts(tenant.featuredProductItems, products)),
    [tenant.featuredProductItems, products]
  );
  const hasCuratedFeatured = curatedFeatured.length > 0;

  const featured = useMemo(() => {
    if (hasCuratedFeatured) return curatedFeatured;
    return activeTab === "all" ? products : products.filter((p) => p.category === activeTab);
  }, [hasCuratedFeatured, curatedFeatured, products, activeTab]);

  // Deal of the Day — admin's explicit product+variant picks come first,
  // in the order they were added. Falls back to the products with the
  // biggest real discount (mrp vs price) when nothing's picked, so the
  // fallback is still driven by live catalog data, not an arbitrary slice.
  // A deal nobody can buy is worse than no deal, so out-of-stock products
  // are left out of this strip entirely (picked or automatic). If nothing
  // is left, the section hides itself below.
  const dealProducts = useMemo(() => {
    const available = products.filter((p) => !isOutOfStock(p));
    if (tenant.dealOfDayItems.length === 0) {
      return [...available]
        .sort((a, b) => discountPercent(b.price, b.mrp) - discountPercent(a.price, a.mrp))
        .slice(0, 8);
    }
    return resolvePickedProducts(tenant.dealOfDayItems, available);
  }, [tenant.dealOfDayItems, products]);

  // New Arrivals — admin's explicit picks take over when set; otherwise
  // genuinely the most recently added products (by real createdAt), not
  // just whatever order the catalog query happened to return.
  const newArrivals = useMemo(() => {
    if (tenant.newArrivalItems.length > 0) {
      return inStockFirst(resolvePickedProducts(tenant.newArrivalItems, products));
    }
    const withDates = products.filter((p) => p.createdAt);
    if (withDates.length === 0) return products.slice(0, 8);
    return [...withDates]
      .sort(stockAware((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()))
      .slice(0, 8);
  }, [tenant.newArrivalItems, products]);

  return (
    <div>
      <HeroBanner overrideSlides={heroOverrideSlides} />
      <CategoryGrid />

      {/* Deal of the day — admin can disable, override the copy, or pick
          the exact products/variants from Settings → General. */}
      {dealOfDayEnabled && dealProducts.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-brand-700 to-brand-900 p-6 sm:p-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-white">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15">
                  <Flame className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-xl font-bold sm:text-2xl">{dealOfDayTitle || "Deal of the Day"}</h2>
                  <p className="text-xs text-white/80 sm:text-sm">
                    {dealOfDaySubtitle || "Grab it before the clock runs out"}
                  </p>
                </div>
              </div>
              <DealTimer />
            </div>
            <div className="no-scrollbar flex gap-4 overflow-x-auto">
              {dealProducts.map((p) => (
                <div key={p.id} className="w-56 shrink-0 rounded-2xl bg-white/95 p-1">
                  <ProductCard product={p} imageRatio={tenant.dealProductImageRatio} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured products — curated list from admin, or live catalog with category tabs */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <SectionHeader eyebrow="Popular right now" title="Featured Products" subtitle={`Hand-picked across every category on ${brandName}.`}>
          {!hasCuratedFeatured && (
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
          )}
        </SectionHeader>

        {/* Mobile tabs */}
        {!hasCuratedFeatured && (
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
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      <PromoBanners />

      {/* New arrivals — curated list from admin, or the genuinely newest products */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <SectionHeader eyebrow="Just landed" title="New Arrivals" subtitle="Freshly added across the catalog." />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {newArrivals.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      <ValueProps />
      <Newsletter />
    </div>
  );
}
