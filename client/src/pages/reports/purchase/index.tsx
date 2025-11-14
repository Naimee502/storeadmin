import React, { useEffect, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { addPurchaseInvoices } from "../../../redux/slices/purchaseinvoice";
import HomeLayout from "../../../layouts/home";
import { showLoading, hideLoading } from "../../../redux/slices/loader";
import { usePurchaseInvoicesQuery, useDeletedPurchaseInvoicesQuery } from "../../../graphql/hooks/purchaseinvoice";
import { useAccountsQuery } from "../../../graphql/hooks/accounts";
import { useProductServicesQuery } from "../../../graphql/hooks/products";
import PrintableInvoice from "../../../components/printinvoice";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import type { ReportFilterField } from "../../../components/reporttable";
import ReportTable from "../../../components/reporttable";
import { normalizeToDMY, applyDateShortcut, normalizeToYMD } from "../../../utils/helper";

const PurchaseReports: React.FC = () => {
  const dispatch = useAppDispatch();
  const isLoading = useAppSelector((state) => state.loader.isLoading);

  // -----------------------
  // Queries
  // -----------------------
  const { data: activeData, refetch: refetchActive } = usePurchaseInvoicesQuery();
  const { data: deletedData, refetch: refetchDeleted } = useDeletedPurchaseInvoicesQuery();
  const activeInvoices = activeData?.getPurchaseInvoices || [];
  const deletedInvoices = deletedData?.getDeletedPurchaseInvoices || [];

  console.log("Active Invoices:", JSON.stringify(activeInvoices, null, 2));

  const { data: accountData } = useAccountsQuery();
  const accountsList = accountData?.getAccounts || [];

  const { data: productData } = useProductServicesQuery();
  const productList = productData?.getProductServices ?? [];

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
  // Initialize date filter
  // -----------------------
  useEffect(() => {
    const today = new Date();
    const to = today.toISOString().slice(0, 10);
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30)
      .toISOString()
      .slice(0, 10);
    setFilters({ fromDate: from, toDate: to });
    setAppliedFilters({ fromDate: from, toDate: to });
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
          const invoices = isDeleted ? data.getDeletedPurchaseInvoices : data.getPurchaseInvoices;
          dispatch(addPurchaseInvoices(invoices));
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
  const invoiceList =
    appliedFilters.status === "Inactive"
      ? deletedInvoices
      : appliedFilters.status === "Active"
        ? activeInvoices
        : [...activeInvoices, ...deletedInvoices];

  const tableDataRaw = invoiceList.map((inv, idx) => {
    const totalqty = inv.productservice?.reduce((s: number, p: any) => s + (p.qty ?? 0), 0) ?? 0;

    // --- Party Account formatted ---
    // inv.partyacc might be an object { id, accountname, mobile }
    const partyAccObj = accountsList.find(
      (a) => a.id === (inv.partyacc?.id || inv.partyacc)
    );
    const partyaccStr = partyAccObj
      ? `${partyAccObj.accountname || partyAccObj.name} - ${partyAccObj.mobile || ""}`
      : inv.partyacc?.accountname
        ? `${inv.partyacc.accountname} - ${inv.partyacc.mobile || ""}`
        : "Unknown";

    // --- Products formatted ---
    const productNames = (inv.productservice ?? [])
      .map((p: any) => {
        const prodName =
          productList.find((pr) => pr.id === (p.productserviceid?.id || p.productserviceid))?.name ||
          p.productserviceid?.name ||
          "Unknown";
        const variantName = p.variantid?.name ? ` - ${p.variantid.name}` : "";
        return `${prodName}${variantName}`;
      })
      .join(", ");

    const productIds = (inv.productservice ?? []).map(
      (p: any) => p.productserviceid?.id || p.productserviceid
    );

    // --- Billing No ---
    const billtypeCap = inv.billtype ? inv.billtype.charAt(0).toUpperCase() + inv.billtype.slice(1) : "";
    const billNoStr = `${billtypeCap}-${inv.billnumber}`;

    return {
      ...inv,
      seqNo: idx + 1,
      totalitem: inv.productservice?.length ?? 0,
      totalqty,
      billtype_billnumber: billNoStr,
      status: inv.status ? "Active" : "Inactive",
      partyaccId: partyAccObj?.id || inv.partyacc?.id || "Unknown",
      partyacc: partyaccStr,
      productname: productNames,
      productIds,
      billdate: normalizeToYMD(inv.billdate) || "",
      paymenttype: inv.paymenttype ? inv.paymenttype.charAt(0).toUpperCase() + inv.paymenttype.slice(1) : "",
    };
  });

  // -----------------------
  // Apply filters
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
    if (appliedFilters.fromDate && typeof rowDate === "string") ok = ok && rowDate >= appliedFilters.fromDate;
    if (appliedFilters.toDate && typeof rowDate === "string") ok = ok && rowDate <= appliedFilters.toDate;

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
    {
      name: "partyacc",
      label: "Party A/c",
      type: "select",
      options: accountsList.map((a) => ({ label: a.accountname || a.name, value: a.id })),
      searchable: true,
    },
    {
      name: "productIds",
      label: "Product",
      type: "select",
      options: productList.map((p) => ({ label: p.name, value: p.id })),
      searchable: true,
    },
    { name: "fromDate", label: "From Date", type: "date" },
    { name: "toDate", label: "To Date", type: "date" },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: [
        { label: "Active", value: "Active" },
        { label: "Inactive", value: "Inactive" },
      ],
    },
  ];

  // -----------------------
  // Export functions
  // -----------------------
  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(tableData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PurchaseReport");
    XLSX.writeFile(wb, "PurchaseReport.xlsx");
  };

  const exportCSV = () => {
    const csv = Papa.unparse(tableData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "PurchaseReport.csv");
    link.click();
  };

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <ReportTable
          title="Purchase Reports"
          columns={columns}
          data={tableData}
          filterFields={mappedFilterFields}
          filters={filters}
          setFilters={setFilters}
          appliedFilters={appliedFilters}
          setAppliedFilters={setAppliedFilters}
          defaultTab={activeTab}
          tabs={reportTabs}
          onTabChange={(tab) => {
            const { from, to } = applyDateShortcut(tab as "daily" | "weekly" | "monthly" | "yearly");

            const fromYMD = from ? normalizeToYMD(from.split("/").reverse().join("-")) : null;
            const toYMD = to ? normalizeToYMD(to.split("/").reverse().join("-")) : null;

            setFilters((prev) => ({
              ...prev,
              fromDate: fromYMD,
              toDate: toYMD,
            }));

            setAppliedFilters((prev) => ({
              ...prev,
              fromDate: fromYMD,
              toDate: toYMD,
            }));

            setActiveTab(tab as "daily" | "weekly" | "monthly" | "yearly");
          }}
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

export default PurchaseReports;
