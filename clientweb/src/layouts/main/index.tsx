import { Outlet, useLocation } from "react-router";
import Header from "../../components/header";
import Footer from "../../components/footer";
import MobileBottomNav from "../../components/mobilebottomnav";
import FullScreenLoader from "../../components/fullscreenloader";
import StoreNotFound from "../../components/storenotfound";
import { CartProvider } from "../../contexts/cart";
import { AuthProvider } from "../../contexts/auth";
import { useTenant } from "../../contexts/tenant";
import ScreenWatermark from "../../components/screenwatermark";
import ScrollToTop from "../../components/scrolltotop";
import OrderForBanner from "../../components/orderforbanner";
import WhatsAppChat from "../../components/whatsappchat";

export default function MainLayout() {
  const tenant = useTenant();
  const { pathname } = useLocation();
  // The product page renders its own WhatsApp button carrying that product's
  // name and link, so the general one steps aside there.
  const onProductPage = /\/product\/[^/]+\/?$/.test(pathname);

  if (tenant.loading) return <FullScreenLoader />;
  if (tenant.notFound) return <StoreNotFound storeSlug={tenant.storeSlug} />;

  return (
    <AuthProvider storeSlug={tenant.storeSlug}>
      <CartProvider storeSlug={tenant.storeSlug}>
        <div className="flex min-h-screen flex-col bg-white">
          <ScrollToTop />
          <Header />
          <OrderForBanner />
          <main className="flex-1 pb-16 lg:pb-0">
            <Outlet />
          </main>
          <Footer />
          <MobileBottomNav />
          {!onProductPage && <WhatsAppChat />}
          {/* Inside AuthProvider so a logged-in party is named in the
              watermark. Renders nothing unless the setting is on. */}
          <ScreenWatermark />
        </div>
      </CartProvider>
    </AuthProvider>
  );
}
