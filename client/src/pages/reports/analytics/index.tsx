import React, { useEffect, useState, useMemo } from "react";
import HomeLayout from "../../../layouts/home";
import ReportTable, { type ReportFilterField } from "../../../components/reporttable";
import { useSalesInvoicesQuery } from "../../../graphql/hooks/salesinvoice";
import { useProductServicesQuery } from "../../../graphql/hooks/products";
import { normalizeToYMD } from "../../../utils/helper";
import { FaTrophy, FaHourglassHalf, FaChartLine } from "react-icons/fa";

const reportTabsObj = [
  { id: "Top Selling Products", label: "Top Selling Products", icon: <FaTrophy className="text-amber-500" /> },
  { id: "Slow Moving Products", label: "Slow Moving Products", icon: <FaHourglassHalf className="text-blue-500" /> },
  { id: "Profit Margin Analysis", label: "Profit Margin Analysis", icon: <FaChartLine className="text-emerald-500" /> },
];

const AnalyticalReports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>(reportTabsObj[0].id);
  const [filters, setFilters] = useState<{ [key: string]: any }>({});
  const [appliedFilters, setAppliedFilters] = useState<{ [key: string]: any }>({});

  // Fetch data
  const { data: salesData } = useSalesInvoicesQuery();
  const { data: productData } = useProductServicesQuery();

  const salesInvoices = salesData?.getSalesInvoices || [];
  const products = productData?.getProductServices || [];

  // Initialize date filter (last 30 days)
  useEffect(() => {
    const today = new Date();
    const to = today.toISOString().slice(0, 10);
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30)
      .toISOString()
      .slice(0, 10);
    setFilters({ fromDate: from, toDate: to });
    setAppliedFilters({ fromDate: from, toDate: to });
  }, []);

  // ── Top Selling Products ──
  const topSellingData = useMemo(() => {
    const topSellingMap: Record<string, any> = {};
    salesInvoices.forEach((inv) => {
      const invDate = normalizeToYMD(inv.billdate);
      const from = appliedFilters.fromDate;
      const to = appliedFilters.toDate;
      if ((from && invDate < from) || (to && invDate > to)) return;
      inv.productservice?.forEach((p: any) => {
        const prodId = p.productserviceid?.id;
        const prodName = p.productserviceid?.name;
        if (!topSellingMap[prodId]) {
          topSellingMap[prodId] = { productName: prodName, qtySold: 0, revenue: 0 };
        }
        topSellingMap[prodId].qtySold += p.qty || 0;
        topSellingMap[prodId].revenue += p.amount || 0;
      });
    });
    return Object.values(topSellingMap).sort((a, b) => b.qtySold - a.qtySold);
  }, [salesInvoices, appliedFilters]);

  // ── Slow Moving Products ──
  const slowMovingData = useMemo(() => {
    const slowMap: Record<string, any> = {};
    products.forEach((p) => {
      slowMap[p.id] = { productName: p.name, qtySold: 0 };
    });
    salesInvoices.forEach((inv) => {
      const invDate = normalizeToYMD(inv.billdate);
      const from = appliedFilters.fromDate;
      const to = appliedFilters.toDate;
      if ((from && invDate < from) || (to && invDate > to)) return;
      inv.productservice?.forEach((p: any) => {
        const prodId = p.productserviceid?.id;
        if (slowMap[prodId]) slowMap[prodId].qtySold += p.qty || 0;
      });
    });
    return Object.values(slowMap)
      .filter((row) => row.qtySold > 0)
      .sort((a, b) => a.qtySold - b.qtySold);
  }, [salesInvoices, products, appliedFilters]);

  // ── Profit Margin Analysis ──
  const profitMarginData = useMemo(() => {
    const marginMap: Record<string, any> = {};
    salesInvoices.forEach((inv) => {
      const invDate = normalizeToYMD(inv.billdate);
      const from = appliedFilters.fromDate;
      const to = appliedFilters.toDate;
      if ((from && invDate < from) || (to && invDate > to)) return;
      inv.productservice?.forEach((p: any) => {
        const prodId = p.productserviceid?.id;
        const prodName = p.productserviceid?.name;
        if (!marginMap[prodId]) {
          marginMap[prodId] = { productName: prodName, revenue: 0, cost: 0 };
        }
        marginMap[prodId].revenue += p.amount || 0;
        marginMap[prodId].cost += p.purchaseamount || 0;
      });
    });
    return Object.values(marginMap).map((m) => ({
      ...m,
      profit: m.revenue - m.cost,
      profitMargin:
        m.revenue ? (((m.revenue - m.cost) / m.revenue) * 100).toFixed(2) + "%" : "-",
    }));
  }, [salesInvoices, appliedFilters]);

  // ── Tab Config ──
  let tableData: any[] = [];
  let columns: any[] = [];
  let filterFields: ReportFilterField[] = [];
  let title = "Analytical Reports";
  let exportFileName = "AnalyticsReport";

  switch (activeTab) {
    case "Top Selling Products":
      tableData = topSellingData;
      title = "Top Selling Products";
      exportFileName = "TopSellingProducts";
      columns = [
        { label: "Product", key: "productName" },
        { label: "Quantity Sold", key: "qtySold", numeric: true },
        { label: "Revenue (₹)", key: "revenue", numeric: true },
      ];
      filterFields = [
        { name: "fromDate", label: "From Date", type: "date" },
        { name: "toDate", label: "To Date", type: "date" },
      ];
      break;

    case "Slow Moving Products":
      tableData = slowMovingData;
      title = "Slow Moving Products";
      exportFileName = "SlowMovingProducts";
      columns = [
        { label: "Product", key: "productName" },
        { label: "Quantity Sold", key: "qtySold", numeric: true },
      ];
      filterFields = [
        { name: "fromDate", label: "From Date", type: "date" },
        { name: "toDate", label: "To Date", type: "date" },
      ];
      break;

    case "Profit Margin Analysis":
      tableData = profitMarginData;
      title = "Profit Margin Analysis";
      exportFileName = "ProfitMarginAnalysis";
      columns = [
        { label: "Product", key: "productName" },
        { label: "Revenue (₹)", key: "revenue", numeric: true },
        { label: "Cost (₹)", key: "cost", numeric: true },
        { label: "Profit (₹)", key: "profit", numeric: true },
        { label: "Profit Margin %", key: "profitMargin" },
      ];
      filterFields = [
        { name: "fromDate", label: "From Date", type: "date" },
        { name: "toDate", label: "To Date", type: "date" },
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
          title={title}
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
          exportFileName={exportFileName}
          showTotals
        />
      </div>
    </HomeLayout>
  );
};

export default AnalyticalReports;
