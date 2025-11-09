// components/Charts/MonthlySalesChart.tsx

import React, { useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

// Register ChartJS modules
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// Types
export interface SalesInvoiceProductService {
  qty?: number;
  amount?: number;
  rate?: number;
}

export interface SalesInvoice {
  id: string;
  billdate: string;
  totalamount?: number;
  productservice?: SalesInvoiceProductService[];
}

interface Props {
  salesInvoices: SalesInvoice[];
}

const MonthlySalesChart: React.FC<Props> = ({ salesInvoices }) => {
  const chartData = useMemo(() => {
    const monthlyRevenueMap: Record<string, number> = {};
    const monthlyUnitsMap: Record<string, number> = {};

    // Step 1: Aggregate revenue and units sold per month
    salesInvoices.forEach((invoice) => {
      const date = new Date(invoice.billdate);
      const monthLabel = date.toLocaleString("default", { month: "short", year: "numeric" }); // e.g., "Nov 2025"

      // Revenue
      monthlyRevenueMap[monthLabel] = (monthlyRevenueMap[monthLabel] ?? 0) + (invoice.totalamount ?? 0);

      // Units sold
      const unitsSold = (invoice.productservice ?? []).reduce((sum, p) => sum + (p.qty ?? 0), 0);
      monthlyUnitsMap[monthLabel] = (monthlyUnitsMap[monthLabel] ?? 0) + unitsSold;
    });

    // Step 2: Sort months chronologically
    const parseMonthYearToDate = (label: string) => {
      const [month, year] = label.split(" ");
      return new Date(parseInt(year), new Date(`${month} 1, 2000`).getMonth());
    };

    const sortedLabels = Object.keys(monthlyRevenueMap).sort(
      (a, b) => parseMonthYearToDate(a).getTime() - parseMonthYearToDate(b).getTime()
    );

    // Step 3: Prepare datasets
    const revenueData = sortedLabels.map((label) => monthlyRevenueMap[label]);
    const unitsData = sortedLabels.map((label) => monthlyUnitsMap[label]);

    return {
      labels: sortedLabels,
      datasets: [
        {
          label: "Revenue (₹)",
          data: revenueData,
          borderColor: "rgba(53, 162, 235, 1)",
          backgroundColor: "rgba(53, 162, 235, 0.2)",
          fill: true,
          yAxisID: "y1",
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        {
          label: "Units Sold",
          data: unitsData,
          borderColor: "rgba(245, 158, 11, 1)",
          backgroundColor: "rgba(245, 158, 11, 0.2)",
          fill: true,
          yAxisID: "y2",
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    };
  }, [salesInvoices]);

  const options = {
    responsive: true,
    plugins: {
      legend: { position: "top" as const },
      tooltip: { mode: "index" as const, intersect: false },
      title: { display: true, text: "📈 Monthly Revenue & Units Sold" },
    },
    scales: {
      y1: {
        type: "linear" as const,
        display: true,
        position: "left" as const,
        title: { display: true, text: "Revenue (₹)" },
      },
      y2: {
        type: "linear" as const,
        display: true,
        position: "right" as const,
        grid: { drawOnChartArea: false },
        title: { display: true, text: "Units Sold" },
      },
    },
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow">
      <Line data={chartData} options={options} />
    </div>
  );
};

export default MonthlySalesChart;
