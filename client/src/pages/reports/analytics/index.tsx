import React, { useEffect, useState } from "react";
import HomeLayout from "../../../layouts/home";
import ReportTable, { type ReportFilterField } from "../../../components/reporttable";
import { useSalesInvoicesQuery } from "../../../graphql/hooks/salesinvoice";
import { useProductServicesQuery } from "../../../graphql/hooks/products";
import { normalizeToYMD } from "../../../utils/helper";

const AnalyticalReports: React.FC = () => {
  const reportTabs = ["Top Selling Products", "Slow Moving Products", "Profit Margin Analysis"];
  const [activeTab, setActiveTab] = useState<string>(reportTabs[0]);
  const [filters, setFilters] = useState<{ [key: string]: any }>({});
  const [appliedFilters, setAppliedFilters] = useState<{ [key: string]: any }>({});

  // Fetch data
  const { data: salesData } = useSalesInvoicesQuery();
  const { data: productData } = useProductServicesQuery();

  const salesInvoices = salesData?.getSalesInvoices || [];
  const products = productData?.getProductServices || [];

  console.log("Sales Invoices:", JSON.stringify(salesInvoices, null, 2));
  console.log("Products:", JSON.stringify(products, null, 2));

  // Initialize date filter (last 30 days)
  useEffect(() => {
    const today = new Date();
    const to = today.toISOString().slice(0, 10);
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30)
      .toISOString()
      .slice(0, 10);
    setFilters({ fromDate: from, toDate: to });
    setAppliedFilters({ fromDate: from, toDate: to });
  }, []);

  let tableData: any[] = [];
  let columns: any[] = [];
  let filterFields: ReportFilterField[] = [];

  switch (activeTab) {
    case "Top Selling Products": {
      const topSellingMap: Record<string, any> = {};

      salesInvoices.forEach((inv) => {
        const invDate = normalizeToYMD(inv.billdate);
        const from = appliedFilters.fromDate;
        const to = appliedFilters.toDate;
        if ((from && invDate < from) || (to && invDate > to)) return;

        inv.productservice?.forEach((p: any) => {
          const prodId = p.productserviceid?.id;
          const prodName = p.productserviceid?.name;
          if (!topSellingMap[prodId]) {
            topSellingMap[prodId] = { productName: prodName, qtySold: 0, revenue: 0 };
          }
          topSellingMap[prodId].qtySold += p.qty || 0;
          topSellingMap[prodId].revenue += p.amount || 0;
        });
      });

      tableData = Object.values(topSellingMap).sort((a, b) => b.qtySold - a.qtySold);

      columns = [
        { label: "Product", key: "productName" },
        { label: "Quantity Sold", key: "qtySold" },
        { label: "Revenue", key: "revenue" },
      ];

      filterFields = [
        { name: "fromDate", label: "From Date", type: "date" },
        { name: "toDate", label: "To Date", type: "date" },
      ];
      break;
    }

    case "Slow Moving Products": {
      const slowMap: Record<string, any> = {};
      products.forEach((p) => {
        slowMap[p.id] = { productName: p.name, qtySold: 0 };
      });

      salesInvoices.forEach((inv) => {
        const invDate = normalizeToYMD(inv.billdate);
        const from = appliedFilters.fromDate;
        const to = appliedFilters.toDate;
        if ((from && invDate < from) || (to && invDate > to)) return;

        inv.productservice?.forEach((p: any) => {
          const prodId = p.productserviceid?.id;
          if (slowMap[prodId]) {
            slowMap[prodId].qtySold += p.qty || 0;
          }
        });
      });

      tableData = Object.values(slowMap)
        .filter((row) => row.qtySold > 0)
        .sort((a, b) => a.qtySold - b.qtySold);

      columns = [
        { label: "Product", key: "productName" },
        { label: "Quantity Sold", key: "qtySold" },
      ];

      filterFields = [
        { name: "fromDate", label: "From Date", type: "date" },
        { name: "toDate", label: "To Date", type: "date" },
      ];
      break;
    }

    case "Profit Margin Analysis": {
      const marginMap: Record<string, any> = {};

      salesInvoices.forEach((inv) => {
        const invDate = normalizeToYMD(inv.billdate);
        const from = appliedFilters.fromDate;
        const to = appliedFilters.toDate;
        if ((from && invDate < from) || (to && invDate > to)) return;

        inv.productservice?.forEach((p: any) => {
          const prodId = p.productserviceid?.id;
          const prodName = p.productserviceid?.name;
          if (!marginMap[prodId]) {
            marginMap[prodId] = { productName: prodName, revenue: 0, cost: 0 };
          }
          marginMap[prodId].revenue += p.amount || 0;
          marginMap[prodId].cost += p.purchaseamount || 0;
        });
      });

      tableData = Object.values(marginMap).map((m) => ({
        ...m,
        profit: m.revenue - m.cost,
        profitMargin: m.revenue ? (((m.revenue - m.cost) / m.revenue) * 100).toFixed(2) + "%" : "-",
      }));

      columns = [
        { label: "Product", key: "productName" },
        { label: "Revenue", key: "revenue" },
        { label: "Cost", key: "cost" },
        { label: "Profit", key: "profit" },
        { label: "Profit Margin", key: "profitMargin" },
      ];

      filterFields = [
        { name: "fromDate", label: "From Date", type: "date" },
        { name: "toDate", label: "To Date", type: "date" },
      ];
      break;
    }
  }

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <ReportTable
          title="Analytical Reports"
          columns={columns}
          data={tableData}
          filterFields={filterFields}
          filters={filters}
          setFilters={setFilters}
          appliedFilters={appliedFilters}
          setAppliedFilters={setAppliedFilters}
          defaultTab={activeTab}
          tabs={reportTabs}
          onTabChange={(tab) => setActiveTab(tab)}
          showExport
          showCsv
        />
      </div>
    </HomeLayout>
  );
};

export default AnalyticalReports;
