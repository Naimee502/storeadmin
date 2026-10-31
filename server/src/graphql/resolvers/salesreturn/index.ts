// Sales Return resolvers — mirror salesinvoice resolvers but include
// quantity validation against the source SalesInvoice.

import { SalesReturn } from "../../../models/salesreturn";
import { SalesInvoice } from "../../../models/salesinvoice";
import { AdminSettings } from "../../../models/adminsettings";
import { StaffAccount } from "../../../models/staffaccounts";
import { Account } from "../../../models/accounts";
import { requireBackofficeTenant } from "../../../utils/tenant";
import { SalesOrder } from "../../../models/salesorder";

/** orderId → order billnumber, for invoices converted from a Sales Order. */
async function orderNumbers(orderIds: any[]) {
  const ids = orderIds.filter(Boolean);
  if (!ids.length) return {} as Record<string, string>;
  const orders: any[] = await SalesOrder.find({ _id: { $in: ids } }).select("billnumber").lean();
  return Object.fromEntries(orders.map((o) => [String(o._id), String(o.billnumber ?? "")])) as Record<string, string>;
}

/** Same line key validateReturnQuantities uses. */
const lineKey = (pid: any, vid: any) => `${pid}_${vid ?? ""}`;

/** invoiceId → { lineKey → qty already returned } over every active return. */
async function returnedQtyByInvoice(invoiceIds: any[]) {
  const out: Record<string, Record<string, number>> = {};
  if (!invoiceIds.length) return out;
  const rets: any[] = await SalesReturn.find({ sourceInvoiceId: { $in: invoiceIds }, status: true })
    .select("sourceInvoiceId productservice.productserviceid productservice.variantid productservice.qty")
    .lean();
  for (const r of rets) {
    const inv = String(r.sourceInvoiceId);
    out[inv] = out[inv] || {};
    for (const l of r.productservice ?? []) {
      const k = lineKey(l.productserviceid, l.variantid);
      out[inv][k] = (out[inv][k] || 0) + Number(l.qty || 0);
    }
  }
  return out;
}

/** invoiced qty per line key for one invoice. */
const invoicedQtyByLine = (inv: any) => {
  const m: Record<string, number> = {};
  for (const l of inv.productservice ?? []) {
    const pid = l.productserviceid?._id ?? l.productserviceid;
    const k = lineKey(pid, l.variantid);
    m[k] = (m[k] || 0) + Number(l.qty || 0);
  }
  return m;
};

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
  "othercharges.ledgerid",
];

const formatReturn = (r: any) => ({
  ...r,
  id: r._id.toString(),
  sourceInvoiceId: r.sourceInvoiceId?.toString?.() ?? r.sourceInvoiceId,
  salesmenid: toSimpleRef(r.salesmenid, ["name"]),
  partyacc: toSimpleRef(r.partyacc, ["accountname", "mobile"]),
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
  // A cancelled bill was reversed out of the books, so there is nothing to
  // return against it. Re-open the bill first if the cancellation was wrong.
  if (String(sourceInv.cancelStatus || "") === "cancelled") {
    throw new Error("Source Sales Invoice is cancelled — re-open it before booking a return against it.");
  }
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
    // Invoices the signed-in user may book a return against, newest first:
    //   delivery boy → invoices assigned to him
    //   salesman     → his own bills + every bill of a party linked to him
    //   admin/branch → the business (branch logins pinned to their branch)
    // Cancelled bills and bills already fully returned are left out.
    getReturnableSalesInvoices: async (_: any, { search }: { search?: string }, context: any) => {
      const scope = await requireBackofficeTenant(context);
      const user = context.user;
      const q: any = { adminid: scope.adminid, status: true, cancelStatus: { $ne: "cancelled" } };

      if (scope.userType === "staff") {
        const staff: any = await StaffAccount.findById(user?.id).select("role").lean();
        if (staff?.role === "deliveryboy") {
          q.deliveryboyid = user.id;
        } else {
          const parties = await Account.find({ admin: scope.adminid, salesmanid: user?.id }).select("_id").lean();
          q.$or = [
            { salesmenid: user?.id },
            { createdby_id: user?.id },
            { partyacc: { $in: parties.map((p: any) => p._id) } },
          ];
        }
      } else if (scope.branchPinned && scope.branchid) {
        q.branchid = scope.branchid;
      }

      let invs: any[] = await SalesInvoice.find(q)
        .sort({ createdAt: -1 })
        .limit(300)
        .populate("partyacc", "name accountname mobile")
        .lean();

      const orderNo = await orderNumbers(invs.map((i) => i.sourceorderid));
      const term = String(search || "").trim().toLowerCase();
      if (term) {
        invs = invs.filter((inv) =>
          `${inv.billnumber ?? ""} ${orderNo[String(inv.sourceorderid)] ?? ""} ${inv.partyacc?.name ?? inv.partyacc?.accountname ?? ""} ${inv.partyacc?.mobile ?? ""}`
            .toLowerCase()
            .includes(term)
        );
      }

      const returned = await returnedQtyByInvoice(invs.map((i) => i._id));
      const rows = invs
        .map((inv) => {
          const done = returned[String(inv._id)] || {};
          const invoiced = invoicedQtyByLine(inv);
          const returnableQty = Object.keys(invoiced).reduce(
            (sum, k) => sum + Math.max(0, invoiced[k] - (done[k] || 0)),
            0
          );
          return {
            id: String(inv._id),
            billnumber: inv.billnumber,
            billdate: inv.billdate,
            totalamount: inv.totalamount,
            partyId: inv.partyacc?._id ? String(inv.partyacc._id) : null,
            partyName: inv.partyacc?.name ?? inv.partyacc?.accountname ?? "",
            partyMobile: inv.partyacc?.mobile ?? "",
            deliveryStatus: inv.deliveryStatus,
            orderNumber: inv.sourceorderid ? orderNo[String(inv.sourceorderid)] || null : null,
            returnableQty,
          };
        })
        .filter((r) => r.returnableQty > 0);
      return rows.slice(0, 100);
    },

    getSalesReturnDraft: async (_: any, { sourceInvoiceId }: { sourceInvoiceId: string }, context: any) => {
      const scope = await requireBackofficeTenant(context);
      const inv: any = await SalesInvoice.findById(sourceInvoiceId)
        .populate("partyacc", "name accountname mobile")
        .populate("productservice.productserviceid", "name productvariants")
        .populate("productservice.salesunitid", "unitname")
        .lean();
      if (!inv || inv.status === false) throw new Error("Invoice not found");
      if (String(inv.adminid) !== String(scope.adminid)) throw new Error("Invoice not found");
      if (String(inv.cancelStatus || "") === "cancelled") {
        throw new Error("This invoice is cancelled — nothing can be returned against it.");
      }

      const done = (await returnedQtyByInvoice([inv._id]))[String(inv._id)] || {};
      // Several invoice lines can share one product/variant; earlier returns are
      // counted against them in order, so each line shows what is left of it.
      const used: Record<string, number> = {};
      const lines = (inv.productservice ?? []).map((l: any) => {
        const product = l.productserviceid;
        const pid = product?._id ?? l.productserviceid;
        const k = lineKey(pid, l.variantid);
        const invoicedQty = Number(l.qty || 0);
        const pool = Math.max(0, (done[k] || 0) - (used[k] || 0));
        const returnedQty = Math.min(invoicedQty, pool);
        used[k] = (used[k] || 0) + returnedQty;
        const variant = (product?.productvariants ?? []).find((v: any) => String(v._id) === String(l.variantid));
        return {
          productserviceid: String(pid),
          productName: product?.name ?? "Item",
          variantid: l.variantid ? String(l.variantid) : null,
          variantName: variant?.name ?? null,
          salesunitid: l.salesunitid?._id ? String(l.salesunitid._id) : (l.salesunitid ? String(l.salesunitid) : null),
          unitname: l.salesunitid?.unitname ?? null,
          unitqty: l.unitqty || 1,
          gst: Number(l.gst || 0),
          rate: Number(l.rate || 0),
          discount: Number(l.discount || 0),
          invoicedQty,
          returnedQty,
          returnableQty: Math.max(0, invoicedQty - returnedQty),
        };
      });

      return {
        invoiceId: String(inv._id),
        billnumber: inv.billnumber,
        billdate: inv.billdate,
        orderNumber: inv.sourceorderid ? (await orderNumbers([inv.sourceorderid]))[String(inv.sourceorderid)] || null : null,
        adminid: String(inv.adminid),
        branchid: inv.branchid ? String(inv.branchid) : null,
        partyId: inv.partyacc?._id ? String(inv.partyacc._id) : null,
        partyName: inv.partyacc?.name ?? inv.partyacc?.accountname ?? "",
        partyMobile: inv.partyacc?.mobile ?? "",
        salesmenid: inv.salesmenid ? String(inv.salesmenid) : null,
        paymenttype: inv.paymenttype,
        billtype: inv.billtype,
        taxorsupplytype: inv.taxorsupplytype,
        invoicetype: inv.invoicetype,
        isservice: !!inv.isservice,
        lines,
      };
    },

    getSalesReturns: async (_: any, { filter = {} }: { filter?: any }, context: any) => {
      const q: any = { status: true };
      const { user } = context;

      // ✅ Role-based filtering
      // Admin: see all | Branch: see their branch entries | Staff: see their own entries
      if (user?.type === 'branch') {
        q.$or = [
          { createdby_type: 'branch', createdby_id: user?.id },
          { branchid: user?.branch_id || user?.id }
        ];
      } else if (user?.type === 'staff') {
        q.createdby_id = user?.id;
      }
      // Admin sees all entries (no additional filter)

      if (filter.adminid) q.adminid = filter.adminid;
      if (filter.branchid) q.branchid = filter.branchid;
      if (filter.sourceInvoiceId) q.sourceInvoiceId = filter.sourceInvoiceId;
      if (filter.partyacc) q.partyacc = filter.partyacc;
      if (filter.returndateFrom || filter.returndateTo) {
        q.returndate = {};
        if (filter.returndateFrom) q.returndate.$gte = filter.returndateFrom;
        if (filter.returndateTo) q.returndate.$lte = filter.returndateTo;
      }
      const rows = await SalesReturn.find(q).sort({ createdAt: 1, _id: 1 }).populate(populateFields).lean();
      return rows.map(formatReturn);
    },

    getDeletedSalesReturns: async (_: any, { filter = {} }: { filter?: any }, context: any) => {
      const q: any = { status: false };
      const { user } = context;

      // ✅ Role-based filtering (same logic as getSalesReturns)
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
      const rows = await SalesReturn.find(q).sort({ createdAt: 1, _id: 1 }).populate(populateFields).lean();
      return rows.map(formatReturn);
    },

    getSalesReturnById: async (_: any, { id }: { id: string }) => {
      const r = await SalesReturn.findById(id).populate(populateFields).lean();
      return r ? formatReturn(r) : null;
    },
  },

  Mutation: {
    addSalesReturn: async (_: any, { input }: any, context: any) => {
      try {
        const sourceInv = await validateReturnQuantities(input);
        // Stamp source bill number for friendly display
        if (sourceInv?.billnumber && !input.sourceBillNumber) {
          input.sourceBillNumber = sourceInv.billnumber;
        }

        // The goods go back to the branch that shipped them, never to whichever
        // branch happens to be selected in the header when the credit note is
        // written. Sending them elsewhere left the selling branch permanently
        // short (its stock was deducted by the invoice and restored to another
        // branch's row), so the source invoice decides.
        if (sourceInv?.branchid) input.branchid = sourceInv.branchid;

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
            stock: settings?.autoCreateStockOnSalesReturn ?? true,
          },
        };

        const created = await SalesReturn.create({ ...input, ...createdbyData, ...autoCreateData });

        // ✅ Explicitly call adjustStockAndTransactions WITH userContext
        // (ensures Transaction/Payment Created By is never N/A)
        await SalesReturn.adjustStockAndTransactions(null, created, createdbyData);

        console.log("=== Sales Return Created Successfully ===");
        console.log("Bill Number:", created.billnumber);
        console.log("CreatedBy:", createdbyData);

        const fresh = await SalesReturn.findById(created._id).populate(populateFields).lean();
        return formatReturn(fresh);
      } catch (error: any) {
        console.error("=== ERROR Creating Sales Return ===");
        console.error("Error message:", error.message);
        console.error("Full error:", error);
        throw error;
      }
    },

    editSalesReturn: async (_: any, { id, input }: any, context: any) => {
      const sourceInv: any = await validateReturnQuantities(input, id);
      const oldRet = await SalesReturn.findById(id);
      if (!oldRet) throw new Error("Sales Return not found");

      // Stock goes back to the invoice's branch — same reason as on create.
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
          stock: settings?.autoCreateStockOnSalesReturn ?? true,
        },
      } : {
        autocreate: {
          stock: settings?.autoCreateStockOnSalesReturn ?? true,
        },
      };

      const updated = await SalesReturn.findByIdAndUpdate(id, { ...input, ...autoCreateData }, { new: true });
      if (updated) {
        await SalesReturn.adjustStockAndTransactions(oldRet, updated, userContext);
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

  SalesReturn: {
    // Which Sales Order the returned bill came from — field staff know their
    // orders by SO number, not by the invoice it became.
    sourceOrderNumber: async (parent: any) => {
      try {
        if (!parent?.sourceInvoiceId) return null;
        const inv: any = await SalesInvoice.findById(parent.sourceInvoiceId).select("sourceorderid").lean();
        if (!inv?.sourceorderid) return null;
        return (await orderNumbers([inv.sourceorderid]))[String(inv.sourceorderid)] || null;
      } catch {
        return null;
      }
    },
  }
};
