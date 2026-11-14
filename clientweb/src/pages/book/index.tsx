import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation, useQuery } from "@apollo/client";
import { CalendarCheck, Check, Clock, MapPin, ShieldCheck, Sparkles, Truck, X } from "lucide-react";
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
const dayLabel = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const rupees = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const mins = (n: number) => (n >= 60 ? `${Math.floor(n / 60)} hr${n % 60 ? ` ${n % 60} min` : ""}` : `${n} min`);
const PER: Record<string, string> = { visit: "/ visit", hour: "/ hour", session: "/ session", unit: "/ unit", room: "/ room", sqft: "/ sq ft" };
const WHERE: Record<string, string> = { onsite: "At your place", offsite: "At our store", remote: "Online" };
const photosOf = (s: any): string[] => ((s?.imageurls || []).filter(Boolean).length ? s.imageurls.filter(Boolean) : s?.imageurl ? [s.imageurl] : []);

/** Book a service slot: pick the service and option, a day and a free time. */
export default function BookPage() {
  const { adminid } = useTenant();
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const { data: onData } = useQuery(GET_BOOKING_ON, { variables: { adminid }, skip: !adminid });
  const { data: svcData, loading: svcLoading } = useQuery(GET_BOOKABLE_SERVICES, { variables: { adminid }, skip: !adminid });
  const [cat, setCat] = useState("");
  const [open, setOpen] = useState<any>(null);
  const [openVar, setOpenVar] = useState("");
  const [photo, setPhoto] = useState(0);
  const [pick, setPick] = useState<{ serviceid: string; variantid: string } | null>(null);
  const [date, setDate] = useState(todayIst());
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ date: string; time: string } | null>(null);
  const [book, { loading: booking }] = useMutation(BOOK_APPOINTMENT);
  const stepOne = useRef<HTMLElement>(null);
  const stepTwo = useRef<HTMLElement>(null);
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => new Date(Date.now() + 330 * 60000 + i * 86400000).toISOString().slice(0, 10)), []);

  // Services that have at least one bookable option.
  const services = useMemo(() => (svcData?.getProductServices || [])
    .map((s: any) => ({ ...s, options: (s.servicevariants || []).filter((v: any) => v?.requiresappointment !== false) }))
    .filter((s: any) => s.options.length), [svcData]);
  const cats = useMemo(() => {
    const m = new Map<string, string>();
    services.forEach((s: any) => s.categoryid?.id && m.set(s.categoryid.id, s.categoryid.categoryname));
    return [...m.entries()];
  }, [services]);
  const shown = cat ? services.filter((s: any) => s.categoryid?.id === cat) : services;

  const svc = services.find((s: any) => s.id === pick?.serviceid);
  const opt = svc?.options.find((v: any) => v.id === pick?.variantid);
  const label = svc ? (svc.options.length > 1 ? `${svc.name} - ${opt?.name}` : svc.name) : "";

  const { data: slotData, loading: slotLoading, error: slotError } = useQuery(GET_BOOKING_SLOTS, {
    variables: { adminid, serviceid: pick?.serviceid, variantid: pick?.variantid, date },
    skip: !adminid || !pick || !date,
    fetchPolicy: "network-only",
  });
  const slots: any[] = slotData?.getBookingSlots || [];

  useEffect(() => { if (pick) stepTwo.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [pick]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  const showDetail = (s: any) => { setOpen(s); setOpenVar(pick && pick.serviceid === s.id ? pick.variantid : s.options[0].id); setPhoto(0); };
  const changeService = () => { setPick(null); setTime(""); stepOne.current?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const choose = (s: any, variantid: string) => { setPick({ serviceid: s.id, variantid }); setTime(""); setOpen(null); };

  const confirm = async () => {
    if (!pick || !time) return;
    if (!isLoggedIn) return navigate("/login?redirect=/book");
    setError("");
    try {
      await book({ variables: { input: { serviceid: pick.serviceid, variantid: pick.variantid, date, starttime: time, notes: notes.trim() || undefined } } });
      setDone({ date, time });
    } catch (e: any) {
      setError(e?.message || "Could not book. Please try another time.");
    }
  };

  const off = onData && !(onData.getAdminSettings?.bookingOn && onData.getAdminSettings?.onlineBookingAllowed);
  const fromRate = (s: any) => Math.min(...s.options.map((v: any) => Number(v.servicerate) || 0));
  const facts = (v: any) => [
    v.locationType && WHERE[v.locationType] && { icon: MapPin, text: WHERE[v.locationType] },
    Number(v.visitcharge) > 0 && { icon: Truck, text: `Visit charge ${rupees(v.visitcharge)}` },
    Number(v.warrantydays) > 0 && { icon: ShieldCheck, text: `${v.warrantydays} days warranty` },
  ].filter(Boolean) as { icon: any; text: string }[];

  const detailVar = open?.options.find((v: any) => v.id === openVar) || open?.options[0];

  return (
    <div>
      <Breadcrumb items={[{ label: "Book Appointment" }]} />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-xl font-bold text-ink-900"><CalendarCheck className="h-5 w-5 text-brand-700" /> Book Appointment</h1>
          {isLoggedIn && <Link to="/account/bookings" className="text-sm font-semibold text-brand-700 hover:underline">My Bookings</Link>}
        </div>

        {off ? (
          <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">Online booking is not open right now. Please call us to book.</p>
        ) : done ? (
          <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p>Your booking for <b>{label}</b> on <b>{dayLabel(done.date)}</b> at <b>{time12(done.time)}</b> is received. We will confirm it shortly.</p>
            <Link to="/account/bookings" className="font-semibold text-brand-700">View my bookings</Link>
          </div>
        ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <section ref={stepOne} className="scroll-mt-24 space-y-3">
              <h2 className="text-sm font-semibold text-ink-900">1. Choose a service</h2>
              {cats.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {[["", "All"], ...cats].map(([id, name]) => (
                    <button key={id || "all"} type="button" onClick={() => setCat(id)}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium ${cat === id ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-ink-900 hover:border-slate-300"}`}>{name}</button>
                  ))}
                </div>
              )}
              {svcLoading ? <p className="text-sm text-slate-500">Loading services...</p> : shown.length ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {shown.map((s: any) => {
                    const img = photosOf(s)[0];
                    const v0 = s.options[0];
                    const picked = pick?.serviceid === s.id;
                    return (
                      <div key={s.id} className={`flex gap-4 rounded-xl border bg-white p-4 ${picked ? "border-brand-600 ring-1 ring-brand-600" : "border-slate-200"}`}>
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <button type="button" onClick={() => showDetail(s)} className="text-left text-base font-semibold text-ink-900 hover:underline">{s.name}</button>
                          <div className="flex flex-wrap items-center gap-x-2 text-sm text-slate-600">
                            <span className="font-semibold text-ink-900">{s.options.length > 1 ? "From " : ""}{rupees(fromRate(s))}{s.options.length === 1 && PER[v0.pricingunit] ? ` ${PER[v0.pricingunit]}` : ""}</span>
                            <span>·</span><span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{mins(minutes(v0.duration))}</span>
                          </div>
                          {s.description && <p className="line-clamp-2 text-sm text-slate-500">{s.description}</p>}
                          <div className="flex items-center gap-3 pt-1">
                            <button type="button" onClick={() => showDetail(s)} className="text-sm font-semibold text-brand-700 hover:underline">View details</button>
                            {s.options.length > 1 && <span className="text-xs text-slate-500">{s.options.length} options</span>}
                          </div>
                        </div>
                        <div className="flex w-28 shrink-0 flex-col items-center gap-2">
                          {img ? <img src={img} alt={s.name} className="h-24 w-28 rounded-lg object-cover" />
                            : <div className="flex h-24 w-28 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><Sparkles className="h-7 w-7" /></div>}
                          <button type="button" onClick={() => (s.options.length > 1 ? showDetail(s) : choose(s, v0.id))}
                            className={`-mt-5 rounded-lg border px-4 py-1.5 text-sm font-semibold shadow-sm ${picked ? "border-brand-600 bg-brand-600 text-white" : "border-brand-600 bg-white text-brand-700 hover:bg-brand-50"}`}>
                            {picked ? "Selected" : "Select"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="text-sm text-slate-500">No services are open for booking.</p>}
            </section>

            <section ref={stepTwo} className="scroll-mt-24 space-y-3">
              <h2 className="text-sm font-semibold text-ink-900">2. Pick a day and time</h2>
              {!svc || !opt ? <p className="text-sm text-slate-500">Select a service first.</p> : (
                <>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {days.map((d, i) => {
                      const on = d === date;
                      const dt = new Date(`${d}T12:00:00Z`);
                      return (
                        <button key={d} type="button" onClick={() => { setDate(d); setTime(""); }}
                          className={`flex w-16 shrink-0 flex-col items-center rounded-lg border py-2 text-xs ${on ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
                          <span>{i === 0 ? "Today" : i === 1 ? "Tmrw" : dt.toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" })}</span>
                          <span className={`text-lg font-bold ${on ? "text-white" : "text-ink-900"}`}>{dt.getUTCDate()}</span>
                          <span>{dt.toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" })}</span>
                        </button>
                      );
                    })}
                  </div>
                  {slotLoading ? <p className="text-sm text-slate-500">Finding free times...</p>
                    : slotError ? <p className="text-sm text-rose-600">{slotError.message}</p>
                    : slots.length ? (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {slots.map((s) => (
                          <button key={s.starttime} type="button" onClick={() => setTime(s.starttime)}
                            className={`rounded-lg border px-3 py-2 text-sm font-medium ${time === s.starttime ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-ink-900 hover:border-slate-300"}`}>
                            {time12(s.starttime)}
                          </button>
                        ))}
                      </div>
                    ) : <p className="text-sm text-slate-500">No free time on this day. Try another day.</p>}
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Anything we should know? (optional)"
                    className="block w-full rounded-lg border border-slate-300 p-3 text-sm" />
                </>
              )}
            </section>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
              <h2 className="text-base font-semibold text-ink-900">Booking Summary</h2>
              {!svc || !opt ? <p className="text-slate-500">Select a service to see the price.</p> : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-ink-900">{label}</div>
                      <div className="text-slate-500">{mins(minutes(opt.duration))}{opt.locationType && WHERE[opt.locationType] ? ` · ${WHERE[opt.locationType]}` : ""}</div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <button type="button" onClick={changeService} className="text-xs font-semibold text-brand-700 hover:underline">Change Service</button>
                      {svc.options.length > 1 && <button type="button" onClick={() => showDetail(svc)} className="text-xs font-semibold text-brand-700 hover:underline">Change Option</button>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-slate-700">
                    <CalendarCheck className="h-4 w-4 text-brand-700" />
                    {time ? <span>{dayLabel(date)}, {time12(time)}</span> : <span className="text-slate-500">Pick a time</span>}
                  </div>
                  <div className="space-y-1 border-t border-slate-100 pt-3">
                    <div className="flex justify-between"><span className="text-slate-600">Service{PER[opt.pricingunit] ? ` (${PER[opt.pricingunit].slice(2)})` : ""}</span><span>{rupees(opt.servicerate)}</span></div>
                    {Number(opt.visitcharge) > 0 && <div className="flex justify-between"><span className="text-slate-600">Visit charge</span><span>{rupees(opt.visitcharge)}</span></div>}
                    <div className="flex justify-between pt-1 text-base font-bold text-ink-900"><span>Total</span><span>{rupees((Number(opt.servicerate) || 0) + (Number(opt.visitcharge) || 0))}</span></div>
                    <p className="text-xs text-slate-500">{opt.taxinclusive ? "Includes taxes." : "Taxes extra as applicable."}{PER[opt.pricingunit] ? " Final amount depends on actual work." : ""} Pay after the service.</p>
                  </div>
                  {error && <p className="text-rose-600">{error}</p>}
                  <button type="button" onClick={confirm} disabled={booking || !time}
                    className="h-11 w-full rounded-lg bg-brand-600 font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
                    {!time ? "Pick a time to book" : !isLoggedIn ? "Log in to book" : booking ? "Booking..." : "Confirm Booking"}
                  </button>
                </>
              )}
            </div>
          </aside>
        </div>
        )}
      </div>

      {open && detailVar && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={() => setOpen(null)}>
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <div>
                <div className="text-lg font-bold text-ink-900">{open.name}</div>
                {open.categoryid?.categoryname && <div className="text-xs text-slate-500">{open.categoryid.categoryname}</div>}
              </div>
              <button type="button" onClick={() => setOpen(null)} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Close"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              {photosOf(open).length > 0 && (
                <div className="space-y-2">
                  <img src={photosOf(open)[photo] || photosOf(open)[0]} alt={open.name} className="h-56 w-full rounded-xl object-cover sm:h-72" />
                  {photosOf(open).length > 1 && (
                    <div className="flex gap-2 overflow-x-auto">
                      {photosOf(open).map((u, i) => (
                        <button key={u} type="button" onClick={() => setPhoto(i)}
                          className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 ${photo === i ? "border-brand-600" : "border-transparent"}`}>
                          <img src={u} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {open.description && <p className="whitespace-pre-line text-sm leading-6 text-slate-700">{open.description}</p>}

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-ink-900">{open.options.length > 1 ? "Choose an option" : "Price and time"}</h3>
                {open.options.map((v: any) => (
                  <button key={v.id} type="button" onClick={() => setOpenVar(v.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left text-sm ${detailVar.id === v.id ? "border-brand-600 bg-brand-50" : "border-slate-200 hover:border-slate-300"}`}>
                    <div>
                      <div className="font-semibold text-ink-900">{open.options.length > 1 ? v.name : open.name}</div>
                      <div className="flex items-center gap-1 text-slate-500"><Clock className="h-3.5 w-3.5" />{mins(minutes(v.duration))}</div>
                    </div>
                    <div className="text-right font-semibold text-ink-900">{rupees(v.servicerate)}{PER[v.pricingunit] && <span className="block text-xs font-normal text-slate-500">{PER[v.pricingunit]}</span>}</div>
                  </button>
                ))}
              </div>

              {facts(detailVar).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {facts(detailVar).map((f) => (
                    <span key={f.text} className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"><f.icon className="h-3.5 w-3.5" />{f.text}</span>
                  ))}
                </div>
              )}
              {(detailVar.checklist || []).length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-ink-900">What's included</h3>
                  <ul className="space-y-1.5">
                    {detailVar.checklist.map((c: string) => (
                      <li key={c} className="flex items-start gap-2 text-sm text-slate-700"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              {detailVar.remarks && (
                <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><b>Please note:</b> {detailVar.remarks}</div>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
              <div className="text-sm">
                <div className="font-bold text-ink-900">{rupees(detailVar.servicerate)} {PER[detailVar.pricingunit] || ""}</div>
                <div className="text-xs text-slate-500">{detailVar.taxinclusive ? "Includes taxes" : "Taxes extra"}</div>
              </div>
              <button type="button" onClick={() => choose(open, detailVar.id)}
                className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">Select and pick time</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
