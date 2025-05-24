import React from 'react';
import { FaCodeBranch, FaHome } from 'react-icons/fa';
import { Link } from 'react-router';

interface SidebarProps {
  isOpen: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen }) => {
  return (
    <aside
      className={`fixed top-[60px] left-0 h-[calc(100vh-60px)] bg-[#2c3e50] transform transition-transform duration-300 ease-in-out z-50
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        w-48 sm:w-56 md:w-64`}
    >
      <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
        <Link
          to="/home"
          className="flex items-center gap-3 px-3 py-2 rounded hover:bg-[#34495e] text-white transition-colors text-sm sm:text-base"
        >
          <FaHome className="text-lg sm:text-xl" />
          <span className="truncate">Home</span>
        </Link>
        <Link
          to="/branches"
          className="flex items-center gap-3 px-3 py-2 rounded hover:bg-[#34495e] text-white transition-colors text-sm sm:text-base"
        >
          <FaCodeBranch className="text-lg sm:text-xl" />
          <span className="truncate">Branches</span>
        </Link>
      </div>
    </aside>
  );
};

export default Sidebar;
