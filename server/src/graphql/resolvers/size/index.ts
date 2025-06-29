import { Size } from "../../../models/size";

export const sizeResolvers = {
  Query: {
    // Get all active sizes (optionally filtered by admin)
    getSizes: async (_: any, { adminId }: { adminId?: string }) => {
      const filter: any = { status: true };
      if (adminId) filter.admin = adminId;
      return await Size.find(filter).populate("admin");
    },

    // Get deleted sizes (optionally filtered by admin)
    getDeletedSizes: async (_: any, { adminId }: { adminId?: string }) => {
      const filter: any = { status: false };
      if (adminId) filter.admin = adminId;
      return await Size.find(filter).populate("admin");
    },

    // Get one size by ID (optionally check for admin)
    getSizeById: async (_: any, { id, adminId }: { id: string, adminId?: string }) => {
      const filter: any = { _id: id };
      if (adminId) filter.admin = adminId;
      return await Size.findOne(filter).populate("admin");
    },
  },

  Mutation: {
    // Add a size with admin reference
    addSize: async (_: any, { input }: any) => {
      const size = await Size.create(input);
      return await Size.findById(size._id).populate("admin");
    },

    // Edit and return populated size
    editSize: async (_: any, { id, input }: any) => {
      return await Size.findByIdAndUpdate(id, input, { new: true }).populate("admin");
    },

    deleteSize: async (_: any, { id }: any) => {
      const result = await Size.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },

    resetSize: async (_: any, { id }: any) => {
      const result = await Size.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    },
  },
};
