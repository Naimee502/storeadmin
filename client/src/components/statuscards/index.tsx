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
  FaClipboardList,
  FaHandHoldingUsd,
  FaTruckLoading,
} from "react-icons/fa";
import { useNavigate } from "react-router";

interface Product {
  openingstock?: number;
  currentstock: number;
  minimumstock: number;
}

interface ProductInInvoice {
  qty?: number;
  amount?: number;
  rate?: number;
  discount?: number;
}

interface PurchaseInvoice {
  totalamount: number;
  paymenttype: string;
  billtype: string;
  billnumber: string;
  status: boolean;
  products: ProductInInvoice[];
}

interface SalesInvoice {
  totalamount: number;
  paymenttype: string;
  billtype: string;
  billnumber: string;
  status: boolean;
  products: ProductInInvoice[];
}

interface TransferStock {
  transferqty?: number;
  status: boolean;
  frombranchid: string;
  tobranchid: string;
}

interface Account {
  id: string;
}

interface StatsCardsProps {
  customerData: { getAccounts: Account[] };
  productData: { getProducts: Product[] };
  purchaseInvoiceData: { getPurchaseInvoices: PurchaseInvoice[] };
  salesInvoiceData: { getSalesInvoices: SalesInvoice[] };
  transferStockData: { getTransferStocks: TransferStock[] };
  branchId: string;
}

const StatsCards: React.FC<StatsCardsProps> = ({
  customerData,
  productData,
  salesInvoiceData,
  purchaseInvoiceData,
  transferStockData,
  branchId,
}) => {
  const navigate = useNavigate();

  const customers = customerData?.getAccounts ?? [];
  const products = productData?.getProducts ?? [];
  const purchaseinvoices = purchaseInvoiceData?.getPurchaseInvoices ?? [];
  const invoices = salesInvoiceData?.getSalesInvoices ?? [];
  const transfers = transferStockData?.getTransferStocks ?? [];

  const customerCount = customers.length;
  const totalProducts = products.length;
  const totalOrders = invoices.length;

  const totalSales = invoices.reduce((acc, invoice) => acc + (invoice.totalamount || 0), 0);

  const totalRevenue = invoices.reduce((invoiceSum, invoice) => {
    const productsTotal = invoice.products.reduce((prodSum, product) => {
      if (product.amount !== undefined) {
        return prodSum + product.amount;
      } else if (product.rate !== undefined && product.qty !== undefined) {
        return prodSum + product.rate * product.qty;
      }
      return prodSum;
    }, 0);
    return invoiceSum + productsTotal;
  }, 0);

  const totalCurrentStock = products.reduce(
    (sum, product) => sum + (product.currentstock ?? 0),
    0
  );

  const totalOutgoingTransfer = transfers
    .filter((ts) => ts.frombranchid === branchId && ts.status === true)
    .reduce((sum, ts) => sum + (ts.transferqty ?? 0), 0);

  const totalSalesQuantity = invoices.reduce((acc, invoice) => {
    const invoiceQty = invoice.products.reduce((pSum, product) => pSum + (product.qty ?? 0), 0);
    return acc + invoiceQty;
  }, 0);

  const purchaseStockIn = purchaseinvoices.reduce((acc, invoice) => {
    return acc + invoice.products.reduce((sum, p) => sum + (p.qty ?? 0), 0);
  }, 0);

  const purchaseOrderCount = purchaseinvoices.length;

  const totalPurchases = purchaseinvoices.reduce(
    (acc, invoice) => acc + (invoice.totalamount ?? 0),
    0
  );

  const lowStockCount = products.filter(
    (product) => product.currentstock < product.minimumstock
  ).length;

  const stockIn = totalCurrentStock;
  const salesStockOut = totalSalesQuantity;
  const transferStockOut = totalOutgoingTransfer;

  const stats = [
    { label: "Customers", value: customerCount, icon: <FaUsers className="text-blue-500" />, path: "/accounts" },
    { label: "Sales Orders", value: totalOrders, icon: <FaShoppingCart className="text-green-500" />, path: "/salesinvoice" },
    { label: "Sales", value: `₹${totalSales.toFixed(2)}`, icon: <FaDollarSign className="text-yellow-500" />, path: "/salesinvoice" },
    { label: "Revenue", value: `₹${totalRevenue.toFixed(2)}`, icon: <FaChartLine className="text-purple-500" />, path: "/salesinvoice" },
    { label: "Purchase Orders", value: purchaseOrderCount, icon: <FaTruckLoading className="text-lime-500" />, path: "/purchaseinvoice" },
    { label: "Purchases", value: `₹${totalPurchases.toFixed(2)}`, icon: <FaHandHoldingUsd className="text-amber-600" />, path: "/purchaseinvoice" },
    { label: "Purchase Stock In", value: purchaseStockIn, icon: <FaBoxOpen className="text-green-500" />, path: "/purchaseinvoice" },
    { label: "Sales Stock Out", value: salesStockOut, icon: <FaBoxOpen className="text-rose-500" />, path: "/salesinvoice" },
    { label: "Transfer Stock Out", value: transferStockOut, icon: <FaBoxOpen className="text-orange-500" />, path: "/transferstock" },
    { label: "Total Products", value: totalProducts, icon: <FaArchive className="text-teal-500" />, path: "/products" },
    { label: "Stock", value: stockIn, icon: <FaBoxes className="text-indigo-500" />, path: "/products" },
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
