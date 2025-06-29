import { Category } from "../../../models/categories";

export const categoryResolvers = {
  Query: {
    getCategories: async (_: any, { adminId }: { adminId?: string }) => {
      const query: any = { status: true };
      if (adminId) query.admin = adminId;

      return await Category.find(query).populate("admin");
    },

    getCategoryById: async (_: any, { id, adminId }: { id: string, adminId?: string }) => {
      const query: any = { _id: id };
      if (adminId) query.admin = adminId;

      return await Category.findOne(query).populate("admin");
    },

    getDeletedCategories: async (_: any, { adminId }: { adminId?: string }) => {
      const query: any = { status: false };
      if (adminId) query.admin = adminId;

      return await Category.find(query).populate("admin");
    },
  },
  Mutation: {
    addCategory: async (_: any, { input }: any) => {
      const category = await Category.create(input);
      return await Category.findById(category._id).populate("admin");
    },  
    editCategory: async (_: any, { id, input }: any) => {
      const updatedCategory = await Category.findByIdAndUpdate(id, input, { new: true }).populate('admin');
      if (!updatedCategory) throw new Error("Category not found");
      return updatedCategory;
    },
    deleteCategory: async (_: any, { id }: any) => {
      const result = await Category.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },
    resetCategory: async (_: any, { id }: any) => {
      const result = await Category.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    },
  },
};
