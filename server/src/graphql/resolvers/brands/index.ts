import { Brand } from "../../../models/brands";

export const brandResolvers = {
  Query: {
    // Get all active brands for optional admin
    getBrands: async (_: any, { adminId }: { adminId?: string }) => {
      const query: any = { status: true };
      if (adminId) query.admin = adminId;
      return await Brand.find(query).populate("admin"); // ✅ FIXED
    },

    // Get one brand by id for optional admin
    getBrandById: async (_: any, { id, adminId }: { id: string; adminId?: string }) => {
      const query: any = { _id: id };
      if (adminId) query.admin = adminId;
      return await Brand.findOne(query).populate("admin"); // ✅ FIXED
    },

    // Get all deleted brands for optional admin
    getDeletedBrands: async (_: any, { adminId }: { adminId?: string }) => {
      const query: any = { status: false };
      if (adminId) query.admin = adminId;
      return await Brand.find(query).populate("admin"); // ✅ FIXED
    },
  },

  Mutation: {
    addBrand: async (_: any, { input }: any) => {
      const brand = await Brand.create(input);
      return await Brand.findById(brand._id).populate("admin");
    },

    editBrand: async (_: any, { id, input }: any) => {
      return await Brand.findByIdAndUpdate(id, input, { new: true }).populate("admin");
    },

    // Soft delete brand
    deleteBrand: async (_: any, { id }: any) => {
      const result = await Brand.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },

    // Restore brand
    resetBrand: async (_: any, { id }: any) => {
      const result = await Brand.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    },
  },
};

