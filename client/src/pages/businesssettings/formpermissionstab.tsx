import React, { useEffect, useState } from "react";
import Button from "../../components/button";
import { usePermissionsLazy, usePermissionsMutations } from "../../graphql/hooks/adminsettings";
import { FORM_PERMISSIONS_CONFIG } from "../../config/formpermissions";
import { showMessage } from "../../redux/slices/message";
import { setPermissions as setReduxPermissions } from "../../redux/slices/permissions";

const FormPermissionsTab: React.FC<{
  scope: "admin";
  scopeid?: string;
  dispatch: any;
}> = ({ scope, scopeid, dispatch }) => {
  const [load, { data, loading }] = usePermissionsLazy();
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
      
      // Update Redux state immediately so changes reflect without reloading
      if (response.data?.setPermissions?.permissions) {
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
      return section.fields.every((f) => isSelected(moduleId, f.id));
    }
    
    // Check module level
    return config.sections.every(s => s.fields.every(f => isSelected(moduleId, f.id)));
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
          newModuleDraft[f.id] = value;
        });
      }
    } else {
      config.sections.forEach(s => {
        s.fields.forEach((f) => {
          newModuleDraft[f.id] = value;
        });
      });
    }
    
    setDraft((prev: any) => ({
      ...prev,
      [moduleId]: newModuleDraft,
    }));
  };

  return (
    <div className="space-y-6 mt-6">
      {FORM_PERMISSIONS_CONFIG.map((config) => (
        <div key={config.moduleId} className="bg-white border rounded-lg overflow-hidden shadow-sm">
          <div className="bg-gray-50 flex items-center justify-between px-4 py-3 border-b">
            <div className="text-sm font-bold uppercase tracking-wider text-gray-800">
              {config.label}
            </div>
            <label className="flex items-center gap-2 text-xs font-bold text-blue-700 uppercase cursor-pointer hover:text-blue-800 transition-colors">
              <input
                type="checkbox"
                className="scale-110 accent-blue-600"
                checked={isAllSelected(config.moduleId)}
                onChange={(e) => toggleAll(config.moduleId, e.target.checked)}
              />
              Select All Form
            </label>
          </div>
          <div className="p-4 space-y-5">
            {config.sections.map((section) => (
              <div key={section.id} className="border border-gray-200 rounded-md overflow-hidden">
                 <div className="bg-gray-100/50 flex items-center justify-between px-3 py-2 border-b border-gray-200">
                    <div className="text-xs font-semibold text-gray-700">
                      {section.label}
                    </div>
                    <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600 uppercase cursor-pointer hover:text-gray-900 transition-colors">
                      <input
                        type="checkbox"
                        className="scale-90 accent-gray-600"
                        checked={isAllSelected(config.moduleId, section.id)}
                        onChange={(e) => toggleAll(config.moduleId, e.target.checked, section.id)}
                      />
                      Select All Section
                    </label>
                 </div>
                 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-10 gap-2 p-3 text-xs">
                    {section.fields.map((field) => (
                      <label
                        key={field.id}
                        className={`flex items-center gap-1.5 px-1.5 py-1 rounded border cursor-pointer select-none transition-all ${
                          isSelected(config.moduleId, field.id) ? "bg-blue-50 border-blue-200 hover:bg-blue-100 shadow-sm" : "bg-white border-gray-200 hover:bg-gray-50 opacity-60 hover:opacity-80"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="accent-blue-600"
                          checked={isSelected(config.moduleId, field.id)}
                          onChange={(e) => toggleField(config.moduleId, field.id, e.target.checked)}
                        />
                        <span className="font-medium truncate text-gray-800 text-[12px] leading-tight" title={field.label}>{field.label}</span>
                      </label>
                    ))}
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
