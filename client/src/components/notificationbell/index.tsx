import React, { useMemo } from "react";
import { Menu } from "@headlessui/react";
import { useNavigate } from "react-router";
import { useQuery } from "@apollo/client";
import {
  FaBell,
  FaExclamationTriangle,
  FaClipboardList,
  FaCalendarCheck,
  FaBoxOpen,
} from "react-icons/fa";
import { useAppSelector } from "../../redux/hooks";
import { useProductServicesQuery } from "../../graphql/hooks/products";
import { useSalesOrdersQuery } from "../../graphql/hooks/salesorder";
import { usePurchaseOrdersQuery } from "../../graphql/hooks/purchaseorder";
import { GET_LEAVE_REQUESTS } from "../../graphql/queries/attendance";

type SystemNotification = {
  id: string;
  icon: React.ReactNode;
  label: string;
  sub: string;
  path: string;
  accent: string; // tailwind bg for the icon chip
};

/** Bell icon with a dropdown of system notifications (low stock, pending
    orders, pending leaves). Everything is derived from live data — no
    separate notification store needed. */
const NotificationBell: React.FC = () => {
  const navigate = useNavigate();

  const { type, admin, branch, staff } = useAppSelector((s: any) => s.auth);
  const adminId =
    type === "admin"
      ? admin?.id
      : type === "branch"
        ? branch?.admin?.id
        : type === "staff"
          ? staff?.admin?.id
          : undefined;

  const { data: productsData } = useProductServicesQuery();
  const { data: soData } = useSalesOrdersQuery();
  const { data: poData } = usePurchaseOrdersQuery();
  const leaveReqQ = useQuery(GET_LEAVE_REQUESTS, {
    variables: { filter: { adminid: adminId } },
    skip: !adminId,
  });

  const notifications: SystemNotification[] = useMemo(() => {
    const list: SystemNotification[] = [];

    // 1. Stock alerts — out of stock / below minimum / at reorder level
    const products = productsData?.getProductServices ?? [];
    let lowStock = 0;
    let outOfStock = 0;
    let reorderDue = 0;
    products.forEach((p: any) => {
      if (p.isservice) return;
      (p.productvariants ?? []).forEach((v: any) => {
        const stock = v.currentstock ?? 0;
        const reorder = v.reorderlevel ?? 0;
        if (stock <= 0) outOfStock += 1;
        else if (stock < (v.minimumstock ?? 0)) lowStock += 1;
        else if (reorder > 0 && stock <= reorder) reorderDue += 1;
      });
    });
    if (lowStock > 0)
      list.push({
        id: "lowstock",
        icon: <FaExclamationTriangle className="text-rose-600" />,
        label: `${lowStock} product${lowStock > 1 ? "s" : ""} low on stock`,
        sub: "Below minimum stock level",
        path: "/products?filter=lowstock",
        accent: "bg-rose-50",
      });
    if (outOfStock > 0)
      list.push({
        id: "outofstock",
        icon: <FaBoxOpen className="text-orange-600" />,
        label: `${outOfStock} variant${outOfStock > 1 ? "s" : ""} out of stock`,
        sub: "Stock is zero — restock needed",
        path: "/products?filter=lowstock",
        accent: "bg-orange-50",
      });
    if (reorderDue > 0)
      list.push({
        id: "reorderlevel",
        icon: <FaBoxOpen className="text-yellow-600" />,
        label: `${reorderDue} product${reorderDue > 1 ? "s" : ""} at reorder level`,
        sub: "Time to place a purchase order",
        path: "/products",
        accent: "bg-yellow-50",
      });

    // 2. Pending sales orders
    const pendingSO = (soData?.getSalesOrders ?? []).filter(
      (o: any) => String(o.status).toLowerCase() === "pending" || String(o.status).toLowerCase() === "active"
    ).length;
    if (pendingSO > 0)
      list.push({
        id: "pendingso",
        icon: <FaClipboardList className="text-amber-600" />,
        label: `${pendingSO} pending sales order${pendingSO > 1 ? "s" : ""}`,
        sub: "Awaiting invoice / delivery",
        path: "/salesorder",
        accent: "bg-amber-50",
      });

    // 3. Pending purchase orders
    const pendingPO = (poData?.getPurchaseOrders ?? []).filter(
      (o: any) => String(o.status).toLowerCase() === "pending" || String(o.status).toLowerCase() === "active"
    ).length;
    if (pendingPO > 0)
      list.push({
        id: "pendingpo",
        icon: <FaClipboardList className="text-purple-600" />,
        label: `${pendingPO} pending purchase order${pendingPO > 1 ? "s" : ""}`,
        sub: "Awaiting purchase invoice",
        path: "/purchaseorder",
        accent: "bg-purple-50",
      });

    // 4. Pending leave requests
    const pendingLeaves = (leaveReqQ.data?.getLeaveRequests ?? []).filter(
      (r: any) => String(r.status).toLowerCase() === "pending"
    ).length;
    if (pendingLeaves > 0)
      list.push({
        id: "pendingleaves",
        icon: <FaCalendarCheck className="text-blue-600" />,
        label: `${pendingLeaves} leave request${pendingLeaves > 1 ? "s" : ""} pending`,
        sub: "Awaiting approval",
        path: "/attendance",
        accent: "bg-blue-50",
      });

    return list;
  }, [productsData, soData, poData, leaveReqQ.data]);

  const count = notifications.length;

  return (
    <Menu as="div" className="relative inline-block text-left">
      <Menu.Button
        className="relative p-2 rounded-md hover:bg-slate-800 transition-colors cursor-pointer bg-slate-900 border border-slate-800 shadow-sm"
        title="Notifications"
      >
        <FaBell className="text-cyan-400 text-base" />
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center border-2 border-slate-950">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </Menu.Button>

      <Menu.Items className="absolute right-0 mt-2 w-80 origin-top-right bg-white rounded-md shadow-lg ring-1 ring-black/5 focus:outline-none z-50 overflow-hidden">
        <div className="px-3 py-2.5 bg-gray-50 border-b flex items-center justify-between">
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
            System Notifications
          </span>
          {count > 0 && (
            <span className="text-[10px] font-bold text-white bg-rose-600 rounded-full px-2 py-0.5">
              {count}
            </span>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {count === 0 ? (
            <div className="px-4 py-8 text-center text-gray-400 text-xs">
              <FaBell className="mx-auto mb-2 text-lg text-gray-300" />
              All clear — no pending alerts.
            </div>
          ) : (
            notifications.map((n) => (
              <Menu.Item key={n.id}>
                {({ active }) => (
                  <button
                    onClick={() => navigate(n.path)}
                    className={`${active ? "bg-gray-50" : ""} w-full text-left px-3 py-2.5 flex items-start gap-3 border-b border-gray-50 last:border-0 transition-colors cursor-pointer`}
                  >
                    <span className={`mt-0.5 w-8 h-8 rounded-full ${n.accent} flex items-center justify-center flex-shrink-0 text-sm`}>
                      {n.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-gray-800 truncate">{n.label}</span>
                      <span className="block text-[11px] text-gray-500">{n.sub}</span>
                    </span>
                  </button>
                )}
              </Menu.Item>
            ))
          )}
        </div>
      </Menu.Items>
    </Menu>
  );
};

export default NotificationBell;
