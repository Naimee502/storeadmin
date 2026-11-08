import React, { useEffect, useState, useMemo } from "react";
import HomeLayout from "../../../layouts/home";
import ReportTable, { type ReportFilterField } from "../../../components/reporttable";
import { formatDateDMY, todayYMD, shiftDaysYMD, normalizeToYMD } from "../../../utils/helper";
import {
  FaFileInvoiceDollar,
  FaUndoAlt,
  FaExchangeAlt,
  FaAdjust,
  FaClipboardList
} from "react-icons/fa";

import { useQuery } from "@apollo/client";
import { useAppSelector } from "../../../redux/hooks";
import { partyLabel } from "../../../utils/partylabel";
import {
  PRODUCT_REPORT_PRODUCT_OPTIONS,
  PRODUCT_REPORT_SALES_INVOICES,
  PRODUCT_REPORT_PURCHASE_INVOICES,
  PRODUCT_REPORT_SALES_RETURNS,
  PRODUCT_REPORT_PURCHASE_RETURNS,
  PRODUCT_REPORT_TRANSFER_STOCKS,
  PRODUCT_REPORT_BRANCHES,
  PRODUCT_REPORT_STOCK_ADJUSTMENTS,
} from "../../../graphql/queries/reports/product";

const reportTabsObj = [
  { id: "Complete Statement", label: "Complete Statement", icon: <FaClipboardList className="text-xs text-blue-600" /> },
  { id: "Sales Invoices", label: "Sales Invoices", icon: <FaFileInvoiceDollar className="text-xs text-emerald-600" /> },
  { id: "Purchase Invoices", label: "Purchase Invoices", icon: <FaFileInvoiceDollar className="text-xs text-violet-600" /> },
  { id: "Sales Returns", label: "Sales Returns", icon: <FaUndoAlt className="text-xs text-amber-600" /> },
  { id: "Purchase Returns", label: "Purchase Returns", icon: <FaUndoAlt className="text-xs text-orange-600" /> },
  { id: "Stock Transfers", label: "Stock Transfers", icon: <FaExchangeAlt className="text-xs text-cyan-600" /> },
  { id: "Stock Adjustments", label: "Stock Adjustments", icon: <FaAdjust className="text-xs text-pink-600" /> },
];

// "YYYY-MM-DD" shifted by N days on the local calendar.
const shiftYMD = (ymd: string, days: number): string | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || "");
  if (!m) return null;
  return normalizeToYMD(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
};

const ProductStatementReport: React.FC = () => {
  const [activeTab, setActiveTab] = useState(reportTabsObj[0].id);
  const [filters, setFilters] = useState({});
  const [appliedFilters, setAppliedFilters] = useState({} as any);

  // Same adminid/branchid scoping as the existing hooks.
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);
  const adminid = type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;
  const branchid = type === 'admin' ? selectedBranchId : type === 'branch' ? branch?.id : type === 'staff' ? staff?.branchid?.id : undefined;

  // Load only the picker until a product is chosen, then only the active tab's sources.
  const selected = !!appliedFilters.product;
  const all = activeTab === "Complete Statement";
  const need = (tab: string) => selected && (all || activeTab === tab);

  const { data: productData } = useQuery(PRODUCT_REPORT_PRODUCT_OPTIONS, {
    variables: { filter: { adminid, branchid, status: true }, limit: 0, offset: 0 },
    skip: !adminid,
    fetchPolicy: "cache-and-network",
  });
  // Include cancelled bills: a cancellation is a stock movement. No server date filter on invoices.
  const { data: salesData } = useQuery(PRODUCT_REPORT_SALES_INVOICES, {
    variables: { filter: { adminid, branchid } },
    skip: !need("Sales Invoices"),
  });
  const { data: purchaseData } = useQuery(PRODUCT_REPORT_PURCHASE_INVOICES, {
    variables: { filter: { adminid, branchid } },
    skip: !need("Purchase Invoices"),
  });
  // Returns ranged server-side a day wider; exact range applied below.
  const retFrom = appliedFilters.fromDate ? shiftYMD(appliedFilters.fromDate, -1) : null;
  const retToDay = appliedFilters.toDate ? shiftYMD(appliedFilters.toDate, 1) : null;
  const retRange = {
    ...(retFrom ? { returndateFrom: retFrom } : {}),
    ...(retToDay ? { returndateTo: `${retToDay}\uffff` } : {}),
  };
  const { data: salesReturnData } = useQuery(PRODUCT_REPORT_SALES_RETURNS, {
    variables: { filter: { adminid, branchid, ...retRange } },
    skip: !need("Sales Returns"),
    fetchPolicy: "cache-and-network",
  });
  const { data: purchaseReturnData } = useQuery(PRODUCT_REPORT_PURCHASE_RETURNS, {
    variables: { filter: { adminid, branchid, ...retRange } },
    skip: !need("Purchase Returns"),
    fetchPolicy: "cache-and-network",
  });
  const { data: transferData } = useQuery(PRODUCT_REPORT_TRANSFER_STOCKS, {
    variables: { adminId: adminid, frombranchid: branchid },
    skip: !need("Stock Transfers"),
  });
  const { data: branchData } = useQuery(PRODUCT_REPORT_BRANCHES, {
    variables: { adminId: adminid },
    skip: !adminid || !need("Stock Transfers"),
  });
  // Scoped to this admin/branch like every other source on the page.
  const { data: adjustmentData } = useQuery(PRODUCT_REPORT_STOCK_ADJUSTMENTS, {
    variables: { filter: { adminid, branchid, status: true }, limit: 0, offset: 0 },
    skip: !need("Stock Adjustments"),
  });

  const products: any[] = productData?.getProductServices || [];
  const salesInvoices = useMemo(() => [...(salesData?.getSalesInvoices || [])].reverse(), [salesData]);
  const purchaseInvoices = useMemo(() => [...(purchaseData?.getPurchaseInvoices || [])].reverse(), [purchaseData]);
  const salesReturns = useMemo(() => [...(salesReturnData?.getSalesReturns || [])].reverse(), [salesReturnData]);
  const purchaseReturns = useMemo(() => [...(purchaseReturnData?.getPurchaseReturns || [])].reverse(), [purchaseReturnData]);
  const transfers = useMemo(() => [...(transferData?.getTransferStocks || [])].reverse(), [transferData]);
  const adjustments = useMemo(() => [...(adjustmentData?.getStockAdjustments || [])].reverse(), [adjustmentData]);
  const branchNames = useMemo(() => {
    const m = new Map<string, string>();
    (branchData?.getBranches || []).forEach((b: any) => m.set(b.id, b.branchname));
    return m;
  }, [branchData]);
  // Variant names, since transfer/adjustment lines only carry the variant id.
  const variantNames = useMemo(() => {
    const m = new Map<string, string>();
    const p = products.find((x: any) => x.id === appliedFilters.product);
    (p?.productvariants || []).forEach((v: any) => m.set(v.id, v.name));
    return m;
  }, [products, appliedFilters.product]);

  useEffect(() => {
    const to = todayYMD();
    const from = shiftDaysYMD(-365);
    setFilters({ fromDate: from, toDate: to });
    setAppliedFilters({ fromDate: from, toDate: to });
  }, []);

  const productOptions = products.map((p: any) => ({
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
        // Every line of this product (one per variant), not only the first.
        const productItems = (inv.productservice || []).filter((ps: any) => ps.productserviceid?.id === appliedFilters.product);
        return productItems.flatMap((productItem: any) => {
          const cancelled = inv.cancelStatus === "cancelled";
          const rows = [{
            transactionType: "Sales Invoice",
            invoiceNo: inv.billnumber,
            date: formatDateDMY(inv.billdate),
            dateYMD: normalizeToYMD(inv.billdate),
            party: partyLabel(inv.partyacc) || "-",
            quantity: productItem.qty || 0,
            rate: productItem.rate || 0,
            amount: productItem.amount || 0,
            variant: productItem.variantid?.name || "-",
            remarks: cancelled ? "Cancelled — see reversal below" : "-",
          }];
          // Cancellation gets its own row, dated when it happened.
          if (cancelled) {
            // Negative so the sale and its reversal net to zero in totals.
            rows.push({
              transactionType: "Sales Invoice Cancelled",
              invoiceNo: inv.billnumber,
              date: formatDateDMY(inv.cancelledAt || inv.billdate),
              dateYMD: normalizeToYMD(inv.cancelledAt || inv.billdate),
              party: partyLabel(inv.partyacc) || "-",
              quantity: -(productItem.qty || 0),
              rate: productItem.rate || 0,
              amount: -(productItem.amount || 0),
              variant: productItem.variantid?.name || "-",
              remarks: `Stock returned${inv.cancelReason ? ` — ${inv.cancelReason}` : ""}`,
            });
          }
          return rows;
        });
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
        // Every line of this product (one per variant), not only the first.
        const productItems = (inv.productservice || []).filter((ps: any) => ps.productserviceid?.id === appliedFilters.product);
        return productItems.flatMap((productItem: any) => {
          const cancelled = inv.cancelStatus === "cancelled";
          const rows = [{
            transactionType: "Purchase Invoice",
            invoiceNo: inv.billnumber,
            date: formatDateDMY(inv.billdate),
            dateYMD: normalizeToYMD(inv.billdate),
            party: partyLabel(inv.partyacc) || "-",
            quantity: productItem.qty || 0,
            rate: productItem.rate || 0,
            amount: productItem.amount || 0,
            variant: productItem.variantid?.name || "-",
            remarks: cancelled ? "Cancelled — see reversal below" : "-",
          }];
          // Purchase cancellation: the goods went back out.
          if (cancelled) {
            // Signed so the pair nets to zero in totals.
            rows.push({
              transactionType: "Purchase Invoice Cancelled",
              invoiceNo: inv.billnumber,
              date: formatDateDMY(inv.cancelledAt || inv.billdate),
              dateYMD: normalizeToYMD(inv.cancelledAt || inv.billdate),
              party: partyLabel(inv.partyacc) || "-",
              quantity: -(productItem.qty || 0),
              rate: productItem.rate || 0,
              amount: -(productItem.amount || 0),
              variant: productItem.variantid?.name || "-",
              remarks: `Stock reversed${inv.cancelReason ? ` — ${inv.cancelReason}` : ""}`,
            });
          }
          return rows;
        });
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
        // Every line of this product (one per variant), not only the first.
        const productItems = (ret.productservice || []).filter((ps: any) => ps.productserviceid?.id === appliedFilters.product);
        return productItems.flatMap((productItem: any) => {
          return [{
            transactionType: "Sales Return",
            invoiceNo: ret.returnNumber || ret.billnumber || ret.id,
            date: formatDateDMY(ret.returnDate || ret.returndate || ret.createdAt),
            dateYMD: normalizeToYMD(ret.returnDate || ret.returndate || ret.createdAt),
            party: partyLabel(ret.partyacc) || "-",
            quantity: productItem.qty || 0,
            rate: productItem.rate || 0,
            amount: productItem.amount || 0,
            variant: productItem.variantid?.name || "-",
            remarks: ret.remarks || ret.reason || "-",
          }];
        });
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
        // Every line of this product (one per variant), not only the first.
        const productItems = (ret.productservice || []).filter((ps: any) => ps.productserviceid?.id === appliedFilters.product);
        return productItems.flatMap((productItem: any) => {
          return [{
            transactionType: "Purchase Return",
            invoiceNo: ret.returnNumber || ret.billnumber || ret.id,
            date: formatDateDMY(ret.returnDate || ret.returndate || ret.createdAt),
            dateYMD: normalizeToYMD(ret.returnDate || ret.returndate || ret.createdAt),
            party: partyLabel(ret.partyacc) || "-",
            quantity: productItem.qty || 0,
            rate: productItem.rate || 0,
            amount: productItem.amount || 0,
            variant: productItem.variantid?.name || "-",
            remarks: ret.remarks || ret.reason || "-",
          }];
        });
      });
  }, [purchaseReturns, appliedFilters.product]);

  const productTransfers = useMemo(() => {
    if (!appliedFilters.product) return [];
    // One row per matching transfer item.
    return transfers.flatMap((t: any) =>
      (t.items || [])
        .filter((it: any) => it.productid === appliedFilters.product)
        .map((it: any) => ({
          transactionType: "Stock Transfer",
          invoiceNo: t.vouchernumber || t.id,
          date: formatDateDMY(t.transferdate),
          dateYMD: normalizeToYMD(t.transferdate),
          party: `${branchNames.get(t.frombranchid) || t.frombranchid} → ${branchNames.get(t.tobranchid) || t.tobranchid}`,
          quantity: it.transferqty || 0,
          rate: it.rate ?? "-",
          amount: it.amount ?? "-",
          variant: (it.variantid && variantNames.get(it.variantid)) || it.variantid || "-",
          remarks: t.narration || "-",
        }))
    );
  }, [transfers, appliedFilters.product, branchNames, variantNames]);

  const productAdjustments = useMemo(() => {
    if (!appliedFilters.product) return [];
    // One row per line, signed (Excess in, Shortage out) so the total is net change.
    return adjustments.flatMap((adj: any) => {
      const sign = adj.type === "Shortage" ? -1 : 1;
      return (adj.items || [])
        .filter((it: any) => it?.productid?.id === appliedFilters.product)
        .map((it: any) => ({
          transactionType: `Stock Adjustment${adj.type ? ` (${adj.type})` : ""}`,
          invoiceNo: adj.vouchernumber || adj.id,
          date: formatDateDMY(adj.adjustmentdate || adj.createdAt),
          dateYMD: normalizeToYMD(adj.adjustmentdate || adj.createdAt),
          party: "-",
          quantity: sign * (it.quantity || 0),
          rate: it.rate ?? "-",
          amount: sign * (it.amount || 0),
          variant: (it.variantid && variantNames.get(it.variantid)) || it.variantid || "-",
          remarks: [adj.type, adj.reason].filter(Boolean).join(" — ") || "-",
        }));
    });
  }, [adjustments, appliedFilters.product, variantNames]);

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
