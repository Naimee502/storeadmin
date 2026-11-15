import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { Plus } from "lucide-react";
import FormField from "../../components/formfiled";
import HomeLayout from "../../layouts/home";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectModuleActions } from "../../redux/slices/permissions";
import { showMessage } from "../../redux/slices/message";
import { GET_METAL_RATE_HISTORY, GET_METAL_RATES, SET_METAL_RATES } from "../../graphql/queries/jewellery";
import { formatDateDMY, todayYMD } from "../../utils/helper";

type Row = { metal: string; purity: string; rate: string; last?: string };
const STARTER: Row[] = [
  { metal: "gold", purity: "24K", rate: "" }, { metal: "gold", purity: "22K", rate: "" }, { metal: "gold", purity: "18K", rate: "" },
  { metal: "silver", purity: "999", rate: "" }, { metal: "silver", purity: "925", rate: "" },
];
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** One metal's past rates. */
function History({ metal, purity }: { metal: string; purity: string }) {
  const { data } = useQuery(GET_METAL_RATE_HISTORY, { variables: { metal, purity }, fetchPolicy: "cache-and-network" });
  const rows: any[] = data?.getMetalRateHistory || [];
  return (
    <div className="max-h-56 overflow-auto rounded border border-slate-200">
      <table className="w-full text-left text-[12px]">
        <thead className="bg-slate-50 text-slate-500"><tr><th className="px-2 py-1">Date</th><th className="px-2 py-1 text-right">Rate / g</th><th className="px-2 py-1">By</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id} className="border-t border-slate-100"><td className="px-2 py-1">{formatDateDMY(r.date)}</td><td className="px-2 py-1 text-right">₹{r.rate}</td><td className="px-2 py-1">{r.createdby_name || "—"}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

const MetalRates = () => {
  const dispatch = useAppDispatch();
  const actions = useAppSelector((s) => selectModuleActions(s, "jewellery"));
  const [date, setDate] = useState(todayYMD());
  const { data, loading } = useQuery(GET_METAL_RATES, { variables: { date }, fetchPolicy: "cache-and-network" });
  const [save, { loading: saving }] = useMutation(SET_METAL_RATES, { refetchQueries: ["GetMetalRates", "GetMetalRateHistory"] });
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState<string>("");

  useEffect(() => {
    const saved: any[] = data?.getMetalRates || [];
    if (!data) return;
    const list: Row[] = saved.map((r) => ({ metal: r.metal, purity: r.purity, rate: r.date === date ? String(r.rate) : "", last: `₹${r.rate} on ${formatDateDMY(r.date)}` }));
    for (const s of STARTER) if (!list.some((r) => r.metal === s.metal && r.purity === s.purity)) list.push({ ...s });
    setRows(list);
  }, [data, date]);

  const set = (i: number, patch: Partial<Row>) => setRows((l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const submit = async () => {
    const rates = rows.filter((r) => r.metal.trim() && r.purity.trim() && Number(r.rate) > 0).map((r) => ({ metal: r.metal.trim().toLowerCase(), purity: r.purity.trim().toUpperCase(), rate: Number(r.rate) }));
    if (!rates.length) return dispatch(showMessage({ message: "Enter at least one rate.", type: "error" }));
    try {
      await save({ variables: { date, rates } });
      dispatch(showMessage({ message: "Rates saved.", type: "success" }));
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Could not save the rates.", type: "error" }));
    }
  };

  return (
    <HomeLayout>
      <div className="w-full max-w-4xl space-y-3 px-2 pb-6 pt-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Today's Rates</h1>
            <p className="text-[12px] text-slate-500">Rate per gram. Jewellery bills and old gold take the latest rate on or before their date.</p>
          </div>
          <div className="w-44"><FormField label="Date" name="date" type="date" value={date} onChange={(e: any) => setDate(e.target.value || todayYMD())} /></div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-slate-50 text-[12px] text-slate-500"><tr><th className="px-3 py-2">Metal</th><th className="px-3 py-2">Purity</th><th className="px-3 py-2">Rate / g on {formatDateDMY(date)}</th><th className="px-3 py-2">Last Saved</th><th /></tr></thead>
            <tbody>
              {loading && !data && <tr><td colSpan={5} className="px-3 py-3 text-slate-400">Loading…</td></tr>}
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2"><input value={cap(r.metal)} onChange={(e) => set(i, { metal: e.target.value.toLowerCase() })} className="h-8 w-28 rounded-md border border-slate-300 px-2" /></td>
                  <td className="px-3 py-2"><input value={r.purity} onChange={(e) => set(i, { purity: e.target.value.toUpperCase() })} className="h-8 w-20 rounded-md border border-slate-300 px-2" /></td>
                  <td className="px-3 py-2"><input type="number" value={r.rate} onChange={(e) => set(i, { rate: e.target.value })} placeholder="₹ per gram" className="h-8 w-32 rounded-md border border-slate-300 px-2" /></td>
                  <td className="px-3 py-2 text-slate-600">
                    {r.last || "—"}
                    {r.last && <button type="button" onClick={() => setOpen(open === `${r.metal}|${r.purity}` ? "" : `${r.metal}|${r.purity}`)} className="ml-2 text-indigo-700 hover:underline">History</button>}
                    {open === `${r.metal}|${r.purity}` && <div className="mt-2"><History metal={r.metal} purity={r.purity} /></div>}
                  </td>
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setRows((l) => [...l, { metal: "platinum", purity: "950", rate: "" }])} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 text-[13px] font-medium text-indigo-700"><Plus size={14} /> Add Metal</button>
          {actions.showEdit && <button type="button" disabled={saving} onClick={submit} className="h-8 rounded-md bg-indigo-600 px-4 text-[13px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">Save Rates</button>}
        </div>
      </div>
    </HomeLayout>
  );
};

export default MetalRates;
