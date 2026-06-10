import { Channel } from "../../../models/channel";

export const channelResolvers = {
  Query: {
    getChannels: async (_: any, { adminId }: { adminId?: string }, context: any) => {
      const filter: any = { status: true };
      if (adminId) filter.admin = adminId;

      // Channels are reference/config data (needed for hierarchy lookups and
      // party add) — return all for the admin; no salesman channel restriction.

      return await Channel.find(filter).populate("admin").populate("handlesChannels");
    },
    getDeletedChannels: async (_: any, { adminId }: { adminId?: string }) => {
      const filter: any = { status: false };
      if (adminId) filter.admin = adminId;
      return await Channel.find(filter).populate("admin").populate("handlesChannels");
    },
    getChannelById: async (_: any, { id }: { id: string }) => {
      return await Channel.findById(id).populate("admin").populate("handlesChannels");
    },
  },

  Mutation: {
    createChannel: async (_: any, { input }: any) => {
      const created = await Channel.create(input);
      return await Channel.findById(created._id).populate("admin").populate("handlesChannels");
    },
    updateChannel: async (_: any, { id, input }: any) => {
      return await Channel.findByIdAndUpdate(id, input, { new: true })
        .populate("admin").populate("handlesChannels");
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
