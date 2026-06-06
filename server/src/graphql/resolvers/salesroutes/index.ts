import { SalesRoute } from "../../../models/salesroutes";
import { Account } from "../../../models/accounts";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Safe format for a single Account document or raw ObjectId */
const formatAccount = (acc: any) => {
  if (!acc) return null;
  // Already a plain object with id (already formatted)
  if (acc.id && !acc._id) return acc;
  // Mongoose document
  if (acc.toObject) {
    const obj = acc.toObject();
    return { ...obj, id: obj._id?.toString() };
  }
  // Raw ObjectId — populate failed; return minimal object
  return { id: acc.toString(), name: "", accountcode: "" };
};

/** Format a full SalesRoute document */
const formatRoute = (r: any) => {
  if (!r) return null;
  const obj = r.toObject ? r.toObject() : r;
  return {
    ...obj,
    id: obj._id?.toString(),
    salesmanid: r.salesmanid
      ? {
          ...(r.salesmanid.toObject?.() ?? r.salesmanid),
          id: r.salesmanid._id?.toString() ?? r.salesmanid.id,
        }
      : null,
    accounts: (r.accounts || []).map(formatAccount).filter(Boolean),
    dayWiseAccounts: (r.dayWiseAccounts || []).map((dw: any) => ({
      day: dw.day,
      visitorder: dw.visitorder ?? 0,
      accounts: (dw.accounts || []).map(formatAccount).filter(Boolean),
    })),
  };
};

/** Generate next routecode for an admin+branch */
const generateRouteCode = async (adminid: string, branchid: string): Promise<string> => {
  const count = await SalesRoute.countDocuments({ adminid, branchid });
  return `RT${String(count + 1).padStart(3, "0")}`;
};

/** Collect unique account IDs from dayWiseAccounts + explicit accounts */
function buildAllAccounts(input: any): string[] {
  const set = new Set<string>();
  (input.accounts || []).forEach((id: string) => set.add(id));
  (input.dayWiseAccounts || []).forEach((dw: any) =>
    (dw.accounts || []).forEach((id: string) => set.add(id))
  );
  return Array.from(set);
}

/**
 * Populate a SalesRoute document:
 * - salesmanid, accounts → standard populate
 * - dayWiseAccounts.accounts → manual lookup (Mongoose doesn't deep-populate embedded arrays)
 */
const populateAndFormat = async (doc: any): Promise<any> => {
  if (!doc) return null;

  // Populate top-level refs
  await doc.populate("salesmanid");
  await doc.populate("accounts");

  // Manually populate dayWiseAccounts.accounts
  const dayWiseAccounts = doc.dayWiseAccounts || [];
  const allDayAccountIds: string[] = [];
  dayWiseAccounts.forEach((dw: any) => {
    (dw.accounts || []).forEach((id: any) => allDayAccountIds.push(id.toString()));
  });

  let accountMap: Record<string, any> = {};
  if (allDayAccountIds.length > 0) {
    const accounts = await Account.find({ _id: { $in: allDayAccountIds } }).lean();
    accounts.forEach((a: any) => {
      accountMap[a._id.toString()] = { ...a, id: a._id.toString() };
    });
  }

  // Rebuild dayWiseAccounts with populated accounts
  const populatedDayWise = dayWiseAccounts.map((dw: any) => ({
    day: dw.day,
    visitorder: dw.visitorder ?? 0,
    accounts: (dw.accounts || []).map((id: any) => accountMap[id.toString()] || null).filter(Boolean),
  }));

  const obj = doc.toObject ? doc.toObject() : { ...doc };
  return {
    ...obj,
    id: obj._id?.toString(),
    salesmanid: doc.salesmanid
      ? {
          ...(doc.salesmanid.toObject?.() ?? doc.salesmanid),
          id: doc.salesmanid._id?.toString() ?? doc.salesmanid.id,
        }
      : null,
    accounts: (doc.accounts || []).map(formatAccount).filter(Boolean),
    dayWiseAccounts: populatedDayWise,
  };
};

// ── Resolvers ──────────────────────────────────────────────────────────────────

export const salesRouteResolvers = {
  Query: {
    getSalesRoutes: async (_: any, { filter, limit, offset }: any) => {
      try {
        const query: any = {};
        if (filter?.adminId)  query.adminid   = filter.adminId;
        if (filter?.branchId) query.branchid  = filter.branchId;
        if (filter?.salesmanId) query.salesmanid = filter.salesmanId;
        if (filter?.visitday)   query.visitdays  = filter.visitday;
        query.status = filter?.status !== undefined ? filter.status : true;
        if (filter?.search) {
          query.$or = [
            { routename:  { $regex: filter.search, $options: "i" } },
            { routecode:  { $regex: filter.search, $options: "i" } },
          ];
        }

        let dbQuery = SalesRoute.find(query).sort({ createdAt: -1 });
        if (limit  !== undefined) dbQuery = dbQuery.limit(limit)  as any;
        if (offset !== undefined) dbQuery = dbQuery.skip(offset)  as any;

        const routes = await dbQuery;

        // Deep-populate dayWiseAccounts so list consumers (admin + salesman app)
        // receive the real party details (name, mobile, address, geo) in one query.
        return await Promise.all(routes.map((r: any) => populateAndFormat(r)));
      } catch (err) {
        console.error("getSalesRoutes error:", err);
        throw err;
      }
    },

    getSalesRouteById: async (_: any, { id, adminId, branchId }: any) => {
      try {
        const query: any = { _id: id };
        if (adminId)  query.adminid  = adminId;
        if (branchId) query.branchid = branchId;

        const route = await SalesRoute.findOne(query);
        if (!route) throw new Error("Sales route not found");

        return await populateAndFormat(route);
      } catch (err) {
        console.error("getSalesRouteById error:", err);
        throw err;
      }
    },
  },

  Mutation: {
    createSalesRoute: async (_: any, { input }: any) => {
      try {
        const allAccountIds = buildAllAccounts(input);
        const routecode = await generateRouteCode(input.adminid, input.branchid);
        const newRoute = await SalesRoute.create({
          ...input,
          routecode,
          accounts: allAccountIds,
        });
        const doc = await SalesRoute.findById(newRoute._id);
        return await populateAndFormat(doc!);
      } catch (err) {
        console.error("createSalesRoute error:", err);
        throw err;
      }
    },

    updateSalesRoute: async (_: any, { id, input }: any) => {
      try {
        const allAccountIds = buildAllAccounts(input);
        const updated = await SalesRoute.findByIdAndUpdate(
          id,
          { $set: { ...input, accounts: allAccountIds } },
          { new: true }
        );
        if (!updated) throw new Error("Sales route not found");
        return await populateAndFormat(updated);
      } catch (err) {
        console.error("updateSalesRoute error:", err);
        throw err;
      }
    },

    deleteSalesRoute: async (_: any, { id }: any) => {
      try {
        const deleted = await SalesRoute.findByIdAndUpdate(id, { status: false }, { new: true });
        if (!deleted) throw new Error("Sales route not found");
        return true;
      } catch (err) {
        console.error("deleteSalesRoute error:", err);
        throw err;
      }
    },

    resetSalesRoute: async (_: any, { id }: any) => {
      try {
        const reset = await SalesRoute.findByIdAndUpdate(id, { status: true }, { new: true });
        if (!reset) throw new Error("Sales route not found");
        return true;
      } catch (err) {
        console.error("resetSalesRoute error:", err);
        throw err;
      }
    },

    updateSalesRouteStatus: async (_: any, { id, status }: any) => {
      try {
        const updated = await SalesRoute.findByIdAndUpdate(
          id,
          { status },
          { new: true }
        );
        if (!updated) throw new Error("Sales route not found");
        return await populateAndFormat(updated);
      } catch (err) {
        console.error("updateSalesRouteStatus error:", err);
        throw err;
      }
    },
  },
};
