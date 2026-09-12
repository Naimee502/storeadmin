import React, { useEffect, useState, useMemo } from "react";
import HomeLayout from "../../../layouts/home";
import ReportTable, { type ReportFilterField } from "../../../components/reporttable";
import { formatDateDMY, todayYMD, shiftDaysYMD, normalizeToYMD } from "../../../utils/helper";
import {
  FaBoxes,
  FaFileInvoiceDollar,
  FaUndoAlt,
  FaExchangeAlt,
  FaAdjust,
  FaClipboardList
} from "react-icons/fa";

// Hooks for all required data
import { useProductServicesQuery } from "../../../graphql/hooks/products";
import { useSalesInvoicesQuery } from "../../../graphql/hooks/salesinvoice";
import { usePurchaseInvoicesQuery } from "../../../graphql/hooks/purchaseinvoice";
import { useSalesReturnsQuery } from "../../../graphql/hooks/salesreturn";
import { usePurchaseReturnsQuery } from "../../../graphql/hooks/purchasereturn";
import { useTransferStocksQuery } from "../../../graphql/hooks/transferstock";
import { useStockAdjustmentsQuery } from "../../../graphql/hooks/stockadjustments";
import { useAccountsQuery } from "../../../graphql/hooks/accounts";

const reportTabsObj = [
  { id: "Complete Statement", label: "Complete Statement", icon: <FaClipboardList className="text-blue-600" /> },
  { id: "Sales Invoices", label: "Sales Invoices", icon: <FaFileInvoiceDollar className="text-emerald-600" /> },
  { id: "Purchase Invoices", label: "Purchase Invoices", icon: <FaFileInvoiceDollar className="text-violet-600" /> },
  { id: "Sales Returns", label: "Sales Returns", icon: <FaUndoAlt className="text-amber-600" /> },
  { id: "Purchase Returns", label: "Purchase Returns", icon: <FaUndoAlt className="text-orange-600" /> },
  { id: "Stock Transfers", label: "Stock Transfers", icon: <FaExchangeAlt className="text-cyan-600" /> },
  { id: "Stock Adjustments", label: "Stock Adjustments", icon: <FaAdjust className="text-pink-600" /> },
];

const ProductStatementReport: React.FC = () => {
  const [activeTab, setActiveTab] = useState(reportTabsObj[0].id);
  const [filters, setFilters] = useState({});
  const [appliedFilters, setAppliedFilters] = useState({} as any);

  const { data: productData } = useProductServicesQuery();
  const { data: salesData } = useSalesInvoicesQuery();
  const { data: purchaseData } = usePurchaseInvoicesQuery();
  const { data: salesReturnData } = useSalesReturnsQuery();
  const { data: purchaseReturnData } = usePurchaseReturnsQuery();
  const { data: transferData } = useTransferStocksQuery();
  const { data: adjustmentData } = useStockAdjustmentsQuery();
  const { data: accountsData } = useAccountsQuery();

  const products = productData?.getProductServices || [];
  const salesInvoices = [...(salesData?.getSalesInvoices || [])].reverse();
  const purchaseInvoices = [...(purchaseData?.getPurchaseInvoices || [])].reverse();
  const salesReturns = [...(salesReturnData?.getSalesReturns || [])].reverse();
  const purchaseReturns = [...(purchaseReturnData?.getPurchaseReturns || [])].reverse();
  const transfers = [...(transferData?.getTransferStocks || [])].reverse();
  const adjustments = [...(adjustmentData?.getStockAdjustments || [])].reverse();
  const accounts = accountsData?.getAccounts || [];

  useEffect(() => {
    const to = todayYMD();
    const from = shiftDaysYMD(-365);
    setFilters({ fromDate: from, toDate: to });
    setAppliedFilters({ fromDate: from, toDate: to });
  }, []);

  const productOptions = products.map((p) => ({
    label: p.name,
    value: p.id,
  }));

  const productSalesInvoices = useMemo(() => {
    if (!appliedFilters.product) return [];
    return salesInvoices
      .filter((inv: any) => {
        const hasProduct = (inv.productservice || []).some((ps: any) => ps.productserviceid?.id === appliedFilters.product);
        return hasProduct;
      })
      .flatMap((inv: any) => {
        const productItem = (inv.productservice || []).find((ps: any) => ps.productserviceid?.id === appliedFilters.product);
        if (!productItem) return [];
        return [{
          transactionType: "Sales Invoice",
          invoiceNo: inv.billnumber,
          date: formatDateDMY(inv.billdate),
          dateYMD: normalizeToYMD(inv.billdate),
          party: inv.partyacc?.accountname || "-",
          quantity: productItem.qty || 0,
          rate: productItem.rate || 0,
          amount: productItem.amount || 0,
          variant: productItem.variantid?.name || "-",
          remarks: "-",
        }];
      });
  }, [salesInvoices, appliedFilters.product]);

  const productPurchaseInvoices = useMemo(() => {
    if (!appliedFilters.product) return [];
    return purchaseInvoices
      .filter((inv: any) => {
        const hasProduct = (inv.productservice || []).some((ps: any) => ps.productserviceid?.id === appliedFilters.product);
        return hasProduct;
      })
      .flatMap((inv: any) => {
        const productItem = (inv.productservice || []).find((ps: any) => ps.productserviceid?.id === appliedFilters.product);
        if (!productItem) return [];
        return [{
          transactionType: "Purchase Invoice",
          invoiceNo: inv.billnumber,
          date: formatDateDMY(inv.billdate),
          dateYMD: normalizeToYMD(inv.billdate),
          party: inv.partyacc?.accountname || "-",
          quantity: productItem.qty || 0,
          rate: productItem.rate || 0,
          amount: productItem.amount || 0,
          variant: productItem.variantid?.name || "-",
          remarks: "-",
        }];
      });
  }, [purchaseInvoices, appliedFilters.product]);

  const productSalesReturns = useMemo(() => {
    if (!appliedFilters.product) return [];
    return salesReturns
      .filter((ret: any) => {
        const hasProduct = (ret.productservice || []).some((ps: any) => ps.productserviceid?.id === appliedFilters.product);
        return hasProduct;
      })
      .flatMap((ret: any) => {
        const productItem = (ret.productservice || []).find((ps: any) => ps.productserviceid?.id === appliedFilters.product);
        if (!productItem) return [];
        return [{
          transactionType: "Sales Return",
          invoiceNo: ret.returnNumber || ret.id,
          date: formatDateDMY(ret.returnDate || ret.createdAt),
          dateYMD: normalizeToYMD(ret.returnDate || ret.createdAt),
          party: ret.partyacc?.accountname || "-",
          quantity: productItem.qty || 0,
          rate: productItem.rate || 0,
          amount: productItem.amount || 0,
          variant: productItem.variantid?.name || "-",
          remarks: ret.remarks || "-",
        }];
      });
  }, [salesReturns, appliedFilters.product]);

  const productPurchaseReturns = useMemo(() => {
    if (!appliedFilters.product) return [];
    return purchaseReturns
      .filter((ret: any) => {
        const hasProduct = (ret.productservice || []).some((ps: any) => ps.productserviceid?.id === appliedFilters.product);
        return hasProduct;
      })
      .flatMap((ret: any) => {
        const productItem = (ret.productservice || []).find((ps: any) => ps.productserviceid?.id === appliedFilters.product);
        if (!productItem) return [];
        return [{
          transactionType: "Purchase Return",
          invoiceNo: ret.returnNumber || ret.id,
          date: formatDateDMY(ret.returnDate || ret.createdAt),
          dateYMD: normalizeToYMD(ret.returnDate || ret.createdAt),
          party: ret.partyacc?.accountname || "-",
          quantity: productItem.qty || 0,
          rate: productItem.rate || 0,
          amount: productItem.amount || 0,
          variant: productItem.variantid?.name || "-",
          remarks: ret.remarks || "-",
        }];
      });
  }, [purchaseReturns, appliedFilters.product]);

  const productTransfers = useMemo(() => {
    if (!appliedFilters.product) return [];
    return transfers
      .filter((t: any) => t.productid === appliedFilters.product)
      .map((t: any) => ({
        transactionType: "Stock Transfer",
        invoiceNo: t.id,
        date: formatDateDMY(t.transferdate),
        dateYMD: normalizeToYMD(t.transferdate),
        party: `${t.frombranchid} → ${t.tobranchid}`,
        quantity: t.transferqty || 0,
        rate: "-",
        amount: "-",
        variant: t.variantid || "-",
        remarks: t.remarks || "-",
      }));
  }, [transfers, appliedFilters.product]);

  const productAdjustments = useMemo(() => {
    if (!appliedFilters.product) return [];
    return adjustments
      .filter((adj: any) => adj.productid === appliedFilters.product)
      .map((adj: any) => ({
        transactionType: "Stock Adjustment",
        invoiceNo: adj.id,
        date: formatDateDMY(adj.adjustmentdate),
        dateYMD: normalizeToYMD(adj.adjustmentdate),
        party: "-",
        quantity: adj.adjustmentqty || 0,
        rate: "-",
        amount: "-",
        variant: adj.variantid || "-",
        remarks: adj.reason || "-",
      }));
  }, [adjustments, appliedFilters.product]);

  const completeStatement = useMemo(() => {
    const combined = [
      ...productSalesInvoices,
      ...productPurchaseInvoices,
      ...productSalesReturns,
      ...productPurchaseReturns,
      ...productTransfers,
      ...productAdjustments,
    ];
    return combined.filter((item: any) => {
      const from = appliedFilters.fromDate;
      const to = appliedFilters.toDate;
      if (from && item.dateYMD && item.dateYMD < from) return false;
      if (to && item.dateYMD && item.dateYMD > to) return false;
      return true;
    }).sort((a: any, b: any) => {
      if (a.dateYMD === b.dateYMD) return 0;
      return a.dateYMD > b.dateYMD ? -1 : 1;
    });
  }, [productSalesInvoices, productPurchaseInvoices, productSalesReturns, productPurchaseReturns, productTransfers, productAdjustments, appliedFilters.fromDate, appliedFilters.toDate]);

  const filterByDateRange = (data: any[]) => {
    return data.filter((item: any) => {
      const from = appliedFilters.fromDate;
      const to = appliedFilters.toDate;
      if (from && item.dateYMD && item.dateYMD < from) return false;
      if (to && item.dateYMD && item.dateYMD > to) return false;
      return true;
    });
  };

  let tableData: any[] = [];
  let columns: any[] = [];
  let filterFields: ReportFilterField[] = [];

  switch (activeTab) {
    case "Complete Statement":
      tableData = completeStatement;
      columns = [
        { label: "Type", key: "transactionType" },
        { label: "Invoice/Ref No", key: "invoiceNo" },
        { label: "Date", key: "date" },
        { label: "Party", key: "party" },
        { label: "Variant", key: "variant" },
        { label: "Qty", key: "quantity", numeric: true },
        { label: "Rate (₹)", key: "rate", numeric: true },
        { label: "Amount (₹)", key: "amount", numeric: true },
        { label: "Remarks", key: "remarks" },
      ];
      break;
    case "Sales Invoices":
      tableData = filterByDateRange(productSalesInvoices);
      columns = [
        { label: "Invoice No", key: "invoiceNo" },
        { label: "Date", key: "date" },
        { label: "Customer", key: "party" },
        { label: "Variant", key: "variant" },
        { label: "Qty", key: "quantity", numeric: true },
        { label: "Rate (₹)", key: "rate", numeric: true },
        { label: "Amount (₹)", key: "amount", numeric: true },
      ];
      break;
    case "Purchase Invoices":
      tableData = filterByDateRange(productPurchaseInvoices);
      columns = [
        { label: "Invoice No", key: "invoiceNo" },
        { label: "Date", key: "date" },
        { label: "Vendor", key: "party" },
        { label: "Variant", key: "variant" },
        { label: "Qty", key: "quantity", numeric: true },
        { label: "Rate (₹)", key: "rate", numeric: true },
        { label: "Amount (₹)", key: "amount", numeric: true },
      ];
      break;
    case "Sales Returns":
      tableData = filterByDateRange(productSalesReturns);
      columns = [
        { label: "Return No", key: "invoiceNo" },
        { label: "Date", key: "date" },
        { label: "Customer", key: "party" },
        { label: "Variant", key: "variant" },
        { label: "Qty", key: "quantity", numeric: true },
        { label: "Rate (₹)", key: "rate", numeric: true },
        { label: "Amount (₹)", key: "amount", numeric: true },
        { label: "Remarks", key: "remarks" },
      ];
      break;
    case "Purchase Returns":
      tableData = filterByDateRange(productPurchaseReturns);
      columns = [
        { label: "Return No", key: "invoiceNo" },
        { label: "Date", key: "date" },
        { label: "Vendor", key: "party" },
        { label: "Variant", key: "variant" },
        { label: "Qty", key: "quantity", numeric: true },
        { label: "Rate (₹)", key: "rate", numeric: true },
        { label: "Amount (₹)", key: "amount", numeric: true },
        { label: "Remarks", key: "remarks" },
      ];
      break;
    case "Stock Transfers":
      tableData = filterByDateRange(productTransfers);
      columns = [
        { label: "Transfer ID", key: "invoiceNo" },
        { label: "Date", key: "date" },
        { label: "Branch Transfer", key: "party" },
        { label: "Variant", key: "variant" },
        { label: "Qty", key: "quantity", numeric: true },
        { label: "Remarks", key: "remarks" },
      ];
      break;
    case "Stock Adjustments":
      tableData = filterByDateRange(productAdjustments);
      columns = [
        { label: "Adjustment ID", key: "invoiceNo" },
        { label: "Date", key: "date" },
        { label: "Variant", key: "variant" },
        { label: "Adjustment Qty", key: "quantity", numeric: true },
        { label: "Reason", key: "remarks" },
      ];
      break;
  }

  filterFields = [
    { name: "product", label: "Select Product", type: "select", options: productOptions, searchable: true, required: true },
    { name: "fromDate", label: "From Date", type: "date" },
    { name: "toDate", label: "To Date", type: "date" },
  ];

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
                  isActive ? "!bg-slate-900 !text-white shadow-sm border border-slate-900" : "bg-white text-gray-700 hover:text-black hover:bg-gray-100 border border-gray-200"
                }`}
              >
                <span>{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
        <ReportTable
          moduleId="reports.product"
          title="Product Statement Report"
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
          exportFileName="ProductStatementReport"
          showTotals
        />
      </div>
    </HomeLayout>
  );
};

export default ProductStatementReport;
