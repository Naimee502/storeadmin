import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ChevronLeft, ChevronRight, ArrowRight, Smartphone, Shirt } from "lucide-react";

const slides = [
  {
    eyebrow: "For every kind of business",
    title: "One storefront. Every category.",
    body: "Grocery, electronics, fashion, home & more — plus wholesale pricing for retail partners.",
    cta: "Start Shopping",
    link: "/shop",
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
  {
    eyebrow: "New season, new arrivals",
    title: "Fresh drops across Fashion",
    body: "Curated collections for men, women & kids — starting at ₹499.",
    cta: "Shop Fashion",
    link: "/shop",
    gradFrom: "from-rose-600",
    gradTo: "to-rose-800",
  },
];

export default function HeroBanner() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % slides.length), 5000);
    return () => clearInterval(id);
  }, []);

  const slide = slides[active];

  return (
    <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Main carousel */}
        <div
          className={`relative col-span-2 flex min-h-[280px] flex-col justify-center overflow-hidden rounded-2xl bg-gradient-to-br ${slide.gradFrom} ${slide.gradTo} p-8 text-white transition-colors duration-500 sm:min-h-[340px] sm:p-12`}
        >
          <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
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
        </div>

        {/* Side promo tiles */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <div className="flex flex-col justify-between rounded-2xl bg-blue-50 p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Electronics</p>
              <h3 className="mt-1 text-xl font-bold text-ink-900">Smart Gadgets</h3>
              <p className="mt-1 text-sm text-slate-500">Starting at ₹1,499</p>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <Link to="/shop" className="rounded-lg bg-ink-900 px-4 py-2 text-xs font-semibold text-white hover:bg-ink-800">
                Shop Now
              </Link>
              <Smartphone className="h-12 w-12 text-blue-300" />
            </div>
          </div>
          <div className="flex flex-col justify-between rounded-2xl bg-rose-50 p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">Fashion</p>
              <h3 className="mt-1 text-xl font-bold text-ink-900">New Season Styles</h3>
              <p className="mt-1 text-sm text-slate-500">Flat 30% off</p>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <Link to="/shop" className="rounded-lg bg-ink-900 px-4 py-2 text-xs font-semibold text-white hover:bg-ink-800">
                Shop Now
              </Link>
              <Shirt className="h-12 w-12 text-rose-300" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
