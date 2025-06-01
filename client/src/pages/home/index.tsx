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

const Home = () => {
  const stats = [
    { label: "Customers", value: 1523, icon: <FaUsers className="text-blue-500" /> },
    { label: "Orders", value: 3201, icon: <FaShoppingCart className="text-green-500" /> },
    { label: "Sales", value: "$124,500", icon: <FaDollarSign className="text-yellow-500" /> },
    { label: "Revenue", value: "$98,230", icon: <FaChartLine className="text-purple-500" /> },
    { label: "Stock In", value: 7400, icon: <FaBoxes className="text-indigo-500" /> },
    { label: "Stock Out", value: 6900, icon: <FaBoxOpen className="text-rose-500" /> },
    { label: "Total Products", value: 120, icon: <FaArchive className="text-teal-500" /> },
    { label: "Low Stock", value: 8, icon: <FaExclamationTriangle className="text-red-500" /> },
  ];

  const salesLineData = {
    labels: ["Jan", "Feb", "Mar", "Apr", "May"],
    datasets: [
      {
        label: "Monthly Sales",
        data: [12000, 15000, 11000, 18000, 17000],
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59, 130, 246, 0.2)",
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const revenueBarData = {
    labels: ["Jan", "Feb", "Mar", "Apr", "May"],
    datasets: [
      {
        label: "Sales",
        data: [12000, 15000, 11000, 18000, 17000],
        backgroundColor: "rgba(34, 197, 94, 0.6)",
      },
      {
        label: "Revenue",
        data: [10000, 14000, 9000, 16000, 15000],
        backgroundColor: "rgba(250, 204, 21, 0.6)",
      },
    ],
  };

  const stockDoughnutData = {
    labels: ["Stock In", "Stock Out"],
    datasets: [
      {
        data: [7400, 6900],
        backgroundColor: ["#0ea5e9", "#f43f5e"],
      },
    ],
  };

  const recentOrders = [
    { id: "ORD001", product: "Keyboard", quantity: 2, status: "Delivered" },
    { id: "ORD002", product: "Mouse", quantity: 1, status: "Pending" },
    { id: "ORD003", product: "Monitor", quantity: 1, status: "Shipped" },
    { id: "ORD004", product: "Laptop", quantity: 1, status: "Delivered" },
  ];

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-4 rounded-xl shadow">
            <h2 className="text-md font-semibold mb-2">📈 Monthly Sales</h2>
            <Line data={salesLineData} />
          </div>
          <div className="bg-white p-4 rounded-xl shadow">
            <h2 className="text-md font-semibold mb-2">📊 Sales vs Revenue</h2>
            <Bar data={revenueBarData} />
          </div>
          <div className="bg-white p-4 rounded-xl shadow">
            <h2 className="text-md font-semibold mb-2">📦 Stock In vs Out</h2>
            <Doughnut data={stockDoughnutData} />
          </div>
        </div>

        {/* Recent Orders Table */}
        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="text-lg font-semibold mb-4">🧾 Recent Orders</h2>
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="px-4 py-2">Order ID</th>
                <th className="px-4 py-2">Product</th>
                <th className="px-4 py-2">Quantity</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr key={order.id} className="border-t">
                  <td className="px-4 py-2">{order.id}</td>
                  <td className="px-4 py-2">{order.product}</td>
                  <td className="px-4 py-2">{order.quantity}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        order.status === "Delivered"
                          ? "bg-green-100 text-green-700"
                          : order.status === "Pending"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </HomeLayout>
  );
};

export default Home;

