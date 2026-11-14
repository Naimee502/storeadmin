import { Department, AccessRole, PermissionAudit } from "../../../models/accessroles";
import { StaffAccount } from "../../../models/staffaccounts";
import { requireBackofficeTenant, TenantError } from "../../../utils/tenant";

const iso = (d: any) => (d ? new Date(d).toISOString() : null);
const nameOf = (input: any) => {
  const name = String(input?.name || "").trim();
  if (!name) throw new TenantError("Name is required.", "BAD_USER_INPUT");
  return name.slice(0, 80);
};
const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// One live entry per name in a business.
const assertFreeName = async (model: any, adminid: any, name: string, id?: any) => {
  const taken = await model.exists({
    adminid, status: true, name: new RegExp(`^${escapeRx(name)}$`, "i"), ...(id ? { _id: { $ne: id } } : {}),
  });
  if (taken) throw new TenantError(`"${name}" already exists.`, "BAD_USER_INPUT");
};

const countBy = async (field: string, adminid: any) => {
  const rows: any[] = await StaffAccount.aggregate([
    { $match: { admin: adminid, status: { $ne: false }, [field]: { $ne: null } } },
    { $group: { _id: `$${field}`, n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
};

const list = (model: any, field: string) => async (_: any, { deleted }: any, context: any) => {
  const { adminid } = await requireBackofficeTenant(context);
  const rows: any[] = await model
    .find({ adminid, status: !deleted, ...(deleted ? { cleared: { $ne: true } } : {}) })
    .sort({ name: 1 })
    .lean();
  const counts = await countBy(field, adminid);
  return rows.map((r) => ({ ...r, id: String(r._id), staffCount: counts.get(String(r._id)) || 0, createdAt: iso(r.createdAt) }));
};

const crud = (model: any, field: string, extra: (input: any) => any = () => ({})) => ({
  add: async (_: any, { input }: any, context: any) => {
    const { adminid } = await requireBackofficeTenant(context);
    const name = nameOf(input);
    await assertFreeName(model, adminid, name);
    const doc: any = await model.create({ adminid, name, ...extra(input) });
    return { ...doc.toObject(), id: String(doc._id), staffCount: 0, createdAt: iso(doc.createdAt) };
  },
  edit: async (_: any, { id, input }: any, context: any) => {
    const { adminid } = await requireBackofficeTenant(context);
    const name = nameOf(input);
    await assertFreeName(model, adminid, name, id);
    const doc: any = await model.findOneAndUpdate({ _id: id, adminid, status: true }, { $set: { name } }, { new: true }).lean();
    if (!doc) throw new TenantError("Not found, or deleted. Restore it first to edit it.", "BAD_USER_INPUT");
    const counts = await countBy(field, adminid);
    return { ...doc, id: String(doc._id), staffCount: counts.get(String(doc._id)) || 0, createdAt: iso(doc.createdAt) };
  },
  del: async (_: any, { id }: any, context: any) => {
    const { adminid } = await requireBackofficeTenant(context);
    if (await StaffAccount.exists({ admin: adminid, status: { $ne: false }, [field]: id })) {
      throw new TenantError("Staff are still assigned to this. Move them first.", "BAD_USER_INPUT");
    }
    return !!(await model.findOneAndUpdate({ _id: id, adminid }, { $set: { status: false } }));
  },
  reset: async (_: any, { id }: any, context: any) => {
    const { adminid } = await requireBackofficeTenant(context);
    const doc: any = await model.findOne({ _id: id, adminid }).lean();
    if (!doc) return false;
    await assertFreeName(model, adminid, doc.name, id);
    return !!(await model.findOneAndUpdate({ _id: id, adminid }, { $set: { status: true } }));
  },
});

const dept = crud(Department, "departmentid");
const role = crud(AccessRole, "accessroleid", (input) => (input?.preset ? { preset: String(input.preset).slice(0, 40) } : {}));

export const accessRoleResolvers = {
  Query: {
    getDepartments: list(Department, "departmentid"),
    getAccessRoles: list(AccessRole, "accessroleid"),
    getPermissionAudit: async (_: any, { limit }: any, context: any) => {
      const { adminid } = await requireBackofficeTenant(context);
      const rows: any[] = await PermissionAudit.find({ adminid })
        .sort({ createdAt: -1 })
        .limit(Math.min(Math.max(Number(limit) || 50, 1), 200))
        .lean();
      return rows.map((r) => ({ ...r, id: String(r._id), scopeid: String(r.scopeid), createdAt: iso(r.createdAt) }));
    },
  },
  Mutation: {
    addDepartment: dept.add, editDepartment: dept.edit, deleteDepartment: dept.del, resetDepartment: dept.reset,
    addAccessRole: role.add, editAccessRole: role.edit, deleteAccessRole: role.del, resetAccessRole: role.reset,
  },
};
