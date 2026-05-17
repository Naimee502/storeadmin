import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/sidebar';
import Header from '../../components/header';
import { useAuth } from '../../contexts/auth';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { persistor } from '../../redux/store';
import { useBranchesQuery } from '../../graphql/hooks/branches';
import { setBranchId } from '../../redux/slices/branch';
import { useEffectivePermissionsLazy, useAdminSettingsQuery } from '../../graphql/hooks/adminsettings';
import { setPermissions } from '../../redux/slices/permissions';
import { setAdminSettings } from '../../redux/slices/adminsettings';

const HomeLayout: React.FC<{ children: React.ReactNode; hideNav?: boolean }> = ({ children, hideNav }) => {
  const dispatch = useAppDispatch();
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isSidebarHovered, setSidebarHovered] = useState(false);
  const { logout } = useAuth();

  const { type, admin, branch, staff } = useAppSelector((state: any) => state.auth);
  const [loadPermissions, { data: permData }] = useEffectivePermissionsLazy({
    fetchPolicy: "network-only",
  });

  // Permission Bootstrap
  useEffect(() => {
    const scopeid =
      type === "admin"
        ? admin?.id
        : type === "branch"
          ? branch?.id
          : type === "staff"
            ? staff?.id
            : undefined;
    if (scopeid && type) {
      loadPermissions({ variables: { scope: type, scopeid } });
    }
  }, [type, admin, branch, staff, loadPermissions]);

  useEffect(() => {
    if (permData?.getEffectivePermissions) {
      dispatch(setPermissions(permData.getEffectivePermissions.permissions || {}));
    }
  }, [permData, dispatch]);
  
  const { data: settingsData } = useAdminSettingsQuery();
  useEffect(() => {
    if (settingsData?.getAdminSettings) {
      dispatch(setAdminSettings(settingsData.getAdminSettings));
    }
  }, [settingsData, dispatch]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(localStorage.getItem("branchid") || "");
  const { data } = useBranchesQuery();
  const branchesList = data?.getBranches || [];

  const toggleSidebar = () => setSidebarOpen(prev => !prev);

  const handleLogout = () => {
    dispatch({ type: 'LOGOUT' });
    persistor.purge();
    localStorage.removeItem('branchid');
    logout();
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 overflow-hidden">
      {!hideNav && (
        <Header
          title={type === 'admin' ? admin?.name : type === 'branch' ? branch?.branchname : staff?.name}
          onMenuClick={toggleSidebar}
          onLogoutClick={handleLogout}
          isAdmin={type === 'branch' || type === 'staff'}
          branches={branchesList}
          selectedBranchId={selectedBranchId}
          onBranchChange={(id) => {
            setSelectedBranchId(id);
            dispatch(setBranchId(id));
          }}
        />
      )}
      <div className="flex flex-1">
        {!hideNav && (
          <Sidebar
            isOpen={isSidebarOpen}
            toggleSidebar={toggleSidebar}
            onHoverChange={setSidebarHovered}
          />
        )}

        {/* Scrollable content area */}
        <main
          className={`flex-1 overflow-y-auto transition-all duration-300 ease-in-out ${
            !hideNav ? ((isSidebarOpen || isSidebarHovered) ? 'sm:ml-64 pt-[60px]' : 'sm:ml-16 pt-[60px]') : ''
          }`}
        >
          <div>{children}</div>
        </main>
      </div>
    </div>
  );
};

export default HomeLayout;
