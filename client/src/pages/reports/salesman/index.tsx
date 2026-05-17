import React, { useEffect, useState, useMemo } from "react";
import HomeLayout from "../../../layouts/home";
import ReportTable, { type ReportFilterField } from "../../../components/reporttable";
import { useSalesInvoicesQuery } from "../../../graphql/hooks/salesinvoice";
import { useStaffQuery } from "../../../graphql/hooks/staffaccounts";
import { normalizeToYMD } from "../../../utils/helper";

const SalesmanReports: React.FC = () => {
  const [filters, setFilters] = useState<{ [key: string]: any }>({});
  const [appliedFilters, setAppliedFilters] = useState<{ [key: string]: any }>({});

  const { data: salesData } = useSalesInvoicesQuery();
  const { data: staffData } = useStaffQuery();

  const salesInvoices = salesData?.getSalesInvoices || [];
  const staff = staffData?.getStaffAccounts || [];

  // All staff who can take orders (salesman role or any staff)
  const salesmen = staff.filter(
    (s: any) =>
      s.role?.toLowerCase() === "salesman" ||
      s.role?.toLowerCase() === "staff"
  );

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

  // Filter invoices by date range + optional staff filter
  const filteredInvoices = useMemo(() => {
    const from = appliedFilters.fromDate;
    const to = appliedFilters.toDate;

    return salesInvoices.filter((inv) => {
      const date = normalizeToYMD(inv.billdate);
      if (!date) return false;
      if (from && date < from) return false;
      if (to && date > to) return false;
      if (appliedFilters.salesmenid && inv.salesmenid?.id !== appliedFilters.salesmenid)
        return false;
      return true;
    });
  }, [salesInvoices, appliedFilters]);

  // Build one row per staff member
  const reportData = useMemo(() => {
    const activeSalesmen = appliedFilters.salesmenid
      ? salesmen.filter((s: any) => s.id === appliedFilters.salesmenid)
      : salesmen;

    return activeSalesmen.map((s: any, idx: number) => {
      const invoices = filteredInvoices.filter((inv) => inv.salesmenid?.id === s.id);
      const totalSales = invoices.reduce((sum, inv) => sum + Number(inv.totalamount || 0), 0);
      const totalInvoices = invoices.length;
      const commissionRate = Number(s.commission) || 0;
      const commissionEarned = (totalSales * commissionRate) / 100;
      const target = Number(s.target) || 0;
      const targetAchievement = target > 0
        ? ((totalSales / target) * 100).toFixed(2) + "%"
        : "-";

      return {
        seqNo: idx + 1,
        staffName: s.name,
        role: s.role
          ? s.role.charAt(0).toUpperCase() + s.role.slice(1).toLowerCase()
          : "-",
        totalSales: totalSales.toFixed(2),
        totalInvoices,
        totalCommission: commissionEarned.toFixed(2),
        targetAchievement,
        targetAmount: target.toFixed(2),
      };
    });
  }, [filteredInvoices, salesmen, appliedFilters]);

  const columns = [
    { label: "Seq No", key: "seqNo" },
    { label: "Staff Name", key: "staffName" },
    { label: "Role", key: "role" },
    { label: "Total Sales (₹)", key: "totalSales", numeric: true },
    { label: "Total Invoices", key: "totalInvoices", numeric: true },
    { label: "Commission Earned (₹)", key: "totalCommission", numeric: true },
    { label: "Target Achievement", key: "targetAchievement" },
    { label: "Target Amount (₹)", key: "targetAmount", numeric: true },
  ];

  const staffOptions = salesmen.map((s: any) => ({ label: s.name, value: s.id }));

  const filterFields: ReportFilterField[] = [
    { name: "fromDate", label: "From Date", type: "date" },
    { name: "toDate", label: "To Date", type: "date" },
    {
      name: "salesmenid",
      label: "Staff Member",
      type: "select",
      options: staffOptions,
      searchable: true,
    },
  ];

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <ReportTable
          title="Staff Performance Report"
          columns={columns}
          data={reportData}
          filterFields={filterFields}
          filters={filters}
          setFilters={setFilters}
          appliedFilters={appliedFilters}
          setAppliedFilters={setAppliedFilters}
          showExport
          showCsv
          showPdf
          exportFileName="StaffReport"
          showTotals
        />
      </div>
    </HomeLayout>
  );
};

export default SalesmanReports;
