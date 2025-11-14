import React, { useEffect, useState } from "react";
import HomeLayout from "../../../layouts/home";
import ReportTable, { type ReportFilterField } from "../../../components/reporttable";
import { useProductServicesQuery, useDeletedProductServicesQuery } from "../../../graphql/hooks/products";
import { useTransferStocksQuery, useDeletedTransferStocksQuery } from "../../../graphql/hooks/transferstock";
import { useBranchesQuery } from "../../../graphql/hooks/branches";
import { applyDateShortcut, normalizeToYMD } from "../../../utils/helper";

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

  const reportTabs = ["Current Stock", "Low Stock", "Stock Valuation", "Stock Transfers"];
  const [activeTab, setActiveTab] = useState<string>(reportTabs[0]);
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
      transferDate: normalizeToYMD(t.transferdate),
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
        { label: "Current Stock", key: "currentStock" },
        { label: "Stock Value", key: "stockValue" },
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
        { label: "Current Stock", key: "currentStock" },
        { label: "Reorder Level", key: "reorderLevel" },
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
        { label: "Current Stock", key: "currentStock" },
        { label: "Stock Value", key: "stockValue" },
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
        if (from && t.transferDate && t.transferDate < from) return false;
        if (to && t.transferDate && t.transferDate > to) return false;
        if (appliedFilters.productId && appliedFilters.productId !== t.productId) return false;
        if (appliedFilters.status && appliedFilters.status !== t.status) return false;
        return true;
      });
      columns = [
        { label: "Product", key: "productName" },
        { label: "Variant", key: "variantName" },
        { label: "From Branch", key: "fromBranch" },
        { label: "To Branch", key: "toBranch" },
        { label: "Qty", key: "qty" },
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
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <ReportTable
          title="Stock Reports"
          columns={columns}
          data={tableData}
          filterFields={filterFields}
          filters={filters}
          setFilters={setFilters}
          appliedFilters={appliedFilters}
          setAppliedFilters={setAppliedFilters}
          defaultTab={activeTab}
          tabs={reportTabs}
          onTabChange={(tab) => setActiveTab(tab)}
          showExport
          showCsv
        />
      </div>
    </HomeLayout>
  );
};

export default StockReports;
