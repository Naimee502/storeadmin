import React, { useEffect, useState, useMemo } from "react";
import HomeLayout from "../../../layouts/home";
import ReportTable, { type ReportFilterField } from "../../../components/reporttable";
import { FaCalculator, FaMoneyCheckAlt, FaFileInvoiceDollar, FaBoxes, FaFileAlt, FaFileContract } from "react-icons/fa";

import { useAccountsQuery } from "../../../graphql/hooks/accounts";
import { useSalesInvoicesQuery } from "../../../graphql/hooks/salesinvoice";
import { usePurchaseInvoicesQuery } from "../../../graphql/hooks/purchaseinvoice";
import { useProductServicesQuery } from "../../../graphql/hooks/products";
import { useTransactionsQuery } from "../../../graphql/hooks/transactions";

const reportTabsObj = [
  { id: "GST Summary", label: "GST Summary", icon: <FaCalculator className="text-blue-600" /> },
  { id: "GST Payable", label: "GST Payable", icon: <FaMoneyCheckAlt className="text-amber-600" /> },
  { id: "GST Receivable", label: "GST Receivable", icon: <FaFileInvoiceDollar className="text-emerald-600" /> },
  { id: "GST by Product", label: "GST by Product", icon: <FaBoxes className="text-purple-600" /> },
  { id: "GSTR-1", label: "GSTR-1", icon: <FaFileAlt className="text-rose-600" /> },
  { id: "GSTR-2", label: "GSTR-2", icon: <FaFileContract className="text-indigo-600" /> },
];

const GSTReports: React.FC = () => {
  const [activeTab, setActiveTab] = useState(reportTabsObj[0].id);
  const [filters, setFilters] = useState({});
  const [appliedFilters, setAppliedFilters] = useState({} as any);

  const { data: accountsData } = useAccountsQuery();
  const { data: salesData } = useSalesInvoicesQuery();
  const { data: purchaseData } = usePurchaseInvoicesQuery();
  const { data: productData } = useProductServicesQuery();
  const { data: transactionsData } = useTransactionsQuery();

  const accounts = accountsData?.getAccounts || [];
  const salesInvoices = salesData?.getSalesInvoices || [];
  const purchaseInvoices = purchaseData?.getPurchaseInvoices || [];
  const products = productData?.getProductServices || [];

  // Default Date Range
  useEffect(() => {
    const today = new Date();
    const to = today.toISOString().slice(0, 10);
    const from = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - 30
    )
      .toISOString()
      .slice(0, 10);

    setFilters({ fromDate: from, toDate: to });
    setAppliedFilters({ fromDate: from, toDate: to });
  }, []);

  // --------------------------------------------
  // GST From Transactions
  // --------------------------------------------
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

  // --------------------------------------------
  // Product Mapping (Correct)
  // --------------------------------------------
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
        productId: product?.id,
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

  // --------------------------------------------
  // GST Sales Report
  // --------------------------------------------
  const gstSalesReport = useMemo(() => {
    return salesInvoices
      .filter((inv: any) => {
        const from = appliedFilters.fromDate ? new Date(appliedFilters.fromDate) : null;
        const to = appliedFilters.toDate ? new Date(appliedFilters.toDate) : null;

        const d = new Date(inv.billdate);

        if (from && d < from) return false;
        if (to && d > to) return false;

        // FIXED FILTER MATCH (OLD LOGIC)
        if (appliedFilters.customer) {
          if (inv.partyacc?.accountname !== appliedFilters.customer) return false;
        }

        return true;
      })
      .map((inv) => {
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
          invoiceDate: inv.billdate,
          partyName: inv.partyacc?.accountname || "",
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

  // --------------------------------------------
  // GST Purchase Report
  // --------------------------------------------
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
      .map((inv) => {
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
          invoiceDate: inv.billdate,
          partyName: inv.partyacc?.accountname || "",
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

  // --------------------------------------------
  // GSTR-1
  // --------------------------------------------
  const gstr1 = gstSalesReport.map((r) => ({
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
  }));

  // --------------------------------------------
  // GSTR-2
  // --------------------------------------------
  const gstr2 = gstPurchaseReport.map((r) => ({
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
  }));

  // --------------------------------------------
  // Filter Dropdown Options (FIXED)
  // --------------------------------------------
  const customerOptions = accounts
    .filter((a) => a.type === "customer")
    .map((a) => ({
      label: a.name,
      value: a.name,
    }));

  const vendorOptions = accounts
    .filter((a) => a.type === "vendor")
    .map((a) => ({
      label: a.name,
      value: a.name,
    }));

  const productOptions = products.map((p) => ({
    label: p.name,
    value: p.id, // FIXED
  }));

  // --------------------------------------------
  // Table Data
  // --------------------------------------------
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
        // FIXED FILTER
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
      <div className="w-full px-2 sm:px-6 pt-4 pb-6 font-sans">
        <div className="flex flex-wrap gap-2 mb-4">
          {reportTabsObj.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  isActive
                    ? "!bg-slate-900 !text-white shadow-sm border border-slate-900"
                    : "bg-white text-gray-700 hover:text-black hover:bg-gray-100 border border-gray-200"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
        <ReportTable
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
