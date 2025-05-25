import { Branch } from "../../../models/branches";

export const branchResolvers = {
  Query: {
    getBranches: async () => {
      const branches = await Branch.find();
      return branches;
    },
    getBranch: async (_: any, { id }: { id: string }) => await Branch.findById(id),
  },
  Mutation: {
    addBranch: async (_: any, { input }: any) => await Branch.create(input),

    addBranches: async (_: any, { inputs }: { inputs: any[] }) => {
      const createdBranches = await Branch.insertMany(inputs);
      return createdBranches;
    },

    editBranch: async (_: any, { id, input }: any) =>
      await Branch.findByIdAndUpdate(id, input, { new: true }),

    deleteBranch: async (_: any, { id }: any) => {
      const result = await Branch.findByIdAndDelete(id);
      return !!result;
    },
  },
};
