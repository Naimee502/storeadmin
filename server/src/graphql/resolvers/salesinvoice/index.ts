import { SalesInvoice } from "../../../models/salesinvoice";
import { AdminSettings } from "../../../models/adminsettings";
import { pushNotification } from "../../../models/notifications";
import { StaffAccount } from "../../../models/staffaccounts";
import { Account } from "../../../models/accounts";
import { Payment } from "../../../models/payments";
import { Transaction } from "../../../models/transactions";

// Role-free settled amount against an invoice (Payments + Transactions, Agst
// Ref). Single source of truth for per-invoice outstanding across app + admin.
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

// Party "outstanding" = sum of UNSETTLED sales bills (each bill's total −
// settled, only positive) — same basis as Account.outstanding on the
// salesman app. `excludeInvoiceId`, when given, leaves that one invoice out
// of the sum entirely (used for the printed "Previous Balance", which must
// reflect what the party owed BEFORE this bill — regardless of whether this
// particular bill has since been paid).
const partyBillOutstanding = async (accountId: any, excludeInvoiceId?: any): Promise<number> => {
  if (!accountId) return 0;
  const query: any = { partyacc: accountId, status: true };
  if (excludeInvoiceId) query._id = { $ne: excludeInvoiceId };
  const invs = await SalesInvoice.find(query).select("totalamount").lean();
  let sum = 0;
  for (const inv of invs as any[]) {
    const settled = await invoiceSettledAmount(inv._id);
    const due = (inv.totalamount || 0) - settled;
    if (due > 0) sum += due;
  }
  return parseFloat(sum.toFixed(2));
};

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

// Notify everyone concerned about an invoice lifecycle event (dispatched,
// delivered …). Actor ≠ admin → tell admin; always tell the assigned salesman
// (invoice's salesmenid, else the party's linked salesman) and the party —
// skipping whoever performed the action themselves. Best-effort, never throws.
const notifyInvoiceEvent = async (doc: any, context: any, event: string) => {
  try {
    if (!doc) return;
    const user = context?.user;
    const actor = await resolveCreatedBy(user, {});
    // Unidentifiable actor (expired/missing token): resolveCreatedBy defaults
    // to "admin", which would wrongly skip the admin notification. Treat as
    // unknown instead so the admin still gets notified.
    if (!user) {
      actor.createdby_type = "unknown";
      if (actor.createdby_name === "N/A") actor.createdby_name = "Unknown user";
    }
    const actorLabel = `${actor.createdby_name} (${actor.createdby_type})`;
    const invNo = `INV-${doc.billnumber || ""}`;
    const partyName = doc.partyacc?.name || doc.partyacc?.accountname || "Party";
    const amount = Number(doc.totalamount || 0).toFixed(2);
    const adminid = doc.adminid?._id || doc.adminid;
    const branchid = doc.branchid?._id || doc.branchid;

    if (actor.createdby_type !== "admin") {
      await pushNotification({
        adminid, branchid,
        targettype: "admin",
        ntype: "invoice",
        title: `Invoice ${invNo} ${event}`,
        message: `${partyName} • ₹${amount} • by ${actorLabel}`,
        webpath: "/salesinvoice",
        docmodel: "SalesInvoice",
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
        ntype: "invoice",
        title: `Invoice ${invNo} ${event}`,
        message: `${partyName} • ₹${amount} • by ${actorLabel}`,
        appscreen: "Orders",
        docmodel: "SalesInvoice",
        docid: doc._id,
      });
    }

    // Assigned delivery boy — hears about events on invoices he delivers.
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
        ntype: "invoice",
        title: `Invoice ${invNo} ${event} — ${partyName}`,
        message: `₹${amount} • by ${actorLabel}`,
        appscreen: "Orders",
        docmodel: "SalesInvoice",
        docid: doc._id,
      });
    }

    // Staff creator (staff/deliveryboy app users) — hears about lifecycle
    // changes to invoices they created, same as a salesman does.
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
        ntype: "invoice",
        title: `Invoice ${invNo} ${event}`,
        message: `${partyName} • ₹${amount} • by ${actorLabel}`,
        appscreen: "Orders",
        docmodel: "SalesInvoice",
        docid: doc._id,
      });
    }

    const partyId = doc.partyacc?._id || doc.partyacc;
    if (partyId && String(partyId) !== String(user?.id || "")) {
      await pushNotification({
        adminid, branchid,
        targettype: "party",
        targetid: partyId,
        ntype: "invoice",
        title: `Your invoice ${invNo} ${event}`,
        message: `₹${amount} • by ${actorLabel}`,
        appscreen: "Orders",
        docmodel: "SalesInvoice",
        docid: doc._id,
      });
    }

    // Channel downline: the parent (upline) party also hears about its child
    // party's invoice events.
    if (partyId) {
      const accDoc: any = await Account.findById(partyId).select("assignaccountid").lean();
      const parentId = accDoc?.assignaccountid;
      if (parentId && String(parentId) !== String(user?.id || "")) {
        await pushNotification({
          adminid, branchid,
          targettype: "party",
          targetid: parentId,
          ntype: "invoice",
          title: `Invoice ${invNo} ${event} — ${partyName}`,
          message: `₹${amount} • by ${actorLabel}`,
          appscreen: "Orders",
          docmodel: "SalesInvoice",
          docid: doc._id,
        });
      }
    }
  } catch (e) { /* notifications are best-effort */ }
};

// ✅ Format invoice function
const formatInvoice = (inv: any) => ({
  ...inv,
  id: inv._id.toString(),
  salesmenid: toSimpleRef(inv.salesmenid, ["name"]),
  partyacc: toSimpleRef(inv.partyacc, ["accountname", "mobile", "address", "city", "state", "latitude", "longitude", "gstnumber"]),
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
        // Collecting payment / settling a specific party's bills: the staff must
        // see ALL of that party's invoices (regardless of who created them),
        // exactly like the admin panel. So a party-scoped query isn't restricted.
        const isPartyScoped = !!filter.partyacc;
        let isDeliveryBoy = false;
        if (!isDeliveryView && !isPartyScoped) {
          const staff = await StaffAccount.findById(user.id).select('role').lean() as any;
          isDeliveryBoy = staff?.role === 'deliveryboy';
        }
        if (!isDeliveryView && !isDeliveryBoy && !isPartyScoped) {
          query.createdby_id = user?.id;
        }
      }

      // ── Delivery filters ──────────────────────────────────────────────
      if (filter.deliveryboyid) query.deliveryboyid = filter.deliveryboyid;
      if (filter.deliveryStatus) query.deliveryStatus = filter.deliveryStatus;
      if (filter.unassignedDelivery) {
        // Available pool: invoices not yet picked up by a delivery boy.
        query.deliveryboyid = { $in: [null, undefined] };
        query.deliveryStatus = { $ne: 'delivered' };
        // Salesman-taken orders are always salesman-fulfilled — the salesman
        // who booked the order hands it over himself. So even after they become
        // invoices they must NOT appear in the delivery-boy pool. Only
        // end-user / party / website / counter orders reach the delivery boy.
        query.orderedby_type = { $ne: 'salesman' };

        // deliveryMode = 'deliveryboy'  → full pool (all qualifying invoices).
        // deliveryMode = 'salesman'     → salesmen deliver their own parties'
        // orders, BUT parties with NO linked salesman have nobody to deliver
        // them — those still reach the delivery-boy pool.
        const settings = filter.adminid ? await AdminSettings.getOrCreateForAdmin(filter.adminid) : null;
        if (settings?.deliveryMode !== 'deliveryboy') {
          const noSalesmanParties = await Account.find({
            admin: filter.adminid,
            status: true,
            $or: [{ salesmanid: null }, { salesmanid: { $exists: false } }],
          }).select('_id').lean();
          if (!noSalesmanParties.length) return [];
          query.partyacc = { $in: noSalesmanParties.map((p: any) => p._id) };
        }
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
      if (filter.partyacc) query.partyacc = filter.partyacc;

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

      const doc: any = await SalesInvoice.findById(created._id)
        .populate(populateFields)
        .lean();

      // ── Notifications ──────────────────────────────────────────
      // Actor ≠ admin → tell admin. Back-office actor (admin/branch/staff) →
      // tell the assigned salesman (invoice's, else the party's linked
      // salesman) + the party. Skip whoever performed the action themselves.
      try {
        const invNo = `INV-${doc?.billnumber || ""}`;
        const partyName = doc?.partyacc?.name || doc?.partyacc?.accountname || "Party";
        const amount = Number(doc?.totalamount || 0).toFixed(2);
        const isConversion = !!input.sourceorderid;
        const titleBase = isConversion
          ? `Order converted to invoice ${invNo}`
          : `New invoice ${invNo} created`;
        const actorLabel = `${createdbyData.createdby_name} (${createdbyData.createdby_type})`;
        const isBackOffice = ["admin", "branch", "staff"].includes(createdbyData.createdby_type);

        if (createdbyData.createdby_type !== "admin") {
          await pushNotification({
            adminid: input.adminid,
            branchid: input.branchid,
            targettype: "admin",
            ntype: "invoice",
            title: titleBase,
            message: `${partyName} • ₹${amount} • by ${actorLabel}`,
            webpath: "/salesinvoice",
            docmodel: "SalesInvoice",
            docid: created._id,
          });
        }

        let notifiedSalesmanId: any = null; // avoid double-notifying the same staff below
        if (isBackOffice) {
          let salesmanId: any = doc?.salesmenid?._id || doc?.salesmenid || input.salesmenid;
          if (!salesmanId) {
            const partyRefId = doc?.partyacc?._id || doc?.partyacc || input.partyacc;
            if (partyRefId) {
              const acc: any = await Account.findById(partyRefId).select("salesmanid").lean();
              salesmanId = acc?.salesmanid || null;
            }
          }
          notifiedSalesmanId = salesmanId;
          if (salesmanId && String(salesmanId) !== String(createdbyData.createdby_id || "")) {
            await pushNotification({
              adminid: input.adminid,
              branchid: input.branchid,
              targettype: "staff",
              targetid: salesmanId,
              ntype: "invoice",
              title: `${titleBase} — ${partyName}`,
              message: `₹${amount} • by ${actorLabel}`,
              appscreen: "Orders",
              docmodel: "SalesInvoice",
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
              ntype: "invoice",
              title: titleBase,
              message: `₹${amount} • by ${actorLabel}`,
              appscreen: "Orders",
              docmodel: "SalesInvoice",
              docid: created._id,
            });
          }
        }

        // Channel downline (party hierarchy via assignaccountid):
        // • parent (upline) party hears about its child party's invoice;
        // • a parent converting/creating for a child also notifies the child.
        const invPartyId = doc?.partyacc?._id || doc?.partyacc || input.partyacc;
        if (invPartyId) {
          const accDoc: any = await Account.findById(invPartyId).select("assignaccountid").lean();
          const parentId = accDoc?.assignaccountid;
          if (parentId && String(parentId) !== String(createdbyData.createdby_id || "")) {
            await pushNotification({
              adminid: input.adminid,
              branchid: input.branchid,
              targettype: "party",
              targetid: parentId,
              ntype: "invoice",
              title: `${titleBase} — ${partyName}`,
              message: `₹${amount} • by ${actorLabel}`,
              appscreen: "Orders",
              docmodel: "SalesInvoice",
              docid: created._id,
            });
          }
          if (
            createdbyData.createdby_type === "party" &&
            String(createdbyData.createdby_id || "") !== String(invPartyId)
          ) {
            await pushNotification({
              adminid: input.adminid,
              branchid: input.branchid,
              targettype: "party",
              targetid: invPartyId,
              ntype: "invoice",
              title: titleBase,
              message: `₹${amount} • by ${actorLabel}`,
              appscreen: "Orders",
              docmodel: "SalesInvoice",
              docid: created._id,
            });
          }
        }

        // Conversion: the staff/salesman/deliveryboy who punched the SOURCE
        // ORDER hears that it became an invoice (e.g. staff punches order,
        // admin converts → staff gets notified).
        if (input.sourceorderid) {
          const srcOrder: any = await SalesOrder.findById(input.sourceorderid)
            .select("createdby_id createdby_type").lean();
          const srcType = String(srcOrder?.createdby_type || "").toLowerCase();
          if (
            srcOrder?.createdby_id &&
            ["staff", "salesman", "deliveryboy"].includes(srcType) &&
            String(srcOrder.createdby_id) !== String(createdbyData.createdby_id || "") &&
            String(srcOrder.createdby_id) !== String(notifiedSalesmanId || "")
          ) {
            await pushNotification({
              adminid: input.adminid,
              branchid: input.branchid,
              targettype: "staff",
              targetid: srcOrder.createdby_id,
              ntype: "invoice",
              title: `${titleBase} — ${partyName}`,
              message: `₹${amount} • by ${actorLabel}`,
              appscreen: "Orders",
              docmodel: "SalesInvoice",
              docid: created._id,
            });
          }
        }

        // New delivery in the shared pool → tell every active delivery boy.
        // Pool invoices have no deliveryboyid, so without this broadcast no
        // delivery boy would ever hear about new available deliveries.
        const settings: any = input.adminid
          ? await AdminSettings.getOrCreateForAdmin(input.adminid)
          : null;
        // Mirrors the pool filter: full pool in delivery-boy mode; in salesman
        // mode only parties WITHOUT a linked salesman reach the pool.
        let poolEligible =
          !doc?.deliveryboyid &&
          String(doc?.orderedby_type || "") !== "salesman";
        if (poolEligible && settings?.deliveryMode !== "deliveryboy") {
          const pAcc: any = invPartyId
            ? await Account.findById(invPartyId).select("salesmanid").lean()
            : null;
          poolEligible = !pAcc?.salesmanid;
        }
        if (poolEligible) {
          const boys: any[] = await StaffAccount.find({
            admin: input.adminid, role: "deliveryboy", status: true,
          }).select("_id").lean();
          for (const b of boys) {
            await pushNotification({
              adminid: input.adminid,
              branchid: input.branchid,
              targettype: "staff",
              targetid: b._id,
              ntype: "invoice",
              title: `New delivery available — ${partyName}`,
              message: `${invNo} • ₹${amount}`,
              appscreen: "Deliveries",
              docmodel: "SalesInvoice",
              docid: created._id,
            });
          }
        }
      } catch (e) { /* notifications are best-effort */ }

      return formatInvoice(doc);
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
    markSalesInvoiceDispatched: async (_: any, { id, deliveryboyid }: any, context: any) => {
      const update: any = { deliveryStatus: "dispatched" };
      if (deliveryboyid) update.deliveryboyid = deliveryboyid;
      const updated = await SalesInvoice.findByIdAndUpdate(id, update, { new: true })
        .populate(populateFields).lean();
      if (!updated) throw new Error("Invoice not found");
      await syncOrderFromInvoice(id, { orderStatus: "dispatched", deliveryStatus: "dispatched", ...(deliveryboyid ? { deliveryboyid } : {}) });
      await notifyInvoiceEvent(updated, context, "dispatched");
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
      await notifyInvoiceEvent(updated, context, "delivered");
      return formatInvoice(updated);
    },

    assignInvoiceDeliveryBoy: async (_: any, { id, deliveryboyid }: any, context: any) => {
      const updated = await SalesInvoice.findByIdAndUpdate(
        id,
        { deliveryboyid, deliveryStatus: "dispatched" },
        { new: true }
      ).populate(populateFields).lean();
      if (!updated) throw new Error("Invoice not found");
      await syncOrderFromInvoice(id, { orderStatus: "dispatched", deliveryStatus: "dispatched", deliveryboyid });
      await notifyInvoiceEvent(updated, context, "assigned for delivery");
      return formatInvoice(updated);
    },
  },

  // Per-invoice outstanding (role-free). Only computed when `outstanding` is
  // selected (e.g. bill allocation), so listings pay no cost.
  SalesInvoice: {
    outstanding: async (parent: any) => {
      const total = Number(parent?.totalamount || 0);
      const settled = await invoiceSettledAmount(parent?.id);
      return parseFloat((total - settled).toFixed(2));
    },
    // "Previous Balance" = what the party owed on their OTHER unsettled
    // bills, before this one — this invoice is excluded from the sum
    // entirely, regardless of whether it's since been paid.
    partyPreviousBalance: async (parent: any) => {
      const partyId = parent?.partyacc?.id || parent?.partyacc;
      return await partyBillOutstanding(partyId, parent?.id);
    },
    // "Current Balance" = Previous Balance + this bill's own Grand Total —
    // a running statement figure (like a physical bill), not net of whether
    // this particular bill has already been settled.
    partyCurrentBalance: async (parent: any) => {
      const partyId = parent?.partyacc?.id || parent?.partyacc;
      const previous = await partyBillOutstanding(partyId, parent?.id);
      const total = Number(parent?.totalamount || 0);
      return parseFloat((previous + total).toFixed(2));
    },
  },
};
