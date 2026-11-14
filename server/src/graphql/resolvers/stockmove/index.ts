import { Types } from "mongoose";
import { StockMove } from "../../../models/stockmove";
import { ProductService } from "../../../models/products";
import { requireBackofficeTenant } from "../../../utils/tenant";
import { isoOf } from "../../../utils/offlinesync";
import { istDayEnd, istDayStart } from "../../../utils/ist";

const oid = (v: any) => (v && Types.ObjectId.isValid(String(v)) ? new Types.ObjectId(String(v)) : undefined);

export const stockMoveResolvers = {
  Query: {
    getStockMoves: async (_: any, args: any, context: any) => {
      const scope = await requireBackofficeTenant(context, { requestedBranchId: args.branchid });
      const q: any = { adminid: scope.adminid };
      if (scope.branchid) q.branchid = scope.branchid;
      if (oid(args.productid)) q.productid = oid(args.productid);
      if (oid(args.variantid)) q.variantid = oid(args.variantid);
      if (args.doctype) q.doctype = String(args.doctype);
      const range: any = {};
      if (args.from) range.$gte = istDayStart(new Date(args.from));
      if (args.to) range.$lte = istDayEnd(new Date(args.to));
      if (Object.keys(range).length) q.createdAt = range;
      const limit = Math.min(Math.max(Number(args.limit) || 50, 1), 500);
      const offset = Math.max(Number(args.offset) || 0, 0);
      const [rows, total] = await Promise.all([
        StockMove.find(q).sort({ createdAt: -1, _id: -1 }).skip(offset).limit(limit).lean(),
        StockMove.countDocuments(q),
      ]);
      const names = new Map<string, string>();
      const ids = Array.from(new Set(rows.map((r: any) => String(r.productid))));
      if (ids.length) {
        const prods: any[] = await ProductService.find({ _id: { $in: ids } }).select("name").lean();
        prods.forEach((p) => names.set(String(p._id), p.name));
      }
      return {
        total,
        rows: rows.map((r: any) => ({
          ...r,
          id: String(r._id),
          productname: names.get(String(r.productid)) || "",
          date: isoOf(r.date),
          createdAt: isoOf(r.createdAt),
        })),
      };
    },
  },
};
