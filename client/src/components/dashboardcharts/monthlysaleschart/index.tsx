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
import type { SalesInvoice } from "..";

// Register ChartJS modules
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface Props {
  salesInvoices: SalesInvoice[];
}

const MonthlySalesChart: React.FC<Props> = ({ salesInvoices }) => {
  const chartData = useMemo(() => {
    const monthlySalesMap: Record<string, number> = {};

    // Step 1: Accumulate total sales amount per "Month Year"
    salesInvoices.forEach((invoice) => {
      const date = new Date(invoice.billdate);
      const monthLabel = date.toLocaleString("default", { month: "short", year: "numeric" }); // e.g., "Jun 2025"

      // If already exists, add to it; else initialize
      monthlySalesMap[monthLabel] = (monthlySalesMap[monthLabel] ?? 0) + (invoice.totalamount ?? 0);
    });

    // Step 2: Sort months in chronological order
    const parseMonthYearToDate = (label: string) => {
      const [month, year] = label.split(" ");
      return new Date(parseInt(year), new Date(`${month} 1, 2000`).getMonth());
    };

    const sortedLabels = Object.keys(monthlySalesMap).sort(
      (a, b) => parseMonthYearToDate(a).getTime() - parseMonthYearToDate(b).getTime()
    );

    const salesValues = sortedLabels.map((label) => monthlySalesMap[label]);

    // Step 3: Build chart dataset
    return {
      labels: sortedLabels,
      datasets: [
        {
          label: "Monthly Sales (₹)",
          data: salesValues,
          borderColor: "rgba(53, 162, 235, 1)",
          backgroundColor: "rgba(53, 162, 235, 0.4)",
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    };
  }, [salesInvoices]);

  return (
    <div className="bg-white p-4 rounded-xl shadow">
      <h2 className="text-md font-semibold mb-2">📈 Monthly Sales (Calculated)</h2>
      <Line data={chartData} />
    </div>
  );
};

export default MonthlySalesChart;
