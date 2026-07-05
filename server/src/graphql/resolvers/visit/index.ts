import mongoose from "mongoose";
import { Visit } from "../../../models/visit";

const populatePaths = ["salesmanid", "partyacc", "routeid"];

export const visitResolvers = {
  Query: {
    getVisits: async (_: any, { filter = {} }: { filter?: any }) => {
      const query: any = {};
      query.status = typeof filter.status === "boolean" ? filter.status : true;

      if (filter.adminid) query.adminid = new mongoose.Types.ObjectId(filter.adminid);
      if (filter.branchid) query.branchid = new mongoose.Types.ObjectId(filter.branchid);
      if (filter.salesmanid) query.salesmanid = new mongoose.Types.ObjectId(filter.salesmanid);
      if (filter.routeid) query.routeid = new mongoose.Types.ObjectId(filter.routeid);
      if (filter.partyacc) query.partyacc = new mongoose.Types.ObjectId(filter.partyacc);
      if (filter.day) query.day = filter.day;
      if (typeof filter.visited === "boolean") query.visited = filter.visited;

      if (filter.dateFrom || filter.dateTo) {
        query.visitdate = {};
        if (filter.dateFrom) query.visitdate.$gte = filter.dateFrom;
        if (filter.dateTo) query.visitdate.$lte = filter.dateTo;
      }

      return await Visit.find(query).populate(populatePaths).sort({ visitdate: -1, createdAt: -1 });
    },
  },

  Mutation: {
    addVisit: async (_: any, { input }: any, context: any) => {
      const { user } = context || {};
      const createdbyData = {
        createdby_id: input.createdby_id || user?.id,
        createdby_name: input.createdby_name || user?.name || user?.email,
        createdby_type: input.createdby_type || user?.type || "staff",
      };
      const created = await Visit.create({ ...input, ...createdbyData });
      return await Visit.findById(created._id).populate(populatePaths);
    },

    editVisit: async (_: any, { id, input }: any) => {
      return await Visit.findByIdAndUpdate(id, input, { new: true }).populate(populatePaths);
    },

    deleteVisit: async (_: any, { id }: any) => {
      const result = await Visit.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },
  },
};
