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
      </Routes>
    );
};

export default AppRoutes;