import { Types } from "mongoose";
import { StockAdjustment } from "../../../models/stockadjustments";
import { manageStock, StockAction, getStockDetails } from "../../../utils/stockmanager";
import { ProductService } from "../../../models/products";

function normalizeId(value: any) {
  if (!value) return null;
  if (typeof value === "object") {
    if (value.id && Types.ObjectId.isValid(value.id)) return new Types.ObjectId(value.id);
    if (value._id && Types.ObjectId.isValid(value._id)) return new Types.ObjectId(value._id);
  }
  if (typeof value === "string" && Types.ObjectId.isValid(value)) return new Types.ObjectId(value);
  return null;
}

export const stockAdjustmentResolvers = {
  Query: {
    getStockAdjustments: async (_: any, { filter = {}, limit = 50, offset = 0 }: any) => {
      try {
        const query: any = {};

        // Only filter by status when explicitly passed
        if (filter.status !== undefined) query.status = filter.status;

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

        let dbQuery = StockAdjustment.find(query)
          .populate("adminid", "name")
          .populate("branchid", "branchname")
          .populate("items.productid", "name productvariants")
          .sort({ createdAt: -1 })
          .lean();

        if (offset) dbQuery = dbQuery.skip(offset);
        if (limit) dbQuery = dbQuery.limit(limit);

        const adjustments = await dbQuery.exec();

        return adjustments.map((adj: any) => ({
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
        }));
      } catch (err) {
        console.error("Error in getStockAdjustments:", err);
        throw new Error("Failed to fetch stock adjustments");
      }
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
        branchid: { id: (adj.branchid as any)?._id?.toString(), name: (adj.branchid as any)?.branchname },
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
          variantid: normalizeId(item.variantid)
        }));

        // Extract user context from JWT token - match ExpenseNote pattern
        const { user } = context;
        const createdbyData = {
          createdby_id: user?.id,
          createdby_name: user?.name || user?.email,
          createdby_type: user?.type || 'admin',
        };

        console.log("=== Stock Adjustment Create ===");
        console.log("User from context:", user);
        console.log("CreatedbyData:", createdbyData);

        const newAdj = await StockAdjustment.create({
          ...input,
          adminid: adminId,
          branchid: branchId,
          items,
          ...createdbyData
        });

        console.log("Created Stock Adjustment:", {
          id: newAdj._id,
          createdby_id: newAdj.createdby_id,
          createdby_name: newAdj.createdby_name,
          createdby_type: newAdj.createdby_type
        });

        // Loop over items and adjust stock using manageStock
        const actionType: StockAction = input.type === "Excess" ? "TRANSFER_IN" : "TRANSFER_OUT";

        // Pre-validate stock for Shortage
        if (actionType === "TRANSFER_OUT") {
          for (const item of items) {
            if (item.quantity > 0) {
              const product = await ProductService.findById(item.productid);
              if (product) {
                const stockDetails = await getStockDetails(item.productid, adminId, branchId, item.variantid);
                if (stockDetails.currentstock - item.quantity < 0) {
                  throw new Error(`Insufficient stock for product ${product.name}. Current stock: ${stockDetails.currentstock}, required: ${item.quantity}.`);
                }
              }
            }
          }
        }

        for (const item of items) {
          if (item.quantity > 0) {
            const product = await ProductService.findById(item.productid);
            if (product && product.productvariants) {
              const variant = product.productvariants.find((v: any) => v._id.equals(item.variantid));
              if (variant) {
                await manageStock({
                  adminId: adminId,
                  productId: item.productid,
                  branchId: branchId,
                  variant: variant as any,
                  qty: item.quantity,
                  unitId: variant.baseunitid,
                  action: actionType,
                  allowCreate: true,
                  rate: item.rate
                });
              }
            }
          }
        }

        return {
          ...newAdj.toObject(),
          id: newAdj._id.toString()
        };
      } catch (err) {
        console.error("Error creating stock adjustment:", err);
        throw err;
      }
    },

    updateStockAdjustment: async (_: any, { id, input }: any) => {
      try {
        const adj = await StockAdjustment.findById(id);
        if (!adj) throw new Error("Stock adjustment not found");

        const newItems = (input.items || []).map((item: any) => ({
          ...item,
          productid: normalizeId(item.productid),
          variantid: normalizeId(item.variantid)
        }));

        // Pre-validate to ensure update does not cause negative stock
        const netChanges = new Map<string, { productid: any; variantid: any; netQty: number }>();
        
        // 1. Reversal of old items
        for (const item of adj.items) {
          if (!item.variantid) continue;
          const key = `${item.productid.toString()}_${item.variantid.toString()}`;
          let netQty = 0;
          if (adj.type === "Excess") netQty -= item.quantity;
          else netQty += item.quantity;
          netChanges.set(key, { productid: item.productid, variantid: item.variantid, netQty });
        }

        // 2. Application of new items
        const newType = input.type || adj.type;
        for (const item of newItems) {
          if (!item.variantid) continue;
          const key = `${item.productid.toString()}_${item.variantid.toString()}`;
          let current = netChanges.get(key) || { productid: item.productid, variantid: item.variantid, netQty: 0 };
          if (newType === "Excess") current.netQty += item.quantity;
          else current.netQty -= item.quantity;
          netChanges.set(key, current);
        }

        // 3. Check for any negative stock result
        for (const [key, data] of netChanges.entries()) {
          if (data.netQty < 0) {
            const product = await ProductService.findById(data.productid);
            if (product) {
              const stockDetails = await getStockDetails(data.productid, adj.adminid, adj.branchid, data.variantid);
              if (stockDetails.currentstock + data.netQty < 0) {
                throw new Error(`Insufficient stock for product ${product.name}. Current stock is ${stockDetails.currentstock}, but the adjustment requires a reduction of ${Math.abs(data.netQty)}.`);
              }
            }
          }
        }

        // Step 1: Reverse the old stock impact
        const oldReverseAction: StockAction = adj.type === "Excess" ? "TRANSFER_OUT" : "TRANSFER_IN";
        for (const item of adj.items) {
          if (item.quantity > 0) {
            const product = await ProductService.findById(item.productid);
            if (product && product.productvariants) {
              const variant = product.productvariants.find((v: any) => v._id.equals(item.variantid));
              if (variant) {
                await manageStock({
                  adminId: adj.adminid,
                  productId: item.productid,
                  branchId: adj.branchid,
                  variant: variant as any,
                  qty: item.quantity,
                  unitId: variant.baseunitid,
                  action: oldReverseAction,
                  allowCreate: false,
                  rate: item.rate
                });
              }
            }
          }
        }

        // Step 2: Apply new stock impact

        const newActionType: StockAction = (input.type || adj.type) === "Excess" ? "TRANSFER_IN" : "TRANSFER_OUT";
        for (const item of newItems) {
          if (item.quantity > 0) {
            const product = await ProductService.findById(item.productid);
            if (product && product.productvariants) {
              const variant = product.productvariants.find((v: any) => v._id.equals(item.variantid));
              if (variant) {
                await manageStock({
                  adminId: adj.adminid,
                  productId: item.productid,
                  branchId: adj.branchid,
                  variant: variant as any,
                  qty: item.quantity,
                  unitId: variant.baseunitid,
                  action: newActionType,
                  allowCreate: true,
                  rate: item.rate
                });
              }
            }
          }
        }

        // Step 3: Update the document
        const updated = await StockAdjustment.findByIdAndUpdate(
          id,
          {
            adjustmentdate: input.adjustmentdate ?? adj.adjustmentdate,
            type: input.type ?? adj.type,
            reason: input.reason ?? adj.reason,
            items: newItems,
            totalamount: input.totalamount,
          },
          { new: true }
        );

        return {
          ...updated!.toObject(),
          id: updated!._id.toString()
        };
      } catch (err) {
        console.error("Error updating stock adjustment:", err);
        throw err;
      }
    },

    deleteStockAdjustment: async (_: any, { id }: any) => {

      // Deleting stock adjustment should theoretically reverse the stock impact.
      // For now, we simply mark it as inactive.
      const result = await StockAdjustment.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },

    cancelStockAdjustment: async (_: any, { id }: any) => {
      // Complete cancellation logic: reverse the stock changes
      const adj = await StockAdjustment.findById(id);
      if (!adj || !adj.status) throw new Error("Adjustment not found or already cancelled");

      const reverseAction: StockAction = adj.type === "Excess" ? "TRANSFER_OUT" : "TRANSFER_IN";

      // Pre-validate stock for cancelling Excess
      if (adj.type === "Excess") {
        for (const item of adj.items) {
          if (item.quantity > 0) {
            const product = await ProductService.findById(item.productid);
            if (product) {
              const stockDetails = await getStockDetails(item.productid, adj.adminid, adj.branchid, item.variantid);
              if (stockDetails.currentstock - item.quantity < 0) {
                throw new Error(`Cannot cancel adjustment. Insufficient stock for product ${product.name}. Current stock: ${stockDetails.currentstock}, required to reverse: ${item.quantity}.`);
              }
            }
          }
        }
      }

      for (const item of adj.items) {
        if (item.quantity > 0) {
          const product = await ProductService.findById(item.productid);
          if (product && product.productvariants) {
            const variant = product.productvariants.find((v: any) => v._id.equals(item.variantid));
            if (variant) {
              await manageStock({
                adminId: adj.adminid,
                productId: item.productid,
                branchId: adj.branchid,
                variant: variant as any,
                qty: item.quantity,
                unitId: variant.baseunitid,
                action: reverseAction,
                allowCreate: false,
                rate: item.rate
              });
            }
          }
        }
      }

      adj.status = false;
      await adj.save();
      return true;
    },

    resetStockAdjustment: async (_: any, { id }: any) => {
      const adj = await StockAdjustment.findById(id);
      if (!adj) throw new Error("Adjustment not found");
      if (adj.status) throw new Error("Adjustment is already active");

      // Re-apply the stock impact
      const actionType: StockAction = adj.type === "Excess" ? "TRANSFER_IN" : "TRANSFER_OUT";

      for (const item of adj.items) {
        if (item.quantity > 0) {
          const product = await ProductService.findById(item.productid);
          if (product && product.productvariants) {
            const variant = product.productvariants.find((v: any) => v._id.equals(item.variantid));
            if (variant) {
              await manageStock({
                adminId: adj.adminid,
                productId: item.productid,
                branchId: adj.branchid,
                variant: variant as any,
                qty: item.quantity,
                unitId: variant.baseunitid,
                action: actionType,
                allowCreate: true,
                rate: item.rate
              });
            }
          }
        }
      }

      adj.status = true;
      await adj.save();
      return true;
    }
  }
};

