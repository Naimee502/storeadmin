import { Truck, ShieldCheck, RotateCcw, Headset, Wallet } from "lucide-react";
import { businessStats as defaultBusinessStats } from "../../data/sampleData";
import { useTenant } from "../../contexts/tenant";

const props = [
  { icon: Truck, title: "Fast, Reliable Delivery", desc: "Route-based dispatch for both retail & bulk orders." },
  { icon: Wallet, title: "Flexible Pricing", desc: "Custom price lists for channels, regions & key accounts." },
  { icon: ShieldCheck, title: "Secure Payments", desc: "Card, UPI, net banking or credit-cycle billing." },
  { icon: RotateCcw, title: "Easy Returns", desc: "Hassle-free returns on eligible products." },
  { icon: Headset, title: "Dedicated Support", desc: "A salesman or support rep is always one call away." },
];

export default function ValueProps() {
  // Admin-editable (Settings → General → "Trust bar" stats) — falls back to
  // the built-in placeholder numbers whenever the admin hasn't set any.
  const { businessStats: overrideStats } = useTenant();
  const stats = overrideStats.length ? overrideStats : defaultBusinessStats;

  return (
    <section className="border-y border-slate-100 bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-3 lg:grid-cols-5">
          {props.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex flex-col items-center text-center sm:items-start sm:text-left">
              <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <Icon className="h-5.5 w-5.5" />
              </div>
              <h4 className="text-sm font-semibold text-ink-900">{title}</h4>
              <p className="mt-1 text-xs text-slate-500">{desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 grid grid-cols-2 gap-6 rounded-2xl bg-ink-900 p-8 text-white sm:grid-cols-4">
          {stats.map((s, i) => (
            <div key={`${s.label}-${i}`} className="text-center">
              <p className="text-2xl font-extrabold text-brand-300 sm:text-3xl">{s.value}</p>
              <p className="mt-1 text-xs text-slate-300">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
