import { Size } from "../../../models/size";

export const sizeResolvers = {
  Query: {
    getSizes: async () => {
      const sizes = await Size.find();
      return sizes;
    },
    getSizeById: async (_: any, { id }: { id: string }) => {
      return await Size.findById(id);
    },
  },
  Mutation: {
    addSize: async (_: any, { input }: any) => {
      return await Size.create(input);
    },
    editSize: async (_: any, { id, input }: any) => {
      return await Size.findByIdAndUpdate(id, input, { new: true });
    },
    deleteSize: async (_: any, { id }: any) => {
      const result = await Size.findByIdAndDelete(id);
      return !!result;
    },
  },
};
