import { useNavigate } from "react-router";
import DataTable from "../../components/datatable";
import StatusDropdown from "../../components/statusdropdown";
import HomeLayout from "../../layouts/home";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectIsModuleBusinessEnabled, selectModuleActions } from "../../redux/slices/permissions";
import { showMessage } from "../../redux/slices/message";
import { useServerPaging, useServerTable } from "../../hooks/useservertable";
import { useOfflineList } from "../../offline/listing";
import { useProductServicesQuery } from "../../graphql/hooks/products";
import { JOB_STATUS, customerLabel, jobCardNo, useJobCardsPageQuery, useServiceMutations } from "../../graphql/hooks/service";
import { toInvoiceProducts } from "../../components/servicelines";
import { formatDateDMY, todayYMD } from "../../utils/helper";
import { useCompany } from "../deliverychallan";

const SERVER_FILTER_KEYS = ["billnumber", "partyacc", "billdate", "device", "problem", "technician", "jobStatus", "promisedate", "estimatetotal"];
const esc = (v: any) => String(v ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch] as string));
const money = (n: any) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Job sheet for the counter and the customer's copy. */
export function printJobSheet(j: any, company: any, settings: any) {
  const s = settings || {};
  const rows = (lines: any[]) =>
    (lines || []).map((l: any, i: number) => `<tr><td>${i + 1}</td><td>${esc(l.productserviceid?.name || l.description || "")}${l.productserviceid?.name && l.description ? ` - ${esc(l.description)}` : ""}</td><td class="r">${esc(l.qty)}</td><td class="r">${money(l.rate)}</td><td class="r">${money(l.amount ?? Number(l.qty) * Number(l.rate))}</td></tr>`).join("");
  const table = (title: string, lines: any[]) =>
    lines?.length ? `<h4>${title}</h4><table class="items"><thead><tr><th>#</th><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead><tbody>${rows(lines)}</tbody></table>` : "";
  const html = `<!doctype html><html><head><title>${esc(jobCardNo(j))}</title><style>
    body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:0}.page{padding:10mm}
    .top{display:flex;justify-content:space-between;border-bottom:2px solid #4f46e5;padding-bottom:6px}.co{font-size:17px;font-weight:bold;color:#4f46e5}
    .muted{color:#555}table{width:100%;border-collapse:collapse}.grid td{padding:4px;border:1px solid #ddd;vertical-align:top;width:25%}
    .grid b{display:block;color:#555;font-size:10px;text-transform:uppercase}.items th{background:#eef2ff;text-align:left;padding:4px}.items td{border-bottom:1px solid #eee;padding:4px}
    .r{text-align:right}h4{margin:12px 0 4px;color:#4f46e5}.sign{display:flex;justify-content:space-between;margin-top:40px}
  </style></head><body><div class="page">
    <div class="top"><div><div class="co">${esc(s.legalName || company?.companyName || company?.name || "")}</div><div class="muted">${esc(company?.mobile || "")}</div></div>
      <div class="r"><b style="font-size:16px">JOB SHEET</b><br/>No. <b>${esc(jobCardNo(j))}</b><br/>Date ${esc(formatDateDMY(j.billdate))}</div></div>
    <table class="grid" style="margin-top:8px"><tr>
      <td><b>Customer</b>${esc(customerLabel(j))}</td><td><b>Device / Item</b>${esc(j.productserviceid?.name || j.devicename || "")}</td>
      <td><b>Serial / IMEI</b>${esc(j.serial || "")}</td><td><b>Promised</b>${esc(j.promisedate ? formatDateDMY(j.promisedate) : "")}</td></tr>
      <tr><td colspan="2"><b>Problem Reported</b>${esc(j.problem || "")}</td><td colspan="2"><b>Accessories Received</b>${esc(j.accessories || "")}</td></tr>
      <tr><td><b>Technician</b>${esc(j.technicianid?.name || "")}</td><td><b>Status</b>${esc(JOB_STATUS[j.jobStatus] || "")}</td>
      <td><b>Estimate Approved</b>${j.approved ? `Yes${j.approvedAt ? ` (${esc(formatDateDMY(j.approvedAt))})` : ""}` : "No"}</td><td><b>Warranty on Repair</b>${j.warrantydays ? `${esc(j.warrantydays)} days` : ""}</td></tr></table>
    ${table("Estimate", j.estimate)}${j.estimate?.length ? `<p class="r"><b>Estimate Total ₹ ${money(j.estimatetotal)}</b></p>` : ""}
    ${table("Spares Used", j.spares)}
    ${j.notes ? `<h4>Notes</h4>${esc(j.notes)}` : ""}
    <div class="sign"><div>Customer Signature</div><div>For ${esc(s.legalName || company?.companyName || "")}</div></div>
  </div></body></html>`;
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
  }, 400);
}

const JobCards = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const actions = useAppSelector((s) => selectModuleActions(s, "jobcards"));
  const invoiceOn = useAppSelector((s) => selectIsModuleBusinessEnabled(s, "salesinvoice"));
  const settings = useAppSelector((s: any) => s.adminsettings.settings);
  const company = useCompany();
  const table = useServerTable("jobcards", SERVER_FILTER_KEYS);
  const { items, total, loading, refetch } = useJobCardsPageQuery(table.variables);
  const serverPaging = useServerPaging(table, total, loading);
  const offline = useOfflineList("jobcard", table.page);
  const { data: productData } = useProductServicesQuery();
  const { deleteJobCard, setJobCardStatus } = useServiceMutations();

  const optionsFor = (j: any) => {
    if (j.isOffline || !actions.showEdit || j.invoiceid) return [];
    const o = Object.entries(JOB_STATUS).filter(([k]) => k !== (j.jobStatus || "received")).map(([value, label]) => ({ value, label }));
    if (invoiceOn && actions.showConvert && j.jobStatus !== "cancelled") o.push({ value: "invoice", label: "Make Sales Invoice" });
    return o;
  };
  const onStatus = async (j: any, v: string) => {
    if (v === "invoice") {
      const products = productData?.getProductServices || [];
      return navigate("/salesinvoice/addedit", {
        state: { fromService: { kind: "jobcard", id: j.id, partyacc: j.partyacc, notes: `Against Job Card ${jobCardNo(j)}${j.serial ? ` (${j.serial})` : ""}`, products: [...toInvoiceProducts(j.estimate, products), ...toInvoiceProducts(j.spares, products)] } },
      });
    }
    try {
      await setJobCardStatus({ variables: { id: j.id, jobStatus: v, expectedUpdatedAt: j.updatedAt } });
      dispatch(showMessage({ message: `Marked ${JOB_STATUS[v]}.`, type: "success" }));
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Update failed.", type: "error" }));
    }
  };

  const columns = [
    { label: "Seq", key: "seqNo" },
    { label: "Job No", key: "billnumber" },
    { label: "Date", key: "billdate" },
    { label: "Customer", key: "partyacc" },
    { label: "Device / Serial", key: "device" },
    { label: "Problem", key: "problem" },
    { label: "Technician", key: "technician" },
    { label: "Promised", key: "promisedate" },
    { label: "Estimate", key: "estimatetotal" },
    { label: "Status", key: "jobStatus" },
  ];
  const today = todayYMD();
  const buildRow = (j: any, i: number) => {
    const late = j.promisedate && j.promisedate < today && !["delivered", "cancelled", "ready"].includes(j.jobStatus);
    return {
      id: j.id,
      seqNo: i >= 0 ? table.offset + i + 1 : "",
      billnumber: jobCardNo(j),
      billdate: formatDateDMY(j.billdate),
      partyacc: customerLabel(j),
      device: [j.productserviceid?.name || j.devicename, j.serial].filter(Boolean).join(" - ") || "—",
      problem: j.problem || "—",
      technician: j.technicianid?.name || "—",
      promisedate: j.promisedate ? <span className={late ? "font-semibold text-rose-600" : ""}>{formatDateDMY(j.promisedate)}{late ? " (late)" : ""}</span> : "—",
      estimatetotal: j.estimatetotal ? `₹${money(j.estimatetotal)}${j.approved ? "" : " (not approved)"}` : "—",
      jobStatus: <StatusDropdown current={j.jobStatus || "received"} options={optionsFor(j)} onSelect={(v) => onStatus(j, v)} />,
      raw: j,
    };
  };
  const serverRows = items.map((j: any, i: number) => offline.decorate(buildRow(j, i), "seqNo"));
  const rows = offline.rows.length ? [...offline.rows.map((j: any) => offline.decorate(buildRow(j, -1), "seqNo")), ...serverRows] : serverRows;

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Job Cards"
          columns={columns}
          data={rows}
          serverPaging={serverPaging}
          showAdd={actions.showAdd}
          showEdit={(row: any) => actions.showEdit && !row.raw?.invoiceid}
          showDelete={actions.showDelete}
          showDeleted={actions.showDelete || actions.canReset}
          showPrint={actions.showPrint}
          showView={false}
          showImport={false}
          showExport={false}
          onAdd={() => navigate("/jobcards/addedit")}
          onEdit={(row) => navigate(`/jobcards/addedit/${row.id}`)}
          onPrint={(row) => printJobSheet(row.raw, company, settings)}
          onDelete={async (row) => {
            if (!window.confirm(`Delete ${row.billnumber}? Its spares go back to stock.`)) return;
            try {
              await deleteJobCard({ variables: { id: row.id, expectedUpdatedAt: row.raw?.updatedAt } });
              await refetch();
              dispatch(showMessage({ message: "Job card deleted.", type: "success" }));
            } catch (e: any) {
              dispatch(showMessage({ message: e?.message || "Failed to delete.", type: "error" }));
            }
          }}
          onShowDeleted={() => navigate("/jobcards/deletedentries")}
          isLoading={loading}
        />
      </div>
    </HomeLayout>
  );
};

export default JobCards;
