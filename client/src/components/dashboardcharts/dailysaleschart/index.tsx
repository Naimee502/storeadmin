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
  products: SalesInvoiceProduct[];
  totalamount?: number;
  salesmanid?: string;
}

interface DailySalesChartProps {
  salesInvoices: SalesInvoice[];
}

const DailySalesChart: React.FC<DailySalesChartProps> = ({ salesInvoices }) => {
  const { dailyChartData } = useMemo(() => {
    const dailySalesMap: Record<string, number> = {};

    salesInvoices.forEach((invoice) => {
      if (!invoice.billdate) return;
      // Format date as yyyy-mm-dd for consistent sorting & labeling
      const date = new Date(invoice.billdate).toISOString().split("T")[0];
      dailySalesMap[date] = (dailySalesMap[date] || 0) + (invoice.totalamount ?? 0);
    });

    const sortedDates = Object.keys(dailySalesMap).sort();

    const data = sortedDates.map((date) => dailySalesMap[date]);

    return {
      dailyChartData: {
        labels: sortedDates,
        datasets: [
          {
            label: "Daily Sales (₹)",
            data,
            borderColor: "#34d399",
            backgroundColor: "rgba(52, 211, 153, 0.5)",
            fill: true,
            tension: 0.3,
            pointRadius: 3,
          },
        ],
      },
      dailyChartOptions: {
        responsive: true,
        plugins: {
          legend: { position: "top" },
          title: { display: true, text: "Daily Sales Trend" },
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
            title: { display: true, text: "Date" },
          },
        },
      },
    };
  }, [salesInvoices]);

  return (
    <div className="bg-white p-4 rounded-xl shadow">
      <h2 className="text-md font-semibold mb-2">📆 Daily Sales</h2>
      <Line data={dailyChartData} />
    </div>
  );
};

export default DailySalesChart;
