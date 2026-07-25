import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { useCatalog } from "../../hooks/useCatalog";
import { useTenant } from "../../contexts/tenant";
import { siteConfig } from "../../config/site";

export interface HeroSlideOverride {
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  link?: string;
  image?: string;
}

// Every slide and promo tile here is built from this admin's real
// categories/products (useCatalog) — nothing hardcoded like "Fashion" or
// "Smart Gadgets" anymore. When the admin has configured their own banner
// slides (Settings → General → Hero Banner), `overrideSlides` fully
// replaces the carousel with those — add/edit/remove any number of them
// from the admin panel, just like a normal ecommerce banner manager.
// Leave it empty and the catalog-driven default slides below are used.
export default function HeroBanner({ overrideSlides }: { overrideSlides?: HeroSlideOverride[] }) {
  const { companyName } = useTenant();
  const brandName = companyName || siteConfig.name;
  const { categories, products } = useCatalog();
  const [active, setActive] = useState(0);

  const topCategories = categories
    .slice()
    .sort((a, b) => b.items - a.items)
    .slice(0, 3);

  const categoryNames = categories.slice(0, 3).map((c) => c.name);
  const catalogLine =
    categoryNames.length > 0
      ? `${categoryNames.join(", ")}${categories.length > 3 ? " & more" : ""} — all in one place.`
      : "Everything you need, all in one place.";

  const slides = useMemo(() => {
    if (overrideSlides && overrideSlides.length > 0) {
      return overrideSlides.map((s) => ({
        eyebrow: s.eyebrow,
        title: s.title,
        body: s.body,
        cta: s.cta,
        link: s.link ?? "/shop",
        image: s.image,
        gradFrom: "from-brand-700",
        gradTo: "to-brand-900",
      }));
    }

    const base = [
      {
        eyebrow: "Welcome",
        title: `Shop everything from ${brandName}`,
        body: catalogLine,
        cta: "Start Shopping",
        link: "/shop",
        image: undefined as string | undefined,
        gradFrom: "from-brand-700",
        gradTo: "to-brand-900",
      },
      {
        eyebrow: "Retailers & Wholesalers",
        title: "Bulk pricing on every order",
        body: "Apply for a Party / Business account to unlock negotiated rates and route-based delivery.",
        cta: "Apply for Business Account",
        link: "/login",
        gradFrom: "from-ink-800",
        gradTo: "to-ink-900",
      },
    ];

    const topCategory = topCategories[0];
    if (topCategory) {
      base.push({
        eyebrow: "Popular category",
        title: `Fresh picks in ${topCategory.name}`,
        body: `${topCategory.items} products waiting for you in ${topCategory.name}.`,
        cta: `Shop ${topCategory.name}`,
        link: `/shop?category=${topCategory.id}`,
        gradFrom: "from-brand-600",
        gradTo: "to-brand-800",
      });
    }

    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandName, catalogLine, topCategories[0]?.id, overrideSlides]);

  useEffect(() => {
    if (active >= slides.length) setActive(0);
  }, [active, slides.length]);

  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % slides.length), 5000);
    return () => clearInterval(id);
  }, [slides.length]);

  const slide = slides[active] ?? slides[0];
  const promoTiles = categories.slice(0, 2);

  return (
    <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Main carousel */}
        <div
          className={`relative col-span-2 flex min-h-[280px] flex-col justify-center overflow-hidden rounded-2xl p-8 text-white transition-colors duration-500 sm:min-h-[340px] sm:p-12 ${
            slide.image ? "bg-cover bg-center" : `bg-gradient-to-br ${slide.gradFrom} ${slide.gradTo}`
          }`}
          style={slide.image ? { backgroundImage: `url(${slide.image})` } : undefined}
        >
          {slide.image && <div className="absolute inset-0 bg-ink-900/50" />}
          {!slide.image && (
            <>
              <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            </>
          )}
          <p className="relative z-10 mb-3 inline-block w-fit rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
            {slide.eyebrow}
          </p>
          <h1 className="relative z-10 max-w-md text-3xl font-extrabold leading-tight sm:text-4xl">
            {slide.title}
          </h1>
          <p className="relative z-10 mt-3 max-w-sm text-sm text-white/85 sm:text-base">{slide.body}</p>
          <Link
            to={slide.link}
            className="relative z-10 mt-6 flex w-fit items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-ink-900 hover:bg-slate-100"
          >
            {slide.cta} <ArrowRight className="h-4 w-4" />
          </Link>

          {/* Controls */}
          {slides.length > 1 && (
            <>
              <div className="absolute bottom-5 right-5 z-10 flex items-center gap-2">
                <button
                  onClick={() => setActive((a) => (a - 1 + slides.length) % slides.length)}
                  className="grid h-8 w-8 place-items-center rounded-full bg-white/20 hover:bg-white/30"
                  aria-label="Previous slide"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setActive((a) => (a + 1) % slides.length)}
                  className="grid h-8 w-8 place-items-center rounded-full bg-white/20 hover:bg-white/30"
                  aria-label="Next slide"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="absolute bottom-6 left-8 z-10 flex gap-1.5 sm:left-12">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActive(i)}
                    aria-label={`Go to slide ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all ${
                      i === active ? "w-6 bg-white" : "w-3 bg-white/40"
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Side promo tiles — this admin's own top categories */}
        {promoTiles.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {promoTiles.map((cat) => {
              const Icon = cat.icon;
              return (
                <Link
                  key={cat.id}
                  to={`/shop?category=${cat.id}`}
                  className="flex flex-col justify-between rounded-2xl p-6 transition hover:-translate-y-0.5"
                  style={{ background: `linear-gradient(135deg, ${cat.from}, ${cat.to})` }}
                >
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-800/70">Category</p>
                    <h3 className="mt-1 text-xl font-bold text-ink-900">{cat.name}</h3>
                    <p className="mt-1 text-sm text-ink-800/70">{cat.items} products</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="rounded-lg bg-ink-900 px-4 py-2 text-xs font-semibold text-white">Shop Now</span>
                    <Icon className="h-12 w-12 text-ink-800/40" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
