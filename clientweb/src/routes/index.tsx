import { Route, Routes } from "react-router";
import MainLayout from "../layouts/main";
import HomePage from "../pages/home";
import ShopPage from "../pages/shop";
import ProductDetailPage from "../pages/productdetail";
import CartPage from "../pages/cart";
import CheckoutPage from "../pages/checkout";
import LoginPage from "../pages/login";
import AccountPage from "../pages/account";
import AboutPage from "../pages/about";
import PrivacyPage from "../pages/privacy";
import TermsPage from "../pages/terms";

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/product/:id" element={<ProductDetailPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
      </Route>
    </Routes>
  );
}
