import React, { useEffect, useMemo, useState } from "react";
import HomeLayout from "../../../layouts/home";
import ReportTable, { type ReportFilterField, type ReportColumn } from "../../../components/reporttable";
import { useStaffQuery } from "../../../graphql/hooks/staffaccounts";
import { useSalesOrdersQuery } from "../../../graphql/hooks/salesorder";
import { usePaymentsQuery } from "../../../graphql/hooks/payments";
import { useLatestLocationsQuery } from "../../../graphql/hooks/locationping";
import { normalizeToYMD, formatDateDMY, formatDateTimeDMY } from "../../../utils/helper";
import { FaChartBar, FaTruck, FaMapMarkedAlt } from "react-icons/fa";

const reportTabsObj = [
  { id: "Summary", label: "Summary", icon: <FaChartBar className="text-amber-500" /> },
  { id: "Day-wise", label: "Day-wise", icon: <FaTruck className="text-blue-500" /> },
  { id: "Live Tracking", label: "Live Tracking", icon: <FaMapMarkedAlt className="text-emerald-500" /> },
];

/**
 * Delivery Boy Report — field overview per delivery boy:
 *  • Orders assigned / delivered / pending
 *  • Delivered value + payment collections done on delivery
 *  • Day-wise breakdown
 *  • Live-location / route-trace section (placeholder until app sends GPS)
 */
const DeliveryBoyReport: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>(reportTabsObj[0].id);
  const [filters, setFilters] = useState<{ [key: string]: any }>({});
  const [appliedFilters, setAppliedFilters] = useState<{ [key: string]: any }>({});

  const { data: staffData } = useStaffQuery();
  const { data: ordersData } = useSalesOrdersQuery();
  const { data: paymentsData } = usePaymentsQuery();
  const { data: locationsData } = useLatestLocationsQuery({ role: "deliveryboy" });

  const staffList = [...(staffData?.getStaffAccounts || [])].reverse();
  const deliveryBoys = staffList.filter((s: any) => s.role?.toLowerCase() === "deliveryboy");
  const orders = ordersData?.getSalesOrders || [];
  const payments = paymentsData?.getPayments || [];
  const locations = locationsData?.getLatestLocations || [];

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
      return {
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
  }, [fOrders, fPayments, deliveryBoys, appliedFilters]);

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

  // ── Live tracking: latest known location per delivery boy ────────────
  const trackingData = useMemo(() => {
    return locations
      .filter((p: any) => matchDb(p.staffid?.id))
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
    { label: "Delivery Boy", key: "staffName" },
    { label: "Last Seen", key: "lastSeen" },
    { label: "Latitude", key: "latitude" },
    { label: "Longitude", key: "longitude" },
    { label: "Accuracy (m)", key: "accuracy" },
  ];

  const filterFields: ReportFilterField[] = [
    { name: "fromDate", label: "From Date", type: "date" },
    { name: "toDate", label: "To Date", type: "date" },
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
              Latest known location per delivery boy. This stays empty until the app starts
              posting GPS pings — the backend and data feed are already in place.
            </div>
            <ReportTable
              title="Live Location (Latest per Delivery Boy)"
              columns={trackingColumns}
              data={trackingData}
              filterFields={filterFields}
              filters={filters}
              setFilters={setFilters}
              appliedFilters={appliedFilters}
              setAppliedFilters={setAppliedFilters}
              showCsv
              exportFileName="DeliveryBoyLiveLocation"
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

export default DeliveryBoyReport;
