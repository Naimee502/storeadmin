import AppRoutes from "./routes";
import { TenantProvider } from "./contexts/tenant";
import { BusinessSettingsProvider } from "./contexts/businesssettings";
import MainDomainLanding from "./pages/maindomainlanding";

export default function App({ storeSlug }: { storeSlug: string | null }) {
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
