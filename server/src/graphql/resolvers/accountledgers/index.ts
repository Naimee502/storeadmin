import { AccountLedger } from "../../../models/accountledgers";
import { AccountGroup } from "../../../models/accountgroups";
import { asText, containsRx, textMatch, pageWindow, activeFilters, notCleared } from "../../../utils/listquery";

// Status text exactly as the list shows it.
const STATUS_TEXT = { $cond: ["$status", "Active", "Inactive"] };

/** Ledgers whose Group column text ("<group name>", or "-" with no group) contains the term. */
async function groupClause(term: string, adminId?: string): Promise<any> {
  const rx = containsRx(term);
  const scope: any = adminId ? { admin: adminId } : {};
  const ids = await AccountGroup.find({ ...scope, accountgroupname: rx }).distinct("_id");
  if (!rx.test("-")) return { accountgroupid: { $in: ids } };
  const all = await AccountGroup.find(scope).distinct("_id");
  return { $or: [{ accountgroupid: { $in: ids } }, { accountgroupid: { $nin: all } }] };
}

/** Search and column filters for the Account Ledgers list, matched on the text each column shows. */
async function listClauses(search?: string, columnFilters?: any[], adminId?: string): Promise<any[]> {
  const clauses: any[] = [];
  const term = String(search || "").trim();
  if (term) {
    const rx = containsRx(term);
    clauses.push({
      $or: [
        { ledgercode: rx },
        { ledgername: rx },
        await groupClause(term, adminId),
        { ledgertype: rx },
        textMatch(asText("$openingbalance"), term),
        { openingbalancetype: rx },
        textMatch(STATUS_TEXT, term),
      ],
    });
  }
  for (const f of activeFilters(columnFilters)) {
    const rx = containsRx(f.value);
    if (f.key === "ledgercode") clauses.push({ ledgercode: rx });
    else if (f.key === "ledgername") clauses.push({ ledgername: rx });
    else if (f.key === "groupName") clauses.push(await groupClause(f.value, adminId));
    else if (f.key === "ledgertype") clauses.push({ ledgertype: rx });
    else if (f.key === "openingbalance") clauses.push(textMatch(asText("$openingbalance"), f.value));
    else if (f.key === "openingbalancetype") clauses.push({ openingbalancetype: rx });
    else if (f.key === "status") clauses.push(textMatch(STATUS_TEXT, f.value));
  }
  return clauses;
}

export const accountLedgerResolvers = {
  Query: {
    // Account Ledgers list page: one page, newest first (the old list reversed).
    getAccountLedgersPage: async (
      _: any,
      { adminId, page, pageSize, search, columnFilters }: { adminId?: string; page?: number; pageSize?: number; search?: string; columnFilters?: any[] }
    ) => {
      const base: any = { status: true };
      if (adminId) base.admin = adminId;
      const query = { $and: [base, ...(await listClauses(search, columnFilters, adminId))] };
      const { skip, limit } = pageWindow(page, pageSize);
      const [total, items] = await Promise.all([
        AccountLedger.countDocuments(query),
        AccountLedger.find(query)
          .sort({ createdAt: -1, _id: -1 })
          .skip(skip)
          .limit(limit)
          .populate("admin", "name email")
          .populate("accountgroupid", "accountgroupname")
          .populate("branchid", "branchname"),
      ]);
      return { items, total };
    },

    getAccountLedgers: async (_: any, { adminId }: { adminId?: string }) => {
          const filter: any = { status: true };
          if (adminId) filter.admin = adminId;
          // Only the ref fields any client (client/, clientapp/, clientweb/)
          // requests on this query — not whole admin/group/branch documents.
          return await AccountLedger.find(filter).sort({ createdAt: 1, _id: 1 })
          .populate("admin", "name email")
          .populate("accountgroupid", "accountgroupname")
          .populate("branchid", "branchname");
        },

    getDeletedAccountLedgers: async (_: any, { adminId }: { adminId?: string }) => {
      const filter: any = { status: false, ...notCleared };
      if (adminId) filter.admin = adminId;

      return await AccountLedger.find(filter).sort({ createdAt: 1, _id: 1 })
        .populate("admin")
        .populate("accountgroupid")
        .populate("branchid");
    },

    getAccountLedgerById: async (_: any, { id }: { id: string }) => {
      return await AccountLedger.findById(id)
        .populate("admin")
        .populate("accountgroupid")
        .populate("branchid");
    },
  },

  Mutation: {
    addAccountLedger: async (_: any, { input }: any) => {
      const ledger = await AccountLedger.create(input);
      return await AccountLedger.findById(ledger._id)
        .populate("admin")
        .populate("accountgroupid");
    },

    editAccountLedger: async (_: any, { id, input }: any) => {
      return await AccountLedger.findByIdAndUpdate(id, input, { new: true })
        .populate("admin")
        .populate("accountgroupid");
    },

    deleteAccountLedger: async (_: any, { id }: any) => {
      const result = await AccountLedger.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },

    resetAccountLedger: async (_: any, { id }: any) => {
      const result = await AccountLedger.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    }
  }
};
