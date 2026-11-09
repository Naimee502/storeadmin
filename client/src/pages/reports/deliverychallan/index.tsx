import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@apollo/client";
import { useAppSelector } from "../../../redux/hooks";
import HomeLayout from "../../../layouts/home";
import ReportTable, { type ReportColumn, type ReportFilterField } from "../../../components/reporttable";
import { GET_DELIVERY_CHALLANS_REPORT, GET_DELETED_DELIVERY_CHALLANS } from "../../../graphql/queries/deliverychallan";
import { GST_PORTAL_REPORT_INVOICES } from "../../../graphql/queries/reports/gst";
import { formatDateDMY, normalizeToYMD, todayYMD, shiftDaysYMD } from "../../../utils/helper";
import { partyLabel } from "../../../utils/partylabel";
import { challanNo } from "../../deliverychallan";
import { FaBoxOpen, FaClipboardList, FaHourglassHalf, FaTrashAlt } from "react-icons/fa";

const tabs = [
  { id: "register", label: "Challan Register", icon: <FaClipboardList className="text-xs text-sky-600" /> },
  { id: "items", label: "Item-wise", icon: <FaBoxOpen className="text-xs text-indigo-600" /> },
  { id: "pending", label: "Pending to Bill", icon: <FaHourglassHalf className="text-xs text-amber-600" /> },
  { id: "deleted", label: "Deleted", icon: <FaTrashAlt className="text-xs text-rose-600" /> },
];

const REASON: Record<string, string> = {
  sale: "Sale", jobwork: "Job Work", approval: "On Approval", repair: "Repair", branchtransfer: "Branch Transfer", other: "Other",
};
const STATUS: Record<string, string> = { open: "Open", delivered: "Delivered", returned: "Returned" };
const dateTo = (ymd?: string) => (ymd ? `${ymd}￿` : undefined);
const daysSince = (ymd: string) => Math.max(0, Math.floor((Date.parse(todayYMD()) - Date.parse(ymd)) / 86400000));

const DeliveryChallanReports: React.FC = () => {
  const [activeTab, setActiveTab] = useState(tabs[0].id);
  const [filters, setFilters] = useState<{ [key: string]: any }>({});
  const [appliedFilters, setAppliedFilters] = useState<{ [key: string]: any }>({});
  useEffect(() => {
    const range = { fromDate: shiftDaysYMD(-30), toDate: todayYMD() };
    setFilters(range);
    setAppliedFilters(range);
  }, []);

  const { type, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);
  const branchid = type === "admin" ? selectedBranchId : type === "branch" ? branch?.id : type === "staff" ? staff?.branchid?.id : undefined;

  const fromDate: string | undefined = appliedFilters.fromDate || undefined;
  const toDate: string | undefined = appliedFilters.toDate || undefined;
  const ready = !!(fromDate || toDate);
  const isDeleted = activeTab === "deleted";

  // Same list queries as the screens, so the report also works offline from the device's data.
  const { data, loading } = useQuery(GET_DELIVERY_CHALLANS_REPORT, {
    variables: { filter: { branchid, billdateFrom: fromDate, billdateTo: dateTo(toDate) } },
    skip: !ready || isDeleted,
    fetchPolicy: "cache-and-network",
  });
  const { data: deletedData, loading: deletedLoading } = useQuery(GET_DELETED_DELIVERY_CHALLANS, {
    variables: { filter: { branchid } },
    skip: !isDeleted,
    fetchPolicy: "cache-and-network",
  });
  // Invoices made from a challan carry sourcechallanid; offline this is how a challan is known as billed.
  const { data: invData } = useQuery(GST_PORTAL_REPORT_INVOICES, {
    variables: { filter: { branchid, billdateFrom: fromDate } },
    skip: !ready || activeTab !== "pending",
    fetchPolicy: "cache-and-network",
  });

  const challans: any[] = useMemo(() => data?.getDeliveryChallans || [], [data]);
  const billedIds = useMemo(
    () => new Set((invData?.getSalesInvoices || []).filter((i: any) => i.status !== false && i.cancelStatus !== "cancelled").map((i: any) => String(i.sourcechallanid || ""))),
    [invData],
  );

  const row = (c: any) => {
    const ymd = normalizeToYMD(c.billdate);
    return {
      id: c.id,
      challanNo: challanNo(c),
      date: formatDateDMY(c.billdate),
      ymd,
      partyId: c.partyacc?.id || "",
      party: partyLabel(c.partyacc) || "-",
      reasonKey: c.reason || "sale",
      reason: REASON[c.reason] || c.reason || "-",
      statusKey: c.challanStatus || "open",
      status: STATUS[c.challanStatus] || "Open",
      items: (c.productservice || []).length,
      qty: (c.productservice || []).reduce((s: number, l: any) => s + (Number(l.qty) || 0), 0),
      amount: Number(c.totalamount) || 0,
      invoiceNo: c.invoicenumber || c.sourceInvoiceNumber || "-",
      ewaybill: c.ewaybillno || "-",
      vehicle: c.vehiclenumber || "-",
    };
  };

  const partyOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of [...challans, ...(deletedData?.getDeletedDeliveryChallans || [])]) {
      if (c.partyacc?.id) seen.set(c.partyacc.id, partyLabel(c.partyacc) || "-");
    }
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [challans, deletedData]);

  const pass = (r: any, dated = false) => {
    if (dated && fromDate && r.ymd < fromDate) return false;
    if (dated && toDate && r.ymd > toDate) return false;
    if (appliedFilters.partyacc && r.partyId !== appliedFilters.partyacc) return false;
    if (appliedFilters.reason && r.reasonKey !== appliedFilters.reason) return false;
    if (appliedFilters.challanStatus && r.statusKey !== appliedFilters.challanStatus) return false;
    return true;
  };

  const dateFields: ReportFilterField[] = [
    { name: "fromDate", label: "From Date", type: "date" },
    { name: "toDate", label: "To Date", type: "date" },
  ];
  const partyField: ReportFilterField = { name: "partyacc", label: "Party", type: "select", options: partyOptions, searchable: true };
  const reasonField: ReportFilterField = { name: "reason", label: "Reason", type: "select", options: Object.entries(REASON).map(([value, label]) => ({ value, label })) };
  const statusField: ReportFilterField = { name: "challanStatus", label: "Status", type: "select", options: Object.entries(STATUS).map(([value, label]) => ({ value, label })) };

  let tableData: any[] = [];
  let columns: ReportColumn[] = [];
  let filterFields: ReportFilterField[] = [];

  switch (activeTab) {
    case "register":
      tableData = challans.map(row).filter((r) => pass(r));
      columns = [
        { label: "Challan No", key: "challanNo" },
        { label: "Date", key: "date" },
        { label: "Party", key: "party" },
        { label: "Reason", key: "reason" },
        { label: "Items", key: "items", numeric: true },
        { label: "Qty", key: "qty", numeric: true },
        { label: "Amount (₹)", key: "amount", numeric: true },
        { label: "Invoice No", key: "invoiceNo" },
        { label: "E-Way Bill", key: "ewaybill" },
        { label: "Vehicle", key: "vehicle" },
        { label: "Status", key: "status" },
      ];
      filterFields = [...dateFields, partyField, reasonField, statusField];
      break;

    case "items":
      tableData = challans.flatMap((c) => {
        const r = row(c);
        if (!pass(r)) return [];
        return (c.productservice || []).map((l: any) => ({
          challanNo: r.challanNo,
          date: r.date,
          party: r.party,
          product: l.productserviceid?.name || "-",
          variant: l.variantid?.name || "-",
          unit: l.salesunitid?.unitname || "-",
          qty: Number(l.qty) || 0,
          amount: Number(l.amount) || 0,
          status: r.status,
        }));
      });
      columns = [
        { label: "Challan No", key: "challanNo" },
        { label: "Date", key: "date" },
        { label: "Party", key: "party" },
        { label: "Product", key: "product" },
        { label: "Variant", key: "variant" },
        { label: "Unit", key: "unit" },
        { label: "Qty", key: "qty", numeric: true },
        { label: "Amount (₹)", key: "amount", numeric: true },
        { label: "Status", key: "status" },
      ];
      filterFields = [...dateFields, partyField, reasonField, statusField];
      break;

    case "pending":
      // Goods out on a sale challan with no invoice yet (returned challans need no bill).
      tableData = challans
        .filter((c) => (c.reason || "sale") === "sale" && c.challanStatus !== "returned" && !c.invoiceid && !c.sourceinvoiceid && !billedIds.has(String(c.id)))
        .map((c) => ({ ...row(c), days: daysSince(normalizeToYMD(c.billdate)) }))
        .filter((r) => pass(r))
        .sort((a, b) => b.days - a.days);
      columns = [
        { label: "Challan No", key: "challanNo" },
        { label: "Date", key: "date" },
        { label: "Party", key: "party" },
        { label: "Qty", key: "qty", numeric: true },
        { label: "Amount (₹)", key: "amount", numeric: true },
        { label: "Days Pending", key: "days" },
        { label: "Status", key: "status" },
      ];
      filterFields = [...dateFields, partyField, statusField];
      break;

    case "deleted":
      tableData = (deletedData?.getDeletedDeliveryChallans || []).map(row).filter((r: any) => pass(r, true));
      columns = [
        { label: "Challan No", key: "challanNo" },
        { label: "Date", key: "date" },
        { label: "Party", key: "party" },
        { label: "Reason", key: "reason" },
        { label: "Qty", key: "qty", numeric: true },
        { label: "Amount (₹)", key: "amount", numeric: true },
      ];
      filterFields = [...dateFields, partyField, reasonField];
      break;
  }

  const current = tabs.find((t) => t.id === activeTab)!;

  return (
    <HomeLayout>
      <div className="w-full p-4 font-sans">
        <div className="mb-3 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium transition-colors ${
                activeTab === tab.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
        <ReportTable
          moduleId="reports.deliverychallan"
          title={`Delivery Challan — ${current.label}`}
          columns={columns}
          data={tableData}
          filterFields={filterFields}
          filters={filters}
          setFilters={setFilters}
          appliedFilters={appliedFilters}
          setAppliedFilters={setAppliedFilters}
          isLoading={isDeleted ? deletedLoading : loading}
          showExport
          showCsv
          showPdf
          exportFileName={`DeliveryChallan-${current.label.replace(/\s+/g, "")}`}
          showTotals
        />
      </div>
    </HomeLayout>
  );
};

export default DeliveryChallanReports;
