import { Unit } from "../../../models/units";
import { containsRx, textMatch, pageWindow, activeFilters, notCleared } from "../../../utils/listquery";

// Status text exactly as the list shows it.
const STATUS_TEXT = { $cond: ["$status", "Active", "Inactive"] };

/** Search and column filters for the Units list, matched on the text each column shows. */
function listClauses(search?: string, columnFilters?: any[]): any[] {
  const clauses: any[] = [];
  const term = String(search || "").trim();
  if (term) {
    const rx = containsRx(term);
    clauses.push({ $or: [{ unitcode: rx }, { unitname: rx }, textMatch(STATUS_TEXT, term)] });
  }
  for (const f of activeFilters(columnFilters)) {
    if (f.key === "unitcode") clauses.push({ unitcode: containsRx(f.value) });
    else if (f.key === "unitname") clauses.push({ unitname: containsRx(f.value) });
    else if (f.key === "status") clauses.push(textMatch(STATUS_TEXT, f.value));
  }
  return clauses;
}

export const unitResolvers = {
  Query: {
    // Units list page: one page, newest first (the old list reversed).
    getUnitsPage: async (
      _: any,
      { adminId, page, pageSize, search, columnFilters }: { adminId?: string; page?: number; pageSize?: number; search?: string; columnFilters?: any[] }
    ) => {
      const base: any = { status: true };
      if (adminId) base.admin = adminId;
      const query = { $and: [base, ...listClauses(search, columnFilters)] };
      const { skip, limit } = pageWindow(page, pageSize);
      const [total, items] = await Promise.all([
        Unit.countDocuments(query),
        Unit.find(query).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).populate("admin", "name email"),
      ]);
      return { items, total };
    },

    // Get all active units (optionally filtered by admin)
    getUnits: async (_: any, { adminId }: { adminId?: string }) => {
      const filter: any = { status: true };
      if (adminId) filter.admin = adminId;
      // Clients only ever request admin { id name email } on this list.
      return await Unit.find(filter).sort({ createdAt: 1, _id: 1 }).populate("admin", "name email");
    },

    // Get deleted units (optionally filtered by admin)
    getDeletedUnits: async (_: any, { adminId }: { adminId?: string }) => {
      const filter: any = { status: false, ...notCleared };
      if (adminId) filter.admin = adminId;
      return await Unit.find(filter).sort({ createdAt: 1, _id: 1 }).populate("admin");
    },

    // Get one unit by ID (optionally filter by admin)
    getUnitById: async (_: any, { id, adminId }: { id: string; adminId?: string }) => {
      const filter: any = { _id: id };
      if (adminId) filter.admin = adminId;
      return await Unit.findOne(filter).populate("admin");
    },
  },

  Mutation: {
    addUnit: async (_: any, { input }: any) => {
      const unit = await Unit.create(input);
      return await Unit.findById(unit._id).populate("admin");
    },

    editUnit: async (_: any, { id, input }: any) => {
      return await Unit.findByIdAndUpdate(id, input, { new: true }).populate("admin");
    },

    deleteUnit: async (_: any, { id }: any) => {
      const result = await Unit.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },

    resetUnit: async (_: any, { id }: any) => {
      const result = await Unit.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    },
  },
};
