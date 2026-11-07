import { Types } from "mongoose";
import { StockAdjustment } from "../../../models/stockadjustments";
import { manageStock, StockAction, getStockDetails } from "../../../utils/stockmanager";
import { ProductService } from "../../../models/products";
import { containsRx, pageWindow, textMatch, notCleared } from "../../../utils/listquery";
import { dmyOrDash, fixed2, searchAndFilterClauses, textOr } from "../transactions/listtext";

function normalizeId(value: any) {
  if (!value) return null;
  if (typeof value === "object") {
    if (value.id && Types.ObjectId.isValid(value.id)) return new Types.ObjectId(value.id);
    if (value._id && Types.ObjectId.isValid(value._id)) return new Types.ObjectId(value._id);
  }
  if (typeof value === "string" && Types.ObjectId.isValid(value)) return new Types.ObjectId(value);
  return null;
}

// ── Stock-adjustment helpers ────────────────────────────────────────────────
// Every mutation goes through these so create / edit / delete / restore can
// never disagree about which rows move stock, in which direction, or when a
// shortage is allowed.

type AdjRow = { productid: any; variantid: any; quantity: number; rate: number };

/** Product + variant for a row; `strict` rejects rows that can't move stock
 *  (new/edited vouchers) instead of silently saving them with no effect. */
async function resolveVariant(row: AdjRow, strict: boolean) {
  const product: any = row.productid ? await ProductService.findById(row.productid) : null;
  if (!product) {
    if (strict) throw new Error("A selected product no longer exists. Please re-select it.");
    return null;
  }
  const variant = row.variantid
    ? product.productvariants?.find((v: any) => v._id.equals(row.variantid))
    : null;
  if (!variant) {
    if (strict) throw new Error(`Please select a variant for ${product.name}.`);
    return null;
  }
  return { product, variant };
}

/** Quantity per product+variant — two rows of the same variant must be checked
 *  against stock TOGETHER, not one by one. */
function qtyByVariant(rows: AdjRow[], sign: 1 | -1, into = new Map<string, any>()) {
  for (const r of rows) {
    if (!r?.productid || !r?.variantid || !(Number(r.quantity) > 0)) continue;
    const key = `${r.productid.toString()}_${r.variantid.toString()}`;
    const cur = into.get(key) || { productid: r.productid, variantid: r.variantid, net: 0 };
    cur.net += sign * Number(r.quantity);
    into.set(key, cur);
  }
  return into;
}

/** Throw if applying these net changes would take any variant below zero. */
async function assertNoNegative(net: Map<string, any>, adminid: any, branchid: any, verb: string) {
  for (const d of net.values()) {
    if (d.net >= 0) continue;
    const stock = await getStockDetails(d.productid, adminid, branchid, d.variantid);
    if (stock.currentstock + d.net < 0) {
      const product: any = await ProductService.findById(d.productid).select("name").lean();
      throw new Error(
        `Insufficient stock to ${verb} for ${product?.name || "a product"}. ` +
        `Current stock: ${stock.currentstock}, reduction needed: ${Math.abs(d.net)}.`
      );
    }
  }
}

/** Move stock for every row (Excess = in, Shortage = out). */
async function applyRows(
  rows: AdjRow[], adminid: any, branchid: any, action: StockAction, strict: boolean
) {
  for (const row of rows) {
    if (!(Number(row.quantity) > 0)) continue;
    const found = await resolveVariant(row, strict);
    if (!found) continue;
    await manageStock({
      adminId: adminid,
      productId: row.productid,
      branchId: branchid,
      variant: found.variant as any,
      qty: Number(row.quantity),
      unitId: found.variant.baseunitid,
      action,
      allowCreate: true,
      rate: Number(row.rate) || 0,
      rateIsBase: true,
    });
  }
}

const inAction = (type: string): StockAction => (type === "Excess" ? "TRANSFER_IN" : "TRANSFER_OUT");
const outAction = (type: string): StockAction => (type === "Excess" ? "TRANSFER_OUT" : "TRANSFER_IN");
/** Sign of the voucher's effect on stock. */
const effectSign = (type: string): 1 | -1 => (type === "Excess" ? 1 : -1);

/** Delete & cancel share this: reverse the voucher's stock, then deactivate. */
async function reverseAndDeactivate(id: any) {
  const adj: any = await StockAdjustment.findById(id);
  if (!adj || !adj.status) throw new Error("Adjustment not found or already deleted");
  // Reversing an Excess takes stock back out — make sure it is still there.
  const net = qtyByVariant(adj.items, (-effectSign(adj.type)) as 1 | -1);
  await assertNoNegative(net, adj.adminid, adj.branchid, "delete this adjustment");
  await applyRows(adj.items, adj.adminid, adj.branchid, outAction(adj.type), false);
  adj.status = false;
  adj.stockreversed = true;
  await adj.save();
  return true;
}


/** Filter scope shared by getStockAdjustments and its page query. */
function buildStockAdjustmentQuery(filter: any): any {
  const query: any = {};

  // Only filter by status when explicitly passed
  if (filter.status !== undefined) query.status = filter.status;
  // Cleared entries never show in the deleted list again.
  if (filter.status === false) Object.assign(query, notCleared);

  if (filter.adminid) {
    const aid = normalizeId(filter.adminid);
    if (aid) query.adminid = aid;
  }
  if (filter.branchid) {
    const bid = normalizeId(filter.branchid);
    if (bid) query.branchid = bid;
  }
  if (filter.type) query.type = filter.type;
  if (filter.vouchernumber) query.vouchernumber = { $regex: filter.vouchernumber, $options: "i" };

  if (filter.createdFrom || filter.createdTo) {
    query.adjustmentdate = {};
    if (filter.createdFrom) query.adjustmentdate.$gte = new Date(filter.createdFrom);
    if (filter.createdTo) query.adjustmentdate.$lte = new Date(filter.createdTo);
  }
  return query;
}

const formatAdjustment = (adj: any) => ({
  ...adj,
  id: adj._id?.toString(),
  adminid: adj.adminid
    ? { id: (adj.adminid as any)?._id?.toString(), name: (adj.adminid as any)?.name }
    : null,
  branchid: adj.branchid
    ? { id: (adj.branchid as any)?._id?.toString(), branchname: (adj.branchid as any)?.branchname }
    : null,
  items: (adj.items || []).map((item: any) => {
    const product = item.productid;
    return {
      ...item,
      productid: product ? { id: product._id?.toString(), name: product.name } : null,
      variantid: item.variantid?.toString()
    };
  })
});

// Columns of the Stock Adjustments list the server can search and filter.
const ADJUSTMENT_TEXT_KEYS = ["adjustmentdate", "vouchernumber", "type", "reason", "totalamount", "createdByDisplay", "status"];

/** Clause matching the text one Stock Adjustments list column shows. */
async function adjustmentColumnClause(key: string, term: string): Promise<any | null> {
  switch (key) {
    case "adjustmentdate":
      return textMatch(dmyOrDash("$adjustmentdate"), term);
    case "vouchernumber":
      return { vouchernumber: containsRx(term) };
    case "type":
      return { type: containsRx(term) };
    case "reason":
      return { reason: containsRx(term) };
    case "totalamount":
      return textMatch({ $concat: ["₹", fixed2("$totalamount")] }, term);
    case "createdByDisplay":
      return textMatch(textOr("$createdby_name", "N/A"), term);
    case "status":
      return textMatch({ $cond: ["$status", "Active", "Cancelled"] }, term);
  }
  return null;
}

export const stockAdjustmentResolvers = {
  Query: {
    getStockAdjustments: async (_: any, { filter = {}, limit = 0, offset = 0 }: any) => {
      try {
        const query = buildStockAdjustmentQuery(filter);

        // List query: no client (client/, clientapp/, clientweb/) selects
        // items for getStockAdjustments, and the mapping below only reads the
        // product's name — so don't pull every product's productvariants
        // (serials, unit prices…) per line item just to throw them away.
        let dbQuery = StockAdjustment.find(query)
          .populate("adminid", "name")
          .populate("branchid", "branchname")
          .populate("items.productid", "name")
          .sort({ createdAt: -1 })
          .lean();

        if (offset) dbQuery = dbQuery.skip(offset);
        if (limit) dbQuery = dbQuery.limit(limit);

        const adjustments = await dbQuery.exec();

        return adjustments.map(formatAdjustment);
      } catch (err) {
        console.error("Error in getStockAdjustments:", err);
        throw new Error("Failed to fetch stock adjustments");
      }
    },

    // One page of getStockAdjustments, newest first.
    getStockAdjustmentsPage: async (
      _: any,
      { filter = {}, page = 1, pageSize = 10, search = "", columnFilters = [] }:
        { filter?: any; page?: number; pageSize?: number; search?: string; columnFilters?: any[] }
    ) => {
      const clauses: any[] = [buildStockAdjustmentQuery(filter || {})];
      clauses.push(...(await searchAndFilterClauses(search, columnFilters, ADJUSTMENT_TEXT_KEYS, adjustmentColumnClause)));
      const query = { $and: clauses };
      const { skip, limit } = pageWindow(page, pageSize);

      const [total, rows] = await Promise.all([
        StockAdjustment.countDocuments(query),
        StockAdjustment.find(query)
          .populate("adminid", "name")
          .populate("branchid", "branchname")
          .populate("items.productid", "name")
          .sort({ createdAt: -1, _id: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
      ]);
      return { items: rows.map(formatAdjustment), total };
    },


    getStockAdjustmentById: async (_: any, { id }: any) => {
      if (!Types.ObjectId.isValid(id)) throw new Error("Invalid ID");

      const adj = await StockAdjustment.findById(id)
        .populate("adminid", "name")
        .populate("branchid", "branchname")
        .populate("items.productid", "name productvariants")
        .lean();

      if (!adj) return null;

      return {
        ...adj,
        id: adj._id?.toString(),
        adminid: { id: (adj.adminid as any)?._id?.toString(), name: (adj.adminid as any)?.name },
        branchid: { id: (adj.branchid as any)?._id?.toString(), branchname: (adj.branchid as any)?.branchname },
        items: (adj.items || []).map((item: any) => {
          const product = item.productid;
          return {
            ...item,
            productid: product ? { id: product._id?.toString(), name: product.name } : null,
            variantid: item.variantid?.toString()
          };
        })
      };
    }
  },

  Mutation: {
    createStockAdjustment: async (_: any, { input }: any, context: any) => {
      try {
        const adminId = normalizeId(input.adminid);
        const branchId = normalizeId(input.branchid);
        if (!adminId || !branchId) throw new Error("Admin ID and Branch ID are required");

        const items = (input.items || []).map((item: any) => ({
          ...item,
          productid: normalizeId(item.productid),
          variantid: normalizeId(item.variantid),
        }));
        if (!items.some((i: any) => Number(i.quantity) > 0)) {
          throw new Error("Add at least one product with a quantity.");
        }

        // Validate EVERYTHING before the voucher is written — previously the
        // voucher was saved first, so a failed stock check left an active
        // voucher (and a used-up number) with no stock effect.
        for (const item of items) {
          if (Number(item.quantity) > 0) await resolveVariant(item, true);
        }
        if (input.type !== "Excess") {
          await assertNoNegative(qtyByVariant(items, -1), adminId, branchId, "save this shortage");
        }

        const { user } = context;
        const createdbyData = {
          createdby_id: user?.id,
          createdby_name: input.createdby_name || user?.name || user?.email,
          createdby_type: user?.type || input.createdby_type || "admin",
        };

        const newAdj = await StockAdjustment.create({
          ...input,
          adminid: adminId,
          branchid: branchId,
          items,
          stockreversed: false,
          ...createdbyData,
        });

        await applyRows(items, adminId, branchId, inAction(input.type), true);

        return { ...newAdj.toObject(), id: newAdj._id.toString() };
      } catch (err) {
        console.error("Error creating stock adjustment:", err);
        throw err;
      }
    },

    updateStockAdjustment: async (_: any, { id, input }: any, context: any) => {
      try {
        const adj: any = await StockAdjustment.findById(id);
        if (!adj) throw new Error("Stock adjustment not found");
        // A deleted voucher's stock is already reversed — editing it would
        // reverse it a second time.
        if (!adj.status) throw new Error("This adjustment is deleted. Restore it before editing.");

        const { user } = context;
        const createdbyUpdate = {
          createdby_name: input.createdby_name || adj.createdby_name || user?.name || user?.email,
        };

        const newItems = (input.items || []).map((item: any) => ({
          ...item,
          productid: normalizeId(item.productid),
          variantid: normalizeId(item.variantid),
        }));
        if (!newItems.some((i: any) => Number(i.quantity) > 0)) {
          throw new Error("Add at least one product with a quantity.");
        }
        for (const item of newItems) {
          if (Number(item.quantity) > 0) await resolveVariant(item, true);
        }

        const newType = input.type || adj.type;
        // Net effect per variant = undo old + apply new, checked together.
        const net = qtyByVariant(adj.items, (-effectSign(adj.type)) as 1 | -1);
        qtyByVariant(newItems, effectSign(newType), net);
        await assertNoNegative(net, adj.adminid, adj.branchid, "update this adjustment");

        await applyRows(adj.items, adj.adminid, adj.branchid, outAction(adj.type), false);
        await applyRows(newItems, adj.adminid, adj.branchid, inAction(newType), true);

        const updated = await StockAdjustment.findByIdAndUpdate(
          id,
          {
            adjustmentdate: input.adjustmentdate ?? adj.adjustmentdate,
            type: newType,
            reason: input.reason ?? adj.reason,
            items: newItems,
            totalamount: input.totalamount,
            ...createdbyUpdate,
          },
          { new: true }
        );

        return { ...updated!.toObject(), id: updated!._id.toString() };
      } catch (err) {
        console.error("Error updating stock adjustment:", err);
        throw err;
      }
    },

    // Delete now REVERSES the stock (it used to only flag the voucher, while
    // Restore re-applied it — every delete + restore double-counted).
    deleteStockAdjustment: async (_: any, { id }: any) => reverseAndDeactivate(id),

    cancelStockAdjustment: async (_: any, { id }: any) => reverseAndDeactivate(id),

    resetStockAdjustment: async (_: any, { id }: any) => {
      const adj: any = await StockAdjustment.findById(id);
      if (!adj) throw new Error("Adjustment not found");
      if (adj.status) throw new Error("Adjustment is already active");

      // Vouchers deleted before this fix never had their stock reversed, so
      // their effect is still in stock — just re-activate them.
      if (adj.stockreversed) {
        if (adj.type !== "Excess") {
          await assertNoNegative(qtyByVariant(adj.items, -1), adj.adminid, adj.branchid, "restore this shortage");
        }
        await applyRows(adj.items, adj.adminid, adj.branchid, inAction(adj.type), false);
      }

      adj.status = true;
      adj.stockreversed = false;
      await adj.save();
      return true;
    },
  },
};
