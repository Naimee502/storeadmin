import React from "react";
import {
  FaUsers,
  FaShoppingCart,
  FaDollarSign,
  FaChartLine,
  FaBoxes,
  FaBoxOpen,
  FaArchive,
  FaExclamationTriangle,
  FaTruckLoading,
  FaHandHoldingUsd,
} from "react-icons/fa";
import { useNavigate } from "react-router";

interface Product {
  id: string;
  branchid: string;
  openingstock?: number;
  currentstock?: number;
  minimumstock?: number;
}

interface ProductInInvoice {
  qty?: number;
  amount?: number;
  rate?: number;
  discount?: number;
}

interface PurchaseInvoice {
  totalamount?: number;
  paymenttype?: string;
  billtype?: string;
  billnumber?: string;
  status: boolean;
  products?: ProductInInvoice[];
}

interface SalesInvoice {
  totalamount?: number;
  paymenttype?: string;
  billtype?: string;
  billnumber?: string;
  status: boolean;
  products?: ProductInInvoice[];
}

interface TransferStock {
  transferqty?: number;
  status: boolean;
  frombranchid: string;
  tobranchid: string;
  productid: string;
}

interface Account {
  id: string;
}

interface StatsCardsProps {
  customerData: { getAccounts?: Account[] };
  productData: Product[];
  purchaseInvoiceData: { getPurchaseInvoices?: PurchaseInvoice[] };
  salesInvoiceData: { getSalesInvoices?: SalesInvoice[] };
  transferStockData: { getTransferStocks?: TransferStock[] };
  branchId?: string;
}

const StatsCards: React.FC<StatsCardsProps> = ({
  customerData,
  productData,
  salesInvoiceData,
  purchaseInvoiceData,
  transferStockData,
  branchId = "",
}) => {
  const navigate = useNavigate();

  // Ensure arrays
  const customers = customerData?.getAccounts ?? [];
  const products = productData ?? [];
  const purchaseinvoices = purchaseInvoiceData?.getPurchaseInvoices ?? [];
  const invoices = salesInvoiceData?.getSalesInvoices ?? [];
  const transfers = transferStockData?.getTransferStocks ?? [];

  // Counts & totals
  const customerCount = customers.length;
  const totalProducts = products.length;
  const totalOrders = invoices.length;

  const totalSales = invoices.reduce((acc, inv) => acc + (inv.totalamount ?? 0), 0);

  const totalRevenue = invoices.reduce((invoiceSum, invoice) => {
    const productsTotal = (invoice.products ?? []).reduce((prodSum, product) => {
      if (product.amount !== undefined) return prodSum + product.amount;
      if (product.rate !== undefined && product.qty !== undefined)
        return prodSum + product.rate * product.qty;
      return prodSum;
    }, 0);
    return invoiceSum + productsTotal;
  }, 0);

  // Current stock calculation
  const totalCurrentStock = !branchId
    ? products.reduce((sum, product) => {
        const transferredOutQty = transfers
          .filter((t) => t.status && t.frombranchid === product.branchid && t.productid === product.id)
          .reduce((qty, t) => qty + (t.transferqty ?? 0), 0);
        return sum + ((product.currentstock ?? 0) - transferredOutQty);
      }, 0)
    : products.reduce((sum, product) => sum + (product.currentstock ?? 0), 0);

  const totalOutgoingTransfer = transfers.reduce((sum, ts) => {
    const isMatch = !branchId || ts.frombranchid === branchId;
    return isMatch && ts.status ? sum + (ts.transferqty ?? 0) : sum;
  }, 0);

  const totalSalesQuantity = invoices.reduce((acc, invoice) => {
    const invoiceQty = (invoice.products ?? []).reduce((pSum, product) => pSum + (product.qty ?? 0), 0);
    return acc + invoiceQty;
  }, 0);

  const purchaseStockIn = purchaseinvoices.reduce((acc, invoice) => {
    return acc + (invoice.products ?? []).reduce((sum, p) => sum + (p.qty ?? 0), 0);
  }, 0);

  const purchaseOrderCount = purchaseinvoices.length;
  const totalPurchases = purchaseinvoices.reduce((acc, inv) => acc + (inv.totalamount ?? 0), 0);

  const lowStockCount = products.filter((p) => (p.currentstock ?? 0) < (p.minimumstock ?? 0)).length;

  // Stats array
  const stats = [
    { label: "Customers", value: customerCount, icon: <FaUsers className="text-blue-500" />, path: "/accounts" },
    { label: "Sales Orders", value: totalOrders, icon: <FaShoppingCart className="text-green-500" />, path: "/salesinvoice" },
    { label: "Sales", value: `₹${totalSales.toFixed(2)}`, icon: <FaDollarSign className="text-yellow-500" />, path: "/salesinvoice" },
    { label: "Revenue", value: `₹${totalRevenue.toFixed(2)}`, icon: <FaChartLine className="text-purple-500" />, path: "/salesinvoice" },
    { label: "Purchase Orders", value: purchaseOrderCount, icon: <FaTruckLoading className="text-lime-500" />, path: "/purchaseinvoice" },
    { label: "Purchases", value: `₹${totalPurchases.toFixed(2)}`, icon: <FaHandHoldingUsd className="text-amber-600" />, path: "/purchaseinvoice" },
    { label: "Purchase Stock In", value: purchaseStockIn, icon: <FaBoxOpen className="text-green-500" />, path: "/purchaseinvoice" },
    { label: "Sales Stock Out", value: totalSalesQuantity, icon: <FaBoxOpen className="text-rose-500" />, path: "/salesinvoice" },
    { label: "Transfer Stock Out", value: totalOutgoingTransfer, icon: <FaBoxOpen className="text-orange-500" />, path: "/transferstock" },
    { label: "Total Products", value: totalProducts, icon: <FaArchive className="text-teal-500" />, path: "/products" },
    { label: "Stock", value: totalCurrentStock, icon: <FaBoxes className="text-indigo-500" />, path: "/products" },
    { label: "Low Stock", value: lowStockCount, icon: <FaExclamationTriangle className="text-red-500" />, path: "/products" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((item) => (
        <div
          key={item.label}
          onClick={() => navigate(item.path)}
          className="flex items-center p-4 bg-white shadow rounded-xl cursor-pointer hover:shadow-md transition"
        >
          <div className="text-3xl mr-4">{item.icon}</div>
          <div>
            <p className="text-sm text-gray-500">{item.label}</p>
            <p className="text-xl font-semibold">{item.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsCards;
