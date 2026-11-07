import { Size } from "../../../models/size";
import { containsRx, textMatch, pageWindow, activeFilters, notCleared } from "../../../utils/listquery";

// Status text exactly as the list shows it.
const STATUS_TEXT = { $cond: ["$status", "Active", "Inactive"] };

/** Search and column filters for the Sizes list, matched on the text each column shows. */
function listClauses(search?: string, columnFilters?: any[]): any[] {
  const clauses: any[] = [];
  const term = String(search || "").trim();
  if (term) {
    const rx = containsRx(term);
    clauses.push({ $or: [{ sizecode: rx }, { sizename: rx }, textMatch(STATUS_TEXT, term)] });
  }
  for (const f of activeFilters(columnFilters)) {
    if (f.key === "sizecode") clauses.push({ sizecode: containsRx(f.value) });
    else if (f.key === "sizename") clauses.push({ sizename: containsRx(f.value) });
    else if (f.key === "status") clauses.push(textMatch(STATUS_TEXT, f.value));
  }
  return clauses;
}

export const sizeResolvers = {
  Query: {
    // Sizes list page: one page, newest first (the old list reversed).
    getSizesPage: async (
      _: any,
      { adminId, page, pageSize, search, columnFilters }: { adminId?: string; page?: number; pageSize?: number; search?: string; columnFilters?: any[] }
    ) => {
      const base: any = { status: true };
      if (adminId) base.admin = adminId;
      const query = { $and: [base, ...listClauses(search, columnFilters)] };
      const { skip, limit } = pageWindow(page, pageSize);
      const [total, items] = await Promise.all([
        Size.countDocuments(query),
        Size.find(query).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).populate("admin", "name email"),
      ]);
      return { items, total };
    },

    // Get all active sizes (optionally filtered by admin)
    getSizes: async (_: any, { adminId }: { adminId?: string }) => {
      const filter: any = { status: true };
      if (adminId) filter.admin = adminId;
      return await Size.find(filter).sort({ createdAt: 1, _id: 1 }).populate("admin", "name email"); // list: clients only read admin id/name/email
    },

    // Get deleted sizes (optionally filtered by admin)
    getDeletedSizes: async (_: any, { adminId }: { adminId?: string }) => {
      const filter: any = { status: false, ...notCleared };
      if (adminId) filter.admin = adminId;
      return await Size.find(filter).sort({ createdAt: 1, _id: 1 }).populate("admin");
    },

    // Get one size by ID (optionally check for admin)
    getSizeById: async (_: any, { id, adminId }: { id: string, adminId?: string }) => {
      const filter: any = { _id: id };
      if (adminId) filter.admin = adminId;
      return await Size.findOne(filter).populate("admin");
    },
  },

  Mutation: {
    // Add a size with admin reference
    addSize: async (_: any, { input }: any) => {
      const size = await Size.create(input);
      return await Size.findById(size._id).populate("admin");
    },

    // Edit and return populated size
    editSize: async (_: any, { id, input }: any) => {
      return await Size.findByIdAndUpdate(id, input, { new: true }).populate("admin");
    },

    deleteSize: async (_: any, { id }: any) => {
      const result = await Size.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },

    resetSize: async (_: any, { id }: any) => {
      const result = await Size.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    },
  },
};
