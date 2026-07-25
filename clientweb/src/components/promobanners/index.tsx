import { Link } from "react-router";
import { ArrowRight, Sofa, Building2 } from "lucide-react";
import { useTenant } from "../../contexts/tenant";

// Static fallback tiles, shown only when the admin hasn't configured any
// Promo Banners in the General settings tab.
const fallbackTiles = [
  {
    eyebrow: "Home & Furniture",
    title: "Refresh your space, save 30%",
    subtitle: "",
    cta: "Shop the sale",
    link: "/shop",
    icon: Sofa,
    bg: "bg-amber-50",
    accent: "text-amber-700",
    iconColor: "text-amber-300",
    circle: "bg-amber-100",
    dark: false,
  },
  {
    eyebrow: "For Retailers & Wholesalers",
    title: "Order in bulk with a Party Account",
    subtitle: "Credit terms, route-based delivery & custom price lists.",
    cta: "Apply now",
    link: "/login",
    icon: Building2,
    bg: "bg-brand-800",
    accent: "text-brand-300",
    iconColor: "text-brand-500",
    circle: "bg-brand-700/60",
    dark: true,
  },
];

export default function PromoBanners() {
  const { promoBanners } = useTenant();
  const configured = (promoBanners ?? []).filter((b) => b.image || b.title);

  if (configured.length > 0) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="grid gap-5 md:grid-cols-2">
          {configured.map((banner, i) => (
            <Link
              key={i}
              to={banner.link || "/shop"}
              className="relative flex min-h-[180px] items-center overflow-hidden rounded-2xl bg-slate-100 p-8"
              style={
                banner.image
                  ? { backgroundImage: `url(${banner.image})`, backgroundSize: "cover", backgroundPosition: "center" }
                  : undefined
              }
            >
              {banner.image && <div className="absolute inset-0 bg-black/35" />}
              <div className={`relative z-10 max-w-xs ${banner.image ? "text-white" : "text-ink-900"}`}>
                {banner.subtitle && (
                  <p className={`text-xs font-semibold uppercase tracking-wide ${banner.image ? "text-white/80" : "text-slate-500"}`}>
                    {banner.subtitle}
                  </p>
                )}
                {banner.title && <h3 className="mt-1 text-2xl font-bold">{banner.title}</h3>}
                {banner.cta && (
                  <span
                    className={`mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold ${
                      banner.image ? "bg-white text-ink-900" : "bg-ink-900 text-white"
                    }`}
                  >
                    {banner.cta} <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
      <div className="grid gap-5 md:grid-cols-2">
        {fallbackTiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <div
              key={tile.title}
              className={`relative flex items-center justify-between overflow-hidden rounded-2xl p-8 ${tile.bg} ${tile.dark ? "text-white" : ""}`}
            >
              <div className="relative z-10 max-w-xs">
                <p className={`text-xs font-semibold uppercase tracking-wide ${tile.accent}`}>{tile.eyebrow}</p>
                <h3 className="mt-1 text-2xl font-bold">{tile.title}</h3>
                {tile.subtitle && <p className="mt-1 text-sm text-brand-100">{tile.subtitle}</p>}
                <Link
                  to={tile.link}
                  className={`mt-4 flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold ${
                    tile.dark ? "bg-white text-ink-900 hover:bg-slate-100" : "bg-ink-900 text-white hover:bg-ink-800"
                  }`}
                >
                  {tile.cta} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <Icon className={`relative z-10 h-24 w-24 ${tile.iconColor}`} />
              <div className={`absolute -bottom-10 -right-10 h-40 w-40 rounded-full ${tile.circle}`} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
