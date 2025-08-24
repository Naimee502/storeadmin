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

  // Prepare category ID → Name map
  const categoryIdToNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach((cat) => {
      if (cat?.id && cat?.categoryname) {
        map[cat.id] = cat.categoryname;
      }
    });
    return map;
  }, [categories]);

  // Sales data grouped by category ID
  const categorySalesMap = useMemo(() => {
    const map: Record<string, number> = {};

    salesInvoices.forEach((invoice) => {
      const invoiceProducts = invoice.products ?? [];
      invoiceProducts.forEach((product: any) => {
        const prod = products.find((p) => p.id === product.productid || p.id === product.id);
        const categoryId = prod?.categoryid ?? "others";
        const amount = product.amount ?? (product.rate ?? 0) * (product.qty ?? 0);
        map[categoryId] = (map[categoryId] || 0) + amount;
      });
    });

    return map;
  }, [salesInvoices, products]);

  // Filtered chart data based on selected category
  const filteredChartData = useMemo(() => {
    if (selectedCategoryId === "All") {
      const totalSales = Object.values(categorySalesMap).reduce((a, b) => a + b, 0);
      return {
        labels: ["All Categories"],
        datasets: [
          {
            label: "Sales for All Categories (₹)",
            data: [totalSales],
            backgroundColor: ["#60a5fa"],
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
            backgroundColor: ["#60a5fa"],
          },
        ],
      };
    }
  }, [selectedCategoryId, categorySalesMap, categoryIdToNameMap]);

  return (
    <div className="bg-white p-4 rounded-xl shadow">
      <h2 className="text-md font-semibold mb-2">📚 Category-wise Sales</h2>

      <select
        className="mb-4 border rounded p-2 w-full"
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

      <Bar data={filteredChartData} />
    </div>
  );
};

export default CategoryWiseSalesChart;
