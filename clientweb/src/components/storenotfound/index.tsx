import { AlertTriangle } from "lucide-react";

// Shown when a /<storeslug> link doesn't match any admin's Business
// Settings — either a typo'd link, or the store hasn't set its "Website
// Link" field yet.
export default function StoreNotFound({ storeSlug }: { storeSlug: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-amber-50">
          <AlertTriangle className="h-7 w-7 text-amber-600" />
        </div>
        <h1 className="text-xl font-bold text-ink-900">We couldn't find this store</h1>
        <p className="mt-2 text-sm text-slate-500">
          "<span className="font-medium text-ink-900">{storeSlug}</span>" doesn't match any active storefront.
          Double-check the link, or ask the business for their correct website link.
        </p>
      </div>
    </div>
  );
}
