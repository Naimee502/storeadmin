import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router";
import { ArrowLeft, BadgeCheck, LifeBuoy, ShieldCheck, Wrench } from "lucide-react";
import Breadcrumb from "../../components/breadcrumb";
import { useAuth } from "../../contexts/auth";

export const rupees = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
export const dateLabel = (ymd?: string | null) =>
  ymd ? new Date(`${String(ymd).slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "-";
export const whenLabel = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "";
export const time12 = (hhmm?: string | null) => {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

export function Badge({ cls, children }: { cls: string; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

/** Signed-in customer page frame: breadcrumb, optional back link, title and action. */
export function ServicePage({ title, back, crumbs = [], action, children }: { title: string; back?: string; crumbs?: { label: string; to?: string }[]; action?: ReactNode; children: ReactNode }) {
  const { isLoggedIn } = useAuth();
  const { pathname } = useLocation();
  if (!isLoggedIn) return <Navigate to={`/login?redirect=${encodeURIComponent(pathname)}`} replace />;
  return (
    <div>
      <Breadcrumb items={[{ label: "My Account", to: "/account" }, ...crumbs, { label: title }]} />
      <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6">
        {back && <Link to={back} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" /> Back</Link>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-ink-900">{title}</h1>
          {action}
        </div>
        {children}
      </div>
    </div>
  );
}

export const Empty = ({ text }: { text: string }) => <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">{text}</p>;
export const Loading = () => <p className="text-sm text-slate-500">Loading...</p>;

/** Menu icon for a service page. */
export function ServiceIcon({ to, className = "h-4 w-4" }: { to: string; className?: string }) {
  const I = to.includes("repairs") ? Wrench : to.includes("amc") ? ShieldCheck : to.includes("memberships") ? BadgeCheck : LifeBuoy;
  return <I className={className} />;
}
