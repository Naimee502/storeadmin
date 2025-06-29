import { Model } from "../../../models/models";

export const modelResolvers = {
  Query: {
    // Get all active models, optionally filtered by admin
    getModels: async (_: any, { adminId }: { adminId?: string }) => {
      const filter: any = { status: true };
      if (adminId) filter.admin = adminId;
      return await Model.find(filter).populate("admin");
    },

    // Get all soft-deleted models, optionally filtered by admin
    getDeletedModels: async (_: any, { adminId }: { adminId?: string }) => {
      const filter: any = { status: false };
      if (adminId) filter.admin = adminId;
      return await Model.find(filter).populate("admin");
    },

    // Get single model by ID, optionally check admin
    getModelById: async (_: any, { id, adminId }: { id: string, adminId?: string }) => {
      const filter: any = { _id: id };
      if (adminId) filter.admin = adminId;
      return await Model.findOne(filter).populate("admin");
    },
  },

  Mutation: {
    // Add model with admin ref and return populated
    addModel: async (_: any, { input }: any) => {
      const model = await Model.create(input);
      return await Model.findById(model._id).populate("admin");
    },

    // Edit and return updated populated model
    editModel: async (_: any, { id, input }: any) => {
      return await Model.findByIdAndUpdate(id, input, { new: true }).populate("admin");
    },

    // Soft delete model
    deleteModel: async (_: any, { id }: any) => {
      const result = await Model.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },

    // Restore model
    resetModel: async (_: any, { id }: any) => {
      const result = await Model.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    },
  },
};
