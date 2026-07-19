import React, { useState } from "react";
import { useNavigate } from "react-router";
import {
  FaUsers,
  FaShoppingCart,
  FaDollarSign,
  FaBoxes,
  FaArchive,
  FaExclamationTriangle,
  FaUserTie,
  FaUndoAlt,
  FaMoneyCheckAlt,
  FaReceipt,
  FaFileInvoiceDollar,
  FaCalendarCheck,
  FaExchangeAlt,
  FaClipboardList,
} from "react-icons/fa";
import { useAppSelector } from "../../redux/hooks";
import { selectIsModuleAllowed } from "../../redux/slices/permissions";

interface StatsCardsProps {
  customerData?: any;
  productData?: any;
  salesInvoiceData?: any;
  purchaseInvoiceData?: any;
  transferStockData?: any;
  salesOrders?: any[];
  purchaseOrders?: any[];
  salesReturns?: any[];
  purchaseReturns?: any[];
  expenseNotes?: any[];
  payments?: any[];
  attendanceSummary?: any;
  leaveRequests?: any[];
  staffData?: any;
  branchId?: string;
}

const StatsCards: React.FC<StatsCardsProps> = ({
  customerData,
  productData,
  salesInvoiceData,
  purchaseInvoiceData,
  transferStockData,
  salesOrders = [],
  purchaseOrders = [],
  salesReturns = [],
  purchaseReturns = [],
  expenseNotes = [],
  payments = [],
  attendanceSummary,
  leaveRequests = [],
  staffData,
  branchId = "",
}) => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const fullState = useAppSelector((state: any) => state);
  const isAllowed = (moduleId: string) => selectIsModuleAllowed(fullState, moduleId);

  // Extract arrays
  const customers = Array.isArray(customerData?.getAccounts) ? customerData.getAccounts : [];
  const products = Array.isArray(productData)
    ? productData
    : Array.isArray((productData as any)?.getProductServices)
    ? (productData as any).getProductServices
    : [];
  const purchaseinvoices = Array.isArray(purchaseInvoiceData?.getPurchaseInvoices)
    ? purchaseInvoiceData.getPurchaseInvoices
    : [];
  const invoices = Array.isArray(salesInvoiceData?.getSalesInvoices)
    ? salesInvoiceData.getSalesInvoices
    : [];
  const transfers = Array.isArray(transferStockData?.getTransferStocks)
    ? transferStockData.getTransferStocks
    : [];
  const staff = Array.isArray(staffData?.getStaffAccounts) ? staffData.getStaffAccounts : [];

  // Calculations
  const customerCount = customers.length;
  const totalProducts = products.length;
  const totalInvoices = invoices.length;

  const totalSales = invoices.reduce((acc, inv) => acc + (inv.totalamount ?? 0), 0);
  const totalPurchases = purchaseinvoices.reduce((acc, inv) => acc + (inv.totalamount ?? 0), 0);
  // Expenses = expense notes only. Payments were wrongly added here before —
  // they're mostly customer RECEIPTS (money in) and vendor settlements, not
  // expenses, which inflated this card even when no expense notes existed.
  const activeExpenseNotes = expenseNotes.filter((e) => e.status !== false);
  const totalExpenses = activeExpenseNotes.reduce((acc, exp) => acc + (exp.amount ?? 0), 0);
  const netBalance = totalSales - totalPurchases - totalExpenses;

  // Orders
  const pendingSO = salesOrders.filter((o) => !o.isConverted && o.status !== false).length;
  const pendingPO = purchaseOrders.filter((o) => !o.isConverted && o.status !== false).length;
  const totalSalesReturnVal = salesReturns.reduce((acc, r) => acc + (r.totalamount ?? 0), 0);
  const totalPurchaseReturnVal = purchaseReturns.reduce((acc, r) => acc + (r.totalamount ?? 0), 0);

  // Stock
  const totalCurrentStock = products.reduce((sum, product) => {
    const productStock =
      (product.productvariants ?? []).reduce((vSum: number, variant: any) => vSum + (variant.currentstock ?? 0), 0) ||
      product.currentstock ||
      0;
    return sum + productStock;
  }, 0);

  const totalOutgoingTransfer = transfers.reduce((sum, t) => {
    const isMatch = !branchId || t.frombranchid === branchId;
    return isMatch && t.status ? sum + (t.transferqty ?? 0) : sum;
  }, 0);

  const lowStockCount = products.reduce((count, product) => {
    const lowVariants = (product.productvariants ?? []).filter(
      (v: any) => (v.currentstock ?? 0) < (v.minimumstock ?? 0)
    ).length;
    return count + lowVariants;
  }, 0);

  // HR & Attendance
  const activeStaffCount = staff.filter((s) => s.status !== false).length;
  const presentCount = attendanceSummary?.presentDays ?? 0;
  const pendingLeaves = leaveRequests.filter((l) => l.status?.toLowerCase() === "pending").length;

  const rawStats = [
    // Financial & Invoicing (4 cards)
    { moduleId: "salesinvoice", category: "financial", label: "Invoiced Sales", value: `₹${totalSales.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, sub: `${totalInvoices} Invoices`, icon: <FaFileInvoiceDollar />, path: "/salesinvoice", color: "text-emerald-600", bgIcon: "bg-emerald-50", borderHover: "hover:border-emerald-400" },
    { moduleId: "purchaseinvoice", category: "financial", label: "Purchase Bills", value: `₹${totalPurchases.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, sub: `${purchaseinvoices.length} Bills`, icon: <FaReceipt />, path: "/purchaseinvoice", color: "text-blue-600", bgIcon: "bg-blue-50", borderHover: "hover:border-blue-400" },
    { moduleId: "expensenote", category: "financial", label: "Expenses Total", value: `₹${totalExpenses.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, sub: `${activeExpenseNotes.length} Entries`, icon: <FaMoneyCheckAlt />, path: "/expensenote", color: "text-amber-600", bgIcon: "bg-amber-50", borderHover: "hover:border-amber-400" },
    { moduleId: "transactions", category: "financial", label: "Net Cashflow", value: `₹${netBalance.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, sub: netBalance >= 0 ? "Surplus" : "Deficit", icon: <FaDollarSign />, path: "/transactions", color: netBalance >= 0 ? "text-emerald-600" : "text-rose-600", bgIcon: netBalance >= 0 ? "bg-emerald-50" : "bg-rose-50", borderHover: netBalance >= 0 ? "hover:border-emerald-400" : "hover:border-rose-400" },

    // Orders & Returns (4 cards)
    { moduleId: "salesorder", category: "orders", label: "Pending SO", value: pendingSO, sub: `${salesOrders.length} Total Orders`, icon: <FaClipboardList />, path: "/salesorder", color: "text-amber-600", bgIcon: "bg-amber-50", borderHover: "hover:border-amber-400" },
    { moduleId: "purchaseorder", category: "orders", label: "Pending PO", value: pendingPO, sub: `${purchaseOrders.length} Total POs`, icon: <FaClipboardList />, path: "/purchaseorder", color: "text-purple-600", bgIcon: "bg-purple-50", borderHover: "hover:border-purple-400" },
    { moduleId: "salesreturn", category: "orders", label: "Sales Returns", value: `₹${totalSalesReturnVal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, sub: `${salesReturns.length} Cr Notes`, icon: <FaUndoAlt />, path: "/salesreturn", color: "text-rose-600", bgIcon: "bg-rose-50", borderHover: "hover:border-rose-400" },
    { moduleId: "purchasereturn", category: "orders", label: "Purchase Returns", value: `₹${totalPurchaseReturnVal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, sub: `${purchaseReturns.length} Dr Notes`, icon: <FaUndoAlt />, path: "/purchasereturn", color: "text-cyan-600", bgIcon: "bg-cyan-50", borderHover: "hover:border-cyan-400" },

    // Inventory & Stock (4 cards)
    { moduleId: "products", category: "inventory", label: "Total Products", value: totalProducts, sub: "Catalog Items", icon: <FaArchive />, path: "/products", color: "text-emerald-600", bgIcon: "bg-emerald-50", borderHover: "hover:border-emerald-400" },
    { moduleId: "products", category: "inventory", label: "Stock Units", value: totalCurrentStock, sub: "Total Stock Qty", icon: <FaBoxes />, path: "/products", color: "text-blue-600", bgIcon: "bg-blue-50", borderHover: "hover:border-blue-400" },
    { moduleId: "products", category: "inventory", label: "Low Stock Alert", value: lowStockCount, sub: "Below Minimum", icon: <FaExclamationTriangle />, path: "/products?filter=lowstock", color: "text-rose-600", bgIcon: "bg-rose-50", borderHover: "hover:border-rose-400" },
    { moduleId: "transferstock", category: "inventory", label: "Stock Transfers", value: totalOutgoingTransfer, sub: `${transfers.length} Shipments`, icon: <FaExchangeAlt />, path: "/transferstock", color: "text-orange-600", bgIcon: "bg-orange-50", borderHover: "hover:border-orange-400" },

    // HR & Operations (4 cards)
    { moduleId: "accounts", category: "hr", label: "Party Accounts", value: customerCount, sub: "Debtors / Creditors", icon: <FaUsers />, path: "/accounts", color: "text-slate-600", bgIcon: "bg-slate-50", borderHover: "hover:border-slate-400" },
    { moduleId: "staffaccounts", category: "hr", label: "Staff Accounts", value: activeStaffCount, sub: `${staff.length} Registered`, icon: <FaUserTie />, path: "/staffaccounts", color: "text-indigo-600", bgIcon: "bg-indigo-50", borderHover: "hover:border-indigo-400" },
    { moduleId: "attendance", category: "hr", label: "Present Today", value: `${presentCount} Staff`, sub: "Attendance Pulse", icon: <FaCalendarCheck />, path: "/attendance", color: "text-emerald-600", bgIcon: "bg-emerald-50", borderHover: "hover:border-emerald-400" },
    { moduleId: "attendance", category: "hr", label: "Pending Leaves", value: pendingLeaves, sub: "Awaiting Approval", icon: <FaCalendarCheck />, path: "/attendance", color: "text-amber-600", bgIcon: "bg-amber-50", borderHover: "hover:border-amber-400" },
  ];

  const allowedStats = rawStats.filter(s => isAllowed(s.moduleId));

  if (allowedStats.length === 0) return null;

  const rawCategories = [
    { id: "all", label: "All Modules", icon: <FaBoxes className="text-blue-500" /> },
    { id: "financial", label: "Financial & Accounting", icon: <FaDollarSign className="text-emerald-500" /> },
    { id: "orders", label: "Orders & Returns", icon: <FaClipboardList className="text-amber-500" /> },
    { id: "inventory", label: "Inventory & Stock", icon: <FaArchive className="text-purple-500" /> },
    { id: "hr", label: "HR & Party Operations", icon: <FaUsers className="text-indigo-500" /> },
  ];

  const allowedCategories = rawCategories.filter(c => {
    if (c.id === "all") return allowedStats.length > 0;
    return allowedStats.some(s => s.category === c.id);
  });

  const displayedStats = activeCategory === "all" ? allowedStats : allowedStats.filter((s) => s.category === activeCategory);

  return (
    <div className="bg-white p-4 sm:p-5 rounded-lg shadow-xs border border-gray-200 space-y-4 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-3">
        <div>
          <h2 className="text-base font-bold text-[#2c3e50]">Module Status Overview</h2>
          <p className="text-xs text-gray-500">Key metrics across accounting, orders, inventory, and staff</p>
        </div>
        <div className="flex flex-wrap gap-1 bg-gray-50 p-1 rounded border border-gray-200">
          {allowedCategories.map((c) => {
            const isActive = activeCategory === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded transition-all ${
                  isActive
                    ? "!bg-slate-900 !text-white shadow-sm"
                    : "text-gray-700 hover:text-black hover:bg-gray-200 bg-white border border-gray-200"
                }`}
              >
                <span className="text-xs">{c.icon}</span>
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 sm:gap-3">
        {displayedStats.map((item) => (
          <div
            key={item.label}
            onClick={() => navigate(item.path)}
            className={`bg-white p-2.5 sm:p-3 rounded border border-gray-200 cursor-pointer hover:shadow-xs transition-all duration-150 flex items-center justify-between gap-1.5 ${item.borderHover}`}
          >
            <div className="min-w-0 flex-1 pr-1">
              <p className="text-xs font-bold text-[#2c3e50] capitalize tracking-tight truncate leading-none">{item.label}</p>
              <p className="text-sm sm:text-base font-black text-[#2c3e50] my-1.5 truncate leading-none">{item.value}</p>
              <p className="text-[10px] font-medium text-gray-500 truncate leading-none">{item.sub}</p>
            </div>
            <div className={`p-1.5 sm:p-2 rounded text-xs sm:text-sm flex-shrink-0 font-bold ${item.color} ${item.bgIcon}`}>
              {item.icon}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StatsCards;
