import React, { useEffect, useState, useMemo } from "react";
import HomeLayout from "../../../layouts/home";
import ReportTable, { type ReportFilterField } from "../../../components/reporttable";
import { useSalesInvoicesQuery } from "../../../graphql/hooks/salesinvoice";
import { useSalesmenQuery } from "../../../graphql/hooks/salesmenaccount";

const SalesmanReports: React.FC = () => {
  // Tabs for Daily / Weekly / Monthly
  const reportTabs = ["Daily", "Weekly", "Monthly"];
  const [activeTab, setActiveTab] = useState<string>(reportTabs[0]);
  const [filters, setFilters] = useState<{ [key: string]: any }>({});
  const [appliedFilters, setAppliedFilters] = useState<{ [key: string]: any }>({});

  // Fetch invoices and salesmen
  const { data: salesData } = useSalesInvoicesQuery();
  const { data: salesmenData } = useSalesmenQuery();

  const salesInvoices = salesData?.getSalesInvoices || [];
  const salesmen = salesmenData?.getSalesmenAccounts || [];

  // Default date filters: last 30 days
  useEffect(() => {
    const today = new Date();
    const to = today.toISOString().slice(0, 10);
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30)
      .toISOString()
      .slice(0, 10);
    setFilters({ fromDate: from, toDate: to });
    setAppliedFilters({ fromDate: from, toDate: to });
  }, []);

  const getFilterTimestamps = () => {
    const fromTimestamp = appliedFilters.fromDate
      ? new Date(appliedFilters.fromDate + "T00:00:00").getTime()
      : null;
    const toTimestamp = appliedFilters.toDate
      ? new Date(appliedFilters.toDate + "T23:59:59").getTime()
      : null;
    return { fromTimestamp, toTimestamp };
  };

  // Filter invoices by tab (Daily / Weekly / Monthly)
  const filteredInvoices = useMemo(() => {
    const { fromTimestamp, toTimestamp } = getFilterTimestamps();
    return salesInvoices.filter((inv: any) => {
      const date = Number(inv.invoicedate);
      if (fromTimestamp && date < fromTimestamp) return false;
      if (toTimestamp && date > toTimestamp) return false;
      if (appliedFilters.salesman && inv.salesmanid?._id !== appliedFilters.salesman)
        return false;
      return true;
    });
  }, [salesInvoices, appliedFilters]);

  // Prepare report data per salesman
  const reportData = useMemo(() => {
    const map: Record<string, any> = {};

    filteredInvoices.forEach((inv: any) => {
      const salesmanId = inv.salesmanid?._id || "Unassigned";
      const salesmanName = inv.salesmanid?.name || "Unassigned";

      if (!map[salesmanId]) {
        map[salesmanId] = {
          salesman: salesmanName,
          totalSales: 0,
          totalInvoices: 0,
          totalCommission: 0,
          target: inv.salesmanid?.target || 0,
        };
      }

      map[salesmanId].totalSales += inv.grandtotal || 0;
      map[salesmanId].totalInvoices += 1;
      if (inv.salesmanid?.commission) {
        map[salesmanId].totalCommission +=
          ((inv.salesmanid.commission || 0) / 100) * (inv.grandtotal || 0);
      }
    });

    return Object.values(map).map((r: any, idx) => ({
      seqNo: idx + 1,
      ...r,
      targetAchievement: r.target
        ? ((r.totalSales / r.target) * 100).toFixed(2) + "%"
        : "-",
      totalSales: r.totalSales.toFixed(2),
      totalCommission: r.totalCommission.toFixed(2),
    }));
  }, [filteredInvoices]);

  // Table columns
  const columns = [
    { label: "Seq No", key: "seqNo" },
    { label: "Salesman Name", key: "salesman" },
    { label: "Total Sales", key: "totalSales" },
    { label: "Total Invoices", key: "totalInvoices" },
    { label: "Commission Earned", key: "totalCommission" },
    { label: "Target Achievement", key: "targetAchievement" },
  ];

  // Filter fields
  const salesmenOptions = salesmen.map((s) => ({ label: s.name, value: s._id }));
  const filterFields: ReportFilterField[] = [
    { name: "fromDate", label: "From Date", type: "date" },
    { name: "toDate", label: "To Date", type: "date" },
    { name: "salesman", label: "Salesman", type: "select", options: salesmenOptions, searchable: true },
  ];

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
          onTabChange={setActiveTab}
          showExport
          showCsv
        />
      </div>
    </HomeLayout>
  );
};

export default SalesmanReports;
