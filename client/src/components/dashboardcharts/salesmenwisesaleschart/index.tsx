import React, { useMemo, useState } from "react";
import { Bar } from "react-chartjs-2";
import type { SalesInvoice, Staff } from "..";

interface Props {
  salesInvoices: SalesInvoice[];
  staff: Staff[];
}

const SalesmenWiseSalesChart: React.FC<Props> = ({ salesInvoices, staff }) => {

  // ---------------------------------------------------
  // ✅ Filter only role = "salesman"
  // ---------------------------------------------------
  const filteredSalesmen = useMemo(
    () => staff.filter((s) => s.role?.toLowerCase() === "salesman"),
    [staff]
  );

  // Selected salesman
  const [selectedSalesmanId, setSelectedSalesmanId] = useState<string>("All");

  // Map salesman ID → name
  const salesmenMap = useMemo(() => {
    const map = new Map<string, string>();
    filteredSalesmen.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [filteredSalesmen]);

  // Aggregate sales by salesman ID
  const salesBySalesmen = useMemo(() => {
    const salesMap: Record<string, number> = {};
    salesInvoices.forEach((inv: any) => {
      const salesmanId = inv.salesmenid?.id ?? "others";
      const amount = inv.totalamount ?? 0;
      salesMap[salesmanId] = (salesMap[salesmanId] || 0) + amount;
    });
    return salesMap;
  }, [salesInvoices]);

  // Prepare chart data
  const filteredChartData = useMemo(() => {
    if (selectedSalesmanId === "All") {
      const labels: string[] = [];
      const data: number[] = [];

      Object.entries(salesBySalesmen).forEach(([id, amount]) => {
        const label =
          id === "others"
            ? "Others"
            : salesmenMap.get(id) || "Unknown";
        labels.push(label);
        data.push(amount);
      });

      const colors = ["#6366f1", "#10b981", "#8b5cf6", "#f59e0b", "#3b82f6", "#14b8a6"];

      return {
        labels,
        datasets: [
          {
            label: "Sales (₹)",
            data,
            backgroundColor: labels.map((_, i) => colors[i % colors.length]),
          },
        ],
      };
    } else {
      const label = salesmenMap.get(selectedSalesmanId) || "Unknown";
      const value = salesBySalesmen[selectedSalesmanId] || 0;

      return {
        labels: [label],
        datasets: [
          {
            label: `Sales for ${label} (₹)`,
            data: [value],
            backgroundColor: ["#6366f1"],
          },
        ],
      };
    }
  }, [selectedSalesmanId, salesBySalesmen, salesmenMap]);

  return (
    <div className="bg-white p-4 rounded-xl shadow">
      <h2 className="text-md font-semibold mb-2">🧑 Sales by Salesmen</h2>

      <select
        className="mb-4 border rounded p-2 w-full"
        value={selectedSalesmanId}
        onChange={(e) => setSelectedSalesmanId(e.target.value)}
      >
        <option value="All">All Salesmen</option>
        {filteredSalesmen.length > 0 ? (
          filteredSalesmen.map((s) => (
            <option key={s.id} value={s.id}>
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
