import React, { useEffect } from 'react';
import {
  FaBalanceScale, FaBoxOpen, FaCodeBranch, FaHome,
  FaLayerGroup, FaMobileAlt, FaRulerCombined, FaTags,
  FaUser, FaUsers, FaUserTie, FaFileInvoiceDollar,
  FaReceipt, FaExchangeAlt
} from 'react-icons/fa';
import { MdBrandingWatermark } from 'react-icons/md';
import { Link, useLocation } from 'react-router';
import { useAppSelector } from '../../redux/hooks';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  onHoverChange: (hovered: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggleSidebar, onHoverChange }) => {
  const { type } = useAppSelector((state) => state.auth);
  const location = useLocation();
  const [isHovered, setIsHovered] = React.useState(false);

  const handleHover = (state: boolean) => {
    setIsHovered(state);
    onHoverChange(state);
  };

  useEffect(() => {
    setIsHovered(false);
    onHoverChange(false);
  }, [location.pathname]);

  const homeLink = {
    to: '/home',
    label: 'Home',
    icon: <FaHome className="text-xl" />
  };

  const commonLinks = [
    { to: '/salesmenaccount', label: 'Salesmen Accounts', icon: <FaUserTie className="text-xl" /> },
    { to: '/accounts', label: 'Accounts', icon: <FaUser className="text-xl" /> },
    { to: '/products', label: 'Products', icon: <FaBoxOpen className="text-xl" /> },
    { to: '/salesinvoice', label: 'Sales Invoices', icon: <FaFileInvoiceDollar className="text-xl" /> },
    { to: '/purchaseinvoice', label: 'Purchase Invoices', icon: <FaReceipt className="text-xl" /> },
    { to: '/transferstock', label: 'Transfer Stock', icon: <FaExchangeAlt className="text-xl" /> }
  ];

  const adminLinks = [
    { to: '/branches', label: 'Branches', icon: <FaCodeBranch className="text-xl" /> },
    { to: '/categories', label: 'Categories', icon: <FaTags className="text-xl" /> },
    { to: '/sizes', label: 'Sizes', icon: <FaRulerCombined className="text-xl" /> },
    { to: '/brands', label: 'Brands', icon: <MdBrandingWatermark className="text-xl" /> },
    { to: '/models', label: 'Models', icon: <FaMobileAlt className="text-xl" /> },
    { to: '/productgroups', label: 'Product Groups', icon: <FaLayerGroup className="text-xl" /> },
    { to: '/units', label: 'Units', icon: <FaBalanceScale className="text-xl" /> },
    { to: '/accountgroups', label: 'Account Groups', icon: <FaUsers className="text-xl" /> }
  ];

  const filteredCommonLinks = commonLinks.filter(link =>
    !['/products', '/salesinvoice', '/purchaseinvoice', '/transferstock', '/accounts', '/salesmenaccount'].includes(link.to)
  );

  const sidebarItems = type === 'branch'
    ? [homeLink, ...commonLinks]
    : [homeLink, ...adminLinks, ...filteredCommonLinks];

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={toggleSidebar}
        className="sm:hidden fixed top-2 left-2 z-50 bg-[#34495e] text-white p-2 rounded-md"
      >
        ☰
      </button>

      {/* Sidebar */}
      <aside
        onMouseEnter={() => handleHover(true)}
        onMouseLeave={() => handleHover(false)}
        className={`
          fixed top-[60px] left-0 h-[calc(100vh-60px)] bg-[#34495e] hover:bg-[#3c5a6f] 
          text-white z-40 transition-all duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'} sm:translate-x-0
          ${isHovered ? 'w-56' : 'w-14'} sm:${isHovered ? 'w-56' : 'w-14'}
        `}
      >
        <div className="p-2 flex flex-col space-y-1 overflow-x-hidden">
          {sidebarItems.map(({ to, label, icon }) => (
            <Link
              key={to}
              to={to}
              state={{ from: location.pathname }}
              className="flex items-center gap-3 px-3 py-2 rounded hover:bg-[#34495e] text-white transition-all text-base"
            >
              <span className="min-w-[1.75rem] text-white">{icon}</span>
              <span className={`text-white transition-opacity duration-200 whitespace-nowrap font-medium ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
                {label}
              </span>
            </Link>
          ))}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
