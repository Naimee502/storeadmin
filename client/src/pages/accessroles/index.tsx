import React, { useState } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import Button from "../../components/button";
import { showMessage } from "../../redux/slices/message";
import { MODULES, type ModuleDef } from "../../config/modules";
import { NamedMasterPage } from "../departments";
import { useAccessRolesQuery, useAccessRoleMutations, usePermissionAuditQuery } from "../../graphql/hooks/accessroles";
import { usePermissionsMutations } from "../../graphql/hooks/adminsettings";

type Preset = { key: string; name: string; modules: (m: ModuleDef) => boolean; except: string[] };

const inList = (ids: string[], sections: string[] = []) => (m: ModuleDef) => ids.includes(m.id) || sections.includes(m.section);
const SAFE = ["delete", "reset", "clear"];

// Starting points; every module is listed, so a role allows only what it ticks.
const PRESETS: Preset[] = [
  { key: "manager", name: "Manager", modules: (m) => m.section !== "system", except: ["clear"] },
  { key: "billing", name: "Billing", modules: inList(["accounts", "payments", "reports.sales", "reports.party"], ["sales", "pos"]), except: SAFE },
  { key: "salesman", name: "Salesman", modules: inList(["salesorder", "accounts", "reports.salesmen"]), except: [...SAFE, "cancel", "convert"] },
  { key: "storekeeper", name: "Storekeeper", modules: inList(["products", "deliverychallan", "reports.stock", "reports.product", "reports.purchase"], ["inventory", "purchase"]), except: SAFE },
  { key: "technician", name: "Technician", modules: inList(["reports.service"], ["service"]), except: SAFE },
  { key: "accountant", name: "Accountant", modules: inList(["reports.accounting", "reports.gst", "reports.party", "reports.sales", "reports.purchase"], ["accounting", "accounts"]), except: ["clear"] },
];

const permissionsOf = (p: Preset) =>
  Object.fromEntries(MODULES.map((m) => [m.id, Object.fromEntries(m.actions.map((a) => [a, p.modules(m) && !p.except.includes(a)]))]));

const when = (v?: string) => (v ? new Date(v).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "-");

const AccessRoles: React.FC<{ deleted?: boolean }> = ({ deleted }) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const isOwner = useAppSelector((s: any) => s.auth.type) === "admin";
  const { data, refetch } = useAccessRolesQuery(false);
  const { add } = useAccessRoleMutations();
  const { setPermissions } = usePermissionsMutations();
  const audit = usePermissionAuditQuery(30);
  const [busy, setBusy] = useState(false);

  const addPresets = async () => {
    const have = new Set((data?.getAccessRoles || []).map((r: any) => String(r.name).toLowerCase()));
    const todo = PRESETS.filter((p) => !have.has(p.name.toLowerCase()));
    if (!todo.length) return dispatch(showMessage({ message: "All preset roles are already added.", type: "success" }));
    setBusy(true);
    try {
      for (const p of todo) {
        const res = await add({ variables: { input: { name: p.name, preset: p.key } } });
        const id = res.data?.addAccessRole?.id;
        if (id) await setPermissions({ variables: { scope: "role", scopeid: id, permissions: permissionsOf(p) } });
      }
      dispatch(showMessage({ message: `Added ${todo.map((p) => p.name).join(", ")}. Open a role to adjust it.`, type: "success" }));
      await Promise.all([refetch(), audit.refetch()]);
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Could not add the preset roles.", type: "error" }));
    } finally {
      setBusy(false);
    }
  };

  const log: any[] = audit.data?.getPermissionAudit || [];

  return (
    <NamedMasterPage
      kind="accessroles"
      deleted={deleted}
      onView={(row) => navigate(`/settings?role=${row.id}`)}
      toolbarActions={isOwner ? <Button onClick={addPresets} disabled={busy}>Add Preset Roles</Button> : undefined}
    >
      {!deleted && (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-[13px] font-semibold text-slate-900">Recent Permission Changes</div>
          <div className="mb-2 text-[12px] text-slate-500">Open a role (eye icon) to set what it can do. A staff member's own settings still win over their role.</div>
          {log.length ? (
            <table className="w-full text-[13px]">
              <thead className="text-left text-slate-500">
                <tr><th className="py-1 font-medium">When</th><th className="font-medium">Changed</th><th className="font-medium">By</th><th className="font-medium">Modules</th></tr>
              </thead>
              <tbody>
                {log.map((e) => (
                  <tr key={e.id} className="border-t border-slate-100 align-top">
                    <td className="py-1 pr-2 whitespace-nowrap">{when(e.createdAt)}</td>
                    <td className="pr-2 capitalize">{e.scope}</td>
                    <td className="pr-2">{e.byname || e.bytype || "-"}</td>
                    <td className="text-slate-600">{e.modules.slice(0, 8).join(", ")}{e.modules.length > 8 ? ` +${e.modules.length - 8}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="text-[12px] text-slate-500">No changes recorded yet.</div>}
        </div>
      )}
    </NamedMasterPage>
  );
};

export default AccessRoles;
