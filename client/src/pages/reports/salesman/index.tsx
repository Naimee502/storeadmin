import React, { useEffect, useState, useMemo } from "react";
import HomeLayout from "../../../layouts/home";
import ReportTable, { type ReportFilterField } from "../../../components/reporttable";
import { useSalesInvoicesQuery } from "../../../graphql/hooks/salesinvoice";
import { useStaffQuery } from "../../../graphql/hooks/staffaccounts";
import { useTransactionsQuery } from "../../../graphql/hooks/transactions";
import { applyDateShortcut, normalizeToYMD } from "../../../utils/helper";

const SalesmanReports: React.FC = () => {
  const reportTabs = ["daily", "weekly", "monthly", "yearly"];
  const [activeTab, setActiveTab] = useState<string>("daily");
  const [filters, setFilters] = useState<{ [key: string]: any }>({});
  const [appliedFilters, setAppliedFilters] = useState<{ [key: string]: any }>({});

  // Fetch data
  const { data: salesData } = useSalesInvoicesQuery();
  const { data: staffData } = useStaffQuery();
  const { data: transactionsData } = useTransactionsQuery();

  const salesInvoices = salesData?.getSalesInvoices || [];
  const staff = staffData?.getStaffAccounts || [];

  // ✅ Filter only staff with role = salesman
  const salesmen = staff.filter((s: any) => s.role?.toLowerCase() === "salesman");

  const transactions = transactionsData?.getTransactions || [];

  // Debug logs updated
  console.log("📌 Sales Invoices:", JSON.stringify(salesInvoices, null, 2));
  console.log("📌 Salesmen (Filtered):", JSON.stringify(salesmen, null, 2));
  console.log("📌 Transactions:", JSON.stringify(transactions, null, 2));

  // Default last 30 days
  useEffect(() => {
    const today = new Date();
    const to = today.toISOString().slice(0, 10);
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30)
      .toISOString()
      .slice(0, 10);

    setFilters({ fromDate: from, toDate: to });
    setAppliedFilters({ fromDate: from, toDate: to });
  }, []);

  // Filter invoices
  const filteredInvoices = useMemo(() => {
    const from = appliedFilters.fromDate;
    const to = appliedFilters.toDate;

    return salesInvoices.filter((inv) => {
      const date = normalizeToYMD(inv.billdate);
      if (!date) return false;

      if (from && date < from) return false;
      if (to && date > to) return false;

      // Filter by salesman
      if (appliedFilters.salesmenid && inv.salesmenid?.id !== appliedFilters.salesmenid)
        return false;

      return true;
    });
  }, [salesInvoices, appliedFilters]);

  // Generate report data
  const reportData = useMemo(() => {
    // Step 1: Decide which salesmen to include
    const activeSalesmen = appliedFilters.salesmenid
      ? salesmen.filter((s) => s.id === appliedFilters.salesmenid)
      : salesmen;

    // Step 2: Build performance rows for each salesman
    return activeSalesmen.map((s, idx) => {
      const invoices = filteredInvoices.filter(
        (inv) => inv.salesmenid?.id === s.id
      );

      const totalSales = invoices.reduce(
        (sum, inv) => sum + Number(inv.totalamount || 0),
        0
      );

      const totalInvoices = invoices.length;

      const commissionRate = Number(s.commission) || 0;
      const commissionEarned = (totalSales * commissionRate) / 100;

      const target = Number(s.target) || 0;
      const targetAchievement = target > 0
        ? ((totalSales / target) * 100).toFixed(2) + "%"
        : "-";

      return {
        seqNo: idx + 1,
        salesman: s.name,
        totalSales: totalSales.toFixed(2),
        totalInvoices,
        totalCommission: commissionEarned.toFixed(2),
        targetAchievement,
        targetAmount: target.toFixed(2),
      };
    });
  }, [filteredInvoices, salesmen, appliedFilters]);

  // Table Columns
  const columns = [
    { label: "Seq No", key: "seqNo" },
    { label: "Salesman Name", key: "salesman" },
    { label: "Total Sales", key: "totalSales" },
    { label: "Total Invoices", key: "totalInvoices" },
    { label: "Commission Earned", key: "totalCommission" },
    { label: "Target Achievement", key: "targetAchievement" },
    { label: "Target Amount", key: "targetAmount" },
  ];

  // Dropdown options filtered
  const salesmenOptions = salesmen.map((s) => ({ label: s.name, value: s.id }));

  // Filters
  const filterFields: ReportFilterField[] = [
    { name: "fromDate", label: "From Date", type: "date" },
    { name: "toDate", label: "To Date", type: "date" },
    {
      name: "salesmenid",
      label: "Salesman",
      type: "select",
      options: salesmenOptions,
      searchable: true
    },
  ];

  // Tab change handler
  const handleTabChange = (tab: string) => {
    const { from, to } = applyDateShortcut(tab as "daily" | "weekly" | "monthly" | "yearly");

    const fromYMD = from ? normalizeToYMD(from.split("/").reverse().join("-")) : null;
    const toYMD = to ? normalizeToYMD(to.split("/").reverse().join("-")) : null;

    setAppliedFilters((prev) => ({
      ...prev,
      fromDate: fromYMD,
      toDate: toYMD,
      salesmenid: prev.salesmenid,
    }));

    setFilters((prev) => ({
      ...prev,
      fromDate: fromYMD,
      toDate: toYMD
    }));

    setActiveTab(tab);
  };

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <ReportTable
          title="Salesman Performance Report"
          columns={columns}
          data={reportData}
          filterFields={filterFields}
          filters={filters}
          setFilters={setFilters}
          appliedFilters={appliedFilters}
          setAppliedFilters={setAppliedFilters}
          defaultTab={activeTab}
          tabs={reportTabs}
          onTabChange={handleTabChange}
          showExport
          showCsv
        />
      </div>
    </HomeLayout>
  );
};

export default SalesmanReports;
