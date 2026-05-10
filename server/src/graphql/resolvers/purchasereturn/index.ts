// Purchase Return resolvers — same pattern as sales return, including
// per-line quantity validation against the source PurchaseInvoice.

import { PurchaseReturn } from "../../../models/purchasereturn";
import { PurchaseInvoice } from "../../../models/purchaseinvoice";

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
];

const formatReturn = (r: any) => ({
  ...r,
  id: r._id.toString(),
  sourceInvoiceId: r.sourceInvoiceId?.toString?.() ?? r.sourceInvoiceId,
  partyacc: toSimpleRef(r.partyacc, ["accountname", "mobile"]),
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
    getPurchaseReturns: async (_: any, { filter = {} }: { filter?: any }) => {
      const q: any = { status: true };
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

    getDeletedPurchaseReturns: async (_: any, { filter = {} }: { filter?: any }) => {
      const q: any = { status: false };
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
    addPurchaseReturn: async (_: any, { input }: any) => {
      const sourceInv = await validateReturnQuantities(input);
      if (sourceInv?.billnumber && !input.sourceBillNumber) {
        input.sourceBillNumber = sourceInv.billnumber;
      }
      const created = await PurchaseReturn.create(input);
      const fresh = await PurchaseReturn.findById(created._id).populate(populateFields).lean();
      return formatReturn(fresh);
    },

    editPurchaseReturn: async (_: any, { id, input }: any) => {
      await validateReturnQuantities(input, id);
      const oldRet = await PurchaseReturn.findById(id);
      if (!oldRet) throw new Error("Purchase Return not found");
      const updated = await PurchaseReturn.findByIdAndUpdate(id, input, { new: true });
      if (updated) {
        await PurchaseReturn.adjustStockAndTransactions(oldRet, updated);
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
