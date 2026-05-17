import mongoose from "mongoose";
import { Payment } from "../../../models/payments";

export const paymentResolvers = {
  Query: {
    getPayments: async (_: any, args: { filter?: any }, context: any) => {
      const filter = args.filter || {};
      const query: any = { status: true };
      const { user } = context;

      // ✅ Role-based filtering
      if (user?.type === 'branch') {
        query.$or = [
          { createdby_type: 'branch', createdby_id: user?.id },
          { branchid: user?.branch_id || user?.id }
        ];
      } else if (user?.type === 'staff') {
        query.createdby_id = user?.id;
      }

      if (filter.adminid) query.adminid = new mongoose.Types.ObjectId(filter.adminid);
      if (filter.branchid) query.branchid = new mongoose.Types.ObjectId(filter.branchid);
      if (filter.type) query.type = filter.type;
      if (filter.partyid) query.partyid = new mongoose.Types.ObjectId(filter.partyid);
      if (filter.ledgerid) query.ledgerid = new mongoose.Types.ObjectId(filter.ledgerid);
      if (filter.paymentcode)
        query.paymentcode = { $regex: filter.paymentcode, $options: "i" };
      if (typeof filter.status === "boolean") query.status = filter.status;

      // Date filter
      if (filter.dateFrom || filter.dateTo) {
        query.paymentdate = {};
        if (filter.dateFrom) query.paymentdate.$gte = new Date(filter.dateFrom);
        if (filter.dateTo) query.paymentdate.$lte = new Date(filter.dateTo);
      }

      const result = await Payment.find(query)
        .populate("ledgerid")
        .populate("partyid")
        .lean();

      return result.map((r: any) => ({
        ...r,
        id: r._id.toString(),
        ledgerid: r.ledgerid
          ? {
            ...r.ledgerid,
            id: r.ledgerid._id?.toString()
          }
          : null,
        partyid: r.partyid
          ? {
            ...r.partyid,
            id: r.partyid._id?.toString()
          }
          : null,
      }));
    },

    getDeletedPayments: async (_: any, args: { filter?: any }, context: any) => {
      const filter = args.filter || {};
      const query: any = { status: false };
      const { user } = context;

      // ✅ Role-based filtering
      if (user?.type === 'branch') {
        query.$or = [
          { createdby_type: 'branch', createdby_id: user?.id },
          { branchid: user?.branch_id || user?.id }
        ];
      } else if (user?.type === 'staff') {
        query.createdby_id = user?.id;
      }

      if (filter.adminid) query.adminid = new mongoose.Types.ObjectId(filter.adminid);
      if (filter.branchid) query.branchid = new mongoose.Types.ObjectId(filter.branchid);
      if (filter.type) query.type = filter.type;
      if (filter.partyid) query.partyid = new mongoose.Types.ObjectId(filter.partyid);
      if (filter.ledgerid) query.ledgerid = new mongoose.Types.ObjectId(filter.ledgerid); // fixed
      if (filter.paymentcode)
        query.paymentcode = { $regex: filter.paymentcode, $options: "i" };

      if (filter.dateFrom || filter.dateTo) {
        query.paymentdate = {};
        if (filter.dateFrom) query.paymentdate.$gte = new Date(filter.dateFrom);
        if (filter.dateTo) query.paymentdate.$lte = new Date(filter.dateTo);
      }

      const result = await Payment.find(query)
        .populate("partyid")
        .populate("ledgerid")
        .lean();

      return result.map((r: any) => ({
        ...r,
        id: r._id.toString(),
        ledgerid: r.ledgerid
          ? {
            ...r.ledgerid,
            id: r.ledgerid._id?.toString()
          }
          : null,
        partyid: r.partyid
          ? {
            ...r.partyid,
            id: r.partyid._id?.toString()
          }
          : null,
      }));
    },

    getPaymentById: async (_: any, args: { id: string; adminid?: string }) => {
      if (!args.id) return null;

      const query: any = { _id: new mongoose.Types.ObjectId(args.id) };
      if (args.adminid) query.adminid = new mongoose.Types.ObjectId(args.adminid);

      const payment = await Payment.findOne(query)
        .populate("partyid")
        .populate("ledgerid")
        .lean();

      if (!payment) return null;

      return {
        ...payment,
        id: payment._id.toString(),

        ledgerid: payment.ledgerid
          ? {
            ...payment.ledgerid,
            id: payment.ledgerid._id?.toString(),
          }
          : null,

        partyid: payment.partyid
          ? {
            ...payment.partyid,
            id: payment.partyid._id?.toString(),
          }
          : null,
      };
    },
  },

  Mutation: {
    addPayment: async (_: any, { input }: any, context: any) => {
      // ✅ Extract user info from context and populate createdby fields
      const { user } = context;
      const createdbyData = {
        createdby_id: user?.id,
        createdby_name: user?.name || user?.email,
        createdby_type: user?.type || 'admin',
      };

      const created = await Payment.create({ ...input, ...createdbyData });

      const populated = await Payment.findById(created._id)
        .populate("ledgerid")
        .populate("partyid")
        .lean();

      if (!populated) {
        throw new Error("Payment not found after creation");
      }

      return {
        ...populated,
        id: populated._id.toString(),

        ledgerid: populated.ledgerid
          ? {
            ...populated.ledgerid,
            id: populated.ledgerid._id?.toString(),
          }
          : null,

        partyid: populated.partyid
          ? {
            ...populated.partyid,
            id: populated.partyid._id?.toString(),
          }
          : null,
      };
    },

    editPayment: async (_: any, { id, input }: any) => {
      const existing = await Payment.findById(id);
      if (!existing) throw new Error("Payment not found");

      await Payment.findByIdAndUpdate(id, input, { new: true });

      const updated = await Payment.findById(id)
        .populate("ledgerid")
        .populate("partyid")
        .lean();

      if (!updated) throw new Error("Payment not found after update");

      return {
        ...updated,
        id: updated._id.toString(),

        ledgerid: updated.ledgerid
          ? {
            ...updated.ledgerid,
            id: updated.ledgerid._id?.toString(),
          }
          : null,

        partyid: updated.partyid
          ? {
            ...updated.partyid,
            id: updated.partyid._id?.toString(),
          }
          : null,
      };
    },

    deletePayment: async (_: any, { id }: any) => {
      const result = await Payment.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },

    resetPayment: async (_: any, { id }: { id: string }) => {
      const result = await Payment.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    },
  },
};
