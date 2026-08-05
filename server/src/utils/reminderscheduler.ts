import cron from "node-cron";
import { Admin } from "../models/admin";
import { sendMonthEndRemindersForAdmin } from "./outstandingreminder";

// ---------------------------------------------------------------------------
// Month-end automatic payment reminders.
//
// Runs once a day and only acts when today is the LAST day of the month, so
// the same job handles 28/29/30/31-day months without any special casing.
//
// Only in-app notifications go out (party app + party website, both read the
// same party-targeted notifications). WhatsApp cannot be automated from the
// server — wa.me needs a real browser click, and pushing a message without
// one requires the WhatsApp Business Cloud API. The manual bell button on
// Party Reports remains the way to send a WhatsApp reminder.
//
// Customers only — vendors are money we owe, not money we collect.
// ---------------------------------------------------------------------------

const isLastDayOfMonth = (d: Date) => {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  return next.getMonth() !== d.getMonth();
};

// Exported so it can be triggered manually (e.g. from a script) without
// waiting for month end.
export const runMonthEndReminders = async () => {
  const admins: any[] = await Admin.find({}).select("_id companyName").lean();
  let totalSent = 0;

  for (const a of admins) {
    try {
      const sent = await sendMonthEndRemindersForAdmin(a._id);
      totalSent += sent;
      if (sent) {
        console.log(`Month-end reminders: ${sent} sent for ${a.companyName || a._id}`);
      }
    } catch (e) {
      // One tenant failing must not stop the rest.
      console.error(`Month-end reminders failed for admin ${a._id}:`, e);
    }
  }

  console.log(`Month-end reminders complete — ${totalSent} notification(s) sent.`);
  return totalSent;
};

export const startReminderScheduler = () => {
  // 09:00 every day; the guard below limits real work to month end.
  // Timezone is pinned so the job doesn't drift with the server's locale.
  cron.schedule(
    "0 9 * * *",
    async () => {
      const today = new Date();
      if (!isLastDayOfMonth(today)) return;
      console.log("Month-end detected — sending outstanding reminders...");
      try {
        await runMonthEndReminders();
      } catch (e) {
        console.error("Month-end reminder run failed:", e);
      }
    },
    { timezone: "Asia/Kolkata" }
  );

  console.log("Reminder scheduler started (month-end, 09:00 IST).");
};
