import React, { useState } from 'react';
import { FaBars, FaBuilding, FaChevronDown, FaSignOutAlt } from 'react-icons/fa';
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
  title = "Dashboard",
  isAdmin = false,
  branches = [],
  selectedBranchId,
  onBranchChange,
}) => {
  const selectedBranch = branches.find(b => b.id === selectedBranchId);

  return (
    <header className="fixed top-0 left-0 right-0 h-[60px] bg-[#34495e] text-white flex items-center px-4 z-[1000]">
      {/* Menu Button */}
      {onMenuClick && (
        <button
          className="mr-4 p-1 sm:p-2 rounded-md bg-transparent hover:bg-gray-700 text-black text-lg sm:text-xl cursor-pointer"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <FaBars />
        </button>
      )}

      {/* Title */}
      <h3 className="text-base sm:text-lg md:text-xl lg:text-2xl font-semibold text-white">
        {title}
      </h3>

      {/* Dropdown Menu */}
      <div className="ml-auto relative space-x-3">
        {/* Admin Branch Selector */}
        {/* {!isAdmin && (
          <select
            className="ml-4 text-white bg-[#2c3e50] border border-white rounded px-6 py-1 text-sm sm:text-base focus:outline-none hover:border-2"
            value={selectedBranchId}
            onChange={(e) => onBranchChange?.(e.target.value)}
          >
            <option value="">All Branches</option>
            {branches.map(branch => (
              <option key={branch.id} value={branch.id}>
                {branch.branchname}
              </option>
            ))}
          </select>
        )} */}
        <Menu as="div" className="relative inline-block text-left">
          <Menu.Button className="flex items-center px-3 py-2 text-black hover:bg-gray-700 rounded-md">
            <FaChevronDown className="mr-1" />
          </Menu.Button>

          <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right bg-white divide-y divide-gray-100 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
            <div className="px-3 py-2 text-sm text-gray-700 flex items-center gap-2">
              <FaBuilding className="text-gray-500" />
              {selectedBranch?.branchname || "Admin"}
            </div>
            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={onLogoutClick}
                  className={`${
                    active ? 'bg-gray-100' : ''
                  } w-full text-left px-3 py-2 text-sm text-red-600 flex items-center gap-2`}
                >
                  <FaSignOutAlt />
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
