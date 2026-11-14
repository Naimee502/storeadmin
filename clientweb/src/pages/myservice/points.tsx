import { useQuery } from "@apollo/client";
import { Gift } from "lucide-react";
import { GET_MY_LOYALTY } from "../../graphql/queries/loyalty";
import { Empty, Loading, ServicePage, rupees, whenLabel } from "./shared";

const KIND: Record<string, string> = { earn: "Earned", redeem: "Used", expire: "Expired", adjust: "Added by shop" };

/** Customer's loyalty points: balance, how they work, and every change. */
export function MyPointsPage() {
  const { data, loading } = useQuery(GET_MY_LOYALTY, { fetchPolicy: "cache-and-network" });
  const a = data?.getMyLoyalty;
  const r = a?.rules;
  return (
    <ServicePage title="My Points">
      {loading && !a ? <Loading /> : !a || !r?.enabled ? <Empty text="Loyalty points are not available right now." /> : (
        <div className="space-y-4">
          <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-brand-700 to-brand-500 p-5 text-white">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-white/15"><Gift className="h-6 w-6" /></span>
            <div>
              <p className="text-xs uppercase tracking-wide text-white/80">Points Balance</p>
              <p className="text-3xl font-bold">{a.balance}</p>
              <p className="text-sm text-white/90">Worth {rupees(a.value)} on your next order</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Total Earned</p><p className="text-lg font-semibold text-ink-900">{a.earned}</p></div>
            <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Total Used</p><p className="text-lg font-semibold text-ink-900">{a.redeemed}</p></div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <p className="mb-1 font-semibold text-ink-900">How it works</p>
            <ul className="list-disc space-y-0.5 pl-5">
              <li>Earn {r.earnPer100} point{r.earnPer100 === 1 ? "" : "s"} for every ₹100 you spend{r.minBill > 0 ? ` (bills from ${rupees(r.minBill)})` : ""}{r.maxEarn > 0 ? `, up to ${r.maxEarn} per bill` : ""}.</li>
              <li>1 point = {rupees(r.pointValue)} off at checkout{r.minRedeem > 0 ? `, from ${r.minRedeem} points` : ""}{r.maxRedeemPercent < 100 ? `, up to ${r.maxRedeemPercent}% of an order` : ""}.</li>
              <li>{r.expiryDays > 0 ? `Points expire ${r.expiryDays} days after you earn them.` : "Points never expire."}</li>
            </ul>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <p className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-ink-900">History</p>
            {!a.history.length ? <p className="p-4 text-sm text-slate-500">No points yet. Place an order to start earning.</p> : (
              <ul className="divide-y divide-slate-100">
                {a.history.map((h: any) => (
                  <li key={h.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <div>
                      <p className="font-medium text-ink-900">{KIND[h.kind] || h.kind}{h.docno ? ` · ${h.docno}` : ""}</p>
                      <p className="text-xs text-slate-500">{whenLabel(h.createdAt)}{h.note ? ` · ${h.note}` : ""}</p>
                    </div>
                    <span className={`font-semibold ${h.points < 0 ? "text-rose-600" : "text-emerald-700"}`}>{h.points > 0 ? "+" : ""}{h.points}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </ServicePage>
  );
}
