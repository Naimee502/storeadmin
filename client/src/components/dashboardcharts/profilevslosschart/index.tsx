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

interface TransactionEntry {
  debit: number;
  credit: number;
  ledgerid: { id: string; ledgername: string };
  productserviceid?: string | null;
  variantid?: string | null;
  remarks?: string | null;
}

interface Transaction {
  id: string;
  transactiondate: string;
  entries: TransactionEntry[];
  source: { docmodel: string; docid: string };
  totaldebit: number;
  totalcredit: number;
}

export interface ProfitLossChartProps {
  transactions?: Transaction[];
}

const ProfitLossChart: React.FC<ProfitLossChartProps> = ({ transactions = [] }) => {
  const { chartData, chartOptions } = useMemo(() => {
    const getMonthYear = (timestamp: string) => {
      let ts = Number(timestamp);
      if (ts < 1e12) ts = ts * 1000;
      const date = new Date(ts);
      return date.toLocaleString("default", { month: "short", year: "numeric" });
    };

    const monthlyData: Record<string, { revenue: number; expense: number }> = {};

    transactions.forEach((trx) => {
      const monthYear = getMonthYear(trx.transactiondate);

      if (!monthlyData[monthYear]) monthlyData[monthYear] = { revenue: 0, expense: 0 };

      trx.entries.forEach((entry) => {
        if (trx.source.docmodel === "SalesInvoice") {
          if (entry.credit > 0) monthlyData[monthYear].revenue += entry.credit;
          if (entry.debit > 0 && entry.ledgerid.ledgername.includes("Commission")) {
            monthlyData[monthYear].revenue -= entry.debit;
          }
        }

        if (trx.source.docmodel === "PurchaseInvoice") {
          if (entry.debit > 0) monthlyData[monthYear].expense += entry.debit;
        }
        if (
          entry.ledgerid.ledgername.includes("Commission") ||
          entry.ledgerid.ledgername.includes("Tax") ||
          entry.ledgerid.ledgername.includes("Expense")
        ) {
          monthlyData[monthYear].expense += entry.debit;
        }
      });
    });

    const sortedMonths = Object.keys(monthlyData).sort((a, b) => {
      const [aMonth, aYear] = a.split(" ");
      const [bMonth, bYear] = b.split(" ");
      return new Date(`${aMonth} 1, ${aYear}`).getTime() - new Date(`${bMonth} 1, ${bYear}`).getTime();
    });

    const profitLoss = sortedMonths.map((m) => monthlyData[m].revenue - monthlyData[m].expense);

    const data = {
      labels: sortedMonths,
      datasets: [
        {
          label: "Net Balance (₹)",
          data: profitLoss,
          backgroundColor: profitLoss.map((v) =>
            v >= 0 ? "rgba(16, 185, 129, 0.7)" : "rgba(239, 68, 68, 0.7)"
          ),
          borderColor: profitLoss.map((v) =>
            v >= 0 ? "rgba(5, 150, 105, 1)" : "rgba(220, 38, 38, 1)"
          ),
          borderWidth: 1,
        },
      ],
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top" as const, labels: { font: { size: 10 } } },
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
        y: { beginAtZero: true, ticks: { font: { size: 10 } }, title: { display: true, text: "Amount (₹)", font: { size: 10 } } },
        x: { ticks: { font: { size: 10 } } },
      },
    };

    return { chartData: data, chartOptions: options };
  }, [transactions]);

  return (
    <div className="bg-white p-3.5 rounded border border-gray-200 shadow-2xs font-sans flex flex-col justify-between h-80 sm:h-96">
      <div>
        <h3 className="text-xs font-bold text-[#2c3e50] mb-1 capitalize tracking-wider">Profit vs Loss Trend</h3>
        <p className="text-[10px] text-gray-500 mb-2">Monthly ledger net cashflow summary</p>
      </div>
      <div className="flex-1 min-h-[220px]">
        <Bar data={chartData} options={chartOptions} />
      </div>
    </div>
  );
};

export default ProfitLossChart;
