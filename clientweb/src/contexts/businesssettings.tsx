import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTenant } from "./tenant";

interface BusinessSettingsContextValue {
  codOnly: boolean;
  setCodOnly: (v: boolean) => void;
}

const BusinessSettingsContext = createContext<BusinessSettingsContextValue | null>(null);

// Seeds from the real tenant (fetched via storeslug in TenantProvider) but
// still allows a local override — that's what powers the dev-only
// BusinessPreview panel, letting you flip COD-only without needing a second
// real business set up.
export function BusinessSettingsProvider({ children }: { children: ReactNode }) {
  const tenant = useTenant();
  const [override, setOverride] = useState<{ codOnly?: boolean }>({});

  // Drop any local override when the resolved tenant changes (new store),
  // so a preview tweak on one store doesn't leak into another.
  useEffect(() => setOverride({}), [tenant.adminid]);

  const value = useMemo<BusinessSettingsContextValue>(
    () => ({
      codOnly: override.codOnly ?? tenant.codOnly,
      setCodOnly: (v) => setOverride((o) => ({ ...o, codOnly: v })),
    }),
    [tenant.codOnly, override]
  );

  return <BusinessSettingsContext.Provider value={value}>{children}</BusinessSettingsContext.Provider>;
}

export function useBusinessSettings() {
  const ctx = useContext(BusinessSettingsContext);
  if (!ctx) throw new Error("useBusinessSettings must be used within BusinessSettingsProvider");
  return ctx;
}
