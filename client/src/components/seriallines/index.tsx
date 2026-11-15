import React, { useState } from "react";
import { useQuery } from "@apollo/client";
import { ScanBarcode, X } from "lucide-react";
import FormField from "../formfiled";
import { useOptInOn } from "../../hooks/useoptin";
import { GET_AVAILABLE_SERIALS, GET_INVOICE_SERIALS } from "../../graphql/queries/serials";

export type SerialItem = { productid: string; variantid?: string | null; name: string; qty: number; serials?: string[] | null };
const norm = (v: string) => v.trim().toUpperCase().replace(/\s+/g, "");

type Props = {
  /** in: units typed or scanned (purchase); out: units picked from stock (sale); return: units picked from the source invoice. */
  mode: "in" | "out" | "return";
  items: SerialItem[];
  onChange: (index: number, serials: string[]) => void;
  /** Items that carry IMEI / serial numbers (return: items with units on the invoice). */
  serialised?: (productid: string) => boolean;
  invoiceId?: string | null;
};

const Count: React.FC<{ n: number; qty: number }> = ({ n, qty }) => (
  <span className={`text-[12px] font-semibold ${n === qty ? "text-emerald-700" : "text-amber-600"}`}>{n} of {qty}</span>
);

/** Typed or scanned numbers (purchase). */
const InRow: React.FC<{ item: SerialItem; set: (v: string[]) => void }> = ({ item, set }) => {
  const [text, setText] = useState("");
  const list = item.serials || [];
  const addText = () => {
    const more = text.split(/[\n,;]+/).map(norm).filter(Boolean);
    if (more.length) set([...new Set([...list, ...more])]);
    setText("");
  };
  return (
    <div className="space-y-1.5 rounded-md border border-slate-200 p-2">
      <div className="flex items-center justify-between text-[13px]"><span className="font-medium text-slate-700">{item.name}</span><Count n={list.length} qty={item.qty} /></div>
      <div className="flex items-center gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addText(); } }}
          onBlur={addText} placeholder="Scan or type IMEI / Serial, Enter for the next" className="h-8 flex-1 rounded-md border border-slate-300 px-2 text-[13px] outline-none focus:border-indigo-500" />
        <ScanBarcode size={16} className="text-slate-400" />
      </div>
      {list.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {list.map((x) => (
            <span key={x} className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-mono text-[12px] text-slate-700">
              {x}<button type="button" onClick={() => set(list.filter((y) => y !== x))} className="text-slate-400 hover:text-rose-600"><X size={12} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

/** Units picked from stock (sale) or from the invoice (return). */
const PickRow: React.FC<{ item: SerialItem; mode: "out" | "return"; invoiceId?: string | null; set: (v: string[]) => void }> = ({ item, mode, invoiceId, set }) => {
  const { data } = useQuery(mode === "out" ? GET_AVAILABLE_SERIALS : GET_INVOICE_SERIALS, {
    variables: mode === "out" ? { productid: item.productid, variantid: item.variantid || null } : { invoiceid: invoiceId },
    skip: mode === "return" && !invoiceId, fetchPolicy: "cache-and-network",
  });
  const units: any[] = (mode === "out" ? data?.getAvailableSerials : data?.getInvoiceSerials) || [];
  const mine = units.filter((u) => u.productid === item.productid && String(u.variantid || "") === String(item.variantid || ""));
  const list = item.serials || [];
  const options = [...new Set([...mine.map((u) => u.serialno), ...list])].map((x) => ({ value: x, label: x }));
  return (
    <div className="space-y-1.5 rounded-md border border-slate-200 p-2">
      <div className="flex items-center justify-between text-[13px]"><span className="font-medium text-slate-700">{item.name}</span><Count n={list.length} qty={item.qty} /></div>
      <FormField label={mode === "out" ? "IMEI / Serial (in stock)" : "IMEI / Serial (sold on this invoice)"} name={`serials_${item.productid}_${item.variantid || ""}`}
        type="multiselect" searchable value={list} options={options} onChange={(e: any) => set((e.target.value || []).slice(0, Math.max(0, item.qty)))} />
    </div>
  );
};

/** IMEI / serial numbers of the bill's serialised items (IMEI / Serial No. module). */
const SerialLines: React.FC<Props> = ({ mode, items, onChange, serialised, invoiceId }) => {
  const on = useOptInOn("serials");
  const { data: invData } = useQuery(GET_INVOICE_SERIALS, { variables: { invoiceid: invoiceId }, skip: !on || mode !== "return" || !invoiceId, fetchPolicy: "cache-and-network" });
  const onInvoice = new Set(((invData?.getInvoiceSerials || []) as any[]).map((u) => u.productid));
  const has = (id: string) => (mode === "return" ? onInvoice.has(id) : !!serialised?.(id));
  const rows = items.map((it, i) => ({ it, i })).filter(({ it }) => it.productid && has(it.productid) && Number(it.qty) > 0);
  if (!on || !rows.length) return null;
  return (
    <fieldset className="border rounded-xl p-4 space-y-2">
      <legend className="flex items-center gap-1.5 px-2 text-sm font-medium"><ScanBarcode size={15} className="text-indigo-600" /> IMEI / Serial No.</legend>
      {rows.map(({ it, i }) => mode === "in"
        ? <InRow key={i} item={it} set={(v) => onChange(i, v)} />
        : <PickRow key={i} item={it} mode={mode} invoiceId={invoiceId} set={(v) => onChange(i, v)} />)}
      <p className="text-[12px] text-slate-500">One number per unit. {mode === "out" ? "Only units in stock can be sold; the warranty starts from this bill." : mode === "return" ? "Returned units go back into stock." : "A number already in stock or sold cannot be bought again."}</p>
    </fieldset>
  );
};

/** Lines whose serial count does not match the quantity (to stop the save). */
export const serialMismatch = (items: SerialItem[], serialised: (productid: string) => boolean) =>
  items.find((it) => it.productid && serialised(it.productid) && Number(it.qty) > 0 && (it.serials || []).length !== Number(it.qty));

export default SerialLines;
