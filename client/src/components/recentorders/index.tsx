import React, { useState } from "react";
import { useNavigate } from "react-router";
import {
  FaFileInvoiceDollar,
  FaClipboardList,
  FaUndoAlt,
  FaExchangeAlt,
  FaMoneyCheckAlt,
  FaCalendarCheck,
} from "react-icons/fa";
import DataTable from "../datatable";

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
}) => {
  const [activeTab, setActiveTab] = useState<string>("salesinvoices");
  const navigate = useNavigate();

  const salesInvoices = Array.isArray(salesInvoiceData?.getSalesInvoices) ? salesInvoiceData.getSalesInvoices : [];
  const purchaseInvoices = Array.isArray(purchaseInvoiceData?.getPurchaseInvoices) ? purchaseInvoiceData.getPurchaseInvoices : [];
  const transferStocks = Array.isArray(transferStockData?.getTransferStocks) ? transferStockData.getTransferStocks : [];

  const tabs = [
    { id: "salesinvoices", label: "Sales Invoices", count: salesInvoices.length, icon: <FaFileInvoiceDollar className="text-blue-600" />, path: "/salesinvoice" },
    { id: "salesorders", label: "Sales Orders", count: salesOrders.length, icon: <FaClipboardList className="text-emerald-600" />, path: "/salesorder" },
    { id: "purchaseorders", label: "Purchase Orders", count: purchaseOrders.length, icon: <FaClipboardList className="text-amber-600" />, path: "/purchaseorder" },
    { id: "salesreturns", label: "Sales Returns", count: salesReturns.length, icon: <FaUndoAlt className="text-rose-600" />, path: "/salesreturn" },
    { id: "purchasereturns", label: "Purchase Returns", count: purchaseReturns.length, icon: <FaUndoAlt className="text-indigo-600" />, path: "/purchasereturn" },
    { id: "transfers", label: "Transfer Stock", count: transferStocks.length, icon: <FaExchangeAlt className="text-teal-600" />, path: "/transferstock" },
    { id: "expenses", label: "Expense Notes & Payments", count: expenseNotes.length + payments.length, icon: <FaMoneyCheckAlt className="text-purple-600" />, path: "/expensenote" },
    { id: "leaves", label: "Attendance & Leave", count: leaveRequests.length, icon: <FaCalendarCheck className="text-orange-600" />, path: "/attendance" },
  ];

  const capitalizeFirst = (text: string) =>
    text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : "";

  const renderTableContent = () => {
    switch (activeTab) {
      case "salesinvoices": {
        const columns = [
          { label: "#", key: "seqNo" },
          { label: "Bill No", key: "billNo" },
          { label: "Billing Date", key: "billdate" },
          { label: "Party A/c", key: "partyName" },
          { label: "Payment Type", key: "paymenttype" },
          { label: "Total Items", key: "itemCount" },
          { label: "Total Amount", key: "amountFormatted" },
          { label: "Status", key: "status" },
        ];
        const data = salesInvoices.slice().reverse().map((item: any, idx: number) => ({
          ...item,
          seqNo: idx + 1,
          billNo: `${capitalizeFirst(item.billtype || "Bill")}-${item.billnumber}`,
          partyName: item.partyacc?.accountname ?? "Cash",
          paymenttype: capitalizeFirst(item.paymenttype || "Cash"),
          itemCount: `${(item.productservice || []).length} Items`,
          amountFormatted: `₹${Number(item.totalamount ?? 0).toFixed(2)}`,
          status: item.status ? "Active" : "Cancelled",
        }));
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

      case "salesorders": {
        const columns = [
          { label: "#", key: "seqNo" },
          { label: "Order No", key: "orderNo" },
          { label: "Order Date", key: "billdate" },
          { label: "Customer Party A/c", key: "partyName" },
          { label: "Order Value", key: "amountFormatted" },
          { label: "Status", key: "status" },
        ];
        const data = salesOrders.slice().reverse().map((item: any, idx: number) => ({
          ...item,
          seqNo: idx + 1,
          orderNo: `SO-${item.billnumber}`,
          partyName: item.partyacc?.accountname ?? "Customer",
          amountFormatted: `₹${Number(item.totalamount ?? 0).toFixed(2)}`,
          status: item.isConverted ? "Converted" : "Pending",
        }));
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
          { label: "#", key: "seqNo" },
          { label: "PO No", key: "poNo" },
          { label: "PO Date", key: "billdate" },
          { label: "Supplier Party A/c", key: "partyName" },
          { label: "PO Value", key: "amountFormatted" },
          { label: "Status", key: "status" },
        ];
        const data = purchaseOrders.slice().reverse().map((item: any, idx: number) => ({
          ...item,
          seqNo: idx + 1,
          poNo: `PO-${item.billnumber}`,
          partyName: item.partyacc?.accountname ?? "Vendor",
          amountFormatted: `₹${Number(item.totalamount ?? 0).toFixed(2)}`,
          status: item.isConverted ? "Converted" : "Pending",
        }));
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
          { label: "#", key: "seqNo" },
          { label: "Return Bill No", key: "returnNo" },
          { label: "Return Date", key: "returndate" },
          { label: "Party A/c", key: "partyName" },
          { label: "Original Bill No", key: "origBill" },
          { label: "Refund Amount", key: "amountFormatted" },
          { label: "Status", key: "status" },
        ];
        const data = salesReturns.slice().reverse().map((item: any, idx: number) => ({
          ...item,
          seqNo: idx + 1,
          returnNo: `SR-${item.billnumber}`,
          returndate: item.returndate || item.createdAt?.substring(0, 10),
          partyName: item.partyacc?.accountname ?? "Customer",
          origBill: item.sourceBillNumber || "N/A",
          amountFormatted: `₹${Number(item.totalamount ?? 0).toFixed(2)}`,
          status: "Completed",
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
          { label: "#", key: "seqNo" },
          { label: "Debit Note No", key: "debitNo" },
          { label: "Return Date", key: "returndate" },
          { label: "Supplier Party A/c", key: "partyName" },
          { label: "Original PO/Bill No", key: "origBill" },
          { label: "Claim Amount", key: "amountFormatted" },
          { label: "Status", key: "status" },
        ];
        const data = purchaseReturns.slice().reverse().map((item: any, idx: number) => ({
          ...item,
          seqNo: idx + 1,
          debitNo: `PR-${item.billnumber}`,
          returndate: item.returndate || item.createdAt?.substring(0, 10),
          partyName: item.partyacc?.accountname ?? "Supplier",
          origBill: item.sourceBillNumber || "N/A",
          amountFormatted: `₹${Number(item.totalamount ?? 0).toFixed(2)}`,
          status: "Completed",
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
          { label: "#", key: "seqNo" },
          { label: "Transfer Ref ID", key: "refId" },
          { label: "Product Ref ID", key: "prodRef" },
          { label: "Quantity Transferred", key: "qtyFormatted" },
          { label: "Status", key: "status" },
        ];
        const data = transferStocks.slice().reverse().map((item: any, idx: number) => ({
          ...item,
          seqNo: idx + 1,
          refId: item.id.substring(0, 8).toUpperCase(),
          prodRef: item.productid || "N/A",
          qtyFormatted: `${item.transferqty ?? 0} Units`,
          status: item.status ? "Completed" : "Cancelled",
        }));
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
        const combined = [...expenseNotes, ...payments].sort((a: any, b: any) => (new Date(b.createdAt || 0)).getTime() - (new Date(a.createdAt || 0)).getTime());
        const columns = [
          { label: "#", key: "seqNo" },
          { label: "Entry Ref", key: "refId" },
          { label: "Category / Particulars", key: "categoryName" },
          { label: "Payment Mode", key: "mode" },
          { label: "Amount", key: "amountFormatted" },
          { label: "Status", key: "status" },
        ];
        const data = combined.map((item: any, idx: number) => ({
          ...item,
          seqNo: idx + 1,
          refId: item.billnumber || item.paymentcode || item.id.substring(0, 8).toUpperCase(),
          categoryName: item.category || item.narration || item.remarks || "General Ledger Entry",
          mode: capitalizeFirst(item.paymentmode || item.paymenttype || "Bank / Cash"),
          amountFormatted: `₹${Number(item.amount ?? item.totalamount ?? 0).toFixed(2)}`,
          status: "Active",
        }));
        return (
          <DataTable
            title="Expenses & Payments"
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
          { label: "#", key: "seqNo" },
          { label: "Staff Member", key: "staffName" },
          { label: "Leave Type", key: "leaveType" },
          { label: "Duration", key: "duration" },
          { label: "Total Days", key: "totalDays" },
          { label: "Status", key: "status" },
        ];
        const data = leaveRequests.slice().reverse().map((item: any, idx: number) => ({
          ...item,
          seqNo: idx + 1,
          staffName: item.staffid?.name || "Staff Member",
          leaveType: item.leavetypeid?.name || "General Leave",
          duration: `${item.fromdate} to ${item.todate}`,
          totalDays: `${item.totaldays ?? 1} Days`,
          status: capitalizeFirst(item.status || "Pending"),
        }));
        return (
          <DataTable
            title="Attendance & Leaves"
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
          <p className="text-xs text-gray-500">Latest active entries across invoices, orders, returns, transfers, and staff</p>
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
