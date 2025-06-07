import React, { useEffect } from "react";
import HomeLayout from "../../layouts/home";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Title,
} from "chart.js";

import { useAccountsQuery } from "../../graphql/hooks/accounts";
import { useSalesInvoicesQuery } from "../../graphql/hooks/salesinvoice";
import { useProductsQuery } from "../../graphql/hooks/products";
import { useAppSelector } from "../../redux/hooks";
import { useTransferStocksQuery } from "../../graphql/hooks/transferstock";
import { useSalesmenQuery } from "../../graphql/hooks/salesmenaccount";
import { useCategoriesQuery } from "../../graphql/hooks/categories";
import StatsCards from "../../components/statuscards";
import DashboardCharts from "../../components/dashboardcharts";
import RecentOrders from "../../components/recentorders";


ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  ArcElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

const Home: React.FC = () => {
  const { type } = useAppSelector((state) => state.auth);

  const branchId = localStorage.getItem("branchid") || "";

  // Fetch data queries
  const { data: customerData } = useAccountsQuery(type === "branch" ? branchId : undefined);
  const { data: categoryData } = useCategoriesQuery();
  const { data: salesmenData } = useSalesmenQuery(type === "branch" ? branchId : undefined);
  const { data: productData } = useProductsQuery();
  const { data: salesInvoiceData } = useSalesInvoicesQuery(type === "branch" ? branchId : undefined);
  const { data: transferStockData } = useTransferStocksQuery();

  const categoryList = categoryData?.getCategories || [];
  const productList = productData?.getProducts || [];

  useEffect(() => {
    console.log("Customer Data:", JSON.stringify(customerData, null, 2));
    console.log("Category Data:", JSON.stringify(categoryList, null, 2));
    console.log("Salesmen Data:", JSON.stringify(salesmenData, null, 2));
    console.log("Product Data:", JSON.stringify(productList, null, 2));
    console.log("Sales Invoice Data:", JSON.stringify(salesInvoiceData, null, 2));
    console.log("Transfer Stock Data:", JSON.stringify(transferStockData, null, 2));
  }, [
    customerData,
    categoryList,
    salesmenData,
    productList,
    salesInvoiceData,
    transferStockData,
  ]);

  return (
    <HomeLayout>
      <div className="p-6 space-y-6">
        <StatsCards
          customerData={customerData}
          productData={productData}
          salesInvoiceData={salesInvoiceData}
          transferStockData={transferStockData}
          branchId={branchId}
        />

        <DashboardCharts
          salesInvoiceData={salesInvoiceData}
          productData={productData}
          transferStockData={transferStockData}
          salesmenData={salesmenData}
          categoryData={categoryData}
          branchId={branchId}
        />

        <RecentOrders
          salesInvoiceData={salesInvoiceData}
          customerData={customerData}
        />
      </div>
    </HomeLayout>
  );
};

export default Home;
