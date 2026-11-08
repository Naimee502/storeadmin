import React, { useEffect, useState, useMemo } from "react";
import HomeLayout from "../../../layouts/home";
import ReportTable, { type ReportFilterField } from "../../../components/reporttable";
import { useQuery } from "@apollo/client";
import { useAppSelector } from "../../../redux/hooks";
import { SALESMAN_REPORT_SALES_INVOICES } from "../../../graphql/queries/reports/salesman";
import { useStaffQuery } from "../../../graphql/hooks/staffaccounts";
import { normalizeToYMD, todayYMD, shiftDaysYMD } from "../../../utils/helper";

const SalesmanReports: React.FC = () => {
  // Start on the default range so the first fetch is already ranged, not all-time.
  const [filters, setFilters] = useState<{ [key: string]: any }>(() => ({ fromDate: shiftDaysYMD(-30), toDate: todayYMD() }));
  const [appliedFilters, setAppliedFilters] = useState<{ [key: string]: any }>(() => ({ fromDate: shiftDaysYMD(-30), toDate: todayYMD() }));

  // Same adminid/branchid scoping as useSalesInvoicesQuery.
  const { type, admin, branch, staff: authStaff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);
  const adminid = type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? authStaff?.admin?.id : undefined;
  const branchid = type === 'admin' ? selectedBranchId : type === 'branch' ? branch?.id : type === 'staff' ? authStaff?.branchid?.id : undefined;
  const { data: salesData } = useQuery(SALESMAN_REPORT_SALES_INVOICES, {
    variables: {
      // Server ranges invoices by billdate; the client date filter is a safety net.
      filter: {
        adminid,
        branchid,
        ...(appliedFilters.fromDate ? { billdateFrom: appliedFilters.fromDate } : {}),
        ...(appliedFilters.toDate ? { billdateTo: appliedFilters.toDate } : {}),
      },
    },
  });
  const { data: staffData } = useStaffQuery();

  // Cancelled bills are reversed out of the books — same default as the hook.
  const salesInvoices: any[] = useMemo(
    () => (salesData?.getSalesInvoices || []).filter((i: any) => i?.cancelStatus !== "cancelled"),
    [salesData]
  );

  // All staff who can take orders (salesman role or any staff)
  const salesmen = useMemo(
    () =>
      [...(staffData?.getStaffAccounts || [])].reverse().filter(
        (s: any) =>
          s.role?.toLowerCase() === "salesman" ||
          s.role?.toLowerCase() === "staff"
      ),
    [staffData]
  );

  // Default last 30 days
  useEffect(() => {
    const to = todayYMD();
    const from = shiftDaysYMD(-30);
    setFilters({ fromDate: from, toDate: to });
    setAppliedFilters({ fromDate: from, toDate: to });
  }, []);

  // Filter invoices by date range + optional staff filter
  const filteredInvoices = useMemo(() => {
    const from = appliedFilters.fromDate;
    const to = appliedFilters.toDate;

    return salesInvoices.filter((inv: any) => {
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
      const invoices = filteredInvoices.filter((inv: any) => inv.salesmenid?.id === s.id);
      const totalSales = invoices.reduce((sum: number, inv: any) => sum + Number(inv.totalamount || 0), 0);
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
      <div className="w-full p-4">
        <ReportTable moduleId="reports.salesmen"
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
