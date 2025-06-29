import { ProductGroup } from "../../../models/productgroups";

export const productGroupResolvers = {
  Query: {
    // Get all active product groups, optionally filtered by admin
    getProductGroups: async (_: any, { adminId }: { adminId?: string }) => {
      const filter: any = { status: true };
      if (adminId) filter.admin = adminId;
      return await ProductGroup.find(filter).populate("admin");
    },

    // Get all soft-deleted product groups, optionally filtered by admin
    getDeletedProductGroups: async (_: any, { adminId }: { adminId?: string }) => {
      const filter: any = { status: false };
      if (adminId) filter.admin = adminId;
      return await ProductGroup.find(filter).populate("admin");
    },

    // Get one product group by ID, optionally filtered by admin
    getProductGroupById: async (_: any, { id, adminId }: { id: string; adminId?: string }) => {
      const filter: any = { _id: id };
      if (adminId) filter.admin = adminId;
      return await ProductGroup.findOne(filter).populate("admin");
    },
  },

  Mutation: {
    // Add product group with admin ref and return populated
    addProductGroup: async (_: any, { input }: any) => {
      const group = await ProductGroup.create(input);
      return await ProductGroup.findById(group._id).populate("admin");
    },

    // Edit and return populated product group
    editProductGroup: async (_: any, { id, input }: any) => {
      return await ProductGroup.findByIdAndUpdate(id, input, { new: true }).populate("admin");
    },

    // Soft delete (status = false)
    deleteProductGroup: async (_: any, { id }: any) => {
      const result = await ProductGroup.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },

    // Restore (status = true)
    resetProductGroup: async (_: any, { id }: any) => {
      const result = await ProductGroup.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    },
  },
};
