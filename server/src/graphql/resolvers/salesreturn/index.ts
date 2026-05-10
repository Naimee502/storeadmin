// Sales Return resolvers — mirror salesinvoice resolvers but include
// quantity validation against the source SalesInvoice.

import { SalesReturn } from "../../../models/salesreturn";
import { SalesInvoice } from "../../../models/salesinvoice";

const toSimpleRef = (doc: any, keys: string[] = ["name"]) => {
  if (!doc) return null;
  const ref: any = { id: doc._id?.toString() };
  keys.forEach(k => { ref[k] = doc[k] ?? doc.name ?? null; });
  return ref;
};

const populateFields = [
  "salesmenid",
  "partyacc",
  "productservice.productserviceid",
  "productservice.salesunitid",
  "productservice.salesaccountid",
  "productservice.purchaseaccountid",
  "productservice.serviceaccountid",
];

const formatReturn = (r: any) => ({
  ...r,
  id: r._id.toString(),
  sourceInvoiceId: r.sourceInvoiceId?.toString?.() ?? r.sourceInvoiceId,
  salesmenid: toSimpleRef(r.salesmenid, ["name"]),
  partyacc: toSimpleRef(r.partyacc, ["accountname", "mobile"]),
  productservice: r.productservice?.map((ps: any) => {
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
  }) ?? [],
});

// ---------------------------------------------------------------------------
// Validate that the user is not returning more qty per line than what was
// originally invoiced. Sums prior returns against the same source invoice.
// Throws if any line is over-returned. Pass `excludeReturnId` when editing
// an existing return so we don't double-count it.
// ---------------------------------------------------------------------------
async function validateReturnQuantities(input: any, excludeReturnId?: string) {
  const sourceInv: any = await SalesInvoice.findById(input.sourceInvoiceId).lean();
  if (!sourceInv) throw new Error("Source Sales Invoice not found");
  if (sourceInv.status === false) throw new Error("Source Sales Invoice has been deleted");
  if (String(sourceInv.adminid) !== String(input.adminid)) {
    throw new Error("Source invoice does not belong to this admin");
  }

  // Sum already-returned qty for this source, excluding the one being edited
  const priorQuery: any = {
    sourceInvoiceId: input.sourceInvoiceId,
    status: true,
  };
  if (excludeReturnId) priorQuery._id = { $ne: excludeReturnId };
  const priorReturns: any[] = await SalesReturn.find(priorQuery).lean();

  const returnedSoFar: Record<string, number> = {};
  for (const ret of priorReturns) {
    for (const line of ret.productservice ?? []) {
      const key = `${line.productserviceid}_${line.variantid ?? ""}`;
      returnedSoFar[key] = (returnedSoFar[key] || 0) + Number(line.qty || 0);
    }
  }

  // Per source-invoice line, get the originally-invoiced qty
  const invoicedQty: Record<string, number> = {};
  for (const line of sourceInv.productservice ?? []) {
    const key = `${line.productserviceid}_${line.variantid ?? ""}`;
    invoicedQty[key] = (invoicedQty[key] || 0) + Number(line.qty || 0);
  }

  // Validate each requested return line
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

export const salesReturnResolvers = {
  Query: {
    getSalesReturns: async (_: any, { filter = {} }: { filter?: any }) => {
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
      const rows = await SalesReturn.find(q).populate(populateFields).lean();
      return rows.map(formatReturn);
    },

    getDeletedSalesReturns: async (_: any, { filter = {} }: { filter?: any }) => {
      const q: any = { status: false };
      if (filter.adminid) q.adminid = filter.adminid;
      if (filter.branchid) q.branchid = filter.branchid;
      const rows = await SalesReturn.find(q).populate(populateFields).lean();
      return rows.map(formatReturn);
    },

    getSalesReturnById: async (_: any, { id }: { id: string }) => {
      const r = await SalesReturn.findById(id).populate(populateFields).lean();
      return r ? formatReturn(r) : null;
    },
  },

  Mutation: {
    addSalesReturn: async (_: any, { input }: any) => {
      const sourceInv = await validateReturnQuantities(input);
      // Stamp source bill number for friendly display
      if (sourceInv?.billnumber && !input.sourceBillNumber) {
        input.sourceBillNumber = sourceInv.billnumber;
      }
      const created = await SalesReturn.create(input);
      const fresh = await SalesReturn.findById(created._id).populate(populateFields).lean();
      return formatReturn(fresh);
    },

    editSalesReturn: async (_: any, { id, input }: any) => {
      await validateReturnQuantities(input, id);
      const oldRet = await SalesReturn.findById(id);
      if (!oldRet) throw new Error("Sales Return not found");
      const updated = await SalesReturn.findByIdAndUpdate(id, input, { new: true });
      if (updated) {
        await SalesReturn.adjustStockAndTransactions(oldRet, updated);
      }
      const fresh = await SalesReturn.findById(id).populate(populateFields).lean();
      return fresh ? formatReturn(fresh) : null;
    },

    deleteSalesReturn: async (_: any, { id }: { id: string }) => {
      // Soft delete only — we keep the journal entries posted so reports stay
      // consistent. Hard reversal of stock/journal happens via resetSalesReturn
      // → toggling back to true rerun adjust on next save if needed.
      return !!(await SalesReturn.findByIdAndUpdate(id, { status: false }));
    },

    resetSalesReturn: async (_: any, { id }: { id: string }) => {
      return !!(await SalesReturn.findByIdAndUpdate(id, { status: true }));
    },
  },
};
