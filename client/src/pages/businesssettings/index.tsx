import { useEffect, useMemo, useState } from "react";
import HomeLayout from "../../layouts/home";
import loginBg from "../../assets/images/loginbg.jpg";
import FormField from "../../components/formfiled";
import FormSwitch from "../../components/formswitch";
import Button from "../../components/button";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { showMessage } from "../../redux/slices/message";
import { setAllowedModules } from "../../redux/slices/auth";
import { setAdminSettings } from "../../redux/slices/adminsettings";
import {
  useAdminSettingsQuery,
  useAdminSettingsMutations,
  usePermissionsLazy,
  usePermissionsMutations,
} from "../../graphql/hooks/adminsettings";
import { useAdminsQuery, useUpdateAdminMutation } from "../../graphql/hooks/admin";
import {
  MODULES,
  SECTION_LABELS,
  ADMIN_REGISTER_MODULES,
  DEFAULT_ON_MODULE_IDS,
  type ModuleAction,
} from "../../config/modules";

type TabKey = "general" | "modules" | "permissions";

const FEATURE_TO_MODULES: Record<string, string[]> = {
  enableGst: ["reports.gst"],
};

const BusinessSettings = () => {
  const dispatch = useAppDispatch();
  const { type, admin } = useAppSelector((s: any) => s.auth);
  const [selectedAdminId, setSelectedAdminId] = useState<string>("");
  const [tab, setTab] = useState<TabKey>("general");

  const { data: adminsData } = useAdminsQuery();
  const adminOptions = useMemo(() => 
    (adminsData?.getAdmins ?? []).map((a: any) => ({ value: a.id, label: a.companyName || a.name })), 
  [adminsData]);

  // If no manual selection, but we are logged in as admin, default to self
  useEffect(() => {
    if (!selectedAdminId && type === "admin" && admin?.id) {
      setSelectedAdminId(admin.id);
    }
  }, [type, admin, selectedAdminId]);

  const visibleTabs = useMemo<Array<[TabKey, string]>>(() => [
    ["general", "General"],
    ["modules", "Business Modules"],
    ["permissions", "Business Permissions"],
  ], []);

  // Auto-fix current tab if it becomes hidden
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.find(t => t[0] === tab)) {
      setTab(visibleTabs[0][0]);
    }
  }, [visibleTabs, tab]);

  return (
    <HomeLayout hideNav>
      <div 
        className="min-h-screen bg-cover bg-center py-8 px-4"
        style={{ backgroundImage: `url(${loginBg})` }}
      >
        <div className="max-w-[95%] mx-auto bg-white/95 backdrop-blur-sm p-6 rounded-2xl shadow-2xl border border-white/20">
          <h1 className="text-2xl font-bold mb-6 text-gray-800 border-b pb-4">Business Settings</h1>

        <div className="bg-white border rounded-lg p-3 mb-6">
          <FormField
            label="Select Admin / Business"
            type="select"
            name="selectedAdminId"
            value={selectedAdminId}
            onChange={(e: any) => setSelectedAdminId(e.target.value)}
            options={adminOptions}
            searchable
          />
        </div>

        {selectedAdminId ? (
          <>
            {/* Tabs */}
            <div className="flex border-b mb-4 overflow-x-auto">
              {visibleTabs.map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key as TabKey)}
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

            {tab === "general" && (
              <GeneralTab adminId={selectedAdminId} dispatch={dispatch} />
            )}
            {tab === "modules" && (
              <ModulesTab adminId={selectedAdminId} dispatch={dispatch} />
            )}
            {tab === "permissions" && (
              <PermissionsTab
                scope="admin"
                scopeid={selectedAdminId}
                title="Admin defaults — apply to all branches/staff unless overridden"
                dispatch={dispatch}
                parentAllowed={
                  // Use the TARGET admin's allowedmodules so we only show
                  // modules that are actually enabled for this admin.
                  adminsData?.getAdmins?.find((a: any) => a.id === selectedAdminId)?.allowedmodules
                  ?? admin?.allowedmodules
                }
              />
            )}
          </>
        ) : (
          <div className="text-center py-10 bg-white/50 backdrop-blur-sm border rounded-lg text-gray-500">
            Please select an Admin to manage business settings.
          </div>
        )}
        </div>
      </div>
    </HomeLayout>
  );
};

export default BusinessSettings;

// ── Exported for reuse in /settings page when flags are enabled ──
export { GeneralTab as BusinessGeneralTab };
export { ModulesTab as BusinessModulesTab };
export { PermissionsTab as BusinessPermissionsTab };

/* =====================================================================
   GENERAL TAB
   ===================================================================== */

const GeneralTab: React.FC<{ adminId?: string; dispatch: any }> = ({
  adminId,
  dispatch,
}) => {
  const { admin: loggedInAdmin } = useAppSelector((s: any) => s.auth);
  const { data, refetch } = useAdminSettingsQuery(adminId);
  const { updateAdminSettings } = useAdminSettingsMutations();
  const settings = data?.getAdminSettings;
  const [draft, setDraft] = useState<any>(null);

  useEffect(() => {
    if (settings) setDraft({ ...settings });
  }, [settings]);

  if (!draft) return <div className="text-gray-500 text-sm">Loading…</div>;

  const set = (k: string, v: any) => setDraft((d: any) => ({ ...d, [k]: v }));

  const handleSave = async () => {
    if (!adminId) return;
    const { id, adminid, __typename, ...input } = draft;
    try {
      await updateAdminSettings({ variables: { adminid: adminId, input } });
      const { data: updated } = await refetch();
      if (updated?.getAdminSettings && adminId === loggedInAdmin?.id) {
        dispatch(setAdminSettings(updated.getAdminSettings));
      }
      dispatch(showMessage({ message: "Settings saved.", type: "success" }));
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Save failed.", type: "error" }));
    }
  };

  return (
    <div className="space-y-6">
      <Section title="Auto-posting (Tally-style)">
        <div className="text-xs text-gray-400 mb-1 px-1">Sales Invoice</div>
        <Toggle label="Auto-create journal entry on Sales Invoice" checked={draft.autoCreateLedgerOnSalesInvoice} onChange={(v) => set("autoCreateLedgerOnSalesInvoice", v)} />
        <Toggle label="Auto-create payment record on Sales Invoice (cash / bank)" checked={draft.autoCreatePaymentOnSalesInvoice} onChange={(v) => set("autoCreatePaymentOnSalesInvoice", v)} />
        <Toggle label="Auto-deduct stock on Sales Invoice" checked={draft.autoCreateStockOnSalesInvoice} onChange={(v) => set("autoCreateStockOnSalesInvoice", v)} />

        <div className="text-xs text-gray-400 mt-3 mb-1 px-1">Purchase Invoice</div>
        <Toggle label="Auto-create journal entry on Purchase Invoice" checked={draft.autoCreateLedgerOnPurchaseInvoice} onChange={(v) => set("autoCreateLedgerOnPurchaseInvoice", v)} />
        <Toggle label="Auto-create payment record on Purchase Invoice (cash / bank)" checked={draft.autoCreatePaymentOnPurchaseInvoice} onChange={(v) => set("autoCreatePaymentOnPurchaseInvoice", v)} />
        <Toggle label="Auto-add stock on Purchase Invoice" checked={draft.autoCreateStockOnPurchaseInvoice} onChange={(v) => set("autoCreateStockOnPurchaseInvoice", v)} />

        <div className="text-xs text-gray-400 mt-3 mb-1 px-1">Expense Notes</div>
        <Toggle label="Auto-post journal on Expense Notes" checked={draft.autoCreateLedgerOnExpense} onChange={(v) => set("autoCreateLedgerOnExpense", v)} />
        <Toggle label="Auto-create payment record on Expense Notes (cash / bank)" checked={draft.autoCreatePaymentOnExpense} onChange={(v) => set("autoCreatePaymentOnExpense", v)} />

        <div className="text-xs text-gray-400 mt-3 mb-1 px-1">Returns</div>
        <Toggle label="Auto-post journal on Sales Returns" checked={draft.autoCreateLedgerOnSalesReturn} onChange={(v) => set("autoCreateLedgerOnSalesReturn", v)} />
        <Toggle label="Auto-post journal on Purchase Returns" checked={draft.autoCreateLedgerOnPurchaseReturn} onChange={(v) => set("autoCreateLedgerOnPurchaseReturn", v)} />
      </Section>

      <Section title="Feature Toggles">
        <Toggle label="GST tracking enabled" checked={draft.enableGst} onChange={(v) => set("enableGst", v)} />
        <Toggle label="Display Product Prices on App/Website" checked={draft.displayProductPriceOnWebsite} onChange={(v) => set("displayProductPriceOnWebsite", v)} />
        <Toggle label="Encrypt Invoice Prices (Mask actual amounts)" checked={draft.encryptInvoicePrices} onChange={(v) => set("encryptInvoicePrices", v)} />
        <Toggle
          label="Deliver orders via Delivery Boy (off = salesman delivers on route)"
          checked={draft.deliveryMode === "deliveryboy"}
          onChange={(v: boolean) => set("deliveryMode", v ? "deliveryboy" : "salesman")}
        />
        <Toggle
          label="Party manages downline (channel party handles sub-party orders & payments)"
          checked={!!draft.partyManagesDownline}
          onChange={(v: boolean) => set("partyManagesDownline", v)}
        />
        <Toggle
          label="Discount & Commission on Payment settlement (per invoice while collecting)"
          checked={!!draft.enablePaymentDiscountCommission}
          onChange={(v: boolean) => set("enablePaymentDiscountCommission", v)}
        />
      </Section>

      <div className="flex justify-end">
        <Button variant="outline" onClick={handleSave}>Save Business Settings</Button>
      </div>
    </div>
  );
};

const ModulesTab: React.FC<{ adminId?: string; dispatch: any }> = ({
  adminId,
  dispatch,
}) => {
  const { admin: loggedInAdmin } = useAppSelector((s: any) => s.auth);
  const { data: adminsData } = useAdminsQuery();
  const targetAdmin = useMemo(() => adminsData?.getAdmins?.find((a: any) => a.id === adminId), [adminsData, adminId]);

  const { data: settingsData } = useAdminSettingsQuery(adminId);
  const settings = settingsData?.getAdminSettings;
  const [updateAdmin] = useUpdateAdminMutation();

  const myAllowed = loggedInAdmin?.allowedmodules;

  const eligibleModules = useMemo(() => {
    // If myAllowed is null/undefined, show all. If empty [], show nothing.
    if (myAllowed === undefined || myAllowed === null) return ADMIN_REGISTER_MODULES;
    return ADMIN_REGISTER_MODULES.filter(m =>
      DEFAULT_ON_MODULE_IDS.includes(m.id.toLowerCase()) ||
      myAllowed.map(id => id.toLowerCase()).includes(m.id.toLowerCase())
    );
  }, [myAllowed]);

  const allCatalogIds = useMemo(() => eligibleModules.map((m: any) => m.id), [eligibleModules]);
  const [draft, setDraft] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (Array.isArray(targetAdmin?.allowedmodules) && targetAdmin.allowedmodules.length > 0) {
      setDraft(targetAdmin.allowedmodules);
    } else {
      setDraft(allCatalogIds);
    }
  }, [targetAdmin?.allowedmodules, allCatalogIds]);

  const featureDisabledIds = useMemo(() => {
    if (!settings) return new Set<string>();
    const out = new Set<string>();
    Object.entries(FEATURE_TO_MODULES).forEach(([flag, ids]) => {
      if (settings[flag] === false) ids.forEach((id) => out.add(id));
    });
    return out;
  }, [settings]);

  const toggleOne = (id: string) => {
    setDirty(true);
    setDraft((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    if (!adminId) return;
    try {
      const cleaned = draft.filter((id) => !featureDisabledIds.has(id));
      await updateAdmin({ variables: { id: adminId, input: { allowedmodules: cleaned } } });
      if (adminId === loggedInAdmin?.id) {
        dispatch(setAllowedModules(cleaned));
      }
      setDirty(false);
      dispatch(showMessage({ message: "Business modules updated.", type: "success" }));
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Save failed.", type: "error" }));
    }
  };

  const grouped = useMemo(() => {
    const map: Record<string, typeof ADMIN_REGISTER_MODULES> = {};
    eligibleModules.forEach((m) => { (map[m.section] ||= [] as any).push(m); });
    return map;
  }, [eligibleModules]);

  return (
    <div className="space-y-4">
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
            {items.map((m: any) => {
              const featureOff = featureDisabledIds.has(m.id);
              const enabled = !featureOff && draft.includes(m.id);
              return (
                <label key={m.id} className={`flex items-center gap-2 px-2 py-1 rounded border ${featureOff ? "bg-gray-100 text-gray-400" : enabled ? "bg-blue-50 border-blue-200" : "bg-white border-gray-200"}`}>
                  <input type="checkbox" disabled={featureOff} checked={enabled} onChange={() => toggleOne(m.id)} />
                  <span className="font-medium truncate">{m.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
      <div className="flex justify-end">
        <Button variant="outline" onClick={handleSave} disabled={!dirty}>Save Business Modules</Button>
      </div>
    </div>
  );
};

const PermissionsTab: React.FC<{
  scope: "admin";
  scopeid?: string;
  title: string;
  dispatch: any;
  parentAllowed?: string[];
}> = ({ scope, scopeid, title, dispatch, parentAllowed }) => {
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
      list = list.filter(m =>
        DEFAULT_ON_MODULE_IDS.includes(m.id.toLowerCase()) ||
        parentAllowed.map(id => id.toLowerCase()).includes(m.id.toLowerCase())
      );
    }
    return list;
  }, [parentAllowed]);

  if (!scopeid || loading || !draft) return <div className="text-sm text-gray-500">Loading…</div>;

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
                  checked={items.every(m => 
                    m.actions.every(a => !!draft?.[m.id]?.[a])
                  )}
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
        <Button variant="outline" onClick={handleSave}>Save Business Permissions</Button>
      </div>
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
