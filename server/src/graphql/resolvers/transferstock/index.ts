import mongoose from "mongoose";
import { TransferStock } from "../../../models/transferstock";
import { ProductService } from "../../../models/products";
import { ProductBranchStock } from "../../../models/productbranchstock";
import { convertToBaseUnit } from "../../../utils/unitconversation";

// ── Stock validation ────────────────────────────────────────────────────────
// Net stock change per branch + product + variant, in BASE units. Add / edit /
// delete / restore all build these deltas and check them together, so two
// lines of the same variant can't each pass alone, and an edit is checked as
// (undo old voucher + apply new voucher).

type Delta = { branchid: any; productid: any; variantid: any; qty: number };

async function voucherDeltas(doc: any, sign: 1 | -1, into = new Map<string, Delta>()) {
  if (!doc) return into;
  for (const item of doc.items || []) {
    const qty = Number(item.transferqty) || 0;
    if (!item.productid || qty <= 0) continue;
    let base = qty;
    if (item.variantid && item.transferunitid) {
      const product: any = await ProductService.findById(item.productid);
      const variant = product?.productvariants?.find(
        (v: any) => String(v._id) === String(item.variantid)
      );
      if (variant) base = convertToBaseUnit(qty, item.transferunitid, variant);
    }
    // A transfer takes stock OUT of the from-branch and INTO the to-branch.
    for (const [branch, dir] of [[doc.frombranchid, -1], [doc.tobranchid, 1]] as const) {
      if (!branch) continue;
      const key = `${branch}_${item.productid}_${item.variantid || ""}`;
      const d = into.get(key) || { branchid: branch, productid: item.productid, variantid: item.variantid || null, qty: 0 };
      d.qty += sign * dir * base;
      into.set(key, d);
    }
  }
  return into;
}

async function assertDeltas(deltas: Map<string, Delta>, adminId: any, action: string) {
  if (!adminId) throw new Error("Admin is required");
  for (const d of deltas.values()) {
    if (d.qty >= 0) continue;
    const stock: any = await ProductBranchStock.findOne({
      adminid: new mongoose.Types.ObjectId(String(adminId)),
      productid: new mongoose.Types.ObjectId(String(d.productid)),
      branchid: new mongoose.Types.ObjectId(String(d.branchid)),
      variantid: d.variantid ? new mongoose.Types.ObjectId(String(d.variantid)) : null,
    });
    const available = stock?.currentstock ?? 0;
    if (available + d.qty < 0) {
      const product: any = await ProductService.findById(d.productid).select("name").lean();
      throw new Error(
        `Cannot ${action}: not enough stock of "${product?.name || "product"}" in the branch. ` +
        `Available: ${available}, needed: ${Math.abs(d.qty)} (base units).`
      );
    }
  }
}

export const transferStockResolvers = {
  Query: {
    getTransferStocks: async (
      _: any,
      { adminId, frombranchid }: { adminId?: string; frombranchid?: string },
      context: any
    ) => {
      const filter: any = { status: true };
      const { user } = context;

      if (user?.type === "branch") {
        filter.$or = [
          { createdby_type: "branch", createdby_id: user?.id },
          { frombranchid: user?.branch_id || user?.id },
        ];
      } else if (user?.type === "staff") {
        filter.createdby_id = user?.id;
      }

      if (adminId) filter.admin = new mongoose.Types.ObjectId(adminId);
      if (frombranchid) filter.frombranchid = new mongoose.Types.ObjectId(frombranchid);

      // Clients only read admin { id name email } on the list documents; a bare
      // populate("admin") pulled the whole admin record (password hash,
      // subscription fields...) once per voucher.
      return await TransferStock.find(filter)
        .populate({ path: "admin", select: "name email" })
        .sort({ createdAt: -1 });
    },

    getDeletedTransferStocks: async (
      _: any,
      { adminId, frombranchid }: { adminId?: string; frombranchid?: string },
      context: any
    ) => {
      const filter: any = { status: false };
      const { user } = context;

      if (user?.type === "branch") {
        filter.$or = [
          { createdby_type: "branch", createdby_id: user?.id },
          { frombranchid: user?.branch_id || user?.id },
        ];
      } else if (user?.type === "staff") {
        filter.createdby_id = user?.id;
      }

      if (adminId) filter.admin = new mongoose.Types.ObjectId(adminId);
      if (frombranchid) filter.frombranchid = new mongoose.Types.ObjectId(frombranchid);

      // Clients only read admin { id name email } on the list documents; a bare
      // populate("admin") pulled the whole admin record (password hash,
      // subscription fields...) once per voucher.
      return await TransferStock.find(filter)
        .populate({ path: "admin", select: "name email" })
        .sort({ createdAt: -1 });
    },

    getTransferStockById: async (_: any, { id, adminId }: { id: string; adminId?: string }) => {
      const filter: any = { _id: id };
      if (adminId) filter.admin = new mongoose.Types.ObjectId(adminId);
      return await TransferStock.findOne(filter).populate("admin");
    },
  },

  Mutation: {
    addTransferStock: async (_: any, { input }: any, context: any) => {
      const { user } = context;

      // Validate before any DB write — always (it used to be skipped when
      // input.admin was missing), and per variant across all lines.
      if (!input.frombranchid || !input.tobranchid) throw new Error("From and To branch are required");
      if (String(input.frombranchid) === String(input.tobranchid)) throw new Error("From and To branch cannot be the same");
      await assertDeltas(await voucherDeltas(input, 1), input.admin, "save this transfer");

      const createdbyData = {
        createdby_id:   user?.id,
        createdby_name: input.createdby_name || user?.name || user?.email,
        createdby_type: user?.type || input.createdby_type || "admin",
      };

      const newDoc = await TransferStock.create({ ...input, ...createdbyData });
      await TransferStock.adjustStock(null, newDoc);
      return await TransferStock.findById(newDoc._id).populate("admin");
    },

    editTransferStock: async (_: any, { id, input }: any, context: any) => {
      const oldDoc: any = await TransferStock.findById(id);
      if (!oldDoc) throw new Error("Transfer stock voucher not found");
      // A deleted voucher's stock is already reversed — editing it would
      // reverse it again.
      if (!oldDoc.status) throw new Error("This transfer is deleted. Restore it before editing.");

      const merged = { ...oldDoc.toObject(), ...input };
      if (String(merged.frombranchid) === String(merged.tobranchid)) throw new Error("From and To branch cannot be the same");
      const net = await voucherDeltas(oldDoc, -1);
      await voucherDeltas(merged, 1, net);
      await assertDeltas(net, oldDoc.admin, "update this transfer");

      const { user } = context;
      const createdbyData = {
        createdby_name: input.createdby_name || oldDoc.createdby_name || user?.name || user?.email,
      };

      const newDoc = await TransferStock.findByIdAndUpdate(
        id,
        { ...input, ...createdbyData },
        { new: true }
      );

      if (oldDoc && newDoc) await TransferStock.adjustStock(oldDoc, newDoc);

      return await TransferStock.findById(newDoc?._id).populate("admin");
    },

    deleteTransferStock: async (_: any, { id }: { id: string }) => {
      const oldDoc: any = await TransferStock.findById(id);
      if (!oldDoc) throw new Error("Transfer stock voucher not found");
      // Already deleted → its stock was already reverted; a second delete
      // (double click, retried request) used to revert it again.
      if (!oldDoc.status) return true;
      // Reverting pulls the stock back OUT of the to-branch — it must still be there.
      await assertDeltas(await voucherDeltas(oldDoc, -1), oldDoc.admin, "delete this transfer");
      // Flip status first (atomically, only if still active) so two concurrent
      // deletes can't both revert.
      const flipped = await TransferStock.findOneAndUpdate({ _id: id, status: true }, { status: false }, { new: true });
      if (!flipped) return true;
      await TransferStock.adjustStock(oldDoc, null); // revert stock
      return true;
    },

    resetTransferStock: async (_: any, { id }: { id: string }) => {
      const doc: any = await TransferStock.findById(id);
      if (!doc) throw new Error("Transfer stock voucher not found");
      // Restoring an active voucher used to apply the transfer twice.
      if (doc.status) throw new Error("This transfer is already active");
      await assertDeltas(await voucherDeltas(doc, 1), doc.admin, "restore this transfer");
      const result = await TransferStock.findOneAndUpdate({ _id: id, status: false }, { status: true }, { new: true });
      if (!result) throw new Error("This transfer is already active");
      await TransferStock.adjustStock(null, result); // re-apply stock
      return true;
    },
  },
};
