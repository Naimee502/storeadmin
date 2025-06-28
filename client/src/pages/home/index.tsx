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
import { usePurchaseInvoicesQuery } from "../../graphql/hooks/purchaseinvoice";

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
  const branchId = useAppSelector((state) => state.selectedBranch.branchId);

  // GraphQL query hooks with refetch support
  const { data: customerData, refetch: refetchCustomers } = useAccountsQuery(branchId);
  const { data: categoryData, refetch: refetchCategories } = useCategoriesQuery();
  const { data: salesmenData, refetch: refetchSalesmen } = useSalesmenQuery(branchId);
  const { data: productData, refetch: refetchProducts } = useProductsQuery();
  const { data: purchaseInvoiceData, refetch: refetchPurchaseInvoices } = usePurchaseInvoicesQuery(branchId);
  const { data: salesInvoiceData, refetch: refetchSalesInvoices } = useSalesInvoicesQuery(branchId);
  const { data: transferStockData, refetch: refetchTransferStock } = useTransferStocksQuery(branchId);

  // Refetch all data when branch ID changes
  useEffect(() => {
    console.log("Branch ID changed:", branchId);

    if (type === "branch") {
      refetchCustomers();
      refetchSalesmen();
      refetchSalesInvoices();
      refetchPurchaseInvoices();
    }

    refetchTransferStock();
    refetchCategories();
    refetchProducts();
  }, [branchId, type]);

  return (
    <HomeLayout>
      <div className="p-6 space-y-6">
        <StatsCards
          customerData={customerData}
          productData={productData}
          salesInvoiceData={salesInvoiceData}
          purchaseInvoiceData={purchaseInvoiceData}
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
