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
} from "react-icons/fa";

type Product = {
  id: string;
  openingstock?: number;
  currentstock?: number;
  minimumstock?: number;
};

type SalesInvoiceProduct = {
  amount?: number;
  rate?: number;
  qty?: number;
};

type SalesInvoice = {
  totalamount?: number;
  products: SalesInvoiceProduct[];
};

type TransferStock = {
  tobranchid: string;
  frombranchid: string;
  transferqty?: number;
  status: boolean;
};

type StatsItem = {
  label: string;
  value: string | number;
  icon: React.ReactNode;
};

export const generateDashboardStats = (
  branchId: string,
  accountsList: any[],
  salesmenList: any[],
  productList: Product[],
  salesInvoiceList: SalesInvoice[],
  transferStocks: TransferStock[]
): StatsItem[] => {
  const customerCount = accountsList.length;
  const totalProducts = productList.length;
  const totalOrders = salesInvoiceList.length;

  const totalSales = salesInvoiceList.reduce(
    (acc, invoice) => acc + (invoice.totalamount || 0),
    0
  );

  const totalRevenue = salesInvoiceList.reduce((invoiceSum, invoice) => {
    const productsTotal = invoice.products.reduce((prodSum, product) => {
      if (product.amount !== undefined) return prodSum + product.amount;
      if (product.rate !== undefined && product.qty !== undefined)
        return prodSum + product.rate * product.qty;
      return prodSum;
    }, 0);
    return invoiceSum + productsTotal;
  }, 0);

  const totalOpeningStock = productList.reduce(
    (sum, product) => sum + (product.openingstock ?? 0),
    0
  );

  const totalIncomingTransfer = transferStocks
    .filter((ts) => ts.tobranchid === branchId && ts.status === true)
    .reduce((sum, ts) => sum + (ts.transferqty ?? 0), 0);

  const totalOutgoingTransfer = transferStocks
    .filter((ts) => ts.frombranchid === branchId && ts.status === true)
    .reduce((sum, ts) => sum + (ts.transferqty ?? 0), 0);

  const totalSalesQuantity = salesInvoiceList.reduce((acc, invoice) => {
    const invoiceQty = invoice.products.reduce(
      (pSum, product) => pSum + (product.qty ?? 0),
      0
    );
    return acc + invoiceQty;
  }, 0);

  const lowStockCount = productList.filter(
    (product) =>
      (product.currentstock ?? 0) < (product.minimumstock ?? 0)
  ).length;

  const stockIn = totalOpeningStock + totalIncomingTransfer;
  const stockOut = totalOutgoingTransfer + totalSalesQuantity;

  return [
    { label: "Customers", value: customerCount, icon: <FaUsers className="text-blue-500" /> },
    { label: "Orders", value: totalOrders, icon: <FaShoppingCart className="text-green-500" /> },
    { label: "Sales", value: `₹${totalSales.toFixed(2)}`, icon: <FaDollarSign className="text-yellow-500" /> },
    { label: "Revenue", value: `₹${totalRevenue.toFixed(2)}`, icon: <FaChartLine className="text-purple-500" /> },
    { label: "Stock In", value: stockIn, icon: <FaBoxes className="text-indigo-500" /> },
    { label: "Stock Out", value: stockOut, icon: <FaBoxOpen className="text-rose-500" /> },
    { label: "Total Products", value: totalProducts, icon: <FaArchive className="text-teal-500" /> },
    { label: "Low Stock", value: lowStockCount, icon: <FaExclamationTriangle className="text-red-500" /> },
  ];
};
