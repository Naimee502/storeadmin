import { Outlet } from "react-router";
import Header from "../../components/header";
import Footer from "../../components/footer";
import MobileBottomNav from "../../components/mobilebottomnav";
import BusinessPreview from "../../components/businesspreview";
import FullScreenLoader from "../../components/fullscreenloader";
import StoreNotFound from "../../components/storenotfound";
import { CartProvider } from "../../contexts/cart";
import { useTenant } from "../../contexts/tenant";

export default function MainLayout() {
  const tenant = useTenant();

  if (tenant.loading) return <FullScreenLoader />;
  if (tenant.notFound) return <StoreNotFound storeSlug={tenant.storeSlug} />;

  return (
    <CartProvider>
      <div className="flex min-h-screen flex-col bg-white">
        <Header />
        <main className="flex-1 pb-16 lg:pb-0">
          <Outlet />
        </main>
        <Footer />
        <MobileBottomNav />
        {import.meta.env.DEV && <BusinessPreview />}
      </div>
    </CartProvider>
  );
}
