import React, { useState, useMemo } from "react";
import { Bar } from "react-chartjs-2";
import type { Category, Product, SalesInvoice } from "..";

interface Props {
  salesInvoices?: SalesInvoice[];
  products?: Product[];
  categories?: Category[];
}

const CategoryWiseSalesChart: React.FC<Props> = ({
  salesInvoices = [],
  products = [],
  categories = [],
}) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("All");

  const categoryIdToNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach((cat) => {
      if (cat?.id && cat?.categoryname) {
        map[cat.id] = cat.categoryname;
      }
    });
    return map;
  }, [categories]);

  const categorySalesMap = useMemo(() => {
    const map: Record<string, number> = {};

    salesInvoices.forEach((invoice: any) => {
      const invoiceProducts = invoice.productservice ?? [];
      invoiceProducts.forEach((item: any) => {
        const prod: any = products.find((p: any) => p.id === item.productserviceid?.id);
        const categoryId = prod?.categoryid?.id ?? "others";
        const amount = item.amount ?? (item.rate ?? 0) * (item.qty ?? 0);
        map[categoryId] = (map[categoryId] || 0) + amount;
      });
    });
    return map;
  }, [salesInvoices, products]);

  const filteredChartData = useMemo(() => {
    if (selectedCategoryId === "All") {
      const totalSales = Object.values(categorySalesMap).reduce((a, b) => a + b, 0);
      return {
        labels: ["All Categories"],
        datasets: [
          {
            label: "Sales Valuation (₹)",
            data: [totalSales],
            backgroundColor: ["#3b82f6"],
          },
        ],
      };
    } else {
      const label = categoryIdToNameMap[selectedCategoryId] ?? "Unknown";
      const value = categorySalesMap[selectedCategoryId] || 0;
      return {
        labels: [label],
        datasets: [
          {
            label: `Sales for ${label} (₹)`,
            data: [value],
            backgroundColor: ["#3b82f6"],
          },
        ],
      };
    }
  }, [selectedCategoryId, categorySalesMap, categoryIdToNameMap]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" as const, labels: { font: { size: 10 } } },
    },
    scales: {
      y: { ticks: { font: { size: 10 } } },
      x: { ticks: { font: { size: 10 } } },
    },
  };

  return (
    <div className="bg-white p-3.5 rounded border border-gray-200 shadow-2xs font-sans flex flex-col justify-between h-80 sm:h-96">
      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="text-xs font-bold text-[#2c3e50] capitalize tracking-wider truncate">Category Sales</h3>
          <select
            className="border border-gray-300 rounded px-2 py-0.5 text-[10px] text-gray-700 bg-white shadow-2xs focus:outline-none"
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
          >
            <option value="All">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.categoryname}
              </option>
            ))}
          </select>
        </div>
        <p className="text-[10px] text-gray-500 mb-2">Revenue breakdown by product group</p>
      </div>
      <div className="flex-1 min-h-[200px]">
        <Bar data={filteredChartData} options={options} />
      </div>
    </div>
  );
};

export default CategoryWiseSalesChart;
