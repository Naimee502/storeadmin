import { Brand } from "../../../models/brands";

export const brandResolvers = {
  Query: {
    getBrands: async () => {
      const brands = await Brand.find({ status: true });
      return brands;
    },
    getBrandById: async (_: any, { id }: { id: string }) => {
      return await Brand.findById(id);
    },
  },
  Mutation: {
    addBrand: async (_: any, { input }: any) => {
      return await Brand.create(input);
    },
    editBrand: async (_: any, { id, input }: any) => {
      return await Brand.findByIdAndUpdate(id, input, { new: true });
    },
    deleteBrand: async (_: any, { id }: any) => {
      const result = await Brand.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },
  },
};
