import { Navigate, Route, Routes } from "react-router";
import PublicRoutes from "./publicroute";
import ProtectedRoutes from "./protectedroutes";
import Login from "../pages/login";
import Home from "../pages/home";
import Profile from "../pages/profile";
import Settings from "../pages/settings";
import ForgotPassword from "../pages/forgotpassword";
import Branches from "../pages/branches";
import AddEditBranch from "../pages/branches/addedit";
import Categories from "../pages/categories";
import Sizes from "../pages/sizes";
import Brands from "../pages/brands";
import Models from "../pages/models";
import ProductGroups from "../pages/productgroups";
import AccountGroups from "../pages/accountgroups";
import Accounts from "../pages/accounts";
import Units from "../pages/units";
import SalesmenAccount from "../pages/salesmenaccount";
import Products from "../pages/products";
import AddEditProduct from "../pages/products/addedit";
import SalesInvoices from "../pages/salesinvoice";
import AddEditSalesInvoice from "../pages/salesinvoice/addedit";

const AppRoutes = () => {
    return (
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route
          path="/login"
          element={
            <PublicRoutes>
              <Login />
            </PublicRoutes>
          }
        />
        <Route
          path="/forgotpassword"
          element={
            <PublicRoutes>
              <ForgotPassword />
            </PublicRoutes>
          }
        />
        <Route
          path="/home"
          element={
            <ProtectedRoutes>
              <Home />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoutes>
              <Profile />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoutes>
              <Settings />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/branches"
          element={
            <ProtectedRoutes>
              <Branches />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/branches/addedit"
          element={
            <ProtectedRoutes>
              <AddEditBranch />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/branches/addedit/:id"
          element={
            <ProtectedRoutes>
              <AddEditBranch />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/categories"
          element={
            <ProtectedRoutes>
              <Categories />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/sizes"
          element={
            <ProtectedRoutes>
              <Sizes />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/brands"
          element={
            <ProtectedRoutes>
              <Brands />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/models"
          element={
            <ProtectedRoutes>
              <Models />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/productgroups"
          element={
            <ProtectedRoutes>
              <ProductGroups />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/units"
          element={
            <ProtectedRoutes>
              <Units />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/accountgroups"
          element={
            <ProtectedRoutes>
              <AccountGroups />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/accounts"
          element={
            <ProtectedRoutes>
              <Accounts />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/salesmenaccount"
          element={
            <ProtectedRoutes>
              <SalesmenAccount />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoutes>
              <Products />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/products/addedit"
          element={
            <ProtectedRoutes>
              <AddEditProduct />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/products/addedit/:id"
          element={
            <ProtectedRoutes>
              <AddEditProduct />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/salesinvoice"
          element={
            <ProtectedRoutes>
              <SalesInvoices />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/salesinvoice/addedit"
          element={
            <ProtectedRoutes>
              <AddEditSalesInvoice />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/salesinvoice/addedit/:id"
          element={
            <ProtectedRoutes>
              <AddEditSalesInvoice />
            </ProtectedRoutes>
          }
        />
      </Routes>
    );
};

export default AppRoutes;