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

interface ProductVariant {
  id: string;
  currentstock?: number;
  minimumstock?: number;
  openingstock?: number;
}

interface Product {
  id: string;
  branchid: string;
  productvariants?: ProductVariant[];
  currentstock?: number; // fallback if no variants
  minimumstock?: number; // fallback if no variants
}

interface ProductServiceInInvoice {
  qty?: number;
  amount?: number;
  rate?: number;
  discount?: number;
}

interface PurchaseInvoice {
  totalamount?: number;
  status: boolean;
  productservice?: ProductServiceInInvoice[];
}

interface SalesInvoice {
  totalamount?: number;
  status: boolean;
  productservice?: ProductServiceInInvoice[];
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
  productData: Product[] | { getProductServices?: Product[] };
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

  // Ensure all arrays are valid
  const customers: Account[] = Array.isArray(customerData?.getAccounts) ? customerData.getAccounts : [];
  const products: Product[] = Array.isArray(productData)
    ? productData
    : Array.isArray((productData as any)?.getProductServices)
    ? (productData as any).getProductServices
    : [];
  const purchaseinvoices: PurchaseInvoice[] = Array.isArray(purchaseInvoiceData?.getPurchaseInvoices)
    ? purchaseInvoiceData.getPurchaseInvoices
    : [];
  const invoices: SalesInvoice[] = Array.isArray(salesInvoiceData?.getSalesInvoices)
    ? salesInvoiceData.getSalesInvoices
    : [];
  const transfers: TransferStock[] = Array.isArray(transferStockData?.getTransferStocks)
    ? transferStockData.getTransferStocks
    : [];

  // Counts & totals
  const customerCount = customers.length;
  const totalProducts = products.length;
  const totalOrders = invoices.length;

  const totalSales = invoices.reduce((acc, inv) => acc + (inv.totalamount ?? 0), 0);

  const totalRevenue = invoices.reduce((sum, invoice) => {
    const invoiceTotal = (invoice.productservice ?? []).reduce((prodSum, p) => {
      if (p.amount !== undefined) return prodSum + p.amount;
      if (p.rate !== undefined && p.qty !== undefined) return prodSum + p.rate * p.qty;
      return prodSum;
    }, 0);
    return sum + invoiceTotal;
  }, 0);

  // Current stock calculation
  const totalCurrentStock = products.reduce((sum, product) => {
    const productStock =
      (product.productvariants ?? []).reduce((vSum, variant) => vSum + (variant.currentstock ?? 0), 0) ||
      product.currentstock ||
      0;

    const transferredOutQty = transfers
      .filter((t) => t.status && t.frombranchid === product.branchid && t.productid === product.id)
      .reduce((qty, t) => qty + (t.transferqty ?? 0), 0);

    return sum + (productStock - transferredOutQty);
  }, 0);

  const totalOutgoingTransfer = transfers.reduce((sum, t) => {
    const isMatch = !branchId || t.frombranchid === branchId;
    return isMatch && t.status ? sum + (t.transferqty ?? 0) : sum;
  }, 0);

  const totalSalesQuantity = invoices.reduce((acc, invoice) => {
    return acc + (invoice.productservice ?? []).reduce((sum, p) => sum + (p.qty ?? 0), 0);
  }, 0);

  const purchaseStockIn = purchaseinvoices.reduce((acc, invoice) => {
    return acc + (invoice.productservice ?? []).reduce((sum, p) => sum + (p.qty ?? 0), 0);
  }, 0);

  const purchaseOrderCount = purchaseinvoices.length;
  const totalPurchases = purchaseinvoices.reduce((acc, inv) => acc + (inv.totalamount ?? 0), 0);

  const lowStockCount = products.reduce((count, product) => {
    const lowVariants = (product.productvariants ?? []).filter(
      (v) => (v.currentstock ?? 0) < (v.minimumstock ?? 0)
    ).length;
    return count + lowVariants;
  }, 0);

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
