import { Bom, WorkOrder, ProductionEntry, moveProductionStock, baseQty } from "../../../models/manufacturing";
import { ProductService } from "../../../models/products";
import { ProductBranchStock } from "../../../models/productbranchstock";
import { AdminSettings } from "../../../models/adminsettings";
import { TenantError, assertOwnedIds, requireBackofficeTenant } from "../../../utils/tenant";
import { activeFilters, containsRx, dmyFromDate, dmyFromText, notCleared, pageWindow, textMatch } from "../../../utils/listquery";
import { assertSalesStockAvailable } from "../../../utils/stockguard";
import { assertModuleOn } from "../../../utils/modulegate";
import { isActionAllowed } from "../../../utils/permissiongate";
import { createOnce, dropDeviceNumber, isoOf, raiseDeviceSeq, takeDeviceNumber } from "../../../utils/offlinesync";

const LINE_REFS = (path: string) => [
  { path: `${path}.productserviceid`, select: "name productvariants._id productvariants.name" },
  { path: `${path}.salesunitid`, select: "unitname" },
];
export const bomPopulate: any[] = [
  { path: "productserviceid", select: "name productvariants._id productvariants.name" },
  { path: "salesunitid", select: "unitname" },
  ...LINE_REFS("items"),
  ...LINE_REFS("byproducts"),
];
export const workOrderPopulate: any[] = bomPopulate.slice(0, 2);
export const productionPopulate: any[] = [
  ...LINE_REFS("components"),
  ...LINE_REFS("outputs"),
  ...LINE_REFS("byproducts"),
  { path: "workorderid", select: "billnumber" },
];

const ref = (d: any, key: string) => (d ? { id: String(d._id ?? d), [key]: d[key] ?? d.name ?? null } : null);
const variantRef = (prod: any, variantid: any) => {
  if (!variantid) return null;
  const v = prod?.productvariants?.find((x: any) => String(x._id) === String(variantid));
  return { id: String(variantid), name: v?.name ?? null };
};
const formatLine = (l: any) => ({
  ...l,
  productserviceid: ref(l.productserviceid, "name"),
  variantid: variantRef(l.productserviceid, l.variantid),
  salesunitid: ref(l.salesunitid, "unitname"),
});
const ids = (d: any, keys: string[]) => Object.fromEntries(keys.map((k) => [k, d[k] ? String(d[k]._id ?? d[k]) : null]));
const stamps = (d: any) => ({ createdAt: isoOf(d.createdAt), updatedAt: isoOf(d.updatedAt) });

export const formatBom = (b: any) => ({
  ...b,
  id: String(b._id),
  ...ids(b, ["adminid"]),
  productserviceid: ref(b.productserviceid, "name"),
  variantid: variantRef(b.productserviceid, b.variantid),
  salesunitid: ref(b.salesunitid, "unitname"),
  items: (b.items || []).map(formatLine),
  byproducts: (b.byproducts || []).map(formatLine),
  ...stamps(b),
});

export const formatWorkOrder = (w: any) => ({
  ...w,
  id: String(w._id),
  ...ids(w, ["adminid", "branchid", "bomid", "sourceorderid"]),
  productserviceid: ref(w.productserviceid, "name"),
  variantid: variantRef(w.productserviceid, w.variantid),
  salesunitid: ref(w.salesunitid, "unitname"),
  qtyproduced: w.qtyproduced ?? 0,
  ...stamps(w),
});

export const formatProduction = (p: any) => ({
  ...p,
  id: String(p._id),
  ...ids(p, ["adminid", "branchid", "bomid", "workorderid"]),
  workordernumber: p.workorderid?.billnumber ?? null,
  components: (p.components || []).map(formatLine),
  outputs: (p.outputs || []).map(formatLine),
  byproducts: (p.byproducts || []).map(formatLine),
  ...stamps(p),
});

/** Tenant + branch scope (the sync pull uses it without status). */
export const buildMfgQuery = (scope: { adminid: any; branchid?: any }, filter: any = {}) => {
  const q: any = { adminid: scope.adminid, status: true };
  const b = scope.branchid || filter?.branchid;
  if (b) q.branchid = b;
  if (filter?.billdateFrom || filter?.billdateTo) {
    q.billdate = {};
    if (filter.billdateFrom) q.billdate.$gte = String(filter.billdateFrom).slice(0, 10);
    if (filter.billdateTo) q.billdate.$lte = `${String(filter.billdateTo).slice(0, 10)}￿`;
  }
  return q;
};

const LABEL: Record<string, string> = { bom: "Bill of Materials", workorders: "Work Orders", production: "Production" };

async function gate(context: any, module: string, action: string) {
  const scope = await requireBackofficeTenant(context);
  const where = {
    adminid: scope.adminid,
    branchid: scope.userType === "admin" ? undefined : scope.branchid,
    staffid: scope.userType === "staff" ? scope.userId : undefined,
  };
  await assertModuleOn(module, LABEL[module], where);
  if (!(await isActionAllowed(module, action, where))) throw new TenantError(`You do not have permission for this ${LABEL[module]} action.`);
  return scope;
}

async function own(model: any, id: string, context: any, module: string, action: string) {
  const scope = await gate(context, module, action);
  const d: any = await model.findById(id).lean();
  if (!d || String(d.adminid) !== String(scope.adminid)) throw new TenantError("Entry not found.", "BAD_USER_INPUT");
  return { scope, d };
}

const lineIds = (...groups: any[][]) => groups.flat().filter(Boolean).map((l: any) => l.productserviceid);
const userName = (context: any) => context?.user?.name || context?.user?.email;

const loadBom = async (id: any) => {
  const b: any = await Bom.findById(id).populate(bomPopulate).lean();
  return b ? formatBom(b) : null;
};
const loadWorkOrder = async (id: any) => {
  const w: any = await WorkOrder.findById(id).populate(workOrderPopulate).lean();
  return w ? formatWorkOrder(w) : null;
};
const loadProduction = async (id: any) => {
  const p: any = await ProductionEntry.findById(id).populate(productionPopulate).lean();
  return p ? formatProduction(p) : null;
};

// One default BOM per item.
async function keepOneDefault(b: any) {
  if (!b?.isdefault) return;
  await Bom.updateMany(
    { adminid: b.adminid, productserviceid: b.productserviceid, variantid: b.variantid ?? null, _id: { $ne: b._id } },
    { $set: { isdefault: false } },
    { timestamps: false }
  );
}

/** Components at branch average cost; outputs share the rest after by-product value. */
async function costEntry(data: any) {
  let material = 0;
  for (const l of data.components || []) {
    const qb = (await baseQty(l)) ?? 0;
    const s: any = await ProductBranchStock.findOne({ productid: l.productserviceid, variantid: l.variantid, branchid: data.branchid }).select("averagecost").lean();
    l.amount = qb * Number(s?.averagecost || 0);
    l.rate = l.qty ? l.amount / Number(l.qty) : 0;
    material += l.amount;
  }
  let byValue = 0;
  for (const l of data.byproducts || []) {
    l.amount = Number(l.rate || 0) * Number(l.qty || 0);
    byValue += l.amount;
  }
  const total = material + Number(data.labourcost || 0) + Number(data.overhead || 0);
  const outQty = (data.outputs || []).reduce((s: number, l: any) => s + Number(l.qty || 0), 0);
  for (const l of data.outputs || []) {
    l.amount = outQty ? (Math.max(total - byValue, 0) * Number(l.qty || 0)) / outQty : 0;
    l.rate = l.qty ? l.amount / Number(l.qty) : 0;
  }
  data.materialcost = material;
  data.totalcost = total;
}

/** Produced qty and status of a work order follow its live production entries. */
async function refreshWorkOrder(workorderid: any) {
  if (!workorderid) return;
  const wo: any = await WorkOrder.findById(workorderid).lean();
  if (!wo) return;
  const entries: any[] = await ProductionEntry.find({ workorderid, status: true }).select("outputs").lean();
  let made = 0;
  for (const e of entries) {
    for (const l of e.outputs || []) {
      if (String(l.productserviceid) === String(wo.productserviceid) && String(l.variantid ?? "") === String(wo.variantid ?? "")) made += Number(l.qty || 0);
    }
  }
  const set: any = { qtyproduced: made };
  if (wo.workStatus !== "cancelled") set.workStatus = made >= Number(wo.qty) ? "completed" : made > 0 ? "inprogress" : wo.workStatus === "completed" ? "inprogress" : wo.workStatus;
  await WorkOrder.updateOne({ _id: wo._id }, { $set: set });
}

async function guardStock(scope: any, data: any, old?: any) {
  const settings: any = await AdminSettings.getOrCreateForAdmin(scope.adminid);
  if (settings?.allowNegativeStock === true) return;
  await assertSalesStockAvailable({
    adminid: scope.adminid,
    branchid: data.branchid,
    productservice: data.components || [],
    oldInv: old ? { productservice: old.components || [] } : undefined,
  });
}

async function addWorkOrderNow(input: any, context: any) {
  const scope = await gate(context, "workorders", "add");
  const deviceNo = takeDeviceNumber("workorder", input);
  const data: any = { ...input, adminid: scope.adminid, branchid: scope.branchid || input.branchid, createdby_name: userName(context) };
  if (!data.branchid) throw new Error("Select a branch for the work order.");
  await assertOwnedIds(ProductService, [data.productserviceid], scope.adminid, "Item", "adminid");
  if (data.bomid) await assertOwnedIds(Bom, [data.bomid], scope.adminid, "BOM", "adminid");
  const created: any = await WorkOrder.create(data);
  await raiseDeviceSeq(scope.adminid, deviceNo);
  return loadWorkOrder(created._id);
}

async function addProductionNow(input: any, context: any) {
  const scope = await gate(context, "production", "add");
  const deviceNo = takeDeviceNumber("production", input);
  const data: any = { ...input, adminid: scope.adminid, branchid: scope.branchid || input.branchid, createdby_name: userName(context) };
  if (!data.branchid) throw new Error("Select a branch for the production entry.");
  if (!(data.outputs || []).length) throw new Error("Add the item produced.");
  await assertOwnedIds(ProductService, lineIds(data.components, data.outputs, data.byproducts), scope.adminid, "Item", "adminid");
  if (data.workorderid) await assertOwnedIds(WorkOrder, [data.workorderid], scope.adminid, "Work Order", "adminid");
  await guardStock(scope, data);
  await costEntry(data);
  const created: any = await ProductionEntry.create(data);
  await moveProductionStock(created.toObject(), 1);
  await refreshWorkOrder(created.workorderid);
  await raiseDeviceSeq(scope.adminid, deviceNo);
  return loadProduction(created._id);
}

async function addBomNow(input: any, context: any) {
  const scope = await gate(context, "bom", "add");
  await assertOwnedIds(ProductService, lineIds([input], input.items, input.byproducts), scope.adminid, "Item", "adminid");
  if ((input.items || []).some((l: any) => String(l.productserviceid) === String(input.productserviceid))) {
    throw new Error("An item cannot be its own component.");
  }
  const created: any = await Bom.create({ ...input, adminid: scope.adminid, createdby_name: userName(context) });
  await keepOneDefault(created);
  return loadBom(created._id);
}

const WORK_LABEL: Record<string, string> = { planned: "Planned", inprogress: "In Progress", completed: "Completed", cancelled: "Cancelled" };
const QC_LABEL: Record<string, string> = { pass: "Pass", fail: "Fail", hold: "On Hold" };
const labelKeys = (labels: Record<string, string>, term: string) => Object.keys(labels).filter((k) => containsRx(term).test(labels[k]));
const itemIds = async (adminid: any, term: string) =>
  (await ProductService.find({ adminid, name: containsRx(term) }).select("_id").limit(500).lean()).map((p: any) => p._id);
const numberRx = (term: string, prefix: string) => containsRx(term.replace(new RegExp(`^${prefix}-?`, "i"), ""));

// Column filters of the three lists; unknown keys are ignored.
async function mfgClause(kind: "bom" | "workorder" | "production", key: string, term: string, adminid: any): Promise<any | null> {
  switch (key) {
    case "item":
      return kind === "production" ? null : { productserviceid: { $in: await itemIds(adminid, term) } };
    case "produced":
      return kind === "workorder"
        ? textMatch({ $toString: { $ifNull: ["$qtyproduced", 0] } }, term)
        : { "outputs.productserviceid": { $in: await itemIds(adminid, term) } };
    case "pending":
      return textMatch({ $toString: { $max: [{ $subtract: ["$qty", { $ifNull: ["$qtyproduced", 0] }] }, 0] } }, term);
    case "makes":
      return textMatch({ $toString: "$qty" }, term);
    case "updated":
      return textMatch(dmyFromDate("$updatedAt"), term);
    case "name":
      return { name: containsRx(term) };
    case "no":
      return { $or: [{ billnumber: numberRx(term, kind === "workorder" ? "WO" : "PE") }, { offlineNumber: containsRx(term) }] };
    case "date":
      return textMatch(dmyFromText("$billdate"), term);
    case "due":
      return textMatch(dmyFromText("$duedate"), term);
    case "qty":
      return textMatch({ $toString: "$qty" }, term);
    case "status":
      return { workStatus: { $in: labelKeys(WORK_LABEL, term) } };
    case "qc":
      return { qcstatus: { $in: labelKeys(QC_LABEL, term) } };
    case "cost":
      return textMatch({ $toString: "$totalcost" }, term);
    case "wo": {
      const ids = (await WorkOrder.find({ adminid, billnumber: numberRx(term, "WO") }).select("_id").limit(500).lean()).map((w: any) => w._id);
      return { workorderid: { $in: ids } };
    }
    default:
      return null;
  }
}
const SEARCH: Record<string, string[]> = {
  bom: ["item", "name"],
  workorder: ["no", "date", "due", "item", "qty", "status"],
  production: ["no", "date", "wo", "produced", "qc", "cost"],
};

async function mfgPage(kind: "bom" | "workorder" | "production", context: any, args: any) {
  const { filter = {}, page = 1, pageSize = 10, search = "", columnFilters = [] } = args || {};
  const scope = await requireBackofficeTenant(context);
  const base = kind === "bom" ? { adminid: scope.adminid, status: true } : buildMfgQuery(scope, filter);
  const clauses: any[] = [base];
  const term = String(search || "").trim();
  if (term) {
    const any: any[] = [];
    for (const k of SEARCH[kind]) {
      const c = await mfgClause(kind, k, term, scope.adminid);
      if (c) any.push(c);
    }
    clauses.push({ $or: any });
  }
  for (const f of activeFilters(columnFilters)) {
    const c = await mfgClause(kind, f.key, f.value, scope.adminid);
    if (c) clauses.push(c);
  }
  const query = { $and: clauses };
  const { skip, limit } = pageWindow(page, pageSize);
  const Model: any = kind === "bom" ? Bom : kind === "workorder" ? WorkOrder : ProductionEntry;
  const populate = kind === "bom" ? bomPopulate : kind === "workorder" ? workOrderPopulate : productionPopulate;
  const format = kind === "bom" ? formatBom : kind === "workorder" ? formatWorkOrder : formatProduction;
  const sort = kind === "bom" ? { updatedAt: -1, _id: -1 } : { createdAt: -1, _id: -1 };
  const [total, rows] = await Promise.all([
    Model.countDocuments(query),
    Model.find(query).sort(sort).skip(skip).limit(limit).populate(populate).lean(),
  ]);
  return { items: rows.map(format), total };
}

const deletedQuery = (scope: any, filter: any) => ({ ...buildMfgQuery(scope, filter), status: false, ...notCleared });

export const manufacturingResolvers = {
  Query: {
    getBomsPage: (_: any, args: any, context: any) => mfgPage("bom", context, args),
    getWorkOrdersPage: (_: any, args: any, context: any) => mfgPage("workorder", context, args),
    getProductionEntriesPage: (_: any, args: any, context: any) => mfgPage("production", context, args),
    getBoms: async (_: any, __: any, context: any) => {
      const scope = await requireBackofficeTenant(context);
      const rows = await Bom.find({ adminid: scope.adminid, status: true }).sort({ updatedAt: -1 }).populate(bomPopulate).lean();
      return rows.map(formatBom);
    },
    getDeletedBoms: async (_: any, __: any, context: any) => {
      const scope = await requireBackofficeTenant(context);
      const rows = await Bom.find({ adminid: scope.adminid, status: false, ...notCleared }).sort({ updatedAt: -1 }).populate(bomPopulate).lean();
      return rows.map(formatBom);
    },
    getBomById: async (_: any, { id }: any, context: any) => {
      const scope = await requireBackofficeTenant(context);
      const b: any = await Bom.findById(id).populate(bomPopulate).lean();
      return b && String(b.adminid) === String(scope.adminid) ? formatBom(b) : null;
    },
    getWorkOrders: async (_: any, { filter = {} }: any, context: any) => {
      const scope = await requireBackofficeTenant(context);
      const rows = await WorkOrder.find(buildMfgQuery(scope, filter)).sort({ billdate: -1, _id: -1 }).populate(workOrderPopulate).lean();
      return rows.map(formatWorkOrder);
    },
    getDeletedWorkOrders: async (_: any, { filter = {} }: any, context: any) => {
      const scope = await requireBackofficeTenant(context);
      const rows = await WorkOrder.find(deletedQuery(scope, filter)).sort({ updatedAt: -1 }).populate(workOrderPopulate).lean();
      return rows.map(formatWorkOrder);
    },
    getWorkOrderById: async (_: any, { id }: any, context: any) => {
      const scope = await requireBackofficeTenant(context);
      const w: any = await WorkOrder.findById(id).populate(workOrderPopulate).lean();
      return w && String(w.adminid) === String(scope.adminid) ? formatWorkOrder(w) : null;
    },
    getProductionEntries: async (_: any, { filter = {} }: any, context: any) => {
      const scope = await requireBackofficeTenant(context);
      const rows = await ProductionEntry.find(buildMfgQuery(scope, filter)).sort({ billdate: -1, _id: -1 }).populate(productionPopulate).lean();
      return rows.map(formatProduction);
    },
    getDeletedProductionEntries: async (_: any, { filter = {} }: any, context: any) => {
      const scope = await requireBackofficeTenant(context);
      const rows = await ProductionEntry.find(deletedQuery(scope, filter)).sort({ updatedAt: -1 }).populate(productionPopulate).lean();
      return rows.map(formatProduction);
    },
    getProductionEntryById: async (_: any, { id }: any, context: any) => {
      const scope = await requireBackofficeTenant(context);
      const p: any = await ProductionEntry.findById(id).populate(productionPopulate).lean();
      return p && String(p.adminid) === String(scope.adminid) ? formatProduction(p) : null;
    },
  },

  Mutation: {
    addBom: (_: any, { input }: any, context: any) =>
      createOnce(
        context,
        input,
        async (adminid, req) => {
          const b: any = await Bom.findOne({ adminid, clientRequestId: req }).select("_id").lean();
          return b ? loadBom(b._id) : null;
        },
        () => addBomNow(input, context)
      ),
    editBom: async (_: any, { id, input }: any, context: any) => {
      const { scope, d } = await own(Bom, id, context, "bom", "edit");
      await assertOwnedIds(ProductService, lineIds([input], input.items, input.byproducts), scope.adminid, "Item", "adminid");
      const { clientRequestId, ...patch } = input;
      await Bom.updateOne({ _id: d._id }, { $set: patch });
      await keepOneDefault({ ...d, ...patch });
      return loadBom(d._id);
    },
    deleteBom: async (_: any, { id }: any, context: any) => {
      const { d } = await own(Bom, id, context, "bom", "delete");
      await Bom.updateOne({ _id: d._id }, { $set: { status: false } });
      return true;
    },
    resetBom: async (_: any, { id }: any, context: any) => {
      const { d } = await own(Bom, id, context, "bom", "reset");
      await Bom.updateOne({ _id: d._id }, { $set: { status: true } });
      return true;
    },

    addWorkOrder: (_: any, args: any, context: any) =>
      createOnce(
        context,
        args?.input,
        async (adminid, req) => {
          const w: any = await WorkOrder.findOne({ adminid, clientRequestId: req }).select("_id").lean();
          return w ? loadWorkOrder(w._id) : null;
        },
        () => addWorkOrderNow(args.input, context)
      ),
    editWorkOrder: async (_: any, { id, input }: any, context: any) => {
      const { scope, d } = await own(WorkOrder, id, context, "workorders", "edit");
      dropDeviceNumber("workorder", input);
      await assertOwnedIds(ProductService, [input.productserviceid], scope.adminid, "Item", "adminid");
      const { clientRequestId, branchid, ...patch } = input;
      await WorkOrder.updateOne({ _id: d._id }, { $set: patch });
      await refreshWorkOrder(d._id);
      return loadWorkOrder(d._id);
    },
    setWorkOrderStatus: async (_: any, { id, workStatus }: any, context: any) => {
      const { d } = await own(WorkOrder, id, context, "workorders", "edit");
      if (!["planned", "inprogress", "completed", "cancelled"].includes(workStatus)) throw new Error("Unknown work order status.");
      await WorkOrder.updateOne({ _id: d._id }, { $set: { workStatus } });
      return loadWorkOrder(d._id);
    },
    deleteWorkOrder: async (_: any, { id }: any, context: any) => {
      const { d } = await own(WorkOrder, id, context, "workorders", "delete");
      if (await ProductionEntry.exists({ workorderid: d._id, status: true })) throw new Error("This work order has production entries. Delete them first.");
      await WorkOrder.updateOne({ _id: d._id }, { $set: { status: false } });
      return true;
    },
    resetWorkOrder: async (_: any, { id }: any, context: any) => {
      const { d } = await own(WorkOrder, id, context, "workorders", "reset");
      await WorkOrder.updateOne({ _id: d._id }, { $set: { status: true } });
      return true;
    },

    addProductionEntry: (_: any, args: any, context: any) =>
      createOnce(
        context,
        args?.input,
        async (adminid, req) => {
          const p: any = await ProductionEntry.findOne({ adminid, clientRequestId: req }).select("_id").lean();
          return p ? loadProduction(p._id) : null;
        },
        () => addProductionNow(args.input, context)
      ),
    editProductionEntry: async (_: any, { id, input }: any, context: any) => {
      const { scope, d: old } = await own(ProductionEntry, id, context, "production", "edit");
      dropDeviceNumber("production", input);
      if (!(input.outputs || []).length) throw new Error("Add the item produced.");
      await assertOwnedIds(ProductService, lineIds(input.components, input.outputs, input.byproducts), scope.adminid, "Item", "adminid");
      // Branch stays as created.
      const { clientRequestId, branchid, ...patch } = input;
      const next: any = { ...old, ...patch, branchid: old.branchid };
      await guardStock(scope, next, old);
      await moveProductionStock(old, -1);
      await costEntry(next);
      await ProductionEntry.updateOne(
        { _id: old._id },
        { $set: { ...patch, components: next.components, outputs: next.outputs, byproducts: next.byproducts, materialcost: next.materialcost, totalcost: next.totalcost } }
      );
      await moveProductionStock(next, 1);
      await refreshWorkOrder(old.workorderid);
      if (String(old.workorderid ?? "") !== String(next.workorderid ?? "")) await refreshWorkOrder(next.workorderid);
      return loadProduction(old._id);
    },
    deleteProductionEntry: async (_: any, { id }: any, context: any) => {
      const { d } = await own(ProductionEntry, id, context, "production", "delete");
      if (d.status) await moveProductionStock(d, -1);
      await ProductionEntry.updateOne({ _id: d._id }, { $set: { status: false } });
      await refreshWorkOrder(d.workorderid);
      return true;
    },
    resetProductionEntry: async (_: any, { id }: any, context: any) => {
      const { d } = await own(ProductionEntry, id, context, "production", "reset");
      if (d.status) return true;
      await moveProductionStock(d, 1);
      await ProductionEntry.updateOne({ _id: d._id }, { $set: { status: true } });
      await refreshWorkOrder(d.workorderid);
      return true;
    },
  },
};
