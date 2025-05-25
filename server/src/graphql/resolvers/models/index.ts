import { Model } from "../../../models/models";

export const modelResolvers = {
  Query: {
    getModels: async () => {
      const models = await Model.find();
      return models;
    },
    getModelById: async (_: any, { id }: { id: string }) => {
      return await Model.findById(id);
    },
  },
  Mutation: {
    addModel: async (_: any, { input }: any) => {
      return await Model.create(input);
    },
    editModel: async (_: any, { id, input }: any) => {
      return await Model.findByIdAndUpdate(id, input, { new: true });
    },
    deleteModel: async (_: any, { id }: any) => {
      const result = await Model.findByIdAndDelete(id);
      return !!result;
    },
  },
};
