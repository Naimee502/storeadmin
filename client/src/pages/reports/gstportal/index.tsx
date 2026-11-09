import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@apollo/client";
import { useAppSelector } from "../../../redux/hooks";
import HomeLayout from "../../../layouts/home";
import ReportTable, { type ReportColumn, type ReportFilterField } from "../../../components/reporttable";
import { GST_PORTAL_REPORT_INVOICES } from "../../../graphql/queries/reports/gst";
import { GET_DELIVERY_CHALLANS_REPORT } from "../../../graphql/queries/deliverychallan";
import { formatDateDMY, normalizeToYMD, todayYMD, shiftDaysYMD } from "../../../utils/helper";
import { partyLabel } from "../../../utils/partylabel";
import { challanNo } from "../../deliverychallan";
import { FaBan, FaCheckCircle, FaClock, FaHourglassHalf } from "react-icons/fa";

type Kind = "einvoice" | "ewaybill";

const TABS: Record<Kind, { id: string; label: string; icon: React.ReactNode }[]> = {
  einvoice: [
    { id: "generated", label: "IRN Generated", icon: <FaCheckCircle className="text-xs text-emerald-600" /> },
    { id: "pending", label: "IRN Pending", icon: <FaHourglassHalf className="text-xs text-amber-600" /> },
    { id: "cancelled", label: "IRN Cancelled", icon: <FaBan className="text-xs text-rose-600" /> },
  ],
  ewaybill: [
    { id: "generated", label: "EWB Generated", icon: <FaCheckCircle className="text-xs text-emerald-600" /> },
    { id: "pending", label: "EWB Pending", icon: <FaHourglassHalf className="text-xs text-amber-600" /> },
    { id: "expiring", label: "Expiring / Expired", icon: <FaClock className="text-xs text-rose-600" /> },
  ],
};

const GSTIN_RX = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
// e-Way Bill is needed when the goods are worth more than Rs 50,000.
const EWB_LIMIT = 50000;
const dateTo = (ymd?: string) => (ymd ? `${ymd}￿` : undefined);
// Portal dates are "DD/MM/YYYY" (time may follow).
const dmyToYmd = (v?: string) => {
  const m = String(v || "").match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
};
const dayDiff = (ymd: string) => Math.round((Date.parse(ymd) - Date.parse(todayYMD())) / 86400000);
const live = (i: any) => i.status !== false && i.cancelStatus !== "cancelled";

const GstPortalReports: React.FC<{ kind: Kind }> = ({ kind }) => {
  const tabs = TABS[kind];
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

  // List queries the device answers offline from its own data.
  const { data: invData, loading: invLoading } = useQuery(GST_PORTAL_REPORT_INVOICES, {
    variables: { filter: { branchid, billdateFrom: fromDate, billdateTo: dateTo(toDate) } },
    skip: !ready,
    fetchPolicy: "cache-and-network",
  });
  const { data: dcData, loading: dcLoading } = useQuery(GET_DELIVERY_CHALLANS_REPORT, {
    variables: { filter: { branchid, billdateFrom: fromDate, billdateTo: dateTo(toDate) } },
    skip: !ready || kind !== "ewaybill",
    fetchPolicy: "cache-and-network",
  });

  const invoices: any[] = useMemo(() => (invData?.getSalesInvoices || []).filter(live), [invData]);
  // Challans made from an invoice share that invoice's e-Way Bill, so only standalone ones count.
  const challans: any[] = useMemo(
    () => (dcData?.getDeliveryChallans || []).filter((c: any) => c.status !== false && !c.sourceinvoiceid && c.challanStatus !== "returned"),
    [dcData],
  );

  const base = (d: any, docType: string, no: string) => {
    const total = Number(d.totalamount) || 0;
    const gst = Number(d.totalgst) || 0;
    return {
      docType,
      docNo: no,
      date: formatDateDMY(d.billdate),
      ymd: normalizeToYMD(d.billdate),
      partyId: d.partyacc?.id || "",
      party: partyLabel(d.partyacc) || "-",
      gstin: d.partyacc?.gstnumber || "-",
      taxable: Math.round((total - gst) * 100) / 100,
      gst,
      total,
      irn: d.irn || "-",
      ackNo: d.irnAckNo || "-",
      ackDate: d.irnAckDate || "-",
      ewbNo: d.ewaybillno || "",
      ewbDate: d.ewaybilldate || "-",
      validUpto: d.ewaybillvalidupto || "-",
      vehicle: d.vehiclenumber || "-",
    };
  };
  const docs = useMemo(
    () => [
      ...invoices.map((i) => ({ src: i, row: base(i, "Invoice", i.billnumber || "-") })),
      ...challans.map((c) => ({ src: c, row: base(c, "Challan", challanNo(c)) })),
    ],
    [invoices, challans], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const partyOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const { row } of docs) if (row.partyId) seen.set(row.partyId, row.party);
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [docs]);
  const byParty = (r: any) => !appliedFilters.partyacc || r.partyId === appliedFilters.partyacc;
  const byType = (r: any) => !appliedFilters.docType || r.docType === appliedFilters.docType;

  const filterFields: ReportFilterField[] = [
    { name: "fromDate", label: "From Date", type: "date" },
    { name: "toDate", label: "To Date", type: "date" },
    { name: "partyacc", label: "Party", type: "select", options: partyOptions, searchable: true },
    ...(kind === "ewaybill"
      ? [{ name: "docType", label: "Document", type: "select" as const, options: [{ label: "Invoice", value: "Invoice" }, { label: "Challan", value: "Challan" }] }]
      : []),
  ];

  let tableData: any[] = [];
  let columns: ReportColumn[] = [];
  const money: ReportColumn[] = [
    { label: "Taxable (₹)", key: "taxable", numeric: true },
    { label: "GST (₹)", key: "gst", numeric: true },
    { label: "Total (₹)", key: "total", numeric: true },
  ];
  const head: ReportColumn[] = [
    ...(kind === "ewaybill" ? [{ label: "Document", key: "docType" }] : []),
    { label: kind === "ewaybill" ? "Doc No" : "Invoice No", key: "docNo" },
    { label: "Date", key: "date" },
    { label: "Party", key: "party" },
    { label: "GSTIN", key: "gstin" },
  ];

  if (kind === "einvoice") {
    const inv = docs.filter((d) => d.row.docType === "Invoice");
    if (activeTab === "generated") {
      tableData = inv.filter((d) => d.src.irn && d.src.irnStatus !== "cancelled").map((d) => d.row);
      columns = [...head, ...money, { label: "IRN", key: "irn" }, { label: "Ack No", key: "ackNo" }, { label: "Ack Date", key: "ackDate" }];
    } else if (activeTab === "pending") {
      // B2B bills (party has a GSTIN) still without an IRN.
      tableData = inv
        .filter((d) => !d.src.irn && GSTIN_RX.test(String(d.src.partyacc?.gstnumber || "").toUpperCase()))
        .map((d) => ({ ...d.row, days: Math.max(0, -dayDiff(d.row.ymd)) }));
      columns = [...head, ...money, { label: "Days Old", key: "days" }];
    } else {
      tableData = inv.filter((d) => d.src.irnStatus === "cancelled").map((d) => d.row);
      columns = [...head, ...money, { label: "IRN", key: "irn" }, { label: "Ack No", key: "ackNo" }];
    }
  } else {
    const ewbCols: ReportColumn[] = [
      { label: "EWB No", key: "ewbNo" },
      { label: "EWB Date", key: "ewbDate" },
      { label: "Valid Upto", key: "validUpto" },
      { label: "Vehicle", key: "vehicle" },
    ];
    if (activeTab === "generated") {
      tableData = docs.filter((d) => d.row.ewbNo).map((d) => d.row);
      columns = [...head, { label: "Value (₹)", key: "total", numeric: true }, ...ewbCols];
    } else if (activeTab === "pending") {
      tableData = docs.filter((d) => !d.row.ewbNo && d.row.total > EWB_LIMIT).map((d) => d.row);
      columns = [...head, { label: "Value (₹)", key: "total", numeric: true }, { label: "Vehicle", key: "vehicle" }];
    } else {
      // Valid today or tomorrow, or already past its date.
      tableData = docs
        .filter((d) => d.row.ewbNo && dmyToYmd(d.row.validUpto))
        .map((d) => {
          const left = dayDiff(dmyToYmd(d.row.validUpto));
          return { ...d.row, left, validity: left < 0 ? "Expired" : left === 0 ? "Expires today" : left === 1 ? "Expires tomorrow" : "" };
        })
        .filter((r) => r.left <= 1)
        .sort((a, b) => a.left - b.left);
      columns = [...head, { label: "Value (₹)", key: "total", numeric: true }, ...ewbCols, { label: "Validity", key: "validity" }];
    }
  }
  tableData = tableData.filter((r) => byParty(r) && byType(r));

  const current = tabs.find((t) => t.id === activeTab)!;
  const title = kind === "einvoice" ? "e-Invoice" : "e-Way Bill";

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
          moduleId={kind === "einvoice" ? "reports.einvoice" : "reports.ewaybill"}
          title={`${title} — ${current.label}`}
          columns={columns}
          data={tableData}
          filterFields={filterFields}
          filters={filters}
          setFilters={setFilters}
          appliedFilters={appliedFilters}
          setAppliedFilters={setAppliedFilters}
          isLoading={invLoading || dcLoading}
          showExport
          showCsv
          showPdf
          exportFileName={`${title.replace(/[^A-Za-z]/g, "")}-${current.label.replace(/[^A-Za-z]/g, "")}`}
          showTotals
        />
      </div>
    </HomeLayout>
  );
};

export default GstPortalReports;
