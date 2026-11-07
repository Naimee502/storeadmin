import { AccountGroup } from "../../../models/accountgroups";
import { containsRx, textMatch, pageWindow, activeFilters, notCleared } from "../../../utils/listquery";

// Column text exactly as the list shows it (category falls back to "assets").
const STATUS_TEXT = { $cond: ["$status", "Active", "Inactive"] };
const CATEGORY_TEXT = { $cond: [{ $in: [{ $ifNull: ["$category", ""] }, [""]] }, "assets", "$category"] };

/** Search and column filters for the Account Groups list, matched on the text each column shows. */
function listClauses(search?: string, columnFilters?: any[]): any[] {
  const clauses: any[] = [];
  const term = String(search || "").trim();
  if (term) {
    const rx = containsRx(term);
    clauses.push({
      $or: [{ accountgroupcode: rx }, { accountgroupname: rx }, textMatch(CATEGORY_TEXT, term), textMatch(STATUS_TEXT, term)],
    });
  }
  for (const f of activeFilters(columnFilters)) {
    if (f.key === "accountgroupcode") clauses.push({ accountgroupcode: containsRx(f.value) });
    else if (f.key === "accountgroupname") clauses.push({ accountgroupname: containsRx(f.value) });
    else if (f.key === "category") clauses.push(textMatch(CATEGORY_TEXT, f.value));
    else if (f.key === "status") clauses.push(textMatch(STATUS_TEXT, f.value));
  }
  return clauses;
}

export const accountGroupResolvers = {
  Query: {
    // Account Groups list page: one page, newest first (the old list reversed).
    getAccountGroupsPage: async (
      _: any,
      { adminId, page, pageSize, search, columnFilters }: { adminId?: string; page?: number; pageSize?: number; search?: string; columnFilters?: any[] }
    ) => {
      const base: any = { status: true };
      if (adminId) base.admin = adminId;
      const query = { $and: [base, ...listClauses(search, columnFilters)] };
      const { skip, limit } = pageWindow(page, pageSize);
      const [total, items] = await Promise.all([
        AccountGroup.countDocuments(query),
        AccountGroup.find(query).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).populate("admin", "name email"),
      ]);
      return { items, total };
    },

    // Get all active account groups for optional admin
    getAccountGroups: async (_: any, { adminId }: { adminId?: string }) => {
      const filter: any = { status: true };
      if (adminId) filter.admin = adminId;
      // admin { id name email } is all any client asks of this query.
      return await AccountGroup.find(filter).sort({ createdAt: 1, _id: 1 }).populate("admin", "name email");
    },

    // Get deleted account groups for optional admin
    getDeletedAccountGroups: async (_: any, { adminId }: { adminId?: string }) => {
      const filter: any = { status: false, ...notCleared };
      if (adminId) filter.admin = adminId;
      return await AccountGroup.find(filter).sort({ createdAt: 1, _id: 1 }).populate("admin");
    },

    // Get one account group by ID for optional admin
    getAccountGroupById: async (_: any, { id, adminId }: { id: string; adminId?: string }) => {
      const filter: any = { _id: id };
      if (adminId) filter.admin = adminId;
      return await AccountGroup.findOne(filter).populate("admin");
    },
  },

  Mutation: {
    addAccountGroup: async (_: any, { input }: any) => {
      const accountGroup = await AccountGroup.create(input);
      return await AccountGroup.findById(accountGroup._id).populate("admin");
    },

    editAccountGroup: async (_: any, { id, input }: any) => {
      return await AccountGroup.findByIdAndUpdate(id, input, { new: true }).populate("admin");
    },

    deleteAccountGroup: async (_: any, { id }: any) => {
      const result = await AccountGroup.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },

    resetAccountGroup: async (_: any, { id }: any) => {
      const result = await AccountGroup.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    }
  },
};
