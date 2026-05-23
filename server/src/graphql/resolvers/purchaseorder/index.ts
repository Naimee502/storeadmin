import { PurchaseOrder } from "../../../models/purchaseorder";

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
  "purchasemenid",
  "partyacc",
  "productservice.productserviceid",
  "productservice.purchaseunitid",
  "productservice.salesaccountid",
  "productservice.purchaseaccountid",
  "productservice.serviceaccountid",
  "othercharges.ledgerid",
];

// ✅ Format order function
const formatOrder = (order: any) => ({
  ...order,
  id: order._id.toString(),
  purchasemenid: toSimpleRef(order.purchasemenid, ["name"]),
  partyacc: toSimpleRef(order.partyacc, ["accountname", "mobile"]),
  createdby_id: order.createdby_id,
  createdby_name: order.createdby_name,
  createdby_type: order.createdby_type,
  isConverted: order.isConverted,

  othercharges: order.othercharges?.map((oc: any) => ({
    ...oc,
    ledgerid: toSimpleRef(oc.ledgerid, ["ledgername"])
  })) ?? [],

  productservice: order.productservice?.map((ps: any) => {
    const variant = ps.productserviceid?.productvariants?.find(
      (v: any) => String(v._id) === String(ps.variantid)
    );

    return {
      ...ps,
      productserviceid: toSimpleRef(ps.productserviceid, ["name"]),
      variantid: variant ? { id: variant._id.toString(), name: variant.name } : null,
      purchaseunitid: toSimpleRef(ps.purchaseunitid, ["unitname"]),
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
export const purchaseOrderResolvers = {
  Query: {
    getPurchaseOrders: async (_: any, { filter = {} }: { filter?: any }, context: any) => {
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
      if (filter.purchasemenid) query.purchasemenid = filter.purchasemenid;
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

      const orders = await PurchaseOrder.find(query)
        .populate(populateFields)
        .lean();

      return orders.map(formatOrder);
    },

    getDeletedPurchaseOrders: async (_: any, { filter = {} }: { filter?: any }, context: any) => {
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

      const orders = await PurchaseOrder.find(query)
        .populate(populateFields)
        .lean();

      return orders.map(formatOrder);
    },

    getPurchaseOrderById: async (_: any, { id }: { id: string }) => {
      const order = await PurchaseOrder.findById(id)
        .populate(populateFields)
        .lean();
      return order ? formatOrder(order) : null;
    },
  },

  Mutation: {
    addPurchaseOrder: async (_: any, { input }: any, context: any) => {
      try {
        // ✅ Extract user info from context and populate createdby fields
        const { user } = context;
        const createdbyData = {
          createdby_id: user?.id,
          createdby_name: input.createdby_name || user?.name || user?.email,
          createdby_type: user?.type || input.createdby_type || 'admin',
        };

        console.log("=== Purchase Order Create ===");
        console.log("User from context:", user);
        console.log("CreatedbyData:", createdbyData);

        const created = await PurchaseOrder.create({ ...input, ...createdbyData });

        console.log("Created Purchase Order:", {
          id: created._id,
          createdby_id: created.createdby_id,
          createdby_name: created.createdby_name,
          createdby_type: created.createdby_type
        });

        return await PurchaseOrder.findById(created._id)
          .populate(populateFields)
          .lean()
          .then(formatOrder);
      } catch (error: any) {
        console.error("=== ERROR Creating Purchase Order ===");
        console.error("Error message:", error.message);
        console.error("Full error:", error);
        throw error;
      }
    },

    editPurchaseOrder: async (_: any, { id, input }: any) => {
      const updated = await PurchaseOrder.findByIdAndUpdate(id, input, { new: true })
        .populate(populateFields)
        .lean();
      return updated ? formatOrder(updated) : null;
    },

    deletePurchaseOrder: async (_: any, { id }: { id: string }) => {
      return !!(await PurchaseOrder.findByIdAndUpdate(id, { status: false }));
    },

    resetPurchaseOrder: async (_: any, { id }: { id: string }) => {
      return !!(await PurchaseOrder.findByIdAndUpdate(id, { status: true }));
    },

    cancelPurchaseOrder: async (_: any, { id, reason }: { id: string; reason?: string }) => {
      const existing = await PurchaseOrder.findById(id).lean() as any;
      if (!existing) throw new Error("Purchase Order not found");
      if (existing.isConverted) {
        throw new Error("Order already converted to invoice. Create a Purchase Return against the invoice instead.");
      }
      if (existing.cancelStatus === "cancelled") {
        throw new Error("Order is already cancelled");
      }
      const updated = await PurchaseOrder.findByIdAndUpdate(
        id,
        { cancelStatus: "cancelled", cancelReason: reason || "", cancelledAt: new Date() },
        { new: true }
      ).populate(populateFields).lean();
      return updated ? formatOrder(updated) : null;
    },

    reopenPurchaseOrder: async (_: any, { id }: { id: string }) => {
      const existing = await PurchaseOrder.findById(id).lean() as any;
      if (!existing) throw new Error("Purchase Order not found");
      if (existing.cancelStatus !== "cancelled") {
        throw new Error("Order is not in cancelled state");
      }
      const updated = await PurchaseOrder.findByIdAndUpdate(
        id,
        { cancelStatus: "open", cancelReason: null, cancelledAt: null },
        { new: true }
      ).populate(populateFields).lean();
      return updated ? formatOrder(updated) : null;
    },
  },
};
