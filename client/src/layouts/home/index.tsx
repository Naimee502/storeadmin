import React, { useEffect, useState } from 'react';
import Sidebar from '../../components/sidebar';
import Header from '../../components/header';
import { useAuth } from '../../contexts/auth';
import { useAppDispatch } from '../../redux/hooks';
import { persistor } from '../../redux/store';

const HomeLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useAppDispatch()
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const { logout } = useAuth();

  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev);
  };
  
  const handleLogout = () => {
    dispatch({ type: 'LOGOUT' });
    persistor.purge();
    localStorage.removeItem('branchid');
    logout();
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <Header onMenuClick={toggleSidebar} onLogoutClick={handleLogout} />
      <div className="flex flex-1">
        <Sidebar isOpen={isSidebarOpen} />
        <main className={`transition-all ease-in-out flex-1 pt-[50px] overflow-y-auto ${isSidebarOpen ? 'pl-[250px]' : 'pl-[6px]'}`}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default HomeLayout;
