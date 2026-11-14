import { Navigate, Outlet, Route, Routes } from "react-router";
import { useAuth } from "../contexts/auth";
import { useSupplier } from "../hooks/useSupplier";
import type { ReactNode } from "react";
import { usePaymentsEnabled } from "../hooks/useModuleEnabled";
import MainLayout from "../layouts/main";
import HomePage from "../pages/home";
import ShopPage from "../pages/shop";
import ProductDetailPage from "../pages/productdetail";
import CartPage from "../pages/cart";
import CheckoutPage from "../pages/checkout";
import LoginPage from "../pages/login";
import AccountPage from "../pages/account";
import OrderDetailPage from "../pages/orderdetail";
import OrderEditPage from "../pages/orderedit";
import PartyPaymentsPage from "../pages/partypayments";
import CollectPaymentPage from "../pages/collectpayment";
import NotificationsPage from "../pages/notifications";
import AnnouncementsPage from "../pages/announcements";
import AboutPage from "../pages/about";
import PrivacyPage from "../pages/privacy";
import TermsPage from "../pages/terms";
import BookPage from "../pages/book";
import MyBookingsPage from "../pages/mybookings";
import SupplierPage from "../pages/supplier";
import SupplierDocumentPage from "../pages/supplier/document";
import { MyTicketPage, MyTicketsPage } from "../pages/myservice/tickets";
import { MyRepairPage, MyRepairsPage } from "../pages/myservice/repairs";
import { MyContractsPage, MyMembershipsPage } from "../pages/myservice/plans";

// Payment pages exist only while the business has the Payments module on — a
// bookmarked or typed URL lands back on My Account instead.
function PaymentsOnly({ children }: { children: ReactNode }) {
  return usePaymentsEnabled() ? <>{children}</> : <Navigate to="/account" replace />;
}

// A signed-in supplier uses only the supplier portal; shop pages send them there.
function ShopOnly() {
  const { isLoggedIn } = useAuth();
  const supplier = useSupplier();
  return supplier.signedIn && !isLoggedIn ? <Navigate to="/supplier" replace /> : <Outlet />;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route element={<ShopOnly />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/product/:id" element={<ProductDetailPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/account/orders/:id" element={<OrderDetailPage />} />
          <Route path="/account/orders/:id/edit" element={<OrderEditPage />} />
          <Route path="/account/parties/:id/payments" element={<PaymentsOnly><PartyPaymentsPage /></PaymentsOnly>} />
          <Route path="/account/parties/:id/collect" element={<PaymentsOnly><CollectPaymentPage /></PaymentsOnly>} />
          <Route path="/account/notifications" element={<NotificationsPage />} />
          <Route path="/account/announcements" element={<AnnouncementsPage />} />
          <Route path="/book" element={<BookPage />} />
          <Route path="/account/bookings" element={<MyBookingsPage />} />
          <Route path="/account/tickets" element={<MyTicketsPage />} />
          <Route path="/account/tickets/:id" element={<MyTicketPage />} />
          <Route path="/account/repairs" element={<MyRepairsPage />} />
          <Route path="/account/repairs/:id" element={<MyRepairPage />} />
          <Route path="/account/amc" element={<MyContractsPage />} />
          <Route path="/account/memberships" element={<MyMembershipsPage />} />
        </Route>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/supplier" element={<SupplierPage />} />
        <Route path="/supplier/:kind/:id" element={<SupplierDocumentPage />} />
      </Route>
    </Routes>
  );
}
