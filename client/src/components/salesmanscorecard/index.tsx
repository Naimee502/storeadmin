import React, { useMemo, useState } from "react";
import { useQuery } from "@apollo/client";
import { ArrowDown, ArrowUp, Trophy } from "lucide-react";
import { useAppSelector } from "../../redux/hooks";
import { selectIsModuleAllowed } from "../../redux/slices/permissions";
import { GET_SALESMAN_SCORECARD } from "../../graphql/queries/insight";

const RANGES: [number, string][] = [[30, "30 Days"], [90, "90 Days"], [365, "1 Year"]];
const money = (n: any) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
const bar = (v: number, top: number) => `${top > 0 ? Math.max(Math.round((v / top) * 100), 2) : 0}%`;

const SalesmanScorecard: React.FC = () => {
  const fullState = useAppSelector((state: any) => state);
  const allowed = selectIsModuleAllowed(fullState, "reports.pulse") && selectIsModuleAllowed(fullState, "reports.salesmen");
  const [days, setDays] = useState(30);

  const { data, loading } = useQuery(GET_SALESMAN_SCORECARD, { variables: { days }, skip: !allowed, fetchPolicy: "cache-and-network" });
  const rows = data?.getSalesmanScorecard || [];
  const top = useMemo(() => Math.max(...rows.map((r: any) => Number(r.billed) || 0), 0), [rows]);

  if (!allowed) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5 font-sans">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 border-b border-slate-200 pb-2 mb-2">
        <div className="min-w-0 lg:flex-1">
          <h2 className="text-[13px] font-semibold text-slate-900">Salesman Performance</h2>
          <p className="truncate text-[11px] text-slate-500">Billed, collected, discount given and new customers — each against the same period before</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1 lg:flex-nowrap">
          {RANGES.map(([d, label]) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-md border px-2 text-[12px] font-medium transition-colors ${
                days === d ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading && !rows.length ? (
        <p className="py-4 text-center text-[11px] text-slate-400">Loading…</p>
      ) : !rows.length ? (
        <p className="py-4 text-center text-[11px] text-slate-400">No bills carry a salesman in this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="text-left text-[10px] uppercase tracking-wide text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-2 py-1.5 font-semibold">Salesman</th>
                <th className="px-2 py-1.5 font-semibold">Billed</th>
                <th className="px-2 py-1.5 font-semibold">vs Before</th>
                <th className="px-2 py-1.5 font-semibold">Collected</th>
                <th className="px-2 py-1.5 font-semibold">Discount</th>
                <th className="px-2 py-1.5 font-semibold">Bills</th>
                <th className="px-2 py-1.5 font-semibold">Customers</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any, n: number) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      {n === 0 && <Trophy size={12} className="shrink-0 text-amber-500" />}
                      <span className="truncate font-medium text-slate-900">{r.name}</span>
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="font-semibold text-slate-900">{money(r.billed)}</div>
                    <div className="mt-0.5 h-1 w-20 rounded-full bg-slate-100">
                      <div className="h-1 rounded-full bg-indigo-500" style={{ width: bar(Number(r.billed), top) }} />
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    {r.changePercent == null ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <span className={`inline-flex items-center gap-0.5 font-medium ${r.changePercent >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {r.changePercent >= 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                        {Math.abs(r.changePercent)}%
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <span className={`font-medium ${r.collectionPercent >= 80 ? "text-emerald-600" : r.collectionPercent >= 50 ? "text-amber-600" : "text-rose-600"}`}>
                      {r.collectionPercent}%
                    </span>
                    <span className="ml-1 text-[10.5px] text-slate-400">{money(r.collected)}</span>
                  </td>
                  <td className="px-2 py-1.5">
                    <span className={`font-medium ${r.discountPercent >= 10 ? "text-rose-600" : "text-slate-700"}`}>{r.discountPercent}%</span>
                    <span className="ml-1 text-[10.5px] text-slate-400">{money(r.discount)}</span>
                  </td>
                  <td className="px-2 py-1.5 text-slate-700">{r.bills}</td>
                  <td className="px-2 py-1.5 text-slate-700">
                    {r.customers}
                    {r.newCustomers > 0 && <span className="ml-1 text-[10.5px] font-medium text-emerald-600">+{r.newCustomers} new</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SalesmanScorecard;
