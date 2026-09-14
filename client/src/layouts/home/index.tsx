import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/sidebar';
import Header from '../../components/header';
import { useAuth } from '../../contexts/auth';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { persistor } from '../../redux/store';
import { useBranchesQuery } from '../../graphql/hooks/branches';
import { setBranchId, clearBranchId } from '../../redux/slices/branch';
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
  /**
   * The dropdown shows the SAME value the pages send — Redux — never a second
   * copy of its own. It used to keep its own useState seeded from localStorage,
   * which is how it ended up displaying a branch name while Redux held "" and
   * the payment went out as branchid: "".
   */
  const selectedBranchId = useAppSelector((state: any) => state.selectedBranch?.branchId || "");

  const { data } = useBranchesQuery();
  const branchesList = data?.getBranches || [];

  /**
   * Another tab changed the branch → follow it.
   *
   * localStorage is shared across tabs, so two tabs used to drift apart and
   * whichever wrote last decided what the next reload saw. The `storage` event
   * only fires in the OTHER tabs, which is exactly what we want: every open tab
   * converges on the branch the user just picked.
   */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "branchid") return;
      const next = e.newValue || "";
      if (next !== selectedBranchId) dispatch(setBranchId(next));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [selectedBranchId, dispatch]);

  /**
   * Drop a saved branch that is not in this admin's list any more — deleted, or
   * left over from a different account — so the header can never show a branch
   * the server would reject.
   *
   * Nothing else is chosen on the user's behalf. Auto-selecting the only branch
   * of a single-branch business was tried and removed: it made "All Branches"
   * impossible to pick, because every attempt snapped straight back. An empty
   * branch is a legitimate choice for browsing; the save paths each say so with
   * a message (see utils/branch) when a document actually needs one.
   */
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
    // clearBranchId wipes the Redux value AND the "branchid" key together —
    // removing the key by hand used to leave the two out of step for whoever
    // logged in next.
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
