import { Brand } from "../../../models/brands";
import { containsRx, textMatch, pageWindow, activeFilters, notCleared } from "../../../utils/listquery";

// Status text exactly as the list shows it.
const STATUS_TEXT = { $cond: ["$status", "Active", "Inactive"] };

/** Search and column filters for the Brands list, matched on the text each column shows. */
function listClauses(search?: string, columnFilters?: any[]): any[] {
  const clauses: any[] = [];
  const term = String(search || "").trim();
  if (term) {
    const rx = containsRx(term);
    clauses.push({ $or: [{ brandcode: rx }, { brandname: rx }, textMatch(STATUS_TEXT, term)] });
  }
  for (const f of activeFilters(columnFilters)) {
    if (f.key === "brandcode") clauses.push({ brandcode: containsRx(f.value) });
    else if (f.key === "brandname") clauses.push({ brandname: containsRx(f.value) });
    else if (f.key === "status") clauses.push(textMatch(STATUS_TEXT, f.value));
  }
  return clauses;
}

export const brandResolvers = {
  Query: {
    // Brands list page: one page, newest first (the old list reversed).
    getBrandsPage: async (
      _: any,
      { adminId, page, pageSize, search, columnFilters }: { adminId?: string; page?: number; pageSize?: number; search?: string; columnFilters?: any[] }
    ) => {
      const base: any = { status: true };
      if (adminId) base.admin = adminId;
      const query = { $and: [base, ...listClauses(search, columnFilters)] };
      const { skip, limit } = pageWindow(page, pageSize);
      const [total, items] = await Promise.all([
        Brand.countDocuments(query),
        Brand.find(query).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).populate("admin", "name email"),
      ]);
      return { items, total };
    },

    // Get all active brands for optional admin
    getBrands: async (_: any, { adminId }: { adminId?: string }) => {
      const query: any = { status: true };
      if (adminId) query.admin = adminId;
      return await Brand.find(query).sort({ createdAt: 1, _id: 1 }).populate("admin", "name email"); // list: clients only read admin id/name/email
    },

    // Get one brand by id for optional admin
    getBrandById: async (_: any, { id, adminId }: { id: string; adminId?: string }) => {
      const query: any = { _id: id };
      if (adminId) query.admin = adminId;
      return await Brand.findOne(query).populate("admin"); // ✅ FIXED
    },

    // Get all deleted brands for optional admin
    getDeletedBrands: async (_: any, { adminId }: { adminId?: string }) => {
      const query: any = { status: false, ...notCleared };
      if (adminId) query.admin = adminId;
      return await Brand.find(query).sort({ createdAt: 1, _id: 1 }).populate("admin"); // ✅ FIXED
    },
  },

  Mutation: {
    addBrand: async (_: any, { input }: any) => {
      const brand = await Brand.create(input);
      return await Brand.findById(brand._id).populate("admin");
    },

    editBrand: async (_: any, { id, input }: any) => {
      return await Brand.findByIdAndUpdate(id, input, { new: true }).populate("admin");
    },

    // Soft delete brand
    deleteBrand: async (_: any, { id }: any) => {
      const result = await Brand.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },

    // Restore brand
    resetBrand: async (_: any, { id }: any) => {
      const result = await Brand.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    },
  },
};

