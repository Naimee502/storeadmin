import { Unit } from "../../../models/units";

export const unitResolvers = {
  Query: {
    // Get all active units (optionally filtered by admin)
    getUnits: async (_: any, { adminId }: { adminId?: string }) => {
      const filter: any = { status: true };
      if (adminId) filter.admin = adminId;
      return await Unit.find(filter).populate("admin");
    },

    // Get deleted units (optionally filtered by admin)
    getDeletedUnits: async (_: any, { adminId }: { adminId?: string }) => {
      const filter: any = { status: false };
      if (adminId) filter.admin = adminId;
      return await Unit.find(filter).populate("admin");
    },

    // Get one unit by ID (optionally filter by admin)
    getUnitById: async (_: any, { id, adminId }: { id: string; adminId?: string }) => {
      const filter: any = { _id: id };
      if (adminId) filter.admin = adminId;
      return await Unit.findOne(filter).populate("admin");
    },
  },

  Mutation: {
    addUnit: async (_: any, { input }: any) => {
      const unit = await Unit.create(input);
      return await Unit.findById(unit._id).populate("admin");
    },

    editUnit: async (_: any, { id, input }: any) => {
      return await Unit.findByIdAndUpdate(id, input, { new: true }).populate("admin");
    },

    deleteUnit: async (_: any, { id }: any) => {
      const result = await Unit.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },

    resetUnit: async (_: any, { id }: any) => {
      const result = await Unit.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    },
  },
};
