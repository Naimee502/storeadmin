import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { useCatalog } from "../../hooks/useCatalog";
import { useTenant } from "../../contexts/tenant";
import { siteConfig } from "../../config/site";

// Uploads are served through the server's resizer: "?w=1600" returns a cached
// WebP sized for the banner instead of the full original (often several MB,
// or AVIF). Same mechanism the app uses for every image.
const bannerSrc = (url: string) =>
  /\/uploads\//.test(url) && !url.includes("?") ? `${url}?w=1600` : url;

export interface HeroSlideOverride {
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  link?: string;
  image?: string;
  /** Uploaded banner video — plays in place of the image (image = poster). */
  video?: string;
}

// Every slide and promo tile here is built from this admin's real
// categories/products (useCatalog) — nothing hardcoded like "Fashion" or
// "Smart Gadgets" anymore. When the admin has configured their own banner
// slides (Settings → General → Hero Banner), `overrideSlides` fully
// replaces the carousel with those — add/edit/remove any number of them
// from the admin panel, just like a normal ecommerce banner manager.
// Leave it empty and the catalog-driven default slides below are used.
export default function HeroBanner({ overrideSlides }: { overrideSlides?: HeroSlideOverride[] }) {
  const { companyName, heroBannerShowCategoryTiles } = useTenant();
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
        video: s.video,
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
        video: undefined as string | undefined,
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

  const slide = slides[active] ?? slides[0];
  const videoRef = useRef<HTMLVideoElement>(null);

  // Image slides advance every 5s. A video slide holds until its clip ends
  // (onEnded below) so it is never cut off half-way.
  useEffect(() => {
    if (slides.length < 2 || slide?.video) return;
    const id = setInterval(() => setActive((a) => (a + 1) % slides.length), 5000);
    return () => clearInterval(id);
  }, [slides.length, active, slide?.video]);

  // Restart the clip each time its slide comes back round.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.play().catch(() => {});
  }, [active]);
  // Image with no title = the picture is the whole banner (artwork with its
  // own text). Show it as-is: no dark overlay, no generated copy on top.
  const hasMedia = !!(slide.image || slide.video);
  const imageOnly = hasMedia && !slide.title;
  // Admin panel → Settings → General → Hero Banner. Off means the banner runs
  // edge to edge instead of leaving a third of the row to the catalogue.
  const promoTiles = heroBannerShowCategoryTiles ? categories.slice(0, 2) : [];
  const hasTiles = promoTiles.length > 0;

  return (
    <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      <div className={`grid gap-4 ${hasTiles ? "lg:grid-cols-3" : ""}`}>
        {/* Main carousel */}
        <div
          className={`relative flex min-h-[280px] flex-col justify-center overflow-hidden rounded-2xl p-8 text-white transition-colors duration-500 sm:min-h-[340px] sm:p-12 ${
            hasTiles ? "lg:col-span-2" : ""
          } ${
            slide.video ? "bg-ink-900" : slide.image ? "bg-slate-100" : `bg-gradient-to-br ${slide.gradFrom} ${slide.gradTo}`
          }`}
        >
          {/* A real <img> (not a CSS background) so the browser fetches it at
              high priority as soon as the page renders. Every slide's image
              is mounted, the inactive ones hidden, so switching slides shows
              an already-loaded picture instead of starting a download. */}
          {slides.map((s, i) =>
            s.image ? (
              <img
                key={s.image + i}
                src={bannerSrc(s.image)}
                alt={s.title || "Banner"}
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : "auto"}
                decoding="async"
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
                  i === active ? "opacity-100" : "opacity-0"
                }`}
              />
            ) : null
          )}
          {/* Only the active slide's video is mounted, so visitors download
              just the clip they are watching. Muted + playsInline is what lets
              browsers (iOS Safari included) autoplay it. */}
          {slide.video && (
            <video
              key={slide.video + active}
              ref={videoRef}
              src={slide.video}
              poster={slide.image ? bannerSrc(slide.image) : undefined}
              autoPlay
              muted
              playsInline
              loop={slides.length < 2}
              preload="auto"
              onEnded={() => setActive((a) => (a + 1) % slides.length)}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          {imageOnly && (
            // Whole banner is the link when there is no button on it.
            <Link to={slide.link} className="absolute inset-0 z-[5]" aria-label="Open banner" />
          )}
          {hasMedia && !imageOnly && <div className="absolute inset-0 bg-ink-900/50" />}
          {!hasMedia && (
            <>
              <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            </>
          )}
          {!imageOnly && (
            <>
              {slide.eyebrow && (
                <p className="relative z-10 mb-3 inline-block w-fit rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                  {slide.eyebrow}
                </p>
              )}
              <h1 className="relative z-10 max-w-md text-3xl font-extrabold leading-tight sm:text-4xl">
                {slide.title}
              </h1>
              {slide.body && (
                <p className="relative z-10 mt-3 max-w-sm text-sm text-white/85 sm:text-base">{slide.body}</p>
              )}
              {slide.cta && (
                <Link
                  to={slide.link}
                  className="relative z-10 mt-6 flex w-fit items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-ink-900 hover:bg-slate-100"
                >
                  {slide.cta} <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </>
          )}

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
