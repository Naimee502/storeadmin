import React, { useEffect, useState, useMemo } from "react";
import HomeLayout from "../../../layouts/home";
import ReportTable, { type ReportFilterField } from "../../../components/reporttable";
import { useAccountsQuery } from "../../../graphql/hooks/accounts";
import { useSalesInvoicesQuery } from "../../../graphql/hooks/salesinvoice";
import { usePurchaseInvoicesQuery } from "../../../graphql/hooks/purchaseinvoice";
import { useProductServicesQuery } from "../../../graphql/hooks/products";

const GSTReports: React.FC = () => {
  // -----------------------------
  // Tabs (without GST by Category)
  // -----------------------------
  const reportTabs = [
    "GST Summary",
    "GST Payable",
    "GST Receivable",
    "GST by Product",
  ];

  const [activeTab, setActiveTab] = useState<string>(reportTabs[0]);
  const [filters, setFilters] = useState<{ [key: string]: any }>({});
  const [appliedFilters, setAppliedFilters] = useState<{ [key: string]: any }>({});

  // -----------------------------
  // Fetch all data
  // -----------------------------
  const { data: accountsData } = useAccountsQuery();
  const { data: salesData } = useSalesInvoicesQuery();
  const { data: purchaseData } = usePurchaseInvoicesQuery();
  const { data: productData } = useProductServicesQuery();

  const accounts = accountsData?.getAccounts || [];
  const salesInvoices = salesData?.getSalesInvoices || [];
  const purchaseInvoices = purchaseData?.getPurchaseInvoices || [];
  const products = productData?.getProductServices || [];

  // -----------------------------
  // Default filters: last 30 days
  // -----------------------------
  useEffect(() => {
    const today = new Date();
    const to = today.toISOString().slice(0, 10);
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30)
      .toISOString()
      .slice(0, 10);
    setFilters({ fromDate: from, toDate: to });
    setAppliedFilters({ fromDate: from, toDate: to });
  }, []);

  // -----------------------------
  // Memoized mappings
  // -----------------------------
  const accountMap = useMemo(() => {
    return accounts.reduce((acc: any, a: any) => {
      acc[a.id] = a;
      return acc;
    }, {});
  }, [accounts]);

  // -----------------------------
  // Map invoices
  // -----------------------------
  const mapInvoiceProducts = (invProducts: any[]) => {
    return invProducts.map((ps: any) => {
      const prod = products.find((p: any) => p.id === ps.productserviceid) || {};
      return {
        productName: prod.name || "Unknown Product",
        categoryName: prod.categoryname || "Uncategorized",
        quantity: ps.quantity || 0,
        rate: ps.rate || 0,
        taxableValue: (ps.amount || 0) - (ps.gst || 0),
        cgst: (ps.gst || 0) / 2,
        sgst: (ps.gst || 0) / 2,
        igst: 0,
        totalGst: ps.gst || 0,
      };
    });
  };

  // -----------------------------
  // GST Sales Report
  // -----------------------------
  const gstSalesReport = useMemo(() => {
    return salesInvoices
      .filter((inv) => {
        const fromDate = appliedFilters.fromDate ? new Date(appliedFilters.fromDate) : null;
        const toDate = appliedFilters.toDate ? new Date(appliedFilters.toDate) : null;
        const invoiceDate = new Date(inv.billdate);
        if (fromDate && invoiceDate < fromDate) return false;
        if (toDate && invoiceDate > toDate) return false;
        if (appliedFilters.customer && accountMap[inv.partyacc]?.name !== appliedFilters.customer) return false;
        return true;
      })
      .map((inv) => {
        const party = accountMap[inv.partyacc] || {};
        const productsMapped = mapInvoiceProducts(inv.productservice);
        const taxableValue = productsMapped.reduce((sum, ps) => sum + ps.taxableValue, 0);
        const totalGst = productsMapped.reduce((sum, ps) => sum + ps.totalGst, 0);
        return {
          type: "Sales",
          invoiceNo: inv.billnumber,
          invoiceDate: inv.billdate,
          partyName: party.name || "",
          gstin: party.gstnumber || "",
          taxableValue,
          cgst: totalGst / 2,
          sgst: totalGst / 2,
          igst: 0,
          totalGst,
          totalAmount: inv.totalamount || 0,
          products: productsMapped,
        };
      });
  }, [salesInvoices, accountMap, products, appliedFilters]);

  // -----------------------------
  // GST Purchase Report
  // -----------------------------
  const gstPurchaseReport = useMemo(() => {
    return purchaseInvoices
      .filter((inv) => {
        const fromDate = appliedFilters.fromDate ? new Date(appliedFilters.fromDate) : null;
        const toDate = appliedFilters.toDate ? new Date(appliedFilters.toDate) : null;
        const invoiceDate = new Date(inv.billdate);
        if (fromDate && invoiceDate < fromDate) return false;
        if (toDate && invoiceDate > toDate) return false;
        if (appliedFilters.vendor && accountMap[inv.partyacc]?.name !== appliedFilters.vendor) return false;
        return true;
      })
      .map((inv) => {
        const party = accountMap[inv.partyacc] || {};
        const productsMapped = mapInvoiceProducts(inv.productservice);
        const taxableValue = productsMapped.reduce((sum, ps) => sum + ps.taxableValue, 0);
        const totalGst = productsMapped.reduce((sum, ps) => sum + ps.totalGst, 0);
        return {
          type: "Purchase",
          invoiceNo: inv.billnumber,
          invoiceDate: inv.billdate,
          partyName: party.name || "",
          gstin: party.gstnumber || "",
          taxableValue,
          cgst: totalGst / 2,
          sgst: totalGst / 2,
          igst: 0,
          totalGst,
          totalAmount: inv.totalamount || 0,
          products: productsMapped,
        };
      });
  }, [purchaseInvoices, accountMap, products, appliedFilters]);

  // -----------------------------
  // Filter options
  // -----------------------------
  const customerOptions = accounts.filter(a => a.type === "customer").map(a => ({ label: a.name, value: a.name }));
  const vendorOptions = accounts.filter(a => a.type === "vendor").map(a => ({ label: a.name, value: a.name }));
  const productOptions = products.map(p => ({ label: p.name, value: p.name }));

  // -----------------------------
  // Table data & columns
  // -----------------------------
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
        { label: "Taxable Value", key: "taxableValue" },
        { label: "CGST", key: "cgst" },
        { label: "SGST", key: "sgst" },
        { label: "IGST", key: "igst" },
        { label: "Total GST", key: "totalGst" },
      ];
      filterFields.push({ name: "customer", label: "Customer", type: "select", options: customerOptions, searchable: true });
      break;

    case "GST Payable":
      tableData = gstPurchaseReport;
      columns = [
        { label: "Invoice No", key: "invoiceNo" },
        { label: "Date", key: "invoiceDate" },
        { label: "Vendor", key: "partyName" },
        { label: "Taxable Value", key: "taxableValue" },
        { label: "CGST", key: "cgst" },
        { label: "SGST", key: "sgst" },
        { label: "IGST", key: "igst" },
        { label: "Total GST", key: "totalGst" },
      ];
      filterFields.push({ name: "vendor", label: "Vendor", type: "select", options: vendorOptions, searchable: true });
      break;

    case "GST by Product":
      tableData = gstSalesReport.concat(gstPurchaseReport)
        .flatMap(inv => inv.products)
        .filter(p => !appliedFilters.product || p.productName === appliedFilters.product);
      columns = [
        { label: "Product", key: "productName" },
        { label: "Taxable Value", key: "taxableValue" },
        { label: "CGST", key: "cgst" },
        { label: "SGST", key: "sgst" },
        { label: "IGST", key: "igst" },
        { label: "Total GST", key: "totalGst" },
      ];
      filterFields.push({ name: "product", label: "Product", type: "select", options: productOptions, searchable: true });
      break;
  }

  filterFields.push({ name: "fromDate", label: "From Date", type: "date" }, { name: "toDate", label: "To Date", type: "date" });

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <ReportTable
          title="GST Reports"
          columns={columns}
          data={tableData}
          filterFields={filterFields}
          filters={filters}
          setFilters={setFilters}
          appliedFilters={appliedFilters}
          setAppliedFilters={setAppliedFilters}
          defaultTab={activeTab}
          tabs={reportTabs}
          onTabChange={(tab) => setActiveTab(tab)}
          showExport
          showCsv
        />
      </div>
    </HomeLayout>
  );
};

export default GSTReports;
