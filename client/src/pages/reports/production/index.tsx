import React, { useEffect, useState } from "react";
import HomeLayout from "../../../layouts/home";
import ReportTable, { type ReportColumn, type ReportFilterField } from "../../../components/reporttable";
import { QC_STATUS, WORK_STATUS, mfgNo, useDeletedProductionEntriesQuery, useProductionEntriesQuery, useWorkOrdersQuery } from "../../../graphql/hooks/manufacturing";
import { formatDateDMY, normalizeToYMD, shiftDaysYMD, todayYMD } from "../../../utils/helper";
import { itemName } from "../../bom";
import { producedText } from "../../production";
import { FaBoxOpen, FaClipboardList, FaCogs, FaIndustry, FaTrashAlt } from "react-icons/fa";

const tabs = [
  { id: "register", label: "Production Register", icon: <FaClipboardList className="text-xs text-sky-600" /> },
  { id: "output", label: "Item-wise Output", icon: <FaIndustry className="text-xs text-emerald-600" /> },
  { id: "consumption", label: "Material Consumption", icon: <FaBoxOpen className="text-xs text-indigo-600" /> },
  { id: "workorders", label: "Work Order Status", icon: <FaCogs className="text-xs text-amber-600" /> },
  { id: "deleted", label: "Deleted", icon: <FaTrashAlt className="text-xs text-rose-600" /> },
];
const dateTo = (ymd?: string) => (ymd ? `${ymd}￿` : undefined);

/** Sum of qty / amount per item and unit. */
const groupLines = (entries: any[], key: "outputs" | "components" | "byproducts") => {
  const m = new Map<string, any>();
  for (const p of entries) {
    for (const l of p[key] || []) {
      const unit = l.salesunitid?.unitname || "";
      const k = `${l.productserviceid?.id}|${l.variantid?.id || ""}|${unit}`;
      const row = m.get(k) || { item: itemName(l), unit, qty: 0, amount: 0, entries: 0 };
      row.qty += Number(l.qty) || 0;
      row.amount += Number(l.amount) || 0;
      row.entries += 1;
      m.set(k, row);
    }
  }
  return [...m.values()].map((r) => ({ ...r, qty: Math.round(r.qty * 1000) / 1000, avg: r.qty ? Math.round((r.amount / r.qty) * 100) / 100 : 0 }));
};

const ProductionReports: React.FC = () => {
  const [activeTab, setActiveTab] = useState(tabs[0].id);
  const [filters, setFilters] = useState<{ [key: string]: any }>({});
  const [appliedFilters, setAppliedFilters] = useState<{ [key: string]: any }>({});
  useEffect(() => {
    const range = { fromDate: shiftDaysYMD(-30), toDate: todayYMD() };
    setFilters(range);
    setAppliedFilters(range);
  }, []);

  const fromDate: string | undefined = appliedFilters.fromDate || undefined;
  const toDate: string | undefined = appliedFilters.toDate || undefined;
  const dates = { billdateFrom: fromDate, billdateTo: dateTo(toDate) };
  // Same list queries as the screens, so the report works offline from the device's data.
  const { data, loading } = useProductionEntriesQuery(dates);
  const { data: woData, loading: woLoading } = useWorkOrdersQuery(dates);
  const { data: delData, loading: delLoading } = useDeletedProductionEntriesQuery();

  const inRange = (ymd: string) => (!fromDate || ymd >= fromDate) && (!toDate || ymd <= toDate);
  const qcOk = (p: any) => !appliedFilters.qcstatus || p.qcstatus === appliedFilters.qcstatus;
  const entries: any[] = (data?.getProductionEntries || []).filter((p: any) => inRange(normalizeToYMD(p.billdate) || "") && qcOk(p));

  const reg = (p: any) => ({
    no: mfgNo(p, "PE-"),
    date: formatDateDMY(p.billdate),
    wo: p.workordernumber ? mfgNo({ billnumber: p.workordernumber }, "WO-") : "-",
    produced: producedText(p) || "-",
    material: Math.round(Number(p.materialcost || 0) * 100) / 100,
    labour: Number(p.labourcost || 0),
    overhead: Number(p.overhead || 0),
    total: Math.round(Number(p.totalcost || 0) * 100) / 100,
    qc: QC_STATUS[p.qcstatus] || "-",
    batch: p.batchnumber || "-",
  });

  const dateFields: ReportFilterField[] = [
    { name: "fromDate", label: "From Date", type: "date" },
    { name: "toDate", label: "To Date", type: "date" },
  ];
  const qcField: ReportFilterField = { name: "qcstatus", label: "QC", type: "select", options: Object.entries(QC_STATUS).map(([value, label]) => ({ value, label })) };
  const lineCols: ReportColumn[] = [
    { label: "Item", key: "item" },
    { label: "Unit", key: "unit" },
    { label: "Qty", key: "qty", numeric: true },
    { label: "Value (₹)", key: "amount", numeric: true },
    { label: "Avg Rate (₹)", key: "avg", numeric: true },
    { label: "Entries", key: "entries", numeric: true },
  ];

  let tableData: any[] = [];
  let columns: ReportColumn[] = [];
  let filterFields: ReportFilterField[] = [...dateFields, qcField];
  let isLoading = loading;

  switch (activeTab) {
    case "register":
      tableData = entries.map(reg);
      columns = [
        { label: "Entry No", key: "no" },
        { label: "Date", key: "date" },
        { label: "Work Order", key: "wo" },
        { label: "Produced", key: "produced" },
        { label: "Material (₹)", key: "material", numeric: true },
        { label: "Labour (₹)", key: "labour", numeric: true },
        { label: "Overhead (₹)", key: "overhead", numeric: true },
        { label: "Total Cost (₹)", key: "total", numeric: true },
        { label: "QC", key: "qc" },
        { label: "Batch", key: "batch" },
      ];
      break;
    case "output":
      tableData = [...groupLines(entries, "outputs"), ...groupLines(entries, "byproducts").map((r) => ({ ...r, item: `${r.item} (by-product)` }))];
      columns = lineCols;
      break;
    case "consumption":
      tableData = groupLines(entries, "components");
      columns = lineCols;
      break;
    case "workorders": {
      const today = todayYMD();
      isLoading = woLoading;
      tableData = (woData?.getWorkOrders || []).filter((w: any) => !appliedFilters.workStatus || (w.workStatus || "planned") === appliedFilters.workStatus).map((w: any) => {
        const pending = Math.max(Number(w.qty) - Number(w.qtyproduced || 0), 0);
        return {
          no: mfgNo(w, "WO-"),
          date: formatDateDMY(w.billdate),
          due: w.duedate ? formatDateDMY(w.duedate) : "-",
          item: itemName(w),
          unit: w.salesunitid?.unitname || "",
          qty: Number(w.qty) || 0,
          produced: Number(w.qtyproduced) || 0,
          pending,
          progress: `${Math.min(100, Math.round((Number(w.qtyproduced || 0) / (Number(w.qty) || 1)) * 100))}%`,
          status: (w.duedate && w.duedate < today && pending > 0 && w.workStatus !== "cancelled" ? "Late - " : "") + (WORK_STATUS[w.workStatus] || "Planned"),
        };
      });
      columns = [
        { label: "WO No", key: "no" },
        { label: "Date", key: "date" },
        { label: "Due", key: "due" },
        { label: "Item", key: "item" },
        { label: "Unit", key: "unit" },
        { label: "Qty", key: "qty", numeric: true },
        { label: "Produced", key: "produced", numeric: true },
        { label: "Pending", key: "pending", numeric: true },
        { label: "Progress", key: "progress" },
        { label: "Status", key: "status" },
      ];
      filterFields = [...dateFields, { name: "workStatus", label: "Status", type: "select", options: Object.entries(WORK_STATUS).map(([value, label]) => ({ value, label })) }];
      break;
    }
    case "deleted":
      isLoading = delLoading;
      tableData = (delData?.getDeletedProductionEntries || []).filter((p: any) => inRange(normalizeToYMD(p.billdate) || "")).map(reg);
      columns = [
        { label: "Entry No", key: "no" },
        { label: "Date", key: "date" },
        { label: "Produced", key: "produced" },
        { label: "Total Cost (₹)", key: "total", numeric: true },
      ];
      filterFields = dateFields;
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
          moduleId="reports.production"
          title={`Production — ${current.label}`}
          columns={columns}
          data={tableData}
          filterFields={filterFields}
          filters={filters}
          setFilters={setFilters}
          appliedFilters={appliedFilters}
          setAppliedFilters={setAppliedFilters}
          isLoading={isLoading}
          showExport
          showCsv
          showPdf
          exportFileName={`Production-${current.label.replace(/\s+/g, "")}`}
          showTotals
        />
      </div>
    </HomeLayout>
  );
};

export default ProductionReports;
