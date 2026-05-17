import { SalesOrder } from "../../../models/salesorder";

// ✅ Helper to convert populated Mongoose docs to simple ref objects
const toSimpleRef = (doc: any, keys: string[] = ["name"]) => {
  if (!doc) return null;
  const ref: any = { id: doc._id?.toString() };
  keys.forEach(key => {
    ref[key] = doc[key] ?? doc.name ?? null;
  });
  return ref;
};

// ✅ Fields to populate
const populateFields = [
  "salesmenid",
  "partyacc",
  "productservice.productserviceid",
  "productservice.salesunitid",
  "productservice.salesaccountid",
  "productservice.purchaseaccountid",
  "productservice.serviceaccountid",
];

// ✅ Format order function
const formatOrder = (order: any) => ({
  ...order,
  id: order._id.toString(),
  salesmenid: toSimpleRef(order.salesmenid, ["name"]),
  partyacc: toSimpleRef(order.partyacc, ["accountname", "mobile"]),
  createdby_id: order.createdby_id,
  createdby_name: order.createdby_name,
  createdby_type: order.createdby_type,
  isConverted: order.isConverted,

  productservice: order.productservice?.map((ps: any) => {
    const variant = ps.productserviceid?.productvariants?.find(
      (v: any) => String(v._id) === String(ps.variantid)
    );

    return {
      ...ps,
      productserviceid: toSimpleRef(ps.productserviceid, ["name"]),
      variantid: variant ? { id: variant._id.toString(), name: variant.name } : null,
      salesunitid: toSimpleRef(ps.salesunitid, ["unitname"]),
      salesaccountid: toSimpleRef(ps.salesaccountid, ["ledgername"]),
      purchaseaccountid: toSimpleRef(ps.purchaseaccountid, ["ledgername"]),
      serviceaccountid: toSimpleRef(ps.serviceaccountid, ["ledgername"]),
      qty: ps.qty ?? 0,
      unitqty: ps.unitqty ?? 1,
      gst: ps.gst ?? 0,
      rate: ps.rate ?? 0,
      amount: ps.amount ?? 0,
      discount: ps.discount ?? 0,
    };
  }) ?? []
});

// ✅ GraphQL resolvers
export const salesOrderResolvers = {
  Query: {
    getSalesOrders: async (_: any, { filter = {} }: { filter?: any }, context: any) => {
      const query: any = { status: true, isConverted: filter.isConverted !== undefined ? filter.isConverted : false };
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

      if (filter.branchid) query.branchid = filter.branchid;
      if (filter.adminid) query.adminid = filter.adminid;
      if (filter.salesmenid) query.salesmenid = filter.salesmenid;
      if (filter.paymenttype) query.paymenttype = filter.paymenttype;
      if (filter.taxorsupplytype) query.taxorsupplytype = filter.taxorsupplytype;
      if (filter.billtype) query.billtype = filter.billtype;
      if (filter.ordertype) query.ordertype = filter.ordertype;
      if (filter.partyacc) query.partyacc = filter.partyacc;

      if (filter.billdateFrom || filter.billdateTo) {
        query.billdate = {};
        if (filter.billdateFrom) query.billdate.$gte = filter.billdateFrom;
        if (filter.billdateTo) query.billdate.$lte = filter.billdateTo;
      }

      const orders = await SalesOrder.find(query)
        .populate(populateFields)
        .lean();

      return orders.map(formatOrder);
    },

    getDeletedSalesOrders: async (_: any, { filter = {} }: { filter?: any }, context: any) => {
      const query: any = { $or: [{ status: false }, { isConverted: true }] };
      const { user } = context;

      // ✅ Role-based filtering
      if (user?.type === 'branch') {
        query.$or = [
          { createdby_type: 'branch', createdby_id: user?.id },
          { branchid: user?.branch_id || user?.id }
        ];
      } else if (user?.type === 'staff') {
        query.createdby_id = user?.id;
      } else {
        query.$or = [{ status: false }, { isConverted: true }];
      }

      if (filter.branchid) query.branchid = filter.branchid;
      if (filter.adminid) query.adminid = filter.adminid;

      const orders = await SalesOrder.find(query)
        .populate(populateFields)
        .lean();

      return orders.map(formatOrder);
    },

    getSalesOrderById: async (_: any, { id }: { id: string }) => {
      const order = await SalesOrder.findById(id)
        .populate(populateFields)
        .lean();
      return order ? formatOrder(order) : null;
    },
  },

  Mutation: {
    addSalesOrder: async (_: any, { input }: any, context: any) => {
      // ✅ Extract user info from context and populate createdby fields
      const { user } = context;
      const createdbyData = {
        createdby_id: user?.id,
        createdby_name: user?.name || user?.email,
        createdby_type: user?.type || 'admin',
      };

      const created = await SalesOrder.create({ ...input, ...createdbyData });
      return await SalesOrder.findById(created._id)
        .populate(populateFields)
        .lean()
        .then(formatOrder);
    },

    editSalesOrder: async (_: any, { id, input }: any) => {
      const updated = await SalesOrder.findByIdAndUpdate(id, input, { new: true })
        .populate(populateFields)
        .lean();
      return updated ? formatOrder(updated) : null;
    },

    deleteSalesOrder: async (_: any, { id }: { id: string }) => {
      return !!(await SalesOrder.findByIdAndUpdate(id, { status: false }));
    },

    resetSalesOrder: async (_: any, { id }: { id: string }) => {
      return !!(await SalesOrder.findByIdAndUpdate(id, { status: true }));
    },

    // Cancel an open order before it gets converted to a Sales Invoice.
    // Refuses if the order has already been converted, since there is no
    // safe automatic reversal — the invoice would need to be returned via
    // the SalesReturn flow instead.
    cancelSalesOrder: async (_: any, { id, reason }: { id: string; reason?: string }) => {
      const existing = await SalesOrder.findById(id).lean() as any;
      if (!existing) throw new Error("Sales Order not found");
      if (existing.isConverted) {
        throw new Error("Order already converted to invoice. Create a Sales Return against the invoice instead.");
      }
      if (existing.cancelStatus === "cancelled") {
        throw new Error("Order is already cancelled");
      }
      const updated = await SalesOrder.findByIdAndUpdate(
        id,
        { cancelStatus: "cancelled", cancelReason: reason || "", cancelledAt: new Date() },
        { new: true }
      ).populate(populateFields).lean();
      return updated ? formatOrder(updated) : null;
    },

    // Re-open a cancelled order if it was cancelled by mistake.
    reopenSalesOrder: async (_: any, { id }: { id: string }) => {
      const existing = await SalesOrder.findById(id).lean() as any;
      if (!existing) throw new Error("Sales Order not found");
      if (existing.cancelStatus !== "cancelled") {
        throw new Error("Order is not in cancelled state");
      }
      const updated = await SalesOrder.findByIdAndUpdate(
        id,
        { cancelStatus: "open", cancelReason: null, cancelledAt: null },
        { new: true }
      ).populate(populateFields).lean();
      return updated ? formatOrder(updated) : null;
    },
  },
};
