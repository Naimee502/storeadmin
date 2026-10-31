import { SubCategory } from "../../../models/subcategories";

// Display order: explicit position, then (rows saved before sortorder
// existed) creation time — the order they already showed in.
const DISPLAY_ORDER = { sortorder: 1, createdAt: 1 } as const;

const endOfCategory = async (admin: any, category: any) => {
  const last = await SubCategory.findOne({ admin, category, sortorder: { $ne: null } })
    .sort({ sortorder: -1 })
    .select("sortorder")
    .lean<{ sortorder?: number }>();
  return (last?.sortorder ?? 0) + 1;
};

export const subCategoryResolvers = {
  Query: {
    getSubCategories: async (_: any, { adminId, categoryId }: { adminId?: string; categoryId?: string }) => {
      const query: any = { status: true };
      if (adminId) query.admin = adminId;
      if (categoryId) query.category = categoryId;

      return await SubCategory.find(query).sort(DISPLAY_ORDER).populate("admin").populate("category");
    },

    getSubCategoryById: async (_: any, { id, adminId }: { id: string; adminId?: string }) => {
      const query: any = { _id: id };
      if (adminId) query.admin = adminId;

      return await SubCategory.findOne(query).populate("admin").populate("category");
    },

    getDeletedSubCategories: async (_: any, { adminId, categoryId }: { adminId?: string; categoryId?: string }) => {
      const query: any = { status: false };
      if (adminId) query.admin = adminId;
      if (categoryId) query.category = categoryId;

      return await SubCategory.find(query).sort({ createdAt: 1, _id: 1 }).populate("admin").populate("category");
    },
  },

  Mutation: {
    addSubCategory: async (_: any, { input }: any) => {
      const subcategory = await SubCategory.create(input);
      return await SubCategory.findById(subcategory._id).populate("admin").populate("category");
    },

    editSubCategory: async (_: any, { id, input }: any) => {
      // Moved to another category → it goes to the end of that one.
      const update: any = { ...input };
      const existing = await SubCategory.findById(id).select("admin category");
      if (existing && input?.category && String(existing.category) !== String(input.category)) {
        update.sortorder = await endOfCategory(existing.admin, input.category);
      }
      const updatedSubCategory = await SubCategory.findByIdAndUpdate(id, update, { new: true })
        .populate("admin")
        .populate("category");

      if (!updatedSubCategory) throw new Error("SubCategory not found");
      return updatedSubCategory;
    },

    deleteSubCategory: async (_: any, { id }: any) => {
      const result = await SubCategory.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },

    resetSubCategory: async (_: any, { id }: any) => {
      // A restored sub-category comes back at the end of its category.
      const existing = await SubCategory.findById(id).select("admin category");
      if (!existing) return false;
      const sortorder = await endOfCategory(existing.admin, existing.category);
      const result = await SubCategory.findByIdAndUpdate(id, { status: true, sortorder }, { new: true });
      return !!result;
    },

    reorderSubCategories: async (
      _: any,
      { adminId, categoryId, ids }: { adminId: string; categoryId: string; ids: string[] }
    ) => {
      if (!adminId || !categoryId) throw new Error("adminId and categoryId are required");
      const unique = Array.from(new Set(ids || []));

      // Only this business's sub-categories of this category can be moved.
      const owned = await SubCategory.find({ admin: adminId, category: categoryId, _id: { $in: unique } })
        .select("_id")
        .lean();
      const ownedSet = new Set(owned.map((s: any) => String(s._id)));
      const ordered = unique.filter((id) => ownedSet.has(String(id)));

      const ops: any[] = ordered.map((id, index) => ({
        updateOne: { filter: { _id: id, admin: adminId }, update: { $set: { sortorder: index + 1 } } },
      }));

      // Anything in the category that was not in the list (added elsewhere
      // meanwhile, or deleted) follows it, keeping its relative order.
      const rest = await SubCategory.find({ admin: adminId, category: categoryId, _id: { $nin: ordered } })
        .sort(DISPLAY_ORDER)
        .select("_id")
        .lean();
      rest.forEach((s: any, i: number) => {
        ops.push({
          updateOne: { filter: { _id: s._id }, update: { $set: { sortorder: ordered.length + i + 1 } } },
        });
      });

      if (ops.length) await SubCategory.bulkWrite(ops, { ordered: false });
      return true;
    },
  },
};
