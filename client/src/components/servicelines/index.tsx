import { useMemo } from "react";
import { ITEM_QUERIES, useAddNew } from "../../hooks/useaddnew";
import { Plus, Trash2 } from "lucide-react";
import FormField from "../formfiled";

export type SvcLine = { productserviceid?: string | null; variantid?: string | null; salesunitid?: string | null; description?: string; qty: number | string; rate: number | string };

const idOf = (v: any) => (v && typeof v === "object" ? v.id : v) || null;
const num = (v: any) => Number(v) || 0;

export const toSvcLines = (lines: any[] = []): SvcLine[] =>
  lines.map((l) => ({ productserviceid: idOf(l.productserviceid), variantid: idOf(l.variantid), salesunitid: idOf(l.salesunitid), description: l.description || "", qty: l.qty ?? 1, rate: l.rate ?? 0 }));

/** Lines as the API takes them; empty rows dropped. */
export const svcInput = (lines: SvcLine[]) =>
  lines
    .filter((l) => (l.productserviceid || String(l.description || "").trim()) && num(l.qty) > 0)
    .map((l) => ({
      productserviceid: l.productserviceid || null, variantid: l.variantid || null, salesunitid: l.salesunitid || null,
      description: l.description || undefined, qty: num(l.qty), rate: num(l.rate), amount: num(l.qty) * num(l.rate),
    }));
export const svcTotal = (lines: SvcLine[]) => lines.reduce((s, l) => s + num(l.qty) * num(l.rate), 0);

const firstOf = (p: any, vid?: string | null) =>
  p?.isservice ? p?.servicevariants?.find((v: any) => v.id === vid) || p?.servicevariants?.[0] : p?.productvariants?.find((v: any) => v.id === vid) || p?.productvariants?.[0];
const rateOf = (p: any, v: any) => (p?.isservice ? num(v?.servicerate) : num(v?.unitprices?.[0]?.salesrate));
/** Minutes a service takes (its variant's duration), for booking. */
export const serviceMinutes = (p: any, vid?: string | null) => {
  const d = firstOf(p, vid)?.duration;
  if (!d?.amount) return 0;
  return /hour/i.test(String(d.unit || "")) ? num(d.amount) * 60 : num(d.amount);
};

export const itemChoices = (products: any[], kind: "service" | "goods" | "all") =>
  products
    .filter((p: any) => kind === "all" || (kind === "service" ? p.isservice : !p.isservice))
    .flatMap((p: any) => {
      const vs = (p.isservice ? p.servicevariants : p.productvariants) || [];
      if (vs.length <= 1) return [{ value: `${p.id}|${vs[0]?.id || ""}`, label: p.name }];
      return vs.map((v: any) => ({ value: `${p.id}|${v.id}`, label: `${p.name} - ${v.name}` }));
    });

export const pickLine = (products: any[], value: string): Partial<SvcLine> => {
  const [pid, vid] = String(value || "").split("|");
  const p = products.find((x: any) => x.id === pid);
  const v = firstOf(p, vid || null);
  return { productserviceid: pid || null, variantid: v?.id || null, salesunitid: p?.isservice ? null : idOf(v?.baseunitid), rate: rateOf(p, v) };
};

/** Saved lines as Sales Invoice rows (ProductSection shape). */
export const toInvoiceProducts = (lines: any[], products: any[]) =>
  (lines || [])
    .filter((l: any) => idOf(l.productserviceid))
    .map((l: any) => {
      const p = products.find((x: any) => x.id === idOf(l.productserviceid));
      const v = firstOf(p, idOf(l.variantid));
      const gst = num(v?.gst);
      // The bill takes the rate before GST.
      const qty = num(l.qty), rate = p?.isservice && v?.taxinclusive && gst ? num(l.rate) / (1 + gst / 100) : num(l.rate);
      return {
        productserviceid: idOf(l.productserviceid), variantid: idOf(l.variantid), salesunitid: idOf(l.salesunitid),
        productname: `${l.productserviceid?.name || p?.name || ""}${l.variantid?.name ? ` - ${l.variantid.name}` : ""}`,
        unitquantity: 1, quantity: qty, rate, discount: 0, gst, total: rate * qty * (1 + gst / 100),
        selectedUnitValue: idOf(l.salesunitid) ? `${idOf(l.salesunitid)}--1` : null,
      };
    });

/** Item / description / qty / rate rows for services, estimates and spares. */
export default function ServiceLines({
  title, lines, setLines, products, kind = "all", stock = false, freeText = false, hint,
}: {
  title: string;
  lines: SvcLine[];
  setLines: (l: SvcLine[]) => void;
  products: any[];
  kind?: "service" | "goods" | "all";
  stock?: boolean;
  freeText?: boolean;
  hint?: string;
}) {
  const options = useMemo(() => itemChoices(products, kind), [products, kind]);
  const addNew = useAddNew(kind === "service" ? "/services/addedit" : "/products/addedit", ITEM_QUERIES);

  const edit = (i: number, patch: Partial<SvcLine>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <fieldset className="border rounded-xl p-4 space-y-2">
      <legend className="text-sm font-medium px-2">{title}</legend>
      {hint && <p className="text-[12px] text-slate-500">{hint}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[12px] text-slate-500">
              <th className="w-8 py-1">#</th>
              <th className="min-w-[220px] py-1">Item</th>
              {freeText && <th className="min-w-[160px] py-1">Description</th>}
              <th className="w-20 py-1 text-right">Qty</th>
              <th className="w-28 py-1 text-right">Rate (₹)</th>
              {stock && <th className="w-24 py-1 text-right">In Stock</th>}
              <th className="w-28 py-1 text-right">Amount (₹)</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const p = products.find((x: any) => x.id === l.productserviceid);
              const v = p && !p.isservice ? firstOf(p, l.variantid) : null;
              const short = stock && v && num(l.qty) > num(v.currentstock);
              return (
                <tr key={i} className="border-t border-slate-100 align-top">
                  <td className="py-1.5 text-slate-500">{i + 1}</td>
                  <td className="py-1 pr-2">
                    <FormField label="" name={`svc${i}`} type="select" searchable options={options} addable onAddNew={addNew}
                      value={l.productserviceid ? `${l.productserviceid}|${l.variantid || ""}` : ""}
                      onChange={(e: any) => edit(i, pickLine(products, e.target.value))} />
                  </td>
                  {freeText && (
                    <td className="py-1 pr-2">
                      <input className="h-8 w-full rounded-md border border-slate-300 px-2" value={l.description || ""} placeholder="Description" onChange={(e) => edit(i, { description: e.target.value })} />
                    </td>
                  )}
                  <td className="py-1 pr-2">
                    <input type="number" min="0" step="any" className="h-8 w-full rounded-md border border-slate-300 px-2 text-right" value={l.qty} onChange={(e) => edit(i, { qty: e.target.value })} />
                  </td>
                  <td className="py-1 pr-2">
                    <input type="number" min="0" step="any" className="h-8 w-full rounded-md border border-slate-300 px-2 text-right" value={l.rate} onChange={(e) => edit(i, { rate: e.target.value })} />
                  </td>
                  {stock && <td className={`py-1.5 pr-2 text-right ${short ? "font-semibold text-rose-600" : "text-slate-600"}`}>{v ? num(v.currentstock) : "—"}</td>}
                  <td className="py-1.5 pr-2 text-right text-slate-700">{(num(l.qty) * num(l.rate)).toFixed(2)}</td>
                  <td className="py-1">
                    <button type="button" title="Remove" className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {!lines.length && <tr><td colSpan={8} className="py-3 text-center text-slate-400">No items yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setLines([...lines, { qty: 1, rate: 0 }])} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed border-indigo-300 px-3 text-[13px] font-medium text-indigo-600 hover:bg-indigo-50">
          <Plus size={14} /> Add Item
        </button>
        {lines.length > 0 && <span className="text-[13px] font-semibold text-slate-800">Total ₹{svcTotal(lines).toFixed(2)}</span>}
      </div>
    </fieldset>
  );
}
