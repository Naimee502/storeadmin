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
import PurchaseInvoices from "../pages/purchaseinvoice";
import AddEditPurchaseInvoice from "../pages/purchaseinvoice/addedit";
import TransferStock from "../pages/transferstock";
import DeletedAccountGroups from "../pages/accountgroups/deletedentries";
import DeletedAccounts from "../pages/accounts/deletedentries";
import DeletedBranches from "../pages/branches/deletedentries";
import DeletedBrands from "../pages/brands/deletedentries";
import DeletedCategories from "../pages/categories/deletedentries";
import DeletedModels from "../pages/models/deletedentries";
import DeletedProductGroups from "../pages/productgroups/deletedentries";
import DeletedSizes from "../pages/sizes/deletedentries";
import DeletedUnits from "../pages/units/deletedentries";
import DeletedProducts from "../pages/products/deletedentries";
import DeletedSalesmenAccounts from "../pages/salesmenaccount/deletedentries";
import DeletedTransferStocks from "../pages/transferstock/deletedentries";
import DeletedSalesInvoices from "../pages/salesinvoice/deletedentries";
import DeletedPurchaseInvoices from "../pages/purchaseinvoice/deletedentries";
import AdminRegister from "../pages/adminregister";
import Subscription from "../pages/subscription";
import SubscriptionReview from "../pages/subscriptionreview";
import AddEditAccount from "../pages/accounts/addedit";
import AdminList from "../pages/adminregister/list";
import DeletedAdmins from "../pages/adminregister/deletedentries";
import SubCategories from "../pages/subcategories";
import DeletedSubCategories from "../pages/subcategories/deletedentries";
import Transaction from "../pages/transactions";
import AddEditTransaction from "../pages/transactions/addedit";
import DeletedTransactions from "../pages/transactions/deletedentries";
import Payment from "../pages/payments";
import AddEditPayment from "../pages/payments/addedit";
import DeletedPayments from "../pages/payments/deletedentries";

const AppRoutes = () => {
    return (
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route
          path="/adminregister"
          element={
            <PublicRoutes>
              <AdminRegister />
            </PublicRoutes>
          }
        />
        <Route
          path="/adminregister/list"
          element={
            <PublicRoutes>
              <AdminList />
            </PublicRoutes>
          }
        />
        <Route
          path="/adminregister/deletedentries"
          element={
            <PublicRoutes>
              <DeletedAdmins />
            </PublicRoutes>
          }
        />
        <Route
          path="/subscription"
          element={
            <PublicRoutes>
              <Subscription />
            </PublicRoutes>
          }
        />
        <Route
          path="/subscriptionreview"
          element={
            <PublicRoutes>
              <SubscriptionReview />
            </PublicRoutes>
          }
        />
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
          path="/branches/deletedentries"
          element={
            <ProtectedRoutes>
              <DeletedBranches />
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
          path="/categories/deletedentries"
          element={
            <ProtectedRoutes>
              <DeletedCategories />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/subcategories"
          element={
            <ProtectedRoutes>
              <SubCategories />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/subcategories/deletedentries"
          element={
            <ProtectedRoutes>
              <DeletedSubCategories />
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
          path="/sizes/deletedentries"
          element={
            <ProtectedRoutes>
              <DeletedSizes />
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
          path="/brands/deletedentries"
          element={
            <ProtectedRoutes>
              <DeletedBrands />
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
          path="/models/deletedentries"
          element={
            <ProtectedRoutes>
              <DeletedModels />
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
          path="/productgroups/deletedentries"
          element={
            <ProtectedRoutes>
              <DeletedProductGroups />
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
          path="/units/deletedentries"
          element={
            <ProtectedRoutes>
              <DeletedUnits />
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
          path="/accountgroups/deletedentries"
          element={
            <ProtectedRoutes>
              <DeletedAccountGroups />
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
          path="/accounts/addedit"
          element={
            <ProtectedRoutes>
              <AddEditAccount />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/accounts/addedit/:id"
          element={
            <ProtectedRoutes>
              <AddEditAccount />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/accounts/deletedentries"
          element={
            <ProtectedRoutes>
              <DeletedAccounts />
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
          path="/salesmenaccount/deletedentries"
          element={
            <ProtectedRoutes>
              <DeletedSalesmenAccounts />
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
          path="/products/deletedentries"
          element={
            <ProtectedRoutes>
              <DeletedProducts />
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
          path="/salesinvoice/deletedentries"
          element={
            <ProtectedRoutes>
              <DeletedSalesInvoices />
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
        <Route
          path="/purchaseinvoice"
          element={
            <ProtectedRoutes>
              <PurchaseInvoices />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/purchaseinvoice/deletedentries"
          element={
            <ProtectedRoutes>
              <DeletedPurchaseInvoices />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/purchaseinvoice/addedit"
          element={
            <ProtectedRoutes>
              <AddEditPurchaseInvoice />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/purchaseinvoice/addedit/:id"
          element={
            <ProtectedRoutes>
              <AddEditPurchaseInvoice />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/transferstock"
          element={
            <ProtectedRoutes>
              <TransferStock />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/transferstock/deletedentries"
          element={
            <ProtectedRoutes>
              <DeletedTransferStocks />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/transactions"
          element={
            <ProtectedRoutes>
              <Transaction />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/transactions/addedit"
          element={
            <ProtectedRoutes>
              <AddEditTransaction />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/transactions/addedit/:id"
          element={
            <ProtectedRoutes>
              <AddEditTransaction />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/transactions/deletedentries"
          element={
            <ProtectedRoutes>
              <DeletedTransactions />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/payments"
          element={
            <ProtectedRoutes>
              <Payment />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/payments/addedit"
          element={
            <ProtectedRoutes>
              <AddEditPayment />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/payments/addedit/:id"
          element={
            <ProtectedRoutes>
              <AddEditPayment />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/payments/deletedentries"
          element={
            <ProtectedRoutes>
              <DeletedPayments />
            </ProtectedRoutes>
          }
        />
      </Routes>
    );
};

export default AppRoutes;