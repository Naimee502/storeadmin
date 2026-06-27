// Settings — central control plane for the admin/branch.
//
// KEY DESIGN:
//  1. A single global dropdown at the top selects the target
//     (Branch for Admin, Staff for Branch). All child-management tabs share it.
//  2. When admin is logged in AND the SaaS flags are enabled, business-level
//     tabs (General, Business Modules, Business Permissions) are also shown
//     so the admin can manage everything from one page.

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
  DEFAULT_ON_MODULE_IDS,
  type ModuleAction,
} from "../../config/modules";

type TabKey =
  | "branch_modules"
  | "staff_modules"
  | "access";

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

  // ── Global target selection (lifted from individual tabs) ──
  const { data: branchesData } = useBranchesQuery();
  const { data: staffData } = useStaffQuery();

  const targetOptions = useMemo(() => {
    if (isAdmin) {
      return (branchesData?.getBranches ?? []).map((b: any) => ({
        value: b.id,
        label: b.branchname,
      }));
    }
    if (isBranch) {
      return (staffData?.getStaffAccounts ?? []).map((s: any) => ({
        value: s.id,
        label: s.name,
      }));
    }
    return [];
  }, [isAdmin, isBranch, branchesData, staffData]);

  const [selectedTargetId, setSelectedTargetId] = useState<string>("");

  // ── Parent-allowed modules (strict hierarchy) ──
  const parentAllowed = useMemo(() => {
    const list = isAdmin ? admin?.allowedmodules : branch?.allowedmodules;
    if (list === undefined || list === null) return ADMIN_REGISTER_MODULES.map((m) => m.id);
    // Always surface default-on modules (newly added) so they can be granted /
    // permissioned even for tenants whose allowedmodules predate the module.
    const extra = DEFAULT_ON_MODULE_IDS.filter(
      (id) => !list.map((x: string) => x.toLowerCase()).includes(id.toLowerCase())
    );
    return [...list, ...extra];
  }, [isAdmin, admin, branch]);

  // ── Target's effective allowed modules ──
  const targetEffectiveAllowed = useMemo(() => {
    if (!selectedTargetId) return parentAllowed;

    let targetAllowed: string[] | null | undefined = undefined;
    if (isAdmin) {
      const selectedBranch = (branchesData?.getBranches ?? []).find((b: any) => b.id === selectedTargetId);
      targetAllowed = selectedBranch?.allowedmodules;
    } else if (isBranch) {
      const selectedStaff = (staffData?.getStaffAccounts ?? []).find((s: any) => s.id === selectedTargetId);
      targetAllowed = selectedStaff?.allowedmodules;
    }

    if (targetAllowed === null || targetAllowed === undefined) return parentAllowed;
    const parentLower = parentAllowed.map((p) => p.toLowerCase());
    return targetAllowed.filter((id: string) => parentLower.includes(id.toLowerCase()));
  }, [selectedTargetId, parentAllowed, isAdmin, isBranch, branchesData, staffData]);

  // ── Build visible tabs ──
  // Business tabs: shown to admin when SaaS flags allow (hide ONLY if flag === false)
  // Child tabs: Branch Modules + Branch Access for admin, Staff Modules + Staff Access for branch
  const visibleTabs: Array<[TabKey, string]> = useMemo(() => {
    const tabs: Array<[TabKey, string]> = [];

    if (isAdmin) {
      // Child-management tabs
      tabs.push(["branch_modules", "Branch Modules"]);
      tabs.push(["access", "Branch Access"]);
    } else if (isBranch) {
      tabs.push(["staff_modules", "Staff Modules"]);
      tabs.push(["access", "Staff Access"]);
    }
    return tabs;
  }, [isAdmin, isBranch]);

  const [tab, setTab] = useState<TabKey>(visibleTabs[0]?.[0] ?? "access");

  // Auto-fix current tab if it becomes hidden
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.find((t) => t[0] === tab)) {
      setTab(visibleTabs[0][0]);
    }
  }, [visibleTabs, tab]);

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

        {/* ── GLOBAL Selection Dropdown ── */}
        <div className="bg-white border rounded-lg p-3 mb-4">
          <FormField
            label={isAdmin ? "Select Branch" : "Select Staff Member"}
            type="select"
            name="selectedTargetId"
            value={selectedTargetId}
            onChange={(e: any) => setSelectedTargetId(e.target.value)}
            options={targetOptions}
            searchable
          />
        </div>

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

        {/* ── Child-management tabs (need target selection) ── */}
        {!selectedTargetId ? (
          <div className="text-center py-10 bg-white border rounded-lg text-gray-500 text-sm">
            Please select {isAdmin ? "a Branch" : "a Staff member"} above to manage settings.
          </div>
        ) : (
          <>
            {tab === "branch_modules" && isAdmin && (
              <SubModulesTab
                scope="branch"
                title="Configure modules allowed for this Branch"
                dispatch={dispatch}
                selectedTargetId={selectedTargetId}
                parentAllowed={parentAllowed}
              />
            )}
            {tab === "staff_modules" && isBranch && (
              <SubModulesTab
                scope="staff"
                title="Configure modules allowed for this Staff member"
                dispatch={dispatch}
                selectedTargetId={selectedTargetId}
                parentAllowed={parentAllowed}
              />
            )}
            {tab === "access" && (
              <AccessTab
                adminId={adminId}
                dispatch={dispatch}
                scopeMode={isAdmin ? "branch" : "staff"}
                selectedTargetId={selectedTargetId}
                parentAllowed={targetEffectiveAllowed}
              />
            )}
          </>
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
  selectedTargetId: string;          // ← from global dropdown
  parentAllowed: string[];           // ← strict parent chain
}> = ({ scope, title, dispatch, selectedTargetId, parentAllowed }) => {
  const [draft, setDraft] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);

  const { data: branchesData, refetch: refetchBranches } = useBranchesQuery();
  const { data: staffData, refetch: refetchStaff } = useStaffQuery();
  const { editBranchMutation } = useBranchMutations();
  const { editStaffMutation } = useStaffMutations();

  // Build lookup for current target's existing allowedmodules
  const targets = useMemo(() => {
    if (scope === "branch") {
      return (branchesData?.getBranches ?? []).map((b: any) => ({
        id: b.id,
        name: b.branchname,
        currentAllowed: b.allowedmodules, // Preserve null if not set
      }));
    }
    return (staffData?.getStaffAccounts ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
      currentAllowed: s.allowedmodules, // Preserve null if not set
    }));
  }, [scope, branchesData, staffData]);

  // When target changes, load its existing modules (or default to parent)
  useEffect(() => {
    const selected = targets.find((t) => t.id === selectedTargetId);
    if (selected) {
      // null/undefined = "never set, use parent default"; array (even []) = "explicit selection"
      const current =
        selected.currentAllowed !== null && selected.currentAllowed !== undefined
          ? selected.currentAllowed
          : parentAllowed;
      // STRICT: intersect with parentAllowed — child can never have more than parent
      setDraft(current.filter((id: string) => parentAllowed.map((p) => p.toLowerCase()).includes(id.toLowerCase())));
    } else {
      setDraft([]);
    }
    setDirty(false);
  }, [selectedTargetId, targets, parentAllowed]);

  const handleSave = async () => {
    if (!selectedTargetId) return;
    try {
      // STRICT: final save also intersects with parentAllowed
      const cleaned = draft.filter((id) =>
        parentAllowed.map((p) => p.toLowerCase()).includes(id.toLowerCase())
      );
      const input = { allowedmodules: cleaned };
      if (scope === "branch") {
        await editBranchMutation({ variables: { id: selectedTargetId, input } });
        // Refetch so Apollo cache has the updated allowedmodules
        await refetchBranches();
      } else {
        await editStaffMutation({ variables: { id: selectedTargetId, input } });
        // Refetch so Apollo cache has the updated allowedmodules
        await refetchStaff();
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

  // STRICT: only show modules the parent (admin/branch) is allowed
  const eligibleModules = useMemo(
    () =>
      ADMIN_REGISTER_MODULES.filter((m) =>
        parentAllowed.map((id) => id.toLowerCase()).includes(m.id.toLowerCase())
      ),
    [parentAllowed]
  );

  const grouped = useMemo(() => {
    const map: Record<string, typeof ADMIN_REGISTER_MODULES> = {};
    eligibleModules.forEach((m) => {
      (map[m.section] ||= [] as any).push(m);
    });
    return map;
  }, [eligibleModules]);

  return (
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
              <label
                key={m.id}
                className={`flex items-center gap-2 px-2 py-1 rounded border ${
                  draft.includes(m.id) ? "bg-blue-50 border-blue-200" : "bg-white border-gray-200"
                }`}
              >
                <input type="checkbox" checked={draft.includes(m.id)} onChange={() => toggleOne(m.id)} />
                <span className="font-medium truncate">{m.label}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
      <div className="flex justify-end">
        <Button variant="outline" onClick={handleSave} disabled={!dirty}>
          Save Allowance
        </Button>
      </div>
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

  const ALL_ACTIONS: ModuleAction[] = ["view", "add", "edit", "delete", "print", "return", "cancel", "convert", "whatsapp", "import", "export", "reset"];

  const handleSave = async () => {
    try {
      // CRITICAL: Build a complete permissions object with explicit true/false
      // for every visible module's every action. This prevents the backend from
      // cascading parent defaults (true) for missing/undefined actions.
      const completePerms: Record<string, Record<string, boolean>> = {};
      visibleModules.forEach((m) => {
        completePerms[m.id] = {};
        m.actions.forEach((a) => {
          completePerms[m.id][a] = !!draft?.[m.id]?.[a]; // undefined/missing → false
        });
      });
      await setPermissions({ variables: { scope, scopeid, permissions: completePerms } });
      dispatch(showMessage({ message: "Permissions saved.", type: "success" }));
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Save failed.", type: "error" }));
    }
  };

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
  scopeMode: "branch" | "staff";
  selectedTargetId: string;          // ← from global dropdown
  parentAllowed: string[];           // ← strict parent chain
}> = ({ adminId, dispatch, scopeMode, selectedTargetId, parentAllowed }) => {
  const [load, { data: effectiveData }] = useEffectivePermissionsLazy();

  useEffect(() => {
    if (selectedTargetId) load({ variables: { scope: scopeMode, scopeid: selectedTargetId } });
  }, [scopeMode, selectedTargetId, load]);

  return (
    <div className="space-y-4">
      <PermissionsTab
        scope={scopeMode}
        scopeid={selectedTargetId}
        title={`Per-${scopeMode} override — empty cells inherit from admin defaults`}
        dispatch={dispatch}
        effectiveOverlay={effectiveData?.getEffectivePermissions?.permissions}
        parentAllowed={parentAllowed}
      />
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
