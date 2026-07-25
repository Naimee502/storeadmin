import { useState } from "react";
import { Settings2, X } from "lucide-react";
import { useBusinessSettings } from "../../contexts/businesssettings";

// Dev-only preview panel — lets you flip Cash-on-Delivery-only locally
// without needing to edit the real admin's Business Settings every time.
export default function BusinessPreview() {
  const [open, setOpen] = useState(false);
  const { codOnly, setCodOnly } = useBusinessSettings();

  return (
    <div className="fixed bottom-20 right-4 z-[70] lg:bottom-6 lg:right-6">
      {open && (
        <div className="mb-3 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold text-ink-900">Storefront Preview</p>
            <button onClick={() => setOpen(false)} aria-label="Close preview panel">
              <X className="h-4 w-4 text-slate-400" />
            </button>
          </div>
          <p className="mb-3 text-xs text-slate-500">
            Simulates your admin panel's <span className="font-medium text-ink-900">Business Settings</span>.
          </p>

          <label className="flex items-center justify-between text-xs font-semibold text-ink-900">
            Cash on Delivery only
            <input
              type="checkbox"
              checked={codOnly}
              onChange={(e) => setCodOnly(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
          </label>
          <p className="mt-1 text-[11px] text-slate-400">Hides UPI / Card / Net Banking at checkout.</p>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full bg-ink-900 px-4 py-3 text-xs font-semibold text-white shadow-xl hover:bg-brand-700"
      >
        <Settings2 className="h-4 w-4" /> Preview
      </button>
    </div>
  );
}
