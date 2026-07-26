import { useMemo } from "react";
import { Navigate, useNavigate } from "react-router";
import { useQuery, useMutation } from "@apollo/client";
import { ArrowLeft, Package, FileText, Wallet, CalendarCheck, UserPlus, MapPin, BellOff, Clock } from "lucide-react";
import Breadcrumb from "../../components/breadcrumb";
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
  system: { icon: BellOff, className: "bg-slate-500" },
};

function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr${h > 1 ? "s" : ""} ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d} days ago`;
  return `${Math.floor(d / 7)} week${d >= 14 ? "s" : ""} ago`;
}

// Full notification history — same list the app's dedicated Notifications
// screen shows (all notifications, read and unread), not just the unread
// ones the header bell's dropdown badge tracks.
export default function NotificationsPage() {
  const { isLoggedIn, account } = useAuth();
  const { adminid } = useTenant();
  const navigate = useNavigate();

  const filter = useMemo(
    () => ({ adminid, targettype: "party", targetid: account?.id, limit: 100 }),
    [adminid, account?.id]
  );

  const { data, refetch } = useQuery(GET_NOTIFICATIONS, {
    variables: { filter },
    skip: !isLoggedIn || !adminid || !account?.id,
    fetchPolicy: "cache-and-network",
  });
  const [markRead] = useMutation(MARK_NOTIFICATION_READ);
  const [markAllRead] = useMutation(MARK_ALL_NOTIFICATIONS_READ);

  const notifications: any[] = data?.getNotifications ?? [];
  const unreadCount = notifications.filter((n: any) => !n.read).length;

  if (!isLoggedIn) return <Navigate to="/login" replace />;

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
    <div>
      <Breadcrumb items={[{ label: "My Account", to: "/account" }, { label: "Notifications" }]} />

      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate("/account")}
          className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to My Account
        </button>

        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-xl font-bold text-ink-900">Notifications</h1>
          {unreadCount > 0 && (
            <button onClick={handleMarkAll} className="text-xs font-semibold text-brand-700 hover:text-brand-800">
              Mark all read
            </button>
          )}
        </div>

        {unreadCount > 0 && (
          <span className="mb-4 inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            {unreadCount} unread
          </span>
        )}

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-100 py-16 text-center">
            <BellOff className="h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-500">No notifications yet.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {notifications.map((n: any) => {
              const t = TYPE_ICON[n.ntype] || TYPE_ICON.system;
              const Icon = t.icon;
              return (
                <button
                  key={n.id}
                  onClick={() => handleTap(n)}
                  className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left ${
                    !n.read ? "border-brand-200 bg-brand-50/40" : "border-slate-100"
                  }`}
                >
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white ${t.className}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 text-sm font-semibold text-ink-900">{n.title}</p>
                      {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
                    </div>
                    {n.message && <p className="mt-1 text-xs text-slate-500">{n.message}</p>}
                    <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
                      <Clock className="h-3 w-3" /> {timeAgo(n.createdAt)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
