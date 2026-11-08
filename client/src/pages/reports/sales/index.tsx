import React, { useEffect, useRef, useState, useMemo } from "react";
import { useQuery } from "@apollo/client";
import { useAppSelector } from "../../../redux/hooks";
import HomeLayout from "../../../layouts/home";
import {
  GET_SALES_INVOICES_REPORT,
  GET_DELETED_SALES_INVOICES_REPORT,
  GET_SALES_ORDERS_REPORT,
  GET_SALES_RETURNS_REPORT,
} from "../../../graphql/queries/reports/sales";
import { useAccountsQuery } from "../../../graphql/hooks/accounts";
import { useProductServicesQuery } from "../../../graphql/hooks/products";
import PrintableInvoice from "../../../components/printinvoice";
import type { ReportFilterField } from "../../../components/reporttable";
import ReportTable from "../../../components/reporttable";
import { normalizeToYMD, formatDateDMY, todayYMD, shiftDaysYMD } from "../../../utils/helper";
import { FaClipboardList, FaFileInvoiceDollar, FaUndoAlt } from "react-icons/fa";
import { partyLabel } from "../../../utils/partylabel";

// Lifecycle stage for Status; order `status` is the soft-delete flag, not the stage.
const orderStage = (o: any): "cancelled" | "converted" | "active" =>
  o?.cancelStatus === "cancelled" || o?.orderStatus === "cancelled"
    ? "cancelled"
    : o?.isConverted
      ? "converted"
      : "active";
const STAGE_LABEL = { active: "Active", converted: "Converted", cancelled: "Cancelled" } as const;

const reportTabs = [
  { id: "Sales Order", label: "Sales Order", icon: <FaClipboardList className="text-xs text-amber-600" /> },
  { id: "Sales Invoice", label: "Sales Invoice", icon: <FaFileInvoiceDollar className="text-xs text-blue-600" /> },
  { id: "Sales Return (CN)", label: "Sales Return (CN)", icon: <FaUndoAlt className="text-xs text-rose-600" /> },
];

// "Product - Variant × 2 Box" per line item; ReportTable puts each on its own line.
const productLinesOf = (items: any[]): string[] => {
  const lines = (items || []).map((p: any) => {
    const n = p.productserviceid?.name || "Unknown";
    const v = p.variantid?.name ? ` - ${p.variantid.name}` : "";
    const u = p.salesunitid?.unitname ? ` ${p.salesunitid.unitname}` : "";
    return `${n}${v} × ${p.qty ?? 0}${u}`;
  });
  return lines.length ? lines : ["-"];
};

// Server date bounds: "\uffff" keeps values with a time part on the To day.
const dateTo = (ymd?: string) => (ymd ? `${ymd}\uffff` : undefined);

// Safely capitalize a value that may be string | boolean | null | undefined
const cap = (val: any): string => {
  if (!val && val !== false) return "-";
  if (typeof val === "boolean") return val ? "Active" : "Inactive";
  const s = String(val);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const SalesReports: React.FC = () => {
  const [activeTab, setActiveTab] = useState(reportTabs[0].id);
  const [filters, setFilters] = useState<{ [key: string]: any }>({});
  const [appliedFilters, setAppliedFilters] = useState<{ [key: string]: any }>({});

  // Scope (same derivation as the graphql/hooks sales* hooks)
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);
  const adminid = type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : type === "staff" ? staff?.admin?.id : undefined;
  const branchid = type === "admin" ? selectedBranchId : type === "branch" ? branch?.id : type === "staff" ? staff?.branchid?.id : undefined;

  const fromDate: string | undefined = appliedFilters.fromDate || undefined;
  const toDate: string | undefined = appliedFilters.toDate || undefined;
  // Nothing is fetched until the default date range has been applied.
  const rangeReady = !!(fromDate || toDate);

  const isInvoiceTab = activeTab === "Sales Invoice";
  const isOrderTab = activeTab === "Sales Order";
  const isReturnTab = activeTab === "Sales Return (CN)";
  const needActiveInvoices = isInvoiceTab && appliedFilters.status !== "Inactive";
  const needDeletedInvoices = isInvoiceTab && appliedFilters.status !== "Active";

  // Data: only the active tab's lite query runs.
  const invoiceFilter = { adminid, branchid };
  // Active invoices ranged server-side; deleted invoices filter client-side.
  const { data: activeData, loading: activeLoading } = useQuery(GET_SALES_INVOICES_REPORT, {
    variables: { filter: { ...invoiceFilter, billdateFrom: fromDate, billdateTo: dateTo(toDate) } },
    skip: !rangeReady || !needActiveInvoices,
    fetchPolicy: "cache-and-network",
  });
  const { data: deletedData, loading: deletedLoading } = useQuery(GET_DELETED_SALES_INVOICES_REPORT, {
    variables: { filter: invoiceFilter },
    skip: !rangeReady || !needDeletedInvoices,
    fetchPolicy: "cache-and-network",
  });
  const { data: ordersData, loading: ordersLoading } = useQuery(GET_SALES_ORDERS_REPORT, {
    variables: { filter: { adminid, branchid, billdateFrom: fromDate, billdateTo: dateTo(toDate) } },
    skip: !rangeReady || !isOrderTab,
    fetchPolicy: "cache-and-network",
  });
  const { data: returnsData, loading: returnsLoading } = useQuery(GET_SALES_RETURNS_REPORT, {
    variables: { filter: { adminid, branchid, returndateFrom: fromDate, returndateTo: dateTo(toDate) } },
    skip: !rangeReady || !isReturnTab,
    fetchPolicy: "cache-and-network",
  });
  // Filter dropdown options only.
  const { data: accountData } = useAccountsQuery();
  const { data: productData } = useProductServicesQuery();

  // Cancelled bills are excluded from active invoices, as useSalesInvoicesQuery does.
  const activeInvoices = useMemo(
    () =>
      [...(activeData?.getSalesInvoices || [])]
        .filter((i: any) => i?.cancelStatus !== "cancelled")
        .reverse(),
    [activeData]
  );
  const deletedInvoices = useMemo(
    () => [...(deletedData?.getDeletedSalesInvoices || [])].reverse(),
    [deletedData]
  );
  const salesOrders = useMemo(() => [...(ordersData?.getSalesOrders || [])].reverse(), [ordersData]);
  const salesReturns = useMemo(() => [...(returnsData?.getSalesReturns || [])].reverse(), [returnsData]);
  const accountsList: any[] = accountData?.getAccounts || [];
  const productList: any[] = productData?.getProductServices ?? [];

  const componentRef = useRef<HTMLDivElement>(null);
  const [printInvoice, setPrintInvoice] = useState<any>(null);

  // Default last 30 days
  useEffect(() => {
    const to = todayYMD();
    const from = shiftDaysYMD(-30);
    setFilters({ fromDate: from, toDate: to });
    setAppliedFilters({ fromDate: from, toDate: to });
  }, []);

  // Loader follows the active tab's query; Apollo refetches on variable changes.
  const tabLoading =
    (needActiveInvoices && activeLoading) ||
    (needDeletedInvoices && deletedLoading) ||
    (isOrderTab && ordersLoading) ||
    (isReturnTab && returnsLoading);

  // ── Sales Invoice Data ──
  const invoiceList = useMemo(
    () =>
      appliedFilters.status === "Inactive"
        ? deletedInvoices
        : appliedFilters.status === "Active"
        ? activeInvoices
        : [...activeInvoices, ...deletedInvoices],
    [appliedFilters.status, activeInvoices, deletedInvoices]
  );

  const invoiceTableData = useMemo(() => {
    return invoiceList
      .map((inv: any, idx: number) => {
        const totalqty = inv.productservice?.reduce((s: number, p: any) => s + (p.qty ?? 0), 0) ?? 0;
        const partyAccObj = inv.partyacc;
        const partyaccStr = partyAccObj
          ? partyLabel(partyAccObj) || "Unknown"
          : "Unknown";
        const productNames = productLinesOf(inv.productservice);
        const productIds = (inv.productservice ?? []).map((p: any) => p.productserviceid?.id);

        return {
          seqNo: idx + 1,
          billNo: `INV-${inv.billnumber}`,
          billdate: formatDateDMY(inv.billdate),
          billdateYMD: normalizeToYMD(inv.billdate) || "",
          partyacc: partyaccStr,
          partyaccId: partyAccObj?.id || "Unknown",
          paymenttype: cap(inv.paymenttype),
          productname: productNames,
          productIds,
          totalitem: inv.productservice?.length ?? 0,
          totalqty,
          totaldiscount: Number(inv.totaldiscount || 0).toFixed(2),
          totalgst: Number(inv.totalgst || 0).toFixed(2),
          totalamount: inv.totalamount,
          status: inv.status ? "Active" : "Inactive",
        };
      })
      .filter((row) => {
        let ok = true;
        if (appliedFilters.partyacc) ok = ok && row.partyaccId === appliedFilters.partyacc;
        const pf = appliedFilters.productIds;
        if (pf) {
          if (Array.isArray(pf) && pf.length > 0) {
            const selected = pf.map((p: any) => (typeof p === "string" ? p : p.value ?? p));
            ok = ok && row.productIds.some((id: any) => selected.includes(id));
          } else if (typeof pf === "string") {
            ok = ok && row.productIds.includes(pf);
          } else if (typeof pf === "object" && pf.value) {
            ok = ok && row.productIds.includes(pf.value);
          }
        }
        if (appliedFilters.status) ok = ok && row.status === appliedFilters.status;
        if (appliedFilters.paymenttype) ok = ok && row.paymenttype === appliedFilters.paymenttype;
        if (appliedFilters.fromDate) ok = ok && row.billdateYMD >= appliedFilters.fromDate;
        if (appliedFilters.toDate) ok = ok && row.billdateYMD <= appliedFilters.toDate;
        return ok;
      });
  }, [invoiceList, appliedFilters]);

  // ── Sales Order Data ──
  const orderTableData = useMemo(() => {
    return salesOrders
      .filter((o: any) => {
        const date = normalizeToYMD(o.billdate) || "";
        if (appliedFilters.fromDate && date < appliedFilters.fromDate) return false;
        if (appliedFilters.toDate && date > appliedFilters.toDate) return false;
        if (appliedFilters.partyacc && o.partyacc?.id !== appliedFilters.partyacc) return false;
        if (appliedFilters.paymenttype && o.paymenttype?.toLowerCase() !== appliedFilters.paymenttype.toLowerCase()) return false;
        if (appliedFilters.orderStatus && orderStage(o) !== String(appliedFilters.orderStatus).toLowerCase()) return false;
        return true;
      })
      .map((o: any, idx: number) => {
        const totalQty = (o.productservice || []).reduce((s: number, p: any) => s + (p.qty || 0), 0);
        return {
          seqNo: idx + 1,
          orderNo: `SO-${o.billnumber}`,
          orderDate: formatDateDMY(o.billdate),
          partyName: o.partyacc
            ? partyLabel(o.partyacc) || "-"
            : "-",
          products: productLinesOf(o.productservice),
          paymentType: cap(o.paymenttype),
          totalItems: (o.productservice || []).length,
          totalQty,
          discount: Number(o.totaldiscount || 0).toFixed(2),
          gst: Number(o.totalgst || 0).toFixed(2),
          totalAmount: Number(o.totalamount || 0).toFixed(2),
          status: STAGE_LABEL[orderStage(o)],
        };
      });
  }, [salesOrders, appliedFilters]);

  // ── Sales Return Data ──
  const returnTableData = useMemo(() => {
    return salesReturns
      .filter((r: any) => {
        const date = normalizeToYMD(r.returndate) || "";
        if (appliedFilters.fromDate && date < appliedFilters.fromDate) return false;
        if (appliedFilters.toDate && date > appliedFilters.toDate) return false;
        if (appliedFilters.partyacc && r.partyacc?.id !== appliedFilters.partyacc) return false;
        return true;
      })
      .map((r: any, idx: number) => {
        const totalQty = (r.productservice || []).reduce((s: number, p: any) => s + (p.qty || 0), 0);
        return {
          seqNo: idx + 1,
          cnNo: String(r.billnumber || "").startsWith("CN-") ? r.billnumber : `CN-${r.billnumber}`,
          returnDate: formatDateDMY(r.returndate),
          sourceInvoice: r.sourceBillNumber || "-",
          partyName: r.partyacc
            ? partyLabel(r.partyacc) || "-"
            : "-",
          paymentType: cap(r.paymenttype),
          products: productLinesOf(r.productservice),
          totalItems: (r.productservice || []).length,
          totalQty,
          discount: Number(r.totaldiscount || 0).toFixed(2),
          gst: Number(r.totalgst || 0).toFixed(2),
          totalAmount: Number(r.totalamount || 0).toFixed(2),
          refundMode: cap(r.refundMode),
          reason: r.reason || "-",
          status: cap(r.status),
        };
      });
  }, [salesReturns, appliedFilters]);

  // ── Per-tab config ──
  const partyOptions = useMemo(
    // Party dropdown lists Customer and Both accounts.
    () =>
      accountsList
        .filter((a: any) => {
          const t = String(a.type || "").toLowerCase();
          return t === "customer" || t === "both";
        })
        .map((a: any) => ({ label: a.accountname || a.name, value: a.id })),
    [accountsList]
  );
  const productOptions = useMemo(
    () => productList.map((p: any) => ({ label: p.name, value: p.id })),
    [productList]
  );

  let tableData: any[] = [];
  let columns: any[] = [];
  let filterFields: ReportFilterField[] = [];
  let title = "Sales Reports";
  let exportFileName = "SalesReport";

  switch (activeTab) {
    case "Sales Invoice":
      tableData = invoiceTableData;
      title = "Sales Invoice Report";
      exportFileName = "SalesInvoiceReport";
      columns = [
        { label: "Seq No", key: "seqNo" },
        { label: "Bill No", key: "billNo" },
        { label: "Date", key: "billdate" },
        { label: "Party A/c", key: "partyacc" },
        { label: "Payment Type", key: "paymenttype" },
        { label: "Product(s)", key: "productname" },
        { label: "Total Items", key: "totalitem", numeric: true },
        { label: "Total Qty", key: "totalqty", numeric: true },
        { label: "Discount (₹)", key: "totaldiscount", numeric: true },
        { label: "GST (₹)", key: "totalgst", numeric: true },
        { label: "Total Amount (₹)", key: "totalamount", numeric: true },
        { label: "Status", key: "status" },
      ];
      filterFields = [
        { name: "partyacc", label: "Party A/c", type: "select", options: partyOptions, searchable: true },
        { name: "productIds", label: "Product", type: "select", options: productOptions, searchable: true },
        { name: "paymenttype", label: "Payment Type", type: "select", options: [
          { label: "Cash", value: "Cash" },
          { label: "Credit", value: "Credit" },
          { label: "Online", value: "Online" },
        ]},
        { name: "fromDate", label: "From Date", type: "date" },
        { name: "toDate", label: "To Date", type: "date" },
        { name: "status", label: "Status", type: "select", options: [
          { label: "Active", value: "Active" },
          { label: "Inactive", value: "Inactive" },
        ]},
      ];
      break;

    case "Sales Order":
      tableData = orderTableData;
      title = "Sales Order Report";
      exportFileName = "SalesOrderReport";
      columns = [
        { label: "Seq No", key: "seqNo" },
        { label: "Order No", key: "orderNo" },
        { label: "Date", key: "orderDate" },
        { label: "Party", key: "partyName" },
        { label: "Payment Type", key: "paymentType" },
        { label: "Product(s)", key: "products" },
        { label: "Items", key: "totalItems", numeric: true },
        { label: "Qty", key: "totalQty", numeric: true },
        { label: "Discount (₹)", key: "discount", numeric: true },
        { label: "GST (₹)", key: "gst", numeric: true },
        { label: "Amount (₹)", key: "totalAmount", numeric: true },
        { label: "Status", key: "status" },
      ];
      filterFields = [
        { name: "fromDate", label: "From Date", type: "date" },
        { name: "toDate", label: "To Date", type: "date" },
        { name: "partyacc", label: "Party", type: "select", options: partyOptions, searchable: true },
        { name: "paymenttype", label: "Payment Type", type: "select", options: [
          { label: "Cash", value: "cash" },
          { label: "Credit", value: "credit" },
          { label: "Online", value: "online" },
        ]},
        { name: "orderStatus", label: "Status", type: "select", options: [
          { label: "Active", value: "active" },
          { label: "Converted", value: "converted" },
          { label: "Cancelled", value: "cancelled" },
        ]},
      ];
      break;

    case "Sales Return (CN)":
      tableData = returnTableData;
      title = "Sales Return Report (Credit Notes)";
      exportFileName = "SalesReturnReport";
      columns = [
        { label: "Seq No", key: "seqNo" },
        { label: "CN No", key: "cnNo" },
        { label: "Return Date", key: "returnDate" },
        { label: "Source Invoice", key: "sourceInvoice" },
        { label: "Party", key: "partyName" },
        { label: "Payment Mode", key: "paymentType" },
        { label: "Product(s)", key: "products" },
        { label: "Items", key: "totalItems", numeric: true },
        { label: "Qty", key: "totalQty", numeric: true },
        { label: "Discount (₹)", key: "discount", numeric: true },
        { label: "GST (₹)", key: "gst", numeric: true },
        { label: "Amount (₹)", key: "totalAmount", numeric: true },
        { label: "Reason", key: "reason" },
        { label: "Status", key: "status" },
      ];
      filterFields = [
        { name: "fromDate", label: "From Date", type: "date" },
        { name: "toDate", label: "To Date", type: "date" },
        { name: "partyacc", label: "Party", type: "select", options: partyOptions, searchable: true },
      ];
      break;
  }

  return (
    <HomeLayout>
      <div className="w-full p-4 font-sans">
        <div className="flex flex-wrap gap-2 mb-3">
          {reportTabs.map((tab) => {
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

        <ReportTable moduleId="reports.sales"
          title={title}
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
          exportFileName={exportFileName}
          isLoading={tabLoading}
          showTotals
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
