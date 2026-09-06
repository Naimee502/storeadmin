import { PurchaseInvoice } from "../../../models/purchaseinvoice";
import { AdminSettings } from "../../../models/adminsettings";
import { Payment } from "../../../models/payments";
import { Transaction } from "../../../models/transactions";
import { autoAdjustAdvances, getInvoiceOutstanding } from "../../../utils/allocation";
import { PurchaseOrder } from "../../../models/purchaseorder";
import { refId } from "../../../utils/ordermode";

// NOTE: the local per-invoice settled-amount helper was removed. Outstanding
// now comes from utils/allocation, so the admin panel, the mobile app, the
// party report and the WhatsApp reminder all quote the same figure — and all
// of them net off sales returns, which this helper never did.

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
  "partyacc",
  "productservice.productserviceid",
  "productservice.purchaseunitid",
  "productservice.salesaccountid",
  "productservice.purchaseaccountid",
  "productservice.serviceaccountid",
  "othercharges.ledgerid",
];

// ✅ Format invoice function
const formatInvoice = (inv: any) => ({
  ...inv,
  id: inv._id.toString(),
  partyacc: toSimpleRef(inv.partyacc, ["accountname", "mobile", "address", "city", "state", "gstnumber"]),
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
export const purchaseInvoiceResolvers = {
  Query: {
    getPurchaseInvoices: async (_: any, { filter = {} }: { filter?: any }, context: any) => {
      try {
        console.log("📌 getPurchaseInvoices called");
        console.log("   User Type:", context.user?.type);
        console.log("   Filter:", JSON.stringify(filter, null, 2));

        const query: any = { status: true };
        const { user } = context;

        // ✅ Role-based filtering
        if (user?.type === 'branch') {
          query.$or = [
            { createdby_type: 'branch', createdby_id: user?.id },
            { branchid: user?.branch_id || user?.id }
          ];
        } else if (user?.type === 'staff' && !filter.partyacc) {
          // Party-scoped (collecting/settling a party's bills) must show ALL of
          // that party's invoices, like the admin panel — not just own-created.
          query.createdby_id = user?.id;
        }

        if (filter.branchid) query.branchid = filter.branchid;
        if (filter.adminid) query.adminid = filter.adminid;
        if (filter.supplierid) query.supplierid = filter.supplierid;
        if (filter.paymenttype) query.paymenttype = filter.paymenttype;
        if (filter.partyacc) query.partyacc = filter.partyacc;
        if (filter.billtype) query.billtype = filter.billtype;
        if (filter.invoicetype) query.invoicetype = filter.invoicetype;
        if (filter.billdateFrom || filter.billdateTo) {
          query.billdate = {};
          if (filter.billdateFrom) query.billdate.$gte = new Date(filter.billdateFrom);
          if (filter.billdateTo) query.billdate.$lte = new Date(filter.billdateTo);
        }

        console.log("   Query:", JSON.stringify(query, null, 2));

        const invoices = await PurchaseInvoice.find(query)
          .populate(populateFields)
          .lean();

        console.log("✅ Found", invoices.length, "invoices");

        // ✅ Filter out invoices that have been fully returned
        const PurchaseReturn = require("../../../models/purchasereturn").PurchaseReturn;

        const filteredInvoices = await Promise.all(
          invoices.map(async (inv: any) => {
            try {
              // Get all active returns for this invoice
              const returns = await PurchaseReturn.find({
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
        console.log("✅ After filtering fully-returned:", result.length, "of", invoices.length, "invoices");
        return result;
      } catch (error: any) {
        console.error("❌ Error in getPurchaseInvoices:", error.message);
        throw error;
      }
    },

    getDeletedPurchaseInvoices: async (_: any, { filter = {} }: { filter?: any }, context: any) => {
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
      if (filter.supplierid) query.supplierid = filter.supplierid;

      const invoices = await PurchaseInvoice.find(query)
        .populate(populateFields)
        .lean();
      return invoices.map(formatInvoice);
    },

    getPurchaseInvoiceById: async (_: any, { id }: { id: string }) => {
      try {
        console.log("📌 getPurchaseInvoiceById called");
        console.log("   Invoice ID:", id);

        if (!id) {
          throw new Error("❌ Invoice ID is required");
        }

        const invoice = await PurchaseInvoice.findById(id)
          .populate(populateFields)
          .lean() as any;

        if (!invoice) {
          console.log("❌ Invoice not found with ID:", id);
          return null;
        }

        console.log("✅ Invoice found");
        console.log("   Has createdby_id:", !!(invoice?.createdby_id));
        console.log("   Has partyacc:", !!(invoice?.partyacc));
        console.log("   Products:", invoice?.productservice?.length || 0);
        console.log("   Other Charges:", invoice?.othercharges?.length || 0);

        return formatInvoice(invoice);
      } catch (error: any) {
        console.error("❌ Error in getPurchaseInvoiceById:", error.message);
        throw error;
      }
    },
  },

  Mutation: {
    // `autoPayment` is an INTERNAL arg (not in the schema). false stops the
    // automatic payment posting, so the bill stays open for the supplier to be
    // paid from the Payments screen. See the sales side for the full note.
    addPurchaseInvoice: async (_: any, { input, autoPayment }: any, context: any) => {
      try {
        console.log("\n");
        console.log("╔═══════════════════════════════════════════════════════╗");
        console.log("║  🔵 ADD PURCHASE INVOICE - START                      ║");
        console.log("╚═══════════════════════════════════════════════════════╝");

        // ✅ Step 1: Extract user info from context
        const { user } = context;
        console.log("📌 Step 1: User from context");
        console.log("   User ID:", user?.id);
        console.log("   User Name:", user?.name || user?.email);
        console.log("   User Type:", user?.type);

        const createdbyData = {
          createdby_id: user?.id,
          createdby_name: input.createdby_name || user?.name || user?.email,
          createdby_type: user?.type || input.createdby_type || 'admin',
        };
        console.log("✅ CreatedBy Data:", JSON.stringify(createdbyData, null, 2));

        // ✅ Step 2: Validate input
        console.log("\n📌 Step 2: Validate Input Data");
        console.log("   Admin ID:", input.adminid);
        console.log("   Branch ID:", input.branchid);
        console.log("   Payment Type:", input.paymenttype);
        console.log("   Party Account:", input.partyacc);
        console.log("   Bill Number:", input.billnumber);
        console.log("   Products Count:", input.productservice?.length || 0);
        console.log("   Other Charges Count:", input.othercharges?.length || 0);

        if (!input.adminid) {
          throw new Error("❌ Admin ID is required");
        }
        if (!input.partyacc) {
          throw new Error("❌ Party Account is required");
        }
        if (!input.productservice || input.productservice.length === 0) {
          throw new Error("❌ At least one product is required");
        }
        console.log("✅ Input validation passed");

        // ✅ Step 3: Fetch AdminSettings
        console.log("\n📌 Step 3: Fetch AdminSettings");
        const settings = await AdminSettings.getOrCreateForAdmin(input.adminid);
        console.log("📋 AdminSettings found:", {
          id: settings?._id,
          autoCreateLedgerOnPurchaseInvoice: settings?.autoCreateLedgerOnPurchaseInvoice,
          autoCreateStockOnPurchaseInvoice: settings?.autoCreateStockOnPurchaseInvoice,
        });

        const autoCreateData = {
          autocreate: {
            ledger: settings?.autoCreateLedgerOnPurchaseInvoice ?? true,
            payment: autoPayment === false
              ? false
              : (settings?.autoCreatePaymentOnPurchaseInvoice ?? true),
            stock: settings?.autoCreateStockOnPurchaseInvoice ?? true,
          },
        };
        console.log("✅ AutoCreate data prepared:", JSON.stringify(autoCreateData, null, 2));

        // ✅ Step 4: Create Purchase Invoice in Database
        console.log("\n📌 Step 4: Create Purchase Invoice in Database");
        console.log("   Creating with data keys:", Object.keys({...input, ...createdbyData, ...autoCreateData}));

        const created = await PurchaseInvoice.create({ ...input, ...createdbyData, ...autoCreateData });

        // Converting an order → invoice confirms the source order (canonical
        // status), exactly as the sales side does.
        if (input.sourceorderid) {
          try {
            await PurchaseOrder.findByIdAndUpdate(input.sourceorderid, {
              $set: { isConverted: true, orderStatus: "confirmed" },
            });
          } catch (e) { /* best-effort */ }
        }
        console.log("✅ Invoice created successfully");
        console.log("   Invoice ID:", created._id);
        console.log("   CreatedBy ID:", created.createdby_id);
        console.log("   CreatedBy Name:", created.createdby_name);
        console.log("   CreatedBy Type:", created.createdby_type);
        console.log("   AutoCreate:", created.autocreate);
        console.log("   Products in invoice:", created.productservice?.length || 0);
        console.log("   Other Charges in invoice:", created.othercharges?.length || 0);

        // ✅ Step 5: Adjust Stock and Transactions
        console.log("\n📌 Step 5: Adjust Stock and Transactions");
        try {
          await PurchaseInvoice.adjustStockAndTransactions(null, created, createdbyData);

          // Apply any advance this party has already paid to the new bill.
          // Allocation-only — the ledger was credited when the advance arrived, so
          // no journal entry is created (Tally's bill-adjustment journal is net-zero
          // for the same reason). Best-effort: never fail a valid invoice over this.
          try {
            const settings: any = await AdminSettings.getOrCreateForAdmin(created.adminid);
            if (settings?.autoAdjustAdvanceOnInvoice !== false) {
              const used = await autoAdjustAdvances({
                invoiceid: created._id,
                invoicemodel: "PurchaseInvoice",
                partyid: created.partyacc,
                adminid: created.adminid,
              });
              if (used > 0) console.log(`Applied advance of ${used} to PurchaseInvoice ${created.billnumber}`);
            }
          } catch (e: any) {
            console.warn("Advance auto-adjust skipped:", e?.message);
          }
          console.log("✅ Stock and transactions adjusted successfully");
        } catch (stockError: any) {
          console.warn("⚠️ Stock adjustment warning:", stockError.message);
          // Don't throw - just warn
        }

        // ✅ Step 6: Fetch and Format Invoice
        console.log("\n📌 Step 6: Fetch and Format Invoice");
        console.log("   Populating fields:", populateFields);

        const invoice = await PurchaseInvoice.findById(created._id)
          .populate(populateFields)
          .lean() as any;

        if (!invoice) {
          throw new Error("❌ Failed to fetch created invoice");
        }

        console.log("✅ Invoice fetched successfully");
        console.log("   Has partyacc:", !!(invoice?.partyacc));
        console.log("   Has productservice:", !!(invoice?.productservice));
        console.log("   Has othercharges:", !!(invoice?.othercharges));
        console.log("   Has createdby_id:", !!(invoice?.createdby_id));

        const formatted = formatInvoice(invoice);
        console.log("✅ Invoice formatted successfully");

        console.log("\n╔═══════════════════════════════════════════════════════╗");
        console.log("║  ✅ ADD PURCHASE INVOICE - SUCCESS                    ║");
        console.log("╚═══════════════════════════════════════════════════════╝\n");

        return formatted;
      } catch (error: any) {
        console.error("\n");
        console.error("╔═══════════════════════════════════════════════════════╗");
        console.error("║  ❌ ERROR CREATING PURCHASE INVOICE                   ║");
        console.error("╚═══════════════════════════════════════════════════════╝");
        console.error("Error Type:", error.constructor.name);
        console.error("Error Message:", error.message);
        console.error("Error Stack:", error.stack);
        console.error("Full Error Object:", JSON.stringify(error, null, 2));
        console.error("Input that caused error:", JSON.stringify(input, null, 2));
        console.error("");
        throw error;
      }
    },

    editPurchaseInvoice: async (_: any, { id, input }: any, context: any) => {
      try {
        console.log("\n");
        console.log("╔═══════════════════════════════════════════════════════╗");
        console.log("║  🔵 EDIT PURCHASE INVOICE - START                     ║");
        console.log("╚═══════════════════════════════════════════════════════╝");

        console.log("📌 Invoice ID:", id);

        const { user } = context;
        const userContext = {
          createdby_id: user?.id,
          createdby_name: user?.name || user?.email,
          createdby_type: user?.type || 'admin',
        };
        console.log("✅ User Context:", JSON.stringify(userContext, null, 2));

        const oldInv = await PurchaseInvoice.findById(id);
        if (!oldInv) {
          throw new Error("❌ Purchase invoice not found with ID: " + id);
        }
        console.log("✅ Old invoice found");

        // ✅ Always use AdminSettings for autocreate (ignore user input)
        const settings = await AdminSettings.getOrCreateForAdmin(oldInv.adminid);
        const autoCreateData = {
          autocreate: {
            ledger: settings?.autoCreateLedgerOnPurchaseInvoice ?? true,
            payment: settings?.autoCreatePaymentOnPurchaseInvoice ?? true,
            stock: settings?.autoCreateStockOnPurchaseInvoice ?? true,
          },
        };
        console.log("✅ AdminSettings fetched, AutoCreate data:", JSON.stringify(autoCreateData, null, 2));

        const updated = await PurchaseInvoice.findByIdAndUpdate(id, { ...input, ...autoCreateData }, { new: true });
        if (!updated) {
          throw new Error("❌ Failed to update invoice");
        }
        console.log("✅ Invoice updated in database");

        if (updated) {
          console.log("📌 Adjusting stock and transactions...");
          await PurchaseInvoice.adjustStockAndTransactions(oldInv, updated, userContext);
          console.log("✅ Stock and transactions adjusted");
        }

        const inv = await PurchaseInvoice.findById(id)
          .populate(populateFields)
          .lean() as any;

        if (!inv) {
          throw new Error("❌ Failed to fetch updated invoice");
        }

        const formatted = formatInvoice(inv);

        console.log("╔═══════════════════════════════════════════════════════╗");
        console.log("║  ✅ EDIT PURCHASE INVOICE - SUCCESS                   ║");
        console.log("╚═══════════════════════════════════════════════════════╝\n");

        return formatted;
      } catch (error: any) {
        console.error("\n");
        console.error("╔═══════════════════════════════════════════════════════╗");
        console.error("║  ❌ ERROR EDITING PURCHASE INVOICE                    ║");
        console.error("╚═══════════════════════════════════════════════════════╝");
        console.error("Error Message:", error.message);
        console.error("Error Stack:", error.stack);
        console.error("");
        throw error;
      }
    },

    deletePurchaseInvoice: async (_: any, { id }: { id: string }) => {
      const result = await PurchaseInvoice.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },

    resetPurchaseInvoice: async (_: any, { id }: { id: string }) => {
      const result = await PurchaseInvoice.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    },

    // Build the invoice from the order and hand it to addPurchaseInvoice, so
    // all the auto-posting (ledger / stock / payment) runs exactly the same.
    // Mirrors convertSalesOrderToInvoice.
    //
    // `autoPayment` is an INTERNAL arg (not in the schema): the
    // purchase-order-only auto-conversion passes false so no payment is posted
    // and the bill stays open. The invoice keeps the ORDER's own payment type —
    // a plain mirror, nothing rewritten.
    convertPurchaseOrderToInvoice: async (_: any, { id, autoPayment }: any, context: any) => {
      const order: any = await PurchaseOrder.findById(id).lean();
      if (!order) throw new Error("Purchase Order not found");
      if (order.isConverted) throw new Error("This order is already converted to an invoice.");
      if (order.cancelStatus === "cancelled") throw new Error("A cancelled order cannot be converted.");

      const str = (v: any) => (v == null ? null : v.toString());
      const input: any = {
        adminid: str(order.adminid),
        branchid: str(order.branchid),
        paymenttype: order.paymenttype,
        partyacc: str(order.partyacc),
        taxorsupplytype: order.taxorsupplytype || "regular",
        billdate: new Date().toISOString().slice(0, 10),
        billtype: (order.billtype && order.billtype !== "order") ? order.billtype : "taxInvoice",
        notes: order.notes,
        // PurchaseInvoice requires invoicetype (the sales side has no such
        // field). The add/edit form fills it from the order's ordertype and
        // falls back to "retail" — do exactly the same here.
        invoicetype: order.ordertype || "retail",
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
          purchaseunitid: str(p.purchaseunitid),
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
        sourceorderid: str(order._id),
      };

      return await (purchaseInvoiceResolvers as any).Mutation.addPurchaseInvoice(_, { input, autoPayment }, context);
    },
  },

  PurchaseInvoice: {
    outstanding: async (parent: any) =>
      getInvoiceOutstanding({ invoiceid: parent?.id, invoicemodel: "PurchaseInvoice" }),
    // Number of the Purchase Order this bill came from ("000001"). A
    // purchase-order-only business never sees an invoice number, so the payment
    // screen labels the bill with this instead.
    sourceorderno: async (parent: any) => {
      try {
        const oid = refId(parent?.sourceorderid);
        if (!oid) return null;
        const order: any = await PurchaseOrder.findById(oid).select("billnumber").lean();
        return order?.billnumber || null;
      } catch (e) {
        return null;
      }
    },
  },
};
