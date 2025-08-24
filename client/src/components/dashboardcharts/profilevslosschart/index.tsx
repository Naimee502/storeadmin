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

export interface SalesInvoiceProduct {
  productid: string;
  rate?: number;
  qty?: number;
  amount?: number;
}

export interface SalesInvoice {
  id: string;
  billdate: string;
  products?: SalesInvoiceProduct[];
  totalamount?: number;
}

interface ProfitLossChartProps {
  salesInvoices?: SalesInvoice[];
}

const ProfitLossChart: React.FC<ProfitLossChartProps> = ({ salesInvoices = [] }) => {
  const { chartData, chartOptions } = useMemo(() => {
    const getMonthYearLabel = (dateStr: string) =>
      new Date(dateStr).toLocaleString("default", { month: "short", year: "numeric" });

    const salesByMonth: Record<string, { salesAmount: number; revenueAmount: number }> = {};

    salesInvoices.forEach((invoice) => {
      if (!invoice.billdate) return;

      const monthYear = getMonthYearLabel(invoice.billdate);
      if (!salesByMonth[monthYear]) salesByMonth[monthYear] = { salesAmount: 0, revenueAmount: 0 };

      salesByMonth[monthYear].salesAmount += invoice.totalamount ?? 0;
      salesByMonth[monthYear].revenueAmount += (invoice.products ?? []).reduce((sum, p) => {
        return sum + (p.amount ?? (p.rate ?? 0) * (p.qty ?? 0));
      }, 0);
    });

    const parseMonthYearToDate = (str: string) => {
      const [month, year] = str.split(" ");
      return new Date(parseInt(year), new Date(`${month} 1, 2000`).getMonth());
    };

    const sortedMonths = Object.keys(salesByMonth).sort(
      (a, b) => parseMonthYearToDate(a).getTime() - parseMonthYearToDate(b).getTime()
    );

    const profitLossData = sortedMonths.map(
      (m) => salesByMonth[m].revenueAmount - salesByMonth[m].salesAmount
    );

    const data = {
      labels: sortedMonths,
      datasets: [
        {
          label: "Profit / Loss (₹)",
          data: profitLossData,
          backgroundColor: profitLossData.map((v) =>
            v >= 0 ? "rgba(34,197,94,0.7)" : "rgba(239,68,68,0.7)"
          ),
          borderColor: profitLossData.map((v) =>
            v >= 0 ? "rgba(22,163,74,1)" : "rgba(220,38,38,1)"
          ),
          borderWidth: 1,
        },
      ],
    };

    const options = {
      responsive: true,
      plugins: {
        legend: { position: "top" as const },
        title: { display: true, text: "Monthly Profit vs Loss" },
        tooltip: {
          callbacks: {
            label: function (context: any) {
              const val = context.parsed.y;
              return `₹ ${val.toLocaleString()}`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: "Amount (₹)" },
        },
        x: {
          title: { display: true, text: "Month-Year" },
        },
      },
    };

    return { chartData: data, chartOptions: options };
  }, [salesInvoices]);

  return (
    <div className="bg-white p-4 rounded-xl shadow">
      <h2 className="text-md font-semibold mb-2">📊 Profit vs Loss</h2>
      <Bar data={chartData} options={chartOptions} />
    </div>
  );
};

export default ProfitLossChart;
