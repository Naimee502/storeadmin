import React, { useEffect, useState, useMemo } from "react";
import HomeLayout from "../../../layouts/home";
import ReportTable, { type ReportFilterField } from "../../../components/reporttable";
import { useSalesInvoicesQuery } from "../../../graphql/hooks/salesinvoice";
import { useProductServicesQuery } from "../../../graphql/hooks/products";
import { useExpenseNotesQuery } from "../../../graphql/hooks/expensenote";
import { useStaffQuery } from "../../../graphql/hooks/staffaccounts";
import { normalizeToYMD } from "../../../utils/helper";

const AnalyticalReports: React.FC = () => {
  const reportTabs = [
    "Top Selling Products",
    "Slow Moving Products",
    "Profit Margin Analysis",
    "Expense Notes",
  ];
  const [activeTab, setActiveTab] = useState<string>(reportTabs[0]);
  const [filters, setFilters] = useState<{ [key: string]: any }>({});
  const [appliedFilters, setAppliedFilters] = useState<{ [key: string]: any }>({});

  // Fetch data
  const { data: salesData } = useSalesInvoicesQuery();
  const { data: productData } = useProductServicesQuery();
  const { data: expenseData } = useExpenseNotesQuery();
  const { data: staffData } = useStaffQuery();

  const salesInvoices = salesData?.getSalesInvoices || [];
  const products = productData?.getProductServices || [];
  const expenseNotes = expenseData?.getExpenseNotes || [];
  const staff = staffData?.getStaffAccounts || [];

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

  // ── Expense Notes ──
  const staffOptions = staff.map((s: any) => ({ label: s.name, value: s.id }));

  const expenseTableData = useMemo(() => {
    return expenseNotes
      .filter((e: any) => {
        const date = normalizeToYMD(e.expensedate);
        if (appliedFilters.fromDate && date < appliedFilters.fromDate) return false;
        if (appliedFilters.toDate && date > appliedFilters.toDate) return false;
        if (appliedFilters.staffId && e.staffid?.id !== appliedFilters.staffId) return false;
        if (appliedFilters.category && e.category !== appliedFilters.category) return false;
        if (appliedFilters.paymenttype && e.paymenttype !== appliedFilters.paymenttype) return false;
        return true;
      })
      .map((e: any, idx: number) => ({
        seqNo: idx + 1,
        expenseNo: e.expensenumber || "-",
        expenseDate: normalizeToYMD(e.expensedate) || "-",
        category:
          e.category === "tada"
            ? "TA/DA"
            : e.category
            ? e.category.charAt(0).toUpperCase() + e.category.slice(1)
            : "-",
        staffName: e.staffid?.name || "-",
        ledger: e.ledgerid?.ledgername || "-",
        paymentType: e.paymenttype
          ? e.paymenttype.charAt(0).toUpperCase() + e.paymenttype.slice(1)
          : "-",
        narration: e.narration || "-",
        totalGst: Number(e.totalgst || 0).toFixed(2),
        totalAmount: Number(e.totalamount || 0).toFixed(2),
        status: e.status ? e.status.charAt(0).toUpperCase() + e.status.slice(1) : "-",
      }));
  }, [expenseNotes, appliedFilters]);

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

    case "Expense Notes":
      tableData = expenseTableData;
      title = "Expense Notes Report";
      exportFileName = "ExpenseNoteReport";
      columns = [
        { label: "Seq No", key: "seqNo" },
        { label: "Expense No", key: "expenseNo" },
        { label: "Date", key: "expenseDate" },
        { label: "Category", key: "category" },
        { label: "Staff", key: "staffName" },
        { label: "Ledger", key: "ledger" },
        { label: "Payment Type", key: "paymentType" },
        { label: "Narration", key: "narration" },
        { label: "GST (₹)", key: "totalGst", numeric: true },
        { label: "Amount (₹)", key: "totalAmount", numeric: true },
        { label: "Status", key: "status" },
      ];
      filterFields = [
        { name: "fromDate", label: "From Date", type: "date" },
        { name: "toDate", label: "To Date", type: "date" },
        { name: "staffId", label: "Staff", type: "select", options: staffOptions, searchable: true },
        { name: "category", label: "Category", type: "select", options: [
          { label: "TA/DA", value: "tada" },
          { label: "Salary", value: "salary" },
          { label: "Others", value: "others" },
        ]},
        { name: "paymenttype", label: "Payment Type", type: "select", options: [
          { label: "Cash", value: "cash" },
          { label: "Bank", value: "bank" },
          { label: "Online", value: "online" },
        ]},
      ];
      break;
  }

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <div className="flex gap-2 mb-4 flex-wrap">
          {reportTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded text-sm font-medium border transition-colors ${
                activeTab === tab
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
              }`}
            >
              {tab}
            </button>
          ))}
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
