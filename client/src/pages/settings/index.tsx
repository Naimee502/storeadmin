// Settings — central control plane for the admin.
// Now simplified to only show Branch/Staff management for Admins.
// Business-level settings have moved to /businesssettings.

import { useEffect, useMemo, useState } from "react";
import HomeLayout from "../../layouts/home";
import FormField from "../../components/formfiled";
import FormSwitch from "../../components/formswitch";
import Button from "../../components/button";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { showMessage } from "../../redux/slices/message";
import {
  usePermissionsLazy,
  useEffectivePermissionsLazy,
  usePermissionsMutations,
} from "../../graphql/hooks/adminsettings";
import { useBranchesQuery, useBranchMutations } from "../../graphql/hooks/branches";
import { useStaffQuery, useStaffMutations } from "../../graphql/hooks/staffaccounts";
import {
  MODULES,
  SECTION_LABELS,
  ADMIN_REGISTER_MODULES,
  type ModuleAction,
} from "../../config/modules";

type TabKey = "branch_modules" | "staff_modules" | "access";

const Settings = () => {
  const dispatch = useAppDispatch();
  const { type, admin, branch, staff } = useAppSelector((s: any) => s.auth);
  const adminId =
    type === "admin"
      ? admin?.id
      : type === "branch"
        ? branch?.admin?.id
        : type === "staff"
          ? staff?.admin?.id
          : undefined;

  const role = type?.toString().toLowerCase();
  const isAdmin = role === "admin";
  const isBranch = role === "branch";

  const visibleTabs: Array<[TabKey, string]> = useMemo(() => {
    const tabs: Array<[TabKey, string]> = [];
    if (isAdmin) {
      tabs.push(["branch_modules", "Branch Modules"]);
      tabs.push(["access", "Branch Access"]);
    } else if (isBranch) {
      tabs.push(["staff_modules", "Staff Modules"]);
      tabs.push(["access", "Staff Access"]);
    }
    return tabs;
  }, [isAdmin, isBranch]);

  const [tab, setTab] = useState<TabKey>(visibleTabs[0]?.[0] ?? "access");

  if (type === "staff") {
    return (
      <HomeLayout>
        <div className="w-full px-2 sm:px-6 pt-4 pb-6">
          <div className="bg-white border rounded-lg p-6 text-sm text-gray-600">
            You don't have permission to open Settings.
          </div>
        </div>
      </HomeLayout>
    );
  }

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <h1 className="text-2xl font-semibold mb-4">Settings</h1>

        <div className="flex border-b mb-4 overflow-x-auto">
          {visibleTabs.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${
                tab === key
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "branch_modules" && isAdmin && (
          <SubModulesTab 
            scope="branch" 
            title="Configure modules allowed for each Branch"
            dispatch={dispatch} 
          />
        )}
        {tab === "staff_modules" && isBranch && (
          <SubModulesTab 
            scope="staff" 
            title="Configure modules allowed for your Staff"
            dispatch={dispatch} 
          />
        )}
        {tab === "access" && (
          <AccessTab
            adminId={adminId}
            dispatch={dispatch}
            scopeMode={isAdmin ? "branch" : "staff"}
          />
        )}
      </div>
    </HomeLayout>
  );
};

export default Settings;

/* =====================================================================
   SUB-MODULES TAB — configure allowed modules for children (Admin -> Branch or Branch -> Staff)
   ===================================================================== */

const SubModulesTab: React.FC<{
  scope: "branch" | "staff";
  title: string;
  dispatch: any;
}> = ({ scope, title, dispatch }) => {
  const { type, admin, branch } = useAppSelector((s: any) => s.auth);
  const role = type?.toString().toLowerCase();
  const isAdmin = role === "admin";
  const isBranch = role === "branch";

  const [scopeid, setScopeid] = useState<string>("");
  const [draft, setDraft] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);

  const { data: branchesData } = useBranchesQuery();
  const { data: staffData } = useStaffQuery();
  const { editBranchMutation } = useBranchMutations();
  const { editStaffMutation } = useStaffMutations();

  const parentAllowed = useMemo(() => {
    const list = isAdmin ? admin?.allowedmodules : branch?.allowedmodules;
    // If list is null/undefined, show all (SaaS default). If empty [], show nothing.
    if (list === undefined || list === null) return ADMIN_REGISTER_MODULES.map(m => m.id);
    return list;
  }, [isAdmin, admin, branch]);

  const targets = useMemo(() => {
    if (scope === "branch") {
      return (branchesData?.getBranches ?? []).map((b: any) => ({
        id: b.id,
        name: b.branchname,
        currentAllowed: b.allowedmodules // Preserve null if not set
      }));
    }
    return (staffData?.getStaffAccounts ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
      currentAllowed: s.allowedmodules // Preserve null if not set
    }));
  }, [scope, branchesData, staffData]);

  const targetOptions = useMemo(() => 
    targets.map(t => ({ value: t.id, label: t.name })), 
  [targets]);

  useEffect(() => {
    const selected = targets.find(t => t.id === scopeid);
    if (selected) {
      // If currentAllowed is exactly null/undefined, it means "never set, use parent default"
      // If it's an array (even empty []), it means "explicit selection made"
      setDraft(selected.currentAllowed !== null && selected.currentAllowed !== undefined ? selected.currentAllowed : parentAllowed);
    } else {
      setDraft([]);
    }
    setDirty(false);
  }, [scopeid, targets, parentAllowed]);

  const handleSave = async () => {
    if (!scopeid) return;
    try {
      const input = { allowedmodules: draft };
      if (scope === "branch") {
        await editBranchMutation({ variables: { id: scopeid, input } });
      } else {
        await editStaffMutation({ variables: { id: scopeid, input } });
      }
      dispatch(showMessage({ message: "Modules updated successfully.", type: "success" }));
      setDirty(false);
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Save failed.", type: "error" }));
    }
  };

  const toggleOne = (id: string) => {
    setDirty(true);
    setDraft((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const eligibleModules = useMemo(() => 
    ADMIN_REGISTER_MODULES.filter(m => parentAllowed.map(id => id.toLowerCase()).includes(m.id.toLowerCase())),
  [parentAllowed]);

  const grouped = useMemo(() => {
    const map: Record<string, typeof ADMIN_REGISTER_MODULES> = {};
    eligibleModules.forEach((m) => {
      (map[m.section] ||= [] as any).push(m);
    });
    return map;
  }, [eligibleModules]);

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded-lg p-3 text-sm">
        <FormField
          label={scope === "branch" ? "Select Branch" : "Select Staff member"}
          type="select"
          name="scopeid"
          value={scopeid}
          onChange={(e: any) => setScopeid(e.target.value)}
          options={targetOptions}
          searchable
        />
      </div>

      {scopeid && (
        <div className="space-y-4">
          <div className="text-sm text-gray-600 font-medium">{title}</div>
          {Object.entries(grouped).map(([section, items]) => (
            <div key={section} className="bg-white border rounded-lg p-3">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {SECTION_LABELS[section as keyof typeof SECTION_LABELS]}
            </div>
            <label className="flex items-center gap-2 text-[10px] font-bold text-blue-600 uppercase cursor-pointer">
              <input
                type="checkbox"
                className="scale-90"
                checked={items.every((m: any) => draft.includes(m.id))}
                onChange={() => {
                  setDirty(true);
                  const sectionIds = items.map((m: any) => m.id);
                  const allSelected = sectionIds.every((id) => draft.includes(id));
                  if (allSelected) {
                    setDraft((prev) => prev.filter((id) => !sectionIds.includes(id)));
                  } else {
                    setDraft((prev) => Array.from(new Set([...prev, ...sectionIds])));
                  }
                }}
              />
              Select All {SECTION_LABELS[section as keyof typeof SECTION_LABELS]}
            </label>
          </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-sm">
                {items.map((m: any) => (
                  <label key={m.id} className={`flex items-center gap-2 px-2 py-1 rounded border ${draft.includes(m.id) ? "bg-blue-50 border-blue-200" : "bg-white border-gray-200"}`}>
                    <input type="checkbox" checked={draft.includes(m.id)} onChange={() => toggleOne(m.id)} />
                    <span className="font-medium truncate">{m.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div className="flex justify-end">
            <Button variant="outline" onClick={handleSave} disabled={!dirty}>Save Allowance</Button>
          </div>
        </div>
      )}
    </div>
  );
};

const PermissionsTab: React.FC<{
  scope: "admin" | "branch" | "staff";
  scopeid?: string;
  title: string;
  dispatch: any;
  effectiveOverlay?: any;
  parentAllowed?: string[];
}> = ({ scope, scopeid, title, dispatch, effectiveOverlay, parentAllowed }) => {
  const [load, { data, loading }] = usePermissionsLazy();
  const { setPermissions } = usePermissionsMutations();
  const [draft, setDraft] = useState<any>(null);

  useEffect(() => {
    if (scopeid) load({ variables: { scope, scopeid } });
  }, [scope, scopeid, load]);

  useEffect(() => {
    if (data?.getPermissions) setDraft(data.getPermissions.permissions || {});
  }, [data]);

  const visibleModules = useMemo(() => {
    let list = MODULES.filter((m) => m.section !== "system");
    if (parentAllowed) {
      list = list.filter(m => parentAllowed.map(id => id.toLowerCase()).includes(m.id.toLowerCase()));
    }
    return list;
  }, [parentAllowed]);

  if (!scopeid) return <div className="text-sm text-gray-500">Pick a target first.</div>;
  if (loading || !draft) return <div className="text-sm text-gray-500">Loading…</div>;

  const handleSave = async () => {
    try {
      await setPermissions({ variables: { scope, scopeid, permissions: draft } });
      dispatch(showMessage({ message: "Permissions saved.", type: "success" }));
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Save failed.", type: "error" }));
    }
  };

  const ALL_ACTIONS: ModuleAction[] = ["view", "add", "edit", "delete", "print", "return", "cancel", "convert", "whatsapp", "import", "export", "reset"];

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">{title}</div>
      {Object.entries(visibleModules.reduce<Record<string, typeof MODULES>>((acc, m) => { (acc[m.section] ||= [] as any).push(m); return acc; }, {})).map(([section, items]) => {
        // Find all actions supported by at least one module in this section
        const sectionActions = ALL_ACTIONS.filter(a => items.some(m => m.actions.includes(a)));

        return (
          <div key={section} className="bg-white border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {SECTION_LABELS[section as keyof typeof SECTION_LABELS]}
              </div>
              <label className="flex items-center gap-2 text-[10px] font-bold text-blue-600 uppercase cursor-pointer">
                <input
                  type="checkbox"
                  className="scale-90"
                  checked={items.every(m => m.actions.every(a => !!draft?.[m.id]?.[a]))}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setDraft((prev: any) => {
                      const next = { ...prev };
                      items.forEach(m => {
                        next[m.id] = { ...(next[m.id] || {}) };
                        m.actions.forEach(a => {
                          next[m.id][a] = val;
                        });
                      });
                      return next;
                    });
                  }}
                />
                Select All {SECTION_LABELS[section as keyof typeof SECTION_LABELS]}
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left bg-gray-50 border-b">
                    <th className="px-3 py-2 sticky left-0 bg-gray-50 border-r min-w-[150px]">Module</th>
                    {sectionActions.map((a) => (
                      <th key={a} className="px-2 py-2 text-center border-r last:border-r-0">
                        <div className="flex items-center justify-center gap-1.5 min-w-[70px]">
                          <input
                            type="checkbox"
                            className="scale-90"
                            checked={items.every((m) => !m.actions.includes(a) || !!draft?.[m.id]?.[a])}
                            onChange={(e) => {
                              const val = e.target.checked;
                              setDraft((prev: any) => {
                                const next = { ...prev };
                                items.forEach((m) => {
                                  if (m.actions.includes(a)) {
                                    next[m.id] = { ...(next[m.id] || {}), [a]: val };
                                  }
                                });
                                return next;
                              });
                            }}
                          />
                          <span className="capitalize whitespace-nowrap">{a}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((m) => (
                    <tr key={m.id} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-2 sticky left-0 bg-white border-r font-medium">
                        {m.label}
                      </td>
                      {sectionActions.map((a) => (
                        <td key={a} className="px-2 py-2 text-center border-r last:border-r-0">
                          {m.actions.includes(a) ? (
                            <input
                              type="checkbox"
                              checked={!!draft?.[m.id]?.[a]}
                              onChange={(e) => setDraft((d: any) => ({
                                ...d,
                                [m.id]: { ...(d?.[m.id] || {}), [a]: e.target.checked }
                              }))}
                            />
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      <div className="flex justify-end">
        <Button variant="outline" onClick={handleSave}>Save Permissions</Button>
      </div>
    </div>
  );
};

const AccessTab: React.FC<{
  adminId?: string;
  dispatch: any;
  scopeMode?: "branch" | "staff";
}> = ({ adminId, dispatch, scopeMode }) => {
  const { type, admin, branch } = useAppSelector((s: any) => s.auth);
  const isAdmin = type === "admin";
  const [scope, setScope] = useState<"branch" | "staff">(
    scopeMode ? scopeMode : "branch"
  );
  const [scopeid, setScopeid] = useState<string>("");
  const { data: branchesData } = useBranchesQuery();
  const { data: staffData } = useStaffQuery();

  const options = useMemo(() => {
    if (scope === "branch") {
      return (branchesData?.getBranches ?? []).map((b: any) => ({ value: b.id, label: b.branchname }));
    }
    return (staffData?.getStaffAccounts ?? []).map((s: any) => ({ value: s.id, label: s.name }));
  }, [scope, branchesData, staffData]);

  const [load, { data: effectiveData }] = useEffectivePermissionsLazy();
  useEffect(() => {
    if (scopeid) load({ variables: { scope, scopeid } });
  }, [scope, scopeid, load]);

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded-lg p-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {!scopeMode && (
            <FormField label="Scope" type="select" name="scope" value={scope} onChange={(e: any) => { setScope(e.target.value); setScopeid(""); }} options={[{ value: "branch", label: "Branch" }, { value: "staff", label: "Staff" }]} />
          )}
          <FormField label={scope === "branch" ? "Pick a branch" : "Pick a staff member"} type="select" name="scopeid" value={scopeid} onChange={(e: any) => setScopeid(e.target.value)} options={options} searchable />
        </div>
      </div>
      {scopeid && (
        <PermissionsTab 
          scope={scope} 
          scopeid={scopeid} 
          title={`Per-${scope} override — empty cells inherit from admin defaults`} 
          dispatch={dispatch} 
          effectiveOverlay={effectiveData?.getEffectivePermissions?.permissions} 
          parentAllowed={isAdmin ? admin?.allowedmodules : branch?.allowedmodules}
        />
      )}
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white border rounded-lg p-4">
    <div className="text-sm font-semibold mb-3 text-gray-700">{title}</div>
    <div className="space-y-2">{children}</div>
  </div>
);

const Toggle: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, checked, onChange }) => (
  <div className="flex items-center justify-between text-sm">
    <span>{label}</span>
    <FormSwitch label="" name={label} checked={!!checked} onChange={(v) => onChange(!!v)} />
  </div>
);
