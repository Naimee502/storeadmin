import React, { useState } from 'react';
import Sidebar from '../../components/sidebar';
import Header from '../../components/header';
import { useAuth } from '../../contexts/auth';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { persistor } from '../../redux/store';
import { useBranchesQuery } from '../../graphql/hooks/branches';
import { setBranchId } from '../../redux/slices/branch';

const HomeLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useAppDispatch();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarHovered, setSidebarHovered] = useState(false);
  const { logout } = useAuth();

  const { type, admin, branch } = useAppSelector((state) => state.auth);
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
      <Header
        title={type === 'admin' ? admin?.name : branch?.branchname}
        onMenuClick={toggleSidebar}
        onLogoutClick={handleLogout}
        isAdmin={type === 'branch'}
        branches={branchesList}
        selectedBranchId={selectedBranchId}
        onBranchChange={(id) => {
          setSelectedBranchId(id);
          dispatch(setBranchId(id));
        }}
      />
      <div className="flex flex-1">
        <Sidebar
          isOpen={isSidebarOpen}
          toggleSidebar={toggleSidebar}
          onHoverChange={setSidebarHovered}
        />

        {/* Scrollable content area */}
        <main
          className={`flex-1 pt-[60px] overflow-y-auto transition-all duration-300 ease-in-out ${
            isSidebarHovered ? 'sm:ml-56' : 'sm:ml-14'
          }`}
        >
          <div>{children}</div>
        </main>
      </div>
    </div>
  );
};

export default HomeLayout;
