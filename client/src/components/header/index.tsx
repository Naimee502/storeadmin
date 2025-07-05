import React from 'react';
import {
  FaBars,
  FaBuilding,
  FaChevronDown,
  FaSignOutAlt,
  FaTachometerAlt,
} from 'react-icons/fa';
import { Menu } from '@headlessui/react';

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
  const selectedBranch = branches.find((b) => b.id === selectedBranchId);

  return (
    <header className="fixed top-0 left-0 right-0 h-[60px] bg-[#34495e] text-white flex items-center px-2 sm:px-2 z-[1000]">
      {/* Menu Button */}
      {onMenuClick && (
        <button
          className="mr-2 sm:mr-4 p-1 sm:p-2 rounded-md bg-transparent hover:bg-gray-700 text-black text-lg sm:text-xl"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <FaTachometerAlt className="text-xl sm:text-2xl" />
        </button>
      )}

      {/* Title */}
      <h3 className="text-sm sm:text-base md:text-lg lg:text-xl font-semibold truncate max-w-[150px] sm:max-w-[200px] md:max-w-none">
        {title}
      </h3>

      {/* Right-side controls */}
      <div className="ml-auto flex items-center gap-2 sm:gap-4">
        {/* Branch Dropdown */}
        {!isAdmin && (
          <select
            className="text-white bg-[#2c3e50] border border-white rounded px-2 py-1 text-xs sm:text-sm focus:outline-none"
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
          <Menu.Button className="flex items-center px-2 py-2 text-black hover:bg-gray-700 rounded-md">
            <FaChevronDown className="text-sm sm:text-base" />
          </Menu.Button>

          <Menu.Items className="absolute right-2 sm:right-0 mt-2 w-40 sm:w-48 origin-top-right bg-white divide-y divide-gray-100 rounded-md shadow-lg ring-1 ring-black/5 focus:outline-none z-50 text-sm sm:text-base">
            {/* Branch/Admin Name */}
            <div className="px-3 py-2 flex items-center gap-2 text-gray-700 text-xs sm:text-sm">
              <FaBuilding className="text-gray-500 text-sm" />
              {selectedBranch?.branchname || 'Admin'}
            </div>

            {/* Logout */}
            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={onLogoutClick}
                  className={`${
                    active ? 'bg-gray-100' : ''
                  } w-full text-left px-3 py-2 text-xs sm:text-sm text-red-600 flex items-center gap-2`}
                >
                  <FaSignOutAlt className="text-sm" />
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
