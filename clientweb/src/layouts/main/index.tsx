import { Outlet } from "react-router";
import Header from "../../components/header";
import Footer from "../../components/footer";
import MobileBottomNav from "../../components/mobilebottomnav";
import BusinessPreview from "../../components/businesspreview";
import FullScreenLoader from "../../components/fullscreenloader";
import StoreNotFound from "../../components/storenotfound";
import { CartProvider } from "../../contexts/cart";
import { AuthProvider } from "../../contexts/auth";
import { useTenant } from "../../contexts/tenant";
import ScreenWatermark from "../../components/screenwatermark";

export default function MainLayout() {
  const tenant = useTenant();

  if (tenant.loading) return <FullScreenLoader />;
  if (tenant.notFound) return <StoreNotFound storeSlug={tenant.storeSlug} />;

  return (
    <AuthProvider storeSlug={tenant.storeSlug}>
      <CartProvider storeSlug={tenant.storeSlug}>
        <div className="flex min-h-screen flex-col bg-white">
          <Header />
          <main className="flex-1 pb-16 lg:pb-0">
            <Outlet />
          </main>
          <Footer />
          <MobileBottomNav />
          {import.meta.env.DEV && <BusinessPreview />}
          {/* Inside AuthProvider so a logged-in party is named in the
              watermark. Renders nothing unless the setting is on. */}
          <ScreenWatermark />
        </div>
      </CartProvider>
    </AuthProvider>
  );
}
