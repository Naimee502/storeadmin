import { ProductGroup } from "../../../models/productgroups";
import { containsRx, textMatch, pageWindow, activeFilters, notCleared } from "../../../utils/listquery";

// Status text exactly as the list shows it.
const STATUS_TEXT = { $cond: ["$status", "Active", "Inactive"] };

/** Search and column filters for the Product Groups list, matched on the text each column shows. */
function listClauses(search?: string, columnFilters?: any[]): any[] {
  const clauses: any[] = [];
  const term = String(search || "").trim();
  if (term) {
    const rx = containsRx(term);
    clauses.push({ $or: [{ productgroupcode: rx }, { productgroupname: rx }, textMatch(STATUS_TEXT, term)] });
  }
  for (const f of activeFilters(columnFilters)) {
    if (f.key === "productgroupcode") clauses.push({ productgroupcode: containsRx(f.value) });
    else if (f.key === "productgroupname") clauses.push({ productgroupname: containsRx(f.value) });
    else if (f.key === "status") clauses.push(textMatch(STATUS_TEXT, f.value));
  }
  return clauses;
}

export const productGroupResolvers = {
  Query: {
    // Product Groups list page: one page, newest first (the old list reversed).
    getProductGroupsPage: async (
      _: any,
      { adminId, page, pageSize, search, columnFilters }: { adminId?: string; page?: number; pageSize?: number; search?: string; columnFilters?: any[] }
    ) => {
      const base: any = { status: true };
      if (adminId) base.admin = adminId;
      const query = { $and: [base, ...listClauses(search, columnFilters)] };
      const { skip, limit } = pageWindow(page, pageSize);
      const [total, items] = await Promise.all([
        ProductGroup.countDocuments(query),
        ProductGroup.find(query).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).populate("admin", "name email"),
      ]);
      return { items, total };
    },

    // Get all active product groups, optionally filtered by admin
    getProductGroups: async (_: any, { adminId }: { adminId?: string }) => {
      const filter: any = { status: true };
      if (adminId) filter.admin = adminId;
      // Clients only ever request admin { id name email } on this list.
      return await ProductGroup.find(filter).sort({ createdAt: 1, _id: 1 }).populate("admin", "name email");
    },

    // Get all soft-deleted product groups, optionally filtered by admin
    getDeletedProductGroups: async (_: any, { adminId }: { adminId?: string }) => {
      const filter: any = { status: false, ...notCleared };
      if (adminId) filter.admin = adminId;
      return await ProductGroup.find(filter).sort({ createdAt: 1, _id: 1 }).populate("admin");
    },

    // Get one product group by ID, optionally filtered by admin
    getProductGroupById: async (_: any, { id, adminId }: { id: string; adminId?: string }) => {
      const filter: any = { _id: id };
      if (adminId) filter.admin = adminId;
      return await ProductGroup.findOne(filter).populate("admin");
    },
  },

  Mutation: {
    // Add product group with admin ref and return populated
    addProductGroup: async (_: any, { input }: any) => {
      const group = await ProductGroup.create(input);
      return await ProductGroup.findById(group._id).populate("admin");
    },

    // Edit and return populated product group
    editProductGroup: async (_: any, { id, input }: any) => {
      return await ProductGroup.findByIdAndUpdate(id, input, { new: true }).populate("admin");
    },

    // Soft delete (status = false)
    deleteProductGroup: async (_: any, { id }: any) => {
      const result = await ProductGroup.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },

    // Restore (status = true)
    resetProductGroup: async (_: any, { id }: any) => {
      const result = await ProductGroup.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    },
  },
};
