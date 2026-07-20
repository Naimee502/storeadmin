import { SalesOrder } from "../../../models/salesorder";
import { StaffAccount } from "../../../models/staffaccounts";
import { SalesInvoice } from "../../../models/salesinvoice";
import { Account } from "../../../models/accounts";
import { Payment } from "../../../models/payments";
import { Transaction } from "../../../models/transactions";
import { pushNotification } from "../../../models/notifications";

// Role-free settled amount against an invoice (Payments + Transactions Agst Ref).
const invoiceSettledAmount = async (invoiceId: any): Promise<number> => {
  if (!invoiceId) return 0;
  const idStr = String(invoiceId);
  let total = 0;
  const pays = await Payment.find({ "invoices.invoiceid": invoiceId, status: true }).select("invoices").lean();
  pays.forEach((p: any) => (p.invoices || []).forEach((iv: any) => {
    if (String(iv.invoiceid) === idStr) total += iv.settledamount || 0;
  }));
  const txns = await Transaction.find({ "invoices.invoiceid": invoiceId, status: true }).select("invoices").lean();
  txns.forEach((t: any) => (t.invoices || []).forEach((iv: any) => {
    if (String(iv.invoiceid) === idStr) total += iv.settledamount || 0;
  }));
  return parseFloat(total.toFixed(2));
};

// Resolve who created a doc into a proper { name, type }: staff token →
// real role (salesman/staff/deliveryboy) + name; party token → account name.
const resolveCreatedBy = async (user: any, input: any) => {
  let name = input?.createdby_name || user?.name || user?.email || "N/A";
  let type = user?.type || input?.createdby_type || "admin";
  try {
    if (user?.type === "staff") {
      const staff = await StaffAccount.findById(user.id).select("role name").lean() as any;
      if (staff) { type = staff.role || "staff"; name = staff.name || name; }
    } else if (user?.type === "account" || user?.type === "party") {
      type = "party";
      const acc = await Account.findById(user.id).select("name").lean() as any;
      if (acc) name = acc.name || name;
    }
  } catch (e) { /* best-effort */ }
  return { createdby_id: user?.id, createdby_name: name, createdby_type: type };
};

// Plain "staff" role has no order-assignment field (unlike salesman's
// salesmenid / deliveryboy's deliveryboyid), so without this broadcast they'd
// only ever hear about an order via attendance or by being its creator —
// which is why staff logins saw far fewer notifications than salesman/
// deliveryboy/party. Tell every active "staff"-role StaffAccount at the
// branch about order activity, same visibility admin already has.
const notifyBranchStaff = async (
  adminid: any,
  branchid: any,
  excludeIds: any[],
  payload: { ntype: string; title: string; message: string; docmodel: string; docid: any; appscreen?: string }
) => {
  if (!adminid) return;
  const exclude = new Set(excludeIds.filter(Boolean).map((id: any) => String(id)));
  const query: any = { admin: adminid, role: "staff", status: true };
  if (branchid) query.branchid = branchid;
  const staffList: any[] = await StaffAccount.find(query).select("_id").lean();
  for (const s of staffList) {
    if (exclude.has(String(s._id))) continue;
    await pushNotification({ adminid, branchid, targettype: "staff", targetid: s._id, ...payload });
  }
};

// Notify everyone concerned about an order lifecycle event (edited, confirmed,
// dispatched, delivered, cancelled …). Mirrors the create-order notification
// rules: actor ≠ admin → tell admin; always tell the assigned salesman (order's
// salesmenid, else the party's linked salesman) and the party — skipping
// whoever performed the action themselves. Best-effort, never throws.
const notifyOrderEvent = async (doc: any, context: any, event: string, input?: any) => {
  try {
    if (!doc) return;
    const user = context?.user;
    // input carries createdby_name/type from the admin panel forms — used as a
    // fallback so the actor label stays correct even if the JWT has expired.
    const actor = await resolveCreatedBy(user, input || {});
    // Unidentifiable actor (expired/missing token, no input fallback):
    // resolveCreatedBy defaults to "admin", which would wrongly skip the admin
    // notification. Treat as unknown instead so the admin still gets notified.
    if (!user && !input?.createdby_type && !input?.createdby_name) {
      actor.createdby_type = "unknown";
      if (actor.createdby_name === "N/A") actor.createdby_name = "Unknown user";
    }
    const actorLabel = `${actor.createdby_name} (${actor.createdby_type})`;
    const orderNo = `SO-${doc.billnumber || ""}`;
    const partyName = doc.partyacc?.name || doc.partyacc?.accountname || "Party";
    const amount = Number(doc.totalamount || 0).toFixed(2);
    const adminid = doc.adminid?._id || doc.adminid;
    const branchid = doc.branchid?._id || doc.branchid;

    if (actor.createdby_type !== "admin") {
      await pushNotification({
        adminid, branchid,
        targettype: "admin",
        ntype: "order",
        title: `Order ${orderNo} ${event}`,
        message: `${partyName} • ₹${amount} • by ${actorLabel}`,
        webpath: "/salesorder",
        docmodel: "SalesOrder",
        docid: doc._id,
      });
    }

    let salesmanId: any = doc.salesmenid?._id || doc.salesmenid;
    if (!salesmanId) {
      const partyRefId = doc.partyacc?._id || doc.partyacc;
      if (partyRefId) {
        const acc: any = await Account.findById(partyRefId).select("salesmanid").lean();
        salesmanId = acc?.salesmanid || null;
      }
    }
    if (salesmanId && String(salesmanId) !== String(user?.id || "")) {
      await pushNotification({
        adminid, branchid,
        targettype: "staff",
        targetid: salesmanId,
        ntype: "order",
        title: `Order ${orderNo} ${event}`,
        message: `${partyName} • ₹${amount} • by ${actorLabel}`,
        appscreen: "Orders",
        docmodel: "SalesOrder",
        docid: doc._id,
      });
    }

    // Assigned delivery boy — hears about events on orders he delivers.
    const deliveryBoyId = doc.deliveryboyid?._id || doc.deliveryboyid;
    if (
      deliveryBoyId &&
      String(deliveryBoyId) !== String(user?.id || "") &&
      String(deliveryBoyId) !== String(salesmanId || "")
    ) {
      await pushNotification({
        adminid, branchid,
        targettype: "staff",
        targetid: deliveryBoyId,
        ntype: "order",
        title: `Order ${orderNo} ${event} — ${partyName}`,
        message: `₹${amount} • by ${actorLabel}`,
        appscreen: "Orders",
        docmodel: "SalesOrder",
        docid: doc._id,
      });
    }

    // Staff creator (staff/deliveryboy app users) — hears about lifecycle
    // changes to orders they punched, same as a salesman does.
    const creatorId = doc.createdby_id;
    const creatorType = String(doc.createdby_type || "").toLowerCase();
    if (
      creatorId &&
      ["staff", "salesman", "deliveryboy"].includes(creatorType) &&
      String(creatorId) !== String(user?.id || "") &&
      String(creatorId) !== String(salesmanId || "") &&
      String(creatorId) !== String(deliveryBoyId || "")
    ) {
      await pushNotification({
        adminid, branchid,
        targettype: "staff",
        targetid: creatorId,
        ntype: "order",
        title: `Order ${orderNo} ${event}`,
        message: `${partyName} • ₹${amount} • by ${actorLabel}`,
        appscreen: "Orders",
        docmodel: "SalesOrder",
        docid: doc._id,
      });
    }

    // Branch-wide "staff" role — same visibility admin has, since plain
    // staff aren't assignable to orders the way salesman/deliveryboy are.
    await notifyBranchStaff(
      adminid, branchid,
      [user?.id, salesmanId, deliveryBoyId, creatorId],
      {
        ntype: "order",
        title: `Order ${orderNo} ${event}`,
        message: `${partyName} • ₹${amount} • by ${actorLabel}`,
        appscreen: "Orders",
        docmodel: "SalesOrder",
        docid: doc._id,
      }
    );

    const partyId = doc.partyacc?._id || doc.partyacc;
    if (partyId && String(partyId) !== String(user?.id || "")) {
      await pushNotification({
        adminid, branchid,
        targettype: "party",
        targetid: partyId,
        ntype: "order",
        title: `Your order ${orderNo} ${event}`,
        message: `₹${amount} • by ${actorLabel}`,
        appscreen: "Orders",
        docmodel: "SalesOrder",
        docid: doc._id,
      });
    }

    // Channel downline: the parent (upline) party also hears about its child
    // party's order events — mirrors the "Parties Orders" visibility.
    if (partyId) {
      const accDoc: any = await Account.findById(partyId).select("assignaccountid").lean();
      const parentId = accDoc?.assignaccountid;
      if (parentId && String(parentId) !== String(user?.id || "")) {
        await pushNotification({
          adminid, branchid,
          targettype: "party",
          targetid: parentId,
          ntype: "order",
          title: `Order ${orderNo} ${event} — ${partyName}`,
          message: `₹${amount} • by ${actorLabel}`,
          appscreen: "Orders",
          docmodel: "SalesOrder",
          docid: doc._id,
        });
      }
    }
  } catch (e) { /* notifications are best-effort */ }
};

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
const populateFields: any[] = [
  "salesmenid",
  // Populate the party AND its channel so the app can show the party's
  // channel type (End User / Retailer / Wholesaler) on orders.
  { path: "partyacc", populate: { path: "channel", select: "channelName" } },
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
  partyacc: (() => {
    const ref = toSimpleRef(order.partyacc, ["accountname", "mobile", "address", "city", "latitude", "longitude"]);
    const ch = order.partyacc?.channel;
    if (ref && ch && typeof ch === "object") {
      ref.channelName = ch.channelName ?? null;
    }
    return ref;
  })(),
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
        if (staff?.role === 'salesman') {
          // Salesman sees: own orders + orders assigned to them + orders of
          // THEIR parties (covers admin-punched orders for a party the
          // salesman manages — with or without salesmenid set on the order).
          const myParties = await Account.find({ salesmanid: user.id, status: true })
            .select('_id').lean();
          const partyIds = myParties.map((p: any) => p._id);
          query.$or = [
            { createdby_id: user.id },
            { salesmenid: user.id },
            ...(partyIds.length ? [{ partyacc: { $in: partyIds } }] : []),
          ];
        } else if (staff?.role !== 'deliveryboy') {
          // Plain staff: strictly own-created orders only (never other
          // staff members' or salesmen's orders).
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
      // Skip when role-based $or scoping already covers the salesman —
      // ANDing salesmenid on top would hide their parties' admin-punched orders.
      // When only the explicit filter is present (e.g. the app's access token
      // expired so context.user is null), expand it the same way the role-based
      // scoping does: own orders + assigned orders + orders of their parties.
      if (filter.salesmenid && !query.$or) {
        const myParties = await Account.find({ salesmanid: filter.salesmenid, status: true })
          .select('_id').lean();
        const partyIds = myParties.map((p: any) => p._id);
        query.$or = [
          { createdby_id: filter.salesmenid },
          { salesmenid: filter.salesmenid },
          ...(partyIds.length ? [{ partyacc: { $in: partyIds } }] : []),
        ];
      }
      if (filter.routeid) query.routeid = filter.routeid;
      if (filter.ordersource) query.ordersource = filter.ordersource;
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
        // (staff → real role salesman/staff/deliveryboy + name; party → account name)
        const { user } = context;
        const createdbyData = await resolveCreatedBy(user, input);

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

        // billnumber is ALWAYS generated server-side (pre-save hook) so numbers
        // stay unique across the app, admin panel and POS. Client-computed
        // numbers (from a possibly stale list) caused duplicates like SO-000001.
        delete input.billnumber;

        const created = await SalesOrder.create({ ...input, ...createdbyData, ...lockedData });

        console.log("Created Sales Order:", {
          id: created._id,
          createdby_id: created.createdby_id,
          createdby_name: created.createdby_name,
          createdby_type: created.createdby_type
        });

        const doc: any = await SalesOrder.findById(created._id)
          .populate(populateFields)
          .lean();

        // ── Notifications ──────────────────────────────────────────
        // Non-admin punched (salesman/staff/deliveryboy/party) → tell admin.
        // Back-office punched (admin/branch/staff) → tell the assigned
        // salesman + the party (app).
        try {
          const orderNo = `SO-${doc?.billnumber || ""}`;
          const partyName = doc?.partyacc?.name || doc?.partyacc?.accountname || "Party";
          const amount = Number(doc?.totalamount || 0).toFixed(2);
          const puncherType = createdbyData.createdby_type;
          const puncherLabel = `${createdbyData.createdby_name} (${puncherType})`;
          const isBackOffice = ["admin", "branch", "staff"].includes(puncherType);

          if (puncherType !== "admin") {
            await pushNotification({
              adminid: input.adminid,
              branchid: input.branchid,
              targettype: "admin",
              ntype: "order",
              title: `New order ${orderNo} punched`,
              message: `${partyName} • ₹${amount} • by ${puncherLabel}`,
              webpath: "/salesorder",
              docmodel: "SalesOrder",
              docid: created._id,
            });
          }

          // Branch-wide "staff" role — same live visibility admin gets, since
          // plain staff have no order-assignment field of their own.
          await notifyBranchStaff(
            input.adminid, input.branchid,
            [createdbyData.createdby_id],
            {
              ntype: "order",
              title: `New order ${orderNo} punched`,
              message: `${partyName} • ₹${amount} • by ${puncherLabel}`,
              appscreen: "Orders",
              docmodel: "SalesOrder",
              docid: created._id,
            }
          );

          if (isBackOffice) {
            // Assigned salesman: from the order itself, else the party's
            // linked salesman (accounts.salesmanid).
            let salesmanId: any = doc?.salesmenid?._id || doc?.salesmenid || input.salesmenid;
            if (!salesmanId) {
              const partyRefId = doc?.partyacc?._id || doc?.partyacc || input.partyacc;
              if (partyRefId) {
                const acc: any = await Account.findById(partyRefId).select("salesmanid").lean();
                salesmanId = acc?.salesmanid || null;
              }
            }
            if (salesmanId && String(salesmanId) !== String(createdbyData.createdby_id)) {
              await pushNotification({
                adminid: input.adminid,
                branchid: input.branchid,
                targettype: "staff",
                targetid: salesmanId,
                ntype: "order",
                title: `New order ${orderNo} for ${partyName}`,
                message: `₹${amount} • punched by ${puncherLabel}`,
                appscreen: "Orders",
                docmodel: "SalesOrder",
                docid: created._id,
              });
            }
            const partyId = doc?.partyacc?._id || doc?.partyacc || input.partyacc;
            if (partyId) {
              await pushNotification({
                adminid: input.adminid,
                branchid: input.branchid,
                targettype: "party",
                targetid: partyId,
                ntype: "order",
                title: `Order ${orderNo} placed for you`,
                message: `₹${amount} • by ${puncherLabel}`,
                appscreen: "Orders",
                docmodel: "SalesOrder",
                docid: created._id,
              });
            }
          }

          // Channel downline (party hierarchy via assignaccountid):
          // • parent (upline) party hears about its child party's new order;
          // • a parent punching for a child also notifies the child.
          const orderPartyId = doc?.partyacc?._id || doc?.partyacc || input.partyacc;
          if (orderPartyId) {
            const accDoc: any = await Account.findById(orderPartyId).select("assignaccountid").lean();
            const parentId = accDoc?.assignaccountid;
            if (parentId && String(parentId) !== String(createdbyData.createdby_id || "")) {
              await pushNotification({
                adminid: input.adminid,
                branchid: input.branchid,
                targettype: "party",
                targetid: parentId,
                ntype: "order",
                title: `New order ${orderNo} for ${partyName}`,
                message: `₹${amount} • by ${puncherLabel}`,
                appscreen: "Orders",
                docmodel: "SalesOrder",
                docid: created._id,
              });
            }
            if (
              puncherType === "party" &&
              String(createdbyData.createdby_id || "") !== String(orderPartyId)
            ) {
              await pushNotification({
                adminid: input.adminid,
                branchid: input.branchid,
                targettype: "party",
                targetid: orderPartyId,
                ntype: "order",
                title: `Order ${orderNo} placed for you`,
                message: `₹${amount} • by ${puncherLabel}`,
                appscreen: "Orders",
                docmodel: "SalesOrder",
                docid: created._id,
              });
            }
          }
        } catch (e) { /* notifications are best-effort */ }

        return formatOrder(doc);
      } catch (error: any) {
        console.error("=== ERROR Creating Sales Order ===");
        console.error("Error message:", error.message);
        console.error("Full error:", error);
        throw error;
      }
    },

    editSalesOrder: async (_: any, { id, input }: any, context: any) => {
      // Re-evaluate charge rules when this is a real line-item edit (i.e. a
      // new subtotal was sent, same as addSalesOrder). Partial updates from
      // other flows (status/isConverted syncs) never send `subtotal`, so
      // they skip this and behave exactly as before. Without this, editing
      // an order's items would leave a stale auto-charge line in
      // `othercharges` while `totalamount` silently dropped it.
      try {
        if (input?.subtotal != null) {
          const existing: any = await SalesOrder.findById(id).lean();
          if (existing) {
            const auto = await computeAutoCharges(input, existing.createdby_type || "party");
            const manualCharges = (existing.othercharges || []).filter(
              (c: any) => c?.remarks !== "Auto-applied charge"
            );
            input.othercharges = [...manualCharges, ...auto.lines];
            input.totalamount = +(Number(input.totalamount || 0) + auto.total).toFixed(2);
          }
        }
      } catch (e) { /* charge engine is best-effort; never block an edit */ }

      const updated = await SalesOrder.findByIdAndUpdate(id, input, { new: true })
        .populate(populateFields)
        .lean();
      // Skip the "updated" notification when this edit is the conversion sync
      // (invoice creation already sends "converted to invoice") — otherwise
      // every conversion would fire a redundant, confusing "updated" notif.
      if (updated && !input?.isConverted) {
        await notifyOrderEvent(updated, context, "updated", input);
      }
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
    cancelSalesOrder: async (_: any, { id, reason }: { id: string; reason?: string }, context: any) => {
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
      if (updated) await notifyOrderEvent(updated, context, "cancelled");
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
    confirmSalesOrder: async (_: any, { id }: any, context: any) => {
      const updated = await SalesOrder.findByIdAndUpdate(
        id, { orderStatus: "confirmed" }, { new: true }
      ).populate(populateFields).lean();
      if (!updated) throw new Error("Sales Order not found");
      await notifyOrderEvent(updated, context, "confirmed");
      return formatOrder(updated);
    },

    markSalesOrderDispatched: async (_: any, { id, deliveryboyid }: any, context: any) => {
      const existing = await SalesOrder.findById(id).lean() as any;
      if (!existing) throw new Error("Sales Order not found");
      if (existing.cancelStatus === "cancelled") throw new Error("Order is cancelled.");
      const update: any = { deliveryStatus: "dispatched", orderStatus: "dispatched" };
      if (deliveryboyid) update.deliveryboyid = deliveryboyid;
      const updated = await SalesOrder.findByIdAndUpdate(id, update, { new: true })
        .populate(populateFields).lean();
      await syncInvoiceFromOrder(id, { deliveryStatus: "dispatched", ...(deliveryboyid ? { deliveryboyid } : {}) });
      if (updated) await notifyOrderEvent(updated, context, "dispatched");
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
      if (updated) await notifyOrderEvent(updated, context, "delivered");
      return updated ? formatOrder(updated) : null;
    },

    assignOrderDeliveryBoy: async (_: any, { id, deliveryboyid }: any, context: any) => {
      await syncInvoiceFromOrder(id, { deliveryboyid, deliveryStatus: "dispatched" });
      const updated = await SalesOrder.findByIdAndUpdate(
        id,
        { deliveryboyid, deliveryStatus: "dispatched", orderStatus: "dispatched" },
        { new: true }
      ).populate(populateFields).lean();
      if (!updated) throw new Error("Sales Order not found");
      await notifyOrderEvent(updated, context, "assigned for delivery");
      return formatOrder(updated);
    },
  },

  // When an order has been converted, expose the real INVOICE number (same as
  // the admin panel) so the app can show INV-000004 instead of the order's own
  // sequence. Looked up via the invoice's sourceorderid back-link.
  SalesOrder: {
    invoicenumber: async (parent: any) => {
      if (!parent?.isConverted) return null;
      const inv = await SalesInvoice.findOne({ sourceorderid: parent.id })
        .select("billnumber")
        .lean() as any;
      return inv?.billnumber ?? null;
    },
    // Due on the linked invoice (total − settled). 0 if not yet billed/paid.
    outstanding: async (parent: any) => {
      if (!parent?.isConverted) return 0;
      const inv = await SalesInvoice.findOne({ sourceorderid: parent.id })
        .select("totalamount")
        .lean() as any;
      if (!inv) return 0;
      const settled = await invoiceSettledAmount(inv._id);
      return parseFloat(((inv.totalamount || 0) - settled).toFixed(2));
    },
  },
};
