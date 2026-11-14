import { Admin } from "../../../models/admin";
import { Branch } from "../../../models/branches";
import { StaffAccount } from "../../../models/staffaccounts";
import { verifyPassword } from "../../../utils/password";
import { ApolloError } from "apollo-server-express";

const escapeRe = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const panelLoginResolvers = {
  Mutation: {
    // Only accounts whose password matches are named, so this tells nothing about an email alone.
    findLogins: async (_: any, { email, password }: any) => {
      const e = String(email || "").trim();
      const wrong = () => new ApolloError("Incorrect email or password.", "INVALID_CREDENTIALS");
      if (!e || !password) throw wrong();
      const [admin, branch, staff]: any[] = await Promise.all([
        Admin.findOne({ email: e }).select("password companyName").lean(),
        Branch.findOne({ email: e }).select("password branchname isMain admin").populate("admin", "companyName").lean(),
        StaffAccount.find({ email: { $regex: `^${escapeRe(e)}$`, $options: "i" } }).sort({ status: -1, updatedAt: -1 })
          .select("password name status admin").populate("admin", "companyName").lean(),
      ]);
      const out: { kind: string; label: string }[] = [];
      if (admin && verifyPassword(admin.password, password)) out.push({ kind: "admin", label: `Owner · ${admin.companyName || "Business"}` });
      if (branch && !branch.isMain && verifyPassword(branch.password, password)) {
        out.push({ kind: "branch", label: `Branch · ${branch.branchname || ""}${branch.admin?.companyName ? ` (${branch.admin.companyName})` : ""}` });
      }
      const s = (staff || []).find((c: any) => verifyPassword(c.password, password));
      if (s) {
        out.push({ kind: "staff", label: `Staff · ${s.name || ""}${s.admin?.companyName ? ` (${s.admin.companyName})` : ""}` });
      }
      // An error, not an empty list, so wrong guesses count toward the sign-in limit.
      if (!out.length) throw wrong();
      return out;
    },
  },
};
