import React, { useState, useMemo } from "react";
import {
  FaFileCsv,
  FaSync,
  FaCheck,
  FaFileExcel,
  FaFilePdf,
  FaFilter,
  FaSearch,
} from "react-icons/fa";
import Loader from "../loader";
import FormField from "../formfiled";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { getFinancialYear, formatDateDMY } from "../../utils/helper";

/* Current financial year label, e.g. "FY 2026-27 (01-04-2026 → 31-03-2027)" */
const fyInfo = () => {
  const fy = getFinancialYear();
  return `${fy.label} (${formatDateDMY(fy.start)} → ${formatDateDMY(fy.end)})`;
};

/* ──────────────────────────────────────────────────────────────────
   Types
────────────────────────────────────────────────────────────────── */
export type ReportFilterField = {
  name: string;
  label: string;
  type: "text" | "select" | "multiselect" | "date";
  options?: { label: string; value: any }[];
  searchable?: boolean;
};

export type ReportColumn = {
  label: string;
  key: string;
  render?: (row: any) => React.ReactNode;
  /** Mark true → right-align + include in Totals row */
  numeric?: boolean;
};

interface ReportTableProps {
  title: string;
  columns: ReportColumn[];
  data: any[];
  filterFields?: ReportFilterField[];
  filters: { [key: string]: any };
  setFilters: React.Dispatch<React.SetStateAction<{ [key: string]: any }>>;
  appliedFilters: { [key: string]: any };
  setAppliedFilters: React.Dispatch<React.SetStateAction<{ [key: string]: any }>>;
  isLoading?: boolean;
  showExport?: boolean;
  showCsv?: boolean;
  showPdf?: boolean;
  onExport?: () => void;
  onCsvExport?: () => void;
  onPdfExport?: () => void;
  entriesOptions?: number[];
  defaultEntriesPerPage?: number;
  showTotals?: boolean;
  exportFileName?: string;
}

/* ──────────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────────── */
const isNumericVal = (v: any) =>
  v !== null && v !== undefined && v !== "" && !isNaN(Number(v));

const buildExportRow = (row: any, columns: ReportColumn[]) => {
  const obj: Record<string, any> = {};
  columns.forEach((col) => { obj[col.label] = row[col.key] ?? ""; });
  return obj;
};

/* ──────────────────────────────────────────────────────────────────
   PDF via print window  (Tally-style)
────────────────────────────────────────────────────────────────── */
const printReportAsPDF = (title: string, columns: ReportColumn[], data: any[]) => {
  const today = formatDateDMY(new Date());

  const thRow = columns.map((c) => `<th>${c.label}</th>`).join("");
  const bodyRows = data
    .map((row, i) => {
      const cells = columns.map((col) => {
        const val = row[col.key] ?? "";
        const align = col.numeric ? "text-align:right;" : "";
        return `<td style="${align}">${val}</td>`;
      }).join("");
      return `<tr class="${i % 2 === 0 ? "even" : ""}">${cells}</tr>`;
    }).join("");

  // Totals row
  const hasTotals = columns.some((col) => col.numeric && data.some((r) => isNumericVal(r[col.key])));
  const totalRow = hasTotals
    ? `<tr>${columns.map((col, idx) => {
        if (col.numeric) {
          const s = data.reduce((a, r) => a + (isNumericVal(r[col.key]) ? Number(r[col.key]) : 0), 0);
          return `<td style="text-align:right;font-weight:bold;border-top:2px solid #333;">${Number.isInteger(s) ? s : s.toFixed(2)}</td>`;
        }
        return `<td style="font-weight:bold;border-top:2px solid #333;">${idx === 0 ? "Total" : ""}</td>`;
      }).join("")}</tr>`
    : "";

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:11px;margin:20px;color:#222;}
  h2{text-align:center;font-size:15px;margin-bottom:4px;}
  .meta{text-align:center;font-size:10px;color:#555;margin-bottom:12px;}
  table{width:100%;border-collapse:collapse;}
  thead tr th{background:#1e3a5f;color:#fff;padding:6px 8px;text-align:left;font-size:10px;border:1px solid #1e3a5f;}
  tbody tr td{padding:5px 8px;border:1px solid #ccc;font-size:10px;}
  tbody tr.even td{background:#f7f9fc;}
  @media print{body{margin:10px;}}
</style></head><body>
<h2>${title}</h2>
<div class="meta">${fyInfo()} &nbsp;|&nbsp; Generated on: ${today} &nbsp;|&nbsp; Total records: ${data.length}</div>
<table><thead><tr>${thRow}</tr></thead><tbody>${bodyRows}${totalRow}</tbody></table>
<script>window.onload=()=>{window.print();window.close();}<\/script>
</body></html>`);
  win.document.close();
};

/* ──────────────────────────────────────────────────────────────────
   Component
────────────────────────────────────────────────────────────────── */
const ReportTable: React.FC<ReportTableProps> = ({
  title,
  columns,
  data,
  filterFields = [],
  filters,
  setFilters,
  appliedFilters,
  setAppliedFilters,
  isLoading = false,
  showExport = false,
  showCsv = false,
  showPdf = false,
  onExport,
  onCsvExport,
  onPdfExport,
  entriesOptions = [10, 25, 50, 100],
  defaultEntriesPerPage = 10,
  showTotals = true,
  exportFileName = "Report",
}) => {
  const [globalSearch, setGlobalSearch] = useState("");
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const [entriesPerPage, setEntriesPerPage] = useState(defaultEntriesPerPage);
  const [currentPage, setCurrentPage] = useState(1);

  /* ── Filter panel ── */
  const handleApply = () => {
    setAppliedFilters({ ...filters });
    setCurrentPage(1);
  };

  const handleReset = () => {
    const today = new Date();
    const to = today.toISOString().slice(0, 10);
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30)
      .toISOString().slice(0, 10);
    const resetValues: Record<string, any> = {};
    filterFields.forEach((field) => {
      if (field.type === "date") {
        resetValues[field.name] =
          (field.name === "fromDate" || field.name === "from") ? from :
          (field.name === "toDate"   || field.name === "to")   ? to   : "";
      } else {
        resetValues[field.name] = field.type === "multiselect" ? [] : "";
      }
    });
    setFilters(resetValues);
    setAppliedFilters(resetValues);
    setGlobalSearch("");
    setColFilters({});
    setCurrentPage(1);
  };

  /* ── Column filter ── */
  const handleColFilter = (key: string, value: string) => {
    setColFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  /* ── Client-side search + col filter on top of parent-filtered data ── */
  const filteredData = useMemo(() => {
    return data
      .filter((row) =>
        Object.entries(colFilters).every(([key, val]) => {
          if (!val) return true;
          return String(row[key] ?? "").toLowerCase().includes(val.toLowerCase());
        })
      )
      .filter((row) => {
        if (!globalSearch.trim()) return true;
        return Object.values(row).some((v) =>
          String(v ?? "").toLowerCase().includes(globalSearch.toLowerCase())
        );
      });
  }, [data, colFilters, globalSearch]);

  /* ── Pagination ── */
  const totalPages = Math.max(1, Math.ceil(filteredData.length / entriesPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedData = filteredData.slice(
    (safePage - 1) * entriesPerPage,
    safePage * entriesPerPage
  );

  const changePage = (dir: "prev" | "next") =>
    setCurrentPage((p) => dir === "prev" ? Math.max(1, p - 1) : Math.min(totalPages, p + 1));

  /* ── Totals row ── */
  const totalsRow = useMemo(() => {
    const hasNumeric = columns.some((c) => c.numeric);
    if (!showTotals || !hasNumeric || filteredData.length === 0) return null;
    return columns.map((col) => {
      if (!col.numeric) return null;
      const sum = filteredData.reduce(
        (acc, row) => acc + (isNumericVal(row[col.key]) ? Number(row[col.key]) : 0), 0
      );
      return Number.isInteger(sum) ? String(sum) : sum.toFixed(2);
    });
  }, [filteredData, columns, showTotals]);

  /* ── Built-in exports ── */
  const handleExcelExport = () => {
    if (onExport) { onExport(); return; }
    const rows = filteredData.map((r) => buildExportRow(r, columns));
    const ws = XLSX.utils.aoa_to_sheet([
      [title],
      [`Financial Year: ${fyInfo()}`],
      [`Generated on: ${formatDateDMY(new Date())}`],
      [],
    ]);
    XLSX.utils.sheet_add_json(ws, rows, { origin: "A5" });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${exportFileName}.xlsx`);
  };

  const handleCsvExport = () => {
    if (onCsvExport) { onCsvExport(); return; }
    const rows = filteredData.map((r) => buildExportRow(r, columns));
    const header =
      `${title}\r\n` +
      `Financial Year: ${fyInfo()}\r\n` +
      `Generated on: ${formatDateDMY(new Date())}\r\n\r\n`;
    const csv = header + Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", `${exportFileName}.csv`);
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePdfExport = () => {
    if (onPdfExport) { onPdfExport(); return; }
    printReportAsPDF(title, columns, filteredData);
  };

  /* ── Render ── */
  return (
    <div className="relative">
      {isLoading && <Loader fullScreen />}

      <div className="space-y-4 text-xs sm:text-sm">

        {/* Title + Financial Year */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg sm:text-2xl font-semibold">{title}</h2>
          <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs sm:text-sm font-bold border border-indigo-200">
            {fyInfo()}
          </span>
        </div>

        {/* ── Filter panel ── */}
        {filterFields.length > 0 && (
          <div className="bg-gray-50 border rounded-lg p-4 shadow-sm">
            {/* Filter inputs */}
            <div className="flex flex-wrap gap-3 mb-3">
              {filterFields.map((field) => (
                <div key={field.name} className="w-52">
                  <FormField
                    label={field.label}
                    name={field.name}
                    type={field.type as any}
                    value={
                      field.type === "multiselect"
                        ? filters[field.name] || []
                        : filters[field.name] || ""
                    }
                    options={field.options}
                    searchable={field.searchable}
                    onChange={(e: any) =>
                      setFilters((prev) => ({
                        ...prev,
                        [field.name]:
                          field.type === "multiselect"
                            ? e.target.value || []
                            : e.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>

            {/* Apply + Reset buttons — same row */}
            <div className="flex flex-wrap items-center gap-2.5 mt-3 pt-3 border-t border-gray-200">
              <button
                type="button"
                onClick={handleApply}
                className="flex items-center justify-center gap-2 px-5 py-2.5 !bg-slate-900 !text-white rounded-md hover:!bg-black text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer border border-slate-900"
              >
                <FaCheck className="!text-white flex-shrink-0" size={14} />
                <span className="!text-white font-bold">Apply Filter</span>
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center justify-center gap-2 px-5 py-2.5 !bg-gray-600 !text-white rounded-md hover:!bg-gray-700 text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer border border-gray-600"
              >
                <FaSync className="!text-white flex-shrink-0" size={14} />
                <span className="!text-white font-bold">Reset Filter</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Toolbar: entries + export buttons + search ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

          {/* Left: entries selector + export buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="text-gray-600">Show</span>
              <select
                value={entriesPerPage}
                onChange={(e) => { setEntriesPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="border rounded px-2 py-1 text-sm bg-white"
              >
                {entriesOptions.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="text-gray-600">entries</span>
            </div>

            {/* Export buttons with visible icon + text */}
            <div className="flex flex-wrap items-center gap-2">
              {showExport && (
                <button
                  type="button"
                  onClick={handleExcelExport}
                  className="flex items-center justify-center gap-2 px-4 py-2 !bg-emerald-600 !text-white rounded-md hover:!bg-emerald-700 text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer border border-emerald-600"
                >
                  <FaFileExcel className="!text-white flex-shrink-0" size={15} />
                  <span className="!text-white font-bold">Export Excel</span>
                </button>
              )}
              {showCsv && (
                <button
                  type="button"
                  onClick={handleCsvExport}
                  className="flex items-center justify-center gap-2 px-4 py-2 !bg-teal-600 !text-white rounded-md hover:!bg-teal-700 text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer border border-teal-600"
                >
                  <FaFileCsv className="!text-white flex-shrink-0" size={15} />
                  <span className="!text-white font-bold">Export CSV</span>
                </button>
              )}
              {showPdf && (
                <button
                  type="button"
                  onClick={handlePdfExport}
                  className="flex items-center justify-center gap-2 px-4 py-2 !bg-rose-600 !text-white rounded-md hover:!bg-rose-700 text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer border border-rose-600"
                >
                  <FaFilePdf className="!text-white flex-shrink-0" size={15} />
                  <span className="!text-white font-bold">Export PDF</span>
                </button>
              )}
            </div>
          </div>

          {/* Right: global search */}
          <div className="flex items-center gap-2">
            <span className="text-gray-600 text-sm">Search:</span>
            <div className="relative">
              <FaSearch className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => { setGlobalSearch(e.target.value); setCurrentPage(1); }}
                placeholder="Search all columns..."
                className="pl-6 pr-3 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 w-52"
              />
            </div>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="overflow-auto border rounded shadow-sm">
          <table className="min-w-full text-xs sm:text-sm text-left">
            <thead className="bg-gray-100 text-gray-700">
              {/* Column headers with filter icon */}
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-3 py-2 whitespace-nowrap font-semibold border-b ${col.numeric ? "text-right" : ""}`}
                  >
                    <div className={`flex items-center gap-1 ${col.numeric ? "justify-end" : ""}`}>
                      {col.label}
                      <FaFilter className="text-gray-400 text-xs flex-shrink-0" />
                    </div>
                  </th>
                ))}
              </tr>
              {/* Per-column inline filter row */}
              <tr className="bg-gray-50">
                {columns.map((col) => (
                  <th key={col.key} className="px-2 py-1 border-b">
                    <input
                      type="text"
                      value={colFilters[col.key] || ""}
                      onChange={(e) => handleColFilter(col.key, e.target.value)}
                      placeholder={`Filter`}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-blue-400"
                    />
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {paginatedData.length > 0 ? (
                <>
                  {paginatedData.map((row, i) => (
                    <tr
                      key={i}
                      className={`border-b ${i % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-blue-50 transition-colors`}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-3 py-2 whitespace-nowrap ${col.numeric ? "text-right font-mono" : ""}`}
                        >
                          {col.render ? col.render(row) : (row[col.key] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}

                  {/* Tally-style totals row */}
                  {totalsRow && (
                    <tr className="border-t-2 border-gray-500 bg-blue-50 font-bold text-gray-800">
                      {columns.map((col, idx) => (
                        <td
                          key={col.key}
                          className={`px-3 py-2 whitespace-nowrap ${col.numeric ? "text-right font-mono" : ""}`}
                        >
                          {totalsRow[idx] !== null
                            ? totalsRow[idx]
                            : idx === 0 ? "Total" : ""}
                        </td>
                      ))}
                    </tr>
                  )}
                </>
              ) : (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="text-center text-gray-400 py-12 text-sm"
                  >
                    No records found. Adjust filters and click <strong>Apply</strong>.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination footer ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-gray-600">
          <span>
            Showing{" "}
            <strong>
              {filteredData.length === 0 ? 0 : (safePage - 1) * entriesPerPage + 1}–
              {Math.min(safePage * entriesPerPage, filteredData.length)}
            </strong>{" "}
            of <strong>{filteredData.length}</strong> entries
            {filteredData.length !== data.length &&
              ` (filtered from ${data.length} total)`}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => changePage("prev")}
              disabled={safePage <= 1}
              className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ‹ Prev
            </button>
            <span className="px-3 py-1 bg-blue-600 text-white rounded font-medium">
              {safePage} / {totalPages}
            </span>
            <button
              onClick={() => changePage("next")}
              disabled={safePage >= totalPages}
              className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next ›
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ReportTable;
