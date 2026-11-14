import { Link, Navigate } from "react-router";
import { useMutation, useQuery } from "@apollo/client";
import { CalendarCheck, CalendarPlus, Clock, User } from "lucide-react";
import Breadcrumb from "../../components/breadcrumb";
import { useAuth } from "../../contexts/auth";
import { CANCEL_MY_APPOINTMENT, GET_MY_APPOINTMENTS } from "../../graphql/queries/booking";

const STATUS: Record<string, { label: string; cls: string }> = {
  booked: { label: "Booked", cls: "bg-amber-50 text-amber-700" },
  confirmed: { label: "Confirmed", cls: "bg-emerald-50 text-emerald-700" },
  arrived: { label: "Arrived", cls: "bg-sky-50 text-sky-700" },
  done: { label: "Done", cls: "bg-slate-100 text-slate-700" },
  noshow: { label: "Missed", cls: "bg-rose-50 text-rose-700" },
  cancelled: { label: "Cancelled", cls: "bg-rose-50 text-rose-700" },
};
const nowIst = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 16).replace("T", " ");
const time12 = (hhmm: string) => {
  const [h, m] = String(hhmm || "0:0").split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
const dayLabel = (ymd: string) =>
  new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** The customer's own service bookings: upcoming first, then past; upcoming ones can be cancelled. */
export default function MyBookingsPage() {
  const { isLoggedIn } = useAuth();
  const { data, loading, refetch } = useQuery(GET_MY_APPOINTMENTS, { skip: !isLoggedIn, fetchPolicy: "cache-and-network" });
  const [cancel, { loading: cancelling }] = useMutation(CANCEL_MY_APPOINTMENT);
  if (!isLoggedIn) return <Navigate to="/login?redirect=/account/bookings" replace />;

  const now = nowIst();
  const all: any[] = data?.getMyAppointments || [];
  const upcoming = all.filter((a) => `${a.billdate} ${a.starttime}` > now && !["cancelled", "done", "noshow"].includes(a.apptStatus))
    .sort((a, b) => `${a.billdate} ${a.starttime}`.localeCompare(`${b.billdate} ${b.starttime}`));
  const past = all.filter((a) => !upcoming.includes(a));

  const onCancel = async (a: any) => {
    if (!window.confirm(`Cancel your booking on ${dayLabel(a.billdate)} at ${time12(a.starttime)}?`)) return;
    try { await cancel({ variables: { id: a.id } }); await refetch(); }
    catch (e: any) { window.alert(e?.message || "Could not cancel."); }
  };

  const card = (a: any, canCancel: boolean) => {
    const st = STATUS[a.apptStatus] || STATUS.booked;
    return (
      <div key={a.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="font-semibold text-ink-900">{a.service || "Service"}</div>
          <div className="flex flex-wrap items-center gap-3 text-slate-600">
            <span className="flex items-center gap-1"><CalendarCheck className="h-4 w-4" /> {dayLabel(a.billdate)}</span>
            <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {time12(a.starttime)}{a.duration ? ` · ${a.duration} min` : ""}</span>
            {a.staff && <span className="flex items-center gap-1"><User className="h-4 w-4" /> {a.staff}</span>}
          </div>
          {a.notes && <div className="text-slate-500">{a.notes}</div>}
        </div>
        <div className="flex items-center gap-2">
          {a.amount ? <span className="font-semibold text-ink-900">₹{Number(a.amount).toLocaleString("en-IN")}</span> : null}
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
          {canCancel && ["booked", "confirmed"].includes(a.apptStatus) && (
            <button type="button" disabled={cancelling} onClick={() => onCancel(a)}
              className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Cancel</button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <Breadcrumb items={[{ label: "My Account", to: "/account" }, { label: "My Bookings" }]} />
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-ink-900">My Bookings</h1>
          <Link to="/book" className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            <CalendarPlus className="h-4 w-4" /> New Booking
          </Link>
        </div>
        {loading && !all.length ? <p className="text-sm text-slate-500">Loading...</p> : !all.length ? (
          <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">You have no bookings yet.</p>
        ) : (
          <>
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-ink-900">Upcoming</h2>
              {upcoming.length ? upcoming.map((a) => card(a, true)) : <p className="text-sm text-slate-500">No upcoming bookings.</p>}
            </section>
            {past.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-ink-900">Past and Cancelled</h2>
                {past.map((a) => card(a, false))}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
