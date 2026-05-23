// Purchase Return resolvers — same pattern as sales return, including
// per-line quantity validation against the source PurchaseInvoice.

import { PurchaseReturn } from "../../../models/purchasereturn";
import { PurchaseInvoice } from "../../../models/purchaseinvoice";
import { AdminSettings } from "../../../models/adminsettings";

const toSimpleRef = (doc: any, keys: string[] = ["name"]) => {
  if (!doc) return null;
  const ref: any = { id: doc._id?.toString() };
  keys.forEach(k => { ref[k] = doc[k] ?? doc.name ?? null; });
  return ref;
};

const populateFields = [
  "partyacc",
  "productservice.productserviceid",
  "productservice.purchaseunitid",
  "productservice.salesaccountid",
  "productservice.purchaseaccountid",
  "productservice.serviceaccountid",
  "othercharges.ledgerid",
];

const formatReturn = (r: any) => ({
  ...r,
  id: r._id.toString(),
  sourceInvoiceId: r.sourceInvoiceId?.toString?.() ?? r.sourceInvoiceId,
  partyacc: toSimpleRef(r.partyacc, ["accountname", "mobile"]),
  // Convert autocreate object to boolean for GraphQL (DB stores as { ledger: true }, but schema expects Boolean)
  autocreate: r.autocreate?.ledger ?? r.autocreate ?? true,

  othercharges: r.othercharges?.map((oc: any) => ({
    ...oc,
    ledgerid: toSimpleRef(oc.ledgerid, ["ledgername"])
  })) ?? [],

  productservice: r.productservice?.map((ps: any) => {
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
  }) ?? [],
});

async function validateReturnQuantities(input: any, excludeReturnId?: string) {
  const sourceInv: any = await PurchaseInvoice.findById(input.sourceInvoiceId).lean();
  if (!sourceInv) throw new Error("Source Purchase Invoice not found");
  if (sourceInv.status === false) throw new Error("Source Purchase Invoice has been deleted");
  if (String(sourceInv.adminid) !== String(input.adminid)) {
    throw new Error("Source invoice does not belong to this admin");
  }

  const priorQuery: any = {
    sourceInvoiceId: input.sourceInvoiceId,
    status: true,
  };
  if (excludeReturnId) priorQuery._id = { $ne: excludeReturnId };
  const priorReturns: any[] = await PurchaseReturn.find(priorQuery).lean();

  const returnedSoFar: Record<string, number> = {};
  for (const ret of priorReturns) {
    for (const line of ret.productservice ?? []) {
      const key = `${line.productserviceid}_${line.variantid ?? ""}`;
      returnedSoFar[key] = (returnedSoFar[key] || 0) + Number(line.qty || 0);
    }
  }

  const invoicedQty: Record<string, number> = {};
  for (const line of sourceInv.productservice ?? []) {
    const key = `${line.productserviceid}_${line.variantid ?? ""}`;
    invoicedQty[key] = (invoicedQty[key] || 0) + Number(line.qty || 0);
  }

  for (const line of input.productservice ?? []) {
    const key = `${line.productserviceid}_${line.variantid ?? ""}`;
    const original = invoicedQty[key] || 0;
    const already = returnedSoFar[key] || 0;
    const requested = Number(line.qty || 0);
    const max = original - already;
    if (requested <= 0) continue;
    if (requested > max) {
      throw new Error(
        `Return qty (${requested}) exceeds available (${max}) for one of the line items. ` +
        `Originally invoiced: ${original}, already returned: ${already}.`
      );
    }
  }

  return sourceInv;
}

export const purchaseReturnResolvers = {
  Query: {
    getPurchaseReturns: async (_: any, { filter = {} }: { filter?: any }, context: any) => {
      const q: any = { status: true };
      const { user } = context;

      // ✅ Role-based filtering
      if (user?.type === 'branch') {
        q.$or = [
          { createdby_type: 'branch', createdby_id: user?.id },
          { branchid: user?.branch_id || user?.id }
        ];
      } else if (user?.type === 'staff') {
        q.createdby_id = user?.id;
      }

      if (filter.adminid) q.adminid = filter.adminid;
      if (filter.branchid) q.branchid = filter.branchid;
      if (filter.sourceInvoiceId) q.sourceInvoiceId = filter.sourceInvoiceId;
      if (filter.partyacc) q.partyacc = filter.partyacc;
      if (filter.returndateFrom || filter.returndateTo) {
        q.returndate = {};
        if (filter.returndateFrom) q.returndate.$gte = filter.returndateFrom;
        if (filter.returndateTo) q.returndate.$lte = filter.returndateTo;
      }
      const rows = await PurchaseReturn.find(q).populate(populateFields).lean();
      return rows.map(formatReturn);
    },

    getDeletedPurchaseReturns: async (_: any, { filter = {} }: { filter?: any }, context: any) => {
      const q: any = { status: false };
      const { user } = context;

      // ✅ Role-based filtering
      if (user?.type === 'branch') {
        q.$or = [
          { createdby_type: 'branch', createdby_id: user?.id },
          { branchid: user?.branch_id || user?.id }
        ];
      } else if (user?.type === 'staff') {
        q.createdby_id = user?.id;
      }

      if (filter.adminid) q.adminid = filter.adminid;
      if (filter.branchid) q.branchid = filter.branchid;
      const rows = await PurchaseReturn.find(q).populate(populateFields).lean();
      return rows.map(formatReturn);
    },

    getPurchaseReturnById: async (_: any, { id }: { id: string }) => {
      const r = await PurchaseReturn.findById(id).populate(populateFields).lean();
      return r ? formatReturn(r) : null;
    },
  },

  Mutation: {
    addPurchaseReturn: async (_: any, { input }: any, context: any) => {
      try {
        console.log("🟢 SERVER: addPurchaseReturn called");
        console.log("🟢 SERVER: Input received:", JSON.stringify(input, null, 2));

        const sourceInv = await validateReturnQuantities(input);
        console.log("🟢 SERVER: validateReturnQuantities passed");

        if (sourceInv?.billnumber && !input.sourceBillNumber) {
          input.sourceBillNumber = sourceInv.billnumber;
        }

        // ✅ Extract user info from context and populate createdby fields
        const { user } = context;
        const createdbyData = {
          createdby_id: user?.id,
          createdby_name: user?.name || user?.email,
          createdby_type: user?.type || 'admin',
        };

        // ✅ Set autocreate flag from AdminSettings
        const settings = await AdminSettings.getOrCreateForAdmin(input.adminid);
        const autoCreateData = {
          autocreate: {
            ledger: input.autocreate ?? settings?.autoCreateLedgerOnPurchaseReturn ?? true,
          },
        };

        console.log("🟢 SERVER: Creating purchase return with data");
        const created = await PurchaseReturn.create({ ...input, ...createdbyData, ...autoCreateData });
        console.log("🟢 SERVER: Purchase return created:", created._id);

        // ✅ Explicitly call adjustStockAndTransactions WITH userContext
        // (ensures Transaction/Payment Created By is never N/A)
        console.log("🟢 SERVER: Calling adjustStockAndTransactions");
        await PurchaseReturn.adjustStockAndTransactions(null, created, createdbyData);
        console.log("🟢 SERVER: adjustStockAndTransactions completed");

        const fresh = await PurchaseReturn.findById(created._id).populate(populateFields).lean();
        console.log("🟢 SERVER: Purchase return saved successfully");
        return formatReturn(fresh);
      } catch (error: any) {
        console.error("🔴 SERVER: Error in addPurchaseReturn");
        console.error("🔴 SERVER: Error name:", error.name);
        console.error("🔴 SERVER: Error message:", error.message);
        console.error("🔴 SERVER: Error stack:", error.stack);
        if (error.errors) {
          console.error("🔴 SERVER: Validation errors:", error.errors);
        }
        throw error;
      }
    },

    editPurchaseReturn: async (_: any, { id, input }: any, context: any) => {
      await validateReturnQuantities(input, id);
      const oldRet = await PurchaseReturn.findById(id);
      if (!oldRet) throw new Error("Purchase Return not found");

      // ✅ Extract user context for adjustStockAndTransactions
      const { user } = context;
      const userContext = {
        createdby_id: user?.id,
        createdby_name: user?.name || user?.email,
        createdby_type: user?.type || 'admin',
      };

      // ✅ Ensure autocreate flag from AdminSettings
      const settings = await AdminSettings.getOrCreateForAdmin(oldRet.adminid);
      const autoCreateData = input.autocreate !== undefined ? {
        autocreate: {
          ledger: input.autocreate ?? settings?.autoCreateLedgerOnPurchaseReturn ?? true,
        },
      } : {
        autocreate: {
          ledger: settings?.autoCreateLedgerOnPurchaseReturn ?? true,
        },
      };

      const updated = await PurchaseReturn.findByIdAndUpdate(id, { ...input, ...autoCreateData }, { new: true });
      if (updated) {
        await PurchaseReturn.adjustStockAndTransactions(oldRet, updated, userContext);
      }
      const fresh = await PurchaseReturn.findById(id).populate(populateFields).lean();
      return fresh ? formatReturn(fresh) : null;
    },

    deletePurchaseReturn: async (_: any, { id }: { id: string }) =>
      !!(await PurchaseReturn.findByIdAndUpdate(id, { status: false })),

    resetPurchaseReturn: async (_: any, { id }: { id: string }) =>
      !!(await PurchaseReturn.findByIdAndUpdate(id, { status: true })),
  },
};
