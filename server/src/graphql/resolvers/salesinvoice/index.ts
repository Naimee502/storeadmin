import { SalesInvoice } from "../../../models/salesinvoice";

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

// ✅ Format invoice function
const formatInvoice = (inv: any) => ({
  ...inv,
  id: inv._id.toString(),
  salesmenid: toSimpleRef(inv.salesmenid, ["name"]),
  partyacc: toSimpleRef(inv.partyacc, ["accountname", "mobile"]),
  createdby_id: inv.createdby_id,
  createdby_name: inv.createdby_name,
  createdby_type: inv.createdby_type,

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
    getSalesInvoices: async (_: any, { filter = {} }: { filter?: any }) => {
      const query: any = { status: true };

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

      const invoices = await SalesInvoice.find(query)
        .populate(populateFields)
        .lean();

      return invoices.map(formatInvoice);
    },

    getDeletedSalesInvoices: async (_: any, { filter = {} }: { filter?: any }) => {
      const query: any = { status: false };
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
    addSalesInvoice: async (_: any, { input }: any) => {
      const created = await SalesInvoice.create(input);
      return await SalesInvoice.findById(created._id)
        .populate(populateFields)
        .lean()
        .then(formatInvoice);
    },

    editSalesInvoice: async (_: any, { id, input }: any) => {
      const oldInv = await SalesInvoice.findById(id);
      if (!oldInv) throw new Error("Invoice not found");

      const updated = await SalesInvoice.findByIdAndUpdate(id, input, { new: true });

      if (updated) {
        await SalesInvoice.adjustStockAndTransactions(oldInv, updated);
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
  },
};
