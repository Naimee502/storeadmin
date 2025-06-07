// components/dashboardcharts/categorywisesaleschart.tsx

import React, { useState, useMemo } from "react";
import { Bar } from "react-chartjs-2";
import type { Category, Product, SalesInvoice } from "..";

interface Props {
  salesInvoices: SalesInvoice[];
  products: Product[];
  categories: Category[];
}

const CategoryWiseSalesChart: React.FC<Props> = ({
  salesInvoices,
  products,
  categories,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const categoryChartData = useMemo(() => {
    const categorySalesMap: Record<string, number> = {};

    salesInvoices.forEach((invoice) => {
      invoice.products.forEach((product:any) => {
        const prod = products.find((p) => p.id === product.productid);
        const cat = prod?.category ?? "Others";
        const amt = product.amount ?? (product.rate ?? 0) * (product.qty ?? 0);
        categorySalesMap[cat] = (categorySalesMap[cat] || 0) + amt;
      });
    });

    return {
      labels: Object.keys(categorySalesMap),
      datasets: [
        {
          label: "Sales by Category (₹)",
          data: Object.values(categorySalesMap),
          backgroundColor: [
            "#60a5fa",
            "#34d399",
            "#f87171",
            "#fbbf24",
            "#a78bfa",
            "#fb7185",
            "#2dd4bf",
            "#c084fc",
          ],
        },
      ],
    };
  }, [salesInvoices, products]);

  const filteredChartData =
    selectedCategory === "All"
      ? categoryChartData
      : {
          labels: [selectedCategory],
          datasets: [
            {
              label: `Sales for ${selectedCategory} (₹)`,
              data: [
                categoryChartData.datasets[0].data[
                  categoryChartData.labels.indexOf(selectedCategory)
                ] || 0,
              ],
              backgroundColor: ["#60a5fa"],
            },
          ],
        };

  return (
    <div className="bg-white p-4 rounded-xl shadow">
      <h2 className="text-md font-semibold mb-2">📚 Category-wise Sales</h2>

      <select
        className="mb-4 border rounded p-2 w-full"
        value={selectedCategory}
        onChange={(e) => setSelectedCategory(e.target.value)}
      >
        <option value="All">All Categories</option>
        {categories.length > 0 ? (
          categories.map((cat) => (
            <option key={cat.id} value={cat.categoryname}>
              {cat.categoryname}
            </option>
          ))
        ) : (
          <option disabled>No categories available</option>
        )}
      </select>

      <Bar data={filteredChartData} />
    </div>
  );
};

export default CategoryWiseSalesChart;
