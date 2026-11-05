import React, { useRef, useState, useMemo } from "react";
import { useQuery } from "@apollo/client";
import { useAppSelector } from "../../../redux/hooks";
import HomeLayout from "../../../layouts/home";
import {
  GET_PURCHASE_INVOICES_REPORT,
  GET_DELETED_PURCHASE_INVOICES_REPORT,
  GET_PURCHASE_ORDERS_REPORT,
  GET_PURCHASE_RETURNS_REPORT,
  GET_PURCHASE_REPORT_PARTIES,
  GET_PURCHASE_REPORT_PRODUCTS,
} from "../../../graphql/queries/reports/purchase";
import PrintableInvoice from "../../../components/printinvoice";
import type { ReportFilterField } from "../../../components/reporttable";
import ReportTable from "../../../components/reporttable";
import { normalizeToYMD, formatDateDMY, todayYMD, shiftDaysYMD } from "../../../utils/helper";
import { FaClipboardList, FaFileInvoiceDollar, FaUndoAlt } from "react-icons/fa";
import { partyLabel } from "../../../utils/partylabel";

// Order lifecycle for the report's Status column/filter. `status` on an order
// is the soft-delete flag (true/false), not its stage — comparing it as text
// hid every order (sales) or crashed the page (purchase).
const orderStage = (o: any): "cancelled" | "converted" | "active" =>
  o?.cancelStatus === "cancelled" || o?.orderStatus === "cancelled"
    ? "cancelled"
    : o?.isConverted
      ? "converted"
      : "active";
const STAGE_LABEL = { active: "Active", converted: "Converted", cancelled: "Cancelled" } as const;

const reportTabs = [
  { id: "Purchase Order", label: "Purchase Order", icon: <FaClipboardList className="text-xs text-amber-600" /> },
  { id: "Purchase Invoice", label: "Purchase Invoice", icon: <FaFileInvoiceDollar className="text-xs text-blue-600" /> },
  { id: "Purchase Return (DN)", label: "Purchase Return (DN)", icon: <FaUndoAlt className="text-xs text-indigo-600" /> },
];

// One line per line item: "Product - Variant × Qty". ReportTable renders an
// array one item per line and exports it joined with "; ".
const productLine = (p: any, name?: string) => {
  const n = name || p.productserviceid?.name || "Unknown";
  const v = p.variantid?.name ? ` - ${p.variantid.name}` : "";
  return `${n}${v} × ${p.qty ?? 0}`;
};
const productNamesOf = (items: any[]): string[] => {
  const lines = (items || []).map((p: any) => productLine(p));
  return lines.length ? lines : ["-"];
};

// "YYYY-MM-DD" shifted by N days on the local calendar.
const shiftYMD = (ymd: string, days: number): string | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || "");
  if (!m) return null;
  return normalizeToYMD(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
};

// Safely capitalize a value that may be string | boolean | null | undefined
const cap = (val: any): string => {
  if (!val && val !== false) return "-";
  if (typeof val === "boolean") return val ? "Active" : "Inactive";
  const s = String(val);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const PurchaseReports: React.FC = () => {
  const isLoading = useAppSelector((state) => state.loader.isLoading);

  // Default last 30 days — set up front so the first fetch is already ranged.
  const [activeTab, setActiveTab] = useState(reportTabs[0].id);
  const [filters, setFilters] = useState<{ [key: string]: any }>(() => ({ fromDate: shiftDaysYMD(-30), toDate: todayYMD() }));
  const [appliedFilters, setAppliedFilters] = useState<{ [key: string]: any }>(() => ({ fromDate: shiftDaysYMD(-30), toDate: todayYMD() }));

  // -- Scope (same derivation as the purchase hooks)
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);
  const adminid = type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;
  const branchid = type === 'admin' ? selectedBranchId : type === 'branch' ? branch?.id : type === 'staff' ? staff?.branchid?.id : undefined;

  // Server-side date range for orders / returns. billdate / returndate are
  // stored as "YYYY-MM-DD…" strings and compared as strings, so the To bound
  // gets a "\uffff" suffix to keep anything stamped on the To day. The range is
  // widened by a day each side (timestamps saved in UTC); the exact range is
  // still applied client-side below.
  // Invoices are NOT ranged on the server: getPurchaseInvoices compares the
  // string billdate against `new Date(...)`, which never matches.
  const serverFrom = appliedFilters.fromDate ? shiftYMD(appliedFilters.fromDate, -1) : null;
  const serverToDay = appliedFilters.toDate ? shiftYMD(appliedFilters.toDate, 1) : null;
  const serverTo = serverToDay ? `${serverToDay}\uffff` : null;

  const isInvoiceTab = activeTab === "Purchase Invoice";
  const isOrderTab = activeTab === "Purchase Order";
  const isReturnTab = activeTab === "Purchase Return (DN)";

  // -- Data (only the active tab's documents are fetched)
  // Active invoices are ranged on the server too (resolver now compares text).
  const { data: activeData, loading: activeLoading } = useQuery(GET_PURCHASE_INVOICES_REPORT, {
    variables: {
      filter: {
        adminid,
        branchid,
        ...(serverFrom ? { billdateFrom: serverFrom } : {}),
        ...(serverTo ? { billdateTo: serverTo } : {}),
      },
    },
    skip: !adminid || !isInvoiceTab || appliedFilters.status === "Inactive",
    fetchPolicy: "cache-and-network",
  });
  const { data: deletedData, loading: deletedLoading } = useQuery(GET_DELETED_PURCHASE_INVOICES_REPORT, {
    variables: { filter: { adminid, branchid } },
    skip: !adminid || !isInvoiceTab || appliedFilters.status === "Active",
    fetchPolicy: "cache-and-network",
  });
  const { data: ordersData, loading: ordersLoading } = useQuery(GET_PURCHASE_ORDERS_REPORT, {
    variables: {
      filter: {
        adminid,
        branchid,
        ...(serverFrom ? { billdateFrom: serverFrom } : {}),
        ...(serverTo ? { billdateTo: serverTo } : {}),
      },
    },
    skip: !adminid || !isOrderTab,
    fetchPolicy: "cache-and-network",
  });
  const { data: returnsData, loading: returnsLoading } = useQuery(GET_PURCHASE_RETURNS_REPORT, {
    variables: {
      filter: {
        adminid,
        branchid,
        ...(serverFrom ? { returndateFrom: serverFrom } : {}),
        ...(serverTo ? { returndateTo: serverTo } : {}),
      },
    },
    skip: !adminid || !isReturnTab,
    fetchPolicy: "cache-and-network",
  });
  // Dropdown options only (Party / Product filters).
  const { data: accountData } = useQuery(GET_PURCHASE_REPORT_PARTIES, {
    variables: { filter: { admin: adminid, status: true } },
    skip: !adminid,
  });
  const { data: productData } = useQuery(GET_PURCHASE_REPORT_PRODUCTS, {
    variables: { filter: { adminid, branchid, status: true }, limit: 0, offset: 0 },
    skip: !adminid || !isInvoiceTab,
  });

  const dataLoading =
    (isInvoiceTab && (activeLoading || deletedLoading)) ||
    (isOrderTab && ordersLoading) ||
    (isReturnTab && returnsLoading);

  // Cancelled bills are left out, as usePurchaseInvoicesQuery does by default.
  const activeInvoices = useMemo(
    () =>
      [...(activeData?.getPurchaseInvoices || [])]
        .filter((i: any) => i?.cancelStatus !== "cancelled")
        .reverse(),
    [activeData]
  );
  const deletedInvoices = useMemo(() => [...(deletedData?.getDeletedPurchaseInvoices || [])].reverse(), [deletedData]);
  const purchaseOrders = useMemo(() => [...(ordersData?.getPurchaseOrders || [])].reverse(), [ordersData]);
  const purchaseReturns = useMemo(() => [...(returnsData?.getPurchaseReturns || [])].reverse(), [returnsData]);
  const accountsList: any[] = useMemo(() => accountData?.getAccounts || [], [accountData]);
  const productList: any[] = useMemo(() => productData?.getProductServices ?? [], [productData]);

  const componentRef = useRef<HTMLDivElement>(null);
  const [printInvoice, setPrintInvoice] = useState<any>(null);

  // ── Purchase Invoice Data ──
  const invoiceList = useMemo(
    () =>
      appliedFilters.status === "Inactive"
        ? deletedInvoices
        : appliedFilters.status === "Active"
        ? activeInvoices
        : [...activeInvoices, ...deletedInvoices],
    [appliedFilters.status, activeInvoices, deletedInvoices]
  );

  const accountById = useMemo(() => new Map(accountsList.map((a: any) => [a.id, a])), [accountsList]);
  const productNameById = useMemo(() => new Map(productList.map((p: any) => [p.id, p.name])), [productList]);

  const invoiceTableData = useMemo(() => {
    return invoiceList
      .map((inv: any, idx: number) => {
        const totalqty = inv.productservice?.reduce((s: number, p: any) => s + (p.qty ?? 0), 0) ?? 0;
        const partyAccObj = accountById.get(inv.partyacc?.id || inv.partyacc);
        const partyaccStr = partyAccObj
          ? partyLabel(partyAccObj) || "Unknown"
          : inv.partyacc?.accountname
          ? partyLabel(inv.partyacc) || "Unknown"
          : "Unknown";
        const productNames: string[] = (inv.productservice ?? []).map((p: any) =>
          productLine(p, productNameById.get(p.productserviceid?.id || p.productserviceid))
        );
        const productIds = (inv.productservice ?? []).map(
          (p: any) => p.productserviceid?.id || p.productserviceid
        );

        return {
          seqNo: idx + 1,
          billNo: `INV-${inv.billnumber}`,
          billdate: formatDateDMY(inv.billdate),
          billdateYMD: normalizeToYMD(inv.billdate) || "",
          partyacc: partyaccStr,
          partyaccId: partyAccObj?.id || inv.partyacc?.id || "Unknown",
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
  }, [invoiceList, appliedFilters, accountById, productNameById]);

  // ── Purchase Order Data ──
  const orderTableData = useMemo(() => {
    return purchaseOrders
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
          orderNo: `PO-${o.billnumber}`,
          orderDate: formatDateDMY(o.billdate),
          partyName: o.partyacc
            ? partyLabel(o.partyacc) || "-"
            : "-",
          products: productNamesOf(o.productservice),
          paymentType: cap(o.paymenttype),
          totalItems: (o.productservice || []).length,
          totalQty,
          discount: Number(o.totaldiscount || 0).toFixed(2),
          gst: Number(o.totalgst || 0).toFixed(2),
          totalAmount: Number(o.totalamount || 0).toFixed(2),
          status: STAGE_LABEL[orderStage(o)],
        };
      });
  }, [purchaseOrders, appliedFilters]);

  // ── Purchase Return Data ──
  const returnTableData = useMemo(() => {
    return purchaseReturns
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
          dnNo: String(r.billnumber || "").startsWith("DN-") ? r.billnumber : `DN-${r.billnumber}`,
          returnDate: formatDateDMY(r.returndate),
          sourceInvoice: r.sourceBillNumber || "-",
          partyName: r.partyacc
            ? partyLabel(r.partyacc) || "-"
            : "-",
          paymentType: cap(r.paymenttype),
          products: productNamesOf(r.productservice),
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
  }, [purchaseReturns, appliedFilters]);

  // ── Per-tab config ──
  // Purchase is bought from vendors — the Party dropdown lists Vendor and
  // Both accounts only (customers / expense ledgers are left out). The full
  // accountsList is still used for labels, so old bills keep their party name.
  const partyOptions = useMemo(
    () =>
      accountsList
        .filter((a: any) => {
          const t = String(a.type || "").toLowerCase();
          return t === "vendor" || t === "both";
        })
        .map((a: any) => ({ label: a.accountname || a.name, value: a.id })),
    [accountsList]
  );
  const productOptions = useMemo(() => productList.map((p: any) => ({ label: p.name, value: p.id })), [productList]);

  let tableData: any[] = [];
  let columns: any[] = [];
  let filterFields: ReportFilterField[] = [];
  let title = "Purchase Reports";
  let exportFileName = "PurchaseReport";

  switch (activeTab) {
    case "Purchase Invoice":
      tableData = invoiceTableData;
      title = "Purchase Invoice Report";
      exportFileName = "PurchaseInvoiceReport";
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
        { name: "partyacc", label: "Party A/c (Vendor)", placeholder: "Select Party A/c", type: "select", options: partyOptions, searchable: true },
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

    case "Purchase Order":
      tableData = orderTableData;
      title = "Purchase Order Report";
      exportFileName = "PurchaseOrderReport";
      columns = [
        { label: "Seq No", key: "seqNo" },
        { label: "Order No", key: "orderNo" },
        { label: "Date", key: "orderDate" },
        { label: "Party (Vendor)", key: "partyName" },
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
        { name: "partyacc", label: "Party (Vendor)", type: "select", options: partyOptions, searchable: true },
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

    case "Purchase Return (DN)":
      tableData = returnTableData;
      title = "Purchase Return Report (Debit Notes)";
      exportFileName = "PurchaseReturnReport";
      columns = [
        { label: "Seq No", key: "seqNo" },
        { label: "DN No", key: "dnNo" },
        { label: "Return Date", key: "returnDate" },
        { label: "Source Invoice", key: "sourceInvoice" },
        { label: "Party (Vendor)", key: "partyName" },
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
        { name: "partyacc", label: "Party (Vendor)", type: "select", options: partyOptions, searchable: true },
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

        <ReportTable moduleId="reports.purchase"
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
          isLoading={isLoading || dataLoading}
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

export default PurchaseReports;
