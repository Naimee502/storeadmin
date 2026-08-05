import { Account } from "../models/accounts";
import { Admin } from "../models/admin";
import { AdminSettings } from "../models/adminsettings";
import { Payment } from "../models/payments";
import { SalesInvoice } from "../models/salesinvoice";
import { Transaction } from "../models/transactions";
import { pushNotification } from "../models/notifications";

// ---------------------------------------------------------------------------
// Shared outstanding-reminder logic.
//
// Used by BOTH entry points so a manual reminder and an automatic month-end
// reminder always say the same thing:
//   - the Party Reports bell button (GraphQL: sendOutstandingReminder)
//   - the month-end scheduler (utils/reminderscheduler)
//
// Reminders are for CUSTOMERS ONLY. A vendor is someone we owe money to, so
// "please pay your outstanding" would be backwards for them.
// ---------------------------------------------------------------------------

// How much of an invoice has already been settled (payments + agst-ref txns).
const invoiceSettledAmount = async (invoiceId: any): Promise<number> => {
  if (!invoiceId) return 0;
  const idStr = String(invoiceId);
  let total = 0;

  const pays = await Payment.find({ "invoices.invoiceid": invoiceId, status: true })
    .select("invoices")
    .lean();
  pays.forEach((p: any) =>
    (p.invoices || []).forEach((iv: any) => {
      if (String(iv.invoiceid) === idStr) total += iv.settledamount || 0;
    })
  );

  const txns = await Transaction.find({ "invoices.invoiceid": invoiceId, status: true })
    .select("invoices")
    .lean();
  txns.forEach((t: any) =>
    (t.invoices || []).forEach((iv: any) => {
      if (String(iv.invoiceid) === idStr) total += iv.settledamount || 0;
    })
  );

  return parseFloat(total.toFixed(2));
};

export type PartyOutstanding = {
  amount: number; // sum of unpaid bills
  pendingBills: number;
  overdueDays: number; // largest overdue span across unpaid bills, 0 if none
  dueDate: string; // earliest upcoming/passed due date, "" if no bill carries one
};

// Bill-wise outstanding for one customer: sum of (invoice total − settled)
// across unsettled sales bills. Deliberately excludes the opening balance so
// this matches what the party sees on their own dashboard/payments screen
// (server's partyBillOutstanding) — the reminder and their app agree.
export const getPartyOutstanding = async (accountId: any): Promise<PartyOutstanding> => {
  const empty: PartyOutstanding = { amount: 0, pendingBills: 0, overdueDays: 0, dueDate: "" };
  if (!accountId) return empty;

  const invs: any[] = await SalesInvoice.find({ partyacc: accountId, status: true })
    .select("totalamount billdate duedate")
    .lean();
  if (!invs.length) return empty;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let amount = 0;
  let pendingBills = 0;
  let overdueDays = 0;
  let earliestDue: Date | null = null;

  for (const inv of invs) {
    const settled = await invoiceSettledAmount(inv._id);
    const due = (inv.totalamount || 0) - settled;
    if (due <= 0.005) continue;

    amount += due;
    pendingBills += 1;

    if (inv.duedate) {
      const ref = new Date(inv.duedate);
      if (!isNaN(ref.getTime())) {
        ref.setHours(0, 0, 0, 0);
        if (!earliestDue || ref < earliestDue) earliestDue = ref;
        const days = Math.floor((today.getTime() - ref.getTime()) / 86400000);
        if (days > overdueDays) overdueDays = days;
      }
    }
  }

  return {
    amount: parseFloat(amount.toFixed(2)),
    pendingBills,
    overdueDays,
    dueDate: earliestDue ? formatDMY(earliestDue) : "",
  };
};

const formatDMY = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
};

export type ReminderResult = {
  success: boolean;
  mobile: string | null;
  message: string | null;
};

// Create the party-targeted in-app notification (it surfaces in both the
// mobile app and the party website, which read the same collection) and
// return the WhatsApp text so an interactive caller can also open a chat.
// The scheduler ignores the returned text — automatic WhatsApp isn't possible
// without the WhatsApp Business API.
export const sendOutstandingReminder = async (opts: {
  adminid: any;
  branchid?: any;
  partyid: any;
  amount: number;
  pendingBills?: number;
  overdueDays?: number;
  dueDate?: string;
  auto?: boolean; // true when fired by the month-end scheduler
}): Promise<ReminderResult> => {
  const { adminid, branchid, partyid, amount, pendingBills, overdueDays, dueDate, auto } = opts;

  const account: any = await Account.findById(partyid).select("name mobile type").lean();
  if (!account) return { success: false, mobile: null, message: null };
  // Guard at the lowest level too, so no future caller can remind a vendor.
  if (account.type === "vendor") return { success: false, mobile: null, message: null };

  // Business Settings → Invoice Print → "Show company name in signature"
  // governs the sign-off here too, exactly like the invoice WhatsApp share:
  // when it's off, the company name must not leak into the chat message.
  const settings: any = await AdminSettings.getOrCreateForAdmin(adminid);
  const showSignatureCompanyName = settings?.printShowCompanyNameInSignature !== false;

  const admin: any = await Admin.findById(adminid).select("companyName").lean();
  const companyName = showSignatureCompanyName ? admin?.companyName || "" : "";

  const amt = Number(amount || 0);
  const amtLabel = `₹${amt.toFixed(2)}`;

  const detailParts = [
    `Outstanding: ${amtLabel}`,
    pendingBills ? `${pendingBills} pending bill${pendingBills > 1 ? "s" : ""}` : "",
    dueDate && dueDate !== "-" ? `Due: ${dueDate}` : "",
    overdueDays && overdueDays > 0 ? `Overdue by ${overdueDays} days` : "",
  ].filter(Boolean);

  await pushNotification({
    adminid,
    branchid: branchid || null,
    targettype: "party",
    targetid: partyid,
    ntype: "payment",
    title: auto ? "Month-end payment reminder" : "Payment reminder",
    message: detailParts.join(" • "),
    webpath: "/payments",
    appscreen: "Payments",
  });

  const waMessage =
    `*Payment Reminder*\n` +
    `Dear ${account.name || "Customer"},\n\n` +
    `Your outstanding balance is *${amtLabel}*.\n` +
    (pendingBills ? `Pending bills: ${pendingBills}\n` : "") +
    (dueDate && dueDate !== "-" ? `Due date: ${dueDate}\n` : "") +
    (overdueDays && overdueDays > 0 ? `Overdue by: ${overdueDays} days\n` : "") +
    `\nKindly arrange the payment at your earliest convenience.\n` +
    `Thank you for your business!\n` +
    (companyName ? `\n— ${companyName}` : "");

  return {
    success: true,
    mobile: (account.mobile || "").replace(/\D/g, ""),
    message: waMessage,
  };
};

// Send month-end reminders to every customer of one admin that still has
// unpaid bills. Returns how many went out (used for logging).
export const sendMonthEndRemindersForAdmin = async (adminid: any): Promise<number> => {
  // Customers only — vendors are excluded by the query, not just by the guard.
  // NOTE: the ownership field on Account is `admin`, not `adminid`.
  const customers: any[] = await Account.find({
    admin: adminid,
    type: "customer",
    status: true,
  })
    .select("_id branchid")
    .lean();

  let sent = 0;
  for (const c of customers) {
    try {
      const out = await getPartyOutstanding(c._id);
      if (out.amount <= 0 || out.pendingBills === 0) continue;

      const res = await sendOutstandingReminder({
        adminid,
        branchid: c.branchid || null,
        partyid: c._id,
        amount: out.amount,
        pendingBills: out.pendingBills,
        overdueDays: out.overdueDays,
        dueDate: out.dueDate,
        auto: true,
      });
      if (res.success) sent += 1;
    } catch (e) {
      // One bad party must never abort the whole run.
      console.error(`Month-end reminder failed for party ${c._id}:`, e);
    }
  }
  return sent;
};
