import React from "react";
import HomeLayout from "../../layouts/home";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Title,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";

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

import { useAccountsQuery } from "../../graphql/hooks/accounts";
import { useSalesInvoicesQuery } from "../../graphql/hooks/salesinvoice";
import { useProductsQuery } from "../../graphql/hooks/products";
import { useAppSelector } from "../../redux/hooks";
import { usePurchaseInvoicesQuery } from "../../graphql/hooks/purchaseinvoice";
import { useTransferStocksQuery } from "../../graphql/hooks/transferstock";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  ArcElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

// Type definitions based on your GraphQL schema (simplified)
interface Product {
  id: string;
  currentstock: number;
  minimumstock: number;
  openingstock: number;
  // other fields omitted for brevity
}

interface TransferStock {
  id: string;
  frombranchid: string;
  tobranchid: string;
  productid: string;
  transferqty: number;
  transferdate: string;
  status: boolean;
}

interface SalesInvoiceProduct {
  productid: string;
  qty: number;
  rate?: number;
  amount?: number;
}

interface SalesInvoice {
  id: string;
  totalamount: number;
  products: SalesInvoiceProduct[];
  billdate: string; // note: your data uses 'billdate' not 'billingdate'
}

const Home: React.FC = () => {
  const { type, admin, branch } = useAppSelector((state) => state.auth);

  const branchId = localStorage.getItem("branchid") || "";

  // Queries to fetch data
  const { data: customerData } = useAccountsQuery(type === 'branch' ? branchId : undefined);
  const { data: productData } = useProductsQuery();
  const { data: salesInvoiceData } = useSalesInvoicesQuery(type === 'branch' ? branchId : undefined);
  const { data: transferStockData } = useTransferStocksQuery();

  const invoiceList = salesInvoiceData?.getSalesInvoices || [];
  const productList = productData?.getProducts || [];
  const productMap = new Map(productList.map((p: any) => [p.id, p.name]));

  const accountsList = customerData?.getAccounts || [];
  console.log("Account", JSON.stringify(accountsList))
  const accountsMap = new Map(accountsList.map((acc: any) => [acc.id, acc]));

  // Customers count
  const customerCount = customerData?.getAccounts?.length ?? 0;

  // Total products count
  const totalProducts = productData?.getProducts?.length ?? 0;

  // Sales invoices array safely
  const salesInvoices: SalesInvoice[] = salesInvoiceData?.getSalesInvoices ?? [];

  // Total sales amount (sum of totalamount)
  const totalSales = salesInvoices.reduce((acc, invoice) => acc + (invoice.totalamount || 0), 0);

  // Total orders count
  const totalOrders = salesInvoices.length;

  // Total revenue - sum over all invoices and products (product.amount or product.rate * qty)
  const totalRevenue = salesInvoices.reduce((invoiceSum, invoice) => {
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

  // Sum of opening stock from all products
  const totalOpeningStock = productData?.getProducts?.reduce(
    (sum, product: Product) => sum + (product.openingstock ?? 0),
    0
  ) ?? 0;

  // Filter transfer stocks for this branch and status true
  const transferStocks: TransferStock[] = transferStockData?.getTransferStocks ?? [];

  // Total incoming transfer quantity (to this branch)
  const totalIncomingTransfer = transferStocks
    .filter((ts) => ts.tobranchid === branchId && ts.status === true)
    .reduce((sum, ts) => sum + (ts.transferqty ?? 0), 0);

  // Total outgoing transfer quantity (from this branch)
  const totalOutgoingTransfer = transferStocks
    .filter((ts) => ts.frombranchid === branchId && ts.status === true)
    .reduce((sum, ts) => sum + (ts.transferqty ?? 0), 0);

  // Calculate total sales quantity from sales invoices (sum of all product qty)
  const totalSalesQuantity = salesInvoices.reduce((acc, invoice) => {
    const invoiceQty = invoice.products.reduce((pSum, product) => pSum + (product.qty ?? 0), 0);
    return acc + invoiceQty;
  }, 0);

  // Count of products where currentstock is below minimumstock
  const lowStockCount = productData?.getProducts?.filter(
    (product: Product) => product.currentstock < product.minimumstock
  ).length ?? 0;

  // Final stock in = opening stock + incoming transfers
  const stockIn = totalOpeningStock + totalIncomingTransfer;

  // Final stock out = outgoing transfers + sales quantity
  const stockOut = totalOutgoingTransfer + totalSalesQuantity;

  // Stats cards data
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

  // -------------------------
  // DYNAMIC CHART DATA BUILDING
  // -------------------------

  // Utility: get month-year string label from date string, e.g. "May 2025"
  const getMonthYearLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("default", { month: "short", year: "numeric" }); // e.g. "May 2025"
  };

  // Group sales and revenue by month-year label
  type SalesMonthData = {
    [monthYear: string]: {
      salesAmount: number;   // sum of totalamount for invoices in that month
      revenueAmount: number; // sum of products amounts/rates*qty in that month
    };
  };

  const salesByMonth: SalesMonthData = {};

  salesInvoices.forEach((invoice) => {
    if (!invoice.billdate) return; // use 'billdate' from your actual data

    const monthYear = getMonthYearLabel(invoice.billdate);

    if (!salesByMonth[monthYear]) {
      salesByMonth[monthYear] = { salesAmount: 0, revenueAmount: 0 };
    }

    salesByMonth[monthYear].salesAmount += invoice.totalamount ?? 0;

    // Sum revenue for products in this invoice
    const invoiceRevenue = invoice.products.reduce((sum, product) => {
      if (product.amount !== undefined) return sum + product.amount;
      if (product.rate !== undefined && product.qty !== undefined) return sum + product.rate * product.qty;
      return sum;
    }, 0);

    salesByMonth[monthYear].revenueAmount += invoiceRevenue;
  });

  // Custom function to parse "Mon YYYY" format to Date
  const parseMonthYearToDate = (monthYear: string) => {
    // monthYear like "May 2025"
    const [monthStr, yearStr] = monthYear.split(" ");
    const monthIndex = new Date(Date.parse(`${monthStr} 1, 2000`)).getMonth(); // get month number 0-11
    const year = parseInt(yearStr, 10);
    return new Date(year, monthIndex);
  };

  // Extract sorted labels (month-year) ascending based on date parsing
  const chartLabels = Object.keys(salesByMonth).sort((a, b) => {
    return parseMonthYearToDate(a).getTime() - parseMonthYearToDate(b).getTime();
  });

  // Prepare datasets for charts
  const salesDataSet = chartLabels.map((label) => salesByMonth[label]?.salesAmount ?? 0);
  const revenueDataSet = chartLabels.map((label) => salesByMonth[label]?.revenueAmount ?? 0);

  // Calculate profit/loss per month
  const profitLossDataSet = chartLabels.map((label) => {
    const sales = salesByMonth[label]?.salesAmount ?? 0;
    const revenue = salesByMonth[label]?.revenueAmount ?? 0;
    return revenue - sales; // Positive = profit, Negative = loss
  });

  // Bar chart options and data
  const barChartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "top" as const },
      title: { display: true, text: "Monthly Sales" },
    },
  };

  const barChartData = {
    labels: chartLabels,
    datasets: [
      {
        label: "Sales (₹)",
        data: salesDataSet,
        backgroundColor: "rgba(53, 162, 235, 0.5)",
      },
    ],
  };

  // Line chart options and data (Sales and Revenue)
  const lineChartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "top" as const },
      title: { display: true, text: "Revenue & Sales" },
    },
  };

  const lineChartData = {
    labels: chartLabels,
    datasets: [
      {
        label: "Sales (₹)",
        data: salesDataSet,
        borderColor: "rgb(53, 162, 235)",
        backgroundColor: "rgba(53, 162, 235, 0.5)",
      },
      {
        label: "Revenue (₹)",
        data: revenueDataSet,
        borderColor: "rgb(255, 99, 132)",
        backgroundColor: "rgba(255, 99, 132, 0.5)",
      },
    ],
  };

  // Doughnut chart data for stock summary
  const doughnutData = {
    labels: ["Stock In", "Stock Out"],
    datasets: [
      {
        label: "Stock Summary",
        data: [stockIn, stockOut],
        backgroundColor: ["rgba(75,192,192,0.6)", "rgba(255,99,132,0.6)"],
        borderColor: ["rgba(75,192,192,1)", "rgba(255,99,132,1)"],
        borderWidth: 1,
      },
    ],
  };

  const profitLossChartData = {
    labels: chartLabels,
    datasets: [
      {
        label: "Profit / Loss (₹)",
        data: profitLossDataSet,
        backgroundColor: profitLossDataSet.map((value) =>
          value >= 0 ? "rgba(34,197,94,0.7)" : "rgba(239,68,68,0.7)"
        ),
        borderColor: profitLossDataSet.map((value) =>
          value >= 0 ? "rgba(22,163,74,1)" : "rgba(220,38,38,1)"
        ),
        borderWidth: 1,
      },
    ],
  };

  const profitLossChartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "top" as const },
      title: { display: true, text: "Monthly Profit vs Loss" },
    },
  };

  // Recent orders sample static data (you can fetch from your API)
  const tableData = invoiceList.map((invoice: any, index: number) => {
    const totalqty = invoice.products.reduce(
      (sum: number, p: any) => sum + (p.qty || 0),
      0
    );
    console.log("Invoice Party ID", invoice.partyacc)
    const account = accountsMap.get(invoice.partyacc);

    const productname = invoice.products
      .map((p: any) => productMap.get(p.id) || "Unknown")
      .join(", ");

    return {
      ...invoice,
      seqNo: index + 1,
      totalitem: invoice.products.length,
      totalqty,
      billtype_billnumber: `${invoice.billtype}-${invoice.billnumber}`,
      status: invoice.status ? "Active" : "Inactive",
      partyacc: account
        ? `${account.name} - ${account.mobile}`
        : invoice.partyacc,
      productname,
    };
  });

  return (
    <HomeLayout>
      <div className="p-6 space-y-6">
        {/* Dashboard Cards */}
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

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-4 rounded-xl shadow">
            <h2 className="text-md font-semibold mb-2">📈 Monthly Sales</h2>
            <Line data={barChartData} />
          </div>
          <div className="bg-white p-4 rounded-xl shadow">
            <h2 className="text-md font-semibold mb-2">💰 Revenue & Sales</h2>
            <Bar data={lineChartData} />
          </div>
          <div className="bg-white p-4 rounded-xl shadow">
            <h2 className="text-md font-semibold mb-2">📦 Stock In/Out</h2>
            <Doughnut data={doughnutData} />
          </div>
          <div className="bg-white p-4 rounded-xl shadow">
            <h2 className="text-md font-semibold mb-2">📊 Profit vs Loss</h2>
            <Bar data={profitLossChartData} options={profitLossChartOptions} />
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-white p-4 rounded-xl shadow mt-6">
          <h2 className="text-md font-semibold mb-4">🧾 Recent Orders (Latest 10)</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b bg-gray-100">
                <tr>
                  <th className="py-2 px-3">#</th>
                  <th className="py-2 px-3">Payment Type</th>
                  <th className="py-2 px-3">Party A/c</th>
                  <th className="py-2 px-3">Total Items</th>
                  <th className="py-2 px-3">Total Qty</th>
                  <th className="py-2 px-3">Billing Date</th>
                  <th className="py-2 px-3">Billing No</th>
                  <th className="py-2 px-3">Total Amount</th>
                  <th className="py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {tableData.slice(-10).map((row, index) => (
                  <tr key={row.id || index} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-3">{row.seqNo}</td>
                    <td className="py-2 px-3">{row.paymenttype}</td>
                    <td className="py-2 px-3">{row.partyacc}</td>
                    <td className="py-2 px-3">{row.totalitem}</td>
                    <td className="py-2 px-3">{row.totalqty}</td>
                    <td className="py-2 px-3">{row.billdate}</td>
                    <td className="py-2 px-3">{row.billtype_billnumber}</td>
                    <td className="py-2 px-3">₹{row.totalamount?.toFixed(2)}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          row.status === "Active"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </HomeLayout>
  );
};

export default Home;
