import { Notification } from "../../../models/notifications";

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
  },
};
