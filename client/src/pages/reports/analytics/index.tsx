import React, { useEffect, useState, useMemo, useCallback } from "react";
import HomeLayout from "../../../layouts/home";
import ReportTable, { type ReportFilterField } from "../../../components/reporttable";
import { useQuery } from "@apollo/client";
import { useAppSelector } from "../../../redux/hooks";
import { ANALYTICS_REPORT_SALES_INVOICES, ANALYTICS_REPORT_PRODUCT_COSTS } from "../../../graphql/queries/reports/analytics";
import { PRODUCT_REPORT_PRODUCT_OPTIONS } from "../../../graphql/queries/reports/product";
import { normalizeToYMD, todayYMD, shiftDaysYMD } from "../../../utils/helper";
import { FaTrophy, FaHourglassHalf, FaChartLine } from "react-icons/fa";

const reportTabsObj = [
  { id: "Top Selling Products", label: "Top Selling Products", icon: <FaTrophy className="text-xs text-amber-500" /> },
  { id: "Slow Moving Products", label: "Slow Moving Products", icon: <FaHourglassHalf className="text-xs text-blue-500" /> },
  { id: "Profit Margin Analysis", label: "Profit Margin Analysis", icon: <FaChartLine className="text-xs text-emerald-500" /> },
];

const AnalyticalReports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>(reportTabsObj[0].id);
  const [filters, setFilters] = useState<{ [key: string]: any }>({});
  const [appliedFilters, setAppliedFilters] = useState<{ [key: string]: any }>({});

  // Fetch data
  // Same adminid/branchid scoping as useSalesInvoicesQuery.
  const { type, admin, branch, staff: authStaff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);
  const adminid = type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? authStaff?.admin?.id : undefined;
  const branchid = type === 'admin' ? selectedBranchId : type === 'branch' ? branch?.id : type === 'staff' ? authStaff?.branchid?.id : undefined;
  const { data: salesData } = useQuery(ANALYTICS_REPORT_SALES_INVOICES, {
    variables: {
      // Server now ranges invoices by billdate (text compare, whole To day
      // included), so only the chosen period is downloaded. The client-side
      // date filter below stays as a safety net.
      filter: {
        adminid,
        branchid,
        ...(appliedFilters.fromDate ? { billdateFrom: appliedFilters.fromDate } : {}),
        ...(appliedFilters.toDate ? { billdateTo: appliedFilters.toDate } : {}),
      },
    },
  });
  // Product list is only read by "Slow Moving Products".
  const { data: productData } = useQuery(PRODUCT_REPORT_PRODUCT_OPTIONS, {
    variables: { filter: { adminid, branchid, status: true }, limit: 0, offset: 0 },
    skip: !adminid || activeTab !== "Slow Moving Products",
    fetchPolicy: "cache-and-network",
  });

  // Purchase rates are only read by "Profit Margin Analysis". No status filter:
  // a product deactivated since it was sold still needs its cost.
  const { data: costData } = useQuery(ANALYTICS_REPORT_PRODUCT_COSTS, {
    variables: { filter: { adminid, branchid }, limit: 0, offset: 0 },
    skip: !adminid || activeTab !== "Profit Margin Analysis",
    fetchPolicy: "cache-and-network",
  });

  // Cancelled bills are reversed out of the books — same default as the hook.
  const salesInvoices: any[] = useMemo(
    () => (salesData?.getSalesInvoices || []).filter((i: any) => i?.cancelStatus !== "cancelled"),
    [salesData]
  );
  const products: any[] = useMemo(() => productData?.getProductServices || [], [productData]);

  // productId -> variants (with purchase rate + unit conversions).
  const variantsByProduct = useMemo(() => {
    const map: Record<string, any[]> = {};
    (costData?.getProductServices || []).forEach((p: any) => {
      if (p?.id) map[p.id] = p.productvariants || [];
    });
    return map;
  }, [costData]);

  // Initialize date filter (last 30 days)
  useEffect(() => {
    const to = todayYMD();
    const from = shiftDaysYMD(-30);
    setFilters({ fromDate: from, toDate: to });
    setAppliedFilters({ fromDate: from, toDate: to });
  }, []);

  // ── Top Selling Products ──
  const topSellingData = useMemo(() => {
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
    return Object.values(topSellingMap).sort((a, b) => b.qtySold - a.qtySold);
  }, [salesInvoices, appliedFilters]);

  // ── Slow Moving Products ──
  const slowMovingData = useMemo(() => {
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
        if (slowMap[prodId]) slowMap[prodId].qtySold += p.qty || 0;
      });
    });
    return Object.values(slowMap)
      .filter((row) => row.qtySold > 0)
      .sort((a, b) => a.qtySold - b.qtySold);
  }, [salesInvoices, products, appliedFilters]);

  // ── Profit Margin Analysis ──
  // Invoice lines keep no purchase-cost snapshot, so a line is costed at the
  // variant's CURRENT purchaserate (an approximation: past bills are valued at
  // today's rate, not the rate/average cost at the time of sale). Units follow
  // the server's stock maths: qty × unitqty is converted to base units via the
  // sales unit's factor, and purchaserate (per purchase unit) is divided by the
  // purchase unit's factor. A missing / zero rate means "unknown cost".
  const lineCost = useCallback((p: any): number | null => {
    const variants = variantsByProduct[p.productserviceid?.id];
    if (!variants?.length) return null;
    const variantId = p.variantid?.id;
    const variant = variantId
      ? variants.find((v: any) => v?.id === variantId)
      : variants.length === 1 ? variants[0] : null;
    const rate = Number(variant?.purchaserate);
    if (!variant || !Number.isFinite(rate) || rate <= 0) return null;
    const factorOf = (unitId?: string): number => {
      if (!unitId || unitId === variant.baseunitid?.id) return 1;
      const f = Number(variant.unitconversions?.find((u: any) => u?.unitid?.id === unitId)?.factor);
      return Number.isFinite(f) && f > 0 ? f : 1;
    };
    const baseQty = (Number(p.qty) || 0) * (Number(p.unitqty) || 1) * factorOf(p.salesunitid?.id);
    const baseRate = rate / factorOf(variant.purchaseunitid?.id);
    return baseQty * baseRate;
  }, [variantsByProduct]);

  const profitMarginData = useMemo(() => {
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
          marginMap[prodId] = { productName: prodName, revenue: 0, cost: 0, costUnknown: false };
        }
        marginMap[prodId].revenue += Number(p.amount) || 0;
        const c = lineCost(p);
        if (c === null) marginMap[prodId].costUnknown = true;
        else marginMap[prodId].cost += c;
      });
    });
    const round2 = (n: number) => Math.round(n * 100) / 100;
    // Any line without a known cost makes the product's cost/profit/margin
    // unknown ("-", which ReportTable leaves out of the Totals row) rather
    // than a misleading partial figure.
    return Object.values(marginMap).map(({ costUnknown, ...m }) => {
      if (costUnknown) return { ...m, revenue: round2(m.revenue), cost: "-", profit: "-", profitMargin: "-" };
      const profit = m.revenue - m.cost;
      return {
        ...m,
        revenue: round2(m.revenue),
        cost: round2(m.cost),
        profit: round2(profit),
        profitMargin: m.revenue > 0 ? ((profit / m.revenue) * 100).toFixed(2) + "%" : "-",
      };
    });
  }, [salesInvoices, appliedFilters, lineCost]);

  // ── Tab Config ──
  let tableData: any[] = [];
  let columns: any[] = [];
  let filterFields: ReportFilterField[] = [];
  let title = "Analytical Reports";
  let exportFileName = "AnalyticsReport";

  switch (activeTab) {
    case "Top Selling Products":
      tableData = topSellingData;
      title = "Top Selling Products";
      exportFileName = "TopSellingProducts";
      columns = [
        { label: "Product", key: "productName" },
        { label: "Quantity Sold", key: "qtySold", numeric: true },
        { label: "Revenue (₹)", key: "revenue", numeric: true },
      ];
      filterFields = [
        { name: "fromDate", label: "From Date", type: "date" },
        { name: "toDate", label: "To Date", type: "date" },
      ];
      break;

    case "Slow Moving Products":
      tableData = slowMovingData;
      title = "Slow Moving Products";
      exportFileName = "SlowMovingProducts";
      columns = [
        { label: "Product", key: "productName" },
        { label: "Quantity Sold", key: "qtySold", numeric: true },
      ];
      filterFields = [
        { name: "fromDate", label: "From Date", type: "date" },
        { name: "toDate", label: "To Date", type: "date" },
      ];
      break;

    case "Profit Margin Analysis":
      tableData = profitMarginData;
      title = "Profit Margin Analysis";
      exportFileName = "ProfitMarginAnalysis";
      columns = [
        { label: "Product", key: "productName" },
        { label: "Revenue (₹)", key: "revenue", numeric: true },
        { label: "Cost (₹)", key: "cost", numeric: true },
        { label: "Profit (₹)", key: "profit", numeric: true },
        { label: "Profit Margin %", key: "profitMargin" },
      ];
      filterFields = [
        { name: "fromDate", label: "From Date", type: "date" },
        { name: "toDate", label: "To Date", type: "date" },
      ];
      break;
  }

  return (
    <HomeLayout>
      <div className="w-full p-4 font-sans">
        <div className="flex flex-wrap gap-2 mb-3">
          {reportTabsObj.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium transition-colors cursor-pointer ${
                  isActive
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
        <ReportTable moduleId="reports.analytical"
          title={title}
          columns={columns}
          data={tableData}
          filterFields={filterFields}
          filters={filters}
          setFilters={setFilters}
          appliedFilters={appliedFilters}
          setAppliedFilters={setAppliedFilters}
          showExport
          showCsv
          showPdf
          exportFileName={exportFileName}
          showTotals
        />
      </div>
    </HomeLayout>
  );
};

export default AnalyticalReports;
