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
  FaWrench,
  FaCalendarCheck,
  FaUndoAlt,
  FaCog
} from 'react-icons/fa';
import { MdBrandingWatermark } from 'react-icons/md';
import { Link, useLocation } from 'react-router';
import { useAppSelector } from '../../redux/hooks';
import { findModule } from '../../config/modules';

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
  const { permissions, isLoaded } = useAppSelector((state: any) => state.permissions);
  const { settings } = useAppSelector((state: any) => state.adminsettings);
  const location = useLocation();
  const [isHovered, setIsHovered] = React.useState(false);

  const role = type?.toString().toLowerCase();
  const isAdmin = role === "admin";
  const isBranch = role === "branch";
  const isStaff = role === "staff";

  // HIERARCHICAL MODULE ALLOWANCE (Nested Whitelist)
  // 1. SaaS Level: What the Super Admin allowed for the whole business
  const businessAllowed = admin?.allowedmodules;

  // 2. Local Level: What the parent allowed for this specific account
  // - For Admin: Uses businessAllowed directly.
  // - For Branch: Uses branch.allowedmodules (set by Admin).
  // - For Staff: Uses staff.allowedmodules (set by Branch).
  const localAllowed =
    isAdmin
      ? businessAllowed
      : isBranch
        ? branch?.allowedmodules
        : isStaff
          ? staff?.allowedmodules
          : undefined;

  /**
   * Visibility check for hierarchical allowance.
   * A module is shown ONLY if it's allowed at BOTH the Business (SaaS) level 
   * AND the Local level (Branch/Staff setting).
   */
  const isModuleAllowed = (moduleId: string) => {
    // 1. Check Business (SaaS) Level
    if (Array.isArray(businessAllowed) && businessAllowed.length > 0) {
      if (!businessAllowed.map(m => m.toLowerCase()).includes(moduleId.toLowerCase())) return false;
    }

    // 2. Check Local Level (Branch/Staff specific checklist)
    // If localAllowed is null/empty, we default to whatever the parent allowed (Business level).
    if (Array.isArray(localAllowed) && localAllowed.length > 0) {
      if (!localAllowed.map(m => m.toLowerCase()).includes(moduleId.toLowerCase())) return false;
    }

    return true;
  };

  // Feature-to-module map matching Settings page
  const FEATURE_TO_MODULES: Record<string, string[]> = {
    enableGst: ["reports.gst"],
  };

  const filterLinks = (links: SidebarLink[]) => {
    return links.filter((link) => {
      const moduleId = link.moduleId;
      if (!moduleId) return true;

      // 1. SaaS Feature Gate
      if (settings) {
        const flag = Object.entries(FEATURE_TO_MODULES).find(([_, ids]) => ids.includes(moduleId))?.[0];
        if (flag && settings[flag] === false) return false;
      }

      // 2. Hierarchical Module Allowance Gate (Nested Whitelist)
      if (!isModuleAllowed(moduleId)) return false;

      // 3. Admin/Branch Default: If we passed the checks above, they see it.
      if (isAdmin || isBranch) return true;

      // 4. Staff Permission Matrix
      if (isLoaded) {
        const userPerm = permissions[moduleId]?.view;
        if (userPerm === false) return false;
        if (userPerm === true) return true;
      }

      // Default for non-admins: show if not explicitly denied.
      return true;
    });
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
    { to: '/salesorder', label: 'Sales Orders', icon: <FaClipboardList className="text-xl" />, moduleId: "salesorder" },
    { to: '/salesinvoice', label: 'Sales Invoices', icon: <FaFileInvoiceDollar className="text-xl" />, moduleId: "salesinvoice" },
    { to: '/salesreturn', label: 'Sales Returns', icon: <FaUndoAlt className="text-xl" />, moduleId: "salesreturn" },
    { to: '/purchaseorder', label: 'Purchase Orders', icon: <FaClipboardList className="text-xl" />, moduleId: "purchaseorder" },
    { to: '/purchaseinvoice', label: 'Purchase Invoices', icon: <FaReceipt className="text-xl" />, moduleId: "purchaseinvoice" },
    { to: '/purchasereturn', label: 'Purchase Returns', icon: <FaUndoAlt className="text-xl" />, moduleId: "purchasereturn" },
    { to: '/transferstock', label: 'Transfer Stock', icon: <FaExchangeAlt className="text-xl" />, moduleId: "transferstock" },
    { to: '/stockadjustments', label: 'Stock Adjustments', icon: <FaWrench className="text-xl" />, moduleId: "stockadjustments" },
    { to: '/expensenote', label: 'Expense Notes', icon: <FaMoneyCheckAlt className="text-xl" />, moduleId: "expensenote" },
    { to: '/transactions', label: 'Transactions', icon: <FaFileInvoiceDollar className="text-xl" />, moduleId: "transactions" },
    { to: '/payments', label: 'Payments', icon: <FaWallet className="text-xl" />, moduleId: "payments" },
    { to: '/attendance', label: 'Attendance & Leave', icon: <FaCalendarCheck className="text-xl" />, moduleId: "attendance" },
    { to: '/posdashboard', label: 'POS Dashboard', icon: <FaChartBar className="text-xl" />, moduleId: "posdashboard" },
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

  // Reports links — each report has its own moduleId so an admin can hide
  // individual reports (e.g. give an "order-only" admin Sales Reports but
  // not GST/Accounting). Keys match the entries in `config/modules.ts`.
  const reportsLinks: SidebarLink[] = [
    { to: '/reports/sales',      label: 'Sales Reports',       icon: <FaChartBar className="text-xl" />,       moduleId: "reports.sales" },
    { to: '/reports/purchase',   label: 'Purchase Reports',    icon: <FaFileAlt className="text-xl" />,        moduleId: "reports.purchase" },
    { to: '/reports/stock',      label: 'Stock Reports',       icon: <FaClipboardList className="text-xl" />,  moduleId: "reports.stock" },
    { to: '/reports/gst',        label: 'GST Reports',         icon: <FaFileInvoiceDollar className="text-xl" />, moduleId: "reports.gst" },
    { to: '/reports/accounting', label: 'Accounting / Finance', icon: <FaWallet className="text-xl" />,         moduleId: "reports.accounting" },
    { to: '/reports/party',      label: 'Party / Vendor ',     icon: <FaUsers className="text-xl" />,          moduleId: "reports.party" },
    { to: '/reports/salesmen',   label: 'Salesmen Reports',    icon: <FaUserTie className="text-xl" />,        moduleId: "reports.salesmen" },
    { to: '/reports/analytical', label: 'Analytical Reports',  icon: <FaChartLine className="text-xl" />,      moduleId: "reports.analytical" },
    { to: '/reports/attendance', label: 'Attendance & Leave',  icon: <FaCalendarCheck className="text-xl" />,  moduleId: "reports.attendance" },
  ];

  // Distribution links
  const distributionLinks: SidebarLink[] = [
    { to: '/channels', label: 'Channels', icon: <FaSitemap className="text-xl" />, moduleId: "channels" },
    { to: '/salesroutes', label: 'Sales Routes', icon: <FaRoute className="text-xl" />, moduleId: "salesroutes" },
    { to: '/pricelists', label: 'Price Lists', icon: <FaTags className="text-xl" />, moduleId: "pricelists" },
    { to: '/priceassignments', label: 'Price Assignments', icon: <FaClipboardList className="text-xl" />, moduleId: "priceassignments" },
  ];

  const filteredBranchLinks = filterLinks(branchLinks);
  const filteredAdminLinks = filterLinks(adminLinks);
  const filteredReportsLinks = filterLinks(reportsLinks);
  const filteredDistributionLinks = filterLinks(distributionLinks);

  // Settings link — shown for both admin and branch users.
  const settingsLinks: SidebarLink[] =
    isAdmin || isBranch
      ? [{ to: "/settings", label: "Settings", icon: <FaCog className="text-xl" /> }]
      : [];

  // Sidebar items construction
  const sidebarItems: SidebarItem[] = [homeLink];

  if (isAdmin) {
    sidebarItems.push(...filteredAdminLinks);
    // Add unique branch links (those not already in admin links)
    const uniqueBranchLinks = filteredBranchLinks.filter(
      (bl) => !adminLinks.some((al) => al.to === bl.to)
    );
    sidebarItems.push(...uniqueBranchLinks);
  } else if (isBranch || isStaff) {
    sidebarItems.push(...filteredBranchLinks);
  }

  // Distribution section
  if (filteredDistributionLinks.length > 0) {
    sidebarItems.push({ label: "Distribution", isSection: true });
    sidebarItems.push(...filteredDistributionLinks);
  }

  // Reports section
  if (filteredReportsLinks.length > 0) {
    sidebarItems.push({ label: "Reports", isSection: true });
    sidebarItems.push(...filteredReportsLinks);
  }

  // System section
  if (settingsLinks.length > 0) {
    sidebarItems.push({ label: "System", isSection: true });
    sidebarItems.push(...settingsLinks);
  }

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
        <div className="p-2 flex flex-col space-y-1 overflow-x-hidden" key={localAllowed?.join(',') || 'all'}>
          {sidebarItems.map((item: any, index: any) =>
            'isSection' in item && item.isSection ? (
              <div key={`section-${index}-${item.label}`} className="mt-4 border-t border-gray-500/30">
                <span
                  className={`block px-3 py-2 text-gray-300 uppercase tracking-wider text-xs font-semibold transition-opacity duration-200 opacity-100`}
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
                  className={`text-white transition-opacity duration-200 whitespace-nowrap font-medium opacity-100`}
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
