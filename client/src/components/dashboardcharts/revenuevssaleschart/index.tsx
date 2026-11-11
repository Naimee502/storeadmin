import React, { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { format, parse } from "date-fns";

// Register chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export interface SalesInvoice {
  id: string;
  billdate: string;
  productservice?: { qty?: number; amount?: number }[];
  totalamount?: number;
}

interface Props {
  salesInvoices?: SalesInvoice[];
}

const RevenueAndSalesChart: React.FC<Props> = ({ salesInvoices = [] }) => {
  const { labels, revenues, salesCounts } = useMemo(() => {
    const map = new Map<string, { revenue: number; count: number }>();

    salesInvoices.forEach((invoice) => {
      const billDate = format(new Date(invoice.billdate), "MMM dd");
      const totalRevenue = invoice.totalamount ?? 0;
      const totalSales = (invoice.productservice ?? []).reduce(
        (sum, p) => sum + (p.qty ?? 0),
        0
      );

      if (!map.has(billDate)) {
        map.set(billDate, { revenue: 0, count: 0 });
      }

      const existing = map.get(billDate)!;
      existing.revenue += totalRevenue;
      existing.count += totalSales;
    });

    const sortedEntries = Array.from(map.entries()).sort(
      ([dateA], [dateB]) =>
        new Date(parse(dateA, "MMM dd", new Date())).getTime() -
        new Date(parse(dateB, "MMM dd", new Date())).getTime()
    );

    const labels = sortedEntries.map(([date]) => date);
    const revenues = sortedEntries.map(([, value]) => value.revenue);
    const salesCounts = sortedEntries.map(([, value]) => value.count);

    return { labels, revenues, salesCounts };
  }, [salesInvoices]);

  const chartData = {
    labels,
    datasets: [
      {
        label: "Revenue (₹)",
        data: revenues,
        backgroundColor: "#3b82f6",
        yAxisID: "y1",
      },
      {
        label: "Units Sold",
        data: salesCounts,
        backgroundColor: "#f59e0b",
        yAxisID: "y2",
      },
    ],
  };

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
    <div className="rounded-md border border-slate-200 bg-white p-3 font-sans flex flex-col justify-between h-64 sm:h-72">
      <div>
        <h3 className="text-[12px] font-semibold text-slate-900">Revenue & Volume</h3>
        <p className="text-[10.5px] text-slate-500 mb-1">Daily ledger billing correlation</p>
      </div>
      <div className="flex-1 min-h-[150px]">
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
};

export default RevenueAndSalesChart;
