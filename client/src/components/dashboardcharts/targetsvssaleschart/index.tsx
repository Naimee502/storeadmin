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

interface Salesman {
  id: string;
  target: string;
  status: boolean;
  role?: string; // <-- ADD THIS if role exists
}

interface Props {
  salesInvoices: SalesInvoice[];
  staff: Salesman[];
}

const TargetVsSalesChart: React.FC<Props> = ({ salesInvoices, staff }) => {

  const { chartData, chartOptions } = useMemo(() => {
    const salesMap: Record<string, number> = {};

    // -------------------------------------
    // ✅ Filter only salesmen with role="Salesman"
    // -------------------------------------
    const filteredSalesmen = staff.filter(
      (s) => s.role?.toLowerCase() === "salesman"
    );

    // 1. Aggregate monthly sales
    salesInvoices.forEach(({ billdate, totalamount }) => {
      if (!billdate) return;
      const monthKey = new Date(billdate).toISOString().slice(0, 7);
      salesMap[monthKey] = (salesMap[monthKey] || 0) + (totalamount ?? 0);
    });

    // 2. Determine unique months
    const months = Object.keys(salesMap).sort();

    // 3. Calculate total target from active salesmen
    const totalMonthlyTarget = filteredSalesmen
      .filter((s) => s.status)
      .reduce((sum, s) => sum + parseFloat(s.target || "0"), 0);

    // 4. Build datasets
    const salesData = months.map((m) => salesMap[m] || 0);
    const targetData = months.map(() => totalMonthlyTarget);

    return {
      chartData: {
        labels: months,
        datasets: [
          {
            label: "Target",
            data: targetData,
            backgroundColor: "rgba(59, 130, 246, 0.7)",
          },
          {
            label: "Sales",
            data: salesData,
            backgroundColor: "rgba(16, 185, 129, 0.7)",
          },
        ],
      },
      chartOptions: {
        responsive: true,
        plugins: {
          legend: { position: "top" },
          title: { display: true, text: "🎯 Target vs Sales" },
          tooltip: {
            mode: "index",
            intersect: false,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: "Amount (₹)" },
          },
          x: {
            title: { display: true, text: "Month" },
          },
        },
      },
    };
  }, [salesInvoices, staff]);

  return (
    <div className="bg-white p-4 rounded-xl shadow">
      <h2 className="text-md font-semibold mb-2">🎯 Target vs Sales</h2>
      <Bar data={chartData} options={chartOptions} />
    </div>
  );
};

export default TargetVsSalesChart;
