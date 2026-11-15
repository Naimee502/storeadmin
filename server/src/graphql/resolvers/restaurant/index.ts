import { Types } from "mongoose";
import { DiningTable, TableOrder } from "../../../models/restaurant";
import { ProductService } from "../../../models/products";
import { SalesInvoice } from "../../../models/salesinvoice";
import { TenantError, assertOwnedIds, requireBackofficeTenant } from "../../../utils/tenant";
import { assertModuleOn } from "../../../utils/modulegate";
import { isActionAllowed } from "../../../utils/permissiongate";

const EPS = 0.0005;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const iso = (d: any) => (d ? new Date(d).toISOString() : null);
const idOrNull = (v: any) => (v && Types.ObjectId.isValid(String(v)) ? String(v) : null);

/** Tenant + module on; with an action, the caller's permission too. */
async function gate(context: any, action?: string) {
  const scope = await requireBackofficeTenant(context);
  const where = {
    adminid: scope.adminid,
    branchid: scope.userType === "admin" ? undefined : scope.branchid,
    staffid: scope.userType === "staff" ? scope.userId : undefined,
  };
  await assertModuleOn("restaurant", "Restaurant Tables", where);
  if (action && !(await isActionAllowed("restaurant", action, where))) {
    throw new TenantError("You do not have permission for this Restaurant Tables action.");
  }
  return scope;
}

/** Branch filter: branch / staff logins see only their branch. */
const branchOf = (scope: any, branchid?: any) =>
  scope.userType !== "admin" && scope.branchid ? { branchid: scope.branchid } : idOrNull(branchid) ? { branchid: idOrNull(branchid) } : {};

const shapeTable = (t: any) => ({ id: String(t._id), name: t.name, area: t.area || null, seats: t.seats ?? null, sortorder: t.sortorder ?? null, branchid: t.branchid ? String(t.branchid) : null });

const shapeOrder = (o: any) => {
  const lines = (o.lines || []).map((l: any) => ({
    id: String(l._id), productserviceid: l.productserviceid ? String(l.productserviceid) : null, variantid: l.variantid ? String(l.variantid) : null,
    salesunitid: l.salesunitid ? String(l.salesunitid) : null, name: l.name || "", qty: Number(l.qty) || 0, rate: Number(l.rate) || 0,
    note: l.note || null, kotno: l.kotno ?? null, kotAt: iso(l.kotAt), cancelled: !!l.cancelled, billedqty: Number(l.billedqty) || 0,
  }));
  return {
    id: String(o._id), tableid: String(o.tableid), tablename: o.tablename || "", branchid: o.branchid ? String(o.branchid) : null,
    covers: o.covers ?? null, waitername: o.waitername || null, lines, kotcount: o.kotcount || 0, orderStatus: o.orderStatus,
    invoiceids: (o.invoiceids || []).map(String),
    total: r3(lines.filter((l: any) => !l.cancelled).reduce((s: number, l: any) => s + l.qty * l.rate, 0)),
    createdby_name: o.createdby_name || null, createdAt: iso(o.createdAt), updatedAt: iso(o.updatedAt),
  };
};

async function ownOrder(context: any, id: string, action: string) {
  const scope = await gate(context, action);
  const o: any = idOrNull(id) ? await TableOrder.findOne({ _id: id, adminid: scope.adminid, ...branchOf(scope) }) : null;
  if (!o) throw new TenantError("Table bill not found.", "BAD_USER_INPUT");
  return { scope, o };
}
const mustBeOpen = (o: any) => {
  if (o.orderStatus !== "open") throw new TenantError("This table bill is already closed.", "BAD_USER_INPUT");
};
const userName = (context: any) => context?.user?.name || context?.user?.email || undefined;

export const restaurantResolvers = {
  Query: {
    getDiningTables: async (_: any, { branchid }: any, context: any) => {
      const scope = await gate(context);
      const rows = await DiningTable.find({ adminid: scope.adminid, status: true, ...branchOf(scope, branchid) }).sort({ sortorder: 1, name: 1 }).lean();
      return rows.map(shapeTable);
    },
    getOpenTableOrders: async (_: any, { branchid }: any, context: any) => {
      const scope = await gate(context);
      const rows = await TableOrder.find({ adminid: scope.adminid, orderStatus: "open", ...branchOf(scope, branchid) }).lean();
      return rows.map(shapeOrder);
    },
    getTableOrder: async (_: any, { id }: any, context: any) => {
      const scope = await gate(context);
      const o = idOrNull(id) ? await TableOrder.findOne({ _id: id, adminid: scope.adminid, ...branchOf(scope) }).lean() : null;
      return o ? shapeOrder(o) : null;
    },
  },
  Mutation: {
    saveDiningTable: async (_: any, { id, input }: any, context: any) => {
      const scope = await gate(context, id ? "edit" : "add");
      const name = String(input?.name || "").trim().slice(0, 40);
      if (!name) throw new TenantError("Enter the table name.", "BAD_USER_INPUT");
      const data: any = {
        name, area: String(input.area || "").trim().slice(0, 40) || undefined,
        seats: Number(input.seats) > 0 ? Math.round(Number(input.seats)) : undefined,
        sortorder: Number.isFinite(Number(input.sortorder)) && input.sortorder !== null && input.sortorder !== "" ? Number(input.sortorder) : undefined,
      };
      if (id) {
        const t: any = await DiningTable.findOne({ _id: idOrNull(id), adminid: scope.adminid, status: true, ...branchOf(scope) });
        if (!t) throw new TenantError("Table not found.", "BAD_USER_INPUT");
        t.set(data);
        await t.save();
        await TableOrder.updateMany({ tableid: t._id, orderStatus: "open" }, { $set: { tablename: name } });
        return shapeTable(t);
      }
      const branchid = scope.userType !== "admin" ? scope.branchid : idOrNull(input.branchid);
      const t = await DiningTable.create({ ...data, adminid: scope.adminid, ...(branchid ? { branchid } : {}) });
      return shapeTable(t);
    },
    deleteDiningTable: async (_: any, { id }: any, context: any) => {
      const scope = await gate(context, "delete");
      const t: any = await DiningTable.findOne({ _id: idOrNull(id), adminid: scope.adminid, status: true, ...branchOf(scope) });
      if (!t) throw new TenantError("Table not found.", "BAD_USER_INPUT");
      if (await TableOrder.exists({ tableid: t._id, orderStatus: "open" })) throw new TenantError("This table has a running bill. Bill or move it first.", "BAD_USER_INPUT");
      t.status = false;
      await t.save();
      return true;
    },
    openTableOrder: async (_: any, { tableid, covers, waitername }: any, context: any) => {
      const scope = await gate(context, "add");
      const t: any = await DiningTable.findOne({ _id: idOrNull(tableid), adminid: scope.adminid, status: true, ...branchOf(scope) }).lean();
      if (!t) throw new TenantError("Table not found.", "BAD_USER_INPUT");
      const running = await TableOrder.findOne({ tableid: t._id, orderStatus: "open" }).lean();
      if (running) return shapeOrder(running);
      try {
        const o = await TableOrder.create({
          adminid: scope.adminid, ...(t.branchid ? { branchid: t.branchid } : {}), tableid: t._id, tablename: t.name,
          covers: Number(covers) > 0 ? Math.round(Number(covers)) : undefined, waitername: String(waitername || "").trim() || undefined,
          createdby_name: userName(context),
        });
        return shapeOrder(o);
      } catch (e: any) {
        // Opened at the same moment on another screen.
        if (e?.code === 11000) return shapeOrder(await TableOrder.findOne({ tableid: t._id, orderStatus: "open" }).lean());
        throw e;
      }
    },
    saveTableOrder: async (_: any, { id, lines, covers, waitername, sendKot }: any, context: any) => {
      const { scope, o } = await ownOrder(context, id, "edit");
      mustBeOpen(o);
      const incoming = (lines || []).slice(0, 200).map((l: any) => ({
        productserviceid: idOrNull(l.productserviceid), variantid: idOrNull(l.variantid), salesunitid: idOrNull(l.salesunitid),
        name: String(l.name || "").trim().slice(0, 120), qty: r3(Number(l.qty) || 0), rate: Math.max(0, Number(l.rate) || 0),
        note: String(l.note || "").trim().slice(0, 120) || undefined,
      })).filter((l: any) => (l.productserviceid || l.name) && l.qty > 0);
      await assertOwnedIds(ProductService, incoming.map((l: any) => l.productserviceid), scope.adminid, "item", "adminid");
      // Fill names from the item master.
      const ids = incoming.filter((l: any) => l.productserviceid && !l.name).map((l: any) => l.productserviceid);
      if (ids.length) {
        const names = new Map((await ProductService.find({ _id: { $in: ids } }).select("name").lean()).map((p: any) => [String(p._id), p.name]));
        for (const l of incoming) if (!l.name) l.name = names.get(String(l.productserviceid)) || "";
      }
      const sent = o.lines.filter((l: any) => l.kotno);
      if (sendKot && !incoming.length) throw new TenantError("There is no new item for the kitchen.", "BAD_USER_INPUT");
      const kotno = sendKot ? (o.kotcount || 0) + 1 : undefined;
      const at = new Date();
      o.lines = [...sent, ...incoming.map((l: any) => ({ ...l, ...(kotno ? { kotno, kotAt: at } : {}) }))];
      if (kotno) o.kotcount = kotno;
      if (covers !== undefined && covers !== null) o.covers = Number(covers) > 0 ? Math.round(Number(covers)) : undefined;
      if (waitername !== undefined && waitername !== null) o.waitername = String(waitername).trim() || undefined;
      await o.save();
      return shapeOrder(o);
    },
    cancelTableOrderLine: async (_: any, { id, lineid }: any, context: any) => {
      const { o } = await ownOrder(context, id, "delete");
      mustBeOpen(o);
      const l: any = o.lines.id(lineid);
      if (!l || !l.kotno) throw new TenantError("Item not found.", "BAD_USER_INPUT");
      if (Number(l.billedqty) > EPS) throw new TenantError("This item is already billed.", "BAD_USER_INPUT");
      l.cancelled = true;
      await o.save();
      return shapeOrder(o);
    },
    moveTableOrder: async (_: any, { id, tableid }: any, context: any) => {
      const { scope, o } = await ownOrder(context, id, "edit");
      mustBeOpen(o);
      const t: any = await DiningTable.findOne({ _id: idOrNull(tableid), adminid: scope.adminid, status: true, ...branchOf(scope) }).lean();
      if (!t) throw new TenantError("Table not found.", "BAD_USER_INPUT");
      if (String(t._id) === String(o.tableid)) return shapeOrder(o);
      if (String(t.branchid || "") !== String(o.branchid || "")) throw new TenantError("Pick a table of the same branch.", "BAD_USER_INPUT");
      if (await TableOrder.exists({ tableid: t._id, orderStatus: "open" })) throw new TenantError(`${t.name} already has a running bill.`, "BAD_USER_INPUT");
      o.tableid = t._id;
      o.tablename = t.name;
      await o.save();
      return shapeOrder(o);
    },
    cancelTableOrder: async (_: any, { id }: any, context: any) => {
      const { o } = await ownOrder(context, id, "delete");
      mustBeOpen(o);
      if ((o.invoiceids || []).length) throw new TenantError("Part of this table is already billed. Bill the rest instead.", "BAD_USER_INPUT");
      o.orderStatus = "cancelled";
      o.closedAt = new Date();
      await o.save();
      return true;
    },
    billTableOrder: async (_: any, { id, invoiceid, lines }: any, context: any) => {
      const { scope, o } = await ownOrder(context, id, "convert");
      mustBeOpen(o);
      const inv: any = idOrNull(invoiceid) ? await SalesInvoice.findOne({ _id: invoiceid, adminid: scope.adminid }).select("_id").lean() : null;
      if (!inv) throw new TenantError("Invoice not found.", "BAD_USER_INPUT");
      if ((o.invoiceids || []).some((x: any) => String(x) === String(inv._id))) return shapeOrder(o);
      for (const b of lines || []) {
        const l: any = o.lines.id(b.id);
        const qty = r3(Number(b.qty) || 0);
        if (!l || l.cancelled || qty <= 0) continue;
        const left = r3(Number(l.qty) - Number(l.billedqty || 0));
        if (qty > left + EPS) throw new TenantError(`${l.name}: only ${left} left to bill.`, "BAD_USER_INPUT");
        l.billedqty = Math.min(Number(l.qty), r3(Number(l.billedqty || 0) + qty));
      }
      o.invoiceids = [...(o.invoiceids || []), inv._id];
      const open = o.lines.some((l: any) => !l.cancelled && Number(l.qty) - Number(l.billedqty || 0) > EPS);
      if (!open) {
        o.orderStatus = "billed";
        o.closedAt = new Date();
      }
      await o.save();
      return shapeOrder(o);
    },
  },
};
