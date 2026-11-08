import {
    FaSearch,
    FaPlus,
    FaFileImport,
    FaFileExport,
    FaEye,
    FaTrash,
    FaEdit,
    FaFilter,
    FaTrashRestore,
    FaUndo,
    FaEraser,
    FaPrint,
    FaBarcode,
    FaFileInvoice,
    FaReply,
    FaBan,
    FaWhatsapp,
    FaCheckCircle,
    FaTruck,
    FaBoxOpen,
} from "react-icons/fa";
import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { FormDensityContext } from "../formpage/density";
import { isOverlayOpen } from "../formpage/overlay";
import FormField from "../formfiled";
import FormSwitch from "../formswitch";
import Button from "../button";
import { splitPartyLabel } from "../../utils/partylabel";

/** Listing state (search, filters, page) kept per tab and per table in sessionStorage. */
const tableStateKey = (title: string) =>
  `datatable:${typeof window !== "undefined" ? window.location.pathname : ""}:${title}`;

export interface ServerPaging {
    page: number;
    pageSize: number;
    total: number;
    search: string;
    /** Column filter values, keyed by column key. */
    filters?: { [key: string]: string };
    /** Columns the server can filter; others get no filter box. */
    filterKeys?: string[];
    onChange: (next: { page?: number; pageSize?: number; search?: string; filters?: { [key: string]: string } }) => void;
}

/** Thin top bar shown while a list refreshes; the rows stay visible. */
const TableProgress = () => (
    <div className="pointer-events-none sticky top-0 left-0 z-20 h-0.5 w-full overflow-hidden bg-indigo-100">
        <div className="h-full w-1/3 animate-[reportbar_1s_ease-in-out_infinite] bg-indigo-500" />
    </div>
);

function useStickyTableState<T>(title: string, field: string, initial: T) {
  const key = `${tableStateKey(title)}:${field}`;

  const [value, setValue] = useState<T>(() => {
    // Storage may be unavailable or stale; never crash on it.
    try {
      const raw = sessionStorage.getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* nothing to do — the table still works, it just won't remember */
    }
  }, [key, value]);

  return [value, setValue] as const;
}

/** Only one table per page handles the keyboard: the last one focused, else the first. */
const mountedTables: string[] = [];
let activeTable: string | null = null;

// Columns whose value is a partyLabel() string ("Name - Mobile - City").
const PARTY_COLUMN_KEYS = new Set(["partyacc", "partyDisplay"]);

interface Column {
    label: string;
    key: string;
}

interface FormField {
    name: string;
    label: string;
    type: string;
    placeholder?: string;
    options?: { label: string; value: string }[];
    searchable?: boolean;
    // For type: "file" — restricts the file picker (e.g. "image/*").
    accept?: string;
}

interface DataTableProps {
    title: string;
    columns: Column[];
    data: any[];
    showView?: boolean;
    /** Per-row when a screen needs to withhold it (e.g. a cancelled bill). */
    showEdit?: boolean | ((row: any) => boolean);
    showDelete?: boolean;
    showAdd?: boolean;
    showReset?: boolean | ((row: any) => boolean);
    showPrint?: boolean;
    // Optional per-row WhatsApp share.
    showWhatsApp?: boolean | ((row: any) => boolean);
    showBarcode?: boolean | ((row: any) => boolean);
    showConvert?: boolean;
    // Optional per-row "create Return" action; may be a per-row function.
    showReturn?: boolean | ((row: any) => boolean);
    // Per-row action: cancel an order (Sales Order / Purchase Order).
    showCancel?: boolean | ((row: any) => boolean);
    /** Tooltip on the cancel button — "Cancel Order" unless a screen says otherwise. */
    cancelTitle?: string;
    /** Undo a cancellation. Its own button, so the two acts never share a tooltip. */
    showReopen?: boolean | ((row: any) => boolean);
    // Per-row fulfilment transitions (Sales Order lifecycle).
    showConfirm?: boolean | ((row: any) => boolean);
    /** Tooltip for the confirm action — it is not always an order being confirmed. */
    confirmTitle?: string;
    showDispatch?: boolean | ((row: any) => boolean);
    showDeliver?: boolean | ((row: any) => boolean);
    showDeleted?: boolean;
    showImport?: boolean;
    showExport?: boolean;
    entriesOptions?: number[];
    defaultEntriesPerPage?: number;
    onView?: (row: any) => void;
    onEdit?: (row: any) => void;
    onDelete?: (row: any) => void;
    onAdd?: () => void;
    onReset?: (row: any) => void;
    /** Deleted pages: hide an entry for good (it stays in the database). */
    showClear?: boolean | ((row: any) => boolean);
    onClear?: (row: any) => void;
    /** Clears every row currently shown by the filters. */
    onClearAll?: (rows: any[]) => void;
    onPrint?: (row: any) => void;
    onWhatsApp?: (row: any) => void;
    onBarcode?: (row: any) => void;
    onConvert?: (row: any) => void;
    onReturn?: (row: any) => void;
    onCancel?: (row: any) => void;
    onReopen?: (row: any) => void;
    onConfirm?: (row: any) => void;
    onDispatch?: (row: any) => void;
    onDeliver?: (row: any) => void;
    onShowDeleted?: () => void;
    onImport?: () => void;
    onExport?: () => void;
    isLoading?: boolean;
    /** Server-driven paging: the parent fetches one page and owns page/size/search. */
    serverPaging?: ServerPaging;
    formFields?: FormField[];
    formValues?: { [key: string]: any };
    formErrors?: { [key: string]: string };
    onFormChange?: (name: string, value: any) => void;
    onFormSubmit?: () => void;
    onActiveToggle?: (checked: boolean) => void;
    showActionsColumn?: boolean;
    requireBranchForAdd?: boolean;
    // Extra page-specific buttons, shown first in the toolbar button row.
    toolbarActions?: React.ReactNode;
    /** Opt-in desktop layout: dense rows, sticky header/actions and keyboard control. */
    compact?: boolean;
}

const DataTable: React.FC<DataTableProps> = ({
    title,
    columns,
    data,
    showView = false,
    showEdit = true,
    showDelete = true,
    showAdd = true,
    showReset = false,
    showPrint = false,
    showWhatsApp = false,
    showBarcode = false,
    showConvert = false,
    showReturn = false,
    showCancel = false,
    cancelTitle = "Cancel Order",
    showReopen = false,
    showConfirm = false,
    confirmTitle = "Confirm Order",
    showDispatch = false,
    showDeliver = false,
    showDeleted = true,
    showImport = true,
    showExport = true,
    entriesOptions = [5, 10, 25, 50],
    defaultEntriesPerPage = 10,
    onView,
    onEdit,
    onDelete,
    onAdd,
    onReset,
    showClear = false,
    onClear,
    onClearAll,
    onPrint,
    onWhatsApp,
    onBarcode,
    onConvert,
    onReturn,
    onCancel,
    onReopen,
    onConfirm,
    onDispatch,
    onDeliver,
    onShowDeleted,
    onImport,
    onExport,
    isLoading = false,
    serverPaging,
    formFields,
    formValues,
    formErrors,
    onFormChange,
    onFormSubmit,
    onActiveToggle,
    showActionsColumn = true,
    requireBranchForAdd,
    toolbarActions,
    compact = true,
}) => {
    const tableId = useId();
    useEffect(() => {
        if (!compact) return;
        mountedTables.push(tableId);
        if (!activeTable || !mountedTables.includes(activeTable)) activeTable = tableId;
        return () => {
            const i = mountedTables.indexOf(tableId);
            if (i >= 0) mountedTables.splice(i, 1);
            if (activeTable === tableId) activeTable = mountedTables[0] ?? null;
        };
    }, [compact, tableId]);
    const claimKeyboard = () => {
        activeTable = tableId;
    };
    const [localEntries, setLocalEntries] = useStickyTableState(title, "entriesPerPage", defaultEntriesPerPage);
    const [localPage, setLocalPage] = useStickyTableState(title, "currentPage", 1);
    const [localSearch, setLocalSearch] = useStickyTableState(title, "globalSearch", "");
    const [filters, setFilters] = useStickyTableState<{ [key: string]: string }>(title, "filters", {});

    const entriesPerPage = serverPaging ? serverPaging.pageSize : localEntries;
    const currentPage = serverPaging ? serverPaging.page : localPage;
    const globalSearch = serverPaging ? serverPaging.search : localSearch;
    const setEntriesPerPage = (size: number) => (serverPaging ? serverPaging.onChange({ pageSize: size }) : setLocalEntries(size));
    const setGlobalSearch = (value: string) => (serverPaging ? serverPaging.onChange({ search: value }) : setLocalSearch(value));
    const setCurrentPage = (page: number | ((prev: number) => number)) => {
        if (!serverPaging) return setLocalPage(page);
        serverPaging.onChange({ page: typeof page === "function" ? page(currentPage) : page });
    };

    const activeFilters = serverPaging ? serverPaging.filters ?? {} : filters;
    const canFilter = (key: string) => !serverPaging?.filterKeys || serverPaging.filterKeys.includes(key);
    const handleFilterChange = (key: string, value: string) => {
        if (serverPaging) {
            serverPaging.onChange({ filters: { ...activeFilters, [key]: value } });
            return;
        }
        setFilters((prev) => ({ ...prev, [key]: value }));
        setCurrentPage(1);
    };

    const localFiltered = data
        .filter((row) =>
            Object.entries(filters).every(([key, val]) => {
                if (!val) return true;
                return String(row[key]).toLowerCase().includes(val.toLowerCase());
            })
        )
        .filter((row) =>
            Object.values(row).some((val) =>
                String(val).toLowerCase().includes(globalSearch.toLowerCase())
            )
        );

    const filteredData = serverPaging ? data : localFiltered;
    const totalCount = serverPaging ? serverPaging.total : localFiltered.length;
    const totalPages = Math.ceil(totalCount / entriesPerPage);
    const paginatedData = serverPaging
        ? data
        : localFiltered.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

    // If the remembered page is past the end, fall back to the last real page.
    useEffect(() => {
        if (!serverPaging && totalPages > 0 && currentPage > totalPages) setCurrentPage(totalPages);
    }, [totalPages, currentPage, setCurrentPage]);

    const changePage = (direction: "prev" | "next") => {
        setCurrentPage((prev) => {
            if (direction === "prev" && prev > 1) return prev - 1;
            if (direction === "next" && prev < totalPages) return prev + 1;
            return prev;
        });
    };

    const handleAdd = useCallback(() => {
        if (requireBranchForAdd) {
            const bid = localStorage.getItem("branchid");
            if (!bid || bid === "all") {
                alert("Please select a specific branch from the top dropdown to create a new record.");
                return;
            }
        }
        onAdd?.();
    }, [requireBranchForAdd, onAdd]);

    const canEdit = (row: any) => (typeof showEdit === "function" ? showEdit(row) : showEdit);

    // Keyboard control (compact screens only)
    const [selectedIdx, setSelectedIdx] = useState(-1);
    const searchRef = useRef<HTMLInputElement>(null);
    const tbodyRef = useRef<HTMLTableSectionElement>(null);

    // Keep the highlighted row on the page that is actually showing.
    useEffect(() => {
        setSelectedIdx((i) => (i >= paginatedData.length ? paginatedData.length - 1 : i));
    }, [paginatedData.length]);
    useEffect(() => setSelectedIdx(-1), [currentPage, globalSearch, filters]);

    useEffect(() => {
        if (!compact) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.defaultPrevented || activeTable !== tableId || isOverlayOpen()) return;
            // Alt+N (⌥N on Mac — use the key's position, ⌥N types "˜").
            if (e.altKey && e.code === "KeyN" && showAdd) {
                e.preventDefault();
                handleAdd();
                return;
            }
            const t = e.target as HTMLElement;
            const typing = t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable;
            if (typing) {
                // ↓ from the search box drops into the table.
                if (e.key === "ArrowDown" && t === searchRef.current && paginatedData.length) {
                    e.preventDefault();
                    searchRef.current?.blur();
                    setSelectedIdx(0);
                }
                if (e.key === "Escape" && t === searchRef.current) searchRef.current?.blur();
                return;
            }
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            switch (e.key) {
                case "/":
                    e.preventDefault();
                    searchRef.current?.focus();
                    break;
                case "ArrowDown":
                    e.preventDefault();
                    setSelectedIdx((i) => Math.min(i + 1, paginatedData.length - 1));
                    break;
                case "ArrowUp":
                    e.preventDefault();
                    setSelectedIdx((i) => Math.max(i - 1, 0));
                    break;
                case "ArrowRight":
                case "PageDown":
                    e.preventDefault();
                    changePage("next");
                    break;
                case "ArrowLeft":
                case "PageUp":
                    e.preventDefault();
                    changePage("prev");
                    break;
                case "Enter": {
                    const row = paginatedData[selectedIdx];
                    if (!row) return;
                    e.preventDefault();
                    if (onEdit && canEdit(row)) onEdit(row);
                    else if (showView) onView?.(row);
                    break;
                }
                case "Delete": {
                    const row = paginatedData[selectedIdx];
                    if (!row || !showDelete) return;
                    e.preventDefault();
                    onDelete?.(row);
                    break;
                }
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    // Keep the highlighted row in view while arrowing through a long page.
    useEffect(() => {
        if (selectedIdx < 0) return;
        tbodyRef.current?.children[selectedIdx]?.scrollIntoView({ block: "nearest" });
    }, [selectedIdx]);

    const inlineForm = !showAdd && formFields && formValues && onFormChange && onFormSubmit && (
                    <div className="flex flex-row gap-4 w-full sm:w-full items-center">
                        {formFields.map((field) => (
                            <FormField
                                key={field.name}
                                label={field.label}
                                name={field.name}
                                type={field.type as any}
                                accept={field.accept}
                                value={field.type === "file" ? undefined : (formValues[field.name] || "")}
                                previewUrl={field.type === "file" ? (formValues[field.name] || null) : undefined}
                                onChange={(e: any) => {
                                    if (field.type === "file") {
                                        const file = e.target?.files?.[0];
                                        if (file) onFormChange(field.name, file);
                                    } else {
                                        onFormChange(field.name, e.target.value);
                                    }
                                }}
                                error={formErrors?.[field.name]}
                                placeholder={field.placeholder}
                                options={field.options}
                                className="flex-1"
                                searchable={field.searchable}
                            />
                        ))}

                        {(() => {
                            const fileField = formFields.find((f) => f.type === "file");
                            const previewUrl = fileField ? formValues[fileField.name] : null;
                            if (!previewUrl) return null;
                            return (
                                <div className="flex shrink-0 flex-col items-center gap-1">
                                    <span className="text-sm font-medium text-gray-700">Preview</span>
                                    <div className="relative h-10 w-10">
                                        <img
                                            src={previewUrl}
                                            alt="Preview"
                                            className="h-10 w-10 rounded-lg border border-gray-200 object-cover"
                                        />
                                        {/* Clearing the value lets the page drop the old file on Save. */}
                                        <button
                                            type="button"
                                            title="Remove image"
                                            onClick={() => onFormChange(fileField!.name, "")}
                                            className="absolute -top-1.5 -right-1.5 grid h-4 w-4 place-items-center rounded-full bg-red-600 text-[9px] font-bold leading-none text-white hover:bg-red-700"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            );
                        })()}

                        <fieldset className="flex items-center max-w-xs">
                            <legend className="text-sm sm:text-base font-medium">Status</legend>
                            <FormSwitch
                                label=""
                                name="status"
                                checked={Boolean(formValues.status)}
                                onChange={(checked: boolean) => onFormChange("status", checked as any)}
                            />
                        </fieldset>

                        <Button
                            variant="outline"
                            onClick={onFormSubmit}
                            className="whitespace-nowrap"
                        >
                            Save
                        </Button>
                    </div>
                );

    // Quick-add row for small masters; Enter saves.
    const compactInlineForm = !showAdd && formFields && formValues && onFormChange && onFormSubmit && (
        <FormDensityContext.Provider value="compact">
            <div
                className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3"
                onKeyDown={(e) => {
                    const t = e.target as HTMLElement;
                    if (e.key === "Enter" && !e.defaultPrevented && t.tagName === "INPUT" && (t as HTMLInputElement).type !== "file") {
                        e.preventDefault();
                        onFormSubmit();
                    }
                }}
            >
                {formFields.map((field) => (
                    <div key={field.name} className="min-w-[160px] flex-1">
                        <FormField
                            label={field.label}
                            name={field.name}
                            type={field.type as any}
                            accept={field.accept}
                            value={field.type === "file" ? undefined : (formValues[field.name] || "")}
                            onChange={(e: any) => {
                                if (field.type === "file") {
                                    const file = e.target?.files?.[0];
                                    if (file) onFormChange(field.name, file);
                                } else {
                                    onFormChange(field.name, e.target.value);
                                }
                            }}
                            error={formErrors?.[field.name]}
                            placeholder={field.placeholder}
                            options={field.options}
                            searchable={field.searchable}
                        />
                    </div>
                ))}
                {(() => {
                    const fileField = formFields.find((f) => f.type === "file");
                    const previewUrl = fileField ? formValues[fileField.name] : null;
                    if (!previewUrl) return null;
                    return (
                        <div className="relative h-8 w-8 shrink-0">
                            <img src={previewUrl} alt="Preview" className="h-8 w-8 rounded-md border border-slate-200 object-cover" />
                            <button
                                type="button"
                                title="Remove image"
                                onClick={() => onFormChange(fileField!.name, "")}
                                className="absolute -top-1.5 -right-1.5 grid h-4 w-4 place-items-center rounded-full bg-red-600 text-[9px] font-bold leading-none text-white hover:bg-red-700"
                            >
                                ✕
                            </button>
                        </div>
                    );
                })()}
                <div className="w-28 shrink-0">
                    <FormSwitch
                        label="Status"
                        name="status"
                        checked={Boolean(formValues.status)}
                        onChange={(checked: boolean) => onFormChange("status", checked as any)}
                    />
                </div>
                <button
                    type="button"
                    onClick={onFormSubmit}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-indigo-600 px-3.5 text-[13px] font-semibold text-white shadow-sm hover:bg-indigo-700"
                >
                    Save
                    <kbd className="ml-1 rounded border border-white/40 px-1 text-[10px] font-medium leading-4 text-white/80">Enter</kbd>
                </button>
            </div>
        </FormDensityContext.Provider>
    );

    const rowActions = (row: any) => (
        <>
                                            {showView && (
                                                <button onClick={() => onView?.(row)} title="View">
                                                    <FaEye />
                                                </button>
                                            )}
                                            {(typeof showEdit === "function" ? showEdit(row) : showEdit) && (
                                                <button onClick={() => onEdit?.(row)} title="Edit">
                                                    <FaEdit />
                                                </button>
                                            )}
                                            {showDelete && (
                                                <button onClick={() => onDelete?.(row)} title="Delete" className="text-red-500">
                                                    <FaTrash />
                                                </button>
                                            )}
                                            {(typeof showReset === "function" ? showReset(row) : showReset) && (
                                                <button onClick={() => onReset?.(row)} title="Reset" className="text-yellow-600">
                                                    <FaUndo />
                                                </button>
                                            )}
                                            {(typeof showClear === "function" ? showClear(row) : showClear) && (
                                                <button onClick={() => onClear?.(row)} title="Clear (hide for good)" className="text-slate-500">
                                                    <FaEraser />
                                                </button>
                                            )}
                                            {showPrint && (
                                                <button onClick={() => onPrint?.(row)} title="Print" className="text-green-600">
                                                    <FaPrint />
                                                </button>
                                            )}
                                            {(typeof showWhatsApp === "function" ? showWhatsApp(row) : showWhatsApp) && (
                                                <button
                                                    onClick={() => onWhatsApp?.(row)}
                                                    title="Share on WhatsApp"
                                                    aria-label="Share on WhatsApp"
                                                    style={{ color: "#25D366" }}
                                                >
                                                    <FaWhatsapp size={18} />
                                                </button>
                                            )}
                                            {showBarcode && (
                                                <button onClick={() => onBarcode?.(row)} title="Barcode" className="text-purple-600">
                                                    <FaBarcode />
                                                </button>
                                            )}
                                            {showConvert && (
                                                <button onClick={() => onConvert?.(row)} title="Convert to Invoice" className="text-orange-600">
                                                    <FaFileInvoice />
                                                </button>
                                            )}
                                            {(typeof showConfirm === "function" ? showConfirm(row) : showConfirm) && (
                                                <button onClick={() => onConfirm?.(row)} title={confirmTitle} className="text-blue-600">
                                                    <FaCheckCircle />
                                                </button>
                                            )}
                                            {(typeof showDispatch === "function" ? showDispatch(row) : showDispatch) && (
                                                <button onClick={() => onDispatch?.(row)} title="Mark Dispatched" className="text-sky-600">
                                                    <FaTruck />
                                                </button>
                                            )}
                                            {(typeof showDeliver === "function" ? showDeliver(row) : showDeliver) && (
                                                <button onClick={() => onDeliver?.(row)} title="Mark Delivered" className="text-green-600">
                                                    <FaBoxOpen />
                                                </button>
                                            )}
                                            {(typeof showReturn === "function" ? showReturn(row) : showReturn) && (
                                                <button onClick={() => onReturn?.(row)} title="Create Return" className="text-purple-600">
                                                    <FaReply />
                                                </button>
                                            )}
                                            {(typeof showCancel === "function" ? showCancel(row) : showCancel) && (
                                                <button onClick={() => onCancel?.(row)} title={cancelTitle} className="text-rose-600">
                                                    <FaBan />
                                                </button>
                                            )}
                                            {(typeof showReopen === "function" ? showReopen(row) : showReopen) && (
                                                <button onClick={() => onReopen?.(row)} title="Re-open" className="text-emerald-600">
                                                    <FaTrashRestore />
                                                </button>
                                            )}
        </>
    );

    if (compact) {
        const from = totalCount ? (currentPage - 1) * entriesPerPage + 1 : 0;
        const to = Math.min(currentPage * entriesPerPage, totalCount);
        const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
            (p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1
        );
        // Desktop screens can always show up to 100 rows a page.
        const pageSizes = entriesOptions.includes(100) ? entriesOptions : [...entriesOptions, 100];
        const toolBtn =
            "inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50";
        return (
            <div className="relative" onPointerDownCapture={claimKeyboard} onFocusCapture={claimKeyboard}>
                <div className="flex flex-col gap-2 text-[13px]">
                    {/* One-line toolbar */}
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-base font-semibold text-slate-900">{title}</h1>
                        <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                            {totalCount}
                        </span>
                        <div className="relative ml-auto w-full sm:w-64">
                            <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-400" />
                            <input
                                ref={searchRef}
                                type="text"
                                value={globalSearch}
                                onChange={(e) => {
                                    setGlobalSearch(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="h-8 w-full rounded-md border border-slate-300 bg-white pl-7 pr-8 text-[13px] outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                placeholder="Search…"
                            />
                            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-slate-300 px-1 text-[10px] text-slate-400">/</kbd>
                        </div>
                        {toolbarActions}
                        {showImport && (
                            <button onClick={onImport} className={toolBtn} title="Import from Excel">
                                <FaFileImport className="text-sky-600" /> Import
                            </button>
                        )}
                        {showExport && (
                            <button onClick={onExport} className={toolBtn} title="Export to Excel">
                                <FaFileExport className="text-emerald-600" /> Export
                            </button>
                        )}
                        {showDeleted && (
                            <button onClick={onShowDeleted} className={toolBtn} title="Deleted entries">
                                <FaTrashRestore className="text-rose-500" /> Deleted
                            </button>
                        )}
                        {showClear && onClearAll && filteredData.length > 0 && (
                            <button onClick={() => onClearAll(filteredData)} className={toolBtn} title="Clear all entries shown">
                                <FaEraser className="text-slate-500" /> Clear All
                            </button>
                        )}
                        {showAdd && (
                            <button
                                onClick={handleAdd}
                                title="Add new (Alt+N)"
                                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-indigo-600 px-3.5 text-[13px] font-semibold text-white shadow-sm hover:bg-indigo-700"
                            >
                                <FaPlus className="text-[10px]" /> Add New
                                <kbd className="ml-1 rounded border border-white/40 px-1 text-[10px] font-medium leading-4 text-white/80">Alt+N</kbd>
                            </button>
                        )}
                    </div>

                    {compactInlineForm}

                    {/* Table — scrolls inside itself, header and Actions stay put */}
                    <div className="relative max-h-[calc(100vh-178px)] overflow-auto rounded-lg border border-slate-200 bg-white">
                        {isLoading && <TableProgress />}
                        <table className="min-w-full text-left text-[12.5px]">
                            <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500">
                                <tr>
                                    {columns.map((col) => (
                                        <th key={col.key} className="whitespace-nowrap px-1.5 pt-2 pb-1 text-[10.5px] font-semibold uppercase tracking-normal">
                                            {col.label}
                                        </th>
                                    ))}
                                    {showActionsColumn && (
                                        <th className="sticky right-0 bg-slate-50 px-2 pt-2 pb-1 shadow-[-6px_0_6px_-6px_rgba(15,23,42,0.15)] text-right text-[10.5px] font-semibold uppercase tracking-normal">
                                            Actions
                                        </th>
                                    )}
                                </tr>
                                <tr className="border-b border-slate-200">
                                    {columns.map((col) => (
                                        <th key={col.key} className="px-1.5 pb-1.5">
                                            {canFilter(col.key) && <input
                                                type="text"
                                                value={activeFilters[col.key] || ""}
                                                onChange={(e) => handleFilterChange(col.key, e.target.value)}
                                                className="h-7 w-full min-w-[48px] rounded border border-slate-200 bg-white px-2 text-[12px] font-normal normal-case tracking-normal text-slate-700 outline-none focus:border-indigo-400"
                                                placeholder="Filter"
                                            />}
                                        </th>
                                    ))}
                                    {showActionsColumn && <th className="sticky right-0 bg-slate-50 shadow-[-6px_0_6px_-6px_rgba(15,23,42,0.15)]" />}
                                </tr>
                            </thead>
                            <tbody ref={tbodyRef}>
                                {paginatedData.length === 0 && (
                                    <tr>
                                        <td colSpan={columns.length + (showActionsColumn ? 1 : 0)} className="px-3 py-8 text-center text-slate-400">
                                            {isLoading ? "Loading…" : "No records found"}
                                        </td>
                                    </tr>
                                )}
                                {paginatedData.map((row, idx) => {
                                    const selected = idx === selectedIdx;
                                    const bg = selected ? "bg-indigo-50" : idx % 2 ? "bg-slate-50" : "bg-white";
                                    return (
                                        <tr
                                            key={row.id ?? idx}
                                            onClick={() => setSelectedIdx(idx)}
                                            onDoubleClick={() => (onEdit && canEdit(row) ? onEdit(row) : showView && onView?.(row))}
                                            className={`group cursor-default border-b border-slate-100 ${bg} hover:bg-indigo-50 ${
                                                selected ? "shadow-[inset_3px_0_0_#6366f1]" : ""
                                            }`}
                                        >
                                            {columns.map((col) => {
                                                const v = row[col.key];
                                                const isStatus = col.key === "status" && (v === "Active" || v === "Inactive");
                                                const isText = typeof v === "string" || typeof v === "number";
                                                // Party: name on top, mobile · city underneath.
                                                if (PARTY_COLUMN_KEYS.has(col.key) && typeof v === "string") {
                                                    const { name, mobile, city } = splitPartyLabel(v);
                                                    const sub = [mobile, city].filter(Boolean).join(" · ");
                                                    return (
                                                        <td key={col.key} title={v} className="min-w-[170px] max-w-[260px] px-1.5 py-1 align-middle text-slate-800">
                                                            <div className="whitespace-normal break-words font-medium leading-tight">{name || v}</div>
                                                            {sub && <div className="mt-0.5 whitespace-nowrap text-[11px] leading-tight text-slate-500">{sub}</div>}
                                                        </td>
                                                    );
                                                }
                                                return (
                                                    <td
                                                        key={col.key}
                                                        title={isText ? String(v) : undefined}
                                                        className={`whitespace-nowrap px-1.5 py-1.5 text-slate-800 ${isText && !isStatus ? "max-w-[140px] truncate min-[1440px]:max-w-[190px]" : ""}`}
                                                    >
                                                        {isStatus ? (
                                                            <span
                                                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                                                    v === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                                                                }`}
                                                            >
                                                                <span className={`h-1.5 w-1.5 rounded-full ${v === "Active" ? "bg-emerald-500" : "bg-slate-400"}`} />
                                                                {v}
                                                            </span>
                                                        ) : (
                                                            v
                                                        )}
                                                    </td>
                                                );
                                            })}
                                            {showActionsColumn && (
                                                <td
                                                    className={`sticky right-0 whitespace-nowrap px-2 py-1.5 shadow-[-6px_0_6px_-6px_rgba(15,23,42,0.15)] text-right text-blue-600 ${bg} group-hover:bg-indigo-50 [&>button]:ml-2 [&>button]:align-middle`}
                                                >
                                                    {rowActions(row)}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer: count, page size, shortcuts, pages */}
                    <div className="flex flex-wrap items-center gap-3 text-[12px] text-slate-500">
                        <span>
                            {from}–{to} of {totalCount}
                        </span>
                        <select
                            value={entriesPerPage}
                            onChange={(e) => {
                                setEntriesPerPage(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="h-7 rounded border border-slate-300 bg-white px-1.5 text-[12px] outline-none"
                            title="Rows per page"
                        >
                            {pageSizes.map((num) => (
                                <option key={num} value={num}>
                                    {num} / page
                                </option>
                            ))}
                        </select>
                        <div className="ml-auto flex items-center gap-1">
                            <button
                                onClick={() => changePage("prev")}
                                disabled={currentPage <= 1}
                                className="h-7 rounded border border-slate-300 bg-white px-2 hover:bg-slate-50 disabled:opacity-40"
                            >
                                ‹ Prev
                            </button>
                            {pages.map((p, i) => (
                                <React.Fragment key={p}>
                                    {i > 0 && p - pages[i - 1] > 1 && <span className="px-1">…</span>}
                                    <button
                                        onClick={() => setCurrentPage(p)}
                                        className={`h-7 min-w-7 rounded px-2 ${
                                            p === currentPage ? "bg-indigo-600 font-semibold text-white" : "border border-slate-300 bg-white hover:bg-slate-50"
                                        }`}
                                    >
                                        {p}
                                    </button>
                                </React.Fragment>
                            ))}
                            <button
                                onClick={() => changePage("next")}
                                disabled={currentPage >= totalPages}
                                className="h-7 rounded border border-slate-300 bg-white px-2 hover:bg-slate-50 disabled:opacity-40"
                            >
                                Next ›
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative">
            <div className="space-y-4 sm:space-y-6 text-xs sm:text-sm">
                <h2 className="text-lg sm:text-2xl font-semibold">{title}</h2>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                    <div className="flex items-center gap-1 sm:gap-2">
                        Show
                        <select
                            value={entriesPerPage}
                            onChange={(e) => setEntriesPerPage(Number(e.target.value))}
                            className="border rounded px-2 py-1"
                        >
                            {entriesOptions.map((num) => (
                                <option key={num} value={num}>
                                    {num}
                                </option>
                            ))}
                        </select>
                        entries
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 w-full">
                        <label className="text-sm">Search:</label>
                        <div className="relative w-full sm:w-64">
                            <FaSearch className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs" />
                            <input
                                type="text"
                                value={globalSearch}
                                onChange={(e) => setGlobalSearch(e.target.value)}
                                className="w-full pl-6 pr-3 py-1 border rounded text-xs sm:text-sm focus:outline-none"
                                placeholder="Search..."
                            />
                        </div>
                    </div>
                </div>

                {inlineForm}

                <div className="flex flex-col sm:flex-row sm:justify-end gap-2 w-full sm:w-auto">
                    {toolbarActions}
                    {showImport && (
                        <button
                            onClick={onImport}
                            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 !bg-sky-600 !text-white rounded-md hover:!bg-sky-700 text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer border border-sky-600"
                        >
                            <FaFileImport className="!text-white flex-shrink-0" />
                            <span className="!text-white font-bold">Import</span>
                        </button>
                    )}
                    {showExport && (
                        <button
                            onClick={onExport}
                            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 !bg-emerald-600 !text-white rounded-md hover:!bg-emerald-700 text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer border border-emerald-600"
                        >
                            <FaFileExport className="!text-white flex-shrink-0" />
                            <span className="!text-white font-bold">Export</span>
                        </button>
                    )}
                    {showDeleted && (
                        <button
                            onClick={onShowDeleted}
                            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 !bg-rose-600 !text-white rounded-md hover:!bg-rose-700 text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer border border-rose-600"
                        >
                            <FaTrashRestore className="!text-white flex-shrink-0" />
                            <span className="!text-white font-bold">Deleted Entries</span>
                        </button>
                    )}
                    {showClear && onClearAll && filteredData.length > 0 && (
                        <button
                            onClick={() => onClearAll(filteredData)}
                            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 !bg-slate-600 !text-white rounded-md hover:!bg-slate-700 text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer border border-slate-600"
                        >
                            <FaEraser className="!text-white flex-shrink-0" />
                            <span className="!text-white font-bold">Clear All</span>
                        </button>
                    )}
                    {showAdd && (
                        <button
                            onClick={handleAdd}
                            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 !bg-indigo-600 !text-white rounded-md hover:!bg-indigo-700 text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer border border-indigo-600"
                        >
                            <FaPlus className="!text-white flex-shrink-0" />
                            <span className="!text-white font-bold">Add New</span>
                        </button>
                    )}
                </div>

                <div className="relative overflow-auto border rounded">
                    {isLoading && <TableProgress />}
                    <table className="min-w-full text-xs sm:text-sm text-left">
                        <thead className="bg-gray-100 text-gray-700">
                            <tr>
                                {columns.map((col) => (
                                    <th
                                        key={col.key}
                                        className="px-3 sm:px-4 py-1 sm:py-2 whitespace-nowrap"
                                    >
                                        <div className="flex items-center gap-1">
                                            {col.label}
                                            <FaFilter className="text-gray-400 text-xs" />
                                        </div>
                                    </th>
                                ))}
                                {showActionsColumn && <th className="px-3 sm:px-4 py-1 sm:py-2">Actions</th>}
                            </tr>
                            <tr>
                                {columns.map((col) => (
                                    <th key={col.key} className="px-3 sm:px-4 py-1">
                                        {canFilter(col.key) && <input
                                            type="text"
                                            value={activeFilters[col.key] || ""}
                                            onChange={(e) => handleFilterChange(col.key, e.target.value)}
                                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none"
                                            placeholder={`Search ${col.label}`}
                                        />}
                                    </th>
                                ))}
                                {showActionsColumn && <th></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedData.map((row, idx) => (
                                <tr key={idx} className="border-t">
                                    {columns.map((col) => (
                                        <td
                                            key={col.key}
                                            className="px-3 sm:px-4 py-2 whitespace-nowrap"
                                        >
                                            {row[col.key]}
                                        </td>
                                    ))}
                                    {showActionsColumn && (
                                        <td className="px-3 sm:px-4 py-2 space-x-2 text-blue-600">
                                            {rowActions(row)}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-end items-center gap-1 sm:gap-2 text-xs sm:text-sm mt-3">
                    <button
                        onClick={() => changePage("prev")}
                        className="px-2 sm:px-3 py-1 border rounded hover:bg-gray-200"
                    >
                        &lt; Previous
                    </button>
                    <span className="w-6 sm:w-8 h-6 sm:h-8 flex items-center justify-center bg-blue-600 text-white rounded-full">
                        {currentPage}
                    </span>
                    <button
                        onClick={() => changePage("next")}
                        className="px-2 sm:px-3 py-1 border rounded hover:bg-gray-200"
                    >
                        Next &gt;
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DataTable;
