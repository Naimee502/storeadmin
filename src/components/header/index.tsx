import React from 'react';
import { FaBars } from 'react-icons/fa';
import { FiLogOut } from 'react-icons/fi';

interface HeaderProps {
  onMenuClick?: () => void;
  onLogoutClick?: () => void;
  title?: string;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, onLogoutClick, title = "Dashboard" }) => {
  return (
    <header className="fixed top-0 left-0 right-0 h-[60px] bg-[#34495e] text-white flex items-center px-4 z-[1000]">
      {onMenuClick && (
        <button
          className="mr-4 p-1 sm:p-2 rounded-md bg-transparent hover:bg-gray-700 text-black text-lg sm:text-xl cursor-pointer"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <FaBars />
        </button>
      )}

      <h3 className="text-base sm:text-lg md:text-xl lg:text-2xl font-semibold text-white">
        {title}
      </h3>

      {onLogoutClick && (
        <button
          className="ml-auto p-1 sm:p-2 rounded-full bg-gray-700 hover:bg-gray-600 text-black text-lg sm:text-xl cursor-pointer"
          onClick={onLogoutClick}
          aria-label="Logout"
        >
          <FiLogOut />
        </button>
      )}
    </header>
  );
};

export default Header;
