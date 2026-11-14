import { Appointment } from "../../../models/service";
import { ProductService } from "../../../models/products";
import { StaffAccount } from "../../../models/staffaccounts";
import { Account } from "../../../models/accounts";
import { AdminSettings } from "../../../models/adminsettings";
import { Admin } from "../../../models/admin";
import { pushNotification } from "../../../models/notifications";
import { resolveTenant, TenantError } from "../../../utils/tenant";
import { istDate } from "../../../utils/ist";
import { loadAppointment, minutesOf, slotRules } from "../service";

const bad = (msg: string) => new TenantError(msg, "BAD_USER_INPUT");
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

// The service variant being booked, the day's windows and who can do it.
const plan = async (adminid: any, serviceid: any, variantid: any, date: string) => {
  const st: any = await AdminSettings.findOne({ adminid }).select("bookingOn bookingFrom bookingTo bookingStepMinutes bookingDaysAhead").lean();
  const a: any = await Admin.findById(adminid).select("allowedmodules").lean();
  const moduleOn = !Array.isArray(a?.allowedmodules) || a.allowedmodules.includes("onlinebooking");
  if (!st?.bookingOn || !moduleOn) throw bad("Online booking is not open for this business.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw bad("Pick a date.");
  const today = istDate();
  const last = istDate(new Date(Date.now() + (Number(st.bookingDaysAhead) || 30) * 86400000));
  if (date < today || date > last) throw bad("That date is not open for booking.");

  const p: any = await ProductService.findOne({ _id: serviceid, adminid, isservice: true, status: { $ne: false } }).select("name servicevariants").lean();
  const v: any = (variantid && p?.servicevariants?.find((x: any) => String(x._id) === String(variantid))) || p?.servicevariants?.[0];
  if (!p || !v || v.requiresappointment === false) throw bad("This service cannot be booked online.");

  const day = DAYS[new Date(`${date}T12:00:00Z`).getUTCDay()];
  const own = (v.availabilityslots || []).filter((w: any) => w?.from && w?.to);
  const windows = own.length
    ? own.filter((w: any) => w.day === day).map((w: any) => [minutesOf(w.from), minutesOf(w.to)])
    : [[minutesOf(st.bookingFrom || "10:00"), minutesOf(st.bookingTo || "19:00")]];
  const duration = Math.max(5, (Number(v.duration?.amount) || 0.5) * (v.duration?.unit === "minutes" ? 1 : 60));
  const staffIds = v.staffids?.length
    ? v.staffids
    : (await StaffAccount.find({ admin: adminid, status: { $ne: false }, role: "staff" }).select("_id").lean()).map((s: any) => s._id);
  const services = [{ productserviceid: p._id, variantid: v._id, qty: 1 }];
  return { p, v, windows, duration, staffIds, services, step: Number(st.bookingStepMinutes) || 30, today };
};

// Staff free for [start, start + duration) on the day, under each service's buffer and capacity.
const freeStaff = async (adminid: any, staffIds: any[], date: string, start: number, duration: number, services: any[]) => {
  if (!staffIds.length) return [];
  const mine = await slotRules(services);
  const end = start + duration + mine.buffer;
  const others: any[] = await Appointment.find({
    adminid, staffid: { $in: staffIds }, billdate: date, status: true, apptStatus: { $nin: ["cancelled", "noshow"] },
  }).select("staffid starttime duration services").lean();
  const free: any[] = [];
  for (const id of staffIds) {
    let clashes = 0;
    for (const o of others.filter((x) => String(x.staffid) === String(id))) {
      const s = minutesOf(o.starttime);
      const theirs = await slotRules(o.services);
      if (s < end && start < s + (Number(o.duration) || 30) + theirs.buffer) clashes += 1;
    }
    if (clashes < mine.capacity) free.push(id);
  }
  return free;
};

const nowMinutesIst = () => {
  const ist = new Date(Date.now() + 330 * 60000);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
};

export const bookingResolvers = {
  Query: {
    getBookingSlots: async (_: any, { adminid, serviceid, variantid, date }: any, context: any) => {
      const scope = await resolveTenant(context, { requestedAdminId: adminid });
      const pl = await plan(scope.adminid, serviceid, variantid, date);
      const after = date === pl.today ? nowMinutesIst() : -1;
      const out: any[] = [];
      for (const [from, to] of pl.windows) {
        if (Number.isNaN(from) || Number.isNaN(to)) continue;
        for (let t = from; t + pl.duration <= to; t += pl.step) {
          if (t <= after) continue;
          const free = await freeStaff(scope.adminid, pl.staffIds, date, t, pl.duration, pl.services);
          if (free.length || !pl.staffIds.length) out.push({ starttime: hhmm(t), available: free.length });
        }
      }
      return out;
    },
  },
  Mutation: {
    bookAppointment: async (_: any, { input }: any, context: any) => {
      if (context?.user?.type !== "party") throw new TenantError("Please sign in to book.", "UNAUTHENTICATED");
      const scope = await resolveTenant(context);
      const pl = await plan(scope.adminid, input.serviceid, input.variantid, String(input.date || ""));
      const start = minutesOf(input.starttime);
      const inWindow = pl.windows.some(([from, to]: number[]) => start >= from && start + pl.duration <= to && (start - from) % pl.step === 0);
      if (Number.isNaN(start) || !inWindow) throw bad("Pick one of the listed times.");
      if (input.date === pl.today && start <= nowMinutesIst()) throw bad("That time has passed. Pick a later one.");
      const free = await freeStaff(scope.adminid, pl.staffIds, input.date, start, pl.duration, pl.services);
      if (pl.staffIds.length && !free.length) throw bad("That time was just taken. Pick another.");
      const party: any = await Account.findById(context.user.id).select("name mobile branchid").lean();
      const rate = Number(pl.v.servicerate) || 0;
      const created: any = await Appointment.create({
        adminid: scope.adminid,
        branchid: party?.branchid || scope.branchid || undefined,
        partyacc: context.user.id,
        staffid: free[0] || undefined,
        services: [{ ...pl.services[0], rate, amount: rate }],
        billdate: input.date,
        starttime: input.starttime,
        duration: pl.duration,
        apptStatus: "booked",
        notes: String(input.notes || "").slice(0, 1000) || undefined,
        createdby_name: party?.name ? `${party.name} (online)` : "Online booking",
      });
      pushNotification({
        adminid: scope.adminid, targettype: "admin", ntype: "appointment",
        title: `Online booking: ${pl.p.name}`, message: `${party?.name || "Customer"} • ${input.date} ${input.starttime}`,
        webpath: "/appointments", docmodel: "Appointment", docid: created._id,
      }).catch(() => {});
      if (free[0]) {
        pushNotification({
          adminid: scope.adminid, targettype: "staff", targetid: free[0], ntype: "appointment",
          title: `New booking: ${pl.p.name}`, message: `${input.date} ${input.starttime}`, docmodel: "Appointment", docid: created._id,
        }).catch(() => {});
      }
      return loadAppointment(created._id);
    },
  },
};
