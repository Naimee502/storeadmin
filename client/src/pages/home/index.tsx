import React, { useEffect } from "react";
import HomeLayout from "../../layouts/home";
import { useNetworkOnline } from "../../offline/billing";
import { useQuery } from "@apollo/client";
import { useAppSelector } from "../../redux/hooks";

// Queries / Hooks
import { useAccountsQuery } from "../../graphql/hooks/accounts";
import { useProductServicesQuery } from "../../graphql/hooks/products";
import { useBranchesQuery } from "../../graphql/hooks/branches";
import { useCategoriesQuery } from "../../graphql/hooks/categories";
import { useStaffQuery } from "../../graphql/hooks/staffaccounts";
import { useSalesInvoicesQuery } from "../../graphql/hooks/salesinvoice";
import { usePurchaseInvoicesQuery } from "../../graphql/hooks/purchaseinvoice";
import { useTransferStocksQuery } from "../../graphql/hooks/transferstock";
import { useTransactionsQuery } from "../../graphql/hooks/transactions";
import { useSalesOrdersQuery } from "../../graphql/hooks/salesorder";
import { usePurchaseOrdersQuery } from "../../graphql/hooks/purchaseorder";
import { useSalesReturnsQuery } from "../../graphql/hooks/salesreturn";
import { usePurchaseReturnsQuery } from "../../graphql/hooks/purchasereturn";
import { useExpenseNotesQuery } from "../../graphql/hooks/expensenote";
import { usePaymentsQuery } from "../../graphql/hooks/payments";
import { GET_ATTENDANCE_SUMMARY, GET_LEAVE_REQUESTS } from "../../graphql/queries/attendance";

// Components
import StatsCards from "../../components/statuscards";
import DashboardCharts from "../../components/dashboardcharts";
import RecentOrders from "../../components/recentorders";

const Home: React.FC = () => {
  const online = useNetworkOnline();
  const { type, admin, branch, staff } = useAppSelector((state: any) => state.auth);
  const branchId = useAppSelector((state: any) => state.selectedBranch.branchId);

  const adminid =
    type === "admin"
      ? admin?.id
      : type === "branch"
      ? branch?.admin?.id
      : type === "staff"
      ? staff?.admin?.id
      : undefined;

  const branchid =
    type === "admin"
      ? branchId
      : type === "branch"
      ? branch?.id
      : type === "staff"
      ? staff?.branchid?.id
      : undefined;

  // Existing Core Queries
  const { data: customerData, refetch: refetchCustomers } = useAccountsQuery();
  const { data: productData, refetch: refetchProducts } = useProductServicesQuery(true, 500, 0);
  const { data: branchesData } = useBranchesQuery();
  const { data: categoryData, refetch: refetchCategories } = useCategoriesQuery();
  const { data: staffData, refetch: refetchStaff } = useStaffQuery();
  const { data: salesInvoiceData, refetch: refetchSalesInvoices } = useSalesInvoicesQuery();
  const { data: purchaseInvoiceData, refetch: refetchPurchaseInvoices } = usePurchaseInvoicesQuery();
  const { data: transferStockData, refetch: refetchTransferStock } = useTransferStocksQuery();
  const { data: transactionData, refetch: refetchTransaction } = useTransactionsQuery();

  // New Modules Queries
  const { data: soData, refetch: refetchSO } = useSalesOrdersQuery();
  const { data: poData, refetch: refetchPO } = usePurchaseOrdersQuery();
  const { data: srData, refetch: refetchSR } = useSalesReturnsQuery();
  const { data: prData, refetch: refetchPR } = usePurchaseReturnsQuery();
  const { data: expData, refetch: refetchExpenses } = useExpenseNotesQuery();
  const { data: payData, refetch: refetchPayments } = usePaymentsQuery();

  // Attendance Queries
  const { data: attData, refetch: refetchAttendance } = useQuery(GET_ATTENDANCE_SUMMARY, {
    variables: { filter: { adminid, branchid } },
    skip: !adminid,
  });

  const { data: leaveData, refetch: refetchLeaves } = useQuery(GET_LEAVE_REQUESTS, {
    variables: { filter: { adminid, branchid } },
    skip: !adminid,
  });

  // Refetch all when branch ID changes
  useEffect(() => {
    console.log("Branch ID changed:", branchId);
    refetchCustomers();
    refetchProducts();
    refetchCategories();
    refetchStaff();
    refetchSalesInvoices();
    refetchPurchaseInvoices();
    refetchTransferStock();
    refetchTransaction();
    refetchSO();
    refetchPO();
    refetchSR();
    refetchPR();
    refetchExpenses();
    refetchPayments();
    refetchAttendance?.();
    refetchLeaves?.();
  }, [branchId, type]);

  // Extract arrays for counts & tables
  const salesOrders = Array.isArray((soData as any)?.getSalesOrders) ? (soData as any).getSalesOrders : [];
  const purchaseOrders = Array.isArray((poData as any)?.getPurchaseOrders) ? (poData as any).getPurchaseOrders : [];
  const salesReturns = Array.isArray((srData as any)?.getSalesReturns) ? (srData as any).getSalesReturns : [];
  const purchaseReturns = Array.isArray((prData as any)?.getPurchaseReturns) ? (prData as any).getPurchaseReturns : [];
  const expenseNotes = Array.isArray((expData as any)?.getExpenseNotes) ? (expData as any).getExpenseNotes : [];
  const payments = Array.isArray((payData as any)?.getPayments) ? (payData as any).getPayments : [];
  const attendanceSummary = attData?.getAttendanceSummary;
  const leaveRequests = Array.isArray(leaveData?.getLeaveRequests) ? leaveData.getLeaveRequests : [];

  return (
    <HomeLayout>
      <div className="p-4 space-y-3 bg-gray-100 min-h-screen font-sans">
        {/* Executive Summary Header Bar */}
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Cloud ERP Pulse</span>
            </div>
            <h1 className="text-[13px] font-semibold text-slate-900 leading-tight">
              Business Performance & Operations
            </h1>
            <p className="text-[11px] text-slate-500">
              Real-time multi-branch ledger summary, inventory status, active orders, and workforce attendance.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 self-start md:self-auto text-[12px]">
            <div className="text-right">
              <span className="text-gray-400 uppercase text-[10px] block font-semibold">Role</span>
              <span className="font-bold text-[#2c3e50] capitalize">{type || "Admin"}</span>
            </div>
            <div className="h-5 w-px bg-slate-200"></div>
            <div>
              <span className="text-gray-400 uppercase text-[10px] block font-semibold">Status</span>
              {online ? (
                <span className="font-bold text-emerald-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span> Online
                </span>
              ) : (
                <span className="font-bold text-rose-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Offline
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Section 1: KPI Stats Overview */}
        <StatsCards
          customerData={customerData}
          productData={productData}
          salesInvoiceData={salesInvoiceData}
          purchaseInvoiceData={purchaseInvoiceData}
          transferStockData={transferStockData}
          salesOrders={salesOrders}
          purchaseOrders={purchaseOrders}
          salesReturns={salesReturns}
          purchaseReturns={purchaseReturns}
          expenseNotes={expenseNotes}
          payments={payments}
          attendanceSummary={attendanceSummary}
          leaveRequests={leaveRequests}
          staffData={staffData}
          branchId={branchId}
        />

        {/* Section 2: Comprehensive Analytics */}
        <DashboardCharts
          purchaseInvoiceData={purchaseInvoiceData}
          salesInvoiceData={salesInvoiceData}
          productData={productData}
          transferStockData={transferStockData}
          staffData={staffData}
          categoryData={categoryData}
          transactionData={transactionData}
          salesOrders={salesOrders}
          purchaseOrders={purchaseOrders}
          salesReturns={salesReturns}
          purchaseReturns={purchaseReturns}
          attendanceSummary={attendanceSummary}
          leaveRequests={leaveRequests}
          branchId={branchId}
        />

        {/* Section 3: Multi-Module Recent Activity Tables */}
        <RecentOrders
          salesInvoiceData={salesInvoiceData}
          customerData={customerData}
          purchaseInvoiceData={purchaseInvoiceData}
          salesOrders={salesOrders}
          purchaseOrders={purchaseOrders}
          salesReturns={salesReturns}
          purchaseReturns={purchaseReturns}
          transferStockData={transferStockData}
          expenseNotes={expenseNotes}
          payments={payments}
          leaveRequests={leaveRequests}
          branchesData={branchesData}
          productData={productData}
        />
      </div>
    </HomeLayout>
  );
};

export default Home;
