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

  // Map category ID → Name
  const categoryIdToNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach((cat) => {
      if (cat?.id && cat?.categoryname) {
        map[cat.id] = cat.categoryname;
      }
    });
    return map;
  }, [categories]);

  // Aggregate sales by category ID
  const categorySalesMap = useMemo(() => {
    const map: Record<string, number> = {};

    salesInvoices.forEach((invoice: any) => {
      const invoiceProducts = invoice.productservice ?? []; // use productservice
      invoiceProducts.forEach((item: any) => {
        // Find the product in products list
        const prod: any = products.find((p: any) => p.id === item.productserviceid?.id);
        // Get category ID (handle object or undefined)
        const categoryId = prod?.categoryid?.id ?? "others";
        const amount = item.amount ?? (item.rate ?? 0) * (item.qty ?? 0);
        map[categoryId] = (map[categoryId] || 0) + amount;
      });
    });
    return map;
  }, [salesInvoices, products]);

  // Prepare chart data based on selected category
  const filteredChartData = useMemo(() => {
    if (selectedCategoryId === "All") {
      const totalSales = Object.values(categorySalesMap).reduce((a, b) => a + b, 0);
      return {
        labels: ["All Categories"],
        datasets: [
          {
            label: "Sales for All Categories (₹)",
            data: [totalSales],
            backgroundColor: ["#60a5fa"], // friendly blue
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
            backgroundColor: ["#60a5fa"], // blue
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
