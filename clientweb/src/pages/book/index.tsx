import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation, useQuery } from "@apollo/client";
import { CalendarCheck, Clock } from "lucide-react";
import Breadcrumb from "../../components/breadcrumb";
import { useAuth } from "../../contexts/auth";
import { useTenant } from "../../contexts/tenant";
import { BOOK_APPOINTMENT, GET_BOOKABLE_SERVICES, GET_BOOKING_ON, GET_BOOKING_SLOTS } from "../../graphql/queries/booking";

const todayIst = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
const minutes = (d?: { amount?: number; unit?: string }) => Math.round((Number(d?.amount) || 0.5) * (d?.unit === "minutes" ? 1 : 60));
const time12 = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

/** Book a service slot: pick the service, a day and a free time. */
export default function BookPage() {
  const { adminid } = useTenant();
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const { data: onData } = useQuery(GET_BOOKING_ON, { variables: { adminid }, skip: !adminid });
  const { data: svcData, loading: svcLoading } = useQuery(GET_BOOKABLE_SERVICES, { variables: { adminid }, skip: !adminid });
  const [pick, setPick] = useState("");
  const [date, setDate] = useState(todayIst());
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ date: string; time: string } | null>(null);
  const [book, { loading: booking }] = useMutation(BOOK_APPOINTMENT);

  // Each bookable service variant is one choice.
  const choices = useMemo(() => {
    const out: any[] = [];
    for (const s of svcData?.getProductServices || []) {
      for (const v of s.servicevariants || []) {
        if (v?.requiresappointment === false) continue;
        out.push({ key: `${s.id}|${v.id}`, serviceid: s.id, variantid: v.id, name: s.servicevariants.length > 1 ? `${s.name} - ${v.name}` : s.name, rate: v.servicerate, mins: minutes(v.duration) });
      }
    }
    return out;
  }, [svcData]);
  const chosen = choices.find((c) => c.key === pick);

  const { data: slotData, loading: slotLoading, error: slotError } = useQuery(GET_BOOKING_SLOTS, {
    variables: { adminid, serviceid: chosen?.serviceid, variantid: chosen?.variantid, date },
    skip: !adminid || !chosen || !date,
    fetchPolicy: "network-only",
  });
  const slots: any[] = slotData?.getBookingSlots || [];

  const confirm = async () => {
    if (!chosen || !time) return;
    if (!isLoggedIn) return navigate("/login?redirect=/book");
    setError("");
    try {
      await book({ variables: { input: { serviceid: chosen.serviceid, variantid: chosen.variantid, date, starttime: time, notes: notes.trim() || undefined } } });
      setDone({ date, time });
    } catch (e: any) {
      setError(e?.message || "Could not book. Please try another time.");
    }
  };

  const off = onData && !onData.getAdminSettings?.bookingOn;

  return (
    <div>
      <Breadcrumb items={[{ label: "Book Appointment" }]} />
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
        <h1 className="flex items-center gap-2 text-xl font-bold text-ink-900"><CalendarCheck className="h-5 w-5 text-brand-700" /> Book Appointment</h1>

        {off ? (
          <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">Online booking is not open right now. Please call us to book.</p>
        ) : done ? (
          <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p>Your booking for <b>{chosen?.name}</b> on <b>{done.date}</b> at <b>{time12(done.time)}</b> is received. We will confirm it shortly.</p>
            <Link to="/account" className="font-semibold text-brand-700">Go to my account</Link>
          </div>
        ) : (
          <>
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-ink-900">1. Choose a service</h2>
              {svcLoading ? <p className="text-sm text-slate-500">Loading services...</p> : choices.length ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {choices.map((c) => (
                    <button key={c.key} type="button" onClick={() => { setPick(c.key); setTime(""); }}
                      className={`rounded-lg border p-3 text-left text-sm ${pick === c.key ? "border-brand-600 bg-brand-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                      <div className="font-semibold text-ink-900">{c.name}</div>
                      <div className="text-slate-500">{c.mins} min{c.rate ? ` · ₹${Number(c.rate).toLocaleString("en-IN")}` : ""}</div>
                    </button>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-500">No services are open for booking.</p>}
            </section>

            {chosen && (
              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-ink-900">2. Pick a day and time</h2>
                <input type="date" value={date} min={todayIst()} onChange={(e) => { setDate(e.target.value); setTime(""); }}
                  className="h-10 rounded-lg border border-slate-300 px-3 text-sm" />
                {slotLoading ? <p className="text-sm text-slate-500">Finding free times...</p>
                  : slotError ? <p className="text-sm text-rose-600">{slotError.message}</p>
                  : slots.length ? (
                    <div className="flex flex-wrap gap-2">
                      {slots.map((s) => (
                        <button key={s.starttime} type="button" onClick={() => setTime(s.starttime)}
                          className={`flex items-center gap-1 rounded-lg border px-3 py-2 text-sm ${time === s.starttime ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-ink-900 hover:border-slate-300"}`}>
                          <Clock className="h-3.5 w-3.5" /> {time12(s.starttime)}
                        </button>
                      ))}
                    </div>
                  ) : <p className="text-sm text-slate-500">No free time on this day. Try another day.</p>}
              </section>
            )}

            {chosen && time && (
              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-ink-900">3. Confirm</h2>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Anything we should know? (optional)"
                  className="w-full rounded-lg border border-slate-300 p-3 text-sm" />
                {error && <p className="text-sm text-rose-600">{error}</p>}
                <button type="button" onClick={confirm} disabled={booking}
                  className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                  {isLoggedIn ? (booking ? "Booking..." : `Book ${time12(time)} on ${date}`) : "Log in to book"}
                </button>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
