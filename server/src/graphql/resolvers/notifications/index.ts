import { Notification } from "../../../models/notifications";
import { sendOutstandingReminder } from "../../../utils/outstandingreminder";

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
      return sendOutstandingReminder({
        adminid,
        branchid,
        partyid,
        amount,
        pendingBills,
        overdueDays,
        dueDate,
      });
    },
  },
};
