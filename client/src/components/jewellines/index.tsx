import React from "react";
import { useQuery } from "@apollo/client";
import { Gem, Plus, Trash2 } from "lucide-react";
import FormField from "../formfiled";
import { useOptInOn } from "../../hooks/useoptin";
import { GET_METAL_RATES } from "../../graphql/queries/jewellery";
import type { InvoiceProduct } from "../productsection";

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const r3 = (n: number) => Math.round((Number(n) || 0) * 1000) / 1000;
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
export const MAKING: Record<string, string> = { pergram: "₹ per gram", percent: "% of metal", fixed: "₹ fixed" };

/** Metal value, making and charges of one line; `total` is the line's price before GST. */
export const jewelTotals = (j: any) => {
  const net = r3(j.netweight != null && j.netweight !== "" ? Number(j.netweight) : Number(j.grossweight || 0) - Number(j.stoneweight || 0));
  const metalvalue = r2(net * Number(j.metalrate || 0));
  const m = Number(j.making || 0);
  const makingamount = r2(j.makingtype === "percent" ? (metalvalue * m) / 100 : j.makingtype === "fixed" ? m : net * m);
  const total = r2(metalvalue + makingamount + Number(j.stonecharge || 0) + Number(j.othercharge || 0));
  return { netweight: net, metalvalue, makingamount, total };
};

/** Today's rates as "gold|22K" → rate. */
export const useMetalRates = (skip = false) => {
  const { data } = useQuery(GET_METAL_RATES, { skip, fetchPolicy: "cache-and-network" });
  const rows: any[] = data?.getMetalRates || [];
  return { rows, rateOf: (metal: string, purity: string) => Number(rows.find((r) => r.metal === metal && r.purity === purity)?.rate || 0) };
};

type Props = { products: InvoiceProduct[]; setProducts: React.Dispatch<React.SetStateAction<InvoiceProduct[]>> };

/** Weight × today's rate + making for each line (Jewellery module); sets the line rate. */
export const JewelLines: React.FC<Props> = ({ products, setProducts }) => {
  const on = useOptInOn("jewellery");
  const { rows, rateOf } = useMetalRates(!on);
  if (!on) return null;
  const lines = products.map((p, i) => ({ p, i })).filter(({ p }) => p.productserviceid);
  if (!lines.length) return null;
  const metalOptions = rows.map((r) => ({ value: `${r.metal}|${r.purity}`, label: `${cap(r.metal)} ${r.purity} · ₹${r.rate}/g` }));
  const update = (i: number, patch: Record<string, any>) => setProducts((list) => list.map((x, j) => {
    if (j !== i) return x;
    const jewel: Record<string, any> = { makingtype: "pergram", ...(x.jewel || {}), ...patch };
    if (!jewel.metal) return { ...x, jewel };
    const t = jewelTotals(jewel);
    const qty = Number(x.quantity) || 1;
    const rate = r2(t.total / qty);
    return { ...x, jewel: { ...jewel, netweight: t.netweight, metalvalue: t.metalvalue, makingamount: t.makingamount }, rate, total: r2((rate - Number(x.discount || 0)) * qty * (1 + Number(x.gst || 0) / 100)) };
  }));
  return (
    <fieldset className="border rounded-xl p-4 space-y-3">
      <legend className="flex items-center gap-1.5 px-2 text-sm font-medium"><Gem size={15} className="text-indigo-600" /> Jewellery Price</legend>
      {!rows.length && <p className="text-[12px] text-amber-700">No metal rates saved yet: set today's rates in Jewellery → Today's Rates.</p>}
      {lines.map(({ p, i }) => {
        const j: any = p.jewel || {};
        const t = jewelTotals(j);
        return (
          <div key={i} className="space-y-2 rounded-md border border-slate-200 p-2">
            <div className="text-[13px] font-medium text-slate-700">{p.productname}</div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-6 xl:grid-cols-9">
              <div className="col-span-2">
                <FormField label="Metal & Purity" name={`metal_${i}`} type="select" searchable value={j.metal ? `${j.metal}|${j.purity}` : ""} options={metalOptions}
                  onChange={(e: any) => { const [metal, purity] = String(e.target.value || "").split("|"); update(i, { metal: metal || null, purity: purity || null, metalrate: metal ? rateOf(metal, purity) : 0 }); }} />
              </div>
              <FormField label="Gross Wt (g)" name={`gross_${i}`} type="number" value={j.grossweight ?? ""} onChange={(e: any) => update(i, { grossweight: e.target.value, netweight: null })} />
              <FormField label="Stone Wt (g)" name={`stone_${i}`} type="number" value={j.stoneweight ?? ""} onChange={(e: any) => update(i, { stoneweight: e.target.value, netweight: null })} />
              <FormField label="Net Wt (g)" name={`net_${i}`} type="number" value={j.netweight ?? t.netweight} onChange={(e: any) => update(i, { netweight: e.target.value })} />
              <FormField label="Rate / g (₹)" name={`rate_${i}`} type="number" value={j.metalrate ?? ""} onChange={(e: any) => update(i, { metalrate: e.target.value })} />
              <FormField label="Making" name={`mtype_${i}`} type="select" searchable value={j.makingtype || "pergram"} options={Object.entries(MAKING).map(([value, label]) => ({ value, label }))} onChange={(e: any) => update(i, { makingtype: e.target.value || "pergram" })} />
              <FormField label="Making Value" name={`making_${i}`} type="number" value={j.making ?? ""} onChange={(e: any) => update(i, { making: e.target.value })} />
              <FormField label="Stone ₹" name={`stonec_${i}`} type="number" value={j.stonecharge ?? ""} onChange={(e: any) => update(i, { stonecharge: e.target.value })} />
              <FormField label="Other ₹ (hallmark…)" name={`other_${i}`} type="number" value={j.othercharge ?? ""} onChange={(e: any) => update(i, { othercharge: e.target.value })} />
              <FormField label="HUID" name={`huid_${i}`} type="text" value={j.huid ?? ""} onChange={(e: any) => update(i, { huid: e.target.value.toUpperCase() })} />
            </div>
            {j.metal && (
              <div className="text-[12px] text-slate-600">
                Metal ₹{t.metalvalue.toLocaleString("en-IN")} + Making ₹{t.makingamount.toLocaleString("en-IN")}{Number(j.stonecharge) ? ` + Stone ₹${Number(j.stonecharge).toLocaleString("en-IN")}` : ""}{Number(j.othercharge) ? ` + Other ₹${Number(j.othercharge).toLocaleString("en-IN")}` : ""} = <b>₹{t.total.toLocaleString("en-IN")}</b> before GST (line rate)
              </div>
            )}
          </div>
        );
      })}
    </fieldset>
  );
};

export type OldGold = { description?: string; metal?: string; purity?: string; weight?: any; deduction?: any; rate?: any; amount?: number };
export const oldGoldValue = (l: OldGold) => r2(Number(l.weight || 0) * (1 - Math.min(100, Math.max(0, Number(l.deduction || 0))) / 100) * Number(l.rate || 0));

/** Old gold / silver the customer gives against this bill. */
export const OldGoldPanel: React.FC<{ lines: OldGold[]; setLines: (l: OldGold[]) => void }> = ({ lines, setLines }) => {
  const on = useOptInOn("jewellery");
  const { rows, rateOf } = useMetalRates(!on);
  if (!on) return null;
  const set = (i: number, patch: OldGold) => setLines(lines.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const total = lines.reduce((t, l) => t + oldGoldValue(l), 0);
  return (
    <fieldset className="border rounded-xl p-4 space-y-2">
      <legend className="px-2 text-sm font-medium">Old Gold / Silver Exchange</legend>
      {lines.map((l, i) => (
        <div key={i} className="grid grid-cols-2 items-end gap-2 md:grid-cols-7">
          <div className="col-span-2"><FormField label="Description" name={`og_desc_${i}`} type="text" value={l.description || ""} placeholder="Old chain" onChange={(e: any) => set(i, { description: e.target.value })} /></div>
          <FormField label="Metal & Purity" name={`og_metal_${i}`} type="select" searchable value={l.metal ? `${l.metal}|${l.purity}` : ""}
            options={rows.map((r) => ({ value: `${r.metal}|${r.purity}`, label: `${cap(r.metal)} ${r.purity}` }))}
            onChange={(e: any) => { const [metal, purity] = String(e.target.value || "").split("|"); set(i, { metal, purity, rate: rateOf(metal, purity) || l.rate }); }} />
          <FormField label="Weight (g)" name={`og_wt_${i}`} type="number" value={l.weight ?? ""} onChange={(e: any) => set(i, { weight: e.target.value })} />
          <FormField label="Deduction %" name={`og_ded_${i}`} type="number" value={l.deduction ?? ""} onChange={(e: any) => set(i, { deduction: e.target.value })} />
          <FormField label="Rate / g (₹)" name={`og_rate_${i}`} type="number" value={l.rate ?? ""} onChange={(e: any) => set(i, { rate: e.target.value })} />
          <div className="flex items-end gap-2">
            <div className="flex-1 pb-2 text-right text-[13px] font-semibold text-slate-800">₹{oldGoldValue(l).toLocaleString("en-IN")}</div>
            <button type="button" onClick={() => setLines(lines.filter((_, j) => j !== i))} className="grid h-8 w-8 place-items-center rounded-md border border-slate-300 text-rose-600"><Trash2 size={14} /></button>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setLines([...lines, { deduction: 0 }])} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 text-[13px] font-medium text-indigo-700"><Plus size={14} /> Add Old Gold</button>
        {lines.length > 0 && <div className="text-[13px]">Old gold value: <b>₹{r2(total).toLocaleString("en-IN")}</b> (taken off what the customer pays)</div>}
      </div>
    </fieldset>
  );
};
