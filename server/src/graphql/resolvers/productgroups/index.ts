import { ProductGroup } from "../../../models/productgroups";

export const productGroupResolvers = {
  Query: {
    getProductGroups: async () => {
      const productGroups = await ProductGroup.find({ status: true });
      return productGroups;
    },
    getProductGroupById: async (_: any, { id }: { id: string }) => {
      return await ProductGroup.findById(id);
    },
  },
  Mutation: {
    addProductGroup: async (_: any, { input }: any) => {
      return await ProductGroup.create(input);
    },
    editProductGroup: async (_: any, { id, input }: any) => {
      return await ProductGroup.findByIdAndUpdate(id, input, { new: true });
    },
    deleteProductGroup: async (_: any, { id }: any) => {
      const result = await ProductGroup.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },
  },
};
