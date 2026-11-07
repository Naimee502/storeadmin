// Purchase Return resolvers — same pattern as sales return, including
// per-line quantity validation against the source PurchaseInvoice.

import { PurchaseReturn } from "../../../models/purchasereturn";
import { PurchaseInvoice } from "../../../models/purchaseinvoice";
import { AdminSettings } from "../../../models/adminsettings";
import { Account } from "../../../models/accounts";
import { asText, dmyFromText, escapeRegex, notCleared, pageWindow, textMatch } from "../../../utils/listquery";

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

// Listing variant — each populated doc carries only what formatReturn copies
// out (toSimpleRef keys + its `name` fallback; product name + variant names).
// Used ONLY by getPurchaseReturns; every other resolver keeps populateFields.
const listPopulateFields: any[] = [
  { path: "partyacc", select: "name accountname mobile city" },
  { path: "productservice.productserviceid", select: "name productvariants._id productvariants.name" },
  { path: "productservice.purchaseunitid", select: "name unitname" },
  { path: "productservice.salesaccountid", select: "name ledgername" },
  { path: "productservice.purchaseaccountid", select: "name ledgername" },
  { path: "productservice.serviceaccountid", select: "name ledgername" },
  { path: "othercharges.ledgerid", select: "name ledgername" },
];

const formatReturn = (r: any) => ({
  ...r,
  id: r._id.toString(),
  sourceInvoiceId: r.sourceInvoiceId?.toString?.() ?? r.sourceInvoiceId,
  // City is read directly (not via toSimpleRef, which would fall back to the
  // party NAME when the city is empty) so the list can show "Name · City".
  partyacc: r.partyacc
    ? { ...toSimpleRef(r.partyacc, ["accountname", "mobile"]), city: r.partyacc.city ?? null }
    : null,
  // Journals are no longer optional, so this is always true. Kept in the schema
  // so existing clients querying the field keep working.
  autocreate: true,

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
  // A cancelled bill was reversed out of the books, so there is nothing to
  // return against it. Re-open the bill first if the cancellation was wrong.
  if (String(sourceInv.cancelStatus || "") === "cancelled") {
    throw new Error("Source Purchase Invoice is cancelled — re-open it before booking a return against it.");
  }
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

/** Role and filter scoping shared by every purchase return list. */
function buildPurchaseReturnQuery(filter: any, context: any): any {
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
  return q;
}

/** "Name - Mobile - City" exactly as the list builds it (city has no name fallback here). */
const partyLabelExpr = {
  $reduce: {
    input: {
      $filter: {
        input: [
          { $trim: { input: { $toString: { $ifNull: ["$accountname", { $ifNull: ["$name", ""] }] } } } },
          { $trim: { input: { $toString: { $ifNull: ["$mobile", { $ifNull: ["$name", ""] }] } } } },
          { $trim: { input: { $toString: { $ifNull: ["$city", ""] } } } },
        ],
        cond: { $ne: ["$$this", ""] },
      },
    },
    initialValue: "",
    in: { $cond: [{ $eq: ["$$value", ""] }, "$$this", { $concat: ["$$value", " - ", "$$this"] }] },
  },
};

/** Vendor column: label match, plus "N/A" rows (no party or an empty label). */
async function partyClause(base: any, term: string): Promise<any> {
  const rx = new RegExp(escapeRegex(term), "i");
  const partyIds = await PurchaseReturn.distinct("partyacc", base);
  const labels: any[] = partyIds.length
    ? await Account.aggregate([{ $match: { _id: { $in: partyIds } } }, { $project: { label: partyLabelExpr } }])
    : [];
  const ids = labels.filter((a: any) => rx.test(a.label || "") || (!a.label && rx.test("N/A"))).map((a: any) => a._id);
  if (!rx.test("N/A")) return { partyacc: { $in: ids } };
  return { $or: [{ partyacc: { $in: ids } }, { partyacc: { $nin: labels.map((a: any) => a._id) } }] };
}

/** Purchase return list columns the server can filter. */
const PURCHASE_RETURN_FILTER_KEYS = [
  "billnumber", "sourceBillNumber", "returndate", "partyacc", "totalitem", "totalqty",
  "totalamount", "refundLabel", "createdByDisplay", "statusLabel",
];

/** One column filter, matched against the text that column shows in the list. */
async function purchaseReturnColumnClause(key: string, term: string, base: any): Promise<any | null> {
  switch (key) {
    case "billnumber":
      return textMatch(asText("$billnumber"), term);
    case "sourceBillNumber":
      return textMatch(asText("$sourceBillNumber"), term);
    case "returndate":
      return textMatch(dmyFromText("$returndate"), term);
    case "partyacc":
      return partyClause(base, term);
    case "totalitem":
      return textMatch({ $toString: { $size: { $ifNull: ["$productservice", []] } } }, term);
    case "totalqty":
      return textMatch({ $toString: { $sum: { $ifNull: ["$productservice.qty", []] } } }, term);
    case "totalamount":
      return textMatch(asText("$totalamount"), term);
    case "refundLabel":
      return textMatch(asText("$refundMode"), term);
    case "createdByDisplay":
      return textMatch({ $cond: [{ $eq: [asText("$createdby_name"), ""] }, "N/A", asText("$createdby_name")] }, term);
    case "statusLabel":
      return textMatch({ $cond: ["$status", "Active", "Inactive"] }, term);
    default:
      return null;
  }
}

export const purchaseReturnResolvers = {
  Query: {
    getPurchaseReturns: async (_: any, { filter = {} }: { filter?: any }, context: any) => {
      const q: any = buildPurchaseReturnQuery(filter, context);
      const rows = await PurchaseReturn.find(q).sort({ createdAt: 1, _id: 1 }).populate(listPopulateFields).lean();
      return rows.map(formatReturn);
    },

    getPurchaseReturnsPage: async (
      _: any,
      { filter = {}, page = 1, pageSize = 25, search = "", columnFilters = [] }: { filter?: any; page?: number; pageSize?: number; search?: string; columnFilters?: any[] },
      context: any
    ) => {
      const base = buildPurchaseReturnQuery(filter || {}, context);
      const clauses: any[] = [base];

      const term = String(search || "").trim();
      if (term) {
        const any: any[] = [];
        for (const key of PURCHASE_RETURN_FILTER_KEYS) {
          const c = await purchaseReturnColumnClause(key, term, base);
          if (c) any.push(c);
        }
        clauses.push({ $or: any });
      }
      for (const f of columnFilters || []) {
        const value = String(f?.value ?? "").trim();
        if (!value) continue;
        const c = await purchaseReturnColumnClause(String(f?.key || ""), value, base);
        if (c) clauses.push(c);
      }

      const query = { $and: clauses };
      const { skip, limit } = pageWindow(page, pageSize);
      const [total, rows] = await Promise.all([
        PurchaseReturn.countDocuments(query),
        PurchaseReturn.find(query)
          .sort({ createdAt: -1, _id: -1 })
          .skip(skip)
          .limit(limit)
          .populate(listPopulateFields)
          .lean(),
      ]);
      return { items: rows.map(formatReturn), total };
    },

    getDeletedPurchaseReturns: async (_: any, { filter = {} }: { filter?: any }, context: any) => {
      const q: any = { status: false, ...notCleared };
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
      const rows = await PurchaseReturn.find(q).sort({ createdAt: 1, _id: 1 }).populate(populateFields).lean();
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

        // The goods leave the branch that received them, never whichever branch
        // is selected in the header when the debit note is written — otherwise
        // one branch keeps stock it has sent back and another goes negative.
        if ((sourceInv as any)?.branchid) input.branchid = (sourceInv as any).branchid;

        if (sourceInv?.billnumber && !input.sourceBillNumber) {
          input.sourceBillNumber = sourceInv.billnumber;
        }

        // ✅ Extract user info from context and populate createdby fields
        const { user } = context;
        const createdbyData = {
          createdby_id: user?.id,
          createdby_name: input.createdby_name || user?.name || user?.email,
          createdby_type: user?.type || input.createdby_type || 'admin',
        };

        // ✅ Set autocreate flag from AdminSettings
        const settings = await AdminSettings.getOrCreateForAdmin(input.adminid);
        const autoCreateData = {
          autocreate: {
            stock: settings?.autoCreateStockOnPurchaseReturn ?? true,
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
      const sourceInv: any = await validateReturnQuantities(input, id);
      const oldRet = await PurchaseReturn.findById(id);
      if (!oldRet) throw new Error("Purchase Return not found");

      // Stock leaves the invoice's branch — same reason as on create.
      if (sourceInv?.branchid) input.branchid = sourceInv.branchid;

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
          stock: settings?.autoCreateStockOnPurchaseReturn ?? true,
        },
      } : {
        autocreate: {
          stock: settings?.autoCreateStockOnPurchaseReturn ?? true,
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
