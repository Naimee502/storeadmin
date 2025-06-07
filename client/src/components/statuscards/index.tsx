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

interface Product {
  openingstock?: number;
  currentstock: number;
  minimumstock: number;
}

interface ProductInInvoice {
  qty?: number;
  amount?: number;
  rate?: number;
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
  salesInvoiceData: { getSalesInvoices: SalesInvoice[] };
  transferStockData: { getTransferStocks: TransferStock[] };
  branchId: string;
}

const StatsCards: React.FC<StatsCardsProps> = ({
  customerData,
  productData,
  salesInvoiceData,
  transferStockData,
  branchId,
}) => {
  const customers = customerData?.getAccounts ?? [];
  const products = productData?.getProducts ?? [];
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

  const totalOpeningStock = products.reduce(
    (sum, product) => sum + (product.openingstock ?? 0),
    0
  );

  const totalIncomingTransfer = transfers
    .filter((ts) => ts.tobranchid === branchId && ts.status === true)
    .reduce((sum, ts) => sum + (ts.transferqty ?? 0), 0);

  const totalOutgoingTransfer = transfers
    .filter((ts) => ts.frombranchid === branchId && ts.status === true)
    .reduce((sum, ts) => sum + (ts.transferqty ?? 0), 0);

  const totalSalesQuantity = invoices.reduce((acc, invoice) => {
    const invoiceQty = invoice.products.reduce((pSum, product) => pSum + (product.qty ?? 0), 0);
    return acc + invoiceQty;
  }, 0);

  const lowStockCount = products.filter(
    (product) => product.currentstock < product.minimumstock
  ).length;

  const stockIn = totalOpeningStock + totalIncomingTransfer;
  const stockOut = totalOutgoingTransfer + totalSalesQuantity;

  const stats = [
    { label: "Customers", value: customerCount, icon: <FaUsers className="text-blue-500" /> },
    { label: "Orders", value: totalOrders, icon: <FaShoppingCart className="text-green-500" /> },
    { label: "Sales", value: `₹${totalSales.toFixed(2)}`, icon: <FaDollarSign className="text-yellow-500" /> },
    { label: "Revenue", value: `₹${totalRevenue.toFixed(2)}`, icon: <FaChartLine className="text-purple-500" /> },
    { label: "Stock In", value: stockIn, icon: <FaBoxes className="text-indigo-500" /> },
    { label: "Stock Out", value: stockOut, icon: <FaBoxOpen className="text-rose-500" /> },
    { label: "Total Products", value: totalProducts, icon: <FaArchive className="text-teal-500" /> },
    { label: "Low Stock", value: lowStockCount, icon: <FaExclamationTriangle className="text-red-500" /> },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((item) => (
        <div key={item.label} className="flex items-center p-4 bg-white shadow rounded-xl">
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
