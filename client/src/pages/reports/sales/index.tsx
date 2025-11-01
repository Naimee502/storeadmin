import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { addSalesInvoices } from "../../../redux/slices/salesinvoice";
import HomeLayout from "../../../layouts/home";
import { showLoading, hideLoading } from "../../../redux/slices/loader";
import { useSalesInvoicesQuery, useDeletedSalesInvoicesQuery } from "../../../graphql/hooks/salesinvoice";
import { useAccountsQuery } from "../../../graphql/hooks/accounts";
import { useProductServicesQuery } from "../../../graphql/hooks/products";
import PrintableInvoice from "../../../components/printinvoice";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import type { ReportFilterField } from "../../../components/reporttable";
import ReportTable from "../../../components/reporttable";

const SalesReports: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const isLoading = useAppSelector((state) => state.loader.isLoading);

  // -----------------------
  // Queries
  // -----------------------
  const { data: activeData, refetch: refetchActive } = useSalesInvoicesQuery();
  const { data: deletedData, refetch: refetchDeleted } = useDeletedSalesInvoicesQuery();
  const activeInvoices = activeData?.getSalesInvoices || [];
  const deletedInvoices = deletedData?.getDeletedSalesInvoices || [];

  const { data: accountData } = useAccountsQuery();
  const accountsList = accountData?.getAccounts || [];
  const accountsMap = new Map(accountsList.map((acc) => [acc.id, acc]));

  const { data: productData } = useProductServicesQuery();
  const productList = productData?.getProductServices ?? [];
  const productMap = new Map(productList.map((p) => [p.id, p.name]));

  // -----------------------
  // Printable
  // -----------------------
  const componentRef = useRef<HTMLDivElement>(null);
  const [printInvoice, setPrintInvoice] = useState<any>(null);

  // -----------------------
  // Filters & Tabs
  // -----------------------
  const [filters, setFilters] = useState<{ [key: string]: any }>({});
  const [appliedFilters, setAppliedFilters] = useState<{ [key: string]: any }>({});
  const [activeTab, setActiveTab] = useState<"daily" | "weekly" | "monthly" | "yearly">("daily");

  const reportTabs = ["daily", "weekly", "monthly", "yearly"];

  // -----------------------
  // Date helper
  // -----------------------
  const normalizeToYMD = (val: any): string | null => {
    if (!val && val !== 0) return null;
    if (typeof val === "string") return val.slice(0, 10);
    const dt = val instanceof Date ? val : new Date(val);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  };

  const applyDateShortcut = (type: "daily" | "weekly" | "monthly" | "yearly") => {
    const today = new Date();
    const to = normalizeToYMD(today);
    let from: string | null = to;

    if (type === "weekly") {
      const f = new Date();
      f.setDate(today.getDate() - 6);
      from = normalizeToYMD(f);
    } else if (type === "monthly") {
      const f = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
      from = normalizeToYMD(f);
    } else if (type === "yearly") {
      const f = new Date(today.getFullYear(), 0, 1); // Jan 1 of this year
      from = normalizeToYMD(f);
    }

    setFilters((prev) => ({ ...prev, fromDate: from, toDate: to }));
    setAppliedFilters((prev) => ({ ...prev, fromDate: from, toDate: to }));
    setActiveTab(type);
  };

  useEffect(() => {
    applyDateShortcut("daily");
  }, []);

  // -----------------------
  // Refetch invoices
  // -----------------------
  useEffect(() => {
    const fetchInvoices = async () => {
      dispatch(showLoading());
      try {
        const status = appliedFilters.status;
        const isDeleted = status === "Inactive";
        const { data } = await (isDeleted ? refetchDeleted() : refetchActive());
        if (data) {
          const invoices = isDeleted ? data.getDeletedSalesInvoices : data.getSalesInvoices;
          dispatch(addSalesInvoices(invoices));
        }
      } catch (error) {
        console.error(error);
      } finally {
        dispatch(hideLoading());
      }
    };
    fetchInvoices();
  }, [dispatch, appliedFilters.status, refetchActive, refetchDeleted]);

  // -----------------------
  // Build table rows
  // -----------------------
  let invoiceList = [];
  if (appliedFilters.status === "Inactive") {
    invoiceList = deletedInvoices;
  } else if (appliedFilters.status === "Active") {
    invoiceList = activeInvoices;
  } else {
    invoiceList = [...activeInvoices, ...deletedInvoices];
  }

  const tableDataRaw = invoiceList.map((inv, idx) => {
    const totalqty = inv.productservice?.reduce((s: number, p: any) => s + (p.qty || 0), 0) ?? 0;
    const account = accountsMap.get(inv.partyacc);
    const productIds = (inv.productservice ?? []).map((p: any) => p.productserviceid);
    const productname = productIds.map((id) => productMap.get(id) || "Unknown").join(", ");
    return {
      ...inv,
      seqNo: idx + 1,
      totalitem: inv.productservice?.length ?? 0,
      totalqty,
      billtype_billnumber: `${inv.billtype}-${inv.billnumber}`,
      status: inv.status ? "Active" : "Inactive",
      partyaccId: inv.partyacc,
      partyacc: account ? `${account.name} - ${account.mobile}` : inv.partyacc,
      productname,
      productIds,
      billdate: normalizeToYMD(inv.billdate) || "",
    };
  });

  // -----------------------
  // Apply filters safely
  // -----------------------
  const tableData = tableDataRaw.filter((row) => {
    let ok = true;

    if (appliedFilters.partyacc) ok = ok && row.partyaccId === appliedFilters.partyacc;

    const pf = appliedFilters.productIds;
    if (pf) {
      if (Array.isArray(pf) && pf.length > 0) {
        const selected = pf.map((p: any) => (typeof p === "string" ? p : p.value ?? p));
        ok = ok && row.productIds.some((id) => selected.includes(id));
      } else if (typeof pf === "string") {
        ok = ok && row.productIds.includes(pf);
      } else if (typeof pf === "object" && pf.value) {
        ok = ok && row.productIds.includes(pf.value);
      }
    }

    if (appliedFilters.status) ok = ok && row.status === appliedFilters.status;

    const rowDate = row.billdate;
    const from = appliedFilters.fromDate;
    const to = appliedFilters.toDate;
    if (from && typeof rowDate === "string") ok = ok && rowDate >= from;
    if (to && typeof rowDate === "string") ok = ok && rowDate <= to;

    return ok;
  });

  // -----------------------
  // Table columns & filters
  // -----------------------
  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "Payment Type", key: "paymenttype" },
    { label: "Party A/c", key: "partyacc" },
    { label: "Product(s)", key: "productname" },
    { label: "Total Items", key: "totalitem" },
    { label: "Total Qty", key: "totalqty" },
    { label: "Billing Date", key: "billdate" },
    { label: "Billing No", key: "billtype_billnumber" },
    { label: "Total Amount", key: "totalamount" },
    { label: "Status", key: "status" },
  ];

  const mappedFilterFields: ReportFilterField[] = [
    { name: "partyacc", label: "Party A/c", type: "select", options: accountsList.map((a) => ({ label: a.name, value: a.id })), searchable: true },
    { name: "productIds", label: "Product", type: "select", options: productList.map((p) => ({ label: p.name, value: p.id })), searchable: true },
    { name: "fromDate", label: "From Date", type: "date" },
    { name: "toDate", label: "To Date", type: "date" },
    { name: "status", label: "Status", type: "select", options: [{ label: "Active", value: "Active" }, { label: "Inactive", value: "Inactive" }] },
  ];

  // -----------------------
  // Export functions
  // -----------------------
  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(tableData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SalesReport");
    XLSX.writeFile(wb, "SalesReport.xlsx");
  };

  const exportCSV = () => {
    const csv = Papa.unparse(tableData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "SalesReport.csv");
    link.click();
  };

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <ReportTable
          title="Sales Reports"
          columns={columns}
          data={tableData}
          filterFields={mappedFilterFields}
          filters={filters}
          setFilters={setFilters}
          appliedFilters={appliedFilters}
          setAppliedFilters={setAppliedFilters}
          defaultTab={activeTab}
          tabs={reportTabs} // dynamic tabs
          onTabChange={(tab) => applyDateShortcut(tab as "daily" | "weekly" | "monthly" | "yearly")}
          showExport
          showCsv
          onExport={exportExcel}
          onCsvExport={exportCSV}
          isLoading={isLoading}
        />

        {printInvoice && (
          <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
            <PrintableInvoice ref={componentRef} invoice={printInvoice} />
          </div>
        )}
      </div>
    </HomeLayout>
  );
};

export default SalesReports;
