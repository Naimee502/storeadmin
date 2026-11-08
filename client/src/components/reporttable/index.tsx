import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  FaFileCsv,
  FaSync,
  FaCheck,
  FaFileExcel,
  FaFilePdf,
  FaSearch,
  FaColumns,
} from "react-icons/fa";
import FormField from "../formfiled";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { getFinancialYear, formatDateDMY, todayYMD, shiftDaysYMD } from "../../utils/helper";
import { useAppSelector } from "../../redux/hooks";
import { selectModuleActions } from "../../redux/slices/permissions";
import { splitPartyLabel } from "../../utils/partylabel";

/* Current financial year label, e.g. "FY 2026-27 (01-04-2026 → 31-03-2027)" */
const fyInfo = () => {
  const fy = getFinancialYear();
  return `${fy.label} (${formatDateDMY(fy.start)} → ${formatDateDMY(fy.end)})`;
};

// Types
export type ReportFilterField = {
  name: string;
  label: string;
  type: "text" | "select" | "multiselect" | "date";
  options?: { label: string; value: any }[];
  searchable?: boolean;
  /** Short placeholder; defaults to "Select <label>". */
  placeholder?: string;
};

export type ReportColumn = {
  label: string;
  key: string;
  render?: (row: any) => React.ReactNode;
  /** Mark true → right-align + include in Totals row */
  numeric?: boolean;
  /** Action-only column; left out of exports. */
  noExport?: boolean;
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
  moduleId?: string;
  onExport?: () => void;
  onCsvExport?: () => void;
  onPdfExport?: () => void;
  entriesOptions?: number[];
  defaultEntriesPerPage?: number;
  showTotals?: boolean;
  exportFileName?: string;
  pdfSubtitle?: string[];
  /** Print net (debit - credit) in the Totals row; showInKey defaults to the last column. */
  netTotal?: {
    debitKey: string;
    creditKey: string;
    /** Extra numeric columns netted with a fixed sign (e.g. discount). */
    minusKeys?: string[];
    plusKeys?: string[];
    showInKey?: string;
  };
}

// Helpers
// Bracketed negatives like "(25000.00)" parse as negative numbers.
const toNumericVal = (v: any): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  const negative = /^\(.*\)$/.test(s);
  const n = Number(negative ? s.slice(1, -1).replace(/,/g, "") : s.replace(/,/g, ""));
  if (isNaN(n)) return null;
  return negative ? -n : n;
};

const isNumericVal = (v: any) => toNumericVal(v) !== null;

// Totals-row net = debits - credits, i.e. the closing balance.
// Discount/commission only fold in via minusKeys / plusKeys (fixed-sign reports).
const netTotalOf = (
  spec: { debitKey: string; creditKey: string; minusKeys?: string[]; plusKeys?: string[] },
  sumKey: (k: string) => number,
) =>
  sumKey(spec.debitKey) -
  sumKey(spec.creditKey) -
  (spec.minusKeys || []).reduce((a, k) => a + sumKey(k), 0) +
  (spec.plusKeys || []).reduce((a, k) => a + sumKey(k), 0);

/** A cell may hold a list (one product per line) — exports join it. */
const cellText = (v: any): any => (Array.isArray(v) ? v.join("; ") : v ?? "");

/** Columns whose text is "Name - Mobile - City" (partyLabel) → 2-line cell. */
const PARTY_COL = /party|vendor|customer|supplier/i;

/** Default cell: arrays one item per line; party as name over "mobile · city". */
const renderCell = (col: ReportColumn, value: any): React.ReactNode => {
  if (Array.isArray(value)) {
    if (value.length === 0) return "-";
    return (
      <div className="flex flex-col gap-0.5 leading-tight">
        {value.map((v, i) => (
          <span key={i} className="whitespace-nowrap">{v}</span>
        ))}
      </div>
    );
  }
  if (typeof value === "string" && (PARTY_COL.test(col.key) || PARTY_COL.test(col.label))) {
    const { name, mobile, city } = splitPartyLabel(value);
    if (mobile) {
      return (
        <div className="leading-tight">
          <div className="font-medium">{name}</div>
          <div className="text-[11px] text-slate-500">{[mobile, city].filter(Boolean).join(" · ")}</div>
        </div>
      );
    }
  }
  return value ?? "";
};

const buildExportRow = (row: any, columns: ReportColumn[]) => {
  const obj: Record<string, any> = {};
  columns.forEach((col) => { obj[col.label] = cellText(row[col.key]); });
  return obj;
};

// PDF via print window (Tally-style)
const printReportAsPDF = (
  title: string,
  columns: ReportColumn[],
  data: any[],
  pdfSubtitle?: string[],
  netTotal?: {
    debitKey: string;
    creditKey: string;
    /** Extra numeric columns netted with a fixed sign (e.g. discount). */
    minusKeys?: string[];
    plusKeys?: string[];
    showInKey?: string;
  },
) => {
  const today = formatDateDMY(new Date());

  const thRow = columns.map((c) => `<th>${c.label}</th>`).join("");
  const bodyRows = data
    .map((row, i) => {
      const cells = columns.map((col) => {
        const val = cellText(row[col.key]);
        const align = col.numeric ? "text-align:right;" : "";
        return `<td style="${align}">${val}</td>`;
      }).join("");
      return `<tr class="${i % 2 === 0 ? "even" : ""}">${cells}</tr>`;
    }).join("");

  // Totals row, with the net in the chosen column when netTotal is set.
  const sumKey = (key: string) =>
    data.reduce((a, r) => a + (toNumericVal(r[key]) ?? 0), 0);
  const netKey = netTotal
    ? netTotal.showInKey || columns[columns.length - 1]?.key
    : undefined;
  const netValue =
    netTotal && data.length > 0
      ? netTotalOf(netTotal, sumKey).toFixed(2)
      : null;

  const hasTotals = columns.some((col) => col.numeric && data.some((r) => isNumericVal(r[col.key])));
  const totalRow = hasTotals
    ? `<tr>${columns.map((col, idx) => {
        if (col.numeric) {
          const s = data.reduce((a, r) => a + (toNumericVal(r[col.key]) ?? 0), 0);
          return `<td style="text-align:right;font-weight:bold;border-top:2px solid #333;">${Number.isInteger(s) ? s : s.toFixed(2)}</td>`;
        }
        if (netValue !== null && col.key === netKey) {
          return `<td style="text-align:right;font-weight:bold;border-top:2px solid #333;">${netValue}</td>`;
        }
        return `<td style="font-weight:bold;border-top:2px solid #333;">${idx === 0 ? "Total" : ""}</td>`;
      }).join("")}</tr>`
    : "";

  // Wide reports print landscape with smaller text.
  const n = columns.length;
  // Always A4 (what offices print on): landscape from 8 columns.
  const pageSize = n > 7 ? "A4 landscape" : "A4 portrait";
  const fs = n > 18 ? 7 : n > 13 ? 8 : n > 9 ? 9 : 10;
  const pad = n > 18 ? "2px 3px" : n > 13 ? "3px 4px" : n > 9 ? "4px 5px" : "5px 8px";

  const win = window.open("", "_blank");
  if (!win) return;
  const subtitleHtml = pdfSubtitle && pdfSubtitle.length > 0
    ? `<div style="text-align:left;font-size:12px;font-weight:bold;margin-bottom:15px;line-height:1.5;">${pdfSubtitle.join("<br/>")}</div>`
    : "";

  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:11px;margin:20px;color:#222;}
  h2{text-align:center;font-size:15px;margin-bottom:4px;}
  .meta{text-align:center;font-size:10px;color:#555;margin-bottom:12px;}
  @page{size:${pageSize};margin:8mm;}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  table{width:100%;border-collapse:collapse;table-layout:auto;}
  thead{display:table-header-group;}
  tr{page-break-inside:avoid;}
  thead tr th{background:#1e3a5f;color:#fff;padding:${pad};text-align:left;font-size:${fs}px;border:1px solid #1e3a5f;white-space:normal;word-break:normal;line-height:1.2;}
  tbody tr td{padding:${pad};border:1px solid #ccc;font-size:${fs}px;line-height:1.25;}
  tbody tr.even td{background:#f7f9fc;}
  @media print{body{margin:0;}}
</style></head><body>
<h2>${title}</h2>
<div class="meta">${fyInfo()} &nbsp;|&nbsp; Generated on: ${today} &nbsp;|&nbsp; Total records: ${data.length}</div>
${subtitleHtml}
<table><thead><tr>${thRow}</tr></thead><tbody>${bodyRows}${totalRow}</tbody></table>
<script>window.onload=()=>{window.print();window.close();}<\/script>
</body></html>`);
  win.document.close();
};

// Component
// Column chooser for wide reports, remembered per report; first LOCKED_COLS always stay.
const COLUMN_CHOOSER_MIN = 9;
const LOCKED_COLS = 2;

const ReportTable: React.FC<ReportTableProps> = ({
  title,
  columns: allColumns,
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
  moduleId,
  pdfSubtitle,
  netTotal,
}) => {
  const actions = useAppSelector(state => moduleId ? selectModuleActions(state, moduleId) : null);
  const finalShowExport = moduleId ? actions?.showExportExcel : showExport;
  const finalShowCsv = moduleId ? actions?.showExportCsv : showCsv;
  const finalShowPdf = moduleId ? actions?.showExportPdf : showPdf;

  /* ── Column chooser (screen, totals, Excel, CSV and PDF all follow it) ── */
  const chooserOn = allColumns.length >= COLUMN_CHOOSER_MIN;
  const storageKey = `reportcols:${moduleId || ""}:${exportFileName}:${title}`;
  const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(storageKey) || "[]");
      return Array.isArray(v) ? v : [];
    } catch { return []; }
  });
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(storageKey) || "[]");
      setHiddenCols(Array.isArray(v) ? v : []);
    } catch { setHiddenCols([]); }
  }, [storageKey]);
  const saveHidden = (next: string[]) => {
    setHiddenCols(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* storage off */ }
  };
  const lockedKeys = useMemo(() => new Set(allColumns.slice(0, LOCKED_COLS).map((c) => c.key)), [allColumns]);
  const columns = useMemo(
    () => chooserOn ? allColumns.filter((c) => lockedKeys.has(c.key) || !hiddenCols.includes(c.key)) : allColumns,
    [allColumns, hiddenCols, chooserOn, lockedKeys]
  );
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!colMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setColMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [colMenuOpen]);
  const toggleCol = (key: string) =>
    saveHidden(hiddenCols.includes(key) ? hiddenCols.filter((k) => k !== key) : [...hiddenCols, key]);

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
    const to = todayYMD();
    const from = shiftDaysYMD(-30);
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
        (acc, row) => acc + (toNumericVal(row[col.key]) ?? 0), 0
      );
      return Number.isInteger(sum) ? String(sum) : sum.toFixed(2);
    });
  }, [filteredData, columns, showTotals]);

  /* ── Net total, shown inside the Totals row ── */
  const netTotalInfo = useMemo(() => {
    if (!netTotal || !showTotals || filteredData.length === 0) return null;
    const key = netTotal.showInKey || columns[columns.length - 1]?.key;
    if (!key) return null;
    const sumKey = (k: string) =>
      filteredData.reduce((acc, row) => acc + (toNumericVal(row[k]) ?? 0), 0);
    return { key, value: netTotalOf(netTotal, sumKey).toFixed(2) };
  }, [filteredData, columns, showTotals, netTotal]);

  /* Built-in exports; action-only columns are dropped. */
  const exportColumns = useMemo(
    () => columns.filter((c) => !c.noExport),
    [columns]
  );

  const handleExcelExport = () => {
    if (onExport) { onExport(); return; }
    const rows = filteredData.map((r) => buildExportRow(r, exportColumns));

    const headerRows = [
      [title],
      [`Financial Year: ${fyInfo()}`],
      [`Generated on: ${formatDateDMY(new Date())}`],
    ];

    if (pdfSubtitle && pdfSubtitle.length > 0) {
      pdfSubtitle.forEach(sub => headerRows.push([sub]));
    }
    headerRows.push([]); // Empty row before data

    const ws = XLSX.utils.aoa_to_sheet(headerRows);
    XLSX.utils.sheet_add_json(ws, rows, { origin: `A${headerRows.length + 1}` });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${exportFileName}.xlsx`);
  };

  const handleCsvExport = () => {
    if (onCsvExport) { onCsvExport(); return; }
    const rows = filteredData.map((r) => buildExportRow(r, exportColumns));

    let header =
      `${title}\r\n` +
      `Financial Year: ${fyInfo()}\r\n` +
      `Generated on: ${formatDateDMY(new Date())}\r\n`;

    if (pdfSubtitle && pdfSubtitle.length > 0) {
      header += pdfSubtitle.join("\r\n") + "\r\n";
    }
    header += "\r\n";

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
    printReportAsPDF(title, exportColumns, filteredData, pdfSubtitle, netTotal);
  };

  /* ── Render ── */
  return (
    <div className="relative">
      {/* Thin loading bar instead of a full-screen overlay. */}

      <div className="space-y-2 text-[13px]">

        {/* Title + Financial Year */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <span className="inline-flex h-7 items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 text-[12px] font-semibold text-indigo-700">
            {fyInfo()}
          </span>
        </div>

        {/* ── Filter panel ── */}
        {filterFields.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            {/* Filter inputs */}
            <div className="flex flex-wrap items-end gap-3">
              {filterFields.map((field) => (
                <div key={field.name} className="w-48">
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
                    placeholder={field.placeholder}
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

            {/* Apply + Reset — on the same line as the filters */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleApply}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-indigo-600 px-3.5 text-[13px] font-semibold text-white shadow-sm hover:bg-indigo-700"
              >
                <FaCheck size={11} />
                <span>Apply</span>
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
              >
                <FaSync size={11} />
                <span>Reset</span>
              </button>
            </div>
            </div>
          </div>
        )}

        {/* ── Toolbar: entries + export buttons + search ── */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

          {/* Left: entries selector + export buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-slate-500">Show</span>
              <select
                value={entriesPerPage}
                onChange={(e) => { setEntriesPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="h-8 rounded-md border border-slate-300 bg-white px-2 text-[13px]"
              >
                {entriesOptions.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="text-slate-500">rows</span>
            </div>

            {/* Export buttons with visible icon + text */}
            <div className="flex flex-wrap items-center gap-2">
              {chooserOn && (
                <div className="relative" ref={colMenuRef}>
                  <button
                    type="button"
                    onClick={() => setColMenuOpen((v) => !v)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <FaColumns className="text-slate-500" size={12} />
                    <span>Columns ({columns.length}/{allColumns.length})</span>
                  </button>
                  {colMenuOpen && (
                    <div className="absolute z-30 mt-2 w-72 bg-white border rounded-lg shadow-lg p-3 left-0">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-gray-700 text-sm">Show columns</span>
                        <div className="flex gap-2 text-xs">
                          <button type="button" className="text-blue-600 hover:underline" onClick={() => saveHidden([])}>Select all</button>
                          <button type="button" className="text-gray-500 hover:underline" onClick={() => saveHidden([])}>Reset</button>
                        </div>
                      </div>
                      <div className="max-h-72 overflow-auto grid grid-cols-1 gap-1">
                        {allColumns.map((c) => {
                          const locked = lockedKeys.has(c.key);
                          const on = locked || !hiddenCols.includes(c.key);
                          return (
                            <label key={c.key} className={`flex items-center gap-2 px-2 py-1 rounded text-sm ${locked ? "text-gray-400" : "hover:bg-gray-50 cursor-pointer text-gray-700"}`}>
                              <input type="checkbox" checked={on} disabled={locked} onChange={() => toggleCol(c.key)} />
                              <span className="truncate">{c.label}</span>
                              {locked && <span className="ml-auto text-[10px]">always</span>}
                            </label>
                          );
                        })}
                      </div>
                      <p className={`mt-2 text-xs ${columns.length > 12 ? "text-amber-600" : "text-gray-400"}`}>
                        {columns.length > 12
                          ? `${columns.length} columns — the PDF will use small text. Pick 12 or fewer for a clear A4 print.`
                          : "Screen, totals, Excel, CSV and PDF show only the ticked columns."}
                      </p>
                    </div>
                  )}
                </div>
              )}
              {finalShowExport && (
                <button
                  type="button"
                  onClick={handleExcelExport}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50" title="Export to Excel"
                >
                  <FaFileExcel className="text-emerald-600" size={12} />
                  <span>Excel</span>
                </button>
              )}
              {finalShowCsv && (
                <button
                  type="button"
                  onClick={handleCsvExport}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50" title="Export to CSV"
                >
                  <FaFileCsv className="text-teal-600" size={12} />
                  <span>CSV</span>
                </button>
              )}
              {finalShowPdf && (
                <button
                  type="button"
                  onClick={handlePdfExport}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50" title="Export to PDF"
                >
                  <FaFilePdf className="text-rose-600" size={12} />
                  <span>PDF</span>
                </button>
              )}
            </div>
          </div>

          {/* Right: global search */}
          <div className="flex items-center gap-2">

            <div className="relative">
              <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-400" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => { setGlobalSearch(e.target.value); setCurrentPage(1); }}
                placeholder="Search all columns..."
                className="h-8 w-56 rounded-md border border-slate-300 bg-white pl-7 pr-3 text-[13px] outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="relative max-h-[calc(100vh-230px)] overflow-auto rounded-lg border border-slate-200 bg-white">
          {isLoading && (
            <div className="sticky top-0 left-0 z-20 h-0.5 w-full overflow-hidden bg-indigo-100">
              <div className="h-full w-1/3 animate-[reportbar_1s_ease-in-out_infinite] bg-indigo-500" />
            </div>
          )}
          <table className="min-w-full text-left text-[12.5px]">
            <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500">
              {/* Column headers with filter icon */}
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`whitespace-nowrap px-2 pt-2 pb-1 text-[10.5px] font-semibold uppercase ${col.numeric ? "text-right" : ""}`}
                  >
                    <div className={`flex items-center gap-1 ${col.numeric ? "justify-end" : ""}`}>
                      {col.label}

                    </div>
                  </th>
                ))}
              </tr>
              {/* Per-column inline filter row */}
              <tr className="border-b border-slate-200 bg-slate-50">
                {columns.map((col) => (
                  <th key={col.key} className="px-2 pb-1.5">
                    <input
                      type="text"
                      value={colFilters[col.key] || ""}
                      onChange={(e) => handleColFilter(col.key, e.target.value)}
                      placeholder={`Filter`}
                      className="h-7 w-full min-w-[48px] rounded border border-slate-200 bg-white px-2 text-[12px] font-normal outline-none focus:border-indigo-400"
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
                      className={`border-b border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50"} hover:bg-indigo-50`}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`whitespace-nowrap px-2 py-1.5 align-top text-slate-800 ${col.numeric ? "text-right tabular-nums" : ""}`}
                        >
                          {col.render ? col.render(row) : renderCell(col, row[col.key])}
                        </td>
                      ))}
                    </tr>
                  ))}

                  {/* Tally-style totals row */}
                  {totalsRow && (
                    <tr className="sticky bottom-0 border-t border-slate-300 bg-indigo-50 font-semibold text-slate-800">
                      {columns.map((col, idx) => {
                        const isNetCell =
                          netTotalInfo != null && col.key === netTotalInfo.key;
                        return (
                          <td
                            key={col.key}
                            className={`whitespace-nowrap px-2 py-1.5 ${
                              col.numeric || isNetCell ? "text-right tabular-nums" : ""
                            }`}
                          >
                            {totalsRow[idx] !== null
                              ? totalsRow[idx]
                              : isNetCell
                                ? netTotalInfo!.value
                                : idx === 0 ? "Total" : ""}
                          </td>
                        );
                      })}
                    </tr>
                  )}
                </>
              ) : (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="py-8 text-center text-[13px] text-slate-400"
                  >
                    {isLoading ? "Loading…" : <>No records found. Adjust filters and click <strong>Apply</strong>.</>}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination footer ── */}
        <div className="flex flex-col gap-2 text-[12px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
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
              className="h-7 rounded border border-slate-300 bg-white px-2 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ‹ Prev
            </button>
            <span className="inline-flex h-7 items-center rounded bg-indigo-600 px-2.5 font-semibold text-white">
              {safePage} / {totalPages}
            </span>
            <button
              onClick={() => changePage("next")}
              disabled={safePage >= totalPages}
              className="h-7 rounded border border-slate-300 bg-white px-2 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
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
