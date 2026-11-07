import { Model } from "../../../models/models";
import { containsRx, textMatch, pageWindow, activeFilters, notCleared } from "../../../utils/listquery";

// Status text exactly as the list shows it.
const STATUS_TEXT = { $cond: ["$status", "Active", "Inactive"] };

/** Search and column filters for the Models list, matched on the text each column shows. */
function listClauses(search?: string, columnFilters?: any[]): any[] {
  const clauses: any[] = [];
  const term = String(search || "").trim();
  if (term) {
    const rx = containsRx(term);
    clauses.push({ $or: [{ modelcode: rx }, { modelname: rx }, textMatch(STATUS_TEXT, term)] });
  }
  for (const f of activeFilters(columnFilters)) {
    if (f.key === "modelcode") clauses.push({ modelcode: containsRx(f.value) });
    else if (f.key === "modelname") clauses.push({ modelname: containsRx(f.value) });
    else if (f.key === "status") clauses.push(textMatch(STATUS_TEXT, f.value));
  }
  return clauses;
}

export const modelResolvers = {
  Query: {
    // Models list page: one page, newest first (the old list reversed).
    getModelsPage: async (
      _: any,
      { adminId, page, pageSize, search, columnFilters }: { adminId?: string; page?: number; pageSize?: number; search?: string; columnFilters?: any[] }
    ) => {
      const base: any = { status: true };
      if (adminId) base.admin = adminId;
      const query = { $and: [base, ...listClauses(search, columnFilters)] };
      const { skip, limit } = pageWindow(page, pageSize);
      const [total, items] = await Promise.all([
        Model.countDocuments(query),
        Model.find(query).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).populate("admin", "name email"),
      ]);
      return { items, total };
    },

    // Get all active models, optionally filtered by admin
    getModels: async (_: any, { adminId }: { adminId?: string }) => {
      const filter: any = { status: true };
      if (adminId) filter.admin = adminId;
      return await Model.find(filter).sort({ createdAt: 1, _id: 1 }).populate("admin", "name email"); // list: clients only read admin id/name/email
    },

    // Get all soft-deleted models, optionally filtered by admin
    getDeletedModels: async (_: any, { adminId }: { adminId?: string }) => {
      const filter: any = { status: false, ...notCleared };
      if (adminId) filter.admin = adminId;
      return await Model.find(filter).sort({ createdAt: 1, _id: 1 }).populate("admin");
    },

    // Get single model by ID, optionally check admin
    getModelById: async (_: any, { id, adminId }: { id: string, adminId?: string }) => {
      const filter: any = { _id: id };
      if (adminId) filter.admin = adminId;
      return await Model.findOne(filter).populate("admin");
    },
  },

  Mutation: {
    // Add model with admin ref and return populated
    addModel: async (_: any, { input }: any) => {
      const model = await Model.create(input);
      return await Model.findById(model._id).populate("admin");
    },

    // Edit and return updated populated model
    editModel: async (_: any, { id, input }: any) => {
      return await Model.findByIdAndUpdate(id, input, { new: true }).populate("admin");
    },

    // Soft delete model
    deleteModel: async (_: any, { id }: any) => {
      const result = await Model.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },

    // Restore model
    resetModel: async (_: any, { id }: any) => {
      const result = await Model.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    },
  },
};
