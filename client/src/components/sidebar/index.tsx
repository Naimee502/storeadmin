import React, { useEffect, type JSX } from 'react';
import {
  FaBalanceScale, FaBoxOpen, FaCodeBranch, FaHome,
  FaLayerGroup, FaMobileAlt, FaRulerCombined, FaTags,
  FaUser, FaUsers, FaUserTie, FaFileInvoiceDollar,
  FaReceipt, FaExchangeAlt, FaWallet,
  FaChartBar, FaFileAlt, FaClipboardList, FaMoneyBillWave, FaFileInvoice,
  FaChartLine
} from 'react-icons/fa';
import { MdBrandingWatermark } from 'react-icons/md';
import { Link, useLocation } from 'react-router';
import { useAppSelector } from '../../redux/hooks';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  onHoverChange: (hovered: boolean) => void;
}

// TypeScript types for sidebar items
type SidebarLink = {
  to: string;
  label: string;
  icon: JSX.Element;
};

type SidebarSection = {
  label: string;
  isSection: true;
};

type SidebarItem = SidebarLink | SidebarSection;

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

  // Home link
  const homeLink: SidebarLink = {
    to: '/home',
    label: 'Home',
    icon: <FaHome className="text-xl" />
  };

  // Branch links
  const branchLinks: SidebarLink[] = [
    { to: '/accountledgers', label: 'Account Ledgers', icon: <FaMoneyBillWave className="text-xl" /> },
    { to: '/salesmenaccount', label: 'Salesmen Accounts', icon: <FaUserTie className="text-xl" /> },
    { to: '/accounts', label: 'Party Accounts', icon: <FaUser className="text-xl" /> },
    { to: '/products', label: 'Products', icon: <FaBoxOpen className="text-xl" /> },
    { to: '/salesinvoice', label: 'Sales Invoices', icon: <FaFileInvoiceDollar className="text-xl" /> },
    { to: '/purchaseinvoice', label: 'Purchase Invoices', icon: <FaReceipt className="text-xl" /> },
    { to: '/transferstock', label: 'Transfer Stock', icon: <FaExchangeAlt className="text-xl" /> },
    { to: '/transactions', label: 'Transactions', icon: <FaFileInvoiceDollar className="text-xl" /> },
    { to: '/payments', label: 'Payments', icon: <FaWallet className="text-xl" /> },
  ];

  // Admin links
  const adminLinks: SidebarLink[] = [
    { to: '/branches', label: 'Branches', icon: <FaCodeBranch className="text-xl" /> },
    { to: '/categories', label: 'Categories', icon: <FaTags className="text-xl" /> },
    { to: '/subcategories', label: 'Sub Categories', icon: <FaTags className="text-xl" /> },
    { to: '/sizes', label: 'Sizes', icon: <FaRulerCombined className="text-xl" /> },
    { to: '/brands', label: 'Brands', icon: <MdBrandingWatermark className="text-xl" /> },
    { to: '/models', label: 'Models', icon: <FaMobileAlt className="text-xl" /> },
    { to: '/productgroups', label: 'Product Groups', icon: <FaLayerGroup className="text-xl" /> },
    { to: '/units', label: 'Units', icon: <FaBalanceScale className="text-xl" /> },
    { to: '/accountgroups', label: 'Account Groups', icon: <FaUsers className="text-xl" /> },
    { to: '/accountledgers', label: 'Account Ledgers', icon: <FaMoneyBillWave className="text-xl" /> },
  ];

  // Reports links
  const reportsLinks: SidebarLink[] = [
    { to: '/reports/sales', label: 'Sales Reports', icon: <FaChartBar className="text-xl" /> }, 
    { to: '/reports/purchase', label: 'Purchase Reports', icon: <FaFileAlt className="text-xl" /> }, 
    { to: '/reports/stock', label: 'Stock Reports', icon: <FaClipboardList className="text-xl" /> }, 
    { to: '/reports/gst', label: 'GST Reports', icon: <FaFileInvoiceDollar className="text-xl" /> },
    { to: '/reports/accounting', label: 'Accounting / Finance', icon: <FaWallet className="text-xl" /> }, 
    { to: '/reports/party', label: 'Party / Vendor ', icon: <FaUsers className="text-xl" /> },
    { to: '/reports/salesmen', label: 'Salesmen Reports', icon: <FaUserTie className="text-xl" /> },
    { to: '/reports/analytical', label: 'Analytical Reports', icon: <FaChartLine className="text-xl" /> },
  ];

  // Filter common links to avoid duplicates in admin
  const filteredCommonLinks = branchLinks.filter(link =>
    ![
      '/products',
      '/salesinvoice',
      '/purchaseinvoice',
      '/transferstock',
      '/accounts',
      '/salesmenaccount',
      '/transactions',   
      '/payments'        
    ].includes(link.to)
  );

  // Sidebar items with sections
  const sidebarItems: SidebarItem[] = type === 'branch'
    ? [
        homeLink,
        ...branchLinks,
        { label: 'Reports', isSection: true },
        ...reportsLinks
      ]
    : [
        homeLink,
        ...adminLinks,
        ...filteredCommonLinks,
        { label: 'Reports', isSection: true },
        ...reportsLinks
      ];

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
        +   overflow-y-auto scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-transparent
          `}
        >
        <div className="p-2 flex flex-col space-y-1 overflow-x-hidden">
          {sidebarItems.map((item: any, index: any) =>
            'isSection' in item && item.isSection ? (
              <div key={index} className="mt-4 border-t border-gray-500/30">
                <span
                  className={`block px-3 py-2 text-gray-300 uppercase tracking-wider text-xs font-semibold transition-opacity duration-200 ${
                    isHovered ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  {item.label}
                </span>
              </div>
            ) : (
              <Link
                key={item.to}
                to={item.to}
                state={{ from: location.pathname }}
                className="flex items-center gap-3 px-3 py-2 rounded hover:bg-[#34495e] text-white transition-all text-base"
              >
                <span className="min-w-[1.75rem] text-white">{item.icon}</span>
                <span
                  className={`text-white transition-opacity duration-200 whitespace-nowrap font-medium ${
                    isHovered ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            )
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
