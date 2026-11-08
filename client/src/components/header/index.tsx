import React, { useMemo } from 'react';
import {
  FaBars,
  FaBuilding,
  FaCashRegister,
  FaChevronDown,
  FaSignOutAlt,
} from 'react-icons/fa';
import { Menu } from '@headlessui/react';
import { WifiOff } from 'lucide-react';
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
    <header className="fixed top-0 left-0 right-0 z-[1000] flex h-12 items-center border-b border-slate-800 bg-slate-950 px-2 text-white">
      {/* Menu Button */}
      {onMenuClick && (
        <button
          className="mr-2 grid h-8 w-10 place-items-center rounded-md text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          onClick={onMenuClick}
          aria-label="Toggle sidebar"
        >
          <FaBars className="text-base text-cyan-400" />
        </button>
      )}

      {/* Title */}
      <h3 className="max-w-[150px] truncate text-sm font-semibold text-white sm:max-w-[300px] md:max-w-none">
        {title}
      </h3>

      {/* Right-side controls */}
      <div className="ml-auto flex items-center gap-2">
        {/* System notifications */}
        <NotificationBell />

        {isPosAllowed && (
          <button
            onClick={() => navigate('/posdashboard')}
            className="flex h-8 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2.5 transition-colors hover:bg-slate-800"
            title="POS Dashboard"
          >
            <FaCashRegister className="text-sm text-emerald-400" />
            <span className="hidden sm:inline text-xs font-bold text-emerald-400">POS</span>
          </button>
        )}

        {/* Branch Dropdown */}
        {!isAdmin && (
          <select
            className="h-8 max-w-[200px] rounded-md border border-slate-700 bg-slate-900 px-2 text-[13px] font-medium text-white focus:border-cyan-400 focus:outline-none"
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
          <Menu.Button className="flex h-8 items-center gap-1.5 rounded-md px-1.5 transition-colors hover:bg-slate-800" title="Account">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-cyan-600 text-[11px] font-bold uppercase text-white">
              {(title || "U").trim().charAt(0)}
            </span>
            <FaChevronDown className="text-[10px] text-slate-400" />
          </Menu.Button>

          <Menu.Items className="absolute right-2 sm:right-0 mt-2 w-48 origin-top-right bg-white divide-y divide-gray-100 rounded-md shadow-lg ring-1 ring-black/5 focus:outline-none z-50 text-sm">
            {/* Branch/Admin Name */}
            <div className="px-3 py-2 flex items-center gap-2 text-gray-700 text-xs sm:text-sm font-semibold bg-gray-50 rounded-t-md border-b">
              <FaBuilding className="text-cyan-600 text-sm flex-shrink-0" />
              <span className="truncate">{selectedBranch?.branchname || (isAdmin ? "Business" : "Admin")}</span>
            </div>

            {/* Offline mode switch lives on Settings, reachable by every role from here */}
            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={() => navigate('/settings')}
                  className={`${active ? 'bg-slate-50' : ''} w-full text-left px-3 py-2.5 text-xs sm:text-sm text-slate-700 flex items-center gap-2 transition-colors`}
                >
                  <WifiOff size={14} className="text-slate-500 flex-shrink-0" />
                  Offline mode
                </button>
              )}
            </Menu.Item>

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
