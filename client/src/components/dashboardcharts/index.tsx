import React, { useMemo } from "react";
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

import MonthlySalesChart from "./monthlysaleschart";
import RevenueAndSalesChart from "./revenuevssaleschart";
import StockInOutDoughnutChart from "./stockinoutdoughnutchart";
import ProfitLossChart from "./profilevslosschart";
import DailySalesChart from "./dailysaleschart";
import TargetVsSalesChart from "./targetsvssaleschart";
import CategoryWiseSalesChart from "./categorywisesaleschart";
import SalesmenWiseSalesChart from "./salesmenwisesaleschart"; // Keep file name same unless you want rename it too

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Title
);

// Interfaces
export interface Staff {
  id: string;
  name: string;
  mobile: string;
  target: string;
  role: string;
  status: boolean;
}

export interface SalesInvoiceProduct {
  productid: string;
  rate?: number;
  qty?: number;
  amount?: number;
}

export interface SalesInvoice {
  id: string;
  billdate: string;
  products: SalesInvoiceProduct[];
  totalamount?: number;
  staffid?: string; // updated from salesmenid
}

export interface PurchaseInvoiceProduct {
  qty?: number;
}

export interface PurchaseInvoice {
  products: PurchaseInvoiceProduct[];
}

export interface Product {
  id: string;
  productname: string;
  categoryid?: string;
  openingstock?: number;
  currentstock?: number;
  minimumstock?: number;
}

export interface TransferStock {
  id: string;
  frombranchid: string;
  tobranchid: string;
  productid: string;
  transferqty?: number;
  status: boolean;
}

export interface Category {
  id: string;
  categoryname: string;
}

export interface DashboardChartsProps {
  salesInvoiceData?: { getSalesInvoices: any[] };
  purchaseInvoiceData?: { getPurchaseInvoices: any[] };
  productData?: { getProductServices: any[] };
  transferStockData?: { getTransferStocks: any[] };
  staffData?: { getStaffAccounts: any[] };   // UPDATED
  categoryData?: { getCategories: any[] };
  transactionData?: { getTransactions: any[] };
  branchId: string;
}

const DashboardCharts: React.FC<DashboardChartsProps> = ({
  salesInvoiceData,
  purchaseInvoiceData,
  productData,
  transferStockData,
  staffData,         // UPDATED
  categoryData,
  transactionData,
  branchId,
}) => {
  const invoices = salesInvoiceData?.getSalesInvoices ?? [];
  const purchaseInvoices = purchaseInvoiceData?.getPurchaseInvoices ?? [];
  const products = productData?.getProductServices ?? [];
  const transfers = transferStockData?.getTransferStocks ?? [];
  const staff = staffData?.getStaffAccounts ?? [];   // UPDATED
  const categories = categoryData?.getCategories ?? [];

  useMemo(() => {
    return new Map(staff.map((s) => [s.id, s.name]));
  }, [staff]);

  return (
    <div className="space-y-8">
      {/* Top Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MonthlySalesChart salesInvoices={invoices} />
        <RevenueAndSalesChart salesInvoices={invoices} />
        <StockInOutDoughnutChart
          products={products}
          transfers={transfers}
          invoices={invoices}
          purchaseInvoices={purchaseInvoices}
          branchId={branchId}
        />
        <ProfitLossChart transactions={transactionData?.getTransactions ?? []} />
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DailySalesChart salesInvoices={invoices} />
        <TargetVsSalesChart salesInvoices={invoices} staff={staff} />    
        <CategoryWiseSalesChart
          salesInvoices={invoices}
          products={products}
          categories={categories}
        />
        <SalesmenWiseSalesChart salesInvoices={invoices} staff={staff} /> 
      </div>
    </div>
  );
};

export default DashboardCharts;
