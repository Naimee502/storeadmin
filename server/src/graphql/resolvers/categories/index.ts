import { Category } from "../../../models/categories";

// Storefront order: explicit position first, then (for rows saved before
// sortorder existed) creation time — the order they were already shown in.
const DISPLAY_ORDER = { sortorder: 1, createdAt: 1 } as const;

const nextSortOrder = async (admin: any) => {
  const last = await Category.findOne({ admin, sortorder: { $ne: null } })
    .sort({ sortorder: -1 })
    .select("sortorder")
    .lean<{ sortorder?: number }>();
  return (last?.sortorder ?? 0) + 1;
};

export const categoryResolvers = {
  Query: {
    getCategories: async (_: any, { adminId }: { adminId?: string }) => {
      const query: any = { status: true };
      if (adminId) query.admin = adminId;

      return await Category.find(query).sort(DISPLAY_ORDER).populate("admin");
    },

    getCategoryById: async (_: any, { id, adminId }: { id: string, adminId?: string }) => {
      const query: any = { _id: id };
      if (adminId) query.admin = adminId;

      return await Category.findOne(query).populate("admin");
    },

    getDeletedCategories: async (_: any, { adminId }: { adminId?: string }) => {
      const query: any = { status: false };
      if (adminId) query.admin = adminId;

      return await Category.find(query).populate("admin");
    },
  },
  Mutation: {
    addCategory: async (_: any, { input }: any) => {
      // The model's pre-save hook puts a new category at the end of the list.
      const category = await Category.create(input);
      return await Category.findById(category._id).populate("admin");
    },  
    editCategory: async (_: any, { id, input }: any) => {
      const updatedCategory = await Category.findByIdAndUpdate(id, input, { new: true }).populate('admin');
      if (!updatedCategory) throw new Error("Category not found");
      return updatedCategory;
    },
    deleteCategory: async (_: any, { id }: any) => {
      const result = await Category.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },
    resetCategory: async (_: any, { id }: any) => {
      // A restored category comes back at the end of the storefront list
      // rather than jumping into whatever slot it held before deletion.
      const existing = await Category.findById(id).select("admin");
      if (!existing) return false;
      const sortorder = await nextSortOrder(existing.admin);
      const result = await Category.findByIdAndUpdate(id, { status: true, sortorder }, { new: true });
      return !!result;
    },
    reorderCategories: async (_: any, { adminId, ids }: { adminId: string; ids: string[] }) => {
      if (!adminId) throw new Error("adminId is required");
      const unique = Array.from(new Set(ids || []));

      // Only this business's categories can be moved, whatever ids are sent.
      const owned = await Category.find({ admin: adminId, _id: { $in: unique } }).select("_id").lean();
      const ownedSet = new Set(owned.map((c: any) => String(c._id)));
      const ordered = unique.filter((id) => ownedSet.has(String(id)));

      const ops: any[] = ordered.map((id, index) => ({
        updateOne: { filter: { _id: id, admin: adminId }, update: { $set: { sortorder: index + 1 } } },
      }));

      // Anything not in the list (added in another tab while this one was
      // being arranged, or a deleted entry) goes after it, keeping its own
      // relative order, so no two categories share a position.
      const rest = await Category.find({ admin: adminId, _id: { $nin: ordered } })
        .sort(DISPLAY_ORDER)
        .select("_id")
        .lean();
      rest.forEach((c: any, i: number) => {
        ops.push({
          updateOne: { filter: { _id: c._id }, update: { $set: { sortorder: ordered.length + i + 1 } } },
        });
      });

      if (ops.length) await Category.bulkWrite(ops, { ordered: false });
      return true;
    },
  },
};
