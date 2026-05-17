import React, { useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Title,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend, Title);

interface SalesInvoiceProduct {
  productid: string;
  rate?: number;
  qty?: number;
  amount?: number;
}

interface SalesInvoice {
  id: string;
  billdate: string;
  products?: SalesInvoiceProduct[];
  productservice?: SalesInvoiceProduct[];
  totalamount?: number;
  salesmanid?: string;
}

interface DailySalesChartProps {
  salesInvoices: SalesInvoice[];
}

const DailySalesChart: React.FC<DailySalesChartProps> = ({ salesInvoices }) => {
  const { dailyChartData, dailyChartOptions } = useMemo(() => {
    const dailySalesMap: Record<string, number> = {};

    salesInvoices.forEach((invoice) => {
      if (!invoice.billdate) return;
      const date = new Date(invoice.billdate).toISOString().split("T")[0];
      dailySalesMap[date] = (dailySalesMap[date] || 0) + (invoice.totalamount ?? 0);
    });

    const sortedDates = Object.keys(dailySalesMap).sort();
    const data = sortedDates.map((date) => dailySalesMap[date]);

    return {
      dailyChartData: {
        labels: sortedDates.map((d) => d.substring(5)),
        datasets: [
          {
            label: "Daily Revenue (₹)",
            data,
            borderColor: "#10b981",
            backgroundColor: "rgba(16, 185, 129, 0.2)",
            fill: true,
            tension: 0.3,
            pointRadius: 3,
            pointHoverRadius: 5,
          },
        ],
      },
      dailyChartOptions: {
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
  }, [salesInvoices]);

  return (
    <div className="bg-white p-3.5 rounded border border-gray-200 shadow-2xs font-sans flex flex-col justify-between h-80 sm:h-96">
      <div>
        <h3 className="text-xs font-bold text-[#2c3e50] mb-1 capitalize tracking-wider">Daily Billing Pulse</h3>
        <p className="text-[10px] text-gray-500 mb-2">Short-term revenue velocity</p>
      </div>
      <div className="flex-1 min-h-[220px]">
        <Line data={dailyChartData} options={dailyChartOptions} />
      </div>
    </div>
  );
};

export default DailySalesChart;
