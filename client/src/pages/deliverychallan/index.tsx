import { useState } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectIsModuleBusinessEnabled, selectModuleActions } from "../../redux/slices/permissions";
import DataTable from "../../components/datatable";
import StatusDropdown from "../../components/statusdropdown";
import HomeLayout from "../../layouts/home";
import { showMessage } from "../../redux/slices/message";
import { useDeliveryChallanMutations, useDeliveryChallansPageQuery } from "../../graphql/hooks/deliverychallan";
import { useServerTable, useServerPaging } from "../../hooks/useservertable";
import { formatDateDMY } from "../../utils/helper";
import { partyLabel } from "../../utils/partylabel";
import { useOfflineList } from "../../offline/listing";

export const CHALLAN_REASONS = [
  { value: "sale", label: "Sale" },
  { value: "jobwork", label: "Job Work" },
  { value: "approval", label: "On Approval" },
  { value: "repair", label: "Repair" },
  { value: "branchtransfer", label: "Branch Transfer" },
  { value: "other", label: "Other" },
];
export const reasonLabel = (v?: string) => CHALLAN_REASONS.find((r) => r.value === v)?.label || "Sale";
export const challanNo = (c: any) => `DC-${c?.billnumber || c?.offlineNumber || ""}`.replace(/^DC-DC-/, "DC-");

const SERVER_FILTER_KEYS = ["billnumber", "partyacc", "billdate", "reason", "challanStatus", "vehiclenumber", "totalamount"];

const esc = (v: any) => String(v ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch] as string));
const money = (n: any) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Rule 55: three copies (consignee, transporter, consigner); rates are optional on a challan.
export function printChallan(c: any, company: any, opts: { copies: number; showRate: boolean }) {
  const labels = ["ORIGINAL FOR CONSIGNEE", "DUPLICATE FOR TRANSPORTER", "TRIPLICATE FOR CONSIGNER"].slice(0, opts.copies);
  const lines = c.productservice || [];
  const totalQty = lines.reduce((s: number, l: any) => s + Number(l.qty || 0), 0);
  const p = c.partyacc || {};
  const head = (copy: string) => `
    <div class="copy">${copy}</div>
    <div class="co">${esc(company?.companyName || company?.name || "")}</div>
    <div class="sub">${esc(company?.address || "")}${company?.mobile ? ` · ${esc(company.mobile)}` : ""}${company?.gstnumber ? ` · GSTIN ${esc(company.gstnumber)}` : ""}</div>
    <div class="title">DELIVERY CHALLAN</div>
    <table class="meta"><tr>
      <td><b>Consignee</b><br/>${esc(p.name || p.accountname || "")}<br/>${esc([p.address, p.city, p.state].filter(Boolean).join(", "))}${p.mobile ? `<br/>${esc(p.mobile)}` : ""}${p.gstnumber ? `<br/>GSTIN ${esc(p.gstnumber)}` : ""}</td>
      <td><b>Challan No.</b> ${esc(challanNo(c))}<br/><b>Date</b> ${esc(formatDateDMY(c.billdate))}<br/><b>Reason</b> ${esc(reasonLabel(c.reason))}${c.sourceOrderNumber ? `<br/><b>Order</b> SO-${esc(c.sourceOrderNumber)}` : ""}${c.sourceInvoiceNumber ? `<br/><b>Invoice</b> ${esc(c.sourceInvoiceNumber)}` : ""}</td>
    </tr></table>`;
  const body = `
    <table class="items"><thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Unit</th>${opts.showRate ? "<th>Rate</th><th>Amount</th>" : ""}</tr></thead><tbody>
    ${lines.map((l: any, i: number) => `<tr><td>${i + 1}</td><td>${esc(l.productserviceid?.name || "")}${l.variantid?.name ? ` - ${esc(l.variantid.name)}` : ""}</td><td class="r">${esc(l.qty)}</td><td>${esc(l.salesunitid?.unitname || "")}</td>${opts.showRate ? `<td class="r">${money(l.rate)}</td><td class="r">${money(l.amount)}</td>` : ""}</tr>`).join("")}
    </tbody><tfoot><tr><td></td><td class="r"><b>Total</b></td><td class="r"><b>${esc(totalQty)}</b></td><td></td>${opts.showRate ? `<td></td><td class="r"><b>${money(c.totalamount)}</b></td>` : ""}</tr></tfoot></table>
    <table class="meta"><tr>
      <td><b>Transport</b> ${esc(c.transportname || "—")}<br/><b>Vehicle No.</b> ${esc(c.vehiclenumber || "—")}<br/><b>E-Way Bill No.</b> ${esc(c.ewaybillno || "—")}${c.distance ? `<br/><b>Distance</b> ${esc(c.distance)} km` : ""}</td>
      <td>${c.notes ? `<b>Notes</b> ${esc(c.notes)}` : ""}</td>
    </tr></table>
    <div class="sign"><div>Receiver's Signature</div><div>For ${esc(company?.companyName || company?.name || "")}<br/><br/>Authorised Signatory</div></div>`;
  const html = `<!doctype html><html><head><title>${esc(challanNo(c))}</title><style>
    body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:0}
    .page{padding:14mm;page-break-after:always}.page:last-child{page-break-after:auto}
    .copy{text-align:right;font-size:10px;font-weight:bold}.co{font-size:18px;font-weight:bold;text-align:center}
    .sub{text-align:center;color:#444;margin-bottom:6px}.title{text-align:center;font-weight:bold;font-size:14px;border:1px solid #111;padding:4px;margin:6px 0}
    table{width:100%;border-collapse:collapse;margin-bottom:6px}.meta td{border:1px solid #999;padding:6px;vertical-align:top;width:50%}
    .items th,.items td{border:1px solid #999;padding:4px}.items th{background:#f1f5f9;text-align:left}.r{text-align:right}
    .sign{display:flex;justify-content:space-between;margin-top:28px}
  </style></head><body>${labels.map((l) => `<div class="page">${head(l)}${body}</div>`).join("")}</body></html>`;
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 1000);
  }, 200);
}

/** Company shown on the challan header, whoever is logged in. */
export const useCompany = () =>
  useAppSelector((s: any) => (s.auth.type === "admin" ? s.auth.admin : s.auth.type === "branch" ? s.auth.branch?.admin : s.auth.staff?.admin));

const DeliveryChallans = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const actions = useAppSelector((s) => selectModuleActions(s, "deliverychallan"));
  const invoiceOn = useAppSelector((s) => selectIsModuleBusinessEnabled(s, "salesinvoice"));
  const company = useCompany();
  const table = useServerTable("deliverychallan", SERVER_FILTER_KEYS);
  const { items, total, loading, refetch } = useDeliveryChallansPageQuery(table.variables);
  const serverPaging = useServerPaging(table, total, loading);
  const offline = useOfflineList("deliverychallan", table.page);
  const { deleteDeliveryChallanMutation, markDeliveredMutation, markReturnedMutation } = useDeliveryChallanMutations();
  const [printing, setPrinting] = useState<any>(null);
  const [copies, setCopies] = useState(3);
  const [showRate, setShowRate] = useState(false);

  const optionsFor = (c: any) => {
    if (c.isOffline || c.challanStatus === "returned" || !actions.showEdit) return [];
    const opts: { label: string; value: string }[] = [];
    if (c.challanStatus !== "delivered") opts.push({ label: "Delivered", value: "delivered" });
    if (!c.invoiceid) opts.push({ label: "Returned (goods back)", value: "returned" });
    if (invoiceOn && !c.invoiceid && !c.sourceinvoiceid && c.reason === "sale" && actions.showConvert) {
      opts.push({ label: "Convert to Invoice", value: "convert" });
    }
    return opts;
  };

  const onStatus = async (c: any, v: string) => {
    try {
      if (v === "convert") {
        navigate(c.sourceorderid ? `/salesinvoice/addedit?orderId=${c.sourceorderid}` : `/salesinvoice/addedit?challanId=${c.id}`);
        return;
      }
      if (v === "returned" && !window.confirm(`Mark ${challanNo(c)} as returned? Its stock goes back.`)) return;
      const vars = { variables: { id: c.id, expectedUpdatedAt: c.updatedAt } };
      if (v === "delivered") await markDeliveredMutation(vars);
      else await markReturnedMutation(vars);
      dispatch(showMessage({ message: v === "delivered" ? "Marked delivered." : "Marked returned; stock restored.", type: "success" }));
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Update failed.", type: "error" }));
    }
  };

  const columns = [
    { label: "Seq", key: "seqNo" },
    { label: "Challan No", key: "billnumber" },
    { label: "Date", key: "billdate" },
    { label: "Party", key: "partyacc" },
    { label: "Against", key: "against" },
    { label: "Reason", key: "reason" },
    { label: "Items", key: "totalitem" },
    { label: "Qty", key: "totalqty" },
    { label: "Vehicle", key: "vehiclenumber" },
    { label: "Value", key: "totalamount" },
    { label: "Status", key: "challanStatus" },
  ];

  const buildRow = (c: any, i: number) => ({
    ...c,
    seqNo: table.offset + i + 1,
    billnumber: challanNo(c),
    billdate: formatDateDMY(c.billdate),
    partyacc: partyLabel(c.partyacc) || "N/A",
    against: c.sourceInvoiceNumber ? `INV ${c.sourceInvoiceNumber}` : c.sourceOrderNumber ? `SO-${c.sourceOrderNumber}` : c.invoicenumber ? `→ INV ${c.invoicenumber}` : "—",
    reason: reasonLabel(c.reason),
    totalitem: c.productservice?.length || 0,
    totalqty: c.productservice?.reduce((s: number, l: any) => s + Number(l.qty || 0), 0) || 0,
    vehiclenumber: c.vehiclenumber || "—",
    challanStatus: (
      <StatusDropdown current={c.challanStatus || "open"} options={optionsFor(c)} onSelect={(v) => onStatus(c, v)} />
    ),
    raw: c,
  });
  const serverRows = items.map((c: any, i: number) => offline.decorate(buildRow(c, i), "seqNo"));
  const rows = offline.rows.length
    ? [...offline.rows.map((c: any) => offline.decorate(buildRow(c, -1), "seqNo")), ...serverRows]
    : serverRows;

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          requireBranchForAdd={true}
          {...actions}
          title="Delivery Challans"
          columns={columns}
          data={rows}
          serverPaging={serverPaging}
          showPrint={actions.showPrint}
          onAdd={() => navigate("/deliverychallan/addedit")}
          onEdit={(row) => {
            if (row.raw?.invoiceid || row.raw?.challanStatus === "returned") {
              dispatch(showMessage({ message: "An invoiced or returned challan cannot be edited.", type: "error" }));
              return;
            }
            navigate(`/deliverychallan/addedit/${row.id}`);
          }}
          onDelete={async (row) => {
            if (!window.confirm(`Delete ${row.billnumber}? Its stock goes back.`)) return;
            try {
              await deleteDeliveryChallanMutation({ variables: { id: row.id, expectedUpdatedAt: row.raw?.updatedAt } });
              await refetch();
              dispatch(showMessage({ message: "Challan deleted.", type: "success" }));
            } catch (e: any) {
              dispatch(showMessage({ message: e?.message || "Failed to delete.", type: "error" }));
            }
          }}
          onPrint={(row) => setPrinting(row.raw)}
          onShowDeleted={() => navigate("/deliverychallan/deletedentries")}
          isLoading={loading}
        />
      </div>

      {printing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40" onClick={() => setPrinting(null)}>
          <div className="w-80 rounded-lg bg-white p-4 text-[13px] shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 font-semibold text-slate-800">Print {challanNo(printing)}</div>
            <label className="mb-2 flex items-center justify-between">
              Copies
              <select className="h-8 rounded-md border border-slate-300 px-2" value={copies} onChange={(e) => setCopies(Number(e.target.value))}>
                <option value={3}>3 (Original, Duplicate, Triplicate)</option>
                <option value={1}>1 (Original only)</option>
              </select>
            </label>
            <label className="mb-4 flex items-center gap-2">
              <input type="checkbox" checked={showRate} onChange={(e) => setShowRate(e.target.checked)} />
              Show rate and amount
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className="h-8 rounded-md border border-slate-300 px-3" onClick={() => setPrinting(null)}>Cancel</button>
              <button
                type="button"
                className="h-8 rounded-md bg-indigo-600 px-3 font-semibold text-white hover:bg-indigo-700"
                onClick={() => { printChallan(printing, company, { copies, showRate }); setPrinting(null); }}
              >
                Print
              </button>
            </div>
          </div>
        </div>
      )}
    </HomeLayout>
  );
};

export default DeliveryChallans;
