import React, { useEffect, useState } from "react";
import Button from "../../components/button";
import { usePermissionsLazy, usePermissionsMutations } from "../../graphql/hooks/adminsettings";
import { FORM_PERMISSIONS_CONFIG } from "../../config/formpermissions";
import { showMessage } from "../../redux/slices/message";
import { setPermissions as setReduxPermissions } from "../../redux/slices/permissions";
import { compactRule, fieldOn, ruleOf, type FieldMode } from "../../hooks/useformmode";

const MODES: FieldMode[] = ["add", "edit"];

/** Form field permissions for one level; children are capped by the parent's (ceiling). */
const FormPermissionsTab: React.FC<{
  scope: "admin" | "branch" | "staff";
  scopeid?: string;
  dispatch: any;
  ceiling?: Record<string, Record<string, any>>;
  allowedModules?: string[];
}> = ({ scope, scopeid, dispatch, ceiling, allowedModules }) => {
  // Off for the parent level in this mode (both modes when no mode is given).
  const parentOff = (moduleId: string, fieldId: string, mode?: FieldMode) =>
    mode ? !fieldOn(ceiling?.[moduleId], fieldId, mode) : MODES.every((m) => !fieldOn(ceiling?.[moduleId], fieldId, m));
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

  // New value for one field; modes the parent has off stay as they are.
  const nextRule = (moduleId: string, fieldId: string, current: any, value: boolean, mode?: FieldMode) => {
    const r = ruleOf(current);
    for (const m of mode ? [mode] : MODES) if (!parentOff(moduleId, fieldId, m)) r[m] = value;
    return compactRule(r.add, r.edit);
  };

  const toggleField = (moduleId: string, fieldId: string, value: boolean, mode?: FieldMode) => {
    setDirty(true);
    setDraft((prev: any) => ({
      ...prev,
      [moduleId]: {
        ...(prev[moduleId] || {}),
        [fieldId]: nextRule(moduleId, fieldId, prev[moduleId]?.[fieldId], value, mode),
      },
    }));
  };

  const isSelected = (moduleId: string, fieldId: string, mode?: FieldMode) => {
    const modes = mode ? [mode] : MODES;
    return modes.every((m) => !parentOff(moduleId, fieldId, m) && fieldOn(draft[moduleId], fieldId, m));
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
          newModuleDraft[f.id] = nextRule(moduleId, f.id, newModuleDraft[f.id], value);
        });
      }
    } else {
      config.sections.forEach(s => {
        s.fields.forEach((f) => {
          newModuleDraft[f.id] = nextRule(moduleId, f.id, newModuleDraft[f.id], value);
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
      {scope === "admin" && (
        <p className="text-[12px] text-slate-500">Add: the field shows on a new entry. Edit: it shows when changing a saved entry. Untick to hide it there.</p>
      )}
      {scope !== "admin" && (
        <p className="text-[12px] text-slate-500">
          Untick Add or Edit to hide a field from this {scope === "branch" ? "branch" : "staff member"} on new entries or when changing one (e.g. Sales rate on Products).
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
                 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-1 p-2 text-[12px]">
                    {section.fields.map((field) => {
                      const locked = parentOff(config.moduleId, field.id);
                      const both = isSelected(config.moduleId, field.id);
                      return (
                      <div
                        key={field.id}
                        title={locked ? `${field.label} — off for the ${scope === "branch" ? "business" : "branch"}` : field.label}
                        className={`flex flex-col gap-0.5 px-2 py-1 rounded-md border select-none transition-all ${
                          locked
                            ? "bg-slate-100 border-slate-200 opacity-40"
                            : both ? "bg-indigo-50 border-indigo-200" : MODES.some((m) => isSelected(config.moduleId, field.id, m)) ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200 opacity-70"
                        }`}
                      >
                        <span className="font-medium truncate text-slate-800 text-[12px] leading-tight">{field.label}</span>
                        <div className="flex items-center gap-2 text-[11px] text-slate-600">
                          {MODES.map((m) => (
                            <label key={m} className={`flex items-center gap-1 ${parentOff(config.moduleId, field.id, m) ? "cursor-not-allowed" : "cursor-pointer"}`}>
                              <input
                                type="checkbox"
                                className="h-3 w-3 accent-indigo-600"
                                checked={isSelected(config.moduleId, field.id, m)}
                                disabled={parentOff(config.moduleId, field.id, m)}
                                onChange={(e) => toggleField(config.moduleId, field.id, e.target.checked, m)}
                              />
                              {m === "add" ? "Add" : "Edit"}
                            </label>
                          ))}
                        </div>
                      </div>
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
