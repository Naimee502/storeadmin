import { Branch } from "../../../models/branches";

export const branchResolvers = {
  Query: {
    // Get all active branches (status: true)
    getBranches: async () => {
      const branches = await Branch.find({ status: true });
      return branches;
    },
    // Get one branch by id
    getBranch: async (_: any, { id }: { id: string }) => await Branch.findById(id),

    // New: Get all deleted (soft deleted) branches (status: false)
    getDeletedBranches: async () => {
      const branches = await Branch.find({ status: false });
      return branches;
    },
  },
  Mutation: {
    addBranch: async (_: any, { input }: any) => await Branch.create(input),

    addBranches: async (_: any, { inputs }: { inputs: any[] }) => {
      const createdBranches = await Branch.insertMany(inputs);
      return createdBranches;
    },

    editBranch: async (_: any, { id, input }: any) =>
      await Branch.findByIdAndUpdate(id, input, { new: true }),

    // Soft delete: mark status as false
    deleteBranch: async (_: any, { id }: any) => {
      const result = await Branch.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },

    // New: Reset branch to default values
    resetBranch: async (_: any, { id }: any) => {
       const result = await Branch.findByIdAndUpdate(id, { status: true }, { new: true });
       return !!result;
    },
  },
};
