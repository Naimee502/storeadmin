import mongoose from "mongoose";

const tenant = { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true, index: true };

// Departments group staff (Sales, Stores, Accounts...). Optional on a staff member.
const departmentSchema = new mongoose.Schema(
  {
    adminid: tenant,
    name: { type: String, required: true, trim: true },
    status: { type: Boolean, default: true },
    cleared: { type: Boolean },
  },
  { timestamps: true }
);

// Access roles carry a permission set between the branch and the staff member's own overrides.
const accessRoleSchema = new mongoose.Schema(
  {
    adminid: tenant,
    name: { type: String, required: true, trim: true },
    preset: { type: String },
    permissions: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: Boolean, default: true },
    cleared: { type: Boolean },
  },
  { timestamps: true }
);

// Who changed which permissions, and when.
const permissionAuditSchema = new mongoose.Schema(
  {
    adminid: tenant,
    scope: { type: String, required: true },
    scopeid: { type: mongoose.Schema.Types.ObjectId, required: true },
    byid: { type: mongoose.Schema.Types.ObjectId },
    bytype: { type: String },
    byname: { type: String },
    modules: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const Department = mongoose.model("Department", departmentSchema);
export const AccessRole = mongoose.model("AccessRole", accessRoleSchema);
export const PermissionAudit = mongoose.model("PermissionAudit", permissionAuditSchema);
