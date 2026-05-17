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

    salesInvoices.forEach((invoice) => {
      const date = new Date(invoice.billdate);
      const monthLabel = date.toLocaleString("default", { month: "short", year: "numeric" });

      monthlyRevenueMap[monthLabel] = (monthlyRevenueMap[monthLabel] ?? 0) + (invoice.totalamount ?? 0);

      const unitsSold = (invoice.productservice ?? []).reduce((sum, p) => sum + (p.qty ?? 0), 0);
      monthlyUnitsMap[monthLabel] = (monthlyUnitsMap[monthLabel] ?? 0) + unitsSold;
    });

    const parseMonthYearToDate = (label: string) => {
      const [month, year] = label.split(" ");
      return new Date(parseInt(year), new Date(`${month} 1, 2000`).getMonth());
    };

    const sortedLabels = Object.keys(monthlyRevenueMap).sort(
      (a, b) => parseMonthYearToDate(a).getTime() - parseMonthYearToDate(b).getTime()
    );

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
          pointRadius: 3,
          pointHoverRadius: 5,
        },
        {
          label: "Units Sold",
          data: unitsData,
          borderColor: "rgba(245, 158, 11, 1)",
          backgroundColor: "rgba(245, 158, 11, 0.2)",
          fill: true,
          yAxisID: "y2",
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 5,
        },
      ],
    };
  }, [salesInvoices]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" as const, labels: { font: { size: 10 } } },
      tooltip: { mode: "index" as const, intersect: false },
    },
    scales: {
      y1: {
        type: "linear" as const,
        display: true,
        position: "left" as const,
        ticks: { font: { size: 10 } },
        title: { display: true, text: "Revenue (₹)", font: { size: 10 } },
      },
      y2: {
        type: "linear" as const,
        display: true,
        position: "right" as const,
        grid: { drawOnChartArea: false },
        ticks: { font: { size: 10 } },
        title: { display: true, text: "Units Sold", font: { size: 10 } },
      },
      x: {
        ticks: { font: { size: 10 } },
      },
    },
  };

  return (
    <div className="bg-white p-3.5 rounded border border-gray-200 shadow-2xs font-sans flex flex-col justify-between h-80 sm:h-96">
      <div>
        <h3 className="text-xs font-bold text-[#2c3e50] mb-1 capitalize tracking-wider">Monthly Revenue & Units</h3>
        <p className="text-[10px] text-gray-500 mb-2">Aggregate ledger revenue vs volume</p>
      </div>
      <div className="flex-1 min-h-[220px]">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
};

export default MonthlySalesChart;
