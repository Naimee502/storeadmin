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
import { useState } from "react";
import Loader from "../loader";
import FormField from "../formfiled";
import FormSwitch from "../formswitch";
import Button from "../button";

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
}

interface DataTableProps {
    title: string;
    columns: Column[];
    data: any[];
    showView?: boolean;
    showEdit?: boolean;
    showDelete?: boolean;
    showAdd?: boolean;
    showReset?: boolean | ((row: any) => boolean);
    showPrint?: boolean;
    // Per-row WhatsApp share. Hidden by default. Passed-in handler decides
    // what content to share (text summary, link to PDF, etc).
    showWhatsApp?: boolean | ((row: any) => boolean);
    showBarcode?: boolean | ((row: any) => boolean);
    showConvert?: boolean;
    // Per-row action: create a Return doc (Sales/Purchase Return) from this invoice.
    // Hidden by default. May be a function for conditional visibility per row.
    showReturn?: boolean | ((row: any) => boolean);
    // Per-row action: cancel an order (Sales Order / Purchase Order).
    showCancel?: boolean | ((row: any) => boolean);
    // Per-row fulfilment transitions (Sales Order lifecycle).
    showConfirm?: boolean | ((row: any) => boolean);
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
    onPrint?: (row: any) => void;
    onWhatsApp?: (row: any) => void;
    onBarcode?: (row: any) => void;
    onConvert?: (row: any) => void;
    onReturn?: (row: any) => void;
    onCancel?: (row: any) => void;
    onConfirm?: (row: any) => void;
    onDispatch?: (row: any) => void;
    onDeliver?: (row: any) => void;
    onShowDeleted?: () => void;
    onImport?: () => void;
    onExport?: () => void;
    isLoading?: boolean;
    formFields?: FormField[];
    formValues?: { [key: string]: any };
    formErrors?: { [key: string]: string };
    onFormChange?: (name: string, value: string) => void;
    onFormSubmit?: () => void;
    onActiveToggle?: (checked: boolean) => void;
    showActionsColumn?: boolean;
}

const DataTable: React.FC<DataTableProps> = ({
    title,
    columns,
    data,
    showView = true,
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
    showConfirm = false,
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
    onPrint,
    onWhatsApp,
    onBarcode,
    onConvert,
    onReturn,
    onCancel,
    onConfirm,
    onDispatch,
    onDeliver,
    onShowDeleted,
    onImport,
    onExport,
    isLoading = false,
    formFields,
    formValues,
    formErrors,
    onFormChange,
    onFormSubmit,
    showActionsColumn = true,
}) => {
    const [entriesPerPage, setEntriesPerPage] = useState(defaultEntriesPerPage);
    const [currentPage, setCurrentPage] = useState(1);
    const [globalSearch, setGlobalSearch] = useState("");
    const [filters, setFilters] = useState<{ [key: string]: string }>({});

    const handleFilterChange = (key: string, value: string) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
        setCurrentPage(1);
    };

    const filteredData = data
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

    const totalPages = Math.ceil(filteredData.length / entriesPerPage);
    const paginatedData = filteredData.slice(
        (currentPage - 1) * entriesPerPage,
        currentPage * entriesPerPage
    );

    const changePage = (direction: "prev" | "next") => {
        setCurrentPage((prev) => {
            if (direction === "prev" && prev > 1) return prev - 1;
            if (direction === "next" && prev < totalPages) return prev + 1;
            return prev;
        });
    };

    return (
        <div className="relative">
            {isLoading && <Loader fullScreen />}
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

                {!showAdd && formFields && formValues && onFormChange && onFormSubmit && (
                    <div className="flex flex-row gap-4 w-full sm:w-full items-center">
                        {formFields.map((field) => (
                            <FormField
                                key={field.name}
                                label={field.label}
                                name={field.name}
                                type={field.type as any}
                                value={formValues[field.name] || ""}
                                onChange={(e: any) => onFormChange(field.name, e.target.value)}
                                error={formErrors?.[field.name]}
                                placeholder={field.placeholder}
                                options={field.options}
                                className="flex-1"
                                searchable={field.searchable} 
                            />
                        ))}

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
                )}

                <div className="flex flex-col sm:flex-row sm:justify-end gap-2 w-full sm:w-auto">
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
                    {showAdd && (
                        <button
                            onClick={onAdd}
                            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 !bg-indigo-600 !text-white rounded-md hover:!bg-indigo-700 text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer border border-indigo-600"
                        >
                            <FaPlus className="!text-white flex-shrink-0" />
                            <span className="!text-white font-bold">Add New</span>
                        </button>
                    )}
                </div>

                <div className="overflow-auto border rounded">
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
                                        <input
                                            type="text"
                                            value={filters[col.key] || ""}
                                            onChange={(e) => handleFilterChange(col.key, e.target.value)}
                                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none"
                                            placeholder={`Search ${col.label}`}
                                        />
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
                                            {showView && (
                                                <button onClick={() => onView?.(row)} title="View">
                                                    <FaEye />
                                                </button>
                                            )}
                                            {showEdit && (
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
                                                <button onClick={() => onConfirm?.(row)} title="Confirm Order" className="text-blue-600">
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
                                                <button onClick={() => onCancel?.(row)} title="Cancel Order" className="text-rose-600">
                                                    <FaBan />
                                                </button>
                                            )}
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
