import React, { useMemo } from 'react';
import {
  FaBars,
  FaBuilding,
  FaCashRegister,
  FaChevronDown,
  FaSignOutAlt,
  FaTachometerAlt,
} from 'react-icons/fa';
import { Menu } from '@headlessui/react';
import { useNavigate } from 'react-router';
import { useAppSelector } from '../../redux/hooks';
import NotificationBell from '../notificationbell';

interface Branch {
  id: string;
  branchname: string;
}

interface HeaderProps {
  onMenuClick?: () => void;
  onLogoutClick?: () => void;
  title?: string;
  isAdmin?: boolean;
  branches?: Branch[];
  selectedBranchId?: string;
  onBranchChange?: (id: string) => void;
}

const Header: React.FC<HeaderProps> = ({
  onMenuClick,
  onLogoutClick,
  title = 'Dashboard',
  isAdmin = false,
  branches = [],
  selectedBranchId,
  onBranchChange,
}) => {
  const navigate = useNavigate();
  const selectedBranch = branches.find((b) => b.id === selectedBranchId);

  const { type, admin, branch, staff } = useAppSelector((state: any) => state.auth);

  const businessAllowed = admin?.allowedmodules;
  const role = type?.toString().toLowerCase();

  const localAllowed =
    role === "admin"
      ? businessAllowed
      : role === "branch"
        ? branch?.allowedmodules
        : role === "staff"
          ? staff?.allowedmodules
          : undefined;

  const isPosAllowed = useMemo(() => {
    const moduleId = "posdashboard";

    // 1. Business Level (SaaS)
    if (businessAllowed && Array.isArray(businessAllowed)) {
      if (!businessAllowed.map((m: any) => m.toString().toLowerCase()).includes(moduleId.toLowerCase())) return false;
    }

    // 2. Local Level
    if (localAllowed && Array.isArray(localAllowed)) {
      if (!localAllowed.map((m: any) => m.toString().toLowerCase()).includes(moduleId.toLowerCase())) return false;
    }

    return true;
  }, [businessAllowed, localAllowed]);

  return (
    <header className="fixed top-0 left-0 right-0 h-[60px] bg-slate-950 border-b border-slate-800 text-white flex items-center px-4 z-[1000] shadow-md">
      {/* Menu Button */}
      {onMenuClick && (
        <button
          className="mr-3 sm:mr-5 p-2 rounded-md bg-transparent hover:bg-slate-800 text-white transition-colors cursor-pointer"
          onClick={onMenuClick}
          aria-label="Toggle sidebar"
        >
          <FaBars className="text-cyan-400 text-xl sm:text-2xl transition-transform hover:scale-110" />
        </button>
      )}

      {/* Title */}
      <h3 className="text-sm sm:text-base font-extrabold tracking-wide truncate max-w-[150px] sm:max-w-[300px] md:max-w-none text-white">
        {title}
      </h3>

      {/* Right-side controls */}
      <div className="ml-auto flex items-center gap-3 sm:gap-5">
        {/* System notifications */}
        <NotificationBell />

        {isPosAllowed && (
          <button
            onClick={() => navigate('/posdashboard')}
            className="p-2 rounded-md hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 shadow-sm"
            title="POS Dashboard"
          >
            <FaCashRegister className="text-emerald-400 text-base" />
            <span className="hidden sm:inline text-xs font-bold text-emerald-400">POS</span>
          </button>
        )}

        {/* Branch Dropdown */}
        {!isAdmin && (
          <select
            className="text-white bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs sm:text-sm font-medium focus:outline-none focus:border-cyan-400 shadow-sm"
            value={selectedBranchId}
            onChange={(e) => onBranchChange?.(e.target.value)}
          >
            <option value="">All Branches</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.branchname}
              </option>
            ))}
          </select>
        )}

        {/* Profile Dropdown */}
        <Menu as="div" className="relative inline-block text-left">
          <Menu.Button className="flex items-center px-2 py-2 hover:bg-slate-800 rounded-md transition-colors cursor-pointer">
            <FaChevronDown className="text-cyan-400 text-sm sm:text-base" />
          </Menu.Button>

          <Menu.Items className="absolute right-2 sm:right-0 mt-2 w-48 origin-top-right bg-white divide-y divide-gray-100 rounded-md shadow-lg ring-1 ring-black/5 focus:outline-none z-50 text-sm">
            {/* Branch/Admin Name */}
            <div className="px-3 py-2 flex items-center gap-2 text-gray-700 text-xs sm:text-sm font-semibold bg-gray-50 rounded-t-md border-b">
              <FaBuilding className="text-cyan-600 text-sm flex-shrink-0" />
              <span className="truncate">{selectedBranch?.branchname || (isAdmin ? "Business" : "Admin")}</span>
            </div>

            {/* Logout */}
            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={onLogoutClick}
                  className={`${active ? 'bg-rose-50' : ''} w-full text-left px-3 py-2.5 text-xs sm:text-sm font-bold text-rose-600 flex items-center gap-2 rounded-b-md transition-colors`}
                >
                  <FaSignOutAlt className="text-rose-600 text-sm flex-shrink-0" />
                  Logout
                </button>
              )}
            </Menu.Item>
          </Menu.Items>
        </Menu>
      </div>
    </header>
  );
};

export default Header;
