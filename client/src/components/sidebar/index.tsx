import React, { useEffect, type JSX } from 'react';
import {
  FaBalanceScale, FaBoxOpen, FaCodeBranch, FaHome,
  FaLayerGroup, FaMobileAlt, FaRulerCombined, FaTags,
  FaUser, FaUsers, FaUserTie, FaFileInvoiceDollar,
  FaReceipt, FaExchangeAlt, FaWallet,
  FaChartBar, FaFileAlt, FaClipboardList, FaMoneyBillWave,
  FaChartLine,
  FaIndent,
  FaMoneyCheckAlt,
  FaRoute,
  FaSitemap,
  FaWrench
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
  moduleId?: string;
};

type SidebarSection = {
  label: string;
  isSection: true;
};

type SidebarItem = SidebarLink | SidebarSection;

const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggleSidebar, onHoverChange }) => {
  const { type, admin, branch, staff } = useAppSelector((state: any) => state.auth);
  const location = useLocation();
  const [isHovered, setIsHovered] = React.useState(false);

  const allowedModules = admin?.allowedmodules || [];

  const filterLinks = (links: SidebarLink[]) => {
    if (allowedModules.length === 0) return links;
    return links.filter(link => !link.moduleId || allowedModules.includes(link.moduleId));
  };

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
    { to: '/accountledgers', label: 'Account Ledgers', icon: <FaMoneyBillWave className="text-xl" />, moduleId: "accountledgers" },
    { to: '/staffaccounts', label: 'Staff Accounts', icon: <FaUserTie className="text-xl" />, moduleId: "staffaccounts" },
    { to: '/accounts', label: 'Party Accounts', icon: <FaUser className="text-xl" />, moduleId: "accounts" },
    { to: '/products', label: 'Products', icon: <FaBoxOpen className="text-xl" />, moduleId: "products" },
    { to: '/salesinvoice', label: 'Sales Invoices', icon: <FaFileInvoiceDollar className="text-xl" />, moduleId: "salesinvoice" },
    { to: '/purchaseinvoice', label: 'Purchase Invoices', icon: <FaReceipt className="text-xl" />, moduleId: "purchaseinvoice" },
    { to: '/transferstock', label: 'Transfer Stock', icon: <FaExchangeAlt className="text-xl" />, moduleId: "transferstock" },
    { to: '/stockadjustments', label: 'Stock Adjustments', icon: <FaWrench className="text-xl" />, moduleId: "transferstock" },
    { to: '/expensenote', label: 'Expense Notes', icon: <FaMoneyCheckAlt className="text-xl" />, moduleId: "expensenote" },
    { to: '/transactions', label: 'Transactions', icon: <FaFileInvoiceDollar className="text-xl" />, moduleId: "transactions" },
    { to: '/payments', label: 'Payments', icon: <FaWallet className="text-xl" />, moduleId: "payments" },
  ];

  // Admin links
  const adminLinks: SidebarLink[] = [
    { to: '/branches', label: 'Branches', icon: <FaCodeBranch className="text-xl" />, moduleId: "branches" },
    { to: '/categories', label: 'Categories', icon: <FaTags className="text-xl" />, moduleId: "categories" },
    { to: '/subcategories', label: 'Sub Categories', icon: <FaIndent className="text-xl" />, moduleId: "subcategories" },
    { to: '/sizes', label: 'Sizes', icon: <FaRulerCombined className="text-xl" />, moduleId: "sizes" },
    { to: '/brands', label: 'Brands', icon: <MdBrandingWatermark className="text-xl" />, moduleId: "brands" },
    { to: '/models', label: 'Models', icon: <FaMobileAlt className="text-xl" />, moduleId: "models" },
    { to: '/productgroups', label: 'Product Groups', icon: <FaLayerGroup className="text-xl" />, moduleId: "productgroups" },
    { to: '/units', label: 'Units', icon: <FaBalanceScale className="text-xl" />, moduleId: "units" },
    { to: '/accountgroups', label: 'Account Groups', icon: <FaUsers className="text-xl" />, moduleId: "accountgroups" },
    { to: '/accountledgers', label: 'Account Ledgers', icon: <FaMoneyBillWave className="text-xl" />, moduleId: "accountledgers" },
  ];

  // Reports links
  const reportsLinks: SidebarLink[] = [
    { to: '/reports/sales', label: 'Sales Reports', icon: <FaChartBar className="text-xl" />, moduleId: "reports" }, 
    { to: '/reports/purchase', label: 'Purchase Reports', icon: <FaFileAlt className="text-xl" />, moduleId: "reports" }, 
    { to: '/reports/stock', label: 'Stock Reports', icon: <FaClipboardList className="text-xl" />, moduleId: "reports" }, 
    { to: '/reports/gst', label: 'GST Reports', icon: <FaFileInvoiceDollar className="text-xl" />, moduleId: "reports" },
    { to: '/reports/accounting', label: 'Accounting / Finance', icon: <FaWallet className="text-xl" />, moduleId: "reports" }, 
    { to: '/reports/party', label: 'Party / Vendor ', icon: <FaUsers className="text-xl" />, moduleId: "reports" },
    { to: '/reports/salesmen', label: 'Salesmen Reports', icon: <FaUserTie className="text-xl" />, moduleId: "reports" },
    { to: '/reports/analytical', label: 'Analytical Reports', icon: <FaChartLine className="text-xl" />, moduleId: "reports" },
  ];

  // Distribution links
  const distributionLinks: SidebarLink[] = [
    { to: '/channels', label: 'Channels', icon: <FaSitemap className="text-xl" />, moduleId: "channels" },
    { to: '/salesroutes', label: 'Sales Routes', icon: <FaRoute className="text-xl" />, moduleId: "salesroutes" },
    { to: '/pricelists', label: 'Price Lists', icon: <FaTags className="text-xl" />, moduleId: "products" },
    { to: '/priceassignments', label: 'Price Assignments', icon: <FaClipboardList className="text-xl" />, moduleId: "products" },
  ];

  // Filter common links to avoid duplicates in admin
  const filteredCommonLinks = filterLinks(branchLinks.filter(link =>
    ![
      '/products',
      '/salesinvoice',
      '/purchaseinvoice',
      '/transferstock',
      '/stockadjustments',
      '/expensenote',
      '/transactions',   
      '/payments',
      '/accountledgers'        
    ].includes(link.to)
  ));

  const filteredBranchLinks = filterLinks(branchLinks);
  const filteredAdminLinks = filterLinks(adminLinks);
  const filteredReportsLinks = filterLinks(reportsLinks);
  const filteredDistributionLinks = filterLinks(distributionLinks);

  // Sidebar items with sections
  const sidebarItems: SidebarItem[] = type === 'branch' || type === 'staff'
    ? [
        homeLink,
        ...filteredBranchLinks,
        ...(filteredDistributionLinks.length > 0 ? [{ label: 'Distribution', isSection: true as const }, ...filteredDistributionLinks] : []),
        ...(filteredReportsLinks.length > 0 ? [{ label: 'Reports', isSection: true as const }, ...filteredReportsLinks] : [])
      ]
    : [
        homeLink,
        ...filteredAdminLinks,
        ...filteredCommonLinks,
        ...(filteredDistributionLinks.length > 0 ? [{ label: 'Distribution', isSection: true as const }, ...filteredDistributionLinks] : []),
        ...(filteredReportsLinks.length > 0 ? [{ label: 'Reports', isSection: true as const }, ...filteredReportsLinks] : [])
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
            overflow-y-auto scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-transparent
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
