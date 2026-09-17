import AppRoutes from "./routes";
import { TenantProvider } from "./contexts/tenant";
import { BusinessSettingsProvider } from "./contexts/businesssettings";
import MainDomainLanding from "./pages/maindomainlanding";
import AccountDeletionPage from "./pages/accountdeletion";

export default function App({
  storeSlug,
  platformPath,
}: {
  storeSlug: string | null;
  platformPath?: string | null;
}) {
  // Platform-wide pages, rendered OUTSIDE TenantProvider on purpose: they
  // belong to no one business, and every app flavour links to the same one.
  if (platformPath === "account-deletion") return <AccountDeletionPage />;

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
