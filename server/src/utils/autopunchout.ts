import cron from "node-cron";
import { Attendance } from "../models/attendance";
import { AdminSettings } from "../models/adminsettings";
import { StaffAccount } from "../models/staffaccounts";
import { pushNotification } from "../models/notifications";
import { recomputeAttendanceTotals, openPunchIn } from "./attendancetotals";

// ---------------------------------------------------------------------------
// Auto punch-out.
//
// A field user who forgets to punch out stays "punched in" all night — and the
// app keeps sending their live location for as long as a punch is open. Every
// minute this closes any punch still open past the business's cut-off
// (Business Settings → Attendance, default 22:00 IST).
//
// The punch-out is stamped AT the cut-off, not at the minute the job happened
// to run, so worked hours end there. The app polls the open punch every 30 s,
// so tracking stops within half a minute of this running.
// ---------------------------------------------------------------------------

const DEFAULT_TIME = "22:00";
const IST = "+05:30";

const pad2 = (n: number) => String(n).padStart(2, "0");

/** YYYY-MM-DD for a moment, in IST (attendance dates are Indian calendar days). */
const istDate = (d: Date) => {
  const ist = new Date(d.getTime() + 330 * 60000);
  return `${ist.getUTCFullYear()}-${pad2(ist.getUTCMonth() + 1)}-${pad2(ist.getUTCDate())}`;
};

const validTime = (t?: string | null) => (t && /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : DEFAULT_TIME);

/** "YYYY-MM-DD" + "HH:mm" (IST) → Date. */
const atIst = (date: string, time: string) => new Date(`${date}T${time}:00${IST}`);

const fmtTime = (d: Date) =>
  d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

let running = false;

export const runAutoPunchOut = async (now: Date = new Date()) => {
  if (running) return 0; // a slow run must not overlap the next minute's
  running = true;
  let closed = 0;
  try {
    // Today and yesterday only: yesterday catches a punch still open across
    // midnight. Older forgotten punches predate this feature and are left for
    // an admin to correct rather than rewritten in bulk.
    const today = istDate(now);
    const yesterday = istDate(new Date(now.getTime() - 86400000));

    const candidates: any[] = await Attendance.find({
      status_active: true,
      date: { $in: [today, yesterday] },
      "punches.type": "in",
    })
      .select("_id adminid punches")
      .lean();

    const open = candidates.filter((c) => openPunchIn(c.punches));
    if (!open.length) return 0;

    const adminIds = [...new Set(open.map((c) => String(c.adminid)))];
    const settings: any[] = await AdminSettings.find({ adminid: { $in: adminIds } })
      .select("adminid autoPunchOutEnabled autoPunchOutTime")
      .lean();
    const byAdmin = new Map(settings.map((s) => [String(s.adminid), s]));

    for (const c of open) {
      try {
        const s = byAdmin.get(String(c.adminid));
        if (s?.autoPunchOutEnabled === false) continue;

        const log: any = await Attendance.findById(c._id);
        if (!log) continue;
        const openIn = openPunchIn(log.punches);
        if (!openIn) continue; // punched out since we looked

        const cutoff = atIst(log.date, validTime(s?.autoPunchOutTime));
        const inAt = new Date(openIn.timestamp);
        // Punched in AFTER the cut-off (a late shift): don't throw them out
        // the minute they arrive — close it at the end of that day instead.
        const outAt = inAt < cutoff ? cutoff : atIst(log.date, "23:59");
        if (now < outAt) continue;

        log.punches.push({
          type: "out",
          timestamp: outAt,
          source: "auto",
          isAutoOut: true,
          remarks: "Automatic punch-out — did not punch out",
          latitude: openIn.latitude,
          longitude: openIn.longitude,
        });
        recomputeAttendanceTotals(log);
        await log.save();
        closed += 1;

        // Best-effort notices: tell the staff member and the admin.
        try {
          const staff: any = await StaffAccount.findById(log.staffid).select("name").lean();
          const name = staff?.name || "Staff";
          const when = `${log.date} • ${fmtTime(outAt)}`;
          await pushNotification({
            adminid: log.adminid, branchid: log.branchid,
            targettype: "staff", targetid: log.staffid,
            ntype: "attendance",
            title: "You were punched out automatically",
            message: `${when} — you had not punched out. Location tracking has stopped.`,
            appscreen: "Attendance",
            docmodel: "Attendance", docid: log._id,
          });
          await pushNotification({
            adminid: log.adminid, branchid: log.branchid,
            targettype: "admin",
            ntype: "attendance",
            title: `${name} auto punched out`,
            message: `${when} — forgot to punch out`,
            webpath: "/attendance",
            docmodel: "Attendance", docid: log._id,
          });
        } catch { /* notifications never block the punch-out */ }
      } catch (e) {
        // One record failing must not stop the rest.
        console.error(`Auto punch-out failed for attendance ${c._id}:`, e);
      }
    }
    if (closed) console.log(`Auto punch-out: closed ${closed} open punch(es).`);
    return closed;
  } finally {
    running = false;
  }
};

export const startAutoPunchOutScheduler = () => {
  cron.schedule(
    "* * * * *",
    () => {
      runAutoPunchOut().catch((e) => console.error("Auto punch-out run failed:", e));
    },
    { timezone: "Asia/Kolkata" }
  );
  console.log("Auto punch-out scheduler started (every minute).");
};
