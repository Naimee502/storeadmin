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
import { format } from "date-fns";

// Register chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export interface SalesInvoiceProduct {
  productid: string;
  rate?: number;
  qty?: number;
  amount?: number;
}

export interface SalesInvoice {
  id: string;
  billdate: string;
  products: SalesInvoiceProduct[];
  totalamount?: number;
  salesmanid?: string;
}

interface Props {
  salesInvoices: SalesInvoice[];
}

const RevenueAndSalesChart: React.FC<Props> = ({ salesInvoices }) => {
  const { labels, revenues, salesCounts } = useMemo(() => {
    const map = new Map<string, { revenue: number; count: number }>();

    salesInvoices.forEach((invoice) => {
      const billDate = format(new Date(invoice.billdate), "MMM dd");
      const totalRevenue = invoice.totalamount ?? 0;
      const totalSales = invoice.products.reduce((sum, p) => sum + (p.qty ?? 0), 0);

      if (!map.has(billDate)) {
        map.set(billDate, { revenue: 0, count: 0 });
      }

      const existing = map.get(billDate)!;
      existing.revenue += totalRevenue;
      existing.count += totalSales;
    });

    const labels = Array.from(map.keys());
    const revenues = Array.from(map.values()).map((v) => v.revenue);
    const salesCounts = Array.from(map.values()).map((v) => v.count);

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
    plugins: {
      legend: {
        position: "top" as const,
      },
      tooltip: {
        mode: "index" as const,
        intersect: false,
      },
    },
    scales: {
      y1: {
        type: "linear" as const,
        display: true,
        position: "left" as const,
        title: {
          display: true,
          text: "Revenue (₹)",
        },
      },
      y2: {
        type: "linear" as const,
        display: true,
        position: "right" as const,
        grid: {
          drawOnChartArea: false, // Prevent grid lines overlapping
        },
        title: {
          display: true,
          text: "Units Sold",
        },
      },
    },
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow">
      <h2 className="text-md font-semibold mb-2">💰 Revenue & Sales</h2>
      <Bar data={chartData} options={options} />
    </div>
  );
};

export default RevenueAndSalesChart;
