import { Product } from '../../../models/products';
import { ProductBranchStock } from '../../../models/productbranchstock';
import { Types } from 'mongoose';

interface Context {
  branchid?: string;
}

export const productResolvers = {
  Query: {
    getProducts: async (_parent: any, args: { adminId?: string; branchid?: string }, context: Context) => {
      const query: any = { status: true };
      if (args.adminId) query.admin = args.adminId;

      const products = await Product.find(query).populate('admin').lean();
      const productIds = products.map((p) => p._id);
      const branchid = args.branchid || context.branchid;

      const enrichProduct = (p: any, stock: any) => ({
        id: p._id.toString(),
        ...p,
        admin: p.admin
          ? {
              id: p.admin._id?.toString?.() || p.admin.toString?.() || null,
              name: p.admin.name,
              email: p.admin.email,
            }
          : null,
        openingstock: stock?.openingstock ?? 0,
        openingstockamount: stock?.openingstockamount ?? 0,
        currentstock: stock?.currentstock ?? 0,
        currentstockamount: stock?.currentstockamount ?? 0,
        minimumstock: stock?.minimumstock ?? 0,
      });

      if (!branchid) {
        const aggregatedStocks = await ProductBranchStock.aggregate([
          { $match: { productid: { $in: productIds } } },
          {
            $group: {
              _id: '$productid',
              openingstock: { $sum: '$openingstock' },
              openingstockamount: { $sum: '$openingstockamount' },
              currentstock: { $sum: '$currentstock' },
              currentstockamount: { $sum: '$currentstockamount' },
              minimumstock: { $sum: '$minimumstock' },
            },
          },
        ]);

        const stockMap = new Map<string, any>();
        aggregatedStocks.forEach((s) => stockMap.set(s._id.toString(), s));

        return products.map((p) => enrichProduct(p, stockMap.get(p._id.toString())));
      }

      const stocks = await ProductBranchStock.find({ branchid, productid: { $in: productIds } }).lean();
      const stockMap = new Map<string, any>();
      stocks.forEach((s) => stockMap.set(s.productid.toString(), s));

      return products.map((p) => enrichProduct(p, stockMap.get(p._id.toString())));
    },

    getDeletedProducts: async (_parent: any, args: { adminId?: string; branchid?: string }, context: Context) => {
      const query: any = { status: false };
      if (args.adminId) query.admin = args.adminId;

      const deletedProducts = await Product.find(query).populate('admin').lean();
      const productIds = deletedProducts.map((p) => p._id);
      const branchid = args.branchid || context.branchid;

      const enrichProduct = (p: any, stock: any) => ({
        id: p._id.toString(),
        ...p,
        admin: p.admin
          ? {
              id: p.admin._id?.toString?.() || p.admin.toString?.() || null
            }
          : null,
        openingstock: stock?.openingstock ?? 0,
        openingstockamount: stock?.openingstockamount ?? 0,
        currentstock: stock?.currentstock ?? 0,
        currentstockamount: stock?.currentstockamount ?? 0,
        minimumstock: stock?.minimumstock ?? 0,
      });

      if (!branchid) {
        const aggregatedStocks = await ProductBranchStock.aggregate([
          { $match: { productid: { $in: productIds } } },
          {
            $group: {
              _id: '$productid',
              openingstock: { $sum: '$openingstock' },
              openingstockamount: { $sum: '$openingstockamount' },
              currentstock: { $sum: '$currentstock' },
              currentstockamount: { $sum: '$currentstockamount' },
              minimumstock: { $sum: '$minimumstock' },
            },
          },
        ]);

        const stockMap = new Map<string, any>();
        aggregatedStocks.forEach((s) => stockMap.set(s._id.toString(), s));

        return deletedProducts.map((p) => enrichProduct(p, stockMap.get(p._id.toString())));
      }

      const stocks = await ProductBranchStock.find({ branchid, productid: { $in: productIds } }).lean();
      const stockMap = new Map<string, any>();
      stocks.forEach((s) => stockMap.set(s.productid.toString(), s));

      return deletedProducts.map((p) => enrichProduct(p, stockMap.get(p._id.toString())));
    },

    getProduct: async (_parent: any, args: { id: string; adminId?: string; branchid?: string }, context: Context) => {
      const query: any = { _id: args.id, status: true };
      if (args.adminId) query.admin = args.adminId;

      const product = await Product.findOne(query).populate('admin').lean();
      if (!product) return null;

      const branchid = args.branchid || context.branchid;

      if (!branchid) {
        const aggregatedStock = await ProductBranchStock.aggregate([
          { $match: { productid: new Types.ObjectId(args.id) } },
          {
            $group: {
              _id: '$productid',
              openingstock: { $sum: '$openingstock' },
              openingstockamount: { $sum: '$openingstockamount' },
              currentstock: { $sum: '$currentstock' },
              currentstockamount: { $sum: '$currentstockamount' },
              minimumstock: { $sum: '$minimumstock' },
            },
          },
        ]);

        const stock = aggregatedStock[0] || {};

        return {
          id: product._id.toString(),
          ...product,
          admin: product.admin
            ? {
                id: product.admin._id?.toString?.() || product.admin.toString?.() || null
              }
            : null,
          openingstock: stock.openingstock ?? 0,
          openingstockamount: stock.openingstockamount ?? 0,
          currentstock: stock.currentstock ?? 0,
          currentstockamount: stock.currentstockamount ?? 0,
          minimumstock: stock.minimumstock ?? 0,
        };
      }

      const stock = await ProductBranchStock.findOne({ productid: new Types.ObjectId(args.id), branchid }).lean();

      return {
        id: product._id.toString(),
        ...product,
        admin: product.admin
          ? {
              id: product.admin._id?.toString?.() || product.admin.toString?.() || null
            }
          : null,
        openingstock: stock?.openingstock ?? null,
        openingstockamount: stock?.openingstockamount ?? null,
        currentstock: stock?.currentstock ?? null,
        currentstockamount: stock?.currentstockamount ?? null,
        minimumstock: stock?.minimumstock ?? null,
      };
    },
  },

  Mutation: {
    addProduct: async (_parent: any, { input }: any) => {
      const created = await Product.create(input);
      return await Product.findById(created._id).populate('admin');
    },

    addProducts: async (_parent: any, { inputs }: { inputs: any[] }) => {
      const inserted = await Product.insertMany(inputs);
      const ids = inserted.map((p) => p._id);
      return await Product.find({ _id: { $in: ids } }).populate('admin');
    },

    editProduct: async (_parent: any, { id, input }: { id: string; input: any }, context: Context) => {
      const {
        openingstock,
        openingstockamount,
        currentstock,
        currentstockamount,
        minimumstock,
        ...productFields
      } = input;

      const updatedProduct = await Product.findByIdAndUpdate(id, productFields, { new: true }).populate('admin');

      if (
        (openingstock !== undefined ||
          openingstockamount !== undefined ||
          currentstock !== undefined ||
          currentstockamount !== undefined ||
          minimumstock !== undefined) &&
        context?.branchid
      ) {
        const stockUpdate: Record<string, any> = {};
        if (openingstock !== undefined) stockUpdate.openingstock = openingstock;
        if (openingstockamount !== undefined) stockUpdate.openingstockamount = openingstockamount;
        if (currentstock !== undefined) stockUpdate.currentstock = currentstock;
        if (currentstockamount !== undefined) stockUpdate.currentstockamount = currentstockamount;
        if (minimumstock !== undefined) stockUpdate.minimumstock = minimumstock;

        await ProductBranchStock.updateOne(
          { productid: id, branchid: context.branchid },
          { $set: stockUpdate },
          { upsert: true }
        );
      }

      return updatedProduct;
    },

    deleteProduct: async (_parent: any, { id }: any) => {
      const result = await Product.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },

    resetProduct: async (_parent: any, { id }: { id: string }) => {
      const result = await Product.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    },
  },
};
