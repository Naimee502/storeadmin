import { ProductService } from '../../../models/products';
import { Types } from 'mongoose';
import { getAvailableStock, manageStock } from '../../../utils/stockmanager';

export const productServiceResolvers = {
  Query: {
    // ✅ Fetch product list with stock
    getProductServices: async (_: any, { filter = {}, limit, offset }: any) => {
      const query: any = {};
      query.status = filter.status !== undefined ? filter.status : true;
      [
        "adminid",
        "vendorid",
        "productcode",
        "productbarcode",
        "servicecode",
        "servicebarcode",
        "isservice",
        "isvariant",
        "isfeatured",
        "isshowinpos",
        "status",
        "categoryid",
        "subcategoryid",
        "groupid",
        "modelid",
        "brandid",
        "sizeid",
      ].forEach((key) => {
        if (filter[key] !== undefined && filter[key] !== "") query[key] = filter[key];
      });

      // 🔹 Name search
      if (filter.name_contains) {
        query.name = { $regex: filter.name_contains, $options: "i" };
      }

      // 🔹 Date range
      if (filter.createdFrom || filter.createdTo) {
        query.createdAt = {};
        if (filter.createdFrom) query.createdAt.$gte = new Date(filter.createdFrom);
        if (filter.createdTo) query.createdAt.$lte = new Date(filter.createdTo);
      }

      // 🔹 Count & Fetch products
      const totalCount = await ProductService.countDocuments(query);
      let productsQuery = ProductService.find(query);
      if (offset) productsQuery = productsQuery.skip(offset);
      if (limit) productsQuery = productsQuery.limit(limit);
      const products = await productsQuery.exec();

      const adminId = filter.adminid ? new Types.ObjectId(filter.adminid) : undefined;
      const branchId = filter.branchid ? new Types.ObjectId(filter.branchid) : undefined;

      // 🔹 Helper: Convert _id to id in nested objects
      const mapNestedIds = (product: any) => {
        const p = product.toObject();
        p.id = p._id.toString();

        if (p.productvariants) {
          p.productvariants = p.productvariants.map((v: any) => ({
            ...v,
            id: v._id?.toString(),
            serials: v.serials?.map((s: any) => ({ ...s, id: s._id?.toString() })),
            salesrate: v.salesrate?.map((r: any) => ({ ...r, id: r._id?.toString() })),
          }));
        }

        if (p.servicevariants) {
          p.servicevariants = p.servicevariants.map((sv: any) => ({
            ...sv,
            id: sv._id?.toString(),
          }));
        }

        return p;
      };

      // 🔹 Map products and fetch stock
      const response = await Promise.all(
        products.map(async (p) => {
          const mapped = mapNestedIds(p);

          // ✅ Variant-level stock
          if (mapped.productvariants?.length) {
            mapped.productvariants = await Promise.all(
              mapped.productvariants.map(async (v: any) => {
                const stock = await getAvailableStock(
                  mapped._id,  // productId
                  adminId,     // adminId
                  branchId,    // branchId
                  v._id        // variantId
                );
                return { ...v, currentstock: stock };
              })
            );
          }

          // ✅ Product-level stock
          const productStock = await getAvailableStock(
            mapped._id,  // productId
            adminId,     // adminId
            branchId     // branchId
          );
          mapped.currentstock = productStock;

          return mapped;
        })
      );

      return response;
    },
    getProductServiceById: async (
      _: any,
      { id, branchId, adminId }: { id: string; branchId?: string; adminId: string }
    ) => {
      if (!Types.ObjectId.isValid(id)) {
        throw new Error("Invalid product ID");
      }

      const product = await ProductService.findById(id);
      if (!product) return null;

      const stock = await getAvailableStock(
        new Types.ObjectId(product._id),
        adminId ? new Types.ObjectId(adminId) : undefined,
        branchId ? new Types.ObjectId(branchId) : undefined
      );

      // ✅ Map _id → id
      const response = product.toObject();
      response.id = response._id.toString();

      // ✅ Map nested variant IDs too (optional but recommended)
      if (response.productvariants) {
        response.productvariants = response.productvariants.map((v: any) => ({
          ...v,
          id: v._id?.toString(),
        }));
      }
      if (response.servicevariants) {
        response.servicevariants = response.servicevariants.map((sv: any) => ({
          ...sv,
          id: sv._id?.toString(),
        }));
      }
      return response;
    }
  },
  Mutation: {
    addProductService: async (_: any, { input }: any) => {
      // Step 1: Create product
      const created = await ProductService.create(input);

      // Step 2: Reload product to get real variant IDs
      const savedProduct = await ProductService.findById(created._id);
      if (!savedProduct) {
        throw new Error("Failed to find the created product");
      }

      // Step 3: Create stock with actual variant._id
      await Promise.all(
        (savedProduct.productvariants || []).map((v: any) =>
          manageStock({
            productId: savedProduct._id,
            branchId: input.branchid,
            variant: v,
            qty: v.openingstock ?? 0,
            action: "CREATE_PRODUCT",
          })
        )
      );

      return savedProduct;
    },
    updateProductService: async (_: any, { id, input }: any) => {
      const product = await ProductService.findById(id);
      if (!product) throw new Error('Product not found');

      product.set(input);
      const updated = await product.save();

      await Promise.all(
        (input.productvariants || []).map((v: any) =>
          manageStock({
            productId: updated._id,
            branchId: product.branchid,
            variant: v,
            qty: v.currentstock ?? 0,
            action: 'ADJUSTMENT',
            allowCreate: false,
          })
        )
      );

      return updated;
    },
    deleteProductService: async (_: any, { id }: { id: string }) => {
      const result = await ProductService.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },

    resetProductService: async (_: any, { id }: { id: string }) => {
      const result = await ProductService.findByIdAndUpdate(
        id,
        { status: true }, // reset the status or any other fields you want
        { new: true }
      );
      return !!result; // returns true if found & updated, false if not
    }
  },
};
