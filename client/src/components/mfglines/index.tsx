import { useMemo } from "react";
import { ITEM_QUERIES, useAddNew } from "../../hooks/useaddnew";
import { Plus, Trash2 } from "lucide-react";
import FormField from "../formfiled";

export type MfgLine = {
  productserviceid: string;
  variantid?: string | null;
  salesunitid?: string | null;
  qty: number | string;
  wastage?: number | string;
  rate?: number | string;
  note?: string;
};

const idOf = (v: any) => (v && typeof v === "object" ? v.id : v) || null;
const num = (v: any) => Number(v) || 0;

/** Saved lines (BOM, production) in the editable shape. */
export const toMfgLines = (lines: any[] = []): MfgLine[] =>
  lines.map((l) => ({
    productserviceid: idOf(l.productserviceid) || "",
    variantid: idOf(l.variantid),
    salesunitid: idOf(l.salesunitid),
    qty: l.qty ?? 0,
    wastage: l.wastage ?? "",
    rate: l.rate ?? "",
    note: l.note || "",
  }));

/** Lines as the API takes them; empty rows dropped. */
export const mfgInput = (lines: MfgLine[]) =>
  lines
    .filter((l) => l.productserviceid && num(l.qty) > 0)
    .map((l) => ({
      productserviceid: l.productserviceid,
      variantid: l.variantid || null,
      salesunitid: l.salesunitid || null,
      qty: num(l.qty),
      wastage: l.wastage === "" || l.wastage === undefined ? undefined : num(l.wastage),
      rate: l.rate === "" || l.rate === undefined ? undefined : num(l.rate),
      note: l.note || undefined,
    }));

export const variantOf = (products: any[], pid: string, vid?: string | null) => {
  const p = products.find((x: any) => x.id === pid);
  return p?.productvariants?.find((v: any) => v.id === vid) || p?.productvariants?.[0];
};

/** Base units in one line unit (unit conversions, same rule as the bills). */
export const unitFactor = (variant: any, unitId?: string | null) => {
  if (!variant || !unitId || unitId === idOf(variant.baseunitid)) return 1;
  const c = (variant.unitconversions || []).find((u: any) => idOf(u.unitid) === unitId);
  return Number(c?.factor) || 1;
};

export const baseQtyOf = (products: any[], l: MfgLine) => num(l.qty) * unitFactor(variantOf(products, l.productserviceid, l.variantid), l.salesunitid);

/** Estimated cost of a line at the purchase rate (the server uses the branch average cost when it saves). */
export const lineCost = (products: any[], l: MfgLine) => {
  const v = variantOf(products, l.productserviceid, l.variantid);
  return baseQtyOf(products, l) * num(v?.purchaserate);
};

export const unitOptions = (variant: any) => {
  if (!variant) return [];
  const base = variant.baseunitid ? [{ value: idOf(variant.baseunitid), label: variant.baseunitid.unitname || "Base" }] : [];
  const more = (variant.unitconversions || [])
    .filter((u: any) => idOf(u.unitid) && idOf(u.unitid) !== idOf(variant.baseunitid))
    .map((u: any) => ({ value: idOf(u.unitid), label: `${u.unitid?.unitname || "Unit"} (${u.factor})` }));
  return [...base, ...more];
};

/** One option per item and variant: "Copper Wire - 2mm". Items with no item type set are always offered. */
export const itemOptions = (products: any[], goodsOnly = true, types?: string[]) =>
  products
    .filter((p: any) => (!goodsOnly || !p.isservice) && (!types?.length || !p.itemtype || types.includes(p.itemtype)))
    .flatMap((p: any) => {
      const vs = p.productvariants || [];
      if (vs.length <= 1) return [{ value: `${p.id}|${vs[0]?.id || ""}`, label: p.name }];
      return vs.map((v: any) => ({ value: `${p.id}|${v.id}`, label: `${p.name} - ${v.name}` }));
    });

export const MAKES = ["finished", "semifinished"];
export const CONSUMES = ["raw", "semifinished", "consumable"];

export const pickItem = (products: any[], value: string) => {
  const [pid, vid] = String(value || "").split("|");
  const v = variantOf(products, pid, vid || null);
  return { productserviceid: pid || "", variantid: v?.id || null, salesunitid: idOf(v?.baseunitid) };
};

/** Item + unit + qty rows, with wastage (BOM), rate (by-products) or stock (production) columns. */
export default function MfgLines({
  title,
  lines,
  setLines,
  products,
  wastage = false,
  rate = false,
  rateLabel = "Value / Unit",
  stock = false,
  types,
  error,
  hint,
  bare = false,
}: {
  title: string;
  lines: MfgLine[];
  setLines: (l: MfgLine[]) => void;
  products: any[];
  wastage?: boolean;
  rate?: boolean;
  rateLabel?: string;
  stock?: boolean;
  /** Item types this list accepts; items with none set still show. */
  types?: string[];
  error?: string;
  hint?: string;
  /** Inside another card: a small heading instead of its own box. */
  bare?: boolean;
}) {
  const options = useMemo(() => itemOptions(products, true, types), [products, types]);
  const addNew = useAddNew("/products/addedit", ITEM_QUERIES);

  const edit = (i: number, patch: Partial<MfgLine>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const add = () => setLines([...lines, { productserviceid: "", variantid: null, salesunitid: null, qty: 1 }]);
  const Wrap: any = bare ? "div" : "fieldset";
  const cols = 5 + (wastage ? 1 : 0) + (rate ? 1 : 0) + (stock ? 1 : 0);

  return (
    <Wrap className={bare ? "space-y-2 border-t border-slate-200 pt-3" : "border rounded-xl p-4 space-y-2"}>
      {bare ? <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</h4> : <legend className="text-sm font-medium px-2">{title}</legend>}
      {hint && <p className="text-[12px] text-slate-500">{hint}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[12px] text-slate-500">
              <th className="w-8 py-1">#</th>
              <th className="min-w-[220px] py-1">Item</th>
              <th className="w-36 py-1">Unit</th>
              <th className="w-24 py-1 text-right">Qty</th>
              {wastage && <th className="w-24 py-1 text-right">Wastage %</th>}
              {rate && <th className="w-28 py-1 text-right">{rateLabel}</th>}
              {stock && <th className="w-24 py-1 text-right">In Stock</th>}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const v = variantOf(products, l.productserviceid, l.variantid);
              const short = stock && v && baseQtyOf(products, l) > num(v.currentstock);
              return (
                <tr key={i} className="border-t border-slate-100 align-top">
                  <td className="py-1.5 text-slate-500">{i + 1}</td>
                  <td className="py-1 pr-2">
                    <FormField label="" name={`item${i}`} type="select" searchable options={options} addable onAddNew={addNew}
                      value={l.productserviceid ? `${l.productserviceid}|${l.variantid || ""}` : ""}
                      onChange={(e: any) => edit(i, pickItem(products, e.target.value))} />
                  </td>
                  <td className="py-1 pr-2">
                    <FormField label="" name={`unit${i}`} type="select" searchable options={unitOptions(v)} value={l.salesunitid || ""}
                      onChange={(e: any) => edit(i, { salesunitid: e.target.value || null })} />
                  </td>
                  <td className="py-1 pr-2">
                    <input type="number" min="0" step="any" className="h-8 w-full rounded-md border border-slate-300 px-2 text-right" value={l.qty}
                      onChange={(e) => edit(i, { qty: e.target.value })} />
                  </td>
                  {wastage && (
                    <td className="py-1 pr-2">
                      <input type="number" min="0" step="any" className="h-8 w-full rounded-md border border-slate-300 px-2 text-right" value={l.wastage ?? ""}
                        placeholder="0" onChange={(e) => edit(i, { wastage: e.target.value })} />
                    </td>
                  )}
                  {rate && (
                    <td className="py-1 pr-2">
                      <input type="number" min="0" step="any" className="h-8 w-full rounded-md border border-slate-300 px-2 text-right" value={l.rate ?? ""}
                        placeholder="0" onChange={(e) => edit(i, { rate: e.target.value })} />
                    </td>
                  )}
                  {stock && (
                    <td className={`py-1.5 pr-2 text-right ${short ? "font-semibold text-rose-600" : "text-slate-600"}`}>
                      {v ? `${num(v.currentstock)} ${v.baseunitid?.unitname || ""}` : "—"}
                    </td>
                  )}
                  <td className="py-1">
                    <button type="button" title="Remove" className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {!lines.length && (
              <tr><td colSpan={cols + 1} className="py-3 text-center text-slate-400">No items yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {error && <p className="text-[12px] text-rose-600">{error}</p>}
      <button type="button" onClick={add} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed border-indigo-300 px-3 text-[13px] font-medium text-indigo-600 hover:bg-indigo-50">
        <Plus size={14} /> Add Item
      </button>
    </Wrap>
  );
}

/** Raw material (base units) for `qty` of an item, through sub-assembly BOMs, wastage at each level. */
export function explodeBom(boms: any[], products: any[], pid: string, vid: string | null, qty: number, depth = 0, out = new Map<string, number>()) {
  const bom = defaultBom(boms, pid, vid);
  if (!bom || depth > 8) {
    if (depth > 0) out.set(`${pid}|${vid || ""}`, (out.get(`${pid}|${vid || ""}`) || 0) + qty);
    return out;
  }
  const makes = baseQtyOf(products, { productserviceid: idOf(bom.productserviceid), variantid: idOf(bom.variantid), salesunitid: idOf(bom.salesunitid), qty: bom.qty }) || 1;
  const runs = qty / makes;
  for (const l of bom.items || []) {
    const line = toMfgLines([l])[0];
    const need = baseQtyOf(products, line) * runs * (1 + num(l.wastage) / 100);
    const cvid = line.variantid || variantOf(products, line.productserviceid, null)?.id || null;
    explodeBom(boms, products, line.productserviceid, cvid, need, depth + 1, out);
  }
  return out;
}

/** The item's default BOM, else its newest one. */
export const defaultBom = (boms: any[], pid: string, vid?: string | null) => {
  const mine = boms.filter((b: any) => idOf(b.productserviceid) === pid && (!vid || !idOf(b.variantid) || idOf(b.variantid) === vid));
  return mine.find((b: any) => b.isdefault) || mine[0] || null;
};
