import React from 'react';
import {
  FaBalanceScale,
  FaBoxOpen,
  FaCodeBranch,
  FaHome,
  FaLayerGroup,
  FaMobileAlt,
  FaRulerCombined,
  FaTags,
  FaUser,
  FaUsers,
  FaUserTie,
  FaFileInvoiceDollar, // <- added icon for Sales Invoices
} from 'react-icons/fa';
import { MdBrandingWatermark } from 'react-icons/md';
import { Link } from 'react-router';
import { useAppSelector } from '../../redux/hooks';

interface SidebarProps {
  isOpen: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen }) => {
  const { type } = useAppSelector((state) => state.auth);

  const commonLinks = [
    {
      to: '/home',
      label: 'Home',
      icon: <FaHome className="text-lg sm:text-xl" />
    },
    {
      to: '/products',
      label: 'Products',
      icon: <FaBoxOpen className="text-lg sm:text-xl" />
    },
    {
      to: '/accounts',
      label: 'Accounts',
      icon: <FaUser className="text-lg sm:text-xl" />
    },
    {
      to: '/salesinvoice',      
      label: 'Sales Invoices',
      icon: <FaFileInvoiceDollar className="text-lg sm:text-xl" />
    }
  ];

  const adminLinks = [
    {
      to: '/branches',
      label: 'Branches',
      icon: <FaCodeBranch className="text-lg sm:text-xl" />
    },
    {
      to: '/categories',
      label: 'Categories',
      icon: <FaTags className="text-lg sm:text-xl" />
    },
    {
      to: '/sizes',
      label: 'Sizes',
      icon: <FaRulerCombined className="text-lg sm:text-xl" />
    },
    {
      to: '/brands',
      label: 'Brands',
      icon: <MdBrandingWatermark className="text-lg sm:text-xl" />
    },
    {
      to: '/models',
      label: 'Models',
      icon: <FaMobileAlt className="text-lg sm:text-xl" />
    },
    {
      to: '/productgroups',
      label: 'Product Groups',
      icon: <FaLayerGroup className="text-lg sm:text-xl" />
    },
    {
      to: '/units',
      label: 'Units',
      icon: <FaBalanceScale className="text-lg sm:text-xl" />
    },
    {
      to: '/accountgroups',
      label: 'Account Groups',
      icon: <FaUsers className="text-lg sm:text-xl" />
    },
    {
      to: '/accounts',
      label: 'Accounts',
      icon: <FaUser className="text-lg sm:text-xl" />
    },
    {
      to: '/salesmenaccount',
      label: 'Salesmen Accounts',
      icon: <FaUserTie className="text-lg sm:text-xl" />
    }
  ];

  const sidebarItems = type === 'branch' ? commonLinks : [...adminLinks, ...commonLinks];

  return (
    <aside
      className={`fixed top-[60px] left-0 h-[calc(100vh-60px)] bg-[#2c3e50] transform transition-transform duration-300 ease-in-out z-50
      ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      w-48 sm:w-56 md:w-64`}
    >
      <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
        {sidebarItems.map(({ to, label, icon }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-3 px-3 py-2 rounded hover:bg-[#34495e] text-white transition-colors text-sm sm:text-base"
          >
            {icon}
            <span className="truncate">{label}</span>
          </Link>
        ))}
      </div>
    </aside>
  );
};

export default Sidebar;
