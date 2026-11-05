import React, { useEffect, useMemo, useState } from "react";
import HomeLayout from "../../../layouts/home";
import ReportTable, { type ReportFilterField, type ReportColumn } from "../../../components/reporttable";
import { useStaffQuery } from "../../../graphql/hooks/staffaccounts";
import { useQuery } from "@apollo/client";
import { useAppSelector } from "../../../redux/hooks";
import { DELIVERYBOY_REPORT_SALES_ORDERS, DELIVERYBOY_REPORT_PAYMENTS } from "../../../graphql/queries/reports/deliveryboy";
import { GET_LOCATION_PINGS, GET_LATEST_LOCATIONS, GET_TRAVEL_SUMMARY } from "../../../graphql/queries/locationping";
import LiveTrackingMap from "../../../components/livetrackingmap";
import { cumulativeKm } from "../../../utils/travel";
import { normalizeToYMD, formatDateDMY, formatDateTimeDMY, todayYMD, shiftDaysYMD } from "../../../utils/helper";
import { FaChartBar, FaTruck, FaMapMarkedAlt } from "react-icons/fa";

const reportTabsObj = [
  { id: "Summary", label: "Summary", icon: <FaChartBar className="text-[12px] text-amber-500" /> },
  { id: "Day-wise", label: "Day-wise", icon: <FaTruck className="text-[12px] text-blue-500" /> },
  { id: "Live Tracking", label: "Live Tracking", icon: <FaMapMarkedAlt className="text-[12px] text-emerald-500" /> },
];

// Reverse-geocoded place names, cached per rounded lat/long across the whole
// session so re-opening the tab or switching delivery boy doesn't re-fetch a
// spot that's already been resolved.
const geocodeCache: Record<string, string> = {};

/** "YYYY-MM-DD" shifted by n days (UTC, no timezone drift). */
const shiftYMD = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  if (isNaN(d.getTime())) return undefined;
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Delivery Boy Report — field overview per delivery boy:
 *  • Orders assigned / delivered / pending
 *  • Delivered value + payment collections done on delivery
 *  • Day-wise breakdown
 *  • Live-location / route-trace section (placeholder until app sends GPS)
 */
const DeliveryBoyReport: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>(reportTabsObj[0].id);
  // Seeded with the default range on the first render so the date-scoped
  // queries never fire once unfiltered before the effect below runs.
  const [filters, setFilters] = useState<{ [key: string]: any }>(() => ({ fromDate: shiftDaysYMD(-30), toDate: todayYMD() }));
  const [appliedFilters, setAppliedFilters] = useState<{ [key: string]: any }>(() => ({ fromDate: shiftDaysYMD(-30), toDate: todayYMD() }));

  // Live Tracking has its own filter set (single Date instead of a From/To
  // range) — kept separate from the Summary / Day-wise filters above.
  const [trackingFilters, setTrackingFilters] = useState<{ [key: string]: any }>({});
  const [trackingAppliedFilters, setTrackingAppliedFilters] = useState<{ [key: string]: any }>({});

  const { data: staffData } = useStaffQuery();

  // Same adminid/branchid scoping as useSalesOrdersQuery / usePaymentsQuery /
  // the locationping hooks (those are admin-scoped only).
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);
  const adminid = type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;
  const branchid = type === 'admin' ? selectedBranchId : type === 'branch' ? branch?.id : type === 'staff' ? staff?.branchid?.id : undefined;

  const isTracking = activeTab === "Live Tracking";
  const isSummaryTab = activeTab === "Summary";

  // includeConverted: once a delivery order is invoiced (isConverted: true),
  // the default query (isConverted: false) hides it — but it's still a real
  // delivery that must show up here (deliveryboyid/deliveryStatus carry over
  // to the invoice via syncInvoiceFromOrder on the server).
  // Lite + server-side date range (string compare on "YYYY-MM-DD", To day
  // inclusive); the client-side range check below stays as a safety net.
  const { data: ordersData } = useQuery(DELIVERYBOY_REPORT_SALES_ORDERS, {
    variables: {
      filter: {
        adminid,
        branchid,
        includeConverted: true,
        billdateFrom: appliedFilters.fromDate || undefined,
        billdateTo: appliedFilters.toDate || undefined,
      },
    },
    skip: isTracking,
  });
  // Collections only feed the Summary tab. paymentdate is a Date on the
  // server, so the range is padded a day each side (timezone) and the exact
  // local-day check below decides.
  const payFrom = appliedFilters.fromDate ? shiftYMD(appliedFilters.fromDate, -1) : undefined;
  const payToDay = appliedFilters.toDate ? shiftYMD(appliedFilters.toDate, 1) : undefined;
  const { data: paymentsData } = useQuery(DELIVERYBOY_REPORT_PAYMENTS, {
    variables: {
      filter: {
        adminid,
        branchid,
        dateFrom: payFrom,
        dateTo: payToDay ? `${payToDay}T23:59:59.999Z` : undefined,
      },
    },
    fetchPolicy: "cache-and-network",
    skip: !isSummaryTab,
  });

  // Live-tracking data honours its own single-date filter, and picking a
  // delivery boy fetches their ordered trail (punch-in → punch-out) for that day.
  const locFilter = useMemo(() => ({
    role: "deliveryboy",
    staffid: trackingAppliedFilters.deliveryboyid || undefined,
    dateFrom: trackingAppliedFilters.date || undefined,
    dateTo: trackingAppliedFilters.date || undefined,
  }), [trackingAppliedFilters]);
  // Tracking queries only on the Live Tracking tab; the trail only once a
  // delivery boy is picked (it was fetched for everyone and then discarded).
  const { data: locationsData } = useQuery(GET_LATEST_LOCATIONS, {
    variables: { filter: { adminid, ...locFilter } },
    skip: !adminid || !isTracking,
    fetchPolicy: "cache-and-network",
  });
  const { data: trailData } = useQuery(GET_LOCATION_PINGS, {
    variables: { filter: { adminid, ...locFilter } },
    skip: !adminid || !isTracking || !trackingAppliedFilters.deliveryboyid,
    fetchPolicy: "cache-and-network",
  });
  // KM per delivery boy per day: Live Tracking day + Summary range.
  const { data: dayTravelData } = useQuery(GET_TRAVEL_SUMMARY, {
    variables: { filter: { adminid, ...locFilter } },
    skip: !adminid || !isTracking,
    fetchPolicy: "cache-and-network",
  });
  const { data: rangeTravelData } = useQuery(GET_TRAVEL_SUMMARY, {
    variables: {
      filter: {
        adminid,
        role: "deliveryboy",
        dateFrom: appliedFilters.fromDate || undefined,
        dateTo: appliedFilters.toDate || undefined,
      },
    },
    skip: !adminid || !isSummaryTab,
    fetchPolicy: "cache-and-network",
  });
  const dayTravel: any[] = (dayTravelData as any)?.getTravelSummary || [];
  const rangeTravel: any[] = (rangeTravelData as any)?.getTravelSummary || [];

  const deliveryBoys = useMemo(
    () => [...(staffData?.getStaffAccounts || [])].reverse().filter((s: any) => s.role?.toLowerCase() === "deliveryboy"),
    [staffData]
  );
  const orders: any[] = useMemo(() => ordersData?.getSalesOrders || [], [ordersData]);
  const payments: any[] = useMemo(() => paymentsData?.getPayments || [], [paymentsData]);
  const locations = locationsData?.getLatestLocations || [];
  // Full ordered trail (punch-in → punch-out) only when a single delivery boy is picked.
  const trail = trackingAppliedFilters.deliveryboyid ? ((trailData as any)?.getLocationPings || []) : [];

  useEffect(() => {
    const to = todayYMD();
    const from = shiftDaysYMD(-30);
    setFilters({ fromDate: from, toDate: to });
    setAppliedFilters({ fromDate: from, toDate: to });
  }, []);

  // Live Tracking defaults to today's date.
  useEffect(() => {
    const today = todayYMD();
    setTrackingFilters({ date: today, deliveryboyid: "" });
    setTrackingAppliedFilters({ date: today, deliveryboyid: "" });
  }, []);

  const inRange = (d: string | null) => {
    if (!d) return false;
    const { fromDate, toDate } = appliedFilters;
    if (fromDate && d < fromDate) return false;
    if (toDate && d > toDate) return false;
    return true;
  };
  const matchDb = (id?: string) => !appliedFilters.deliveryboyid || id === appliedFilters.deliveryboyid;

  const fOrders = useMemo(
    () => orders.filter((o: any) => !!o.deliveryboyid && inRange(normalizeToYMD(o.billdate)) && matchDb(o.deliveryboyid)),
    [orders, appliedFilters]
  );
  const fPayments = useMemo(
    () => payments.filter((p: any) => p.type === "receipt" && inRange(normalizeToYMD(p.paymentdate)) && matchDb(p.createdby_id)),
    [payments, appliedFilters]
  );

  // ── Summary: one row per delivery boy ───────────────────────────────
  const summaryData = useMemo(() => {
    const list = appliedFilters.deliveryboyid ? deliveryBoys.filter((s: any) => s.id === appliedFilters.deliveryboyid) : deliveryBoys;
    return list.map((s: any, idx: number) => {
      const dOrders = fOrders.filter((o: any) => o.deliveryboyid === s.id);
      const assigned = dOrders.length;
      const delivered = dOrders.filter((o: any) => o.deliveryStatus === "delivered").length;
      const dispatched = dOrders.filter((o: any) => o.deliveryStatus === "dispatched").length;
      const pending = assigned - delivered;
      const deliveredValue = dOrders.filter((o: any) => o.deliveryStatus === "delivered").reduce((sum: number, o: any) => sum + Number(o.totalamount || 0), 0);
      const collections = fPayments.filter((p: any) => p.createdby_id === s.id).reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
      const deliveryPct = assigned > 0 ? ((delivered / assigned) * 100).toFixed(0) + "%" : "-";
      const km = rangeTravel.filter((t: any) => t.staffid === s.id).reduce((sum: number, t: any) => sum + Number(t.km || 0), 0);
      return {
        km: km.toFixed(2),
        seqNo: idx + 1,
        staffName: s.name,
        assigned,
        dispatched,
        delivered,
        pending,
        deliveredValue: deliveredValue.toFixed(2),
        collections: collections.toFixed(2),
        deliveryPct,
      };
    });
  }, [fOrders, fPayments, deliveryBoys, appliedFilters, rangeTravel]);

  // ── Detail: one row per delivery boy + day ──────────────────────────
  const detailData = useMemo(() => {
    const groups: Record<string, any> = {};
    fOrders.forEach((o: any) => {
      const db = deliveryBoys.find((s: any) => s.id === o.deliveryboyid);
      const ymd = normalizeToYMD(o.billdate) || "-";
      const key = `${o.deliveryboyid}|${ymd}`;
      if (!groups[key]) groups[key] = { staffName: db?.name || "-", date: ymd, assigned: 0, delivered: 0, pending: 0, value: 0 };
      groups[key].assigned += 1;
      if (o.deliveryStatus === "delivered") { groups[key].delivered += 1; groups[key].value += Number(o.totalamount || 0); }
      else groups[key].pending += 1;
    });
    return Object.values(groups)
      .sort((a: any, b: any) => (a.date < b.date ? 1 : -1))
      .map((g: any, idx: number) => ({
        seqNo: idx + 1,
        staffName: g.staffName,
        date: formatDateDMY(g.date),
        assigned: g.assigned,
        delivered: g.delivered,
        pending: g.pending,
        deliveredValue: Number(g.value).toFixed(2),
      }));
  }, [fOrders, deliveryBoys]);

  const summaryColumns: ReportColumn[] = [
    { label: "Seq No", key: "seqNo" },
    { label: "Delivery Boy", key: "staffName" },
    { label: "Assigned", key: "assigned", numeric: true },
    { label: "Dispatched", key: "dispatched", numeric: true },
    { label: "Delivered", key: "delivered", numeric: true },
    { label: "Pending", key: "pending", numeric: true },
    { label: "Delivered Value (₹)", key: "deliveredValue", numeric: true },
    { label: "Collections (₹)", key: "collections", numeric: true },
    { label: "Delivery %", key: "deliveryPct" },
    { label: "KM Travelled", key: "km", numeric: true },
  ];

  const detailColumns: ReportColumn[] = [
    { label: "Seq No", key: "seqNo" },
    { label: "Delivery Boy", key: "staffName" },
    { label: "Date", key: "date" },
    { label: "Assigned", key: "assigned", numeric: true },
    { label: "Delivered", key: "delivered", numeric: true },
    { label: "Pending", key: "pending", numeric: true },
    { label: "Delivered Value (₹)", key: "deliveredValue", numeric: true },
  ];

  // ── Live tracking: full day's trail when a delivery boy is picked (punch-in
  // → punch-out, one row per GPS ping, oldest first), otherwise the latest
  // known location per delivery boy. Location shown as a place name, not raw
  // lat/long — resolved via free-text reverse geocoding (OpenStreetMap
  // Nominatim), cached per rounded coordinate so the same spot isn't looked
  // up twice.
  const showingTrail = !!trackingAppliedFilters.deliveryboyid;
  const trackingPings = showingTrail ? trail : locations;

  const [locationNames, setLocationNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const keys: string[] = Array.from(
      new Set<string>(
        trackingPings
          .filter((p: any) => p.latitude != null && p.longitude != null)
          .map((p: any) => `${Number(p.latitude).toFixed(4)},${Number(p.longitude).toFixed(4)}`)
      )
    ).filter((k: string) => !(k in geocodeCache));

    if (keys.length === 0) return;
    let cancelled = false;

    const resolveNext = (i: number) => {
      if (cancelled || i >= keys.length) return;
      const key = keys[i];
      const [lat, lon] = key.split(",");
      fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=16&addressdetails=0`,
        { headers: { Accept: "application/json" } }
      )
        .then((res) => res.json())
        .then((json) => {
          geocodeCache[key] = json?.display_name || `${lat}, ${lon}`;
        })
        .catch(() => {
          geocodeCache[key] = `${lat}, ${lon}`;
        })
        .finally(() => {
          if (!cancelled) {
            setLocationNames((prev) => ({ ...prev, [key]: geocodeCache[key] }));
            // Throttle to ~1 request/sec per Nominatim's usage policy.
            setTimeout(() => resolveNext(i + 1), 1100);
          }
        });
    };
    resolveNext(0);

    return () => { cancelled = true; };
  }, [trackingPings]);

  const trackingData = useMemo(() => {
    const running = showingTrail ? cumulativeKm(trackingPings) : [];
    const todayKm = (sid?: string) => dayTravel.find((t: any) => t.staffid === sid)?.km ?? 0;
    return trackingPings.map((p: any, idx: number) => {
      const key = p.latitude != null && p.longitude != null
        ? `${Number(p.latitude).toFixed(4)},${Number(p.longitude).toFixed(4)}`
        : "";
      return {
        seqNo: idx + 1,
        staffName: p.staffid?.name || "-",
        lastSeen: p.pingedAt ? formatDateTimeDMY(p.pingedAt) : "-",
        location: key ? (geocodeCache[key] || locationNames[key] || "Resolving…") : "-",
        accuracy: p.accuracy != null ? Math.round(p.accuracy) : "-",
        battery: p.battery != null ? `${Math.round(p.battery)}%` : "-",
        km: (showingTrail ? running[idx] : todayKm(p.staffid?.id)).toFixed(2),
      };
    });
  }, [trackingPings, locationNames, dayTravel, showingTrail]);

  const trailSummary = showingTrail ? dayTravel.find((t: any) => t.staffid === trackingAppliedFilters.deliveryboyid) : null;

  const trackingColumns: ReportColumn[] = [
    { label: "Seq No", key: "seqNo" },
    { label: "Delivery Boy", key: "staffName" },
    { label: showingTrail ? "Time" : "Last Seen", key: "lastSeen" },
    { label: "Location", key: "location" },
    { label: "Accuracy (m)", key: "accuracy" },
    { label: "Battery", key: "battery" },
    { label: showingTrail ? "KM (so far)" : "Today's KM", key: "km" },
  ];

  const filterFields: ReportFilterField[] = [
    { name: "fromDate", label: "From Date", type: "date" },
    { name: "toDate", label: "To Date", type: "date" },
    { name: "deliveryboyid", label: "Delivery Boy", type: "select", searchable: true, options: deliveryBoys.map((s: any) => ({ label: s.name, value: s.id })) },
  ];

  const trackingFilterFields: ReportFilterField[] = [
    { name: "date", label: "Date", type: "date" },
    { name: "deliveryboyid", label: "Delivery Boy", type: "select", searchable: true, options: deliveryBoys.map((s: any) => ({ label: s.name, value: s.id })) },
  ];

  // ── Per-tab config ──
  const isSummary = activeTab === "Summary";
  const tableTitle = isSummary ? "Delivery Boy Report — Summary" : "Day-wise Delivery Detail";
  const tableColumns = isSummary ? summaryColumns : detailColumns;
  const tableData = isSummary ? summaryData : detailData;
  const exportFileName = isSummary ? "DeliveryBoyReport" : "DeliveryBoyDayDetail";

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
                className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium cursor-pointer ${
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

        {activeTab === "Live Tracking" ? (
          <>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-[12px] text-gray-600 mb-3">
              <div className="text-[13px] font-semibold text-slate-800 mb-1">Live Location & Route Tracking</div>
              {trackingAppliedFilters.deliveryboyid
                ? "Showing the selected delivery boy's full trail for the chosen date (green = punch-in / start, red = latest). Pick a different date to change the day."
                : "Latest known location per delivery boy shown as pins. Pick a delivery boy to see their full route for the day (punch-in → punch-out)."}
            </div>

            {showingTrail && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                {[
                  { label: "Distance covered", value: `${(trailSummary?.km ?? 0).toFixed(2)} km` },
                  { label: "First location", value: trailSummary?.firstAt ? formatDateTimeDMY(trailSummary.firstAt) : "-" },
                  { label: "Last location", value: trailSummary?.lastAt ? formatDateTimeDMY(trailSummary.lastAt) : "-" },
                  { label: "Points recorded", value: String(trailSummary?.points ?? 0) },
                ].map((c) => (
                  <div key={c.label} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5">
                    <div className="text-[11px] text-slate-500">{c.label}</div>
                    <div className="text-[15px] font-semibold leading-tight text-gray-800">{c.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Live map */}
            <div className="mb-3">
              <LiveTrackingMap latest={locations} trail={trail} height={440} />
            </div>

            <ReportTable moduleId="reports.delivery"
              title={showingTrail ? "Live Location (Full Day Trail)" : "Live Location (Latest per Delivery Boy)"}
              columns={trackingColumns}
              data={trackingData}
              filterFields={trackingFilterFields}
              filters={trackingFilters}
              setFilters={setTrackingFilters}
              appliedFilters={trackingAppliedFilters}
              setAppliedFilters={setTrackingAppliedFilters}
              showCsv
              exportFileName="DeliveryBoyLiveLocation"
            />
          </>
        ) : (
          <ReportTable moduleId="reports.delivery"
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

export default DeliveryBoyReport;
