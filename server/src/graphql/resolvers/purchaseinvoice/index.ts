import { PurchaseInvoice } from "../../../models/purchaseinvoice";
import { AdminSettings } from "../../../models/adminsettings";

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
];

// ✅ Format invoice function
const formatInvoice = (inv: any) => ({
  ...inv,
  id: inv._id.toString(),
  partyacc: toSimpleRef(inv.partyacc, ["accountname", "mobile"]),
  autocreate: inv.autocreate || { ledger: true, stock: true },

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

      if (filter.branchid) query.branchid = filter.branchid;
      if (filter.adminid) query.adminid = filter.adminid;
      if (filter.supplierid) query.supplierid = filter.supplierid;
      if (filter.paymenttype) query.paymenttype = filter.paymenttype;
      if (filter.partyacc) query.partyacc = { $regex: filter.partyacc, $options: "i" };
      if (filter.billtype) query.billtype = filter.billtype;
      if (filter.invoicetype) query.invoicetype = filter.invoicetype;
      if (filter.billdateFrom || filter.billdateTo) {
        query.billdate = {};
        if (filter.billdateFrom) query.billdate.$gte = new Date(filter.billdateFrom);
        if (filter.billdateTo) query.billdate.$lte = new Date(filter.billdateTo);
      }

      const invoices = await PurchaseInvoice.find(query)
        .populate(populateFields)
        .lean();
      return invoices.map(formatInvoice);
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
      const invoice = await PurchaseInvoice.findById(id)
        .populate(populateFields)
        .lean();
      return invoice ? formatInvoice(invoice) : null;
    },
  },

  Mutation: {
    addPurchaseInvoice: async (_: any, { input }: any, context: any) => {
      try {
        // ✅ Extract user info from context and populate createdby fields
        const { user } = context;
        const createdbyData = {
          createdby_id: user?.id,
          createdby_name: user?.name || user?.email,
          createdby_type: user?.type || 'admin',
        };

        console.log("=== Purchase Invoice Create ===");
        console.log("User from context:", user);
        console.log("CreatedbyData:", createdbyData);

        // ✅ Always use AdminSettings for autocreate (ignore user input)
        const settings = await AdminSettings.getOrCreateForAdmin(input.adminid);
        console.log("📋 AdminSettings fetched:", {
          autoCreateLedgerOnPurchaseInvoice: settings?.autoCreateLedgerOnPurchaseInvoice,
          autoCreateStockOnPurchaseInvoice: settings?.autoCreateStockOnPurchaseInvoice,
        });

        const autoCreateData = {
          autocreate: {
            ledger: settings?.autoCreateLedgerOnPurchaseInvoice ?? true,
            stock: settings?.autoCreateStockOnPurchaseInvoice ?? true,
          },
        };

        console.log("✅ AutoCreate data being saved:", autoCreateData);

        const created = await PurchaseInvoice.create({ ...input, ...createdbyData, ...autoCreateData });
        console.log("✅ Created invoice autocreate:", created.autocreate);

        console.log("Created Purchase Invoice:", {
          id: created._id,
          createdby_id: created.createdby_id,
          createdby_name: created.createdby_name,
          createdby_type: created.createdby_type
        });

        // ✅ Explicitly call adjustStockAndTransactions WITH userContext
        // (ensures Transaction/Payment Created By is never N/A)
        await PurchaseInvoice.adjustStockAndTransactions(null, created, createdbyData);

        const invoice = await PurchaseInvoice.findById(created._id)
          .populate(populateFields)
          .lean();
        return invoice ? formatInvoice(invoice) : null;
      } catch (error: any) {
        console.error("=== ERROR Creating Purchase Invoice ===");
        console.error("Error message:", error.message);
        console.error("Full error:", error);
        throw error;
      }
    },

    editPurchaseInvoice: async (_: any, { id, input }: any, context: any) => {
      const { user } = context;
      const userContext = {
        createdby_id: user?.id,
        createdby_name: user?.name || user?.email,
        createdby_type: user?.type || 'admin',
      };

      const oldInv = await PurchaseInvoice.findById(id);
      if (!oldInv) throw new Error("Purchase invoice not found");

      // ✅ Always use AdminSettings for autocreate (ignore user input)
      const settings = await AdminSettings.getOrCreateForAdmin(oldInv.adminid);
      const autoCreateData = {
        autocreate: {
          ledger: settings?.autoCreateLedgerOnPurchaseInvoice ?? true,
          stock: settings?.autoCreateStockOnPurchaseInvoice ?? true,
        },
      };

      const updated = await PurchaseInvoice.findByIdAndUpdate(id, { ...input, ...autoCreateData }, { new: true });
      if (updated) {
        await PurchaseInvoice.adjustStockAndTransactions(oldInv, updated, userContext);
      }

      const inv = await PurchaseInvoice.findById(id)
        .populate(populateFields)
        .lean();
      return inv ? formatInvoice(inv) : null;
    },

    deletePurchaseInvoice: async (_: any, { id }: { id: string }) => {
      const result = await PurchaseInvoice.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },

    resetPurchaseInvoice: async (_: any, { id }: { id: string }) => {
      const result = await PurchaseInvoice.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    },
  },
};
