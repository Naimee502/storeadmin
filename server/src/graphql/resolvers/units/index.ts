import { Unit } from "../../../models/units";

export const unitResolvers = {
  Query: {
    getUnits: async () => {
      const units = await Unit.find({ status: true });
      return units;
    },
    getDeletedUnits: async () => {
      const deletedUnits = await Unit.find({ status: false });
      return deletedUnits;
    },
    getUnitById: async (_: any, { id }: { id: string }) => {
      return await Unit.findById(id);
    },
  },
  Mutation: {
    addUnit: async (_: any, { input }: any) => {
      return await Unit.create(input);
    },
    editUnit: async (_: any, { id, input }: any) => {
      return await Unit.findByIdAndUpdate(id, input, { new: true });
    },
    deleteUnit: async (_: any, { id }: any) => {
      const result = await Unit.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },
    resetUnit: async (_: any, { id }: any) => {
      const result = await Unit.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    },
  },
};
