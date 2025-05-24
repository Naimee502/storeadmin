import {
    FaSearch,
    FaPlus,
    FaFileImport,
    FaFileExport,
    FaEye,
    FaTrash,
    FaEdit,
    FaFilter,
} from "react-icons/fa";
import { useState } from "react";

interface Column {
    label: string;
    key: string;
}

interface DataTableProps {
    title: string;
    columns: Column[];
    data: any[];
    showView?: boolean;
    showEdit?: boolean;
    showDelete?: boolean;
    showAdd?: boolean;
    showImport?: boolean;
    showExport?: boolean;
    entriesOptions?: number[];
    defaultEntriesPerPage?: number;
    onView?: (row: any) => void;
    onEdit?: (row: any) => void;
    onDelete?: (row: any) => void;
    onAdd?: () => void;
    onImport?: () => void;
    onExport?: () => void;
}

const DataTable: React.FC<DataTableProps> = ({
    title,
    columns,
    data,
    showView = true,
    showEdit = true,
    showDelete = true,
    showAdd = true,
    showImport = true,
    showExport = true,
    entriesOptions = [5, 10, 25, 50],
    defaultEntriesPerPage = 10,
    onView,
    onEdit,
    onDelete,
    onAdd,
    onImport,
    onExport,
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
        <div className="space-y-4 sm:space-y-6 text-xs sm:text-sm">
            <h2 className="text-lg sm:text-2xl font-semibold">{title}</h2>

            {/* Top Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                {/* Entries dropdown */}
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

                {/* Search Input */}
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

            {/* Action Buttons below search, right aligned */}
            <div className="flex flex-col sm:flex-row sm:justify-end gap-2 w-full">
                {showImport && (
                    <button
                        onClick={onImport}
                        className="w-full sm:w-auto flex items-center justify-center gap-1 px-3 py-1 bg-blue-600 text-black rounded hover:bg-blue-700"
                    >
                        <FaFileImport /> Import
                    </button>
                )}
                {showExport && (
                    <button
                        onClick={onExport}
                        className="w-full sm:w-auto flex items-center justify-center gap-1 px-3 py-1 bg-green-600 text-black rounded hover:bg-green-700"
                    >
                        <FaFileExport /> Export
                    </button>
                )}
                {showAdd && (
                    <button
                        onClick={onAdd}
                        className="w-full sm:w-auto flex items-center justify-center gap-1 px-3 py-1 bg-indigo-600 text-black rounded hover:bg-indigo-700"
                    >
                        <FaPlus /> Add New
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="overflow-auto border rounded">
                <table className="min-w-full text-xs sm:text-sm text-left">
                    <thead className="bg-gray-100 text-gray-700">
                        <tr>
                            {columns.map((col) => (
                                <th key={col.key} className="px-3 sm:px-4 py-1 sm:py-2 whitespace-nowrap">
                                    <div className="flex items-center gap-1">
                                        {col.label}
                                        <FaFilter className="text-gray-400 text-xs" />
                                    </div>
                                </th>
                            ))}
                            <th className="px-3 sm:px-4 py-1 sm:py-2">Actions</th>
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
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedData.map((row, idx) => (
                            <tr key={idx} className="border-t">
                                {columns.map((col) => (
                                    <td key={col.key} className="px-3 sm:px-4 py-2 whitespace-nowrap">
                                        {row[col.key]}
                                    </td>
                                ))}
                                <td className="px-3 sm:px-4 py-2 space-x-2 text-blue-600">
                                    {showView && (
                                        <button onClick={() => onView?.(row)}>
                                            <FaEye />
                                        </button>
                                    )}
                                    {showEdit && (
                                        <button onClick={() => onEdit?.(row)}>
                                            <FaEdit />
                                        </button>
                                    )}
                                    {showDelete && (
                                        <button
                                            onClick={() => onDelete?.(row)}
                                            className="text-red-500"
                                        >
                                            <FaTrash />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
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
    );
};

export default DataTable;
