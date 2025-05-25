import { useAuth } from "../contexts/auth";
import { Navigate } from "react-router";

const PublicRoutes: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated } = useAuth();
  
    if (isAuthenticated) {
      return <Navigate to="/home" replace />;
    }
  
    return <>{children}</>;
  };
  
  export default PublicRoutes;