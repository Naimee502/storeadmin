import React, { useState } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import { showMessage } from "../../redux/slices/message";
import { selectModuleActions } from "../../redux/slices/permissions";
import { useDepartmentsQuery, useDepartmentMutations, useAccessRolesQuery, useAccessRoleMutations } from "../../graphql/hooks/accessroles";

type Kind = "departments" | "accessroles";

const TEXT: Record<Kind, { title: string; one: string; path: string }> = {
  departments: { title: "Departments", one: "department", path: "/departments" },
  accessroles: { title: "Access Roles", one: "access role", path: "/accessroles" },
};

/** List, add, rename, delete and restore a business's departments or access roles. */
export const NamedMasterPage: React.FC<{
  kind: Kind;
  deleted?: boolean;
  toolbarActions?: React.ReactNode;
  onView?: (row: any) => void;
  children?: React.ReactNode;
}> = ({ kind, deleted = false, toolbarActions, onView, children }) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const actions = useAppSelector((s) => selectModuleActions(s, kind));
  const t = TEXT[kind];
  const deptQ = useDepartmentsQuery(deleted);
  const roleQ = useAccessRolesQuery(deleted);
  const deptM = useDepartmentMutations();
  const roleM = useAccessRoleMutations();
  const { data, loading, refetch } = kind === "departments" ? deptQ : roleQ;
  const m = kind === "departments" ? deptM : roleM;
  const rows: any[] = (kind === "departments" ? data?.getDepartments : data?.getAccessRoles) || [];

  const [form, setForm] = useState({ name: "" });
  const [errors, setErrors] = useState<{ name?: string }>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const say = (message: string, type: "success" | "error" = "success") => dispatch(showMessage({ message, type }));

  const submit = async () => {
    const name = form.name.trim();
    if (!name) return setErrors({ name: "Name is required" });
    try {
      if (editingId) await m.edit({ variables: { id: editingId, input: { name } } });
      else await m.add({ variables: { input: { name } } });
      say(editingId ? "Saved." : "Added.");
      setForm({ name: "" });
      setErrors({});
      setEditingId(null);
      await refetch();
    } catch (e: any) {
      say(e?.message || "Save failed.", "error");
    }
  };

  const tableData = rows.map((r, i) => ({ ...r, seqNo: i + 1, staff: r.staffCount ?? 0, statusText: r.status ? "Active" : "Deleted" }));

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6 space-y-3">
        <DataTable
          {...actions}
          title={deleted ? `Deleted ${t.title}` : t.title}
          columns={[
            { label: "Seq Number", key: "seqNo" },
            { label: "Name", key: "name" },
            { label: "Staff", key: "staff" },
            { label: "Status", key: "statusText" },
          ]}
          data={tableData}
          isLoading={loading}
          showAdd={false}
          showImport={false}
          showExport={false}
          showView={!deleted && !!onView}
          onView={onView}
          showEdit={!deleted && actions.showEdit}
          showDelete={!deleted && actions.showDelete}
          showDeleted={!deleted}
          showReset={deleted && actions.canReset}
          toolbarActions={deleted ? undefined : toolbarActions}
          onShowDeleted={() => navigate(`${t.path}/deletedentries`)}
          onEdit={(row) => { setForm({ name: row.name }); setEditingId(row.id); }}
          onDelete={async (row) => {
            if (!window.confirm(`Delete ${t.one} "${row.name}"?`)) return;
            try { await m.remove({ variables: { id: row.id } }); say("Deleted."); await refetch(); }
            catch (e: any) { say(e?.message || "Delete failed.", "error"); }
          }}
          onReset={async (row) => {
            if (!window.confirm(`Restore ${t.one} "${row.name}"?`)) return;
            try { await m.reset({ variables: { id: row.id } }); say("Restored."); navigate(t.path); }
            catch (e: any) { say(e?.message || "Restore failed.", "error"); }
          }}
          entriesOptions={[10, 25, 50]}
          defaultEntriesPerPage={25}
          {...(deleted ? {} : {
            formFields: [{ name: "name", label: `${t.one[0].toUpperCase()}${t.one.slice(1)} Name`, type: "text", placeholder: "Enter name" }],
            formValues: form,
            formErrors: errors,
            onFormChange: (name: string, value: any) => setForm((f) => ({ ...f, [name]: value })),
            onFormSubmit: submit,
          })}
        />
        {children}
      </div>
    </HomeLayout>
  );
};

const Departments: React.FC<{ deleted?: boolean }> = ({ deleted }) => <NamedMasterPage kind="departments" deleted={deleted} />;

export default Departments;
