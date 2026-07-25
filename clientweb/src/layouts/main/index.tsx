import { Outlet } from "react-router";
import Header from "../../components/header";
import Footer from "../../components/footer";
import MobileBottomNav from "../../components/mobilebottomnav";
import { CartProvider } from "../../contexts/cart";

export default function MainLayout() {
  return (
    <CartProvider>
      <div className="flex min-h-screen flex-col bg-white">
        <Header />
        <main className="flex-1 pb-16 lg:pb-0">
          <Outlet />
        </main>
        <Footer />
        <MobileBottomNav />
      </div>
    </CartProvider>
  );
}
