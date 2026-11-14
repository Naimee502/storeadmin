import { useNavigate } from "react-router";
import DataTable from "../../components/datatable";
import StatusDropdown, { BilledChip } from "../../components/statusdropdown";
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
import { amountInWords, billBody, billHtml, companyOf, esc, f2, printHtml, printOptions } from "../../utils/billprint";

const SERVER_FILTER_KEYS = ["billnumber", "partyacc", "billdate", "device", "problem", "technician", "jobStatus", "promisedate", "estimatetotal"];

const money = (n: any) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Job sheet for the counter and the customer's copy, in the common bill layout. */
export function printJobSheet(j: any, company: any, settings: any) {
  const s = settings || {};
  const opts = printOptions(s);
  const seller = companyOf(company, s);
  if (s.legalName) seller.name = s.legalName;
  const lines = j.estimate || [];
  const amountOf = (l: any) => Number(l.amount ?? Number(l.qty) * Number(l.rate)) || 0;
  const itemName = (l: any) => `${esc(l.productserviceid?.name || l.description || "")}${l.productserviceid?.name && l.description ? ` - ${esc(l.description)}` : ""}`;
  const spares = (j.spares || []).length
    ? `<div class="inv-sub">Spares Used</div><table class="inv-table"><tbody>${j.spares.map((l: any, i: number) => `<tr><td class="ac" style="width:6%">${i + 1}</td><td class="al">${itemName(l)}</td><td class="ac" style="width:10%">${esc(l.qty)}</td><td class="ar" style="width:14%">${f2(l.rate)}</td><td class="ar" style="width:16%">${f2(amountOf(l))}</td></tr>`).join("")}</tbody></table>`
    : "";
  const total = Number(j.estimatetotal ?? lines.reduce((t: number, l: any) => t + amountOf(l), 0)) || 0;
  const body = billBody({
    title: "JOB SHEET",
    memo: `Status: ${JOB_STATUS[j.jobStatus] || "Received"}`,
    company: seller, showHeader: opts.showHeader,
    cells: [
      ["M/S.", esc(customerLabel(j))],
      ["Job No.", esc(jobCardNo(j))],
      ["Date", esc(formatDateDMY(j.billdate))],
      ["Device / Item", esc(j.productserviceid?.name || j.devicename || "---")],
      ["Serial / IMEI", esc(j.serial || "---")],
      ["Promised Date", esc(j.promisedate ? formatDateDMY(j.promisedate) : "---")],
      ["Technician", esc(j.technicianid?.name || "---")],
      ["Estimate Approved", j.approved ? `Yes${j.approvedAt ? ` (${esc(formatDateDMY(j.approvedAt))})` : ""}` : "No"],
      ["Warranty on Repair", esc(j.warrantydays ? `${j.warrantydays} days` : "---")],
      ["Problem Reported", esc(j.problem || "---")],
      ["Accessories Received", esc(j.accessories || "---")],
      ["Delivered On", esc(j.deliveredAt ? formatDateDMY(j.deliveredAt) : "---")],
    ],
    columns: [{ label: "Sr", align: "c", width: "6%" }, { label: "Estimate - Item / Work", align: "l" }, { label: "Qty", align: "c", width: "10%" }, { label: "Rate", align: "r", width: "14%" }, { label: "Amount", align: "r", width: "16%" }],
    rows: lines.map((l: any, i: number) => [String(i + 1), itemName(l), esc(l.qty), f2(l.rate), f2(amountOf(l))]),
    afterItems: spares,
    grand: lines.length ? ["Estimate Total", f2(total)] : undefined,
    words: lines.length ? amountInWords(total) : "",
    extra: j.notes ? `<strong>Notes:</strong> ${esc(j.notes)}` : "",
    signLeft: "Customer Signature",
    signCompany: opts.signCompany ? seller.name : null,
  });
  printHtml(billHtml(jobCardNo(j), [body]));
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
      // Bill the estimate, plus spares not already quoted; spares left stock with the job card.
      const est = toInvoiceProducts(j.estimate, products);
      const quoted = new Set(est.map((l: any) => `${l.productserviceid}|${l.variantid || ""}`));
      const extra = toInvoiceProducts(j.spares, products).filter((l: any) => !quoted.has(`${l.productserviceid}|${l.variantid || ""}`));
      return navigate("/salesinvoice/addedit", {
        state: { fromService: { kind: "jobcard", id: j.id, partyacc: j.partyacc, isservice: true, stockdone: true, notes: `Against Job Card ${jobCardNo(j)}${j.serial ? ` (${j.serial})` : ""}`, products: [...est, ...extra] } },
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
      jobStatus: <span className="inline-flex items-center gap-1"><StatusDropdown current={j.jobStatus || "received"} options={optionsFor(j)} onSelect={(v) => onStatus(j, v)} /><BilledChip invoiceid={j.invoiceid} /></span>,
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
