import React, { useEffect, useState } from "react";
import HomeLayout from "../../../layouts/home";
import ReportTable, { type ReportFilterField } from "../../../components/reporttable";
import { useProductServicesQuery, useDeletedProductServicesQuery } from "../../../graphql/hooks/products";
import { useTransferStocksQuery, useDeletedTransferStocksQuery } from "../../../graphql/hooks/transferstock";
import { useBranchesQuery } from "../../../graphql/hooks/branches";
import { normalizeToYMD, formatDateDMY } from "../../../utils/helper";
import { FaBoxes, FaExclamationTriangle, FaChartLine, FaExchangeAlt } from "react-icons/fa";

const reportTabsObj = [
  { id: "Current Stock", label: "Current Stock", icon: <FaBoxes className="text-blue-600" /> },
  { id: "Low Stock", label: "Low Stock", icon: <FaExclamationTriangle className="text-amber-600" /> },
  { id: "Stock Valuation", label: "Stock Valuation", icon: <FaChartLine className="text-emerald-600" /> },
  { id: "Stock Transfers", label: "Stock Transfers", icon: <FaExchangeAlt className="text-purple-600" /> },
];

const StockReports: React.FC = () => {
  const { data: productData } = useProductServicesQuery();
  const { data: deletedProductData } = useDeletedProductServicesQuery();
  const { data: transferData } = useTransferStocksQuery();
  const { data: deletedTransferData } = useDeletedTransferStocksQuery();
  const { data: branchData } = useBranchesQuery();

  const products = productData?.getProductServices || [];
  const deletedProducts = deletedProductData?.getProductServices || [];
  const transfers = transferData?.getTransferStocks || [];
  const deletedTransfers = deletedTransferData?.getDeletedTransferStocks || [];
  const branches = branchData?.getBranches || [];

  const [activeTab, setActiveTab] = useState<string>(reportTabsObj[0].id);
  const [filters, setFilters] = useState<{ [key: string]: any }>({});
  const [appliedFilters, setAppliedFilters] = useState<{ [key: string]: any }>({});

  // -----------------------------
  // Initialize date filter
  // -----------------------------
  useEffect(() => {
    const today = new Date();
    const to = today.toISOString().slice(0, 10);
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30)
      .toISOString()
      .slice(0, 10);
    setFilters({ fromDate: from, toDate: to });
    setAppliedFilters({ fromDate: from, toDate: to });
  }, []);

  const productOptions = [...products, ...deletedProducts]
    .filter((p) => !p.isservice)
    .map((p) => ({ label: p.name, value: p.id }));

  // -----------------------------
  // Prepare stock tables
  // -----------------------------
  const allProducts = [...products, ...deletedProducts];
  const currentStock = allProducts.flatMap((p) =>
    (p.productvariants || []).map((v: any) => ({
      productId: p.id,
      productName: p.name,
      variantName: v.name,
      currentStock: v.currentstock || 0,
      stockValue: v.currentstockamount || 0,
      minimumStock: v.minimumstock,
      reorderLevel: v.reorderlevel,
      rackLocation: v.racklocation,
      status: deletedProducts.some((dp) => dp.id === p.id) ? "Inactive" : (v.currentstock > 0 ? "Active" : "Inactive"),
    }))
  );

  const lowStock = currentStock.filter((s) => s.currentStock <= (s.reorderLevel || 0));
  const stockValuation = currentStock;

  const allTransfers = [...transfers, ...deletedTransfers];
  const stockTransfers = allTransfers.map((t: any) => {
    const product = allProducts.find((p) => p.id === t.productid);
    const variant = product?.productvariants?.find((v: any) => v.id === t.variantid);
    const fromBranch = branches.find((b) => b.id === t.frombranchid);
    const toBranch = branches.find((b) => b.id === t.tobranchid);

    return {
      productId: t.productid,
      productName: product?.name || "-",
      variantName: variant?.name || "-",
      fromBranch: fromBranch?.branchname || t.frombranchid,
      toBranch: toBranch?.branchname || t.tobranchid,
      qty: t.transferqty,
      transferDate: formatDateDMY(t.transferdate),
      transferDateYMD: normalizeToYMD(t.transferdate),
      status: deletedTransfers.some((dt) => dt.id === t.id) ? "Inactive" : "Active",
    };
  });

  const handleApplyFilters = () => setAppliedFilters({ ...filters });

  // -----------------------------
  // Columns and filters
  // -----------------------------
  let tableData: any[] = [];
  let columns: any[] = [];
  let filterFields: ReportFilterField[] = [];

  const statusFilterOptions = [
    { label: "Active", value: "Active" },
    { label: "Inactive", value: "Inactive" },
  ];

  switch (activeTab) {
    case "Current Stock":
      tableData = currentStock.filter((s) => {
        if (appliedFilters.productId && appliedFilters.productId !== s.productId) return false;
        if (appliedFilters.status && appliedFilters.status !== s.status) return false;
        return true;
      });
      columns = [
        { label: "Product", key: "productName" },
        { label: "Variant", key: "variantName" },
        { label: "Current Stock", key: "currentStock", numeric: true },
        { label: "Stock Value (₹)", key: "stockValue", numeric: true },
        { label: "Rack Location", key: "rackLocation" },
        { label: "Status", key: "status" },
      ];
      filterFields = [
        { name: "productId", label: "Product", type: "select", options: productOptions, searchable: true },
        { name: "status", label: "Status", type: "select", options: statusFilterOptions },
      ];
      break;

    case "Low Stock":
      tableData = lowStock.filter((s) => {
        if (appliedFilters.productId && appliedFilters.productId !== s.productId) return false;
        if (appliedFilters.status && appliedFilters.status !== s.status) return false;
        return true;
      });
      columns = [
        { label: "Product", key: "productName" },
        { label: "Variant", key: "variantName" },
        { label: "Current Stock", key: "currentStock", numeric: true },
        { label: "Min Stock", key: "minimumStock", numeric: true },
        { label: "Reorder Level", key: "reorderLevel", numeric: true },
        { label: "Rack Location", key: "rackLocation" },
        { label: "Status", key: "status" },
      ];
      filterFields = [
        { name: "productId", label: "Product", type: "select", options: productOptions, searchable: true },
        { name: "status", label: "Status", type: "select", options: statusFilterOptions },
      ];
      break;

    case "Stock Valuation":
      tableData = stockValuation.filter((s) => {
        if (appliedFilters.productId && appliedFilters.productId !== s.productId) return false;
        if (appliedFilters.status && appliedFilters.status !== s.status) return false;
        return true;
      });
      columns = [
        { label: "Product", key: "productName" },
        { label: "Variant", key: "variantName" },
        { label: "Current Stock", key: "currentStock", numeric: true },
        { label: "Stock Value (₹)", key: "stockValue", numeric: true },
        { label: "Status", key: "status" },
      ];
      filterFields = [
        { name: "productId", label: "Product", type: "select", options: productOptions, searchable: true },
        { name: "status", label: "Status", type: "select", options: statusFilterOptions },
      ];
      break;

    case "Stock Transfers":
      tableData = stockTransfers.filter((t) => {
        const from = appliedFilters.fromDate;
        const to = appliedFilters.toDate;
        if (from && t.transferDateYMD && t.transferDateYMD < from) return false;
        if (to && t.transferDateYMD && t.transferDateYMD > to) return false;
        if (appliedFilters.productId && appliedFilters.productId !== t.productId) return false;
        if (appliedFilters.status && appliedFilters.status !== t.status) return false;
        return true;
      });
      columns = [
        { label: "Product", key: "productName" },
        { label: "Variant", key: "variantName" },
        { label: "From Branch", key: "fromBranch" },
        { label: "To Branch", key: "toBranch" },
        { label: "Qty", key: "qty", numeric: true },
        { label: "Transfer Date", key: "transferDate" },
        { label: "Status", key: "status" },
      ];
      filterFields = [
        { name: "productId", label: "Product", type: "select", options: productOptions, searchable: true },
        { name: "fromDate", label: "From Date", type: "date" },
        { name: "toDate", label: "To Date", type: "date" },
        { name: "status", label: "Status", type: "select", options: statusFilterOptions },
      ];
      break;
  }

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6 font-sans">
        <div className="flex flex-wrap gap-2 mb-4">
          {reportTabsObj.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  isActive
                    ? "!bg-slate-900 !text-white shadow-sm border border-slate-900"
                    : "bg-white text-gray-700 hover:text-black hover:bg-gray-100 border border-gray-200"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
        <ReportTable
          title="Stock Reports"
          columns={columns}
          data={tableData}
          filterFields={filterFields}
          filters={filters}
          setFilters={setFilters}
          appliedFilters={appliedFilters}
          setAppliedFilters={setAppliedFilters}
          showExport
          showCsv
          showPdf
          exportFileName="StockReport"
          showTotals
        />
      </div>
    </HomeLayout>
  );
};

export default StockReports;
