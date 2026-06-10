import { SalesOrder } from "../../../models/salesorder";
import { StaffAccount } from "../../../models/staffaccounts";
import { SalesInvoice } from "../../../models/salesinvoice";
import { Account } from "../../../models/accounts";

// Recursively collect all party ids under a root party (assignaccountid chain).
// Used for channel downline: a wholesaler can see its retailers' orders, etc.
const getDownlinePartyIds = async (rootId: any): Promise<string[]> => {
  const out: string[] = [];
  let frontier = [String(rootId)];
  // Guard against cycles / runaway depth.
  for (let depth = 0; depth < 6 && frontier.length; depth++) {
    const children = await Account.find({ assignaccountid: { $in: frontier }, status: true })
      .select("_id")
      .lean();
    const ids = children.map((c: any) => c._id.toString()).filter((id) => !out.includes(id));
    if (!ids.length) break;
    out.push(...ids);
    frontier = ids;
  }
  return out;
};
import { ChargeRule } from "../../../models/chargerule";
import { AdminSettings } from "../../../models/adminsettings";

// Evaluate the admin's active charge rules (Amazon/Flipkart-style) against an
// incoming order and return the auto-charge lines + their grand total. Used by
// addSalesOrder so app AND website orders pick up delivery/handling/COD fees
// automatically, with no client-side logic.
const computeAutoCharges = async (input: any, creatorType: string) => {
  const result = { lines: [] as any[], total: 0 };
  try {
    const rules = await ChargeRule.find({ adminid: input.adminid, status: true, active: true })
      .sort({ priority: 1, createdAt: 1 })
      .lean();
    if (!rules.length) return result;

    // Order base used for thresholds = product subtotal (pre-charges).
    const base = Number(input.subtotal ?? input.totalamount ?? 0);
    const paymentType = String(input.paymenttype || "").toLowerCase();

    let deliveryMode = "salesman";
    try {
      const settings = await AdminSettings.getOrCreateForAdmin(input.adminid);
      deliveryMode = settings?.deliveryMode || "salesman";
    } catch (e) { /* default salesman */ }

    for (const rule of rules) {
      const creators: string[] = rule.applyToCreatorTypes || [];
      if (creators.length && !creators.includes(creatorType)) continue;

      const pays: string[] = (rule.paymentTypes || []).map((p: string) => p.toLowerCase());
      if (pays.length && !pays.includes(paymentType)) continue;

      if (rule.onlyWhenDeliveryBoy && deliveryMode !== "deliveryboy") continue;

      if (Number(rule.minOrderValue || 0) > 0 && base < Number(rule.minOrderValue)) continue;
      if (Number(rule.freeAboveValue || 0) > 0 && base >= Number(rule.freeAboveValue)) continue;

      const amount = rule.chargeType === "percent"
        ? +(base * Number(rule.value || 0) / 100).toFixed(2)
        : Number(rule.value || 0);
      if (amount <= 0) continue;

      const gstpercent = Number(rule.gstpercent || 0);
      const gstamount = +(amount * gstpercent / 100).toFixed(2);
      const totalamount = +(amount + gstamount).toFixed(2);

      result.lines.push({
        ledgerid: rule.ledgerid || undefined,
        ledgername: rule.name,
        amount,
        gstpercent,
        gstamount,
        totalamount,
        remarks: "Auto-applied charge",
      });
      result.total += totalamount;
    }
  } catch (e) { /* charge engine is best-effort; never block an order */ }
  result.total = +result.total.toFixed(2);
  return result;
};

// Canonical lifecycle status for an order. Falls back to deriving from the
// legacy fields for older records that have no explicit orderStatus.
const deriveOrderStatus = (o: any): string => {
  if (o?.orderStatus) return o.orderStatus;
  if (o?.cancelStatus === "cancelled") return "cancelled";
  if (o?.deliveryStatus === "delivered") return "delivered";
  if (o?.deliveryStatus === "dispatched") return "dispatched";
  if (o?.isConverted) return "confirmed";
  return "pending";
};

// Keep the linked Sales Invoice (if any) in sync with the order's fulfilment,
// so the order stays the single source of truth and every view agrees.
const syncInvoiceFromOrder = async (orderId: any, patch: any) => {
  try {
    await SalesInvoice.updateMany({ sourceorderid: orderId }, { $set: patch });
  } catch (e) { /* invoice sync is best-effort */ }
};

// ✅ Helper to convert populated Mongoose docs to simple ref objects
// Only name-type fields fall back to doc.name; numeric fields (latitude/longitude)
// must not, or GraphQL throws "Float cannot represent non numeric value".
const NAME_KEYS = new Set(["name", "accountname", "ledgername", "unitname"]);
const toSimpleRef = (doc: any, keys: string[] = ["name"]) => {
  if (!doc) return null;
  const ref: any = { id: doc._id?.toString() };
  keys.forEach(key => {
    const v = doc[key];
    if (v !== undefined && v !== null) ref[key] = v;
    else ref[key] = NAME_KEYS.has(key) ? (doc.name ?? null) : null;
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
  "othercharges.ledgerid",
];

// ✅ Format order function
const formatOrder = (order: any) => ({
  ...order,
  id: order._id.toString(),
  salesmenid: toSimpleRef(order.salesmenid, ["name"]),
  partyacc: toSimpleRef(order.partyacc, ["accountname", "mobile", "address", "city", "latitude", "longitude"]),
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
      const query: any = { status: true };
      // includeConverted: true → show all orders (pending + confirmed) for mobile app order history
      // otherwise default to showing only non-converted orders (admin sales order list)
      if (!filter.includeConverted) {
        query.isConverted = filter.isConverted !== undefined ? filter.isConverted : false;
      }
      const { user } = context;

      // ✅ Role-based filtering
      if (user?.type === 'branch') {
        query.$or = [
          { createdby_type: 'branch', createdby_id: user?.id },
          { branchid: user?.branch_id || user?.id }
        ];
      } else if (user?.type === 'staff') {
        // Delivery boys see orders by delivery assignment, not by who created them.
        const staff = await StaffAccount.findById(user.id).select('role').lean() as any;
        if (staff?.role !== 'deliveryboy') {
          query.createdby_id = user?.id;
        }
      }

      // ── Delivery filters ──────────────────────────────────────────────
      if (filter.deliveryboyid) query.deliveryboyid = filter.deliveryboyid;
      if (filter.deliveryStatus) query.deliveryStatus = filter.deliveryStatus;
      if (filter.unassignedDelivery) {
        // Available pool: end-user (party/website) orders not yet picked up.
        query.deliveryboyid = { $in: [null, undefined] };
        query.createdby_type = 'party';
        query.cancelStatus = { $ne: 'cancelled' };
        if (query.deliveryStatus === undefined) query.deliveryStatus = { $ne: 'delivered' };
      }

      if (filter.branchid) query.branchid = filter.branchid;
      if (filter.adminid) query.adminid = filter.adminid;
      if (filter.salesmenid) query.salesmenid = filter.salesmenid;
      if (filter.paymenttype) query.paymenttype = filter.paymenttype;
      if (filter.taxorsupplytype) query.taxorsupplytype = filter.taxorsupplytype;
      if (filter.billtype) query.billtype = filter.billtype;
      if (filter.ordertype) query.ordertype = filter.ordertype;
      if (filter.partyacc) {
        if (filter.includeDownline) {
          // Party login with downline management on: show own + sub-party orders.
          const downline = await getDownlinePartyIds(filter.partyacc);
          query.partyacc = { $in: [filter.partyacc, ...downline] };
        } else {
          query.partyacc = filter.partyacc;
        }
      }

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
      try {
        // ✅ Extract user info from context and populate createdby fields
        const { user } = context;
        const createdbyData = {
          createdby_id: user?.id,
          createdby_name: input.createdby_name || user?.name || user?.email,
          createdby_type: user?.type || input.createdby_type || 'admin',
        };

        // Auto-apply the admin's dynamic charge rules (delivery/handling/COD,
        // etc.). App and website orders carry no charges of their own, so the
        // engine adds them here based on the configured rules.
        const auto = await computeAutoCharges(input, createdbyData.createdby_type);
        const mergedCharges = [ ...(input.othercharges || []), ...auto.lines ];
        const finalTotal = +(Number(input.totalamount || 0) + auto.total).toFixed(2);

        // Lock the agreed total at order time. Snapshot of the total the
        // customer agreed to (incl. auto charges); never recomputed later.
        const lockedData = {
          othercharges: mergedCharges,
          totalamount: finalTotal,
          lockedTotal: input.lockedTotal ?? finalTotal,
        };

        console.log("=== Sales Order Create ===");
        console.log("User from context:", user);
        console.log("CreatedbyData:", createdbyData);

        const created = await SalesOrder.create({ ...input, ...createdbyData, ...lockedData });

        console.log("Created Sales Order:", {
          id: created._id,
          createdby_id: created.createdby_id,
          createdby_name: created.createdby_name,
          createdby_type: created.createdby_type
        });

        return await SalesOrder.findById(created._id)
          .populate(populateFields)
          .lean()
          .then(formatOrder);
      } catch (error: any) {
        console.error("=== ERROR Creating Sales Order ===");
        console.error("Error message:", error.message);
        console.error("Full error:", error);
        throw error;
      }
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
        { cancelStatus: "cancelled", orderStatus: "cancelled", cancelReason: reason || "", cancelledAt: new Date() },
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
        { cancelStatus: "open", orderStatus: existing.isConverted ? "confirmed" : "pending", cancelReason: null, cancelledAt: null },
        { new: true }
      ).populate(populateFields).lean();
      return updated ? formatOrder(updated) : null;
    },

    // ── Fulfilment transitions (order = source of truth, syncs the invoice) ──
    confirmSalesOrder: async (_: any, { id }: any) => {
      const updated = await SalesOrder.findByIdAndUpdate(
        id, { orderStatus: "confirmed" }, { new: true }
      ).populate(populateFields).lean();
      if (!updated) throw new Error("Sales Order not found");
      return formatOrder(updated);
    },

    markSalesOrderDispatched: async (_: any, { id, deliveryboyid }: any) => {
      const existing = await SalesOrder.findById(id).lean() as any;
      if (!existing) throw new Error("Sales Order not found");
      if (existing.cancelStatus === "cancelled") throw new Error("Order is cancelled.");
      const update: any = { deliveryStatus: "dispatched", orderStatus: "dispatched" };
      if (deliveryboyid) update.deliveryboyid = deliveryboyid;
      const updated = await SalesOrder.findByIdAndUpdate(id, update, { new: true })
        .populate(populateFields).lean();
      await syncInvoiceFromOrder(id, { deliveryStatus: "dispatched", ...(deliveryboyid ? { deliveryboyid } : {}) });
      return updated ? formatOrder(updated) : null;
    },

    markSalesOrderDelivered: async (_: any, { id, byId, byName, byType }: any, context: any) => {
      const existing = await SalesOrder.findById(id).lean() as any;
      if (!existing) throw new Error("Sales Order not found");
      if (existing.cancelStatus === "cancelled") throw new Error("Order is cancelled.");
      const user = context?.user;
      const deliveredAt = new Date();
      const patch = {
        deliveredById: byId || user?.id || null,
        deliveredByName: byName || user?.name || user?.email || null,
        deliveredByType: byType || user?.type || null,
      };
      const updated = await SalesOrder.findByIdAndUpdate(
        id,
        { deliveryStatus: "delivered", orderStatus: "delivered", deliveredAt, ...patch },
        { new: true }
      ).populate(populateFields).lean();
      await syncInvoiceFromOrder(id, { deliveryStatus: "delivered", deliveredAt, ...patch });
      return updated ? formatOrder(updated) : null;
    },

    assignOrderDeliveryBoy: async (_: any, { id, deliveryboyid }: any) => {
      await syncInvoiceFromOrder(id, { deliveryboyid, deliveryStatus: "dispatched" });
      const updated = await SalesOrder.findByIdAndUpdate(
        id,
        { deliveryboyid, deliveryStatus: "dispatched", orderStatus: "dispatched" },
        { new: true }
      ).populate(populateFields).lean();
      if (!updated) throw new Error("Sales Order not found");
      return formatOrder(updated);
    },
  },
};
