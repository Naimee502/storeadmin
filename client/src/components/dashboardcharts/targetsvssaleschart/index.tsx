import React, { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  Title,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend, Title);

interface SalesInvoice {
  billdate: string;
  totalamount?: number;
}

interface SalesOrder {
  billdate?: string;
  totalamount?: number;
  status?: boolean;
}

interface Salesman {
  id: string;
  target: string;
  status: boolean;
  role?: string;
}

interface Props {
  salesInvoices: SalesInvoice[];
  salesOrders?: SalesOrder[];
  staff: Salesman[];
}

const TargetVsSalesChart: React.FC<Props> = ({ salesInvoices, salesOrders = [], staff }) => {
  const { chartData, chartOptions } = useMemo(() => {
    const salesMap: Record<string, number> = {};
    const ordersMap: Record<string, number> = {};

    const activeStaff = staff.filter((s) => s.status !== false);

    salesInvoices.forEach(({ billdate, totalamount }) => {
      if (!billdate) return;
      const monthKey = new Date(billdate).toISOString().slice(0, 7);
      salesMap[monthKey] = (salesMap[monthKey] || 0) + (totalamount ?? 0);
    });

    salesOrders.forEach(({ billdate, totalamount, status }) => {
      if (!billdate || status === false) return;
      const monthKey = new Date(billdate).toISOString().slice(0, 7);
      ordersMap[monthKey] = (ordersMap[monthKey] || 0) + (totalamount ?? 0);
    });

    const months = Array.from(new Set([...Object.keys(salesMap), ...Object.keys(ordersMap)])).sort();

    const totalMonthlyTarget = activeStaff.reduce(
      (sum, s) => sum + parseFloat(s.target || "0"),
      0
    );

    const salesData = months.map((m) => salesMap[m] || 0);
    const ordersData = months.map((m) => ordersMap[m] || 0);
    const targetData = months.map(() => totalMonthlyTarget);

    return {
      chartData: {
        labels: months,
        datasets: [
          {
            label: "Monthly Target",
            data: targetData,
            backgroundColor: "rgba(99, 102, 241, 0.8)",
          },
          {
            label: "Invoiced Sales",
            data: salesData,
            backgroundColor: "rgba(59, 130, 246, 0.8)",
          },
          {
            label: "Booked Orders",
            data: ordersData,
            backgroundColor: "rgba(16, 185, 129, 0.8)",
          },
        ],
      },
      chartOptions: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top" as const, labels: { font: { size: 10 } } },
          tooltip: { mode: "index" as const, intersect: false },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { font: { size: 10 } },
            title: { display: true, text: "Amount (₹)", font: { size: 10 } },
          },
          x: {
            ticks: { font: { size: 10 } },
          },
        },
      },
    };
  }, [salesInvoices, salesOrders, staff]);

  return (
    <div className="bg-white p-3.5 rounded border border-gray-200 shadow-2xs font-sans flex flex-col justify-between h-80 sm:h-96">
      <div>
        <h3 className="text-xs font-bold text-[#2c3e50] mb-1 capitalize tracking-wider">Target vs Sales & Orders</h3>
        <p className="text-[10px] text-gray-500 mb-2">Team quota vs invoiced revenue and bookings</p>
      </div>
      <div className="flex-1 min-h-[220px]">
        <Bar data={chartData} options={chartOptions} />
      </div>
    </div>
  );
};

export default TargetVsSalesChart;
