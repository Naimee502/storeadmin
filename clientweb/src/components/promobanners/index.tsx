import { Link } from "react-router";
import { ArrowRight, Sofa, Building2 } from "lucide-react";

export default function PromoBanners() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="relative flex items-center justify-between overflow-hidden rounded-2xl bg-amber-50 p-8">
          <div className="relative z-10 max-w-xs">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Home &amp; Furniture</p>
            <h3 className="mt-1 text-2xl font-bold text-ink-900">Refresh your space, save 30%</h3>
            <Link to="/shop" className="mt-4 flex items-center gap-2 rounded-lg bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink-800">
              Shop the sale <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <Sofa className="relative z-10 h-24 w-24 text-amber-300" />
          <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-amber-100" />
        </div>

        <div className="relative flex items-center justify-between overflow-hidden rounded-2xl bg-brand-800 p-8 text-white">
          <div className="relative z-10 max-w-xs">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-300">For Retailers &amp; Wholesalers</p>
            <h3 className="mt-1 text-2xl font-bold">Order in bulk with a Party Account</h3>
            <p className="mt-1 text-sm text-brand-100">Credit terms, route-based delivery &amp; custom price lists.</p>
            <Link to="/login" className="mt-4 flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-ink-900 hover:bg-slate-100">
              Apply now <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <Building2 className="relative z-10 h-24 w-24 text-brand-500" />
          <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-brand-700/60" />
        </div>
      </div>
    </section>
  );
}
