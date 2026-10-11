import AppRoutes from "./routes";
import { TenantProvider } from "./contexts/tenant";
import { BusinessSettingsProvider } from "./contexts/businesssettings";
import MainDomainLanding from "./pages/maindomainlanding";
import AccountDeletionPage from "./pages/accountdeletion";

export default function App({
  storeSlug,
  platformPath,
  customDomain,
}: {
  storeSlug: string | null;
  platformPath?: string | null;
  /** Set when the site is opened on a business's own domain (dkmarketing.com). */
  customDomain?: string | null;
}) {
  // Platform-wide pages, rendered OUTSIDE TenantProvider on purpose: they
  // belong to no one business, and every app flavour links to the same one.
  if (platformPath === "account-deletion") return <AccountDeletionPage />;

  // A business's own domain: the whole site IS that store, no /<slug>.
  if (customDomain) {
    return (
      <TenantProvider storeSlug={customDomain} domain={customDomain}>
        <BusinessSettingsProvider>
          <AppRoutes />
        </BusinessSettingsProvider>
      </TenantProvider>
    );
  }

  // Bare domain, no /<storeslug> — not any one business's storefront.
  if (!storeSlug) return <MainDomainLanding />;

  return (
    <TenantProvider storeSlug={storeSlug}>
      <BusinessSettingsProvider>
        <AppRoutes />
      </BusinessSettingsProvider>
    </TenantProvider>
  );
}
