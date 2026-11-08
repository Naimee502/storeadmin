import React, { useEffect, useState } from "react";
import Button from "../../components/button";
import { usePermissionsLazy, usePermissionsMutations } from "../../graphql/hooks/adminsettings";
import { FORM_PERMISSIONS_CONFIG } from "../../config/formpermissions";
import { showMessage } from "../../redux/slices/message";
import { setPermissions as setReduxPermissions } from "../../redux/slices/permissions";

/** Form field permissions for one level; children are capped by the parent's (ceiling). */
const FormPermissionsTab: React.FC<{
  scope: "admin" | "branch" | "staff";
  scopeid?: string;
  dispatch: any;
  ceiling?: Record<string, Record<string, boolean>>;
  allowedModules?: string[];
}> = ({ scope, scopeid, dispatch, ceiling, allowedModules }) => {
  const parentOff = (moduleId: string, fieldId: string) => ceiling?.[moduleId]?.[fieldId] === false;
  const allowedLower = allowedModules ? allowedModules.map((m) => String(m).toLowerCase()) : null;
  const configs = FORM_PERMISSIONS_CONFIG.filter(
    (c) => !allowedLower || allowedLower.includes(c.moduleId.toLowerCase())
  );
  // Read fresh: Access and Form Permissions save the same document.
  const [load, { data, loading }] = usePermissionsLazy({ fetchPolicy: "network-only" });
  const { setPermissions } = usePermissionsMutations();
  const [draft, setDraft] = useState<any>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (scopeid) load({ variables: { scope, scopeid } });
  }, [scope, scopeid, load]);

  useEffect(() => {
    if (data?.getPermissions) {
      setDraft(data.getPermissions.permissions?.formPermissions || {});
      setDirty(false);
    }
  }, [data]);

  if (!scopeid) return <div className="text-sm text-gray-500">Pick a target first.</div>;
  if (loading || !draft) return <div className="text-sm text-gray-500">Loading…</div>;

  const handleSave = async () => {
    try {
      const fullPermissions = {
        ...(data?.getPermissions?.permissions || {}),
        formPermissions: draft,
      };
      const response = await setPermissions({ variables: { scope, scopeid, permissions: fullPermissions } });

      // Update Redux only for the business's own settings, not a branch/staff save.
      if (scope !== "admin") {
        // nothing to refresh locally
      } else if (response.data?.setPermissions?.permissions) {
        dispatch(setReduxPermissions(response.data.setPermissions.permissions));
      } else {
        dispatch(setReduxPermissions(fullPermissions));
      }

      setDirty(false);
      dispatch(showMessage({ message: "Form permissions updated", type: "success" }));
    } catch (e: any) {
      dispatch(showMessage({ message: e.message, type: "error" }));
    }
  };

  const toggleField = (moduleId: string, fieldId: string, value: boolean) => {
    setDirty(true);
    setDraft((prev: any) => ({
      ...prev,
      [moduleId]: {
        ...(prev[moduleId] || {}),
        [fieldId]: value,
      },
    }));
  };

  const isSelected = (moduleId: string, fieldId: string) => {
    if (parentOff(moduleId, fieldId)) return false;
    // default to true if undefined
    if (draft[moduleId] && draft[moduleId][fieldId] !== undefined) {
      return draft[moduleId][fieldId];
    }
    return true;
  };

  const isAllSelected = (moduleId: string, sectionId?: string) => {
    const config = FORM_PERMISSIONS_CONFIG.find((c) => c.moduleId === moduleId);
    if (!config) return false;

    if (sectionId) {
      const section = config.sections.find(s => s.id === sectionId);
      if (!section) return false;
      return section.fields.filter((f) => !parentOff(moduleId, f.id)).every((f) => isSelected(moduleId, f.id));
    }

    // Check module level
    return config.sections.every(s => s.fields.filter((f) => !parentOff(moduleId, f.id)).every(f => isSelected(moduleId, f.id)));
  };

  const toggleAll = (moduleId: string, value: boolean, sectionId?: string) => {
    setDirty(true);
    const config = FORM_PERMISSIONS_CONFIG.find((c) => c.moduleId === moduleId);
    if (!config) return;

    const newModuleDraft = { ...(draft[moduleId] || {}) };

    if (sectionId) {
      const section = config.sections.find(s => s.id === sectionId);
      if (section) {
        section.fields.forEach((f) => {
          if (!parentOff(moduleId, f.id)) newModuleDraft[f.id] = value;
        });
      }
    } else {
      config.sections.forEach(s => {
        s.fields.forEach((f) => {
          if (!parentOff(moduleId, f.id)) newModuleDraft[f.id] = value;
        });
      });
    }

    setDraft((prev: any) => ({
      ...prev,
      [moduleId]: newModuleDraft,
    }));
  };

  return (
    <div className="space-y-3">
      {scope !== "admin" && (
        <p className="text-[12px] text-slate-500">
          Untick a field to hide it from this {scope === "branch" ? "branch" : "staff member"} (e.g. Sales / Purchase rate on Products).
          Greyed fields are already off for the {scope === "branch" ? "business" : "branch"} and can't be turned on here.
        </p>
      )}
      {configs.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-white py-6 text-center text-[13px] text-slate-500">
          No forms to configure — none of this {scope}'s modules have form fields.
        </div>
      )}
      {configs.map((config) => (
        <div key={config.moduleId} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="bg-slate-50 flex items-center justify-between px-3 py-1.5 border-b border-slate-200">
            <div className="text-[13px] font-semibold text-slate-900">
              {config.label}
            </div>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 uppercase cursor-pointer hover:text-indigo-700 transition-colors">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-indigo-600"
                checked={isAllSelected(config.moduleId)}
                onChange={(e) => toggleAll(config.moduleId, e.target.checked)}
              />
              Select All Form
            </label>
          </div>
          <div className="p-2.5 space-y-2">
            {config.sections.map((section) => (
              <div key={section.id} className="border border-slate-200 rounded-md overflow-hidden">
                 <div className="bg-slate-50 flex items-center justify-between px-2.5 py-1 border-b border-slate-200">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      {section.label}
                    </div>
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 uppercase cursor-pointer hover:text-slate-900 transition-colors">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-slate-600"
                        checked={isAllSelected(config.moduleId, section.id)}
                        onChange={(e) => toggleAll(config.moduleId, e.target.checked, section.id)}
                      />
                      Select All Section
                    </label>
                 </div>
                 <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-1 p-2 text-[12px]">
                    {section.fields.map((field) => {
                      const locked = parentOff(config.moduleId, field.id);
                      return (
                      <label
                        key={field.id}
                        title={locked ? `${field.label} — off for the ${scope === "branch" ? "business" : "branch"}` : field.label}
                        className={`flex h-7 items-center gap-1.5 px-2 rounded-md border select-none transition-all ${
                          locked
                            ? "cursor-not-allowed bg-slate-100 border-slate-200 opacity-40"
                            : isSelected(config.moduleId, field.id) ? "cursor-pointer bg-indigo-50 border-indigo-200 hover:bg-indigo-100" : "cursor-pointer bg-white border-slate-200 hover:bg-slate-50 opacity-60 hover:opacity-80"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 accent-indigo-600"
                          checked={isSelected(config.moduleId, field.id)}
                          disabled={locked}
                          onChange={(e) => toggleField(config.moduleId, field.id, e.target.checked)}
                        />
                        <span className="font-medium truncate text-slate-800 text-[12px] leading-tight">{field.label}</span>
                      </label>
                      );
                    })}
                 </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="flex justify-end">
        <Button variant="outline" onClick={handleSave} disabled={!dirty}>
          Save Form Permissions
        </Button>
      </div>
    </div>
  );
};

export default FormPermissionsTab;
