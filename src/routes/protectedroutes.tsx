import { useAuth } from "../contexts/auth";
import { Navigate } from "react-router";

const ProtectedRoutes: React.FC<{ children: React.ReactNode }> = ({ children }) => {
   const { isAuthenticated } = useAuth();
 
   if (!isAuthenticated) {
     return <Navigate to="/login" replace />;
   }
 
   return <>{children}</>;
 };
 
 export default ProtectedRoutes;