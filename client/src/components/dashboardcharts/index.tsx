import React, { useState, useMemo, useEffect } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Title,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import { FaChartLine, FaChartBar, FaClipboardCheck, FaUserClock } from "react-icons/fa";
import { useAppSelector } from "../../redux/hooks";
import { selectIsModuleAllowed } from "../../redux/slices/permissions";

import MonthlySalesChart from "./monthlysaleschart";
import RevenueAndSalesChart from "./revenuevssaleschart";
import StockInOutDoughnutChart from "./stockinoutdoughnutchart";
import ProfitLossChart from "./profilevslosschart";
import DailySalesChart from "./dailysaleschart";
import TargetVsSalesChart from "./targetsvssaleschart";
import CategoryWiseSalesChart from "./categorywisesaleschart";
import SalesmenWiseSalesChart from "./salesmenwisesaleschart";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Title
);

export interface DashboardChartsProps {
  salesInvoiceData?: { getSalesInvoices: any[] };
  purchaseInvoiceData?: { getPurchaseInvoices: any[] };
  productData?: { getProductServices: any[] };
  transferStockData?: { getTransferStocks: any[] };
  staffData?: { getStaffAccounts: any[] };
  categoryData?: { getCategories: any[] };
  transactionData?: { getTransactions: any[] };
  salesOrders?: any[];
  purchaseOrders?: any[];
  salesReturns?: any[];
  purchaseReturns?: any[];
  attendanceSummary?: any;
  leaveRequests?: any[];
  branchId: string;
}

const DashboardCharts: React.FC<DashboardChartsProps> = ({
  salesInvoiceData,
  purchaseInvoiceData,
  productData,
  transferStockData,
  staffData,
  categoryData,
  transactionData,
  salesOrders = [],
  purchaseOrders = [],
  salesReturns = [],
  purchaseReturns = [],
  attendanceSummary,
  leaveRequests = [],
  branchId,
}) => {
  const [activeTab, setActiveTab] = useState<string>("core");

  const fullState = useAppSelector((state: any) => state);
  const isAllowed = (moduleId: string) => selectIsModuleAllowed(fullState, moduleId);

  const invoices = salesInvoiceData?.getSalesInvoices ?? [];
  const purchaseInvoices = purchaseInvoiceData?.getPurchaseInvoices ?? [];
  const products = productData?.getProductServices ?? [];
  const transfers = transferStockData?.getTransferStocks ?? [];
  const staff = staffData?.getStaffAccounts ?? [];
  const categories = categoryData?.getCategories ?? [];

  useMemo(() => {
    return new Map(staff.map((s: any) => [s.id, s.name]));
  }, [staff]);

  // -------------------------------------------------------------
  // Tab 3: Orders & Returns Chart Calculations
  // -------------------------------------------------------------
  const soPending = salesOrders.filter((o) => !o.isConverted && o.status !== false).length;
  const soConverted = salesOrders.filter((o) => o.isConverted).length;
  const poPending = purchaseOrders.filter((o) => !o.isConverted && o.status !== false).length;
  const poConverted = purchaseOrders.filter((o) => o.isConverted).length;

  const orderFunnelData = {
    labels: ["Sales Orders", "Purchase Orders"],
    datasets: [
      {
        label: "Pending Fulfillment",
        data: [soPending, poPending],
        backgroundColor: "#f59e0b",
        borderColor: "#d97706",
        borderWidth: 1,
      },
      {
        label: "Converted / Invoiced",
        data: [soConverted, poConverted],
        backgroundColor: "#10b981",
        borderColor: "#059669",
        borderWidth: 1,
      },
    ],
  };

  const orderOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" as const, labels: { font: { size: 10 } } },
    },
    scales: {
      y: { beginAtZero: true, grid: { drawBorder: false }, ticks: { font: { size: 10 } } },
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
    },
  };

  const soReturnVal = salesReturns.reduce((acc, r) => acc + (r.totalamount ?? 0), 0);
  const poReturnVal = purchaseReturns.reduce((acc, r) => acc + (r.totalamount ?? 0), 0);

  const returnsValuationData = {
    labels: ["Credit Notes", "Debit Notes"],
    datasets: [
      {
        data: [soReturnVal, poReturnVal],
        backgroundColor: ["#ef4444", "#3b82f6"],
        borderColor: ["#dc2626", "#2563eb"],
        borderWidth: 1,
      },
    ],
  };

  const returnValuationOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" as const, labels: { boxWidth: 12, font: { size: 10 } } },
    },
  };

  const getMonthlyReturns = (returns: any[]) => {
    const monthly = new Array(12).fill(0);
    returns.forEach((r) => {
      const dateStr = r.returndate || r.createdAt;
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          monthly[d.getMonth()] += Number(r.totalamount ?? 0);
        }
      }
    });
    return monthly;
  };

  const monthlySRData = {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    datasets: [
      {
        label: "Sales Returns (₹)",
        data: getMonthlyReturns(salesReturns),
        backgroundColor: "rgba(239, 68, 68, 0.8)",
        borderColor: "#ef4444",
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const monthlyPRData = {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    datasets: [
      {
        label: "Purchase Returns (₹)",
        data: getMonthlyReturns(purchaseReturns),
        backgroundColor: "rgba(59, 130, 246, 0.8)",
        borderColor: "#3b82f6",
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const trendOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" as const, labels: { font: { size: 10 } } },
    },
    scales: {
      y: { beginAtZero: true, ticks: { font: { size: 10 } } },
      x: { ticks: { font: { size: 10 } } },
    },
  };

  // -------------------------------------------------------------
  // Tab 4: HR & Attendance Chart Calculations
  // -------------------------------------------------------------
  const present = attendanceSummary?.presentDays ?? 0;
  const absent = attendanceSummary?.absentDays ?? 0;
  const halfDay = attendanceSummary?.halfDays ?? 0;
  const leave = attendanceSummary?.leaveDays ?? 0;
  const late = attendanceSummary?.lateDays ?? 0;

  const attendanceChartData = {
    labels: ["Present", "Absent", "Half Day", "On Leave"],
    datasets: [
      {
        data: [present, absent, halfDay, leave],
        backgroundColor: ["#10b981", "#ef4444", "#f59e0b", "#3b82f6"],
        borderWidth: 1,
      },
    ],
  };

  const activeStaffCount = staff.filter((s) => s.status !== false).length;
  const inactiveStaffCount = staff.filter((s) => s.status === false).length;

  const staffStatusData = {
    labels: ["Active Roster", "Inactive Accounts"],
    datasets: [
      {
        data: [activeStaffCount, inactiveStaffCount],
        backgroundColor: ["#6366f1", "#94a3b8"],
        borderColor: ["#4f46e5", "#64748b"],
        borderWidth: 1,
      },
    ],
  };

  const approvedLeaves = leaveRequests.filter((l) => l.status?.toLowerCase() === "approved").length;
  const pendingLeaves = leaveRequests.filter((l) => l.status?.toLowerCase() === "pending").length;
  const rejectedLeaves = leaveRequests.filter((l) => l.status?.toLowerCase() === "rejected").length;

  const leaveBreakdownData = {
    labels: ["Approved", "Pending", "Rejected"],
    datasets: [
      {
        label: "Leave Applications",
        data: [approvedLeaves, pendingLeaves, rejectedLeaves],
        backgroundColor: ["#10b981", "#f59e0b", "#ef4444"],
        borderWidth: 1,
      },
    ],
  };

  const punctualityData = {
    labels: ["On Time", "Late Arrival"],
    datasets: [
      {
        data: [present - late >= 0 ? present - late : 0, late],
        backgroundColor: ["#10b981", "#f59e0b"],
        borderWidth: 1,
      },
    ],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" as const, labels: { boxWidth: 12, font: { size: 10 } } },
    },
  };

  const rawTabs = [
    { id: "core", label: "Core Financial Analytics", icon: <FaChartLine className="text-emerald-500" />, check: () => isAllowed("salesinvoice") || isAllowed("purchaseinvoice") || isAllowed("transactions") },
    { id: "sales", label: "Sales & Target Performance", icon: <FaChartBar className="text-blue-500" />, check: () => isAllowed("salesinvoice") || isAllowed("salesorder") },
    { id: "orders", label: "Order & Returns Valuation", icon: <FaClipboardCheck className="text-amber-500" />, check: () => isAllowed("salesorder") || isAllowed("purchaseorder") || isAllowed("salesreturn") || isAllowed("purchasereturn") },
    { id: "attendance", label: "Staff Attendance Breakdown", icon: <FaUserClock className="text-purple-500" />, check: () => isAllowed("attendance") || isAllowed("staffaccounts") },
  ];

  const allowedTabs = rawTabs.filter((t) => t.check());

  useEffect(() => {
    if (allowedTabs.length > 0 && !allowedTabs.some((t) => t.id === activeTab)) {
      setActiveTab(allowedTabs[0].id);
    }
  }, [fullState, activeTab]);

  if (allowedTabs.length === 0) return null;

  return (
    <div className="bg-white p-4 sm:p-5 rounded-lg shadow-xs border border-gray-200 space-y-4 font-sans mt-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-3">
        <div>
          <h2 className="text-base font-bold text-[#2c3e50]">Comprehensive Module Analytics</h2>
          <p className="text-xs text-gray-500">Interactive charts covering financial ledgers, inventory movement, orders, and staff</p>
        </div>
        <div className="flex flex-wrap gap-1 bg-gray-50 p-1 rounded border border-gray-200">
          {allowedTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded transition-all ${
                activeTab === t.id
                  ? "!bg-slate-900 !text-white shadow-sm"
                  : "text-gray-700 hover:text-black hover:bg-gray-200 bg-white border border-gray-200"
              }`}
            >
              <span className="text-xs">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        {/* Exactly 4 charts in Row 1 */}
        {activeTab === "core" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4.5 items-stretch">
            <MonthlySalesChart salesInvoices={invoices} />
            <RevenueAndSalesChart salesInvoices={invoices} />
            <StockInOutDoughnutChart
              products={products}
              transfers={transfers}
              invoices={invoices}
              purchaseInvoices={purchaseInvoices}
              branchId={branchId}
            />
            <ProfitLossChart transactions={transactionData?.getTransactions ?? []} />
          </div>
        )}

        {/* Exactly 4 charts in Row 2 */}
        {activeTab === "sales" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4.5 items-stretch">
            <DailySalesChart salesInvoices={invoices} />
            <TargetVsSalesChart salesInvoices={invoices} salesOrders={salesOrders} staff={staff} />
            <CategoryWiseSalesChart
              salesInvoices={invoices}
              products={products}
              categories={categories}
            />
            <SalesmenWiseSalesChart salesInvoices={invoices} salesOrders={salesOrders} staff={staff} />
          </div>
        )}

        {/* Exactly 4 professional visual charts in Row 3 */}
        {activeTab === "orders" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4.5 items-stretch">
            {/* Chart 1: Order Conversion Bar Chart */}
            <div className="bg-white p-3.5 rounded border border-gray-200 shadow-2xs flex flex-col justify-between h-80 sm:h-96">
              <div>
                <h3 className="text-xs font-bold text-[#2c3e50] mb-1 capitalize tracking-wider">Order Conversion</h3>
                <p className="text-[10px] text-gray-500 mb-2">Pending vs invoiced fulfillment</p>
              </div>
              <div className="flex-1 min-h-[220px]">
                <Bar data={orderFunnelData} options={orderOptions} />
              </div>
            </div>

            {/* Chart 2: Returns Valuation Doughnut Chart */}
            <div className="bg-white p-3.5 rounded border border-gray-200 shadow-2xs flex flex-col justify-between h-80 sm:h-96">
              <div>
                <h3 className="text-xs font-bold text-[#2c3e50] mb-1 capitalize tracking-wider">Return Shipments Share</h3>
                <p className="text-[10px] text-gray-500 mb-2">Credit notes vs Debit notes share</p>
              </div>
              <div className="flex-1 relative min-h-[200px] flex items-center justify-center py-2">
                <Doughnut data={returnsValuationData} options={returnValuationOptions} />
              </div>
            </div>

            {/* Chart 3: Monthly Sales Returns Bar Chart */}
            <div className="bg-white p-3.5 rounded border border-gray-200 shadow-2xs flex flex-col justify-between h-80 sm:h-96">
              <div>
                <h3 className="text-xs font-bold text-[#2c3e50] mb-1 capitalize tracking-wider">Sales Returns Trend</h3>
                <p className="text-[10px] text-gray-500 mb-2">Monthly customer credit note valuation</p>
              </div>
              <div className="flex-1 min-h-[220px]">
                <Bar data={monthlySRData} options={trendOptions} />
              </div>
            </div>

            {/* Chart 4: Monthly Purchase Returns Bar Chart */}
            <div className="bg-white p-3.5 rounded border border-gray-200 shadow-2xs flex flex-col justify-between h-80 sm:h-96">
              <div>
                <h3 className="text-xs font-bold text-[#2c3e50] mb-1 capitalize tracking-wider">Purchase Returns Trend</h3>
                <p className="text-[10px] text-gray-500 mb-2">Monthly supplier debit note claims</p>
              </div>
              <div className="flex-1 min-h-[220px]">
                <Bar data={monthlyPRData} options={trendOptions} />
              </div>
            </div>
          </div>
        )}

        {/* Exactly 4 professional visual charts in Row 4 */}
        {activeTab === "attendance" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4.5 items-stretch">
            {/* Chart 1: Attendance Distribution */}
            <div className="bg-white p-3.5 rounded border border-gray-200 shadow-2xs flex flex-col justify-between h-80 sm:h-96">
              <div>
                <h3 className="text-xs font-bold text-[#2c3e50] mb-1 capitalize tracking-wider">Attendance Breakdown</h3>
                <p className="text-[10px] text-gray-500 mb-2">Today's active staff presence share</p>
              </div>
              <div className="flex-1 relative min-h-[200px] flex items-center justify-center py-2">
                <Doughnut data={attendanceChartData} options={doughnutOptions} />
              </div>
            </div>

            {/* Chart 2: Staff Roster Status */}
            <div className="bg-white p-3.5 rounded border border-gray-200 shadow-2xs flex flex-col justify-between h-80 sm:h-96">
              <div>
                <h3 className="text-xs font-bold text-[#2c3e50] mb-1 capitalize tracking-wider">Staff Roster Status</h3>
                <p className="text-[10px] text-gray-500 mb-2">Active vs inactive personnel accounts</p>
              </div>
              <div className="flex-1 relative min-h-[200px] flex items-center justify-center py-2">
                <Doughnut data={staffStatusData} options={doughnutOptions} />
              </div>
            </div>

            {/* Chart 3: Leave Applications Status Bar Chart */}
            <div className="bg-white p-3.5 rounded border border-gray-200 shadow-2xs flex flex-col justify-between h-80 sm:h-96">
              <div>
                <h3 className="text-xs font-bold text-[#2c3e50] mb-1 capitalize tracking-wider">Leave Applications</h3>
                <p className="text-[10px] text-gray-500 mb-2">Approval status of leave requests</p>
              </div>
              <div className="flex-1 min-h-[220px]">
                <Bar data={leaveBreakdownData} options={trendOptions} />
              </div>
            </div>

            {/* Chart 4: Punctuality Share */}
            <div className="bg-white p-3.5 rounded border border-gray-200 shadow-2xs flex flex-col justify-between h-80 sm:h-96">
              <div>
                <h3 className="text-xs font-bold text-[#2c3e50] mb-1 capitalize tracking-wider">Punctuality Share</h3>
                <p className="text-[10px] text-gray-500 mb-2">On-time arrivals vs late instances</p>
              </div>
              <div className="flex-1 relative min-h-[200px] flex items-center justify-center py-2">
                <Doughnut data={punctualityData} options={doughnutOptions} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardCharts;
