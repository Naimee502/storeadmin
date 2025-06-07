// components/dashboardcharts/salesmenwisesaleschart.tsx

import React, { useMemo, useState } from "react";
import { Bar } from "react-chartjs-2";
import type { SalesInvoice, Salesman } from "..";

interface Props {
  salesInvoices: SalesInvoice[];
  salesmen: Salesman[];
}

const SalesmenWiseSalesChart: React.FC<Props> = ({
  salesInvoices,
  salesmen,
}) => {
  const [selectedSalesman, setSelectedSalesman] = useState<string>("All");

  const salesmenChartData = useMemo(() => {
    const salesmenMap = new Map(salesmen.map((s) => [s.id, s.name]));
    const salesBySalesmen: Record<string, number> = {};

    salesInvoices.forEach((inv) => {
      const name = salesmenMap.get(inv.salesmanid ?? "") || "Others";
      salesBySalesmen[name] = (salesBySalesmen[name] || 0) + (inv.totalamount ?? 0);
    });

    return {
      labels: Object.keys(salesBySalesmen),
      datasets: [
        {
          label: "Sales by Salesman (₹)",
          data: Object.values(salesBySalesmen),
          backgroundColor: [
            "#6366f1",
            "#10b981",
            "#f59e0b",
            "#ef4444",
            "#3b82f6",
            "#ec4899",
          ],
        },
      ],
    };
  }, [salesInvoices, salesmen]);

  const filteredChartData =
    selectedSalesman === "All"
      ? salesmenChartData
      : {
          labels: [selectedSalesman],
          datasets: [
            {
              label: `Sales for ${selectedSalesman} (₹)`,
              data: [
                salesmenChartData.datasets[0].data[
                  salesmenChartData.labels.indexOf(selectedSalesman)
                ] || 0,
              ],
              backgroundColor: ["#6366f1"],
            },
          ],
        };

  return (
    <div className="bg-white p-4 rounded-xl shadow">
      <h2 className="text-md font-semibold mb-2">🧑 Sales by Salesmen</h2>

      <select
        className="mb-4 border rounded p-2 w-full"
        value={selectedSalesman}
        onChange={(e) => setSelectedSalesman(e.target.value)}
      >
        <option value="All">All Salesmen</option>
        {salesmen.length > 0 ? (
          salesmen.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))
        ) : (
          <option disabled>No salesmen available</option>
        )}
      </select>

      <Bar data={filteredChartData} />
    </div>
  );
};

export default SalesmenWiseSalesChart;
