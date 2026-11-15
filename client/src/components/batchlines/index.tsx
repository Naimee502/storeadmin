import React from "react";
import { useQuery } from "@apollo/client";
import { PackageCheck } from "lucide-react";
import FormField from "../formfiled";
import { useOptInOn } from "../../hooks/useoptin";
import { GET_PRODUCT_BATCHES } from "../../graphql/queries/batches";
import { formatDateDMY } from "../../utils/helper";
import type { InvoiceProduct } from "../productsection";

type Props = {
  /** in: bills that bring stock (batch no and dates typed); out: bills that take stock (batch picked). */
  mode: "in" | "out";
  products: InvoiceProduct[];
  setProducts: React.Dispatch<React.SetStateAction<InvoiceProduct[]>>;
  branchId?: string | null;
};

const OutRow: React.FC<{ p: InvoiceProduct; i: number; branchId?: string | null; set: (i: number, patch: Partial<InvoiceProduct>) => void }> = ({ p, i, branchId, set }) => {
  const { data } = useQuery(GET_PRODUCT_BATCHES, {
    variables: { productid: p.productserviceid, variantid: p.variantid || null, branchid: branchId },
    skip: !p.productserviceid || !branchId, fetchPolicy: "cache-and-network",
  });
  const batches: any[] = data?.getProductBatches || [];
  const named = p.batchno && !p.batchauto ? p.batchno : "";
  if (!batches.length && !p.batchno) return null;
  const options = [
    { value: "", label: p.batchauto && p.batchno ? `Auto: ${p.batchno}` : "Auto (earliest expiry first)" },
    ...batches.map((b) => ({ value: b.batchno, label: `${b.batchno}${b.expirydate ? ` · Exp ${formatDateDMY(b.expirydate)}` : ""} · ${b.qty} left` })),
    ...(named && !batches.some((b) => b.batchno === named) ? [{ value: named, label: named }] : []),
  ];
  return (
    <div className="grid grid-cols-1 items-end gap-2 md:grid-cols-3">
      <div className="truncate text-[13px] font-medium text-slate-700 md:pb-2">{p.productname} <span className="text-slate-400">× {p.quantity}</span></div>
      <div className="md:col-span-2">
        <FormField label="Batch" name={`batch_${i}`} type="select" searchable value={named} options={options}
          onChange={(e: any) => {
            const b = batches.find((x) => x.batchno === e.target.value);
            set(i, e.target.value ? { batchno: e.target.value, expirydate: b?.expirydate || null, batchauto: false } : { batchno: null, expirydate: null, batchauto: false });
          }} />
      </div>
    </div>
  );
};

/** Batch details of the bill's item lines (Batch & Expiry module). */
const BatchLines: React.FC<Props> = ({ mode, products, setProducts, branchId }) => {
  const on = useOptInOn("batches");
  if (!on) return null;
  const lines = products.map((p, i) => ({ p, i })).filter(({ p }) => p.productserviceid);
  if (!lines.length) return null;
  const set = (i: number, patch: Partial<InvoiceProduct>) => setProducts((list) => list.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <fieldset className="border rounded-xl p-4 space-y-3">
      <legend className="flex items-center gap-1.5 px-2 text-sm font-medium"><PackageCheck size={15} className="text-indigo-600" /> Batch &amp; Expiry</legend>
      {mode === "in" ? lines.map(({ p, i }) => (
        <div key={i} className="grid grid-cols-1 items-end gap-2 md:grid-cols-4">
          <div className="truncate text-[13px] font-medium text-slate-700 md:pb-2">{p.productname} <span className="text-slate-400">× {p.quantity}</span></div>
          <FormField label="Batch No." name={`batchno_${i}`} type="text" value={p.batchno || ""} placeholder="Blank = not in a batch"
            onChange={(e: any) => set(i, { batchno: e.target.value.toUpperCase() })} />
          <FormField label="Expiry Date" name={`expiry_${i}`} type="date" value={p.expirydate || ""} onChange={(e: any) => set(i, { expirydate: e.target.value || null })} />
          <FormField label="Mfg Date" name={`mfg_${i}`} type="date" value={p.mfgdate || ""} onChange={(e: any) => set(i, { mfgdate: e.target.value || null })} />
        </div>
      )) : lines.map(({ p, i }) => <OutRow key={i} p={p} i={i} branchId={branchId} set={set} />)}
      <p className="text-[12px] text-slate-500">
        {mode === "in" ? "Stock of a line with a batch number goes into that batch; the same batch number adds to it." : "Auto takes the batch that expires first; expired batches are never used."}
      </p>
    </fieldset>
  );
};

export default BatchLines;
