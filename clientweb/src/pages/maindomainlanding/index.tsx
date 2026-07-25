import { Store, ArrowRight } from "lucide-react";

// What shows up when someone visits the bare domain with no store link
// after it — e.g. yourdomain.com with nothing else. Deliberately neutral
// (grey, not the brand teal) since it isn't any one business's storefront
// — it's the shared platform address. Each business gets its own link
// (yourdomain.com/<their-handle>) from their Business Settings page.
export default function MainDomainLanding() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-slate-100">
          <Store className="h-7 w-7 text-slate-500" />
        </div>
        <h1 className="text-xl font-bold text-ink-900">Every business, its own storefront</h1>
        <p className="mt-2 text-sm text-slate-500">
          This address doesn't belong to a specific store. Each business on this platform has its own link —
          ask your retailer or wholesaler for theirs.
        </p>
        <div className="mt-5 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <span className="font-medium text-ink-900">Example:</span> yourdomain.com/
          <span className="font-semibold text-brand-700">rudra</span>
        </div>
        <a
          href="#"
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800"
        >
          Own a business? Set up your storefront <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
