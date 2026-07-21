import React, { useState, useEffect } from "react";
import {
  FaFileInvoiceDollar,
  FaClipboardList,
  FaUndoAlt,
  FaExchangeAlt,
  FaMoneyCheckAlt,
  FaCalendarCheck,
} from "react-icons/fa";
import DataTable from "../datatable";
import { useAppSelector } from "../../redux/hooks";
import { selectIsModuleAllowed } from "../../redux/slices/permissions";
import { formatDateDMY } from "../../utils/helper";

interface RecentOrdersProps {
  salesInvoiceData?: any;
  customerData?: any;
  purchaseInvoiceData?: any;
  salesOrders?: any[];
  purchaseOrders?: any[];
  salesReturns?: any[];
  purchaseReturns?: any[];
  transferStockData?: any;
  expenseNotes?: any[];
  payments?: any[];
  leaveRequests?: any[];
  branchesData?: any;
  productData?: any;
}

const RecentOrders: React.FC<RecentOrdersProps> = ({
  salesInvoiceData,
  purchaseInvoiceData,
  salesOrders = [],
  purchaseOrders = [],
  salesReturns = [],
  purchaseReturns = [],
  transferStockData,
  expenseNotes = [],
  payments = [],
  leaveRequests = [],
  branchesData,
  productData,
}) => {
  const [activeTab, setActiveTab] = useState<string>("salesinvoices");

  const fullState = useAppSelector((state: any) => state);
  const isAllowed = (moduleId: string) => selectIsModuleAllowed(fullState, moduleId);

  const salesInvoices = Array.isArray(salesInvoiceData?.getSalesInvoices) ? salesInvoiceData.getSalesInvoices : [];
  const purchaseInvoices = Array.isArray(purchaseInvoiceData?.getPurchaseInvoices) ? purchaseInvoiceData.getPurchaseInvoices : [];
  const transferStocks = Array.isArray(transferStockData?.getTransferStocks) ? transferStockData.getTransferStocks : [];
  const branches = Array.isArray(branchesData?.getBranches) ? branchesData.getBranches : [];
  const allProducts = Array.isArray(productData?.getProductServices) ? productData.getProductServices : [];

  // Same resolution used by the Transfer Stock module list — the transfer
  // query only returns raw branch/product ids, not populated names, and
  // transferunitid points at one of the product variant's own unit
  // conversions (or its base unit).
  const productNameOf = (item: any) => {
    const product = allProducts.find((p: any) => p.id === item.productid);
    if (!product) return "-";
    const variant = (product.productvariants || []).find((v: any) => v.id === item.variantid);
    return variant?.name ? `${product.name} - ${variant.name}` : product.name;
  };

  const unitNameOf = (item: any) => {
    const product = allProducts.find((p: any) => p.id === item.productid);
    const variant = (product?.productvariants || []).find((v: any) => v.id === item.variantid);
    if (!variant) return "";
    const uc = (variant.unitconversions || []).find(
      (u: any) => (typeof u.unitid === "object" ? u.unitid?.id : u.unitid) === item.transferunitid
    );
    if (uc) return typeof uc.unitid === "object" ? uc.unitid?.unitname || "" : "";
    if (variant.baseunitid) {
      const baseId = typeof variant.baseunitid === "object" ? variant.baseunitid.id : variant.baseunitid;
      if (baseId === item.transferunitid) {
        return typeof variant.baseunitid === "object" ? variant.baseunitid.unitname || "" : "";
      }
    }
    return "";
  };

  const stackedCell = (items: any[], render: (item: any) => any) => (
    <div className="flex flex-col gap-0">
      {(items || []).map((it, i) => (
        <div key={i} className="py-0.5 border-b border-gray-50 last:border-0 border-dashed">
          {render(it)}
        </div>
      ))}
    </div>
  );

  const rawTabs = [
    { id: "salesorders", moduleId: "salesorder", label: "Sales Orders", count: salesOrders.length, icon: <FaClipboardList className="text-emerald-600" /> },
    { id: "salesinvoices", moduleId: "salesinvoice", label: "Sales Invoices", count: salesInvoices.length, icon: <FaFileInvoiceDollar className="text-blue-600" /> },
    { id: "salesreturns", moduleId: "salesreturn", label: "Sales Returns", count: salesReturns.length, icon: <FaUndoAlt className="text-rose-600" /> },
    { id: "purchaseorders", moduleId: "purchaseorder", label: "Purchase Orders", count: purchaseOrders.length, icon: <FaClipboardList className="text-amber-600" /> },
    { id: "purchaseinvoices", moduleId: "purchaseinvoice", label: "Purchase Invoices", count: purchaseInvoices.length, icon: <FaFileInvoiceDollar className="text-cyan-700" /> },
    { id: "purchasereturns", moduleId: "purchasereturn", label: "Purchase Returns", count: purchaseReturns.length, icon: <FaUndoAlt className="text-indigo-600" /> },
    { id: "transfers", moduleId: "transferstock", label: "Transfer Stock", count: transferStocks.length, icon: <FaExchangeAlt className="text-teal-600" /> },
    { id: "expenses", moduleId: "expensenote", label: "Expense Notes", count: expenseNotes.length, icon: <FaMoneyCheckAlt className="text-purple-600" /> },
    { id: "payments", moduleId: "payments", label: "Payments", count: payments.length, icon: <FaMoneyCheckAlt className="text-cyan-600" /> },
    { id: "leaves", moduleId: "attendance", label: "Attendance & Leave", count: leaveRequests.length, icon: <FaCalendarCheck className="text-orange-600" /> },
  ];

  const tabs = rawTabs.filter((t) => isAllowed(t.moduleId));

  useEffect(() => {
    if (tabs.length > 0 && !tabs.some((t) => t.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [fullState, activeTab]);

  if (tabs.length === 0) return null;

  const capitalizeFirst = (text?: string | null) =>
    text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : "-";

  const CATEGORY_LABEL: Record<string, string> = {
    general: "General",
    tada: "TA/DA",
    salary: "Salary",
    other: "Other",
  };

  const renderTableContent = () => {
    switch (activeTab) {
      case "salesinvoices": {
        const columns = [
          { label: "Seq Number", key: "seqNo" },
          { label: "Payment Type", key: "paymenttype" },
          { label: "Party A/c", key: "partyacc" },
          { label: "Total Items", key: "totalitem" },
          { label: "Total Qty", key: "totalqty" },
          { label: "Billing Date", key: "billdate" },
          { label: "Billing No", key: "billtype_billnumber" },
          { label: "Total Amount", key: "totalamountFormatted" },
          { label: "Created By", key: "createdby_name" },
          { label: "Status", key: "status" },
        ];
        const data = salesInvoices.slice().reverse().map((item: any, idx: number) => {
          const totalqty = (item.productservice || []).reduce(
            (sum: number, p: any) => sum + (p.qty || 0),
            0
          );
          return {
            ...item,
            seqNo: idx + 1,
            partyacc: `${item.partyacc?.accountname ?? "N/A"} - ${item.partyacc?.mobile ?? "N/A"}`,
            totalitem: (item.productservice || []).length,
            totalqty,
            billdate: item.billdate ? formatDateDMY(item.billdate) : "-",
            billtype_billnumber: `INV-${item.billnumber}`,
            paymenttype: capitalizeFirst(item.paymenttype || "Cash"),
            totalamountFormatted: `₹${Number(item.totalamount ?? 0).toFixed(2)}`,
            createdby_name: item.createdby_name || "N/A",
            status: item.status ? "Active" : "Inactive",
          };
        });
        return (
          <DataTable
            title="Sales Invoices"
            columns={columns}
            data={data}
            showAdd={false}
            showDeleted={false}
            showImport={false}
            showExport={false}
            showPrint={false}
            showView={false}
            showEdit={false}
            showDelete={false}
            showActionsColumn={false}
            defaultEntriesPerPage={5}
            entriesOptions={[5, 10, 25, 50]}
          />
        );
      }

      case "purchaseinvoices": {
        const columns = [
          { label: "Seq Number", key: "seqNo" },
          { label: "Payment Type", key: "paymenttype" },
          { label: "Party A/c", key: "partyacc" },
          { label: "Total Items", key: "totalitem" },
          { label: "Total Qty", key: "totalqty" },
          { label: "Billing Date", key: "billdate" },
          { label: "Billing No", key: "billtype_billnumber" },
          { label: "Total Amount", key: "totalamountFormatted" },
          { label: "Created By", key: "createdby_name" },
          { label: "Status", key: "status" },
        ];
        // getPurchaseInvoices has no server-side sort (natural/insertion
        // order), so reverse here to put the newest voucher on top — same
        // as Sales Invoices/Orders and Purchase Orders below.
        const data = purchaseInvoices.slice().reverse().map((item: any, idx: number) => {
          const totalqty = (item.productservice || []).reduce(
            (sum: number, p: any) => sum + (p.qty || 0),
            0
          );
          return {
            ...item,
            seqNo: idx + 1,
            partyacc: `${item.partyacc?.accountname ?? "N/A"} - ${item.partyacc?.mobile ?? "N/A"}`,
            totalitem: (item.productservice || []).length,
            totalqty,
            billdate: item.billdate ? formatDateDMY(item.billdate) : "-",
            billtype_billnumber: `INV-${item.billnumber}`,
            paymenttype: capitalizeFirst(item.paymenttype || "Cash"),
            totalamountFormatted: `₹${Number(item.totalamount ?? 0).toFixed(2)}`,
            createdby_name: item.createdby_name || "N/A",
            status: item.status ? "Active" : "Inactive",
          };
        });
        return (
          <DataTable
            title="Purchase Invoices"
            columns={columns}
            data={data}
            showAdd={false}
            showDeleted={false}
            showImport={false}
            showExport={false}
            showPrint={false}
            showView={false}
            showEdit={false}
            showDelete={false}
            showActionsColumn={false}
            defaultEntriesPerPage={5}
            entriesOptions={[5, 10, 25, 50]}
          />
        );
      }

      case "salesorders": {
        const columns = [
          { label: "Seq Number", key: "seqNo" },
          { label: "Payment Type", key: "paymenttype" },
          { label: "Party A/c", key: "partyacc" },
          { label: "Total Items", key: "totalitem" },
          { label: "Total Qty", key: "totalqty" },
          { label: "Order Date", key: "billdate" },
          { label: "Order No", key: "billtype_billnumber" },
          { label: "Total Amount", key: "totalamountFormatted" },
          { label: "Created By", key: "createdby_name" },
          { label: "Status", key: "status" },
        ];
        const data = salesOrders.slice().reverse().map((item: any, idx: number) => {
          const totalqty = (item.productservice || []).reduce(
            (sum: number, p: any) => sum + (p.qty || 0),
            0
          );
          return {
            ...item,
            seqNo: idx + 1,
            partyacc: `${item.partyacc?.accountname ?? "N/A"} - ${item.partyacc?.mobile ?? "N/A"}`,
            totalitem: (item.productservice || []).length,
            totalqty,
            billdate: item.billdate ? formatDateDMY(item.billdate) : "-",
            billtype_billnumber: `SO-${item.billnumber}`,
            paymenttype: capitalizeFirst(item.paymenttype || "Cash"),
            totalamountFormatted: `₹${Number(item.totalamount ?? 0).toFixed(2)}`,
            createdby_name: item.createdby_name || "N/A",
            status: item.cancelStatus === "cancelled" ? "Cancelled" : (item.status ? "Active" : "Inactive"),
          };
        });
        return (
          <DataTable
            title="Sales Orders"
            columns={columns}
            data={data}
            showAdd={false}
            showDeleted={false}
            showImport={false}
            showExport={false}
            showPrint={false}
            showView={false}
            showEdit={false}
            showDelete={false}
            showActionsColumn={false}
            defaultEntriesPerPage={5}
            entriesOptions={[5, 10, 25, 50]}
          />
        );
      }

      case "purchaseorders": {
        const columns = [
          { label: "Seq Number", key: "seqNo" },
          { label: "Payment Type", key: "paymenttype" },
          { label: "Party A/c", key: "partyacc" },
          { label: "Total Items", key: "totalitem" },
          { label: "Total Qty", key: "totalqty" },
          { label: "Order Date", key: "billdate" },
          { label: "Order No", key: "billtype_billnumber" },
          { label: "Total Amount", key: "totalamountFormatted" },
          { label: "Created By", key: "createdby_name" },
          { label: "Status", key: "status" },
        ];
        const data = purchaseOrders.slice().reverse().map((item: any, idx: number) => {
          const totalqty = (item.productservice || []).reduce(
            (sum: number, p: any) => sum + (p.qty || 0),
            0
          );
          return {
            ...item,
            seqNo: idx + 1,
            partyacc: `${item.partyacc?.accountname ?? "N/A"} - ${item.partyacc?.mobile ?? "N/A"}`,
            totalitem: (item.productservice || []).length,
            totalqty,
            billdate: item.billdate ? formatDateDMY(item.billdate) : "-",
            billtype_billnumber: `PO-${item.billnumber}`,
            paymenttype: capitalizeFirst(item.paymenttype || "Cash"),
            totalamountFormatted: `₹${Number(item.totalamount ?? 0).toFixed(2)}`,
            createdby_name: item.createdby_name || "N/A",
            status: item.cancelStatus === "cancelled" ? "Cancelled" : (item.status ? "Active" : "Inactive"),
          };
        });
        return (
          <DataTable
            title="Purchase Orders"
            columns={columns}
            data={data}
            showAdd={false}
            showDeleted={false}
            showImport={false}
            showExport={false}
            showPrint={false}
            showView={false}
            showEdit={false}
            showDelete={false}
            showActionsColumn={false}
            defaultEntriesPerPage={5}
            entriesOptions={[5, 10, 25, 50]}
          />
        );
      }

      case "salesreturns": {
        const columns = [
          { label: "Seq", key: "seqNo" },
          { label: "CN No", key: "cnNo" },
          { label: "Against", key: "sourceBillNumber" },
          { label: "Date", key: "returndate" },
          { label: "Customer", key: "partyacc" },
          { label: "Items", key: "totalitem" },
          { label: "Total Qty", key: "totalqty" },
          { label: "Amount", key: "totalamountFormatted" },
          { label: "Refund", key: "refundLabel" },
          { label: "Created By", key: "createdby_name" },
          { label: "Status", key: "statusLabel" },
        ];
        const data = salesReturns.slice().reverse().map((r: any, idx: number) => ({
          ...r,
          seqNo: idx + 1,
          cnNo: `${r.billnumber}`,
          sourceBillNumber: r.sourceBillNumber || "N/A",
          returndate: formatDateDMY(r.returndate || r.createdAt) || "-",
          partyacc: `${r.partyacc?.accountname ?? "N/A"} - ${r.partyacc?.mobile ?? ""}`,
          totalitem: r.productservice?.length || 0,
          totalqty: r.productservice?.reduce((s: number, p: any) => s + (p.qty || 0), 0) || 0,
          totalamountFormatted: `₹${Number(r.totalamount ?? 0).toFixed(2)}`,
          refundLabel: capitalizeFirst(r.refundMode),
          createdby_name: r.createdby_name || "N/A",
          statusLabel: r.status ? "Active" : "Inactive",
        }));
        return (
          <DataTable
            title="Sales Returns"
            columns={columns}
            data={data}
            showAdd={false}
            showDeleted={false}
            showImport={false}
            showExport={false}
            showPrint={false}
            showView={false}
            showEdit={false}
            showDelete={false}
            showActionsColumn={false}
            defaultEntriesPerPage={5}
            entriesOptions={[5, 10, 25, 50]}
          />
        );
      }

      case "purchasereturns": {
        const columns = [
          { label: "Seq", key: "seqNo" },
          { label: "DN No", key: "dnNo" },
          { label: "Against", key: "sourceBillNumber" },
          { label: "Date", key: "returndate" },
          { label: "Vendor", key: "partyacc" },
          { label: "Items", key: "totalitem" },
          { label: "Total Qty", key: "totalqty" },
          { label: "Amount", key: "totalamountFormatted" },
          { label: "Refund", key: "refundLabel" },
          { label: "Created By", key: "createdby_name" },
          { label: "Status", key: "statusLabel" },
        ];
        const data = purchaseReturns.slice().reverse().map((r: any, idx: number) => ({
          ...r,
          seqNo: idx + 1,
          dnNo: `${r.billnumber}`,
          sourceBillNumber: r.sourceBillNumber || "N/A",
          returndate: formatDateDMY(r.returndate || r.createdAt) || "-",
          partyacc: `${r.partyacc?.accountname ?? "N/A"} - ${r.partyacc?.mobile ?? ""}`,
          totalitem: r.productservice?.length || 0,
          totalqty: r.productservice?.reduce((s: number, p: any) => s + (p.qty || 0), 0) || 0,
          totalamountFormatted: `₹${Number(r.totalamount ?? 0).toFixed(2)}`,  
          refundLabel: capitalizeFirst(r.refundMode),
          createdby_name: r.createdby_name || "N/A",
          statusLabel: r.status ? "Active" : "Inactive",
        }));
        return (
          <DataTable
            title="Purchase Returns"
            columns={columns}
            data={data}
            showAdd={false}
            showDeleted={false}
            showImport={false}
            showExport={false}
            showPrint={false}
            showView={false}
            showEdit={false}
            showDelete={false}
            showActionsColumn={false}
            defaultEntriesPerPage={5}
            entriesOptions={[5, 10, 25, 50]}
          />
        );
      }

      case "transfers": {
        const columns = [
          { label: "Voucher #", key: "vouchernumber" },
          { label: "From Branch", key: "frombranchname" },
          { label: "To Branch", key: "tobranchname" },
          { label: "Product", key: "productCell" },
          { label: "Qty", key: "qtyCell" },
          { label: "Purchase Rate", key: "rateCell" },
          { label: "Total Value", key: "totalamountFormatted" },
          { label: "Date", key: "transferdate" },
          { label: "Created By", key: "createdby_name" },
          { label: "Status", key: "statusLabel" },
        ];
        // Server already returns these newest-first (sort createdAt:-1) —
        // don't re-reverse, or the dashboard ends up oldest-first instead.
        const data = transferStocks.map((stock: any, idx: number) => {
          const fromBranch = branches.find((b: any) => b.id === stock.frombranchid);
          const toBranch = branches.find((b: any) => b.id === stock.tobranchid);
          const items = stock.items || [];
          return {
            ...stock,
            seqNo: idx + 1,
            frombranchname: fromBranch?.branchname || stock.frombranchid || "-",
            tobranchname: toBranch?.branchname || stock.tobranchid || "-",
            productCell: stackedCell(items, (it) => productNameOf(it)),
            qtyCell: stackedCell(items, (it) => `${it.transferqty} ${unitNameOf(it)}`.trim()),
            rateCell: stackedCell(items, (it) => `₹${Number(it.rate || 0).toFixed(2)}`),
            transferdate: formatDateDMY(stock.transferdate || stock.createdAt),
            totalamountFormatted: `₹${Number(stock.totalamount ?? 0).toFixed(2)}`,
            createdby_name: stock.createdby_name || "N/A",
            statusLabel: stock.status ? "Active" : "Inactive",
          };
        });
        return (
          <DataTable
            title="Stock Transfers"
            columns={columns}
            data={data}
            showAdd={false}
            showDeleted={false}
            showImport={false}
            showExport={false}
            showPrint={false}
            showView={false}
            showEdit={false}
            showDelete={false}
            showActionsColumn={false}
            defaultEntriesPerPage={5}
            entriesOptions={[5, 10, 25, 50]}
          />
        );
      }

      case "expenses": {
        const columns = [
          { label: "Seq", key: "seqNo" },
          { label: "Expense No", key: "expensenumber" },
          { label: "Date", key: "expensedate" },
          { label: "Category", key: "categoryLabel" },
          { label: "Staff", key: "staffLabel" },
          { label: "Ledger", key: "ledgername" },
          { label: "Payment Type", key: "paymenttype" },
          { label: "Narration", key: "narration" },
          { label: "Total Amount", key: "totalamountFormatted" },
          { label: "Created By", key: "createdby_name" },
          { label: "Status", key: "status" },
        ];
        // Server already returns these newest-first (sort expensedate:-1,
        // createdAt:-1) — don't re-reverse.
        const data = expenseNotes.map((exp: any, idx: number) => {
          let formattedDate = "-";
          if (exp.expensedate) {
            const timestamp = Number(exp.expensedate);
            const dt = new Date(timestamp);
            if (!isNaN(dt.getTime())) {
              formattedDate = formatDateDMY(dt);
            }
          }
          const staffLabel = exp.staffid
            ? `${exp.staffid.name}${exp.staffid.staffcode ? ` (${exp.staffid.staffcode})` : ""}`
            : "-";

          return {
            ...exp,
            seqNo: idx + 1,
            expensenumber: exp.expensenumber || exp.billnumber || "-",
            expensedate: formattedDate,
            categoryLabel: CATEGORY_LABEL[exp.category || "general"] || "General",
            staffLabel,
            ledgername: exp.ledgerid?.ledgername || "-",
            paymenttype: capitalizeFirst(exp.paymenttype || exp.paymentmode),
            narration: exp.narration || exp.remarks || "-",
            totalamountFormatted: `₹${Number(exp.totalamount || exp.amount || 0).toFixed(2)}`,
            createdby_name: exp.createdby_name || "N/A",
            totalgstFormatted: `₹${Number(exp.totalgst || 0).toFixed(2)}`,
            status: exp.status ? "Active" : "Inactive",
          };
        });
        return (
          <DataTable
            title="Expense Notes"
            columns={columns}
            data={data}
            showAdd={false}
            showDeleted={false}
            showImport={false}
            showExport={false}
            showPrint={false}
            showView={false}
            showEdit={false}
            showDelete={false}
            showActionsColumn={false}
            defaultEntriesPerPage={5}
            entriesOptions={[5, 10, 25, 50]}
          />
        );
      }

      case "payments": {
        const columns = [
          { label: "Seq", key: "seqNo" },
          { label: "Code", key: "paymentcode" },
          { label: "Type", key: "type" },
          { label: "Mode", key: "mode" },
          { label: "Date", key: "paymentdate" },
          { label: "Ledger", key: "ledgername" },
          { label: "Amount", key: "amountFormatted" },
          { label: "Created By", key: "createdby_name" },
          { label: "Status", key: "status" },
        ];
        const data = payments.slice().reverse().map((pay: any, idx: number) => {
          let formattedDate = "-";
          if (pay.paymentdate) {
            const ts = Number(pay.paymentdate);
            const dt = new Date(ts);
            if (!isNaN(dt.getTime())) formattedDate = formatDateDMY(dt);
          }
          return {
            ...pay,
            seqNo: idx + 1,
            paymentcode: pay.paymentcode || pay.billnumber || "-",
            paymentdate: formattedDate,
            type: capitalizeFirst(pay.type),
            mode: capitalizeFirst(pay.mode),
            ledgername: pay.ledgerid?.ledgername || "-",
            amountFormatted: `₹${Number(pay.amount || pay.totalamount || 0).toFixed(2)}`,
            createdby_name: pay.createdby_name || "N/A",
            status: pay.status ? "Active" : "Inactive",
          };
        });
        return (
          <DataTable
            title="Payments"
            columns={columns}
            data={data}
            showAdd={false}
            showDeleted={false}
            showImport={false}
            showExport={false}
            showPrint={false}
            showView={false}
            showEdit={false}
            showDelete={false}
            showActionsColumn={false}
            defaultEntriesPerPage={5}
            entriesOptions={[5, 10, 25, 50]}
          />
        );
      }

      case "leaves": {
        const columns = [
          { label: "Seq", key: "seqNo" },
          { label: "Staff", key: "staffName" },
          { label: "Type", key: "typeName" },
          { label: "Dates", key: "range" },
          { label: "Days", key: "totalDays" },
          { label: "Status", key: "status" },
          { label: "Reason", key: "reason" },
        ];
        // Server already returns these newest-first (sort createdAt:-1) —
        // don't re-reverse.
        const data = leaveRequests.map((r: any, idx: number) => ({
          ...r,
          seqNo: idx + 1,
          staffName: capitalizeFirst(r.staffid?.name),
          typeName: capitalizeFirst(r.leavetypeid?.name),
          range: `${formatDateDMY(r.fromDate || r.fromdate)} → ${formatDateDMY(r.toDate || r.todate)}`,
          totalDays: `${r.totalDays ?? r.totaldays ?? 1} Days`,
          status: capitalizeFirst(r.status),
          reason: capitalizeFirst(r.reason),
        }));
        return (
          <DataTable
            title="Attendance & Leave"
            columns={columns}
            data={data}
            showAdd={false}
            showDeleted={false}
            showImport={false}
            showExport={false}
            showPrint={false}
            showView={false}
            showEdit={false}
            showDelete={false}
            showActionsColumn={false}
            defaultEntriesPerPage={5}
            entriesOptions={[5, 10, 25, 50]}
          />
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-xs border border-gray-200 space-y-4 font-sans mt-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-3">
        <div>
          <h2 className="text-base font-bold text-[#2c3e50]">Multi-Module Activity Records</h2>
          <p className="text-xs text-gray-500">Latest active entries across invoices, orders, returns, transfers, expenses, payments, and staff</p>
        </div>
      </div>

      <div className="flex overflow-x-auto pb-2 gap-1 scrollbar-none border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${
              activeTab === tab.id
                ? "!bg-slate-900 !text-white shadow-sm"
                : "bg-white text-gray-700 hover:bg-gray-100 hover:text-gray-900 border border-gray-200"
            }`}
          >
            <span className="text-xs">{tab.icon}</span>
            {tab.label}
            <span
              className={`px-1.5 py-0.5 text-[9px] rounded font-extrabold ${
                activeTab === tab.id ? "!bg-white/20 !text-white" : "bg-gray-100 text-gray-700"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <div>
        {renderTableContent()}
      </div>
    </div>
  );
};

export default RecentOrders;
