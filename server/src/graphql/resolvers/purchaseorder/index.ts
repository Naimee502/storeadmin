import { PurchaseOrder } from "../../../models/purchaseorder";
import { PurchaseInvoice } from "../../../models/purchaseinvoice";
import { isPurchaseOrderOnlyMode, adminIdOf } from "../../../utils/ordermode";
import { getInvoiceOutstanding } from "../../../utils/allocation";

// Canonical status for a purchase order, deriving one for older records that
// were written before orderStatus existed.
const deriveOrderStatus = (o: any): string => {
  if (o?.orderStatus) return o.orderStatus;
  if (o?.cancelStatus === "cancelled") return "cancelled";
  if (o?.isConverted) return "confirmed";
  return "pending";
};

// Create the hidden Purchase Invoice for a purchase-order-only admin. Runs
// BEFORE the status is written so a failure surfaces as "confirm failed"
// rather than leaving a confirmed order with no payable behind it. No-op when
// invoicing is on, or the order is already converted / cancelled.
const autoInvoiceIfOrderOnly = async (order: any, context: any) => {
  if (!order) return;
  if (order.isConverted) {
    console.log(`[order-only] PO-${order.billnumber}: already converted, nothing to do`);
    return;
  }
  if (order.cancelStatus === "cancelled") return;
  const orderOnly = await isPurchaseOrderOnlyMode(order.adminid);
  console.log(
    `[order-only] PO-${order.billnumber}: adminid=${order.adminid} orderOnlyMode=${orderOnly}` +
    (orderOnly ? " → creating hidden Purchase Invoice" : " → purchaseinvoice module is ON, no auto-invoice")
  );
  if (!orderOnly) return;
  // Imported lazily: the purchase-invoice resolver imports the PurchaseOrder
  // model, so a top-level import here would close a require cycle.
  const { purchaseInvoiceResolvers } = await import("../purchaseinvoice");
  // autoPayment:false — the invoice mirrors the order exactly (same payment
  // type), but no payment is posted. Otherwise the bill would settle itself the
  // instant the order is confirmed and leave nothing to pay the supplier.
  await (purchaseInvoiceResolvers as any).Mutation.convertPurchaseOrderToInvoice(
    null, { id: String(order._id), autoPayment: false }, context
  );
};

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
  partyacc: toSimpleRef(order.partyacc, ["accountname", "mobile", "address", "city", "state", "gstnumber"]),
  createdby_id: order.createdby_id,
  createdby_name: order.createdby_name,
  createdby_type: order.createdby_type,
  isConverted: order.isConverted,
  orderStatus: deriveOrderStatus(order),

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
      const query: any = { status: true };
      const { user } = context;

      // In purchase-order-only mode every confirmed order is converted behind
      // the scenes, so the default "hide converted" filter would empty the list
      // the admin actually works in.
      const orderOnly = await isPurchaseOrderOnlyMode(
        filter.adminid || user?.adminid || (user?.type === "admin" ? user?.id : null)
      );
      if (filter.isConverted !== undefined) {
        query.isConverted = filter.isConverted;
      } else if (!filter.includeConverted && !orderOnly) {
        query.isConverted = false;
      }

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
      const { user } = context;
      // "Deleted" normally also swept up converted orders, since those had left
      // the live list. In purchase-order-only mode EVERY confirmed order is
      // converted, so that rule would dump the admin's whole order book in here
      // — there, deleted means deleted and nothing else.
      const orderOnly = await isPurchaseOrderOnlyMode(
        filter.adminid || user?.adminid || (user?.type === "admin" ? user?.id : null)
      );
      const query: any = orderOnly
        ? { status: false }
        : { $or: [{ status: false }, { isConverted: true }] };

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
        // Purchase-order-only admins never see the invoice behind the order, so
        // "convert to invoice" language would mean nothing to them.
        throw new Error(
          (await isPurchaseOrderOnlyMode(existing.adminid))
            ? "This order is already confirmed — stock and the supplier ledger have been posted, so it can no longer be cancelled. Record a Purchase Return against it instead."
            : "Order already converted to invoice. Create a Purchase Return against the invoice instead."
        );
      }
      if (existing.cancelStatus === "cancelled") {
        throw new Error("Order is already cancelled");
      }
      const updated = await PurchaseOrder.findByIdAndUpdate(
        id,
        { cancelStatus: "cancelled", orderStatus: "cancelled", cancelReason: reason || "", cancelledAt: new Date() },
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
        { cancelStatus: "open", orderStatus: existing.isConverted ? "confirmed" : "pending", cancelReason: null, cancelledAt: null },
        { new: true }
      ).populate(populateFields).lean();
      return updated ? formatOrder(updated) : null;
    },

    // ── Fulfilment transitions (order is the source of truth) ──
    // A purchase has no dispatch leg of its own, so "received" is the single
    // step where a sales order has dispatched + delivered.
    confirmPurchaseOrder: async (_: any, { id }: any, context: any) => {
      const existing = await PurchaseOrder.findById(id).lean() as any;
      if (!existing) throw new Error("Purchase Order not found");
      if (existing.cancelStatus === "cancelled") throw new Error("Order is cancelled.");
      // Purchase-order-only admins get their invoice here, silently, so the
      // payable exists and Payment Out can settle against it.
      await autoInvoiceIfOrderOnly(existing, context);
      const updated = await PurchaseOrder.findByIdAndUpdate(
        id, { orderStatus: "confirmed" }, { new: true }
      ).populate(populateFields).lean();
      if (!updated) throw new Error("Purchase Order not found");
      return formatOrder(updated);
    },

    markPurchaseOrderReceived: async (_: any, { id, byId, byName, byType }: any, context: any) => {
      const existing = await PurchaseOrder.findById(id).lean() as any;
      if (!existing) throw new Error("Purchase Order not found");
      if (existing.cancelStatus === "cancelled") throw new Error("Order is cancelled.");
      await autoInvoiceIfOrderOnly(existing, context);
      const user = context?.user;
      const updated = await PurchaseOrder.findByIdAndUpdate(
        id,
        {
          orderStatus: "received",
          receivedAt: new Date(),
          receivedById: byId || user?.id || null,
          receivedByName: byName || user?.name || user?.email || null,
          receivedByType: byType || user?.type || null,
        },
        { new: true }
      ).populate(populateFields).lean();
      if (!updated) throw new Error("Purchase Order not found");
      return formatOrder(updated);
    },
  },

  // When an order has been converted, expose the real INVOICE number — except
  // for a purchase-order-only business, whose users have never seen an invoice
  // number and would only be confused by it. Same rule as the sales side.
  PurchaseOrder: {
    invoicenumber: async (parent: any) => {
      try {
        if (!parent?.isConverted) return null;
        if (await isPurchaseOrderOnlyMode(adminIdOf(parent.adminid))) return null;
        const inv = await PurchaseInvoice.findOne({ sourceorderid: parent.id })
          .select("billnumber")
          .lean() as any;
        return inv?.billnumber ?? null;
      } catch (e) { return null; }
    },
    // What is still payable on the invoice this order became. 0 until billed.
    outstanding: async (parent: any) => {
      try {
        if (!parent?.isConverted) return 0;
        const inv = await PurchaseInvoice.findOne({ sourceorderid: parent.id })
          .select("_id")
          .lean() as any;
        if (!inv) return 0;
        return await getInvoiceOutstanding({ invoiceid: inv._id, invoicemodel: "PurchaseInvoice" });
      } catch (e) { return 0; }
    },
  },
};
