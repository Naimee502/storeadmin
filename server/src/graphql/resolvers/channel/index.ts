import { Channel } from "../../../models/channel";
import { StaffAccount } from "../../../models/staffaccounts";

export const channelResolvers = {
  Query: {
    getChannels: async (_: any, { adminId }: { adminId?: string }, context: any) => {
      const filter: any = { status: true };
      if (adminId) filter.admin = adminId;

      // Salesman filtering
      if (context.user && context.user.type === "staff") {
        const staff = await StaffAccount.findById(context.user.id);
        if (staff && staff.role === "salesman" && staff.assignedChannels.length > 0) {
          filter._id = { $in: staff.assignedChannels };
        }
      }

      return await Channel.find(filter).populate("admin");
    },
    getDeletedChannels: async (_: any, { adminId }: { adminId?: string }) => {
      const filter: any = { status: false };
      if (adminId) filter.admin = adminId;
      return await Channel.find(filter).populate("admin");
    },
    getChannelById: async (_: any, { id }: { id: string }) => {
      return await Channel.findById(id).populate("admin");
    },
  },

  Mutation: {
    createChannel: async (_: any, { input }: any) => {
      return await Channel.create(input);
    },
    updateChannel: async (_: any, { id, input }: any) => {
      return await Channel.findByIdAndUpdate(id, input, { new: true });
    },
    deleteChannel: async (_: any, { id }: any) => {
      const result = await Channel.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },
    resetChannel: async (_: any, { id }: any) => {
      const result = await Channel.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    },
  },
};
