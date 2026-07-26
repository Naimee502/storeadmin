import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { Link } from "react-router";
import { Bell, Package, FileText, Wallet, CalendarCheck, UserPlus, MapPin, BellRing, X } from "lucide-react";
import { useAuth } from "../../contexts/auth";
import { useTenant } from "../../contexts/tenant";
import { GET_NOTIFICATIONS, MARK_NOTIFICATION_READ, MARK_ALL_NOTIFICATIONS_READ } from "../../graphql/queries/notifications";

const TYPE_ICON: Record<string, { icon: typeof Package; className: string }> = {
  order: { icon: Package, className: "bg-amber-500" },
  invoice: { icon: FileText, className: "bg-blue-500" },
  payment: { icon: Wallet, className: "bg-emerald-500" },
  attendance: { icon: CalendarCheck, className: "bg-teal-500" },
  party: { icon: UserPlus, className: "bg-violet-500" },
  route: { icon: MapPin, className: "bg-orange-500" },
  system: { icon: BellRing, className: "bg-slate-500" },
};

function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Real business-event notifications (order placed/updated/confirmed/
// dispatched/delivered, payments, etc.) — the exact same server-side
// pushNotification calls the mobile app reads, since the website hits the
// same addSalesOrder/editSalesOrder/addPayment mutations. This component is
// purely the read/display side, polling every 30s like the app's bell.
//
// Shows the full history (not just unread) — same as the app's dedicated
// Notifications screen — so anything already read on the app still shows up
// here instead of the list looking empty. The badge count is unread-only.
export default function NotificationBell() {
  const { isLoggedIn, account } = useAuth();
  const { adminid } = useTenant();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const filter = useMemo(
    () => ({ adminid, targettype: "party", targetid: account?.id, limit: 50 }),
    [adminid, account?.id]
  );

  const { data, refetch } = useQuery(GET_NOTIFICATIONS, {
    variables: { filter },
    skip: !isLoggedIn || !adminid || !account?.id,
    pollInterval: 30000,
    fetchPolicy: "cache-and-network",
  });
  const [markRead] = useMutation(MARK_NOTIFICATION_READ);
  const [markAllRead] = useMutation(MARK_ALL_NOTIFICATIONS_READ);

  const notifications: any[] = data?.getNotifications ?? [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!isLoggedIn) return null;

  const handleTap = async (n: any) => {
    if (!n.read) {
      try {
        await markRead({ variables: { id: n.id } });
      } catch {
        // best-effort
      }
      refetch();
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllRead({ variables: { filter } });
    } catch {
      // best-effort
    }
    refetch();
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md p-2 hover:bg-slate-100"
        aria-label="Notifications"
      >
        <Bell className="h-5.5 w-5.5 text-ink-900" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4.5 w-4.5 place-items-center rounded-full bg-rose-600 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-80 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-bold text-ink-900">Notifications</h3>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button onClick={handleMarkAll} className="text-xs font-semibold text-brand-700 hover:text-brand-800">
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <BellRing className="h-9 w-9 text-slate-300" />
              <p className="px-4 text-sm text-slate-500">No notifications yet.</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {notifications.map((n) => {
                const t = TYPE_ICON[n.ntype] || TYPE_ICON.system;
                const Icon = t.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleTap(n)}
                    className={`flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 ${
                      !n.read ? "bg-brand-50/40" : ""
                    }`}
                  >
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-white ${t.className}`}>
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-semibold text-ink-900">{n.title}</p>
                      {n.message && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.message}</p>}
                      <p className="mt-1 text-[11px] text-slate-400">{timeAgo(n.createdAt)}</p>
                    </span>
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
                  </button>
                );
              })}
            </div>
          )}

          <Link
            to="/account/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-slate-100 py-2.5 text-center text-xs font-semibold text-brand-700 hover:bg-slate-50"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
