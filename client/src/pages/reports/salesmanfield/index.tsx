import React, { useEffect, useMemo, useState } from "react";
import HomeLayout from "../../../layouts/home";
import ReportTable, { type ReportFilterField, type ReportColumn } from "../../../components/reporttable";
import { useStaffQuery } from "../../../graphql/hooks/staffaccounts";
import { useSalesOrdersQuery } from "../../../graphql/hooks/salesorder";
import { usePaymentsQuery } from "../../../graphql/hooks/payments";
import { useVisitsQuery } from "../../../graphql/hooks/visit";
import { useSalesRoutesQuery } from "../../../graphql/hooks/salesroutes";
import { useLatestLocationsQuery, useLocationPingsQuery } from "../../../graphql/hooks/locationping";
import LiveTrackingMap from "../../../components/livetrackingmap";
import { useAppSelector } from "../../../redux/hooks";
import { normalizeToYMD, formatDateDMY, formatDateTimeDMY } from "../../../utils/helper";
import { FaChartBar, FaRoute, FaMapMarkedAlt } from "react-icons/fa";

const reportTabsObj = [
  { id: "Summary", label: "Summary", icon: <FaChartBar className="text-amber-500" /> },
  { id: "Day-wise Detail", label: "Day-wise Detail", icon: <FaRoute className="text-blue-500" /> },
  { id: "Live Tracking", label: "Live Tracking", icon: <FaMapMarkedAlt className="text-emerald-500" /> },
];

// Weekday name from a YYYY-MM-DD string (for rows that come from orders, which
// don't carry a route "day").
const weekdayOf = (ymd: string) => {
  const d = new Date(ymd);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { weekday: "long" });
};

// Route days are stored inconsistently ("sun" from the admin panel, "Sunday"
// from the app). Normalise to a full weekday name so every row reads the same
// (e.g. both "Without Route" and route rows show "Sunday", never "sun").
const DAY_FULL: Record<string, string> = {
  sun: "Sunday", mon: "Monday", tue: "Tuesday", wed: "Wednesday",
  thu: "Thursday", fri: "Friday", sat: "Saturday",
};
const fullDay = (day: string | undefined, ymd: string) =>
  DAY_FULL[String(day ?? "").trim().slice(0, 3).toLowerCase()] || weekdayOf(ymd);

/**
 * Salesman Field Report — SaaS-style overview of field activity per salesman:
 *  • Orders taken (total / via app / on a route / without a route)
 *  • Sales value booked + payment collections done in the field
 *  • Positive (visited) vs negative (not-visited) calls
 *  • Route + day-wise breakdown
 *  • Live-location / route-trace section (placeholder until the app sends GPS)
 */
const SalesmanFieldReport: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>(reportTabsObj[0].id);
  const [filters, setFilters] = useState<{ [key: string]: any }>({});
  const [appliedFilters, setAppliedFilters] = useState<{ [key: string]: any }>({});

  const { type, admin, branch, staff } = useAppSelector((s: any) => s.auth);
  const adminId = type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : type === "staff" ? staff?.admin?.id : undefined;
  const branchId = type === "branch" ? branch?.id : type === "staff" ? staff?.branchid?.id : undefined;

  const { data: staffData } = useStaffQuery();
  // includeConverted: an order that became an invoice is still an order the
  // salesman booked in the field — it must count in totals / route split.
  const { data: ordersData } = useSalesOrdersQuery({ includeConverted: true });
  const { data: paymentsData } = usePaymentsQuery();
  const { data: visitsData } = useVisitsQuery();
  const { data: routesData } = useSalesRoutesQuery({ adminId, branchId });

  // Live-tracking data honours the report filters: date range narrows the pings,
  // and picking a salesman fetches their ordered trail (punch-in → punch-out).
  const locFilter = useMemo(() => ({
    role: "salesman",
    staffid: appliedFilters.salesmanid || undefined,
    dateFrom: appliedFilters.fromDate || undefined,
    dateTo: appliedFilters.toDate || undefined,
  }), [appliedFilters]);
  const { data: locationsData } = useLatestLocationsQuery(locFilter);
  const { data: trailData } = useLocationPingsQuery(locFilter);

  const staffList = [...(staffData?.getStaffAccounts || [])].reverse();
  // Salesman field report → only salesman-role staff (not "staff" or "deliveryboy").
  const salesmen = staffList.filter(
    (s: any) => s.role?.toLowerCase() === "salesman"
  );
  const orders = ordersData?.getSalesOrders || [];
  const payments = paymentsData?.getPayments || [];
  const visits = visitsData?.getVisits || [];
  const routes = routesData?.getSalesRoutes || [];
  const locations = locationsData?.getLatestLocations || [];
  // Full ordered trail (punch-in → punch-out) only when a single salesman is picked.
  const trail = appliedFilters.salesmanid ? ((trailData as any)?.getLocationPings || []) : [];

  // Default last 30 days
  useEffect(() => {
    const today = new Date();
    const to = today.toISOString().slice(0, 10);
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30).toISOString().slice(0, 10);
    setFilters({ fromDate: from, toDate: to });
    setAppliedFilters({ fromDate: from, toDate: to });
  }, []);

  const inRange = (d: string | null) => {
    if (!d) return false;
    const { fromDate, toDate } = appliedFilters;
    if (fromDate && d < fromDate) return false;
    if (toDate && d > toDate) return false;
    return true;
  };

  const matchSalesman = (id?: string) => !appliedFilters.salesmanid || id === appliedFilters.salesmanid;
  const matchRoute = (id?: string) => !appliedFilters.routeid || id === appliedFilters.routeid;

  // ── Filtered datasets ───────────────────────────────────────────────
  const fOrders = useMemo(
    () => orders.filter((o: any) => inRange(normalizeToYMD(o.billdate)) && matchSalesman(o.salesmenid?.id) && matchRoute(o.routeid)),
    [orders, appliedFilters]
  );
  const fVisits = useMemo(
    () => visits.filter((v: any) => inRange(normalizeToYMD(v.visitdate)) && matchSalesman(v.salesmanid?.id) && matchRoute(v.routeid?.id)),
    [visits, appliedFilters]
  );
  // Map each party → the salesman who booked its orders, so a receipt with no
  // stored collector id can still be credited to the right salesman via its party.
  const partyToSalesman = useMemo(() => {
    const m: Record<string, string> = {};
    orders.forEach((o: any) => {
      const pid = o.partyacc?.id; const sid = o.salesmenid?.id;
      if (pid && sid && !m[pid]) m[pid] = sid;
    });
    return m;
  }, [orders]);

  // A receipt is credited to the salesman who booked the order in the field
  // (orderedby_id), then whoever created it (a salesman's own manual collection),
  // and finally the salesman who owns the receipt's party (covers auto-created
  // receipts that saved no collector id). Keeps admin-formalised cash invoices
  // counting for the salesman who actually collected.
  const collectorOf = (p: any) => p.orderedby_id || p.createdby_id || partyToSalesman[p.partyid?.id];
  const fPayments = useMemo(
    () => payments.filter((p: any) => p.type === "receipt" && inRange(normalizeToYMD(p.paymentdate)) && matchSalesman(collectorOf(p))),
    [payments, appliedFilters]
  );

  // ── Summary: one row per salesman ───────────────────────────────────
  const summaryData = useMemo(() => {
    const list = appliedFilters.salesmanid ? salesmen.filter((s: any) => s.id === appliedFilters.salesmanid) : salesmen;
    return list.map((s: any, idx: number) => {
      const so = fOrders.filter((o: any) => o.salesmenid?.id === s.id);
      const totalOrders = so.length;
      const viaApp = so.filter((o: any) => o.ordersource === "app").length;
      const onRoute = so.filter((o: any) => !!o.routeid).length;
      const offRoute = totalOrders - onRoute;
      const totalSales = so.reduce((sum: number, o: any) => sum + Number(o.totalamount || 0), 0);
      const collections = fPayments.filter((p: any) => collectorOf(p) === s.id).reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
      const sv = fVisits.filter((v: any) => v.salesmanid?.id === s.id);
      const visited = sv.filter((v: any) => v.visited).length;
      const notVisited = sv.filter((v: any) => !v.visited).length;
      const totalCalls = visited + notVisited;
      const visitPct = totalCalls > 0 ? ((visited / totalCalls) * 100).toFixed(0) + "%" : "-";
      return {
        seqNo: idx + 1,
        staffName: s.name,
        totalOrders,
        viaApp,
        onRoute,
        offRoute,
        totalSales: totalSales.toFixed(2),
        collections: collections.toFixed(2),
        visited,
        notVisited,
        visitPct,
      };
    });
  }, [fOrders, fVisits, fPayments, salesmen, appliedFilters]);

  // ── Detail: one row PER ORDER, so the admin can see exactly what each order
  // contained (bill/invoice no, party, payment type, items & qty). A pending
  // order shows its SO number; once converted it shows the linked INV number.
  const detailData = useMemo(() => {
    const routeNameById: Record<string, string> = {};
    routes.forEach((r: any) => { routeNameById[r.id] = r.routename; });

    const orderNo = (o: any) =>
      o.isConverted && o.invoicenumber
        ? `INV-${String(o.invoicenumber).padStart(6, "0")}`
        : `SO-${String(o.billnumber ?? "").padStart(6, "0")}`;

    return fOrders
      .slice()
      .sort((a: any, b: any) => ((normalizeToYMD(a.billdate) || "") < (normalizeToYMD(b.billdate) || "") ? 1 : -1))
      .map((o: any, idx: number) => {
        const ymd = normalizeToYMD(o.billdate) || "-";
        const items = o.productservice || [];
        return {
          seqNo: idx + 1,
          staffName: o.salesmenid?.name || "-",
          billNo: orderNo(o),
          party: o.partyacc?.accountname || "-",
          paymentType: String(o.paymenttype || "-").replace(/^\w/, (c: string) => c.toUpperCase()),
          routeName: o.routeid ? (routeNameById[o.routeid] || "Route") : "Without Route",
          day: fullDay("", ymd),
          date: formatDateDMY(o.billdate),
          totalItems: items.length,
          totalQty: items.reduce((s: number, p: any) => s + Number(p.qty || 0), 0),
          sales: Number(o.totalamount || 0).toFixed(2),
        };
      });
  }, [fOrders, routes]);

  const summaryColumns: ReportColumn[] = [
    { label: "Seq No", key: "seqNo" },
    { label: "Salesman", key: "staffName" },
    { label: "Total Orders", key: "totalOrders", numeric: true },
    { label: "Via App", key: "viaApp", numeric: true },
    { label: "On Route", key: "onRoute", numeric: true },
    { label: "Without Route", key: "offRoute", numeric: true },
    { label: "Total Sales (₹)", key: "totalSales", numeric: true },
    { label: "Collections (₹)", key: "collections", numeric: true },
    { label: "Visited (+)", key: "visited", numeric: true },
    { label: "Not Visited (−)", key: "notVisited", numeric: true },
    { label: "Visit %", key: "visitPct" },
  ];

  const detailColumns: ReportColumn[] = [
    { label: "Seq No", key: "seqNo" },
    { label: "Salesman", key: "staffName" },
    { label: "Bill No", key: "billNo" },
    { label: "Party A/c", key: "party" },
    { label: "Payment Type", key: "paymentType" },
    { label: "Route", key: "routeName" },
    { label: "Day", key: "day" },
    { label: "Date", key: "date" },
    { label: "Total Items", key: "totalItems", numeric: true },
    { label: "Total Qty", key: "totalQty", numeric: true },
    { label: "Sales (₹)", key: "sales", numeric: true },
  ];

  // ── Live tracking: latest known location per salesman ────────────────
  const trackingData = useMemo(() => {
    return locations
      .filter((p: any) => matchSalesman(p.staffid?.id))
      .map((p: any, idx: number) => ({
        seqNo: idx + 1,
        staffName: p.staffid?.name || "-",
        lastSeen: p.pingedAt ? formatDateTimeDMY(p.pingedAt) : "-",
        latitude: p.latitude ?? "-",
        longitude: p.longitude ?? "-",
        accuracy: p.accuracy ?? "-",
      }));
  }, [locations, appliedFilters]);

  const trackingColumns: ReportColumn[] = [
    { label: "Seq No", key: "seqNo" },
    { label: "Salesman", key: "staffName" },
    { label: "Last Seen", key: "lastSeen" },
    { label: "Latitude", key: "latitude" },
    { label: "Longitude", key: "longitude" },
    { label: "Accuracy (m)", key: "accuracy" },
  ];

  const filterFields: ReportFilterField[] = [
    { name: "fromDate", label: "From Date", type: "date" },
    { name: "toDate", label: "To Date", type: "date" },
    { name: "salesmanid", label: "Salesman", type: "select", searchable: true, options: salesmen.map((s: any) => ({ label: s.name, value: s.id })) },
    { name: "routeid", label: "Route", type: "select", searchable: true, options: routes.map((r: any) => ({ label: r.routename, value: r.id })) },
  ];

  // ── Per-tab config ──
  const isSummary = activeTab === "Summary";
  const tableTitle = isSummary
    ? "Salesman Field Report — Summary"
    : "Day-wise Detail";
  const tableColumns = isSummary ? summaryColumns : detailColumns;
  const tableData = isSummary ? summaryData : detailData;
  const exportFileName = isSummary ? "SalesmanFieldReport" : "SalesmanRouteDayDetail";

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6 font-sans">
        <div className="flex flex-wrap gap-2 mb-4">
          {reportTabsObj.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  isActive
                    ? "!bg-slate-900 !text-white shadow-sm border border-slate-900"
                    : "bg-white text-gray-700 hover:text-black hover:bg-gray-100 border border-gray-200"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {activeTab === "Live Tracking" ? (
          <>
            <div className="bg-white border rounded-lg p-4 text-sm text-gray-600 mb-4">
              <div className="font-semibold text-gray-700 mb-1">Live Location & Route Tracking</div>
              {appliedFilters.salesmanid
                ? "Showing the selected salesman's movement trail (green = punch-in / start, red = latest). Adjust the date range to change the window."
                : "Latest known location per salesman shown as pins. Pick a salesman to see their full route (punch-in → punch-out)."}
            </div>

            {/* Live map */}
            <div className="mb-4">
              <LiveTrackingMap latest={locations} trail={trail} height={440} />
            </div>

            <ReportTable
              title="Live Location (Latest per Salesman)"
              columns={trackingColumns}
              data={trackingData}
              filterFields={filterFields}
              filters={filters}
              setFilters={setFilters}
              appliedFilters={appliedFilters}
              setAppliedFilters={setAppliedFilters}
              showCsv
              exportFileName="SalesmanLiveLocation"
            />
          </>
        ) : (
          <ReportTable
            title={tableTitle}
            columns={tableColumns}
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
        )}
      </div>
    </HomeLayout>
  );
};

export default SalesmanFieldReport;
