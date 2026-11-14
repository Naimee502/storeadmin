import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import { useMutation, useQuery } from "@apollo/client";
import { ArrowLeft, Pencil, Printer, Trash2 } from "lucide-react";
import Breadcrumb from "../../components/breadcrumb";
import { API_CONFIG } from "../../config/apiconfig";
import { GET_SUPPLIER_DOCUMENT, SUPPLIER_PRINT_LINK, UPDATE_SUPPLIER_ORDER } from "../../graphql/queries/supplier";
import { useSupplier } from "../../hooks/useSupplier";

const rupees = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateLabel = (ymd?: string | null) =>
  ymd ? new Date(`${String(ymd).slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "-";
const STATUS: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700", confirmed: "bg-sky-50 text-sky-700", received: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-rose-50 text-rose-700", returned: "bg-slate-100 text-slate-700",
};
const lineTotal = (l: any) => { const t = (l.rate - (l.discount || 0)) * l.qty; return t + (t * (l.gst || 0)) / 100; };

/** One purchase order or bill for the signed-in supplier: details, print, and edit while the order is pending. */
export default function SupplierDocumentPage() {
  const { kind = "", id = "" } = useParams();
  const supplier = useSupplier();
  const context = { headers: { Authorization: `Bearer ${supplier.token}` } };
  const { data, loading, error, refetch } = useQuery(GET_SUPPLIER_DOCUMENT, { variables: { kind, id }, skip: !supplier.token, context, fetchPolicy: "no-cache" });
  const [printLink, { loading: printing }] = useMutation(SUPPLIER_PRINT_LINK, { context });
  const [save, { loading: saving }] = useMutation(UPDATE_SUPPLIER_ORDER, { context });
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const d = data?.getSupplierDocument;
  useEffect(() => { if (d) { setRows(d.lines.map((l: any) => ({ ...l }))); setNote(d.suppliernote || ""); } }, [d]);
  if (!supplier.token) return <Navigate to="/login" replace />;

  const title = kind === "order" ? "Purchase Order" : "Bill";
  const back = kind === "order" ? "/supplier?tab=orders" : "/supplier?tab=bills";

  const print = async () => {
    const w = window.open("", "_blank");
    try {
      const { data: r } = await printLink({ variables: { kind, id } });
      const url = `${API_CONFIG.SERVER_URL}${r?.supplierPrintLink}`;
      if (w) w.location.href = url; else window.location.href = url;
    } catch (e: any) {
      w?.close();
      setMsg({ ok: false, text: e?.message || "Could not open the print page." });
    }
  };

  const submit = async () => {
    setMsg(null);
    try {
      await save({ variables: { id, note, lines: rows.map((r) => ({ lineid: r.lineid, qty: Number(r.qty) || 0, rate: Number(r.rate) || 0 })) } });
      setEditing(false);
      setMsg({ ok: true, text: "Order updated. The business has been told." });
      refetch();
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || "Could not save the order." });
    }
  };

  const shown = editing ? rows.filter((r) => Number(r.qty) > 0) : d?.lines || [];
  const editTotal = rows.reduce((t, r) => t + lineTotal({ ...r, qty: Number(r.qty) || 0, rate: Number(r.rate) || 0 }), 0);
  const cell = "px-3 py-2";

  return (
    <div>
      <Breadcrumb items={[{ label: "Supplier Account", to: "/supplier" }, { label: title }]} />
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
        <Link to={back} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" /> Back</Link>
        {loading && !d ? <p className="text-sm text-slate-500">Loading...</p> : error || !d ? <p className="text-sm text-rose-600">{error?.message || "Not found."}</p> : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-ink-900">{title} {d.billnumber || ""}</h1>
                <p className="text-sm text-slate-500">Date {dateLabel(d.billdate)}{d.duedate ? ` · Due ${dateLabel(d.duedate)}` : ""}</p>
              </div>
              <div className="flex items-center gap-2">
                {d.orderStatus && <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS[d.orderStatus] || STATUS.pending}`}>{d.orderStatus.charAt(0).toUpperCase() + d.orderStatus.slice(1)}</span>}
                {d.outstanding != null && <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${d.outstanding > 0 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{d.outstanding > 0 ? `Unpaid ${rupees(d.outstanding)}` : "Paid"}</span>}
                {d.editable && !editing && (
                  <button type="button" onClick={() => { setEditing(true); setMsg(null); }} className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-ink-900 hover:bg-slate-50">
                    <Pencil className="h-4 w-4" /> Edit Order
                  </button>
                )}
                <button type="button" onClick={print} disabled={printing} className="flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                  <Printer className="h-4 w-4" /> Print
                </button>
              </div>
            </div>
            {msg && <p className={`text-sm ${msg.ok ? "text-emerald-700" : "text-rose-600"}`}>{msg.text}</p>}
            {editing && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Change quantity or rate, or remove an item. You can edit only until the business confirms the order.</p>}

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr><th className={cell}>#</th><th className={cell}>Item</th><th className={`${cell} text-right`}>Qty</th><th className={`${cell} text-right`}>Rate</th><th className={`${cell} text-right`}>Disc.</th><th className={`${cell} text-right`}>GST</th><th className={`${cell} text-right`}>Amount</th>{editing && <th className={cell} />}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shown.map((l: any, i: number) => (
                    <tr key={l.lineid}>
                      <td className={cell}>{i + 1}</td>
                      <td className={`${cell} font-medium`}>{l.name}</td>
                      <td className={`${cell} text-right`}>
                        {editing ? <input type="number" min={0} value={l.qty} onChange={(e) => setRows((rs) => rs.map((r) => (r.lineid === l.lineid ? { ...r, qty: e.target.value } : r)))}
                          className="h-8 w-20 rounded border border-slate-300 px-2 text-right" /> : <>{l.qty} {l.unit || ""}</>}
                      </td>
                      <td className={`${cell} text-right`}>
                        {editing ? <input type="number" min={0} step="0.01" value={l.rate} onChange={(e) => setRows((rs) => rs.map((r) => (r.lineid === l.lineid ? { ...r, rate: e.target.value } : r)))}
                          className="h-8 w-24 rounded border border-slate-300 px-2 text-right" /> : rupees(l.rate)}
                      </td>
                      <td className={`${cell} text-right`}>{l.discount ? rupees(l.discount) : "-"}</td>
                      <td className={`${cell} text-right`}>{l.gst || 0}%</td>
                      <td className={`${cell} text-right`}>{rupees(editing ? lineTotal({ ...l, qty: Number(l.qty) || 0, rate: Number(l.rate) || 0 }) : l.amount)}</td>
                      {editing && <td className={cell}><button type="button" title="Remove" onClick={() => setRows((rs) => rs.map((r) => (r.lineid === l.lineid ? { ...r, qty: 0 } : r)))} className="text-slate-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-md flex-1 space-y-2 text-sm">
                {d.notes && <p><span className="font-semibold">Notes:</span> {d.notes}</p>}
                {editing ? (
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Note for the business (optional)" className="w-full rounded-lg border border-slate-300 p-3 text-sm" />
                ) : d.suppliernote ? <p><span className="font-semibold">Your note:</span> {d.suppliernote}</p> : null}
              </div>
              <div className="w-full space-y-1 rounded-xl border border-slate-200 bg-white p-4 text-sm sm:w-72">
                {editing ? (
                  <div className="flex justify-between text-base font-bold text-ink-900"><span>New total (items)</span><span>{rupees(editTotal)}</span></div>
                ) : (
                  <>
                    <div className="flex justify-between"><span className="text-slate-600">Subtotal</span><span>{rupees(d.subtotal)}</span></div>
                    {d.totaldiscount > 0 && <div className="flex justify-between"><span className="text-slate-600">Discount</span><span>-{rupees(d.totaldiscount)}</span></div>}
                    <div className="flex justify-between"><span className="text-slate-600">GST</span><span>{rupees(d.totalgst)}</span></div>
                    {d.charges.map((c: any, i: number) => <div key={i} className="flex justify-between"><span className="text-slate-600">{c.name}</span><span>{rupees(c.amount)}</span></div>)}
                    {d.roundoff ? <div className="flex justify-between"><span className="text-slate-600">Round off</span><span>{rupees(d.roundoff)}</span></div> : null}
                    <div className="flex justify-between border-t border-slate-100 pt-1 text-base font-bold text-ink-900"><span>Total</span><span>{rupees(d.totalamount)}</span></div>
                  </>
                )}
              </div>
            </div>

            {editing && (
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setEditing(false); setRows(d.lines.map((l: any) => ({ ...l }))); setNote(d.suppliernote || ""); }}
                  className="h-9 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="button" onClick={submit} disabled={saving || !rows.some((r) => Number(r.qty) > 0)}
                  className="h-9 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">{saving ? "Saving..." : "Save Changes"}</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
