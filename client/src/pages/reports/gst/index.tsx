import React, { useEffect, useState, useMemo } from "react";
import HomeLayout from "../../../layouts/home";
import ReportTable, { type ReportFilterField } from "../../../components/reporttable";
import { formatDateDMY, todayYMD, shiftDaysYMD } from "../../../utils/helper";
import { FaCalculator, FaMoneyCheckAlt, FaFileInvoiceDollar, FaBoxes, FaFileAlt, FaFileContract } from "react-icons/fa";

import { useAccountsQuery } from "../../../graphql/hooks/accounts";
import { useQuery } from "@apollo/client";
import { useAppSelector } from "../../../redux/hooks";
import {
  GST_REPORT_SALES_INVOICES,
  GST_REPORT_PURCHASE_INVOICES,
  GST_REPORT_TRANSACTIONS,
} from "../../../graphql/queries/reports/gst";
import { PRODUCT_REPORT_PRODUCT_OPTIONS } from "../../../graphql/queries/reports/product";
import { isCustomerParty, isVendorParty } from "../../../utils/partytype";
import { partyLabel } from "../../../utils/partylabel";

// Tabs that read sales / purchase invoices — the other side is not fetched.
const SALES_TABS = ["GST Summary", "GST Receivable", "GST by Product", "GSTR-1"];
const PURCHASE_TABS = ["GST Payable", "GST by Product", "GSTR-2"];

/** "YYYY-MM-DD" shifted by n days (UTC, no timezone drift). */
const shiftYMD = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  if (isNaN(d.getTime())) return undefined;
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const reportTabsObj = [
  { id: "GST Summary", label: "GST Summary", icon: <FaCalculator className="text-xs text-blue-600" /> },
  { id: "GST Payable", label: "GST Payable", icon: <FaMoneyCheckAlt className="text-xs text-amber-600" /> },
  { id: "GST Receivable", label: "GST Receivable", icon: <FaFileInvoiceDollar className="text-xs text-emerald-600" /> },
  { id: "GST by Product", label: "GST by Product", icon: <FaBoxes className="text-xs text-purple-600" /> },
  { id: "GSTR-1", label: "GSTR-1", icon: <FaFileAlt className="text-xs text-rose-600" /> },
  { id: "GSTR-2", label: "GSTR-2", icon: <FaFileContract className="text-xs text-indigo-600" /> },
];

const GSTReports: React.FC = () => {
  const [activeTab, setActiveTab] = useState(reportTabsObj[0].id);
  // Seed the default range on first render so date-scoped queries never run unfiltered.
  const [filters, setFilters] = useState<any>(() => ({ fromDate: shiftDaysYMD(-30), toDate: todayYMD() }));
  const [appliedFilters, setAppliedFilters] = useState<any>(() => ({ fromDate: shiftDaysYMD(-30), toDate: todayYMD() }));

  const { data: accountsData } = useAccountsQuery();

  // Same adminid/branchid scoping as useSalesInvoicesQuery & co.
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);
  const adminid = type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;
  const branchid = type === 'admin' ? selectedBranchId : type === 'branch' ? branch?.id : type === 'staff' ? staff?.branchid?.id : undefined;

  const needSales = SALES_TABS.includes(activeTab);
  const needPurchase = PURCHASE_TABS.includes(activeTab);

  // Lite invoice lists for the active tab only (see queries/reports/gst.ts for dates).
  const { data: salesData } = useQuery(GST_REPORT_SALES_INVOICES, {
    variables: {
      // Server ranges invoices by billdate; the client date filter is a safety net.
      filter: {
        adminid,
        branchid,
        ...(appliedFilters.fromDate ? { billdateFrom: appliedFilters.fromDate } : {}),
        ...(appliedFilters.toDate ? { billdateTo: appliedFilters.toDate } : {}),
      },
    },
    skip: !needSales,
  });
  const { data: purchaseData } = useQuery(GST_REPORT_PURCHASE_INVOICES, {
    variables: {
      // Server ranges invoices by billdate; the client date filter is a safety net.
      filter: {
        adminid,
        branchid,
        ...(appliedFilters.fromDate ? { billdateFrom: appliedFilters.fromDate } : {}),
        ...(appliedFilters.toDate ? { billdateTo: appliedFilters.toDate } : {}),
      },
    },
    skip: !needPurchase,
  });
  // Product picker only on "GST by Product".
  const { data: productData } = useQuery(PRODUCT_REPORT_PRODUCT_OPTIONS, {
    variables: { filter: { adminid, branchid, status: true }, limit: 0, offset: 0 },
    skip: !adminid || activeTab !== "GST by Product",
    fetchPolicy: "cache-and-network",
  });
  // Journals for the date range plus a day each side; matched by source document id.
  const trxDateFrom = appliedFilters.fromDate ? shiftYMD(appliedFilters.fromDate, -1) : undefined;
  const trxDateToDay = appliedFilters.toDate ? shiftYMD(appliedFilters.toDate, 1) : undefined;
  const { data: transactionsData } = useQuery(GST_REPORT_TRANSACTIONS, {
    variables: {
      filter: {
        adminid,
        branchid,
        dateFrom: trxDateFrom,
        dateTo: trxDateToDay ? `${trxDateToDay}T23:59:59.999Z` : undefined,
      },
    },
    fetchPolicy: "cache-and-network",
  });

  const accounts = accountsData?.getAccounts || [];
  // Cancelled bills are reversed out of the books — same default as the hooks.
  const salesInvoices = useMemo(
    () => [...(salesData?.getSalesInvoices || [])].filter((i: any) => i?.cancelStatus !== "cancelled").reverse(),
    [salesData]
  );
  const purchaseInvoices = useMemo(
    () => [...(purchaseData?.getPurchaseInvoices || [])].filter((i: any) => i?.cancelStatus !== "cancelled").reverse(),
    [purchaseData]
  );
  const products: any[] = useMemo(() => productData?.getProductServices || [], [productData]);

  // Default Date Range
  useEffect(() => {
    const to = todayYMD();
    const from = shiftDaysYMD(-30);

    setFilters({ fromDate: from, toDate: to });
    setAppliedFilters({ fromDate: from, toDate: to });
  }, []);

  // GST From Transactions

  const gstFromTransactions = useMemo(() => {
    const map: any = {};

    (transactionsData?.getTransactions || []).forEach((trx: any) => {
      const sourceId = trx?.source?.docid;
      if (!sourceId) return;

      if (!map[sourceId]) {
        map[sourceId] = { cgst: 0, sgst: 0, igst: 0, totalgst: 0 };
      }

      trx.entries.forEach((e: any) => {
        const name = e.ledgerid?.ledgername;
        const amount = Number(e.debit || e.credit || 0);

        if (name === "Input CGST" || name === "Output CGST") map[sourceId].cgst += amount;
        if (name === "Input SGST" || name === "Output SGST") map[sourceId].sgst += amount;
        if (name === "Input IGST" || name === "Output IGST") map[sourceId].igst += amount;
      });

      map[sourceId].totalgst =
        map[sourceId].cgst + map[sourceId].sgst + map[sourceId].igst;
    });

    return map;
  }, [transactionsData]);

  // Product Mapping (Correct)

  const mapInvoiceProducts = (
    invProducts: any[],
    trxGST: any,
    invoiceTaxable: number,
    invoiceTotal: number
  ) => {
    return invProducts.map((ps: any) => {
      const productTotal = Number(ps.amount || 0);
      const productTaxable =
        invoiceTotal > 0 ? (invoiceTaxable * productTotal) / invoiceTotal : 0;

      const product = products.find(
        (p: any) => p.id === ps.productserviceid?.id
      );

      return {
        productId: product?.id || ps.productserviceid?.id,
        productName: product?.name || ps.productserviceid?.name || "Unknown",
        quantity: ps.qty || 0,
        taxable: productTaxable,
        cgst: trxGST.cgst / invProducts.length,
        sgst: trxGST.sgst / invProducts.length,
        igst: trxGST.igst / invProducts.length,
        totalGst: trxGST.totalgst / invProducts.length,
      };
    });
  };

  // GST Sales Report

  const gstSalesReport = useMemo(() => {
    return salesInvoices
      .filter((inv: any) => {
        const from = appliedFilters.fromDate ? new Date(appliedFilters.fromDate) : null;
        const to = appliedFilters.toDate ? new Date(appliedFilters.toDate) : null;

        const d = new Date(inv.billdate);

        if (from && d < from) return false;
        if (to && d > to) return false;

        if (appliedFilters.customer) {
          if (inv.partyacc?.accountname !== appliedFilters.customer) return false;
        }

        return true;
      })
      .map((inv: any) => {
        const trxGST = gstFromTransactions[inv.id] || {
          cgst: 0,
          sgst: 0,
          igst: 0,
          totalgst: 0,
        };

        const taxable =
          Number(inv.totalamount || 0) - Number(trxGST.totalgst || 0);

        return {
          invoiceNo: inv.billnumber,
          invoiceDate: formatDateDMY(inv.billdate),
          partyName: partyLabel(inv.partyacc),
          gstin: inv.partyacc?.gstnumber || "",
          taxable,
          cgst: trxGST.cgst,
          sgst: trxGST.sgst,
          igst: trxGST.igst,
          totalGst: trxGST.totalgst,
          totalAmount: inv.totalamount || 0,

          products: mapInvoiceProducts(
            inv.productservice,
            trxGST,
            taxable,
            inv.totalamount
          ),
        };
      });
  }, [salesInvoices, appliedFilters, gstFromTransactions, products]);

  // GST Purchase Report

  const gstPurchaseReport = useMemo(() => {
    return purchaseInvoices
      .filter((inv: any) => {
        const from = appliedFilters.fromDate ? new Date(appliedFilters.fromDate) : null;
        const to = appliedFilters.toDate ? new Date(appliedFilters.toDate) : null;

        const d = new Date(inv.billdate);

        if (from && d < from) return false;
        if (to && d > to) return false;

        if (appliedFilters.vendor) {
          if (inv.partyacc?.accountname !== appliedFilters.vendor) return false;
        }

        return true;
      })
      .map((inv: any) => {
        const trxGST = gstFromTransactions[inv.id] || {
          cgst: 0,
          sgst: 0,
          igst: 0,
          totalgst: 0,
        };

        const taxable =
          Number(inv.totalamount || 0) - Number(trxGST.totalgst || 0);

        return {
          invoiceNo: inv.billnumber,
          invoiceDate: formatDateDMY(inv.billdate),
          partyName: partyLabel(inv.partyacc),
          gstin: inv.partyacc?.gstnumber || "",
          taxable,
          cgst: trxGST.cgst,
          sgst: trxGST.sgst,
          igst: trxGST.igst,
          totalGst: trxGST.totalgst,
          totalAmount: inv.totalamount || 0,

          products: mapInvoiceProducts(
            inv.productservice,
            trxGST,
            taxable,
            inv.totalamount
          ),
        };
      });
  }, [purchaseInvoices, appliedFilters, gstFromTransactions, products]);

  // GSTR-1

  const gstr1 = useMemo(() => gstSalesReport.map((r: any) => ({
    invoiceNo: r.invoiceNo,
    invoiceDate: r.invoiceDate,
    customer: r.partyName,
    gstin: r.gstin,
    taxable: r.taxable,
    cgst: r.cgst,
    sgst: r.sgst,
    igst: r.igst,
    totalGst: r.totalGst,
    invoiceAmount: r.totalAmount,
  })), [gstSalesReport]);

  // GSTR-2

  const gstr2 = useMemo(() => gstPurchaseReport.map((r: any) => ({
    invoiceNo: r.invoiceNo,
    invoiceDate: r.invoiceDate,
    vendor: r.partyName,
    gstin: r.gstin,
    taxable: r.taxable,
    cgst: r.cgst,
    sgst: r.sgst,
    igst: r.igst,
    totalGst: r.totalGst,
    invoiceAmount: r.totalAmount,
  })), [gstPurchaseReport]);

  // Filter dropdown options

  const customerOptions = accounts
    .filter((a) => isCustomerParty(a.type))
    .map((a) => ({
      label: a.name,
      value: a.name,
    }));

  const vendorOptions = accounts
    .filter((a) => isVendorParty(a.type))
    .map((a) => ({
      label: a.name,
      value: a.name,
    }));

  const productOptions = products.map((p: any) => ({
    label: p.name,
    value: p.id,
  }));

  // Table Data

  let tableData: any[] = [];
  let columns: any[] = [];
  let filterFields: ReportFilterField[] = [];

  switch (activeTab) {
    case "GST Summary":
    case "GST Receivable":
      tableData = gstSalesReport;
      columns = [
        { label: "Invoice No", key: "invoiceNo" },
        { label: "Date", key: "invoiceDate" },
        { label: "Customer", key: "partyName" },
        { label: "Taxable (₹)", key: "taxable", numeric: true },
        { label: "CGST (₹)", key: "cgst", numeric: true },
        { label: "SGST (₹)", key: "sgst", numeric: true },
        { label: "Total GST (₹)", key: "totalGst", numeric: true },
      ];

      filterFields.push({
        name: "customer",
        label: "Customer",
        type: "select",
        options: customerOptions,
        searchable: true,
      });
      break;

    case "GST Payable":
      tableData = gstPurchaseReport;
      columns = [
        { label: "Invoice No", key: "invoiceNo" },
        { label: "Date", key: "invoiceDate" },
        { label: "Vendor", key: "partyName" },
        { label: "Taxable (₹)", key: "taxable", numeric: true },
        { label: "CGST (₹)", key: "cgst", numeric: true },
        { label: "SGST (₹)", key: "sgst", numeric: true },
        { label: "Total GST (₹)", key: "totalGst", numeric: true },
      ];

      filterFields.push({
        name: "vendor",
        label: "Vendor",
        type: "select",
        options: vendorOptions,
        searchable: true,
      });
      break;

    case "GST by Product":
      tableData = gstSalesReport
        .concat(gstPurchaseReport)
        .flatMap((inv:any) => inv.products)
        .filter(
          (p:any) =>
            !appliedFilters.product ||
            p.productId === appliedFilters.product
        );

      columns = [
        { label: "Product", key: "productName" },
        { label: "Taxable (₹)", key: "taxable", numeric: true },
        { label: "CGST (₹)", key: "cgst", numeric: true },
        { label: "SGST (₹)", key: "sgst", numeric: true },
        { label: "Total GST (₹)", key: "totalGst", numeric: true },
      ];

      filterFields.push({
        name: "product",
        label: "Product",
        type: "select",
        options: productOptions,
        searchable: true,
      });
      break;

    case "GSTR-1":
      tableData = gstr1;
      columns = [
        { label: "Invoice No", key: "invoiceNo" },
        { label: "Date", key: "invoiceDate" },
        { label: "Customer", key: "customer" },
        { label: "GSTIN", key: "gstin" },
        { label: "Taxable (₹)", key: "taxable", numeric: true },
        { label: "CGST (₹)", key: "cgst", numeric: true },
        { label: "SGST (₹)", key: "sgst", numeric: true },
        { label: "IGST (₹)", key: "igst", numeric: true },
        { label: "Total GST (₹)", key: "totalGst", numeric: true },
        { label: "Invoice Amount (₹)", key: "invoiceAmount", numeric: true },
      ];
      break;

    case "GSTR-2":
      tableData = gstr2;
      columns = [
        { label: "Invoice No", key: "invoiceNo" },
        { label: "Date", key: "invoiceDate" },
        { label: "Vendor", key: "vendor" },
        { label: "GSTIN", key: "gstin" },
        { label: "Taxable (₹)", key: "taxable", numeric: true },
        { label: "CGST (₹)", key: "cgst", numeric: true },
        { label: "SGST (₹)", key: "sgst", numeric: true },
        { label: "IGST (₹)", key: "igst", numeric: true },
        { label: "Total GST (₹)", key: "totalGst", numeric: true },
        { label: "Invoice Amount (₹)", key: "invoiceAmount", numeric: true },
      ];
      break;
  }

  filterFields.push(
    { name: "fromDate", label: "From Date", type: "date" },
    { name: "toDate", label: "To Date", type: "date" }
  );

  return (
    <HomeLayout>
      <div className="w-full p-4 font-sans">
        <div className="flex flex-wrap gap-2 mb-3">
          {reportTabsObj.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium transition-colors cursor-pointer ${
                  isActive
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
        <ReportTable moduleId="reports.gst"
          title="GST Reports"
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
          exportFileName="GSTReport"
          showTotals
        />
      </div>
    </HomeLayout>
  );
};

export default GSTReports;
