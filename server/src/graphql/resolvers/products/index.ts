import { Product } from '../../../models/products';
import { ProductBranchStock } from '../../../models/productbranchstock';
import { Types } from 'mongoose';

interface Context {
  branchid?: string;
}

export const productResolvers = {
  Query: {
    getProducts: async (_parent: any, _args: any, context: Context) => {
      const products = await Product.find({ status: true }).lean();

      if (!context.branchid) {
        return products.map((p) => ({
          id: p._id.toString(),
          ...p,
          openingstock: null,
          openingstockamount: null,
          currentstock: null,
          currentstockamount: null,
          minimumstock: null,
        }));
      }

      const productIds = products.map((p) => p._id);
      const stocks = await ProductBranchStock.find({
        branchid: context.branchid,
        productid: { $in: productIds },
      }).lean();

      const stockMap = new Map<string, any>();
      stocks.forEach((stock) => {
        stockMap.set(stock.productid.toString(), stock);
      });

      return products.map((p) => {
        const stock = stockMap.get(p._id.toString());
        return {
          id: p._id.toString(),
          ...p,
          openingstock: stock?.openingstock ?? null,
          openingstockamount: stock?.openingstockamount ?? null,
          currentstock: stock?.currentstock ?? null,
          currentstockamount: stock?.currentstockamount ?? null,
          minimumstock: stock?.minimumstock ?? null,
        };
      });
    },

    getDeletedProducts: async (_parent: any, _args: any, context: Context) => {
      const deletedProducts = await Product.find({ status: false }).lean();

      if (!context.branchid) {
        return deletedProducts.map((p) => ({
          id: p._id.toString(),
          ...p,
          openingstock: null,
          openingstockamount: null,
          currentstock: null,
          currentstockamount: null,
          minimumstock: null,
        }));
      }

      const productIds = deletedProducts.map((p) => p._id);
      const stocks = await ProductBranchStock.find({
        branchid: context.branchid,
        productid: { $in: productIds },
      }).lean();

      const stockMap = new Map<string, any>();
      stocks.forEach((stock) => {
        stockMap.set(stock.productid.toString(), stock);
      });

      return deletedProducts.map((p) => {
        const stock = stockMap.get(p._id.toString());
        return {
          id: p._id.toString(),
          ...p,
          openingstock: stock?.openingstock ?? null,
          openingstockamount: stock?.openingstockamount ?? null,
          currentstock: stock?.currentstock ?? null,
          currentstockamount: stock?.currentstockamount ?? null,
          minimumstock: stock?.minimumstock ?? null,
        };
      });
    },

    getProduct: async (_parent: any, { id }: { id: string }, context: Context) => {
      const product = await Product.findOne({ _id: id, status: true }).lean();
      if (!product) {
        return null;
      }

      if (!context.branchid) {
        return {
          id: product._id.toString(),
          ...product,
          openingstock: null,
          openingstockamount: null,
          currentstock: null,
          currentstockamount: null,
          minimumstock: null,
        };
      }

      const stock = await ProductBranchStock.findOne({
        productid: new Types.ObjectId(id),
        branchid: context.branchid,
      }).lean();

      return {
        id: product._id.toString(),
        ...product,
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
      return await Product.create(input);
    },

    addProducts: async (_parent: any, { inputs }: { inputs: any[] }) => {
      return await Product.insertMany(inputs);
    },

    editProduct: async (
      _parent: any,
      { id, input }: { id: string; input: any },
      context: Context
    ) => {
      const {
        openingstock,
        openingstockamount,
        currentstock,
        currentstockamount,
        minimumstock,
        ...productFields
      } = input;

      const updatedProduct = await Product.findByIdAndUpdate(id, productFields, {
        new: true,
      });

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
        if (openingstockamount !== undefined)
          stockUpdate.openingstockamount = openingstockamount;
        if (currentstock !== undefined) stockUpdate.currentstock = currentstock;
        if (currentstockamount !== undefined)
          stockUpdate.currentstockamount = currentstockamount;
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
