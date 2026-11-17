import { useState } from "react";
import { useNavigate } from "react-router";
import DataTable from "../../components/datatable";
import FormField from "../../components/formfiled";
import StatusDropdown, { BilledChip } from "../../components/statusdropdown";
import HomeLayout from "../../layouts/home";
import { PartyQuickAdd } from "../../components/posaddcustomer";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectIsModuleBusinessEnabled, selectModuleActions } from "../../redux/slices/permissions";
import { showMessage } from "../../redux/slices/message";
import { useServerPaging, useServerTable } from "../../hooks/useservertable";
import { useAccountsLiteQuery } from "../../graphql/hooks/accounts";
import { useProductServicesPickerQuery } from "../../graphql/hooks/products";
import { customerLabel, useMeasurementsQuery, useServiceMutations, useTailorOrdersPageQuery } from "../../graphql/hooks/service";
import { toInvoiceProducts } from "../../components/servicelines";
import { useCompany } from "../deliverychallan";
import { billBody, billHtml, companyOf, esc, f2, printHtml, printOptions } from "../../utils/billprint";
import { formatDateDMY, todayYMD } from "../../utils/helper";
import { partyLabel } from "../../utils/partylabel";

/** Garments and the measurements taken for each (the business can add any other row on the order). */
export const GARMENTS: Record<string, [string, string][]> = {
  Shirt: [["length", "Length"], ["chest", "Chest"], ["waist", "Waist"], ["hip", "Hip / Seat"], ["shoulder", "Shoulder"], ["sleeve", "Sleeve"], ["collar", "Collar"], ["cuff", "Cuff"]],
  Pant: [["length", "Length"], ["waist", "Waist"], ["hip", "Hip / Seat"], ["thigh", "Thigh"], ["knee", "Knee"], ["bottom", "Bottom"], ["rise", "Rise"]],
  Kurta: [["length", "Length"], ["chest", "Chest"], ["waist", "Waist"], ["hip", "Hip"], ["shoulder", "Shoulder"], ["sleeve", "Sleeve"], ["armhole", "Armhole"], ["neck", "Neck"]],
  Blouse: [["length", "Length"], ["bust", "Bust"], ["underbust", "Under Bust"], ["waist", "Waist"], ["shoulder", "Shoulder"], ["sleeve", "Sleeve Length"], ["sleeveround", "Sleeve Round"], ["armhole", "Armhole"], ["frontneck", "Front Neck"], ["backneck", "Back Neck"]],
  "Salwar / Churidar": [["length", "Length"], ["waist", "Waist"], ["hip", "Hip"], ["thigh", "Thigh"], ["knee", "Knee"], ["calf", "Calf"], ["bottom", "Bottom"]],
  "Suit / Coat / Blazer": [["length", "Length"], ["chest", "Chest"], ["waist", "Waist"], ["hip", "Hip"], ["shoulder", "Shoulder"], ["sleeve", "Sleeve"], ["crossback", "Cross Back"]],
  Sherwani: [["length", "Length"], ["chest", "Chest"], ["waist", "Waist"], ["hip", "Hip"], ["shoulder", "Shoulder"], ["sleeve", "Sleeve"], ["neck", "Neck"]],
  "Lehenga / Skirt": [["length", "Length"], ["waist", "Waist"], ["hip", "Hip"]],
  Other: [],
};
export const TAILOR_STATUS: Record<string, string> = { received: "Received", cutting: "Cutting", stitching: "Stitching", trial: "Ready for Trial", ready: "Ready", delivered: "Delivered", cancelled: "Cancelled" };
export const tailorNo = (o: any) => `TO-${o?.billnumber || ""}`;
const money = (n: any) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const valuesText = (vals: any[], unit?: string) => (vals || []).filter((v) => v.value).map((v) => `${v.label || v.key} ${v.value}`).join(", ") + (unit && vals?.length ? ` (${unit})` : "");

/** Order slip in the bill frame: customer copy with prices and a tailor copy with measurements only. */
export function printTailorSlip(o: any, company: any, settings: any) {
  const opts = printOptions(settings || {});
  const seller = companyOf(company, settings || {});
  const customer = o.partyacc ? partyLabel(o.partyacc) : [o.customername, o.customermobile].filter(Boolean).join(" - ");
  const cells: [string, string][] = [
    ["Customer", esc(customer || "---")], ["Order No.", esc(tailorNo(o))], ["Order Date", esc(formatDateDMY(o.billdate))],
    ["Trial Date", esc(o.trialdate ? formatDateDMY(o.trialdate) : "---")], ["Delivery Date", esc(o.deliverydate ? formatDateDMY(o.deliverydate) : "---")], ["Tailor", esc(o.staffid?.name || "---")],
  ];
  const itemCell = (i: any) => `${esc(i.garment)}${i.productserviceid?.name ? ` - ${esc(i.productserviceid.name)}` : ""}`
    + `<div class="desc">${esc(valuesText(i.values, i.unit) || "No measurements")}</div>`
    + `${i.fabric ? `<div class="desc">Fabric: ${i.fabric === "own" ? "Customer's own" : "From shop"}${i.fabricnote ? ` - ${esc(i.fabricnote)}` : ""}</div>` : ""}`
    + `${i.design ? `<div class="desc">Design: ${esc(i.design)}</div>` : ""}`;
  const advance = Number(o.advance || 0);
  const customerCopy = billBody({
    title: "STITCHING ORDER", copy: "Customer Copy", memo: TAILOR_STATUS[o.orderStatus] || "", company: seller, showHeader: opts.showHeader, cells,
    columns: [{ label: "Sr", align: "c", width: "6%" }, { label: "Garment & Measurements", align: "l" }, { label: "Qty", align: "c", width: "8%" }, { label: "Rate", align: "r", width: "12%" }, { label: "Amount", align: "r", width: "14%" }],
    rows: (o.items || []).map((i: any, n: number) => [String(n + 1), itemCell(i), esc(i.qty), f2(i.rate), f2(i.amount)]),
    totals: advance ? [["Total", f2(o.total)], ["Advance Received", f2(advance)]] : undefined,
    grand: [advance ? "Balance Due" : "Total", f2(Number(o.total || 0) - advance)],
    extra: o.notes ? `<strong>Notes:</strong> ${esc(o.notes)}` : "",
    terms: opts.showTerms ? opts.terms : undefined,
    signLeft: "Customer Signature", signCompany: opts.signCompany ? seller.name : null,
  });
  const tailorCopy = billBody({
    title: "STITCHING ORDER", copy: "Tailor Copy", memo: o.deliverydate ? `Deliver by ${formatDateDMY(o.deliverydate)}` : "", company: seller, showHeader: opts.showHeader, cells,
    columns: [{ label: "Sr", align: "c", width: "6%" }, { label: "Garment & Measurements", align: "l" }, { label: "Qty", align: "c", width: "8%" }],
    rows: (o.items || []).map((i: any, n: number) => [String(n + 1), itemCell(i), esc(i.qty)]),
    extra: o.notes ? `<strong>Notes:</strong> ${esc(o.notes)}` : "",
    signLeft: "Tailor", signCompany: null, signLabel: "Checked By",
  });
  printHtml(billHtml(tailorNo(o), [customerCopy, tailorCopy]));
}

/** Add or edit one garment's measurements for a customer. */
function MeasurementDialog({ row, onClose }: { row: any; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const { addMeasurement, editMeasurement } = useServiceMutations();
  const { data: accountData } = useAccountsLiteQuery();
  const [partyOpen, setPartyOpen] = useState(false);
  const [f, setF] = useState<any>({
    partyacc: row?.partyacc?.id || "", customername: row?.customername || "", customermobile: row?.customermobile || "",
    garment: row?.garment || "Shirt", unit: row?.unit || "inch", takenon: row?.takenon || todayYMD(), notes: row?.notes || "",
    values: Object.fromEntries((row?.values || []).map((v: any) => [v.key, v.value])),
  });
  const fields: [string, string][] = [...(GARMENTS[f.garment] || []), ...Object.keys(f.values).filter((k) => !(GARMENTS[f.garment] || []).some(([x]) => x === k)).map((k) => [k, k] as [string, string])];
  const [extra, setExtra] = useState("");
  const save = async () => {
    if (!f.partyacc && !f.customername.trim()) return dispatch(showMessage({ message: "Pick a customer or type the name.", type: "error" }));
    const input = {
      partyacc: f.partyacc || null, customername: f.partyacc ? "" : f.customername.trim(), customermobile: f.partyacc ? "" : f.customermobile.trim(),
      garment: f.garment, unit: f.unit, takenon: f.takenon, notes: f.notes || undefined,
      values: fields.map(([key, label]) => ({ key, label, value: String(f.values[key] ?? "") })).filter((v) => v.value.trim()),
    };
    try {
      if (row?.id) await editMeasurement({ variables: { id: row.id, input } });
      else await addMeasurement({ variables: { input } });
      dispatch(showMessage({ message: "Measurements saved.", type: "success" }));
      onClose();
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Could not save.", type: "error" }));
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-2xl space-y-3 overflow-auto rounded-lg bg-white p-4 text-[13px] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="font-semibold text-slate-800">{row?.id ? "Edit Measurements" : "Take Measurements"}</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormField label="Customer" name="partyacc" type="select" searchable addable onAddNew={() => setPartyOpen(true)} value={f.partyacc}
              options={(accountData?.getAccounts || []).map((a: any) => ({ value: a.id, label: partyLabel(a) }))} onChange={(e: any) => setF({ ...f, partyacc: e.target.value })} />
          </div>
          {!f.partyacc && <FormField label="Customer Name" name="customername" type="text" value={f.customername} onChange={(e: any) => setF({ ...f, customername: e.target.value })} />}
          {!f.partyacc && <FormField label="Mobile" name="customermobile" type="tel" value={f.customermobile} onChange={(e: any) => setF({ ...f, customermobile: e.target.value })} />}
          <FormField label="Garment" name="garment" type="select" searchable value={f.garment} options={Object.keys(GARMENTS).map((g) => ({ value: g, label: g }))} onChange={(e: any) => setF({ ...f, garment: e.target.value || "Shirt" })} />
          <FormField label="Unit" name="unit" type="select" searchable value={f.unit} options={[{ value: "inch", label: "Inch" }, { value: "cm", label: "Cm" }]} onChange={(e: any) => setF({ ...f, unit: e.target.value || "inch" })} />
          <FormField label="Taken On" name="takenon" type="date" value={f.takenon} onChange={(e: any) => setF({ ...f, takenon: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {fields.map(([key, label]) => (
            <FormField key={key} label={label} name={`m_${key}`} type="text" value={f.values[key] ?? ""} onChange={(e: any) => setF({ ...f, values: { ...f.values, [key]: e.target.value } })} />
          ))}
        </div>
        <div className="flex items-end gap-2">
          <div className="w-48"><FormField label="Add Measurement" name="extra" type="text" value={extra} placeholder="e.g. Bicep" onChange={(e: any) => setExtra(e.target.value)} /></div>
          <button type="button" disabled={!extra.trim()} onClick={() => { setF({ ...f, values: { ...f.values, [extra.trim()]: "" } }); setExtra(""); }}
            className="h-8 rounded-md border border-indigo-200 bg-indigo-50 px-3 font-medium text-indigo-700 disabled:opacity-50">Add</button>
        </div>
        <FormField label="Notes" name="notes" type="text" value={f.notes} placeholder="Loose fit, stomach…" onChange={(e: any) => setF({ ...f, notes: e.target.value })} />
        <div className="flex justify-end gap-2">
          <button type="button" className="h-8 rounded-md border border-slate-300 px-3" onClick={onClose}>Cancel</button>
          <button type="button" onClick={save} className="h-8 rounded-md bg-indigo-600 px-3 font-semibold text-white hover:bg-indigo-700">Save</button>
        </div>
        <PartyQuickAdd open={partyOpen} onClose={() => setPartyOpen(false)} onPicked={(pid) => setF({ ...f, partyacc: pid })} />
      </div>
    </div>
  );
}

const SERVER_FILTER_KEYS = ["billnumber", "partyacc", "billdate", "items", "trialdate", "deliverydate", "orderStatus", "staff"];

const Tailoring = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const actions = useAppSelector((s) => selectModuleActions(s, "tailoring"));
  const invoiceOn = useAppSelector((s) => selectIsModuleBusinessEnabled(s, "salesinvoice"));
  const settings = useAppSelector((s: any) => s.adminsettings.settings);
  const company = useCompany();
  const [tab, setTab] = useState<"orders" | "measurements">("orders");
  const table = useServerTable("tailoring", SERVER_FILTER_KEYS);
  const { items, total, loading, refetch } = useTailorOrdersPageQuery(table.variables);
  const serverPaging = useServerPaging(table, total, loading);
  const { data: productData } = useProductServicesPickerQuery();
  const { setTailorOrderStatus, deleteTailorOrder, deleteMeasurement } = useServiceMutations();
  const [mSearch, setMSearch] = useState("");
  const { data: mData, loading: mLoading } = useMeasurementsQuery(mSearch, tab !== "measurements");
  const [measuring, setMeasuring] = useState<any>(null);
  const today = todayYMD();

  const optionsFor = (o: any) => {
    if (!actions.showEdit || o.invoiceid) return [];
    const opts = Object.entries(TAILOR_STATUS).filter(([k]) => k !== (o.orderStatus || "received")).map(([value, label]) => ({ value, label }));
    if (o.partyacc?.id) opts.push({ value: "advance", label: "Record Advance" });
    if (invoiceOn && actions.showConvert && o.orderStatus !== "cancelled") opts.push({ value: "invoice", label: "Make Sales Invoice" });
    return opts;
  };
  const onStatus = async (o: any, v: string) => {
    if (v === "advance") {
      const due = Math.max(0, Number(o.total || 0) - Number(o.advance || 0));
      return navigate(`/payments/addedit?party=${o.partyacc.id}&reference=${encodeURIComponent(tailorNo(o))}${due ? `&amount=${due}` : ""}`);
    }
    if (v === "invoice") {
      const products = productData?.getProductServices || [];
      return navigate("/salesinvoice/addedit", {
        state: { fromService: { kind: "tailororder", id: o.id, partyacc: o.partyacc, isservice: true, notes: `Against Stitching Order ${tailorNo(o)}`, products: toInvoiceProducts(o.items || [], products) } },
      });
    }
    try {
      await setTailorOrderStatus({ variables: { id: o.id, orderStatus: v, expectedUpdatedAt: o.updatedAt } });
      dispatch(showMessage({ message: `Marked ${TAILOR_STATUS[v]}.`, type: "success" }));
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Update failed.", type: "error" }));
    }
  };

  const rows = items.map((o: any, i: number) => {
    const late = o.deliverydate && o.deliverydate < today && !["delivered", "cancelled"].includes(o.orderStatus);
    return {
      id: o.id, seqNo: table.offset + i + 1, billnumber: tailorNo(o), billdate: formatDateDMY(o.billdate), partyacc: customerLabel(o),
      items: (o.items || []).map((x: any) => `${x.qty} ${x.garment}`).join(", "),
      trialdate: o.trialdate ? formatDateDMY(o.trialdate) : "—",
      deliverydate: o.deliverydate ? <span className={late ? "font-semibold text-rose-600" : ""}>{formatDateDMY(o.deliverydate)}{late ? " (late)" : ""}</span> : "—",
      total: `₹${money(o.total)}${o.advance ? ` · Adv ₹${money(o.advance)}` : ""}`,
      staff: o.staffid?.name || "—",
      orderStatus: <span className="inline-flex items-center gap-1"><StatusDropdown current={o.orderStatus || "received"} options={optionsFor(o)} onSelect={(v) => onStatus(o, v)} /><BilledChip invoiceid={o.invoiceid} /></span>,
      raw: o,
    };
  });
  const mRows = (mData?.getMeasurements || []).map((m: any, i: number) => ({
    id: m.id, seqNo: i + 1, partyacc: customerLabel(m), garment: m.garment, takenon: m.takenon ? formatDateDMY(m.takenon) : "—",
    values: valuesText(m.values, m.unit) || "—", raw: m,
  }));

  return (
    <HomeLayout>
      <div className="w-full space-y-3 px-2 pb-6 pt-4 sm:px-6">
        <div className="inline-flex h-8 overflow-hidden rounded-md border border-slate-300 text-[13px]">
          {([["orders", "Stitching Orders"], ["measurements", "Measurements"]] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`px-3 ${tab === k ? "bg-indigo-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}>{label}</button>
          ))}
        </div>
        {tab === "orders" ? (
          <DataTable
            title="Stitching Orders"
            columns={[{ label: "Seq", key: "seqNo" }, { label: "Order No", key: "billnumber" }, { label: "Date", key: "billdate" }, { label: "Customer", key: "partyacc" },
              { label: "Garments", key: "items" }, { label: "Trial", key: "trialdate" }, { label: "Delivery", key: "deliverydate" }, { label: "Amount", key: "total" },
              { label: "Tailor", key: "staff" }, { label: "Status", key: "orderStatus" }]}
            data={rows}
            serverPaging={serverPaging}
            showAdd={actions.showAdd}
            showEdit={(row: any) => actions.showEdit && !row.raw?.invoiceid}
            showDelete={actions.showDelete}
            showDeleted={actions.showDelete || actions.canReset}
            showPrint={actions.showPrint}
            showView={false} showImport={false} showExport={false}
            onAdd={() => navigate("/tailoring/addedit")}
            onEdit={(row: any) => navigate(`/tailoring/addedit/${row.id}`)}
            onPrint={(row: any) => printTailorSlip(row.raw, company, settings)}
            onDelete={async (row: any) => {
              if (!window.confirm(`Delete ${row.billnumber}?`)) return;
              try {
                await deleteTailorOrder({ variables: { id: row.id, expectedUpdatedAt: row.raw?.updatedAt } });
                await refetch();
                dispatch(showMessage({ message: "Order deleted.", type: "success" }));
              } catch (e: any) {
                dispatch(showMessage({ message: e?.message || "Failed to delete.", type: "error" }));
              }
            }}
            onShowDeleted={() => navigate("/tailoring/deletedentries")}
            isLoading={loading}
          />
        ) : (
          <>
            <input value={mSearch} onChange={(e) => setMSearch(e.target.value)} placeholder="Find customer by name or mobile"
              className="h-8 w-72 rounded-md border border-slate-300 px-2 text-[13px] outline-none focus:border-indigo-500" />
            <DataTable
              title="Measurements"
              columns={[{ label: "Seq", key: "seqNo" }, { label: "Customer", key: "partyacc" }, { label: "Garment", key: "garment" }, { label: "Taken On", key: "takenon" }, { label: "Measurements", key: "values" }]}
              data={mRows}
              isLoading={mLoading && !mData}
              showAdd={actions.showAdd} showEdit={actions.showEdit} showDelete={actions.showDelete}
              showView={false} showImport={false} showExport={false}
              onAdd={() => setMeasuring({})}
              onEdit={(row: any) => setMeasuring(row.raw)}
              onDelete={async (row: any) => {
                if (!window.confirm("Delete these measurements?")) return;
                try {
                  await deleteMeasurement({ variables: { id: row.id } });
                  dispatch(showMessage({ message: "Deleted.", type: "success" }));
                } catch (e: any) {
                  dispatch(showMessage({ message: e?.message || "Failed to delete.", type: "error" }));
                }
              }}
            />
            <p className="text-[12px] text-slate-500">A stitching order saves its measurements here too; each change is kept as a new record, so older sizes stay in the history.</p>
          </>
        )}
      </div>
      {measuring && <MeasurementDialog row={measuring.id ? measuring : null} onClose={() => setMeasuring(null)} />}
    </HomeLayout>
  );
};

export default Tailoring;
