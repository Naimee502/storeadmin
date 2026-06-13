import { SalesInvoice } from "../../../models/salesinvoice";
import { AdminSettings } from "../../../models/adminsettings";
import { StaffAccount } from "../../../models/staffaccounts";
import { Account } from "../../../models/accounts";

// Resolve who created a doc into a proper { name, type } — so the listing shows
// e.g. "Ravi (Salesman)" / "Pruthvi (Party)" instead of "... (Staff)" or email.
// staff.type='staff' in the token, but the real role (salesman/staff/deliveryboy)
// lives on the StaffAccount; party tokens resolve to the Account name.
const resolveCreatedBy = async (user: any, input: any) => {
  console.log("🧾 [resolveCreatedBy] context.user:", JSON.stringify(user), "| input.createdby_name:", input?.createdby_name, "| input.createdby_type:", input?.createdby_type);
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
import { SalesOrder } from "../../../models/salesorder";

// Sync the source Sales Order (the canonical lifecycle owner) when delivery is
// updated on the invoice, so order + invoice always agree.
const syncOrderFromInvoice = async (invoiceId: any, patch: any) => {
  try {
    const inv = await SalesInvoice.findById(invoiceId).select("sourceorderid").lean() as any;
    if (inv?.sourceorderid) await SalesOrder.findByIdAndUpdate(inv.sourceorderid, { $set: patch });
  } catch (e) { /* best-effort sync */ }
};

// ✅ Helper to convert populated Mongoose docs to simple ref objects
// Only name-type fields fall back to doc.name. Numeric/other fields must NOT,
// otherwise e.g. a missing latitude (Float) gets the account name (string) and
// GraphQL throws "Float cannot represent non numeric value".
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

// ✅ Format invoice function
const formatInvoice = (inv: any) => ({
  ...inv,
  id: inv._id.toString(),
  salesmenid: toSimpleRef(inv.salesmenid, ["name"]),
  partyacc: toSimpleRef(inv.partyacc, ["accountname", "mobile", "address", "city", "latitude", "longitude"]),
  createdby_id: inv.createdby_id,
  createdby_name: inv.createdby_name,
  createdby_type: inv.createdby_type,
  autocreate: inv.autocreate || { ledger: true, stock: true },

  othercharges: inv.othercharges?.map((oc: any) => ({
    ...oc,
    ledgerid: toSimpleRef(oc.ledgerid, ["ledgername"])
  })) ?? [],

  productservice: inv.productservice?.map((ps: any) => {
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
export const salesInvoiceResolvers = {
  Query: {
    getSalesInvoices: async (_: any, { filter = {} }: { filter?: any }, context: any) => {
      const query: any = { status: true };
      const { user } = context;
      console.log("🧾 [getSalesInvoices] filter:", JSON.stringify(filter || {}), "| user:", user?.id, user?.type);

      // ✅ Role-based filtering
      if (user?.type === 'branch') {
        query.$or = [
          { createdby_type: 'branch', createdby_id: user?.id },
          { branchid: user?.branch_id || user?.id }
        ];
      } else if (user?.type === 'staff') {
        // Delivery views (pool / my deliveries) must NOT be restricted to
        // invoices the user created — they're filtered by delivery assignment.
        const isDeliveryView = !!(filter.unassignedDelivery || filter.deliveryboyid);
        let isDeliveryBoy = false;
        if (!isDeliveryView) {
          const staff = await StaffAccount.findById(user.id).select('role').lean() as any;
          isDeliveryBoy = staff?.role === 'deliveryboy';
        }
        if (!isDeliveryView && !isDeliveryBoy) {
          query.createdby_id = user?.id;
        }
      }

      // ── Delivery filters ──────────────────────────────────────────────
      if (filter.deliveryboyid) query.deliveryboyid = filter.deliveryboyid;
      if (filter.deliveryStatus) query.deliveryStatus = filter.deliveryStatus;
      if (filter.unassignedDelivery) {
        // Only expose the delivery pool when the business is set to delivery-boy
        // fulfilment. If salesman delivers (deliveryMode !== 'deliveryboy'),
        // there is no pool for the delivery boy.
        const settings = filter.adminid ? await AdminSettings.getOrCreateForAdmin(filter.adminid) : null;
        if (settings?.deliveryMode !== 'deliveryboy') {
          return [];
        }
        // Available pool: invoices not yet picked up by a delivery boy.
        query.deliveryboyid = { $in: [null, undefined] };
        query.deliveryStatus = { $ne: 'delivered' };
        // Salesman-taken orders are always salesman-fulfilled — the salesman
        // who booked the order hands it over himself. So even after they become
        // invoices they must NOT appear in the delivery-boy pool. Only
        // end-user / party / website / counter orders reach the delivery boy.
        query.orderedby_type = { $ne: 'salesman' };
      }

      // Add filters if provided
      if (filter.branchid) query.branchid = filter.branchid;
      if (filter.adminid) query.adminid = filter.adminid;
      if (filter.salesmenid) query.salesmenid = filter.salesmenid;
      if (filter.paymenttype) query.paymenttype = filter.paymenttype;
      if (filter.taxorsupplytype) query.taxorsupplytype = filter.taxorsupplytype;
      if (filter.billtype) query.billtype = filter.billtype;
      if (filter.invoicetype) query.invoicetype = filter.invoicetype;
      if (filter.salesunitid) query.salesunitid = filter.salesunitid;
      if (filter.partyacc) query.partyacc = { $regex: filter.partyacc, $options: "i" };

      // Bill date range filter
      if (filter.billdateFrom || filter.billdateTo) {
        query.billdate = {};
        if (filter.billdateFrom) query.billdate.$gte = new Date(filter.billdateFrom);
        if (filter.billdateTo) query.billdate.$lte = new Date(filter.billdateTo);
      }

      // ── TEMP DELIVERY DIAGNOSTIC ──────────────────────────────────────
      if (filter.unassignedDelivery || filter.deliveryboyid) {
        const anyUnassigned = await SalesInvoice.countDocuments({ status: true, deliveryboyid: { $in: [null, undefined] } });
        const matchCount = await SalesInvoice.countDocuments(query);
        console.log("🚚 [DELIVERY] user:", user?.id, user?.type,
          "| filter.adminid:", filter.adminid,
          "| query:", JSON.stringify(query),
          "| matched:", matchCount,
          "| total-unassigned(any admin):", anyUnassigned);
      }
      // ──────────────────────────────────────────────────────────────────

      const invoices = await SalesInvoice.find(query)
        .populate(populateFields)
        .lean();

      // ✅ Filter out invoices that have been fully returned
      const SalesReturn = require("../../../models/salesreturn").SalesReturn;

      const filteredInvoices = await Promise.all(
        invoices.map(async (inv: any) => {
          try {
            // Get all active returns for this invoice
            const returns = await SalesReturn.find({
              sourceInvoiceId: inv._id,
              status: true,
            }).lean();

            if (returns.length === 0) {
              // No returns yet, include invoice
              return inv;
            }

            // Calculate returned quantities per item
            const returnedByItem: Record<string, number> = {};
            returns.forEach((ret: any) => {
              (ret.productservice ?? []).forEach((line: any) => {
                // ✅ Convert to string for consistent comparison
                const productId = String(line.productserviceid || "");
                const variantId = String(line.variantid || "");
                const key = `${productId}_${variantId}`;
                returnedByItem[key] = (returnedByItem[key] || 0) + (Number(line.qty) || 0);
              });
            });

            console.log(`📊 Invoice ${inv.billnumber}: Returned items =`, returnedByItem);

            // Check if ALL items are fully returned
            const allFullyReturned = (inv.productservice ?? []).every((line: any) => {
              const productId = String(line.productserviceid || "");
              const variantId = String(line.variantid || "");
              const key = `${productId}_${variantId}`;
              const invoicedQty = Number(line.qty) || 0;
              const returnedQty = returnedByItem[key] || 0;

              console.log(`  ${key}: invoiced=${invoicedQty}, returned=${returnedQty}, fullReturned=${returnedQty >= invoicedQty}`);
              return returnedQty >= invoicedQty;
            });

            console.log(`  → Overall: allFullyReturned=${allFullyReturned}, includeInDropdown=${!allFullyReturned}`);

            // Return invoice only if NOT all items are fully returned
            return !allFullyReturned ? inv : null;
          } catch (error: any) {
            console.error(`❌ Error filtering invoice ${inv.billnumber}:`, error.message);
            return inv; // Include on error (safe fallback)
          }
        })
      );

      // Filter out null values
      const result = filteredInvoices.filter(Boolean).map(formatInvoice);
      console.log(`✅ Dropdown: Showing ${result.length} of ${invoices.length} invoices`);
      return result;
    },

    getDeletedSalesInvoices: async (_: any, { filter = {} }: { filter?: any }, context: any) => {
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
      if (filter.salesmenid) query.salesmenid = filter.salesmenid;

      const invoices = await SalesInvoice.find(query)
        .populate(populateFields)
        .lean();

      return invoices.map(formatInvoice);
    },

    getSalesInvoiceById: async (_: any, { id }: { id: string }) => {
      const inv = await SalesInvoice.findById(id)
        .populate(populateFields)
        .lean();
      return inv ? formatInvoice(inv) : null;
    },
  },

  Mutation: {
    addSalesInvoice: async (_: any, { input }: any, context: any) => {
      // ✅ Extract user info from context and populate createdby fields
      // (resolves staff → real role + name, party → account name).
      const { user } = context;
      const createdbyData = await resolveCreatedBy(user, input);

      // ✅ Always use AdminSettings for autocreate (ignore user input)
      const settings = await AdminSettings.getOrCreateForAdmin(input.adminid);
      console.log("📋 AdminSettings fetched:", {
        autoCreateLedgerOnSalesInvoice: settings?.autoCreateLedgerOnSalesInvoice,
        autoCreateStockOnSalesInvoice: settings?.autoCreateStockOnSalesInvoice,
      });

      const autoCreateData = {
        autocreate: {
          ledger: settings?.autoCreateLedgerOnSalesInvoice ?? true,
          payment: settings?.autoCreatePaymentOnSalesInvoice ?? true,
          stock: settings?.autoCreateStockOnSalesInvoice ?? true,
        },
      };

      console.log("✅ AutoCreate data being saved:", autoCreateData);

      const created = await SalesInvoice.create({ ...input, ...createdbyData, ...autoCreateData });
      console.log("✅ Created invoice autocreate:", created.autocreate);

      // Converting an order → invoice confirms the source order (canonical status).
      if (input.sourceorderid) {
        try {
          await SalesOrder.findByIdAndUpdate(input.sourceorderid, {
            $set: { isConverted: true, orderStatus: "confirmed" },
          });
        } catch (e) { /* best-effort */ }
      }

      // ✅ Explicitly call adjustStockAndTransactions WITH userContext
      // (ensures Transaction/Payment Created By is never N/A)
      await SalesInvoice.adjustStockAndTransactions(null, created, createdbyData);

      return await SalesInvoice.findById(created._id)
        .populate(populateFields)
        .lean()
        .then(formatInvoice);
    },

    // One-tap convert (used by the mobile app, which has no invoice form).
    // Builds the invoice input from the source order and reuses addSalesInvoice
    // so all the auto-posting (ledger / stock / payment) runs exactly the same.
    convertSalesOrderToInvoice: async (_: any, { id }: any, context: any) => {
      console.log("🔄 [convertSalesOrderToInvoice] id:", id, "| context.user:", JSON.stringify(context?.user));
      const order: any = await SalesOrder.findById(id).lean();
      if (!order) throw new Error("Sales Order not found");
      if (order.isConverted) throw new Error("This order is already converted to an invoice.");
      if (order.cancelStatus === "cancelled") throw new Error("A cancelled order cannot be converted.");

      const str = (v: any) => (v == null ? null : v.toString());
      const input: any = {
        adminid: str(order.adminid),
        branchid: str(order.branchid),
        salesmenid: str(order.salesmenid),
        paymenttype: order.paymenttype,
        partyacc: str(order.partyacc),
        taxorsupplytype: order.taxorsupplytype || "regular",
        billdate: new Date().toISOString().slice(0, 10),
        billtype: (order.billtype && order.billtype !== "order") ? order.billtype : "taxInvoice",
        notes: order.notes,
        ordertype: order.ordertype,
        isservice: !!order.isservice,
        subtotal: order.subtotal,
        totaldiscount: order.totaldiscount,
        totalgst: order.totalgst,
        totalamount: order.totalamount,
        invoicediscount: order.invoicediscount,
        invoicediscounttype: order.invoicediscounttype,
        roundoff: order.roundoff,
        deliverydate: order.deliverydate,
        duedate: order.duedate,
        transportname: order.transportname,
        vehiclenumber: order.vehiclenumber,
        ewaybillno: order.ewaybillno,
        distance: order.distance,
        productservice: (order.productservice || []).map((p: any) => ({
          productserviceid: str(p.productserviceid),
          variantid: str(p.variantid),
          salesunitid: str(p.salesunitid),
          unitqty: p.unitqty ?? 1,
          gst: p.gst ?? 0,
          qty: p.qty ?? 0,
          rate: p.rate ?? 0,
          amount: p.amount ?? 0,
          discount: p.discount ?? 0,
          salesaccountid: str(p.salesaccountid),
          purchaseaccountid: str(p.purchaseaccountid),
          serviceaccountid: str(p.serviceaccountid),
        })),
        othercharges: (order.othercharges || []).map((c: any) => ({
          ledgerid: str(c.ledgerid),
          ledgername: c.ledgername,
          amount: c.amount ?? 0,
          gstpercent: c.gstpercent ?? 0,
          gstamount: c.gstamount ?? 0,
          totalamount: c.totalamount ?? 0,
          remarks: c.remarks,
        })),
        // Track origin + who booked the order.
        sourceorderid: str(order._id),
        orderedby_id: str(order.createdby_id),
        orderedby_name: order.createdby_name,
        orderedby_type: order.createdby_type,
      };

      return await (salesInvoiceResolvers as any).Mutation.addSalesInvoice(_, { input }, context);
    },

    editSalesInvoice: async (_: any, { id, input }: any, context: any) => {
      const { user } = context;
      const userContext = {
        createdby_id: user?.id,
        createdby_name: user?.name || user?.email,
        createdby_type: user?.type || 'admin',
      };

      const oldInv = await SalesInvoice.findById(id);
      if (!oldInv) throw new Error("Invoice not found");

      // ✅ Always use AdminSettings for autocreate (ignore user input)
      const settings = await AdminSettings.getOrCreateForAdmin(oldInv.adminid);
      const autoCreateData = {
        autocreate: {
          ledger: settings?.autoCreateLedgerOnSalesInvoice ?? true,
          payment: settings?.autoCreatePaymentOnSalesInvoice ?? true,
          stock: settings?.autoCreateStockOnSalesInvoice ?? true,
        },
      };

      const updated = await SalesInvoice.findByIdAndUpdate(id, { ...input, ...autoCreateData }, { new: true });

      if (updated) {
        await SalesInvoice.adjustStockAndTransactions(oldInv, updated, userContext);
      }

      const inv = await SalesInvoice.findById(id)
        .populate(populateFields)
        .lean();
      return inv ? formatInvoice(inv) : null;
    },

    deleteSalesInvoice: async (_: any, { id }: { id: string }) => {
      return !!(await SalesInvoice.findByIdAndUpdate(id, { status: false }));
    },

    resetSalesInvoice: async (_: any, { id }: { id: string }) => {
      return !!(await SalesInvoice.findByIdAndUpdate(id, { status: true }));
    },

    // ── Delivery transitions (sync back to the canonical source order) ────
    markSalesInvoiceDispatched: async (_: any, { id, deliveryboyid }: any) => {
      const update: any = { deliveryStatus: "dispatched" };
      if (deliveryboyid) update.deliveryboyid = deliveryboyid;
      const updated = await SalesInvoice.findByIdAndUpdate(id, update, { new: true })
        .populate(populateFields).lean();
      if (!updated) throw new Error("Invoice not found");
      await syncOrderFromInvoice(id, { orderStatus: "dispatched", deliveryStatus: "dispatched", ...(deliveryboyid ? { deliveryboyid } : {}) });
      return formatInvoice(updated);
    },

    markSalesInvoiceDelivered: async (_: any, { id, byId, byName, byType }: any, context: any) => {
      const user = context?.user;
      const deliveredAt = new Date();
      const by = {
        deliveredById: byId || user?.id || null,
        deliveredByName: byName || user?.name || user?.email || null,
        deliveredByType: byType || user?.type || null,
      };
      const updated = await SalesInvoice.findByIdAndUpdate(
        id,
        { deliveryStatus: "delivered", deliveredAt, ...by },
        { new: true }
      ).populate(populateFields).lean();
      if (!updated) throw new Error("Invoice not found");
      await syncOrderFromInvoice(id, { orderStatus: "delivered", deliveryStatus: "delivered", deliveredAt, ...by });
      return formatInvoice(updated);
    },

    assignInvoiceDeliveryBoy: async (_: any, { id, deliveryboyid }: any) => {
      const updated = await SalesInvoice.findByIdAndUpdate(
        id,
        { deliveryboyid, deliveryStatus: "dispatched" },
        { new: true }
      ).populate(populateFields).lean();
      if (!updated) throw new Error("Invoice not found");
      await syncOrderFromInvoice(id, { orderStatus: "dispatched", deliveryStatus: "dispatched", deliveryboyid });
      return formatInvoice(updated);
    },
  },
};
