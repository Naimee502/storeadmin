import { useEffect, useState } from "react";
import { useLazyQuery, useMutation } from "@apollo/client";
import { AlertTriangle, CheckCircle2, Copy, Download, ExternalLink, X } from "lucide-react";
import { GET_EINVOICE_EXPORT, GET_EWAYBILL_EXPORT } from "../../graphql/queries/salesinvoice";
import { SAVE_INVOICE_GST_DETAILS } from "../../graphql/mutations/salesinvoice";
import { SAVE_CHALLAN_EWAYBILL } from "../../graphql/mutations/deliverychallan";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectModuleActions } from "../../redux/slices/permissions";
import { showMessage } from "../../redux/slices/message";

type Kind = "invoice" | "challan";
const PORTAL = { einvoice: "https://einvoice1.gst.gov.in", ewaybill: "https://ewaybillgst.gov.in" };
const input = "h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-[13px] outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500";
const btn = "inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const primary = "inline-flex h-8 items-center gap-1.5 rounded-md bg-indigo-600 px-3 text-[13px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50";

function download(name: string, data: any) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Ready / missing list and the JSON for one portal; offline it says the JSON needs the network.
function ExportBlock({ title, portal, fileName, query, vars, wrap }: {
  title: string; portal: string; fileName: string; query: any; vars: any; wrap?: (json: any) => any;
}) {
  const dispatch = useAppDispatch();
  const [run, { data, loading, error }] = useLazyQuery(query, { fetchPolicy: "network-only" });
  useEffect(() => { run({ variables: vars }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const res: any = data ? Object.values(data)[0] : null;
  const json = res?.json ? (wrap ? wrap(res.json) : res.json) : null;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-semibold text-slate-800">{title}</div>
        <a href={portal} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] text-indigo-600 hover:underline">
          Open portal <ExternalLink size={12} />
        </a>
      </div>
      {loading && <div className="text-[12px] text-slate-500">Checking…</div>}
      {error && (
        <div className="rounded-md bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
          The JSON needs the internet. You can still type the number the portal gave below; it syncs later.
        </div>
      )}
      {res && res.errors.length > 0 && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-800">
          <div className="mb-1 flex items-center gap-1.5 font-semibold"><AlertTriangle size={14} /> Fix these first</div>
          <ul className="list-disc space-y-0.5 pl-5">{res.errors.map((e: string) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}
      {res && res.warnings.length > 0 && (
        <ul className="list-disc space-y-0.5 rounded-md border border-amber-200 bg-amber-50 py-2 pl-8 pr-3 text-[12px] text-amber-800">
          {res.warnings.map((w: string) => <li key={w}>{w}</li>)}
        </ul>
      )}
      {res?.ready && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-700"><CheckCircle2 size={14} /> Ready</span>
          <button type="button" className={primary} onClick={() => download(fileName, json)}><Download size={14} /> Download JSON</button>
          <button
            type="button"
            className={btn}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(JSON.stringify(json));
                dispatch(showMessage({ message: "JSON copied.", type: "success" }));
              } catch {
                dispatch(showMessage({ message: "Could not copy; use Download.", type: "error" }));
              }
            }}
          >
            <Copy size={14} /> Copy
          </button>
          <span className="text-[11px] text-slate-500">Upload it on the portal (bulk upload), then fill the details it returns below.</span>
        </div>
      )}
    </div>
  );
}

/** e-Invoice and/or e-Way Bill for one invoice (each by its module), or e-Way Bill for one challan. */
export default function GstPanel({ kind, doc, einvoice = true, ewaybill = true, onClose }: {
  kind: Kind; doc: any; einvoice?: boolean; ewaybill?: boolean; onClose: () => void;
}) {
  const showEinv = kind === "invoice" && einvoice;
  const dispatch = useAppDispatch();
  const einvActs = useAppSelector((s) => selectModuleActions(s, "einvoice"));
  const ewbActs = useAppSelector((s) => selectModuleActions(s, "ewaybill"));
  // Add for the first save, Edit once the portal's number is saved.
  const einvWrite = showEinv && (doc.irn ? einvActs.showEdit : einvActs.showAdd);
  const ewbWrite = ewaybill && (doc.ewaybillno ? ewbActs.showEdit : ewbActs.showAdd);
  const [saveInvoice, { loading: savingInv }] = useMutation(SAVE_INVOICE_GST_DETAILS, { refetchQueries: ["GetSalesInvoicesPage"] });
  const [saveChallan, { loading: savingCh }] = useMutation(SAVE_CHALLAN_EWAYBILL, { refetchQueries: ["GetDeliveryChallansPage"] });
  const [f, setF] = useState({
    irn: doc.irn || "", irnAckNo: doc.irnAckNo || "", irnAckDate: doc.irnAckDate || "", signedQr: doc.signedQr || "",
    ewaybillno: doc.ewaybillno || "", ewaybilldate: doc.ewaybilldate || "", ewaybillvalidupto: doc.ewaybillvalidupto || "",
  });
  const set = (k: keyof typeof f) => (e: any) => setF((x) => ({ ...x, [k]: e.target.value }));
  const number = kind === "invoice" ? `INV-${doc.billnumber || ""}` : `DC-${doc.billnumber || doc.offlineNumber || ""}`;
  const cancelled = doc.irnStatus === "cancelled";
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async (extra: Record<string, any> = {}) => {
    try {
      if (kind === "invoice") {
        const { irn, irnAckNo, irnAckDate, signedQr, ewaybillno, ewaybilldate, ewaybillvalidupto } = f;
        // Send only the halves whose module is on; the server checks each.
        const input = {
          ...(einvWrite ? { irn, irnAckNo, irnAckDate, signedQr } : {}),
          ...(ewbWrite ? { ewaybillno, ewaybilldate, ewaybillvalidupto } : {}),
          ...extra,
        };
        await saveInvoice({ variables: { id: doc.id, input, expectedUpdatedAt: doc.updatedAt } });
      } else {
        await saveChallan({ variables: { id: doc.id, ewaybillno: f.ewaybillno, ewaybilldate: f.ewaybilldate, ewaybillvalidupto: f.ewaybillvalidupto, expectedUpdatedAt: doc.updatedAt } });
      }
      dispatch(showMessage({ message: "GST details saved.", type: "success" }));
      onClose();
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Could not save.", type: "error" }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      {/* Header and footer stay put; only the body scrolls. */}
      <div className={`flex max-h-full w-full ${showEinv && ewaybill ? "max-w-6xl" : "max-w-2xl"} flex-col rounded-lg bg-white text-[13px] shadow-xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
          <div className="font-semibold text-slate-800">
            {showEinv && ewaybill ? "e-Invoice & e-Way Bill" : showEinv ? "e-Invoice" : "e-Way Bill"} — {number}
            {doc.irn && (
              <span className={`ml-2 rounded px-1.5 py-0.5 text-[11px] font-semibold ${cancelled ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                {cancelled ? "IRN cancelled" : "IRN generated"}
              </span>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800" aria-label="Close"><X size={16} /></button>
        </div>

        <div className={`min-h-0 flex-1 gap-5 overflow-y-auto p-4 ${showEinv && ewaybill ? "grid grid-cols-1 lg:grid-cols-2" : "space-y-5"}`}>
          {showEinv && (
            <fieldset disabled={!einvWrite} className="min-w-0 space-y-3">
              {!doc.irn && einvActs.showAdd && (
                <ExportBlock
                  title="1. e-Invoice JSON"
                  portal={PORTAL.einvoice}
                  fileName={`einvoice-${number}.json`}
                  query={GET_EINVOICE_EXPORT}
                  vars={{ invoiceId: doc.id }}
                  wrap={(j) => [j]}
                />
              )}
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <label className="md:col-span-3">IRN<input className={input} value={f.irn} onChange={set("irn")} placeholder="64 characters from the portal" /></label>
                <label>Ack No.<input className={input} value={f.irnAckNo} onChange={set("irnAckNo")} /></label>
                <label>Ack Date<input className={input} value={f.irnAckDate} onChange={set("irnAckDate")} placeholder="DD/MM/YYYY HH:MM" /></label>
                <label className="md:col-span-3">Signed QR code
                  <textarea className={`${input} h-16 py-1`} value={f.signedQr} onChange={set("signedQr")} placeholder="Paste the Signed QR Code text; it prints on the invoice" />
                </label>
              </div>
            </fieldset>
          )}

          {ewaybill && <fieldset disabled={!ewbWrite} className="min-w-0 space-y-3">
            {!doc.ewaybillno && ewbActs.showAdd && (
              <ExportBlock
                title={showEinv ? "2. e-Way Bill JSON" : "e-Way Bill JSON"}
                portal={PORTAL.ewaybill}
                fileName={`ewaybill-${number}.json`}
                query={GET_EWAYBILL_EXPORT}
                vars={{ sourceType: kind, id: doc.id }}
              />
            )}
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <label>e-Way Bill No.<input className={input} value={f.ewaybillno} onChange={set("ewaybillno")} placeholder="12 digits" /></label>
              <label>Date<input className={input} value={f.ewaybilldate} onChange={set("ewaybilldate")} placeholder="DD/MM/YYYY" /></label>
              <label>Valid Upto<input className={input} value={f.ewaybillvalidupto} onChange={set("ewaybillvalidupto")} placeholder="DD/MM/YYYY" /></label>
            </div>
          </fieldset>}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-4 py-2.5">
          <div>
            {showEinv && doc.irn && !cancelled && einvActs.showEdit && (
              <button type="button" className={btn} onClick={() => window.confirm("Mark this IRN as cancelled? Cancel it on the portal first (within 24 hours).") && save({ irnStatus: "cancelled" })}>
                Mark IRN cancelled
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" className={btn} onClick={onClose}>Close</button>
            {(einvWrite || ewbWrite) && (
              <button type="button" className={primary} disabled={savingInv || savingCh} onClick={() => save()}>Save details</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
