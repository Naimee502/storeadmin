import { DeliveryChallan, moveChallanStock } from "../../../models/deliverychallan";
import { SalesOrder } from "../../../models/salesorder";
import { SalesInvoice } from "../../../models/salesinvoice";
import { Account } from "../../../models/accounts";
import { AdminSettings } from "../../../models/adminsettings";
import { TenantError, assertOwnedIds, requireBackofficeTenant } from "../../../utils/tenant";
import { activeFilters, containsRx, dmyFromText, notCleared, pageWindow, textMatch } from "../../../utils/listquery";
import { assertSalesStockAvailable } from "../../../utils/stockguard";
import { salesOrderMode } from "../../../utils/ordermode";
import { assertModuleOn } from "../../../utils/modulegate";
import { isActionAllowed } from "../../../utils/permissiongate";
import { createOnce, dropDeviceNumber, isoOf, raiseDeviceSeq, takeDeviceNumber } from "../../../utils/offlinesync";

export const challanPopulate: any[] = [
  { path: "partyacc", select: "name accountname mobile address city state gstnumber" },
  { path: "productservice.productserviceid", select: "name imageurl productvariants._id productvariants.name" },
  { path: "productservice.salesunitid", select: "unitname" },
];

const ref = (d: any, keys: string[]) => {
  if (!d) return null;
  const out: any = { id: String(d._id ?? d) };
  for (const k of keys) out[k] = d[k] ?? d.name ?? null;
  return out;
};

export const formatChallan = (c: any) => ({
  ...c,
  id: String(c._id),
  adminid: c.adminid ? String(c.adminid) : null,
  branchid: c.branchid ? String(c.branchid) : null,
  sourceorderid: c.sourceorderid ? String(c.sourceorderid) : null,
  sourceinvoiceid: c.sourceinvoiceid ? String(c.sourceinvoiceid) : null,
  partyacc: ref(c.partyacc, ["name", "accountname", "mobile", "address", "city", "state", "gstnumber"]),
  productservice: (c.productservice || []).map((l: any) => {
    const variant = l.productserviceid?.productvariants?.find((v: any) => String(v._id) === String(l.variantid));
    return {
      ...l,
      productserviceid: ref(l.productserviceid, ["name", "imageurl"]),
      variantid: l.variantid ? { id: String(l.variantid), name: variant?.name ?? null } : null,
      salesunitid: ref(l.salesunitid, ["unitname"]),
      unitqty: l.unitqty ?? 1,
    };
  }),
  deliveredAt: isoOf(c.deliveredAt),
  returnedAt: isoOf(c.returnedAt),
  createdAt: isoOf(c.createdAt),
  updatedAt: isoOf(c.updatedAt),
});

const loadChallan = async (id: any) => {
  const c: any = await DeliveryChallan.findById(id).populate(challanPopulate).lean();
  return c ? formatChallan(c) : null;
};

/** Tenant + branch scope of the list (and of the sync pull, without status). */
export const buildChallanQuery = (scope: { adminid: any; branchid?: any }, branchid?: any) => {
  const q: any = { adminid: scope.adminid, status: true };
  const b = scope.branchid || branchid;
  if (b) q.branchid = b;
  return q;
};

const STATUS_LABEL: Record<string, string> = { open: "Open", delivered: "Delivered", returned: "Returned" };
const REASON_LABEL: Record<string, string> = {
  sale: "Sale", jobwork: "Job Work", approval: "On Approval", repair: "Repair", branchtransfer: "Branch Transfer", other: "Other",
};
const matchLabel = (labels: Record<string, string>, term: string) =>
  Object.keys(labels).filter((k) => containsRx(term).test(labels[k]) || containsRx(term).test(k));

async function columnClause(key: string, term: string, adminid: any): Promise<any | null> {
  switch (key) {
    case "billnumber":
      return { $or: [{ billnumber: containsRx(term) }, { offlineNumber: containsRx(term) }] };
    case "partyacc": {
      const ids = await Account.find({ admin: adminid, name: containsRx(term) }).select("_id").limit(500).lean();
      return { partyacc: { $in: ids.map((a: any) => a._id) } };
    }
    case "billdate":
      return textMatch(dmyFromText("$billdate"), term);
    case "reason":
      return { reason: { $in: matchLabel(REASON_LABEL, term) } };
    case "challanStatus":
      return { challanStatus: { $in: matchLabel(STATUS_LABEL, term) } };
    case "vehiclenumber":
      return { vehiclenumber: containsRx(term) };
    case "totalamount":
      return textMatch({ $toString: "$totalamount" }, term);
    default:
      return null;
  }
}
const SEARCH_KEYS = ["billnumber", "partyacc", "billdate", "reason", "challanStatus", "vehiclenumber", "totalamount"];

/** The challan behind an invoice: the one named, else the open stock-moving challan of its order. */
export async function challanForInvoice(input: any): Promise<any | null> {
  if (input?.sourcechallanid) {
    return DeliveryChallan.findOne({ _id: input.sourcechallanid, status: true }).lean();
  }
  if (!input?.sourceorderid) return null;
  const challans: any[] = await DeliveryChallan.find({
    sourceorderid: input.sourceorderid, status: true, challanStatus: { $ne: "returned" },
  }).select("_id stockapplied").lean();
  for (const c of challans) {
    if (!(await SalesInvoice.exists({ sourcechallanid: c._id, status: true }))) return c;
  }
  return null;
}

const invoiceOf = (challanId: any) =>
  SalesInvoice.findOne({ sourcechallanid: challanId, status: true }).select("_id billnumber").lean() as Promise<any>;

const createdBy = (user: any) => ({
  createdby_id: user?.id,
  createdby_name: user?.name || user?.email,
  createdby_type: user?.type || "admin",
});

/** Lines and totals the challan copies from its order or invoice. */
const fromSource = (src: any) => ({
  partyacc: src.partyacc,
  branchid: src.branchid,
  productservice: (src.productservice || []).map((l: any) => ({
    productserviceid: l.productserviceid, variantid: l.variantid, salesunitid: l.salesunitid,
    unitqty: l.unitqty ?? 1, qty: l.qty, rate: l.rate, discount: l.discount ?? 0, gst: l.gst ?? 0, amount: l.amount,
  })),
  subtotal: src.subtotal, totaldiscount: src.totaldiscount, totalgst: src.totalgst, totalamount: src.totalamount,
  transportname: src.transportname, vehiclenumber: src.vehiclenumber, ewaybillno: src.ewaybillno,
  distance: src.distance, deliverydate: src.deliverydate,
});

// Status of the order / invoice follows the challan (full billing only; order-only modes have no dispatch).
async function syncSource(challan: any, event: "dispatched" | "delivered", context: any) {
  try {
    if ((await salesOrderMode(challan.adminid)) !== "full") return;
    if (challan.sourceinvoiceid) {
      const { salesInvoiceResolvers } = await import("../salesinvoice");
      const m: any = (salesInvoiceResolvers as any).Mutation;
      if (event === "dispatched") await m.markSalesInvoiceDispatched(null, { id: String(challan.sourceinvoiceid) }, context);
      else await m.markSalesInvoiceDelivered(null, { id: String(challan.sourceinvoiceid) }, context);
    } else if (challan.sourceorderid) {
      const { salesOrderResolvers } = await import("../salesorder");
      const m: any = (salesOrderResolvers as any).Mutation;
      if (event === "dispatched") await m.markSalesOrderDispatched(null, { id: String(challan.sourceorderid) }, context);
      else await m.markSalesOrderDelivered(null, { id: String(challan.sourceorderid) }, context);
    }
  } catch (e) {
    // The challan stands even if the source status cannot follow (e.g. a cancelled order).
    console.log("[challan] source status not updated:", (e as any)?.message);
  }
}

// Module switch and role permission, checked here too (hidden buttons are not a lock).
async function gate(scope: any, action: string) {
  // Same as the admin panel: a branch's own module list applies to branch and staff logins, not to the admin.
  const where = {
    adminid: scope.adminid,
    branchid: scope.userType === "admin" ? undefined : scope.branchid,
    staffid: scope.userType === "staff" ? scope.userId : undefined,
  };
  await assertModuleOn("deliverychallan", "Delivery Challans", where);
  if (!(await isActionAllowed("deliverychallan", action, where))) {
    throw new TenantError("You do not have permission for this Delivery Challan action.");
  }
}

async function ownChallan(id: string, context: any, action = "edit") {
  const scope = await requireBackofficeTenant(context);
  await gate(scope, action);
  const c: any = await DeliveryChallan.findById(id).lean();
  if (!c || String(c.adminid) !== String(scope.adminid)) throw new TenantError("Delivery Challan not found.", "BAD_USER_INPUT");
  return { scope, c };
}

// Goods leave stock with the challan unless an invoice already took them out.
async function wantsStock(adminid: any, input: any) {
  if (input.sourceinvoiceid) return false;
  const settings: any = await AdminSettings.getOrCreateForAdmin(adminid);
  return { on: settings?.autoCreateStockOnSalesInvoice ?? true, allowNegative: settings?.allowNegativeStock === true };
}

async function addNow(input: any, context: any) {
  const scope = await requireBackofficeTenant(context);
  await gate(scope, "add");
  const deviceNo = takeDeviceNumber("deliverychallan", input);
  const data: any = { ...input, adminid: scope.adminid };
  // An order already billed: the invoice took the stock, so the challan goes against the invoice.
  if (!data.sourceinvoiceid && data.sourceorderid) {
    const billed: any = await SalesInvoice.findOne({ sourceorderid: data.sourceorderid, adminid: scope.adminid, status: true }).select("_id").lean();
    if (billed) data.sourceinvoiceid = billed._id;
  }
  // Only one live challan per invoice: it is the invoice's delivery document.
  if (data.sourceinvoiceid) {
    const inv: any = await SalesInvoice.findById(data.sourceinvoiceid).select("adminid branchid sourceorderid").lean();
    if (!inv || String(inv.adminid) !== String(scope.adminid)) throw new TenantError("Invoice not found.", "BAD_USER_INPUT");
    if (await DeliveryChallan.exists({ sourceinvoiceid: inv._id, status: true })) throw new Error("This invoice already has a delivery challan.");
    data.branchid = inv.branchid;
    data.sourceorderid = data.sourceorderid || inv.sourceorderid;
  } else if (data.sourceorderid) {
    const ord: any = await SalesOrder.findById(data.sourceorderid).select("adminid branchid").lean();
    if (!ord || String(ord.adminid) !== String(scope.adminid)) throw new TenantError("Sales Order not found.", "BAD_USER_INPUT");
    data.branchid = ord.branchid;
  }
  data.branchid = scope.branchid || data.branchid;
  if (!data.branchid) throw new Error("Select a branch for the challan.");
  await assertOwnedIds(Account, [data.partyacc], scope.adminid, "Party");

  const stock = await wantsStock(scope.adminid, data);
  data.stockapplied = !!(stock && stock.on);
  if (stock && stock.on && !stock.allowNegative) {
    await assertSalesStockAvailable({ adminid: scope.adminid, branchid: data.branchid, productservice: data.productservice });
  }
  const created: any = await DeliveryChallan.create({ ...data, ...createdBy(context?.user) });
  if (created.stockapplied) await moveChallanStock(created, -1);
  await raiseDeviceSeq(scope.adminid, deviceNo);
  await syncSource(created, "dispatched", context);
  return loadChallan(created._id);
}

export const deliveryChallanResolvers = {
  Query: {
    getDeliveryChallansPage: async (_: any, { filter = {}, page = 1, pageSize = 10, search = "", columnFilters = [] }: any, context: any) => {
      const scope = await requireBackofficeTenant(context);
      const clauses: any[] = [buildChallanQuery(scope, filter?.branchid)];
      const term = String(search || "").trim();
      if (term) {
        const any: any[] = [];
        for (const key of SEARCH_KEYS) {
          const c = await columnClause(key, term, scope.adminid);
          if (c) any.push(c);
        }
        clauses.push({ $or: any });
      }
      for (const f of activeFilters(columnFilters)) {
        const c = await columnClause(f.key, f.value, scope.adminid);
        if (c) clauses.push(c);
      }
      const query = { $and: clauses };
      const { skip, limit } = pageWindow(page, pageSize);
      const [total, rows] = await Promise.all([
        DeliveryChallan.countDocuments(query),
        DeliveryChallan.find(query).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).populate(challanPopulate).lean(),
      ]);
      return { items: rows.map(formatChallan), total };
    },

    getDeletedDeliveryChallans: async (_: any, { filter = {} }: any, context: any) => {
      const scope = await requireBackofficeTenant(context);
      const q: any = { ...buildChallanQuery(scope, filter?.branchid), status: false, ...notCleared };
      const rows = await DeliveryChallan.find(q).sort({ updatedAt: -1 }).populate(challanPopulate).lean();
      return rows.map(formatChallan);
    },

    getDeliveryChallanById: async (_: any, { id }: any, context: any) => {
      const scope = await requireBackofficeTenant(context);
      const c: any = await DeliveryChallan.findById(id).populate(challanPopulate).lean();
      return c && String(c.adminid) === String(scope.adminid) ? formatChallan(c) : null;
    },

    getDeliveryChallanDraft: async (_: any, { sourceType, sourceId }: any, context: any) => {
      const scope = await requireBackofficeTenant(context);
      const Model: any = sourceType === "invoice" ? SalesInvoice : SalesOrder;
      const src: any = await Model.findById(sourceId).lean();
      if (!src || String(src.adminid) !== String(scope.adminid)) throw new TenantError("Source document not found.", "BAD_USER_INPUT");
      const draft: any = await DeliveryChallan.populate(
        new DeliveryChallan({
          ...fromSource(src),
          adminid: scope.adminid,
          billdate: new Date().toISOString().slice(0, 10),
          reason: "sale",
          ...(sourceType === "invoice" ? { sourceinvoiceid: src._id, sourceorderid: src.sourceorderid } : { sourceorderid: src._id }),
        }).toObject(),
        challanPopulate
      );
      return { ...formatChallan(draft), id: null, billnumber: null, createdAt: null, updatedAt: null };
    },
  },

  Mutation: {
    // One challan per clientRequestId (offline retries), answered in the list's shape.
    addDeliveryChallan: (_: any, args: any, context: any) =>
      createOnce(
        context,
        args?.input,
        async (adminid, req) => {
          const c: any = await DeliveryChallan.findOne({ adminid, clientRequestId: req }).select("_id").lean();
          return c ? loadChallan(c._id) : null;
        },
        () => addNow(args.input, context)
      ),

    editDeliveryChallan: async (_: any, { id, input }: any, context: any) => {
      const { scope, c: old } = await ownChallan(id, context);
      dropDeviceNumber("deliverychallan", input);
      if (old.challanStatus === "returned") throw new Error("A returned challan cannot be edited.");
      if (await invoiceOf(old._id)) throw new Error("This challan has an invoice. Edit the invoice instead.");
      await assertOwnedIds(Account, [input.partyacc], scope.adminid, "Party");
      // Source links and branch stay as created.
      const { sourceorderid, sourceinvoiceid, branchid, ...patch } = input;
      const next = { ...old, ...patch };
      if (old.stockapplied) {
        const settings: any = await AdminSettings.getOrCreateForAdmin(scope.adminid);
        if (settings?.allowNegativeStock !== true) {
          await assertSalesStockAvailable({ adminid: scope.adminid, branchid: old.branchid, productservice: next.productservice, oldInv: old });
        }
        await moveChallanStock(old, 1);
      }
      await DeliveryChallan.updateOne({ _id: old._id }, { $set: patch });
      if (old.stockapplied) await moveChallanStock({ ...next, branchid: old.branchid }, -1);
      return loadChallan(old._id);
    },

    deleteDeliveryChallan: async (_: any, { id }: any, context: any) => {
      const { c } = await ownChallan(id, context, "delete");
      if (await invoiceOf(c._id)) throw new Error("This challan has an invoice. Delete the invoice first.");
      if (c.stockapplied && c.challanStatus !== "returned" && c.status) await moveChallanStock(c, 1);
      await DeliveryChallan.updateOne({ _id: c._id }, { $set: { status: false } });
      return true;
    },

    resetDeliveryChallan: async (_: any, { id }: any, context: any) => {
      const { c } = await ownChallan(id, context, "reset");
      if (c.status) return true;
      if (c.stockapplied && c.challanStatus !== "returned") await moveChallanStock(c, -1);
      await DeliveryChallan.updateOne({ _id: c._id }, { $set: { status: true } });
      return true;
    },

    markDeliveryChallanDelivered: async (_: any, { id }: any, context: any) => {
      const { c } = await ownChallan(id, context);
      if (c.challanStatus === "returned") throw new Error("This challan was returned.");
      await DeliveryChallan.updateOne({ _id: c._id }, { $set: { challanStatus: "delivered", deliveredAt: new Date() } });
      await syncSource(c, "delivered", context);
      return loadChallan(c._id);
    },

    saveChallanEWayBill: async (_: any, { id, ewaybillno, ewaybilldate, ewaybillvalidupto }: any, context: any) => {
      const { c } = await ownChallan(id, context);
      const no = String(ewaybillno || "").trim();
      if (no && !/^\d{12}$/.test(no)) throw new Error("E-Way Bill number must be 12 digits.");
      await DeliveryChallan.updateOne({ _id: c._id }, { $set: { ewaybillno: no, ewaybilldate: ewaybilldate || null, ewaybillvalidupto: ewaybillvalidupto || null } });
      return loadChallan(c._id);
    },

    // Goods came back unsold: stock is restored. An invoiced challan needs a Sales Return instead.
    markDeliveryChallanReturned: async (_: any, { id }: any, context: any) => {
      const { c } = await ownChallan(id, context);
      if (c.challanStatus === "returned") return loadChallan(c._id);
      if (await invoiceOf(c._id)) throw new Error("This challan has an invoice. Record a Sales Return instead.");
      if (c.stockapplied) await moveChallanStock(c, 1);
      await DeliveryChallan.updateOne({ _id: c._id }, { $set: { challanStatus: "returned", returnedAt: new Date() } });
      return loadChallan(c._id);
    },
  },

  DeliveryChallan: {
    invoiceid: async (p: any) => (p.id ? (await invoiceOf(p.id))?._id?.toString() ?? null : null),
    invoicenumber: async (p: any) => (p.id ? (await invoiceOf(p.id))?.billnumber ?? null : null),
    sourceOrderNumber: async (p: any) =>
      p.sourceorderid ? ((await SalesOrder.findById(p.sourceorderid).select("billnumber").lean()) as any)?.billnumber ?? null : null,
    sourceInvoiceNumber: async (p: any) =>
      p.sourceinvoiceid ? ((await SalesInvoice.findById(p.sourceinvoiceid).select("billnumber").lean()) as any)?.billnumber ?? null : null,
  },
};
