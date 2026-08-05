import { Notification, pushNotification } from "../../../models/notifications";
import { Account } from "../../../models/accounts";
import { Admin } from "../../../models/admin";

const formatNotification = (n: any) => ({
  ...n,
  id: n._id.toString(),
  createdAt: n.createdAt ? new Date(n.createdAt).toISOString() : null,
});

export const notificationResolvers = {
  Query: {
    getNotifications: async (_: any, { filter }: any) => {
      const query: any = {
        adminid: filter.adminid,
        targettype: filter.targettype,
      };
      if (filter.targettype !== "admin") {
        if (!filter.targetid) return [];
        query.targetid = filter.targetid;
      }
      if (filter.unreadOnly) query.read = false;

      const docs = await Notification.find(query)
        .sort({ createdAt: -1 })
        .limit(Math.min(filter.limit || 50, 200))
        .lean();
      return docs.map(formatNotification);
    },
  },

  Mutation: {
    markNotificationRead: async (_: any, { id }: { id: string }) => {
      await Notification.findByIdAndUpdate(id, { read: true });
      return true;
    },
    markAllNotificationsRead: async (_: any, { filter }: any) => {
      const query: any = {
        adminid: filter.adminid,
        targettype: filter.targettype,
        read: false,
      };
      if (filter.targettype !== "admin") {
        if (!filter.targetid) return false;
        query.targetid = filter.targetid;
      }
      await Notification.updateMany(query, { read: true });
      return true;
    },

    // Manual outstanding-payment reminder, fired from the admin panel's
    // Party Reports screen. Creates a party-targeted Notification (so the
    // same reminder shows up in both the mobile app and the website for
    // that party's login) and returns the party's mobile + the composed
    // message so the caller can also open WhatsApp for that same number.
    sendOutstandingReminder: async (_: any, { input }: any) => {
      const { adminid, branchid, partyid, amount, pendingBills, overdueDays, dueDate } = input;

      const account: any = await Account.findById(partyid).select("name mobile").lean();
      if (!account) return { success: false, mobile: null, message: null };

      const admin: any = await Admin.findById(adminid).select("companyName").lean();
      const companyName = admin?.companyName || "";

      const amt = Number(amount || 0);
      const amtLabel = `₹${amt.toFixed(2)}`;

      const title = "Payment reminder";
      const detailParts = [
        `Outstanding: ${amtLabel}`,
        pendingBills ? `${pendingBills} pending bill${pendingBills > 1 ? "s" : ""}` : "",
        dueDate && dueDate !== "-" ? `Due: ${dueDate}` : "",
        overdueDays && overdueDays > 0 ? `Overdue by ${overdueDays} days` : "",
      ].filter(Boolean);
      const message = detailParts.join(" • ");

      await pushNotification({
        adminid,
        branchid: branchid || null,
        targettype: "party",
        targetid: partyid,
        ntype: "payment",
        title,
        message,
        webpath: "/payments",
        appscreen: "Payments",
      });

      // Longer, human-readable text for the WhatsApp chat.
      const waMessage =
        `*Payment Reminder*\n` +
        `Dear ${account.name || "Customer"},\n\n` +
        `Your outstanding balance is *${amtLabel}*.\n` +
        (pendingBills ? `Pending bills: ${pendingBills}\n` : "") +
        (dueDate && dueDate !== "-" ? `Due date: ${dueDate}\n` : "") +
        (overdueDays && overdueDays > 0 ? `Overdue by: ${overdueDays} days\n` : "") +
        `\nKindly arrange the payment at your earliest convenience.\n` +
        (companyName ? `\n— ${companyName}` : "");

      return {
        success: true,
        mobile: (account.mobile || "").replace(/\D/g, ""),
        message: waMessage,
      };
    },
  },
};
