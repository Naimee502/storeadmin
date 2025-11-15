import React, { useEffect, useState, useMemo } from "react";
import HomeLayout from "../../../layouts/home";
import ReportTable, { type ReportFilterField } from "../../../components/reporttable";
import { useSalesInvoicesQuery } from "../../../graphql/hooks/salesinvoice";
import { useSalesmenQuery } from "../../../graphql/hooks/salesmenaccount";
import { useTransactionsQuery } from "../../../graphql/hooks/transactions";
import { applyDateShortcut, normalizeToYMD } from "../../../utils/helper";

const SalesmanReports: React.FC = () => {
  const reportTabs = ["daily", "weekly", "monthly", "yearly"];
  const [activeTab, setActiveTab] = useState<string>("daily");
  const [filters, setFilters] = useState<{ [key: string]: any }>({});
  const [appliedFilters, setAppliedFilters] = useState<{ [key: string]: any }>({});

  // Fetch data
  const { data: salesData } = useSalesInvoicesQuery();
  const { data: salesmenData } = useSalesmenQuery();
  const { data: transactionsData } = useTransactionsQuery();

  const salesInvoices = salesData?.getSalesInvoices || [];
  const salesmen = salesmenData?.getSalesmenAccounts || [];
  const transactions = transactionsData?.getTransactions || [];

  // Initialize default last 30 days filter
  useEffect(() => {
    const today = new Date();
    const to = today.toISOString().slice(0, 10);
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30)
      .toISOString()
      .slice(0, 10);
    setFilters({ fromDate: from, toDate: to });
    setAppliedFilters({ fromDate: from, toDate: to });
  }, []);

  // Filter invoices based on applied filters
  const filteredInvoices = useMemo(() => {
    const from = appliedFilters.fromDate;
    const to = appliedFilters.toDate;

    return salesInvoices.filter((inv) => {
      const date = normalizeToYMD(inv.billdate);
      if (!date) return false;
      if (from && date < from) return false;
      if (to && date > to) return false;
      if (appliedFilters.salesman && inv.salesmenid?.id !== appliedFilters.salesman)
        return false;
      return true;
    });
  }, [salesInvoices, appliedFilters]);

  // Prepare report data
  const reportData = useMemo(() => {
    const map: Record<string, any> = {};

    salesmen.forEach((s) => {
      map[s.id] = {
        ...s,
        totalSales: 0,
        totalInvoices: 0,
        totalCommission: 0,
        target: s.target || 0, // ← use actual target from salesmen data
      };
    });

    filteredInvoices.forEach((inv) => {
      const sid = inv.salesmenid?.id || "unassigned";
      if (!map[sid]) {
        map[sid] = {
          name: "Unassigned",
          totalSales: 0,
          totalInvoices: 0,
          totalCommission: 0,
          target: 0,
        };
      }
      map[sid].totalSales += inv.totalamount || 0;
      map[sid].totalInvoices += 1;
    });

    transactions.forEach((tx) => {
      const txDate = normalizeToYMD(new Date(Number(tx.transactiondate)));
      const from = appliedFilters.fromDate;
      const to = appliedFilters.toDate;
      if ((from && txDate < from) || (to && txDate > to)) return;

      tx.entries.forEach((entry) => {
        const ledgerName = entry.ledgerid?.ledgername || "";
        const credit = Number(entry.credit) || 0;
        const matched = salesmen.find((s) => ledgerName.includes(s.name));
        if (matched) {
          const s = map[matched.id];
          if (s) s.totalCommission += credit;
        }
      });
    });

    return Object.values(map).map((s, idx) => ({
      seqNo: idx + 1,
      salesman: s.name,
      totalSales: (s.totalSales || 0).toFixed(2),
      totalInvoices: s.totalInvoices || 0,
      totalCommission: (s.totalCommission || 0).toFixed(2),
      targetAchievement: s.target
        ? ((s.totalSales / s.target) * 100).toFixed(2) + "%"
        : "-",
      targetAmount: (s.target || 0).toFixed(2),
    }));
  }, [filteredInvoices, salesmen, transactions, appliedFilters]);


  const columns = [
    { label: "Seq No", key: "seqNo" },
    { label: "Salesman Name", key: "salesman" },
    { label: "Total Sales", key: "totalSales" },
    { label: "Total Invoices", key: "totalInvoices" },
    { label: "Commission Earned", key: "totalCommission" },
    { label: "Target Achievement", key: "targetAchievement" },
    { label: "Target Amount", key: "targetAmount" },
  ];

  const salesmenOptions = salesmen.map((s) => ({ label: s.name, value: s.id }));
  const filterFields: ReportFilterField[] = [
    { name: "fromDate", label: "From Date", type: "date" },
    { name: "toDate", label: "To Date", type: "date" },
    { name: "salesman", label: "Salesman", type: "select", options: salesmenOptions, searchable: true },
  ];

  // Handle tab change same as SalesReports
  const handleTabChange = (tab: string) => {
    const { from, to } = applyDateShortcut(tab as "daily" | "weekly" | "monthly" | "yearly");

    const fromYMD = from ? normalizeToYMD(from.split("/").reverse().join("-")) : null;
    const toYMD = to ? normalizeToYMD(to.split("/").reverse().join("-")) : null;

    setFilters((prev) => ({ ...prev, fromDate: fromYMD, toDate: toYMD }));
    setAppliedFilters((prev) => ({ ...prev, fromDate: fromYMD, toDate: toYMD }));
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
