import { Branch } from "../../../models/branches";

export const branchResolvers = {
  Query: {
    // Get all active branches (optionally filter by admin)
    getBranches: async (_: any, { adminId }: { adminId?: string }) => {
      const filter: any = { status: true };
      if (adminId) filter.admin = adminId;

      return await Branch.find(filter).populate("admin");
    },

    // Get one branch (optionally ensure admin owns it)
    getBranch: async (_: any, { id, adminId }: { id: string; adminId?: string }) => {
      const filter: any = { _id: id };
      if (adminId) filter.admin = adminId;

      return await Branch.findOne(filter).populate("admin");
    },

    // Get deleted branches (optionally filter by admin)
    getDeletedBranches: async (_: any, { adminId }: { adminId?: string }) => {
      const filter: any = { status: false };
      if (adminId) filter.admin = adminId;

      return await Branch.find(filter).populate("admin");
    },
  },

  Mutation: {
    addBranch: async (_: any, { input }: any) => {
      const branch = await Branch.create(input);
      return await Branch.findById(branch._id).populate('admin'); 
    },

    addBranches: async (_: any, { inputs }: { inputs: any[] }) => {
      const createdBranches = await Branch.insertMany(inputs);
      const branchIds = createdBranches.map(branch => branch._id);
      return await Branch.find({ _id: { $in: branchIds } }).populate('admin'); 
    },

    editBranch: async (_: any, { id, input }: any) =>
      await Branch.findByIdAndUpdate(id, input, { new: true }).populate('admin'), 

    deleteBranch: async (_: any, { id }: any) => {
      const result = await Branch.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },

    resetBranch: async (_: any, { id }: any) => {
      const result = await Branch.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    },
  },
};
