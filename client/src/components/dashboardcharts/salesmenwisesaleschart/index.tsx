import React, { useMemo, useState } from "react";
import { Bar } from "react-chartjs-2";
import type { SalesInvoice, Staff } from "..";

interface SalesOrder {
  id?: string;
  totalamount?: number;
  salesmenid?: { id: string } | string;
  salesmanid?: string;
  staffid?: string;
  status?: boolean;
}

interface Props {
  salesInvoices: SalesInvoice[];
  salesOrders?: SalesOrder[];
  staff: Staff[];
}

const SalesmenWiseSalesChart: React.FC<Props> = ({ salesInvoices, salesOrders = [], staff }) => {
  const activeStaff = useMemo(
    () => staff.filter((s) => s.status !== false),
    [staff]
  );

  const [selectedStaffId, setSelectedStaffId] = useState<string>("All");

  const staffMap = useMemo(() => {
    const map = new Map<string, string>();
    activeStaff.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [activeStaff]);

  const { salesByStaff, ordersByStaff } = useMemo(() => {
    const sMap: Record<string, number> = {};
    const oMap: Record<string, number> = {};

    // Aggregate Invoiced Sales
    salesInvoices.forEach((inv: any) => {
      const staffId = typeof inv.salesmenid === "object" ? inv.salesmenid?.id : (inv.salesmenid ?? inv.salesmanid ?? "others");
      const amount = inv.totalamount ?? 0;
      sMap[staffId] = (sMap[staffId] || 0) + amount;
    });

    // Aggregate Booked Sales Orders
    salesOrders.forEach((ord: any) => {
      if (ord.status === false) return;
      const staffId = typeof ord.salesmenid === "object" ? ord.salesmenid?.id : (ord.salesmenid ?? ord.salesmanid ?? ord.staffid ?? "others");
      const amount = ord.totalamount ?? 0;
      oMap[staffId] = (oMap[staffId] || 0) + amount;
    });

    return { salesByStaff: sMap, ordersByStaff: oMap };
  }, [salesInvoices, salesOrders]);

  const filteredChartData = useMemo(() => {
    if (selectedStaffId === "All") {
      const labels: string[] = [];
      const salesData: number[] = [];
      const ordersData: number[] = [];

      // Combine keys from both maps
      const allStaffIds = Array.from(new Set([...Object.keys(salesByStaff), ...Object.keys(ordersByStaff)]));

      allStaffIds.forEach((id) => {
        const label = id === "others" ? "Others" : staffMap.get(id) || "Unknown";
        labels.push(label);
        salesData.push(salesByStaff[id] || 0);
        ordersData.push(ordersByStaff[id] || 0);
      });

      return {
        labels,
        datasets: [
          {
            label: "Invoiced Sales (₹)",
            data: salesData,
            backgroundColor: "#3b82f6",
          },
          {
            label: "Booked Orders (₹)",
            data: ordersData,
            backgroundColor: "#10b981",
          },
        ],
      };
    } else {
      const label = staffMap.get(selectedStaffId) || "Unknown";
      const sVal = salesByStaff[selectedStaffId] || 0;
      const oVal = ordersByStaff[selectedStaffId] || 0;

      return {
        labels: [label],
        datasets: [
          {
            label: `Invoiced Sales (₹)`,
            data: [sVal],
            backgroundColor: "#3b82f6",
          },
          {
            label: `Booked Orders (₹)`,
            data: [oVal],
            backgroundColor: "#10b981",
          },
        ],
      };
    }
  }, [selectedStaffId, salesByStaff, ordersByStaff, staffMap]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" as const, labels: { font: { size: 10 } } },
    },
    scales: {
      y: { beginAtZero: true, ticks: { font: { size: 10 } } },
      x: { ticks: { font: { size: 10 } } },
    },
  };

  return (
    <div className="bg-white p-3.5 rounded border border-gray-200 shadow-2xs font-sans flex flex-col justify-between h-80 sm:h-96">
      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="text-xs font-bold text-[#2c3e50] capitalize tracking-wider truncate">Sales Representative</h3>
          <select
            className="border border-gray-300 rounded px-2 py-0.5 text-[10px] text-gray-700 bg-white shadow-2xs focus:outline-none"
            value={selectedStaffId}
            onChange={(e) => setSelectedStaffId(e.target.value)}
          >
            <option value="All">All Representatives</option>
            {activeStaff.length > 0 ? (
              activeStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))
            ) : (
              <option disabled>No representatives available</option>
            )}
          </select>
        </div>
        <p className="text-[10px] text-gray-500 mb-2">Individual invoiced vs booked order attribution</p>
      </div>
      <div className="flex-1 min-h-[200px]">
        <Bar data={filteredChartData} options={options} />
      </div>
    </div>
  );
};

export default SalesmenWiseSalesChart;
