import { useState } from "react";
import { Send, Smartphone } from "lucide-react";

export default function Newsletter() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-6 overflow-hidden rounded-2xl bg-gradient-to-r from-ink-900 to-ink-800 p-8 text-white sm:p-10 md:grid-cols-2 md:items-center">
        <div>
          <h3 className="text-2xl font-bold sm:text-3xl">Get deals before everyone else</h3>
          <p className="mt-2 text-sm text-slate-300">
            Subscribe for new arrivals, category sales and business-account offers.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSent(true);
            }}
            className="mt-5 flex max-w-md gap-2"
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              className="w-full rounded-lg border border-white/15 bg-white/10 px-4 py-2.5 text-sm placeholder:text-slate-400 outline-none focus:border-brand-400"
            />
            <button
              type="submit"
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold hover:bg-brand-500"
            >
              <Send className="h-4 w-4" /> {sent ? "Subscribed!" : "Subscribe"}
            </button>
          </form>
        </div>
        <div className="flex items-center justify-center gap-4 md:justify-end">
          <div className="flex items-center gap-3 rounded-xl bg-white/10 px-5 py-4">
            <Smartphone className="h-8 w-8 text-brand-300" />
            <div>
              <p className="text-sm font-semibold">Get the app</p>
              <p className="text-xs text-slate-300">Order &amp; track on the go</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
