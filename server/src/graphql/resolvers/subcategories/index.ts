import { SubCategory } from "../../../models/subcategories";

export const subCategoryResolvers = {
  Query: {
    getSubCategories: async (_: any, { adminId, categoryId }: { adminId?: string; categoryId?: string }) => {
      const query: any = { status: true };
      if (adminId) query.admin = adminId;
      if (categoryId) query.category = categoryId;

      return await SubCategory.find(query).populate("admin").populate("category");
    },

    getSubCategoryById: async (_: any, { id, adminId }: { id: string; adminId?: string }) => {
      const query: any = { _id: id };
      if (adminId) query.admin = adminId;

      return await SubCategory.findOne(query).populate("admin").populate("category");
    },

    getDeletedSubCategories: async (_: any, { adminId, categoryId }: { adminId?: string; categoryId?: string }) => {
      const query: any = { status: false };
      if (adminId) query.admin = adminId;
      if (categoryId) query.category = categoryId;

      return await SubCategory.find(query).populate("admin").populate("category");
    },
  },

  Mutation: {
    addSubCategory: async (_: any, { input }: any) => {
      const subcategory = await SubCategory.create(input);
      return await SubCategory.findById(subcategory._id).populate("admin").populate("category");
    },

    editSubCategory: async (_: any, { id, input }: any) => {
      const updatedSubCategory = await SubCategory.findByIdAndUpdate(id, input, { new: true })
        .populate("admin")
        .populate("category");

      if (!updatedSubCategory) throw new Error("SubCategory not found");
      return updatedSubCategory;
    },

    deleteSubCategory: async (_: any, { id }: any) => {
      const result = await SubCategory.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },

    resetSubCategory: async (_: any, { id }: any) => {
      const result = await SubCategory.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    },
  },
};
