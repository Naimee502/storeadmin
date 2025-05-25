import { Category } from "../../../models/categories";

export const categoryResolvers = {
  Query: {
    getCategories: async () => {
        const categories = await Category.find();
        return categories;
    },
    getCategoryById: async (_: any, { id }: { id: string }) => {
      return await Category.findById(id);
    },
  },
  Mutation: {
    addCategory: async (_: any, { input }: any) => await Category.create(input),
    editCategory: async (_: any, { id, input }: any) => {
      return await Category.findByIdAndUpdate(id, input, { new: true });
    },
    deleteCategory: async (_: any, { id }: any) => {
      const result = await Category.findByIdAndDelete(id);
      return !!result;
    },
  },
};
