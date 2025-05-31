import { Brand } from "../../../models/brands";

export const brandResolvers = {
  Query: {
    // Get all active brands
    getBrands: async () => {
      const brands = await Brand.find({ status: true });
      return brands;
    },
    // Get one brand by id
    getBrandById: async (_: any, { id }: { id: string }) => {
      return await Brand.findById(id);
    },
    // Get all deleted (soft deleted) brands
    getDeletedBrands: async () => {
      const brands = await Brand.find({ status: false });
      return brands;
    },
  },
  Mutation: {
    addBrand: async (_: any, { input }: any) => {
      return await Brand.create(input);
    },
    editBrand: async (_: any, { id, input }: any) => {
      return await Brand.findByIdAndUpdate(id, input, { new: true });
    },
    // Soft delete brand (mark status as false)
    deleteBrand: async (_: any, { id }: any) => {
      const result = await Brand.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },
    // Reset brand (mark status as true)
    resetBrand: async (_: any, { id }: any) => {
      const result = await Brand.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    },
  },
};

