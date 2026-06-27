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

  // ── Strict hierarchical module allowance chain ──
  // Level 1: Business / SaaS (admin.allowedmodules) — mandatory
  const businessAllowed = admin?.allowedmodules;

  // Level 2: Branch-level override (only when logged in as branch or staff)
  const branchAllowed = isBranch
    ? branch?.allowedmodules
    : isStaff
      ? staff?.branchid ? undefined // staff doesn't carry branch allowedmodules directly
      : undefined
    : undefined;

  // Level 3: Staff-level override (only when logged in as staff)
  const staffAllowed = isStaff ? staff?.allowedmodules : undefined;

  // For admin: only businessAllowed matters (admin IS the business level)
  // For branch: businessAllowed ∩ branchAllowed
  // For staff: businessAllowed ∩ branchAllowed ∩ staffAllowed
  const isModuleAllowed = (moduleId: string) => {
    const mid = moduleId.toLowerCase();
    const includes = (arr: string[]) => arr.map((m: any) => m.toString().toLowerCase()).includes(mid);

    // 1. Business Level (SaaS) — Mandatory check for all roles.
    // The Business Settings "Allowed Modules" checklist is authoritative: a
    // module only appears in the sidebar if it is present in allowedmodules.
    if (businessAllowed && Array.isArray(businessAllowed)) {
      if (!includes(businessAllowed)) return false;
    }

    // 2. Branch Level — checked for branch and staff roles
    if ((isBranch || isStaff) && branchAllowed && Array.isArray(branchAllowed)) {
      if (!includes(branchAllowed)) return false;
    }

    // 3. Staff Level — only checked for staff role
    if (isStaff && staffAllowed && Array.isArray(staffAllowed)) {
      if (!includes(staffAllowed)) return false;
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
    icon: <FaHome className="text-cyan-400 text-xl flex-shrink-0" />
  };

  // Dynamic Sidebar Link Registry
  const ALL_LINKS: (SidebarLink & { roles: string[]; section?: string })[] = [
    { to: '/branches', label: 'Branches', icon: <FaCodeBranch className="text-amber-400 text-xl flex-shrink-0" />, moduleId: "branches", roles: ["admin", "branch", "staff"] },
    { to: '/categories', label: 'Categories', icon: <FaTags className="text-rose-400 text-xl flex-shrink-0" />, moduleId: "categories", roles: ["admin", "branch", "staff"] },
    { to: '/subcategories', label: 'Sub Categories', icon: <FaIndent className="text-blue-400 text-xl flex-shrink-0" />, moduleId: "subcategories", roles: ["admin", "branch", "staff"] },
    { to: '/sizes', label: 'Sizes', icon: <FaRulerCombined className="text-purple-400 text-xl flex-shrink-0" />, moduleId: "sizes", roles: ["admin", "branch", "staff"] },
    { to: '/brands', label: 'Brands', icon: <MdBrandingWatermark className="text-emerald-400 text-xl flex-shrink-0" />, moduleId: "brands", roles: ["admin", "branch", "staff"] },
    { to: '/models', label: 'Models', icon: <FaMobileAlt className="text-cyan-400 text-xl flex-shrink-0" />, moduleId: "models", roles: ["admin", "branch", "staff"] },
    { to: '/productgroups', label: 'Product Groups', icon: <FaLayerGroup className="text-yellow-400 text-xl flex-shrink-0" />, moduleId: "productgroups", roles: ["admin", "branch", "staff"] },
    { to: '/units', label: 'Units', icon: <FaBalanceScale className="text-orange-400 text-xl flex-shrink-0" />, moduleId: "units", roles: ["admin", "branch", "staff"] },
    { to: '/accountgroups', label: 'Account Groups', icon: <FaUsers className="text-teal-400 text-xl flex-shrink-0" />, moduleId: "accountgroups", roles: ["admin", "branch", "staff"] },
    { to: '/accountledgers', label: 'Account Ledgers', icon: <FaMoneyBillWave className="text-green-400 text-xl flex-shrink-0" />, moduleId: "accountledgers", roles: ["admin", "branch", "staff"] },
    { to: '/staffaccounts', label: 'Staff Accounts', icon: <FaUserTie className="text-indigo-400 text-xl flex-shrink-0" />, moduleId: "staffaccounts", roles: ["admin", "branch", "staff"] },
    { to: '/accounts', label: 'Party Accounts', icon: <FaUser className="text-pink-400 text-xl flex-shrink-0" />, moduleId: "accounts", roles: ["admin", "branch", "staff"] },
    { to: '/products', label: 'Products', icon: <FaBoxOpen className="text-amber-500 text-xl flex-shrink-0" />, moduleId: "products", roles: ["admin", "branch", "staff"] },
    { to: '/salesorder', label: 'Sales Orders', icon: <FaClipboardList className="text-cyan-500 text-xl flex-shrink-0" />, moduleId: "salesorder", roles: ["admin", "branch", "staff"] },
    { to: '/salesinvoice', label: 'Sales Invoices', icon: <FaFileInvoiceDollar className="text-emerald-500 text-xl flex-shrink-0" />, moduleId: "salesinvoice", roles: ["admin", "branch", "staff"] },
    { to: '/salesreturn', label: 'Sales Returns', icon: <FaUndoAlt className="text-rose-500 text-xl flex-shrink-0" />, moduleId: "salesreturn", roles: ["admin", "branch", "staff"] },
    { to: '/purchaseorder', label: 'Purchase Orders', icon: <FaClipboardList className="text-teal-400 text-xl flex-shrink-0" />, moduleId: "purchaseorder", roles: ["admin", "branch", "staff"] },
    { to: '/purchaseinvoice', label: 'Purchase Invoices', icon: <FaReceipt className="text-blue-500 text-xl flex-shrink-0" />, moduleId: "purchaseinvoice", roles: ["admin", "branch", "staff"] },
    { to: '/purchasereturn', label: 'Purchase Returns', icon: <FaUndoAlt className="text-red-400 text-xl flex-shrink-0" />, moduleId: "purchasereturn", roles: ["admin", "branch", "staff"] },
    { to: '/transferstock', label: 'Transfer Stock', icon: <FaExchangeAlt className="text-purple-500 text-xl flex-shrink-0" />, moduleId: "transferstock", roles: ["admin", "branch", "staff"] },
    { to: '/stockadjustments', label: 'Stock Adjustments', icon: <FaWrench className="text-yellow-500 text-xl flex-shrink-0" />, moduleId: "stockadjustments", roles: ["admin", "branch", "staff"] },
    { to: '/expensenote', label: 'Expense Notes', icon: <FaMoneyCheckAlt className="text-emerald-400 text-xl flex-shrink-0" />, moduleId: "expensenote", roles: ["admin", "branch", "staff"] },
    { to: '/transactions', label: 'Transactions', icon: <FaFileInvoiceDollar className="text-emerald-500 text-xl flex-shrink-0" />, moduleId: "transactions", roles: ["admin", "branch", "staff"] },
    { to: '/payments', label: 'Payments', icon: <FaWallet className="text-emerald-400 text-xl flex-shrink-0" />, moduleId: "payments", roles: ["admin", "branch", "staff"] },
    { to: '/attendance', label: 'Attendance & Leave', icon: <FaCalendarCheck className="text-orange-500 text-xl flex-shrink-0" />, moduleId: "attendance", roles: ["admin", "branch", "staff"] },

    { to: '/channels', label: 'Channels', icon: <FaSitemap className="text-cyan-400 text-xl flex-shrink-0" />, moduleId: "channels", roles: ["admin", "branch", "staff"], section: "Distribution" },
    { to: '/salesroutes', label: 'Sales Routes', icon: <FaRoute className="text-indigo-400 text-xl flex-shrink-0" />, moduleId: "salesroutes", roles: ["admin", "branch", "staff"], section: "Distribution" },
    { to: '/pricelists', label: 'Price Lists', icon: <FaTags className="text-rose-400 text-xl flex-shrink-0" />, moduleId: "pricelists", roles: ["admin", "branch", "staff"], section: "Distribution" },
    { to: '/priceassignments', label: 'Price Assignments', icon: <FaClipboardList className="text-amber-400 text-xl flex-shrink-0" />, moduleId: "priceassignments", roles: ["admin", "branch", "staff"], section: "Distribution" },
    { to: '/chargerules', label: 'Charge Rules', icon: <FaMoneyBillWave className="text-lime-500 text-xl flex-shrink-0" />, moduleId: "chargerules", roles: ["admin", "branch", "staff"], section: "Distribution" },

    { to: '/reports/sales', label: 'Sales Reports', icon: <FaChartBar className="text-blue-400 text-xl flex-shrink-0" />, moduleId: "reports.sales", roles: ["admin", "branch", "staff"], section: "Reports" },
    { to: '/reports/purchase', label: 'Purchase Reports', icon: <FaFileAlt className="text-violet-400 text-xl flex-shrink-0" />, moduleId: "reports.purchase", roles: ["admin", "branch", "staff"], section: "Reports" },
    { to: '/reports/stock', label: 'Stock Reports', icon: <FaClipboardList className="text-cyan-400 text-xl flex-shrink-0" />, moduleId: "reports.stock", roles: ["admin", "branch", "staff"], section: "Reports" },
    { to: '/reports/gst', label: 'GST Reports', icon: <FaFileInvoiceDollar className="text-emerald-400 text-xl flex-shrink-0" />, moduleId: "reports.gst", roles: ["admin", "branch", "staff"], section: "Reports" },
    { to: '/reports/accounting', label: 'Accounting / Finance', icon: <FaWallet className="text-emerald-400 text-xl flex-shrink-0" />, moduleId: "reports.accounting", roles: ["admin", "branch", "staff"], section: "Reports" },
    { to: '/reports/party', label: 'Party / Vendor', icon: <FaUsers className="text-teal-400 text-xl flex-shrink-0" />, moduleId: "reports.party", roles: ["admin", "branch", "staff"], section: "Reports" },
    { to: '/reports/salesmen', label: 'Staff Reports', icon: <FaUserTie className="text-indigo-400 text-xl flex-shrink-0" />, moduleId: "reports.salesmen", roles: ["admin", "branch", "staff"], section: "Reports" },
    { to: '/reports/analytical', label: 'Analytical Reports', icon: <FaChartLine className="text-emerald-400 text-xl flex-shrink-0" />, moduleId: "reports.analytical", roles: ["admin", "branch", "staff"], section: "Reports" },
    { to: '/reports/attendance', label: 'Attendance & Leave', icon: <FaCalendarCheck className="text-orange-400 text-xl flex-shrink-0" />, moduleId: "reports.attendance", roles: ["admin", "branch", "staff"], section: "Reports" },
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
    sidebarItems.push({ to: "/settings", label: "Settings", icon: <FaCog className="text-gray-400 text-xl flex-shrink-0" /> });
  }

  const isExpanded = isOpen || isHovered;

  return (
    <>
      <button
        onClick={toggleSidebar}
        className="sm:hidden fixed top-2 left-2 z-50 bg-slate-900 text-white p-2 rounded-md border border-slate-700 shadow-md"
      >
        ☰
      </button>

      <aside
          onMouseEnter={() => handleHover(true)}
          onMouseLeave={() => handleHover(false)}
          className={`fixed top-[60px] left-0 bottom-0 z-40 bg-slate-950 shadow-2xl transition-all duration-300 ease-in-out border-r border-slate-800 flex flex-col ${
            isExpanded ? 'w-64' : 'w-16'
          } ${isOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'}`}
      >
        <div className="p-2.5 flex flex-col space-y-1 overflow-x-hidden overflow-y-auto" key={`${businessAllowed?.join(',') || 'all'}_${branchAllowed?.join(',') || 'x'}_${staffAllowed?.join(',') || 'x'}`}>
          {sidebarItems.map((item: any, index: any) =>
            'isSection' in item && item.isSection ? (
              <div key={`section-${index}-${item.label}`} className="mt-4 border-t border-slate-800/80 pt-2.5 px-2">
                <span
                  className={`block text-slate-400 uppercase tracking-wider text-[10px] font-bold transition-all duration-200 truncate ${isExpanded ? 'opacity-100' : 'opacity-0 w-0 h-0 overflow-hidden'}`}
                >
                  {item.label}
                </span>
              </div>
            ) : (
              <Link
                key={item.to}
                to={item.to}
                title={!isExpanded ? item.label : undefined}
                state={{ from: location.pathname }}
                className={`flex items-center transition-all text-sm font-medium tracking-wide ${
                  isExpanded
                    ? 'gap-3 px-3.5 py-2.5 rounded-lg w-full'
                    : 'justify-center w-10 h-10 mx-auto rounded-lg'
                } ${
                  location.pathname === item.to
                    ? 'bg-slate-800 text-white font-bold border-l-4 border-cyan-400 shadow-md'
                    : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                }`}
              >
                <span className="flex items-center justify-center text-lg flex-shrink-0">{item.icon}</span>
                <span
                  className={`text-white transition-all duration-200 whitespace-nowrap font-medium ${isExpanded ? 'opacity-100 w-auto ml-1' : 'opacity-0 w-0 ml-0 overflow-hidden'}`}
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
