import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/sidebar';
import Header from '../../components/header';
import { FormDensityContext } from '../../components/formpage/density';
import { useAuth } from '../../contexts/auth';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { persistor } from '../../redux/store';
import { useBranchesQuery } from '../../graphql/hooks/branches';
import { setBranchId, clearBranchId } from '../../redux/slices/branch';
import { useEffectivePermissionsLazy, useAdminSettingsQuery } from '../../graphql/hooks/adminsettings';
import { setPermissions } from '../../redux/slices/permissions';
import { setAdminSettings } from '../../redux/slices/adminsettings';
import OfflineStatusBar from '../../offline/OfflineStatusBar';
import { offlineOnLogout } from '../../offline/boot';

const HomeLayout: React.FC<{ children: React.ReactNode; hideNav?: boolean }> = ({ children, hideNav }) => {
  const dispatch = useAppDispatch();
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  // Hover widens the menu over the page without reflowing it.
  const [, setSidebarHovered] = useState(false);
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
  /** The dropdown shows the Redux branch value, the same one pages send. */
  const selectedBranchId = useAppSelector((state: any) => state.selectedBranch?.branchId || "");

  const { data } = useBranchesQuery();
  const branchesList = data?.getBranches || [];

  /** Follow branch changes made in another tab. */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "branchid") return;
      const next = e.newValue || "";
      if (next !== selectedBranchId) dispatch(setBranchId(next));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [selectedBranchId, dispatch]);

  /** Drop a saved branch no longer in this admin's list; nothing is auto-selected. */
  useEffect(() => {
    if (type !== "admin" || !data?.getBranches) return;
    const ids = branchesList.map((b: any) => b.id);
    if (selectedBranchId && !ids.includes(selectedBranchId)) {
      dispatch(setBranchId(""));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, data, selectedBranchId]);

  const toggleSidebar = () => setSidebarOpen(prev => !prev);

  const handleLogout = () => {
    // No-op unless offline mode is on; must run before the session keys go.
    offlineOnLogout();
    // Clears the Redux value and the "branchid" key together.
    dispatch(clearBranchId());
    dispatch({ type: 'LOGOUT' });
    persistor.purge();
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
          onBranchChange={(id) => dispatch(setBranchId(id))}
        />
      )}
      <div className="flex flex-1">
        {!hideNav && (
          <Sidebar
            isOpen={isSidebarOpen}
            toggleSidebar={toggleSidebar}
            onLogoutClick={handleLogout}
            onHoverChange={setSidebarHovered}
          />
        )}

        {/* Scrollable content area */}
        <main
          className={`flex-1 overflow-y-auto transition-all duration-300 ease-in-out ${
            !hideNav ? (isSidebarOpen ? 'sm:ml-60 pt-12' : 'sm:ml-14 pt-12') : ''
          }`}
        >
          {/* Compact density for all forms in the panel. */}
          <FormDensityContext.Provider value="compact">
            <div>{children}</div>
          </FormDensityContext.Provider>
        </main>
      </div>
      <OfflineStatusBar />
    </div>
  );
};

export default HomeLayout;
