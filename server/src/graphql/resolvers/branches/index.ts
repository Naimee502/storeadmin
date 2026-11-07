import { Branch } from "../../../models/branches";
import { generateTokens, sendRefreshToken } from "../../../utils/auth";
import { enforceLoginOtp } from "../../../utils/loginotp";
import {
  activeFilters,
  containsRx,
  notCleared,
  pageWindow,
  textMatch,
  type ColumnFilter,
} from "../../../utils/listquery";

const branchStatusText = { $cond: ["$status", "Active", "Inactive"] };

// List column key -> stored field, for column filters.
const BRANCH_FILTER_FIELDS: Record<string, string> = {
  branchcode: "branchcode",
  name: "branchname",
  email: "email",
  mobile: "mobile",
  location: "location",
  address: "address",
};

/** Search plus column filters for the branches list. */
function branchListClauses(search: string, filters?: ColumnFilter[] | null) {
  const clauses: any[] = [];
  const term = String(search || "").trim();
  if (term) {
    const rx = containsRx(term);
    clauses.push({
      $or: [
        ...["branchcode", "branchname", "email", "mobile", "location", "address", "city", "pincode", "phone"]
          .map((field) => ({ [field]: rx })),
        textMatch(branchStatusText, term),
      ],
    });
  }
  for (const { key, value } of activeFilters(filters)) {
    if (key === "status") clauses.push(textMatch(branchStatusText, value));
    else if (BRANCH_FILTER_FIELDS[key]) clauses.push({ [BRANCH_FILTER_FIELDS[key]]: containsRx(value) });
  }
  return clauses;
}

export const branchResolvers = {
  Query: {
    // Get all active branches (optionally filter by admin)
    getBranches: async (_: any, { adminId }: { adminId?: string }) => {
      const filter: any = { status: true };
      if (adminId) filter.admin = adminId;

      // Every Admin field any client asks of this query (client GET_BRANCHES;
      // isExpiringSoon is not stored, so it resolves null either way). Keeps
      // the admin's password and other private fields out of the payload.
      return await Branch.find(filter)
        .sort({ createdAt: 1, _id: 1 })
        .populate(
          "admin",
          "name email subscriptionType subscribed subscribedAt subscriptionEnd transactionId businesstype isMultibranch isChannelCustomers allowedmodules needsReview rejected"
        );
    },

    // One page of the active branches list (same scope as getBranches).
    getBranchesPage: async (
      _: any,
      { adminId, page = 1, pageSize = 10, search = "", columnFilters = [] }: any
    ) => {
      const filter: any = { status: true };
      if (adminId) filter.admin = adminId;
      const query = { $and: [filter, ...branchListClauses(search, columnFilters)] };
      const { skip, limit } = pageWindow(page, pageSize);
      const [total, items] = await Promise.all([
        Branch.countDocuments(query),
        Branch.find(query)
          .sort({ createdAt: -1, _id: -1 })
          .skip(skip)
          .limit(limit)
          .populate(
            "admin",
            "name email subscriptionType subscribed subscribedAt subscriptionEnd transactionId businesstype isMultibranch isChannelCustomers allowedmodules needsReview rejected"
          ),
      ]);
      return { items, total };
    },

    // Get one branch (optionally ensure admin owns it)
    getBranch: async (_: any, { id, adminId }: { id: string; adminId?: string }) => {
      const filter: any = { _id: id };
      if (adminId) filter.admin = adminId;

      return await Branch.findOne(filter).populate("admin");
    },

    // Get deleted branches (optionally filter by admin)
    getDeletedBranches: async (_: any, { adminId }: { adminId?: string }) => {
      const filter: any = { status: false, ...notCleared };
      if (adminId) filter.admin = adminId;

      return await Branch.find(filter).sort({ createdAt: 1, _id: 1 }).populate("admin");
    },
  },

  Mutation: {
    addBranch: async (_: any, { input }: any) => {
      const branch = await Branch.create(input);
      return await Branch.findById(branch._id).populate('admin');
    },

    addBranches: async (_: any, { inputs }: { inputs: any[] }) => {
      const createdBranches = await Branch.insertMany(inputs);
      const branchIds = createdBranches.map(branch => branch._id);
      return await Branch.find({ _id: { $in: branchIds } }).populate('admin');
    },

    editBranch: async (_: any, { id, input }: any) =>
      await Branch.findByIdAndUpdate(id, input, { new: true }).populate('admin'),

    loginBranch: async (_: any, { email, password, otp }: any, { res }: any) => {
      const branch = await Branch.findOne({ email }).populate("admin");
      if (!branch) throw new Error("Branch not found");

      if (branch.password !== password) {
        throw new Error("Invalid credentials");
      }

      // Business Settings -> login email OTP (no-op when the switch is off).
      await enforceLoginOtp({
        kind: "branch", userId: branch._id, email: branch.email,
        adminId: (branch as any).admin, businessName: (branch as any).admin?.companyName, otp,
      });

      const { accessToken, refreshToken } = generateTokens({
        id: branch.id,
        email: branch.email,
        type: "branch",
        adminid: (branch as any).admin,
        branchid: branch.id,
      });

      sendRefreshToken(res, refreshToken);

      return {
        accessToken,
        branch,
      };
    },

    deleteBranch: async (_: any, { id }: any) => {
      const result = await Branch.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },

    resetBranch: async (_: any, { id }: any) => {
      const result = await Branch.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    },
  },
};
