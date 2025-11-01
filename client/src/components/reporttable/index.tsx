import React from "react";
import { FaFileCsv, FaSync, FaCheck, FaFileExport } from "react-icons/fa";
import Loader from "../loader";
import FormField from "../formfiled";
import Button from "../button";
import { Tabs, TabsList, TabsTrigger } from "../tabs";

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
  tabs?: string[]; // dynamic tabs
  defaultTab?: string;
  onTabChange?: (tab: string) => void;
  isLoading?: boolean;
  showExport?: boolean;
  showCsv?: boolean;
  onExport?: () => void;
  onCsvExport?: () => void;
}

const ReportTable: React.FC<ReportTableProps> = ({
  title,
  columns,
  data,
  filterFields = [],
  filters,
  setFilters,
  appliedFilters,
  setAppliedFilters,
  tabs = [],
  defaultTab,
  onTabChange,
  isLoading = false,
  showExport = false,
  showCsv = false,
  onExport,
  onCsvExport,
}) => {
  const [tab, setTab] = React.useState(defaultTab || tabs[0] || "");

  const handleTabChange = (val: string) => {
    setTab(val);
    onTabChange?.(val);
  };

  const handleApply = () => setAppliedFilters(filters);
  const handleReset = () => {
    setFilters({});
    setAppliedFilters({});
  };

  const filteredData = data; // already filtered in parent

  return (
    <div className="relative">
      {isLoading && <Loader fullScreen />}

      <h2 className="text-xl sm:text-2xl font-semibold mb-4">{title}</h2>

      {/* Filters Section */}
      {filterFields.length > 0 && (
        <div className="bg-gray-50 p-4 rounded-lg shadow border mb-4 flex flex-col gap-4">
          <div className="flex flex-wrap gap-4">
            {filterFields.map((field) => (
              <div key={field.name} className="w-70">
                <FormField
                  label={field.label}
                  name={field.name}
                  type={field.type as any}
                  value={filters[field.name] || (field.type === "multiselect" ? [] : "")}
                  options={field.options}
                  searchable={field.searchable}
                  onChange={(e: any) =>
                    setFilters((prev) => ({
                      ...prev,
                      [field.name]:
                        field.type === "multiselect" ? e.target.value || [] : e.target.value,
                    }))
                  }
                />
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 mt-2">
            <Button
              onClick={handleApply}
              variant="outline"
              className="flex items-center justify-center gap-2"
            >
              <FaCheck className="inline-block" /> Apply
            </Button>
            <Button
              onClick={handleReset}
              variant="outline"
              className="flex items-center justify-center gap-2"
            >
              <FaSync className="inline-block" /> Reset
            </Button>
          </div>
        </div>
      )}

      {/* Export Buttons */}
      {(showExport || showCsv) && (
        <div className="flex flex-wrap gap-2 mb-4">
          {showExport && (
            <button
              onClick={onExport}
              className="bg-green-600 px-3 py-1 rounded text-black flex items-center gap-1 hover:bg-green-700"
            >
              <FaFileExport /> Export
            </button>
          )}
          {showCsv && (
            <button
              onClick={onCsvExport}
              className="bg-blue-600 px-3 py-1 rounded text-black flex items-center gap-1 hover:bg-blue-700"
            >
              <FaFileCsv /> Export CSV
            </button>
          )}
        </div>
      )}

      {/* Dynamic Tabs */}
      {tabs.length > 0 && (
        <Tabs value={tab} onValueChange={handleTabChange} className="mb-4">
          <TabsList className="border-b border-gray-200">
            {tabs.map((t) => (
              <TabsTrigger
                key={t}
                value={t}
                className={`px-4 py-2 -mb-px font-medium text-sm sm:text-base ${
                  tab === t
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "border-b-2 border-transparent text-gray-600 hover:text-blue-600 hover:border-blue-300"
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {/* Table */}
      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-xs sm:text-sm text-left">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="px-3 sm:px-4 py-2 whitespace-nowrap">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredData.length > 0 ? (
              filteredData.map((row, i) => (
                <tr key={i} className="border-t hover:bg-gray-50">
                  {columns.map((col) => (
                    <td key={col.key} className="px-3 sm:px-4 py-2 whitespace-nowrap">
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="text-center text-gray-500 py-6">
                  No data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReportTable;
