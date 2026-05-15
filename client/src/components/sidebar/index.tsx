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

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  onHoverChange: (hovered: boolean) => void;
}

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

  const businessAllowed = admin?.allowedmodules;

  const localAllowed =
    isAdmin
      ? businessAllowed
      : isBranch
        ? branch?.allowedmodules
        : isStaff
          ? staff?.allowedmodules
          : undefined;

  const isModuleAllowed = (moduleId: string) => {
    // 1. Business Level (SaaS) — Mandatory check
    if (businessAllowed && Array.isArray(businessAllowed)) {
      if (!businessAllowed.map((m: any) => m.toString().toLowerCase()).includes(moduleId.toLowerCase())) return false;
    }

    // 2. Local Level (Branch/Staff specific checklist)
    if (localAllowed && Array.isArray(localAllowed)) {
      if (!localAllowed.map((m: any) => m.toString().toLowerCase()).includes(moduleId.toLowerCase())) return false;
    }

    return true;
  };

  const FEATURE_TO_MODULES: Record<string, string[]> = {
    enableGst: ["reports.gst"],
  };

  const filterLinks = (links: SidebarLink[]) => {
    return links.filter((link) => {
      const moduleId = link.moduleId;
      if (!moduleId) return true;

      if (settings) {
        const flag = Object.entries(FEATURE_TO_MODULES).find(([_, ids]) => ids.includes(moduleId))?.[0];
        if (flag && settings[flag] === false) return false;
      }

      if (!isModuleAllowed(moduleId)) return false;

      // The "Allowed Modules" checklist is now the primary driver for sidebar visibility for all roles.
      // This ensures that if a module is checked in the allowance list, it appears in the sidebar.
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

  const homeLink: SidebarLink = {
    to: '/home',
    label: 'Home',
    icon: <FaHome className="text-xl" />
  };

  // Dynamic Sidebar Link Registry
  const ALL_LINKS: (SidebarLink & { roles: string[]; section?: string })[] = [
    { to: '/branches', label: 'Branches', icon: <FaCodeBranch />, moduleId: "branches", roles: ["admin"] },
    { to: '/categories', label: 'Categories', icon: <FaTags />, moduleId: "categories", roles: ["admin"] },
    { to: '/subcategories', label: 'Sub Categories', icon: <FaIndent />, moduleId: "subcategories", roles: ["admin"] },
    { to: '/sizes', label: 'Sizes', icon: <FaRulerCombined />, moduleId: "sizes", roles: ["admin"] },
    { to: '/brands', label: 'Brands', icon: <MdBrandingWatermark />, moduleId: "brands", roles: ["admin"] },
    { to: '/models', label: 'Models', icon: <FaMobileAlt />, moduleId: "models", roles: ["admin"] },
    { to: '/productgroups', label: 'Product Groups', icon: <FaLayerGroup />, moduleId: "productgroups", roles: ["admin"] },
    { to: '/units', label: 'Units', icon: <FaBalanceScale />, moduleId: "units", roles: ["admin"] },
    { to: '/accountgroups', label: 'Account Groups', icon: <FaUsers />, moduleId: "accountgroups", roles: ["admin"] },
    { to: '/accountledgers', label: 'Account Ledgers', icon: <FaMoneyBillWave />, moduleId: "accountledgers", roles: ["admin", "branch", "staff"] },
    { to: '/staffaccounts', label: 'Staff Accounts', icon: <FaUserTie />, moduleId: "staffaccounts", roles: ["admin", "branch", "staff"] },
    { to: '/accounts', label: 'Party Accounts', icon: <FaUser />, moduleId: "accounts", roles: ["admin", "branch", "staff"] },
    { to: '/products', label: 'Products', icon: <FaBoxOpen />, moduleId: "products", roles: ["admin", "branch", "staff"] },
    { to: '/salesorder', label: 'Sales Orders', icon: <FaClipboardList />, moduleId: "salesorder", roles: ["admin", "branch", "staff"] },
    { to: '/salesinvoice', label: 'Sales Invoices', icon: <FaFileInvoiceDollar />, moduleId: "salesinvoice", roles: ["admin", "branch", "staff"] },
    { to: '/salesreturn', label: 'Sales Returns', icon: <FaUndoAlt />, moduleId: "salesreturn", roles: ["admin", "branch", "staff"] },
    { to: '/purchaseorder', label: 'Purchase Orders', icon: <FaClipboardList />, moduleId: "purchaseorder", roles: ["admin", "branch", "staff"] },
    { to: '/purchaseinvoice', label: 'Purchase Invoices', icon: <FaReceipt />, moduleId: "purchaseinvoice", roles: ["admin", "branch", "staff"] },
    { to: '/purchasereturn', label: 'Purchase Returns', icon: <FaUndoAlt />, moduleId: "purchasereturn", roles: ["admin", "branch", "staff"] },
    { to: '/transferstock', label: 'Transfer Stock', icon: <FaExchangeAlt />, moduleId: "transferstock", roles: ["admin", "branch", "staff"] },
    { to: '/stockadjustments', label: 'Stock Adjustments', icon: <FaWrench />, moduleId: "stockadjustments", roles: ["admin", "branch", "staff"] },
    { to: '/expensenote', label: 'Expense Notes', icon: <FaMoneyCheckAlt />, moduleId: "expensenote", roles: ["admin", "branch", "staff"] },
    { to: '/transactions', label: 'Transactions', icon: <FaFileInvoiceDollar />, moduleId: "transactions", roles: ["admin", "branch", "staff"] },
    { to: '/payments', label: 'Payments', icon: <FaWallet />, moduleId: "payments", roles: ["admin", "branch", "staff"] },
    { to: '/attendance', label: 'Attendance & Leave', icon: <FaCalendarCheck />, moduleId: "attendance", roles: ["admin", "branch", "staff"] },
   
    { to: '/channels', label: 'Channels', icon: <FaSitemap />, moduleId: "channels", roles: ["admin", "branch", "staff"], section: "Distribution" },
    { to: '/salesroutes', label: 'Sales Routes', icon: <FaRoute />, moduleId: "salesroutes", roles: ["admin", "branch", "staff"], section: "Distribution" },
    { to: '/pricelists', label: 'Price Lists', icon: <FaTags />, moduleId: "pricelists", roles: ["admin", "branch", "staff"], section: "Distribution" },
    { to: '/priceassignments', label: 'Price Assignments', icon: <FaClipboardList />, moduleId: "priceassignments", roles: ["admin", "branch", "staff"], section: "Distribution" },
    
    { to: '/reports/sales', label: 'Sales Reports', icon: <FaChartBar />, moduleId: "reports.sales", roles: ["admin", "branch", "staff"], section: "Reports" },
    { to: '/reports/purchase', label: 'Purchase Reports', icon: <FaFileAlt />, moduleId: "reports.purchase", roles: ["admin", "branch", "staff"], section: "Reports" },
    { to: '/reports/stock', label: 'Stock Reports', icon: <FaClipboardList />, moduleId: "reports.stock", roles: ["admin", "branch", "staff"], section: "Reports" },
    { to: '/reports/gst', label: 'GST Reports', icon: <FaFileInvoiceDollar />, moduleId: "reports.gst", roles: ["admin", "branch", "staff"], section: "Reports" },
    { to: '/reports/accounting', label: 'Accounting / Finance', icon: <FaWallet />, moduleId: "reports.accounting", roles: ["admin", "branch", "staff"], section: "Reports" },
    { to: '/reports/party', label: 'Party / Vendor ', icon: <FaUsers />, moduleId: "reports.party", roles: ["admin", "branch", "staff"], section: "Reports" },
    { to: '/reports/salesmen', label: 'Salesmen Reports', icon: <FaUserTie />, moduleId: "reports.salesmen", roles: ["admin", "branch", "staff"], section: "Reports" },
    { to: '/reports/analytical', label: 'Analytical Reports', icon: <FaChartLine />, moduleId: "reports.analytical", roles: ["admin", "branch", "staff"], section: "Reports" },
    { to: '/reports/attendance', label: 'Attendance & Leave', icon: <FaCalendarCheck />, moduleId: "reports.attendance", roles: ["admin", "branch", "staff"], section: "Reports" },
  ];

  const filteredLinks = filterLinks(ALL_LINKS.filter(l => l.roles.includes(role || "")));
  const sidebarItems: SidebarItem[] = [homeLink];
  const mainLinks = filteredLinks.filter(l => !l.section);
  const sections = Array.from(new Set(filteredLinks.map(l => l.section).filter(Boolean))) as string[];

  sidebarItems.push(...mainLinks);

  sections.forEach(secName => {
    const secLinks = filteredLinks.filter(l => l.section === secName);
    if (secLinks.length > 0) {
      sidebarItems.push({ label: secName, isSection: true });
      sidebarItems.push(...secLinks);
    }
  });

  if (isAdmin || isBranch) {
    sidebarItems.push({ label: "System", isSection: true });
    sidebarItems.push({ to: "/settings", label: "Settings", icon: <FaCog /> });
  }

  return (
    <>
      <button
        onClick={toggleSidebar}
        className="sm:hidden fixed top-2 left-2 z-50 bg-[#34495e] text-white p-2 rounded-md"
      >
        ☰
      </button>

      <aside
          onMouseEnter={() => handleHover(true)}
          onMouseLeave={() => handleHover(false)}
          className={`fixed top-[60px] left-0 bottom-0 z-40 bg-[#2c3e50] shadow-xl transition-all duration-300 ease-in-out border-r border-white/10 flex flex-col ${
            isHovered ? 'w-56' : 'w-14'
          } ${isOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'}`}
      >
        <div className="p-2 flex flex-col space-y-1 overflow-x-hidden overflow-y-auto" key={localAllowed?.join(',') || 'all'}>
          {sidebarItems.map((item: any, index: any) =>
            'isSection' in item && item.isSection ? (
              <div key={`section-${index}-${item.label}`} className="mt-4 border-t border-gray-500/30">
                <span
                  className={`block px-3 py-2 text-gray-300 uppercase tracking-wider text-xs font-semibold transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
                >
                  {item.label}
                </span>
              </div>
            ) : (
              <Link
                key={item.to}
                to={item.to}
                state={{ from: location.pathname }}
                className={`flex items-center gap-3 px-3 py-2 rounded hover:bg-[#34495e] text-white transition-all text-base ${location.pathname === item.to ? 'bg-[#34495e]' : ''}`}
              >
                <span className="min-w-[1.75rem] text-white flex items-center justify-center text-xl">{item.icon}</span>
                <span
                  className={`text-white transition-opacity duration-200 whitespace-nowrap font-medium ${isHovered ? 'opacity-100' : 'opacity-0'}`}
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
