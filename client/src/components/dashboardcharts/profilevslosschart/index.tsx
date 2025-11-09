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
  transactiondate: string; // timestamp in ms
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
      if (ts < 1e12) ts = ts * 1000; // Convert seconds to ms if needed
      const date = new Date(ts);
      return date.toLocaleString("default", { month: "short", year: "numeric" });
    };

    const monthlyData: Record<string, { revenue: number; expense: number }> = {};

    // ✅ Use transactions directly
    transactions.forEach((trx) => {
      const monthYear = getMonthYear(trx.transactiondate);

      if (!monthlyData[monthYear]) monthlyData[monthYear] = { revenue: 0, expense: 0 };

      trx.entries.forEach((entry) => {
        // Revenue: SalesInvoice credits minus sales commissions
        if (trx.source.docmodel === "SalesInvoice") {
          if (entry.credit > 0) monthlyData[monthYear].revenue += entry.credit;
          if (entry.debit > 0 && entry.ledgerid.ledgername.includes("Commission")) {
            monthlyData[monthYear].revenue -= entry.debit;
          }
        }

        // Expenses: PurchaseInvoice debits, taxes, commissions, or expense ledgers
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

    console.log("Monthly Profit/Loss Calculation:", monthlyData);

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
          label: "Profit / Loss (₹)",
          data: profitLoss,
          backgroundColor: profitLoss.map((v) =>
            v >= 0 ? "rgba(34,197,94,0.7)" : "rgba(239,68,68,0.7)"
          ),
          borderColor: profitLoss.map((v) =>
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
        y: { beginAtZero: true, title: { display: true, text: "Amount (₹)" } },
        x: { title: { display: true, text: "Month-Year" } },
      },
    };

    return { chartData: data, chartOptions: options };
  }, [transactions]);

  return (
    <div className="bg-white p-4 rounded-xl shadow">
      <h2 className="text-md font-semibold mb-2">📊 Profit vs Loss</h2>
      <Bar data={chartData} options={chartOptions} />
    </div>
  );
};

export default ProfitLossChart;
