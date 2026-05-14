// Permissions resolver
//
// Resolves Admin defaults / Branch overrides / Staff overrides cleanly.
// Effective permissions (used by the client to gate UI) follow the
// priority chain: Staff > Branch > Admin default. A missing key at a
// level means "inherit from parent". Action lookup at the client side
// will treat missing as `false` (deny by default).

import mongoose from "mongoose";
import { GraphQLScalarType, Kind } from "graphql";
import { Admin } from "../../../models/admin";
import { Branch } from "../../../models/branches";
import { StaffAccount } from "../../../models/staffaccounts";

// Minimal JSON scalar — we just pass through whatever the client sends
// as long as it parses. No validation here; module/action keys are open.
const JSONScalar = new GraphQLScalarType({
  name: "JSON",
  description: "Arbitrary JSON value",
  serialize: (value) => value,
  parseValue: (value) => value,
  parseLiteral: function parseLiteral(ast: any): any {
    switch (ast.kind) {
      case Kind.STRING:
      case Kind.BOOLEAN:
        return ast.value;
      case Kind.INT:
      case Kind.FLOAT:
        return Number(ast.value);
      case Kind.OBJECT: {
        const obj: any = {};
        ast.fields.forEach((f: any) => {
          obj[f.name.value] = parseLiteral(f.value);
        });
        return obj;
      }
      case Kind.LIST:
        return ast.values.map(parseLiteral);
      case Kind.NULL:
        return null;
      default:
        return null;
    }
  },
});

// Deep-merge two permission maps; `override` wins per (module, action).
const mergePermissions = (base: any = {}, override: any = {}) => {
  const out: Record<string, any> = { ...(base || {}) };
  for (const moduleId of Object.keys(override || {})) {
    out[moduleId] = { ...(out[moduleId] || {}), ...(override[moduleId] || {}) };
  }
  return out;
};

// Locate the document holding permissions for the given scope.
const getDoc = async (scope: string, scopeid: string) => {
  if (scope === "admin") return Admin.findById(scopeid);
  if (scope === "branch") return Branch.findById(scopeid);
  if (scope === "staff") return StaffAccount.findById(scopeid);
  throw new Error(`Unknown permission scope: ${scope}`);
};

// Field name on the doc where permissions live.
const fieldFor = (scope: string) =>
  scope === "admin" ? "defaultPermissions" : "permissions";

export const permissionsResolvers = {
  JSON: JSONScalar,

  Query: {
    getPermissions: async (_: any, { scope, scopeid }: any) => {
      const doc: any = await getDoc(scope, scopeid);
      if (!doc) throw new Error(`${scope} not found`);
      return {
        scope,
        scopeid,
        permissions: doc[fieldFor(scope)] || {},
      };
    },

    // Walks the hierarchy and merges. For staff: load staff → its branch
    // → that branch's admin and merge in the right order.
    getEffectivePermissions: async (_: any, { scope, scopeid }: any) => {
      if (scope === "admin") {
        const admin: any = await Admin.findById(scopeid).lean();
        if (!admin) throw new Error("Admin not found");
        return { scope, scopeid, permissions: admin.defaultPermissions || {} };
      }

      if (scope === "branch") {
        const branch: any = await Branch.findById(scopeid).lean();
        if (!branch) throw new Error("Branch not found");
        const admin: any = await Admin.findById(branch.admin).lean();
        const merged = mergePermissions(
          admin?.defaultPermissions || {},
          branch?.permissions || {}
        );
        return { scope, scopeid, permissions: merged };
      }

      if (scope === "staff") {
        const staff: any = await StaffAccount.findById(scopeid).lean();
        if (!staff) throw new Error("Staff not found");
        const branch: any = staff.branchid
          ? await Branch.findById(staff.branchid).lean()
          : null;
        const admin: any = await Admin.findById(staff.admin).lean();
        const adminDefaults = admin?.defaultPermissions || {};
        const branchOverride = branch?.permissions || {};
        const staffOverride = staff?.permissions || {};
        const merged = mergePermissions(
          mergePermissions(adminDefaults, branchOverride),
          staffOverride
        );
        return { scope, scopeid, permissions: merged };
      }

      throw new Error(`Unknown scope: ${scope}`);
    },
  },

  Mutation: {
    setPermissions: async (_: any, { scope, scopeid, permissions }: any) => {
      const field = fieldFor(scope);
      let updated: any = null;
      if (scope === "admin") {
        updated = await Admin.findByIdAndUpdate(
          scopeid,
          { $set: { [field]: permissions || {} } },
          { new: true }
        ).lean();
      } else if (scope === "branch") {
        updated = await Branch.findByIdAndUpdate(
          scopeid,
          { $set: { [field]: permissions || {} } },
          { new: true }
        ).lean();
      } else if (scope === "staff") {
        updated = await StaffAccount.findByIdAndUpdate(
          scopeid,
          { $set: { [field]: permissions || {} } },
          { new: true }
        ).lean();
      } else {
        throw new Error(`Unknown scope: ${scope}`);
      }
      if (!updated) throw new Error(`${scope} not found`);
      return {
        scope,
        scopeid,
        permissions: updated[field] || {},
      };
    },
  },
};
