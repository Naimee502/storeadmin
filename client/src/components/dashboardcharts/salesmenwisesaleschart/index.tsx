import React, { useMemo, useState } from "react";
import { Bar } from "react-chartjs-2";
import type { SalesInvoice, Salesman } from "..";

interface Props {
  salesInvoices: SalesInvoice[];
  salesmen: Salesman[];
}

const SalesmenWiseSalesChart: React.FC<Props> = ({ salesInvoices, salesmen }) => {
  // Use salesman ID as selected value
  const [selectedSalesmanId, setSelectedSalesmanId] = useState<string>("All");

  // Map salesman ID → name
  const salesmenMap = useMemo(() => {
    const map = new Map<string, string>();
    salesmen.forEach((s) => {
      map.set(s.id, s.name);
    });
    
    return map;
  }, [salesmen]);

  // Aggregate sales by salesman ID
  const salesBySalesmen = useMemo(() => {
  const salesMap: Record<string, number> = {};

  salesInvoices.forEach((inv) => {
    // Use salesmenid here (with double m) to match your data!
    const salesmanId = inv.salesmenid ?? "others";
    const amount = inv.totalamount ?? 0;
   
    salesMap[salesmanId] = (salesMap[salesmanId] || 0) + amount;
  });

  return salesMap;
}, [salesInvoices]);

  // Prepare chart data based on selected salesman ID
  const filteredChartData = useMemo(() => {
    
    if (selectedSalesmanId === "All") {
      // Aggregate total sales for all salesmen
      const totalSales = Object.values(salesBySalesmen).reduce(
        (sum, val) => sum + val,
        0
      );
      
      return {
        labels: ["All Salesmen"],
        datasets: [
          {
            label: "Sales for All Salesmen (₹)",
            data: [totalSales],
            backgroundColor: ["#6366f1"],
          },
        ],
      };
    } else {
      // Sales for selected salesman ID
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
        {salesmen.length > 0 ? (
          salesmen.map((s) => (
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
