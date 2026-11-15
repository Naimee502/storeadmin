import { Link, useParams } from "react-router";
import { useQuery } from "@apollo/client";
import { Scissors } from "lucide-react";
import { GET_MY_TAILOR_ORDER, GET_MY_TAILOR_ORDERS } from "../../graphql/queries/myservice";
import { Badge, Empty, Loading, ServicePage, dateLabel, rupees } from "./shared";

const STEPS = ["received", "cutting", "stitching", "trial", "ready", "delivered"];
const STATUS: Record<string, { label: string; cls: string }> = {
  received: { label: "Received", cls: "bg-slate-100 text-slate-700" },
  cutting: { label: "Cutting", cls: "bg-sky-50 text-sky-700" },
  stitching: { label: "Stitching", cls: "bg-indigo-50 text-indigo-700" },
  trial: { label: "Ready for Trial", cls: "bg-amber-50 text-amber-700" },
  ready: { label: "Ready to Collect", cls: "bg-emerald-50 text-emerald-700" },
  delivered: { label: "Delivered", cls: "bg-emerald-50 text-emerald-700" },
  cancelled: { label: "Cancelled", cls: "bg-rose-50 text-rose-700" },
};
const garments = (o: any) => (o.items || []).map((i: any) => `${i.qty} ${i.garment}`).join(", ");

/** Customer's stitching orders. */
export function MyStitchingPage() {
  const { data, loading } = useQuery(GET_MY_TAILOR_ORDERS, { fetchPolicy: "cache-and-network" });
  const rows: any[] = data?.getMyTailorOrders || [];
  return (
    <ServicePage title="My Stitching">
      {loading && !rows.length ? <Loading /> : !rows.length ? <Empty text="No stitching orders yet." /> : (
        <div className="space-y-3">
          {rows.map((o) => {
            const st = STATUS[o.orderStatus] || STATUS.received;
            return (
              <Link key={o.id} to={`/account/stitching/${o.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-brand-700"><Scissors className="h-5 w-5" /></span>
                    <div>
                      <p className="font-semibold text-ink-900">TO-{o.billnumber} · {garments(o)}</p>
                      <p className="text-xs text-slate-500">Ordered {dateLabel(o.billdate)}{o.deliverydate ? ` · Delivery ${dateLabel(o.deliverydate)}` : ""}</p>
                    </div>
                  </div>
                  <Badge cls={st.cls}>{st.label}</Badge>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </ServicePage>
  );
}

/** One stitching order: progress, garments and payment. */
export function MyStitchingOrderPage() {
  const { id = "" } = useParams();
  const { data, loading, error } = useQuery(GET_MY_TAILOR_ORDER, { variables: { id }, fetchPolicy: "cache-and-network" });
  const o = data?.getMyTailorOrder;
  const at = o ? (o.orderStatus === "cancelled" ? -1 : STEPS.indexOf(o.orderStatus)) : -1;
  return (
    <ServicePage title={o ? `TO-${o.billnumber}` : "Stitching Order"} back="/account/stitching" crumbs={[{ label: "My Stitching", to: "/account/stitching" }]}>
      {loading && !o ? <Loading /> : !o ? <p className="text-sm text-rose-600">{error?.message || "Order not found."}</p> : (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold text-ink-900">{garments(o)}</p>
              <Badge cls={(STATUS[o.orderStatus] || STATUS.received).cls}>{(STATUS[o.orderStatus] || STATUS.received).label}</Badge>
            </div>
            {o.orderStatus !== "cancelled" && (
              <div className="flex items-center gap-1">
                {STEPS.map((s, i) => (
                  <div key={s} className="flex-1">
                    <div className={`h-1.5 rounded-full ${i <= at ? "bg-brand-600" : "bg-slate-200"}`} />
                    <p className={`mt-1 text-[10px] ${i <= at ? "text-brand-700" : "text-slate-400"}`}>{STATUS[s].label.replace(" to Collect", "")}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div><p className="text-xs text-slate-500">Ordered</p><p className="font-medium text-ink-900">{dateLabel(o.billdate)}</p></div>
              {o.trialdate && <div><p className="text-xs text-slate-500">Trial</p><p className="font-medium text-ink-900">{dateLabel(o.trialdate)}</p></div>}
              {o.deliverydate && <div><p className="text-xs text-slate-500">Delivery</p><p className="font-medium text-ink-900">{dateLabel(o.deliverydate)}</p></div>}
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <ul className="divide-y divide-slate-100">
              {o.items.map((i: any, n: number) => (
                <li key={n} className="space-y-1 px-4 py-3 text-sm">
                  <div className="flex justify-between"><span className="font-semibold text-ink-900">{i.qty} × {i.garment}{i.productserviceid?.name ? ` · ${i.productserviceid.name}` : ""}</span><span>{rupees(i.amount)}</span></div>
                  {!!i.values?.length && <p className="text-xs text-slate-600">{i.values.map((v: any) => `${v.label || v.key} ${v.value}`).join(" · ")}{i.unit ? ` (${i.unit})` : ""}</p>}
                  {i.design && <p className="text-xs text-slate-500">Design: {i.design}</p>}
                </li>
              ))}
            </ul>
            <div className="space-y-1 border-t border-slate-100 px-4 py-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-600">Total</span><span className="font-semibold">{rupees(o.total)}</span></div>
              {o.advance > 0 && <div className="flex justify-between"><span className="text-slate-600">Advance paid</span><span>{rupees(o.advance)}</span></div>}
              {o.advance > 0 && <div className="flex justify-between font-semibold text-ink-900"><span>Balance</span><span>{rupees(Math.max(0, (o.total || 0) - o.advance))}</span></div>}
            </div>
          </div>
        </div>
      )}
    </ServicePage>
  );
}
