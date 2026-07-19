import React, { useMemo } from "react";
import { Menu } from "@headlessui/react";
import { useNavigate } from "react-router";
import { useQuery, useMutation } from "@apollo/client";
import {
  FaBell,
  FaExclamationTriangle,
  FaClipboardList,
  FaCalendarCheck,
  FaBoxOpen,
  FaFileInvoiceDollar,
  FaMoneyBillWave,
  FaReceipt,
  FaUserPlus,
  FaRoute,
} from "react-icons/fa";
import { useAppSelector } from "../../redux/hooks";
import { useProductServicesQuery } from "../../graphql/hooks/products";
import { useSalesOrdersQuery } from "../../graphql/hooks/salesorder";
import { usePurchaseOrdersQuery } from "../../graphql/hooks/purchaseorder";
import { GET_LEAVE_REQUESTS } from "../../graphql/queries/attendance";
import {
  GET_NOTIFICATIONS,
  MARK_NOTIFICATION_READ,
  MARK_ALL_NOTIFICATIONS_READ,
} from "../../graphql/queries/notifications";
import { formatDateTimeDMY } from "../../utils/helper";

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

  // ── Server event notifications (orders punched, conversions, payments) ──
  const eventFilter = { adminid: adminId, targettype: "admin", unreadOnly: true, limit: 30 };
  const eventsQ = useQuery(GET_NOTIFICATIONS, {
    variables: { filter: eventFilter },
    skip: !adminId,
    pollInterval: 30000, // refresh every 30s
    fetchPolicy: "network-only",
  });
  const [markRead] = useMutation(MARK_NOTIFICATION_READ);
  const [markAllRead] = useMutation(MARK_ALL_NOTIFICATIONS_READ);
  const eventNotifications = eventsQ.data?.getNotifications ?? [];

  const eventIconOf = (ntype: string) => {
    switch (ntype) {
      case "order": return { icon: <FaClipboardList className="text-emerald-600" />, accent: "bg-emerald-50" };
      case "invoice": return { icon: <FaFileInvoiceDollar className="text-blue-600" />, accent: "bg-blue-50" };
      case "payment": return { icon: <FaMoneyBillWave className="text-green-600" />, accent: "bg-green-50" };
      case "attendance": return { icon: <FaCalendarCheck className="text-teal-600" />, accent: "bg-teal-50" };
      case "party": return { icon: <FaUserPlus className="text-purple-600" />, accent: "bg-purple-50" };
      case "route": return { icon: <FaRoute className="text-orange-600" />, accent: "bg-orange-50" };
      default: return { icon: <FaReceipt className="text-gray-500" />, accent: "bg-gray-50" };
    }
  };

  const handleEventClick = async (n: any) => {
    try { await markRead({ variables: { id: n.id } }); } catch { /* best-effort */ }
    eventsQ.refetch();
    if (n.webpath) navigate(n.webpath);
  };

  const handleMarkAll = async () => {
    try { await markAllRead({ variables: { filter: eventFilter } }); } catch { /* best-effort */ }
    eventsQ.refetch();
  };

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

  const count = notifications.length + eventNotifications.length;

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
            Notifications
          </span>
          <span className="flex items-center gap-2">
            {eventNotifications.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); handleMarkAll(); }}
                className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
              >
                Mark all read
              </button>
            )}
            {count > 0 && (
              <span className="text-[10px] font-bold text-white bg-rose-600 rounded-full px-2 py-0.5">
                {count}
              </span>
            )}
          </span>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {/* Business events (orders / invoices / payments) */}
          {eventNotifications.map((n: any) => {
            const { icon, accent } = eventIconOf(n.ntype);
            return (
              <Menu.Item key={n.id}>
                {({ active }) => (
                  <button
                    onClick={() => handleEventClick(n)}
                    className={`${active ? "bg-gray-50" : ""} w-full text-left px-3 py-2.5 flex items-start gap-3 border-b border-gray-50 transition-colors cursor-pointer`}
                  >
                    <span className={`mt-0.5 w-8 h-8 rounded-full ${accent} flex items-center justify-center flex-shrink-0 text-sm`}>
                      {icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-gray-800">{n.title}</span>
                      {!!n.message && <span className="block text-[11px] text-gray-500">{n.message}</span>}
                      {!!n.createdAt && (
                        <span className="block text-[10px] text-gray-400 mt-0.5">
                          {formatDateTimeDMY(n.createdAt)}
                        </span>
                      )}
                    </span>
                    <span className="mt-1 w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  </button>
                )}
              </Menu.Item>
            );
          })}

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
