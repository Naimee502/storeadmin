import React, { useEffect, useRef, useState, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { addSalesInvoices } from "../../../redux/slices/salesinvoice";
import HomeLayout from "../../../layouts/home";
import { showLoading, hideLoading } from "../../../redux/slices/loader";
import { useSalesInvoicesQuery, useDeletedSalesInvoicesQuery } from "../../../graphql/hooks/salesinvoice";
import { useSalesOrdersQuery } from "../../../graphql/hooks/salesorder";
import { useSalesReturnsQuery } from "../../../graphql/hooks/salesreturn";
import { useAccountsQuery } from "../../../graphql/hooks/accounts";
import { useProductServicesQuery } from "../../../graphql/hooks/products";
import PrintableInvoice from "../../../components/printinvoice";
import type { ReportFilterField } from "../../../components/reporttable";
import ReportTable from "../../../components/reporttable";
import { normalizeToYMD, formatDateDMY } from "../../../utils/helper";
import { FaClipboardList, FaFileInvoiceDollar, FaUndoAlt } from "react-icons/fa";

const reportTabs = [
  { id: "Sales Order", label: "Sales Order", icon: <FaClipboardList className="text-amber-600" /> },
  { id: "Sales Invoice", label: "Sales Invoice", icon: <FaFileInvoiceDollar className="text-blue-600" /> },
  { id: "Sales Return (CN)", label: "Sales Return (CN)", icon: <FaUndoAlt className="text-rose-600" /> },
];

// "Product - Variant, Product2 - Variant2" from a productservice array
const productNamesOf = (items: any[]) =>
  (items || [])
    .map((p: any) => {
      const n = p.productserviceid?.name || "Unknown";
      const v = p.variantid?.name ? ` - ${p.variantid.name}` : "";
      return `${n}${v}`;
    })
    .join(", ") || "-";

// Safely capitalize a value that may be string | boolean | null | undefined
const cap = (val: any): string => {
  if (!val && val !== false) return "-";
  if (typeof val === "boolean") return val ? "Active" : "Inactive";
  const s = String(val);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const SalesReports: React.FC = () => {
  const dispatch = useAppDispatch();
  const isLoading = useAppSelector((state) => state.loader.isLoading);

  const [activeTab, setActiveTab] = useState(reportTabs[0].id);
  const [filters, setFilters] = useState<{ [key: string]: any }>({});
  const [appliedFilters, setAppliedFilters] = useState<{ [key: string]: any }>({});

  // -- Data
  const { data: activeData, refetch: refetchActive } = useSalesInvoicesQuery();
  const { data: deletedData, refetch: refetchDeleted } = useDeletedSalesInvoicesQuery();
  const { data: ordersData } = useSalesOrdersQuery();
  const { data: returnsData } = useSalesReturnsQuery();
  const { data: accountData } = useAccountsQuery();
  const { data: productData } = useProductServicesQuery();

  const activeInvoices = activeData?.getSalesInvoices || [];
  const deletedInvoices = deletedData?.getDeletedSalesInvoices || [];
  const salesOrders = ordersData?.getSalesOrders || [];
  const salesReturns = returnsData?.getSalesReturns || [];
  const accountsList = accountData?.getAccounts || [];
  const productList = productData?.getProductServices ?? [];

  const componentRef = useRef<HTMLDivElement>(null);
  const [printInvoice, setPrintInvoice] = useState<any>(null);

  // Default last 30 days
  useEffect(() => {
    const today = new Date();
    const to = today.toISOString().slice(0, 10);
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30)
      .toISOString().slice(0, 10);
    setFilters({ fromDate: from, toDate: to });
    setAppliedFilters({ fromDate: from, toDate: to });
  }, []);

  // Refetch invoices when status filter changes
  useEffect(() => {
    const fetchInvoices = async () => {
      dispatch(showLoading());
      try {
        const isDeleted = appliedFilters.status === "Inactive";
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

  // ── Sales Invoice Data ──
  const invoiceList =
    appliedFilters.status === "Inactive"
      ? deletedInvoices
      : appliedFilters.status === "Active"
      ? activeInvoices
      : [...activeInvoices, ...deletedInvoices];

  const invoiceTableData = useMemo(() => {
    return invoiceList
      .map((inv, idx) => {
        const totalqty = inv.productservice?.reduce((s: number, p: any) => s + (p.qty ?? 0), 0) ?? 0;
        const partyAccObj = inv.partyacc;
        const partyaccStr = partyAccObj
          ? `${partyAccObj.accountname || partyAccObj.name} - ${partyAccObj.mobile || ""}`
          : "Unknown";
        const productNames = (inv.productservice ?? [])
          .map((p: any) => {
            const prodName = p.productserviceid?.name || "Unknown";
            const variantName = p.variantid?.name ? ` - ${p.variantid.name}` : "";
            return `${prodName}${variantName}`;
          })
          .join(", ");
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
        if (appliedFilters.orderStatus && o.status?.toLowerCase() !== appliedFilters.orderStatus.toLowerCase()) return false;
        return true;
      })
      .map((o: any, idx: number) => {
        const totalQty = (o.productservice || []).reduce((s: number, p: any) => s + (p.qty || 0), 0);
        return {
          seqNo: idx + 1,
          orderNo: `SO-${o.billnumber}`,
          orderDate: formatDateDMY(o.billdate),
          partyName: o.partyacc
            ? `${o.partyacc.accountname || "-"}${o.partyacc.mobile ? ` - ${o.partyacc.mobile}` : ""}`
            : "-",
          products: productNamesOf(o.productservice),
          paymentType: cap(o.paymenttype),
          totalItems: (o.productservice || []).length,
          totalQty,
          discount: Number(o.totaldiscount || 0).toFixed(2),
          gst: Number(o.totalgst || 0).toFixed(2),
          totalAmount: Number(o.totalamount || 0).toFixed(2),
          status: cap(o.status),
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
            ? `${r.partyacc.accountname || "-"}${r.partyacc.mobile ? ` - ${r.partyacc.mobile}` : ""}`
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
  }, [salesReturns, appliedFilters]);

  // ── Per-tab config ──
  const partyOptions = accountsList.map((a) => ({ label: a.accountname || a.name, value: a.id }));
  const productOptions = productList.map((p) => ({ label: p.name, value: p.id }));

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
      <div className="w-full px-2 sm:px-6 pt-4 pb-6 font-sans">
        <div className="flex flex-wrap gap-2 mb-4">
          {reportTabs.map((tab) => {
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
          isLoading={isLoading}
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
