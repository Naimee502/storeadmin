import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, type JSX } from 'react';
import {
  FaBalanceScale, FaBoxOpen, FaBoxes, FaCodeBranch, FaHome,
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
  FaCog,
  FaBullhorn,
  FaSearch,
  FaChevronDown,
  FaSignOutAlt,
  FaTruck
} from 'react-icons/fa';
import { MdBrandingWatermark } from 'react-icons/md';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAppSelector } from '../../redux/hooks';
import { DEFAULT_ON_MODULE_IDS } from '../../config/modules';
import { selectModuleActions } from '../../redux/slices/permissions';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  onHoverChange: (hovered: boolean) => void;
  onLogoutClick?: () => void;
}

type SidebarLink = {
  to: string;
  label: string;
  icon: JSX.Element;
  moduleId?: string;
};


// Module-level so the menu scroll survives the remount on each route change.
let savedSidebarScroll = 0;

const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggleSidebar, onHoverChange, onLogoutClick }) => {
  const { type, admin, branch, staff } = useAppSelector((state: any) => state.auth);

  const { settings } = useAppSelector((state: any) => state.adminsettings);
  const location = useLocation();
  const [isHovered, setIsHovered] = React.useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Restore menu scroll position after remount/navigation
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = savedSidebarScroll;
  }, [location.pathname]);

  const role = type?.toString().toLowerCase();
  const isAdmin = role === "admin";
  const isBranch = role === "branch";
  const isStaff = role === "staff";

  // Module allowance chain: business → branch → staff
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

  const isModuleAllowed = (moduleId: string) => {
    const mid = moduleId.toLowerCase();
    const includes = (arr: string[]) => arr.map((m: any) => m.toString().toLowerCase()).includes(mid);

    // Default-on system modules skip the business gate (never offered in the checklist).
    if (DEFAULT_ON_MODULE_IDS.map((m) => m.toLowerCase()).includes(mid)) return true;

    // 1. Business level, required for all roles
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

  // Announcements menu hides when no permission box is ticked.
  const annActions = useAppSelector((state) => selectModuleActions(state, "announcements"));
  const announcementsUsed = annActions.showAdd || annActions.showEdit || annActions.showDelete || annActions.canReset;

  const FEATURE_TO_MODULES: Record<string, string[]> = {
    enableGst: ["reports.gst"],
  };

  const filterLinks = <T extends SidebarLink>(links: T[]): T[] => {
    return links.filter((link) => {
      const moduleId = link.moduleId;
      if (!moduleId) return true;

      if (settings) {
        const flag = Object.entries(FEATURE_TO_MODULES).find(([_, ids]) => ids.includes(moduleId))?.[0];
        if (flag && settings[flag] === false) return false;
      }

      if (!isModuleAllowed(moduleId)) return false;
      if (moduleId === "announcements" && !announcementsUsed) return false;

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
    icon: <FaHome className="text-cyan-400 text-[15px] flex-shrink-0" />
  };

  // Sidebar link registry
  const ALL_LINKS: (SidebarLink & { roles: string[]; section?: string })[] = [
    { to: '/branches', label: 'Branches', icon: <FaCodeBranch className="text-amber-400 text-[15px] flex-shrink-0" />, moduleId: "branches", roles: ["admin"] },
    { to: '/categories', label: 'Categories', icon: <FaTags className="text-rose-400 text-[15px] flex-shrink-0" />, moduleId: "categories", roles: ["admin", "branch", "staff"] },
    { to: '/subcategories', label: 'Sub Categories', icon: <FaIndent className="text-blue-400 text-[15px] flex-shrink-0" />, moduleId: "subcategories", roles: ["admin", "branch", "staff"] },
    { to: '/sizes', label: 'Sizes', icon: <FaRulerCombined className="text-purple-400 text-[15px] flex-shrink-0" />, moduleId: "sizes", roles: ["admin", "branch", "staff"] },
    { to: '/brands', label: 'Brands', icon: <MdBrandingWatermark className="text-emerald-400 text-[15px] flex-shrink-0" />, moduleId: "brands", roles: ["admin", "branch", "staff"] },
    { to: '/models', label: 'Models', icon: <FaMobileAlt className="text-cyan-400 text-[15px] flex-shrink-0" />, moduleId: "models", roles: ["admin", "branch", "staff"] },
    { to: '/productgroups', label: 'Product Groups', icon: <FaLayerGroup className="text-yellow-400 text-[15px] flex-shrink-0" />, moduleId: "productgroups", roles: ["admin", "branch", "staff"] },
    { to: '/units', label: 'Units', icon: <FaBalanceScale className="text-orange-400 text-[15px] flex-shrink-0" />, moduleId: "units", roles: ["admin", "branch", "staff"] },
    { to: '/accountgroups', label: 'Account Groups', icon: <FaUsers className="text-teal-400 text-[15px] flex-shrink-0" />, moduleId: "accountgroups", roles: ["admin", "branch", "staff"], section: "Accounts" },
    { to: '/accountledgers', label: 'Account Ledgers', icon: <FaMoneyBillWave className="text-green-400 text-[15px] flex-shrink-0" />, moduleId: "accountledgers", roles: ["admin", "branch", "staff"], section: "Accounts" },
    { to: '/staffaccounts', label: 'Staff Accounts', icon: <FaUserTie className="text-indigo-400 text-[15px] flex-shrink-0" />, moduleId: "staffaccounts", roles: ["admin", "branch", "staff"], section: "Accounts" },
    { to: '/accounts', label: 'Party Accounts', icon: <FaUser className="text-pink-400 text-[15px] flex-shrink-0" />, moduleId: "accounts", roles: ["admin", "branch", "staff"], section: "Accounts" },
    { to: '/products', label: 'Products', icon: <FaBoxOpen className="text-amber-500 text-[15px] flex-shrink-0" />, moduleId: "products", roles: ["admin", "branch", "staff"], section: "Branch" },
    { to: '/salesorder', label: 'Sales Orders', icon: <FaClipboardList className="text-cyan-500 text-[15px] flex-shrink-0" />, moduleId: "salesorder", roles: ["admin", "branch", "staff"], section: "Branch" },
    { to: '/salesinvoice', label: 'Sales Invoices', icon: <FaFileInvoiceDollar className="text-emerald-500 text-[15px] flex-shrink-0" />, moduleId: "salesinvoice", roles: ["admin", "branch", "staff"], section: "Branch" },
    { to: '/deliverychallan', label: 'Delivery Challans', icon: <FaTruck className="text-sky-500 text-[15px] flex-shrink-0" />, moduleId: "deliverychallan", roles: ["admin", "branch", "staff"], section: "Branch" },
    { to: '/salesreturn', label: 'Sales Returns', icon: <FaUndoAlt className="text-rose-500 text-[15px] flex-shrink-0" />, moduleId: "salesreturn", roles: ["admin", "branch", "staff"], section: "Branch" },
    { to: '/purchaseorder', label: 'Purchase Orders', icon: <FaClipboardList className="text-teal-400 text-[15px] flex-shrink-0" />, moduleId: "purchaseorder", roles: ["admin", "branch", "staff"], section: "Branch" },
    { to: '/purchaseinvoice', label: 'Purchase Invoices', icon: <FaReceipt className="text-blue-500 text-[15px] flex-shrink-0" />, moduleId: "purchaseinvoice", roles: ["admin", "branch", "staff"], section: "Branch" },
    { to: '/purchasereturn', label: 'Purchase Returns', icon: <FaUndoAlt className="text-red-400 text-[15px] flex-shrink-0" />, moduleId: "purchasereturn", roles: ["admin", "branch", "staff"], section: "Branch" },
    { to: '/transferstock', label: 'Transfer Stock', icon: <FaExchangeAlt className="text-purple-500 text-[15px] flex-shrink-0" />, moduleId: "transferstock", roles: ["admin", "branch", "staff"], section: "Branch" },
    { to: '/stockadjustments', label: 'Stock Adjustments', icon: <FaWrench className="text-yellow-500 text-[15px] flex-shrink-0" />, moduleId: "stockadjustments", roles: ["admin", "branch", "staff"], section: "Branch" },
    { to: '/expensenote', label: 'Expense Notes', icon: <FaMoneyCheckAlt className="text-emerald-400 text-[15px] flex-shrink-0" />, moduleId: "expensenote", roles: ["admin", "branch", "staff"], section: "Branch" },
    { to: '/transactions', label: 'Transactions', icon: <FaFileInvoiceDollar className="text-emerald-500 text-[15px] flex-shrink-0" />, moduleId: "transactions", roles: ["admin", "branch", "staff"], section: "Branch" },
    { to: '/payments', label: 'Payments', icon: <FaWallet className="text-emerald-400 text-[15px] flex-shrink-0" />, moduleId: "payments", roles: ["admin", "branch", "staff"], section: "Branch" },
    { to: '/attendance', label: 'Attendance & Leave', icon: <FaCalendarCheck className="text-orange-500 text-[15px] flex-shrink-0" />, moduleId: "attendance", roles: ["admin", "branch", "staff"], section: "Branch" },
    { to: '/announcements', label: 'Announcements', icon: <FaBullhorn className="text-pink-500 text-[15px] flex-shrink-0" />, moduleId: "announcements", roles: ["admin", "branch", "staff"], section: "Branch" },

    { to: '/channels', label: 'Channels', icon: <FaSitemap className="text-cyan-400 text-[15px] flex-shrink-0" />, moduleId: "channels", roles: ["admin", "branch", "staff"], section: "Distribution" },
    { to: '/salesroutes', label: 'Sales Routes', icon: <FaRoute className="text-indigo-400 text-[15px] flex-shrink-0" />, moduleId: "salesroutes", roles: ["admin", "branch", "staff"], section: "Distribution" },
    { to: '/pricelists', label: 'Price Lists', icon: <FaTags className="text-rose-400 text-[15px] flex-shrink-0" />, moduleId: "pricelists", roles: ["admin", "branch", "staff"], section: "Distribution" },
    { to: '/priceassignments', label: 'Price Assignments', icon: <FaClipboardList className="text-amber-400 text-[15px] flex-shrink-0" />, moduleId: "priceassignments", roles: ["admin", "branch", "staff"], section: "Distribution" },
    { to: '/chargerules', label: 'Charge Rules', icon: <FaMoneyBillWave className="text-lime-500 text-[15px] flex-shrink-0" />, moduleId: "chargerules", roles: ["admin", "branch", "staff"], section: "Distribution" },

    { to: '/reports/sales', label: 'Sales Reports', icon: <FaChartBar className="text-blue-400 text-[15px] flex-shrink-0" />, moduleId: "reports.sales", roles: ["admin", "branch", "staff"], section: "Reports" },
    { to: '/reports/purchase', label: 'Purchase Reports', icon: <FaFileAlt className="text-violet-400 text-[15px] flex-shrink-0" />, moduleId: "reports.purchase", roles: ["admin", "branch", "staff"], section: "Reports" },
    { to: '/reports/stock', label: 'Stock Reports', icon: <FaClipboardList className="text-cyan-400 text-[15px] flex-shrink-0" />, moduleId: "reports.stock", roles: ["admin", "branch", "staff"], section: "Reports" },
    { to: '/reports/gst', label: 'GST Reports', icon: <FaFileInvoiceDollar className="text-emerald-400 text-[15px] flex-shrink-0" />, moduleId: "reports.gst", roles: ["admin", "branch", "staff"], section: "Reports" },
    { to: '/reports/product', label: 'Product Statement', icon: <FaBoxes className="text-rose-400 text-[15px] flex-shrink-0" />, moduleId: "reports.product", roles: ["admin", "branch", "staff"], section: "Reports" },
    { to: '/reports/accounting', label: 'Accounting / Finance', icon: <FaWallet className="text-emerald-400 text-[15px] flex-shrink-0" />, moduleId: "reports.accounting", roles: ["admin", "branch", "staff"], section: "Reports" },
    { to: '/reports/party', label: 'Party / Vendor', icon: <FaUsers className="text-teal-400 text-[15px] flex-shrink-0" />, moduleId: "reports.party", roles: ["admin", "branch", "staff"], section: "Reports" },
    { to: '/reports/salesmen', label: 'Staff Reports', icon: <FaUserTie className="text-indigo-400 text-[15px] flex-shrink-0" />, moduleId: "reports.salesmen", roles: ["admin", "branch", "staff"], section: "Reports" },
    { to: '/reports/salesmanfield', label: 'Salesman Field Report', icon: <FaRoute className="text-cyan-400 text-[15px] flex-shrink-0" />, moduleId: "reports.salesmanfield", roles: ["admin", "branch", "staff"], section: "Reports" },
    { to: '/reports/deliveryboy', label: 'Delivery Boy Report', icon: <FaExchangeAlt className="text-lime-400 text-[15px] flex-shrink-0" />, moduleId: "reports.delivery", roles: ["admin", "branch", "staff"], section: "Reports" },
    { to: '/reports/analytical', label: 'Analytical Reports', icon: <FaChartLine className="text-emerald-400 text-[15px] flex-shrink-0" />, moduleId: "reports.analytical", roles: ["admin", "branch", "staff"], section: "Reports" },
    { to: '/reports/attendance', label: 'Attendance & Leave', icon: <FaCalendarCheck className="text-orange-400 text-[15px] flex-shrink-0" />, moduleId: "reports.attendance", roles: ["admin", "branch", "staff"], section: "Reports" },
  ];

  const filteredLinks = filterLinks(ALL_LINKS.filter(l => l.roles.includes(role || "")));

  // Menu groups, desktop-app style. Links without a section are the masters.
  type Group = { name: string; links: SidebarLink[] };
  const groups: Group[] = [];
  const mainLinks = filteredLinks.filter(l => !l.section);
  if (mainLinks.length) groups.push({ name: "Masters", links: mainLinks });
  Array.from(new Set(filteredLinks.map(l => l.section).filter(Boolean)) as Set<string>).forEach(secName => {
    const links = filteredLinks.filter(l => l.section === secName);
    if (links.length) groups.push({ name: secName, links });
  });
  const settingsLink: SidebarLink | null = (isAdmin || isBranch)
    ? { to: "/settings", label: "Settings", icon: <FaCog className="text-slate-400 text-[15px] flex-shrink-0" /> }
    : null;

  const isExpanded = isOpen || isHovered;
  const navigate = useNavigate();
  const isActive = (to: string) => location.pathname === to || location.pathname.startsWith(to + "/");

  // Collapsible groups, remembered per browser; the active page's group stays open.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem("sidebar:collapsed") || "{}"); } catch { return {}; }
  });
  const toggleGroup = (name: string) =>
    setCollapsed(prev => {
      const next = { ...prev, [name]: !prev[name] };
      try { localStorage.setItem("sidebar:collapsed", JSON.stringify(next)); } catch { /* storage blocked */ }
      return next;
    });

  // Menu search — Ctrl/⌘+K, type, Enter opens the highlighted screen.
  const [query, setQuery] = useState("");
  const [hit, setHit] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return [] as SidebarLink[];
    const all = [homeLink, ...groups.flatMap(g => g.links.map(l => ({ ...l, group: g.name }))), ...(settingsLink ? [settingsLink] : [])];
    return all.filter((l: any) => l.label.toLowerCase().includes(q) || (l.group || "").toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filteredLinks.length]);
  useEffect(() => setHit(0), [q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (!isOpen) toggleSidebar();
        setTimeout(() => searchRef.current?.focus(), 0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, toggleSidebar]);

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHit(h => Math.min(h + 1, matches.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHit(h => Math.max(h - 1, 0)); }
    else if (e.key === "Enter" && matches[hit]) {
      e.preventDefault();
      navigate(matches[hit].to, { state: { from: location.pathname } });
      setQuery("");
    } else if (e.key === "Escape") {
      e.preventDefault(); // keep a form behind the menu from treating it as Cancel
      setQuery("");
      searchRef.current?.blur();
    }
  };

  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  const renderLink = (item: SidebarLink, highlighted = false) => {
    const active = isActive(item.to);
    return (
      <Link
        key={item.to}
        to={item.to}
        title={!isExpanded ? item.label : undefined}
        state={{ from: location.pathname }}
        className={`group relative flex items-center rounded-md text-[13px] transition-colors ${
          isExpanded ? "h-8 gap-2.5 px-2.5" : "mx-auto h-9 w-9 justify-center"
        } ${
          active
            ? "bg-cyan-500/15 font-semibold text-white"
            : highlighted
              ? "bg-slate-800 text-white"
              : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
        }`}
      >
        {active && <span className="absolute inset-y-1 left-0 w-[3px] rounded-r bg-cyan-400" />}
        <span className="flex w-4 shrink-0 items-center justify-center">{item.icon}</span>
        {isExpanded && <span className="truncate">{item.label}</span>}
      </Link>
    );
  };

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
          className={`fixed top-12 left-0 bottom-0 z-40 flex flex-col border-r border-slate-800 bg-slate-950 transition-[width] duration-200 ease-out ${
            isExpanded ? `w-60 ${!isOpen ? 'shadow-2xl' : ''}` : 'w-14'
          } ${isOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'}`}
      >
        {/* Menu search */}
        <div className="shrink-0 border-b border-slate-800/80 p-2">
          {isExpanded ? (
            <div className="relative">
              <FaSearch className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-500" />
              <input
                ref={searchRef}
                data-own-esc
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onSearchKey}
                placeholder="Search menu…"
                className="h-8 w-full rounded-md border border-slate-700 bg-slate-900 pl-7 pr-12 text-[13px] text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-500"
              />
              <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-slate-700 px-1 text-[10px] text-slate-500">
                {isMac ? "⌘K" : "Ctrl+K"}
              </kbd>
            </div>
          ) : (
            <button
              type="button"
              title={`Search menu (${isMac ? "⌘K" : "Ctrl+K"})`}
              onClick={() => { toggleSidebar(); setTimeout(() => searchRef.current?.focus(), 0); }}
              className="mx-auto grid h-8 w-9 place-items-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <FaSearch className="text-xs" />
            </button>
          )}
        </div>

        <nav
          ref={scrollRef}
          onScroll={(e) => { savedSidebarScroll = e.currentTarget.scrollTop; }}
          className="flex-1 overflow-y-auto overflow-x-hidden p-2"
          key={`${businessAllowed?.join(',') || 'all'}_${branchAllowed?.join(',') || 'x'}_${staffAllowed?.join(',') || 'x'}`}
        >
          {q ? (
            <div className="space-y-0.5">
              {matches.length === 0 && <p className="px-2.5 py-2 text-[12px] text-slate-500">No menu matches “{query}”</p>}
              {matches.map((m, i) => renderLink(m, i === hit))}
            </div>
          ) : (
            <>
              <div className="space-y-0.5">{renderLink(homeLink)}</div>
              {groups.map(g => {
                const holdsActive = g.links.some(l => isActive(l.to));
                const open = !collapsed[g.name] || holdsActive;
                return (
                  <div key={g.name} className="mt-2">
                    {isExpanded ? (
                      <button
                        type="button"
                        onClick={() => toggleGroup(g.name)}
                        className="flex h-7 w-full items-center gap-1 rounded px-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-300"
                      >
                        <span className="flex-1 text-left">{g.name}</span>
                        <span className="font-medium normal-case tracking-normal text-slate-600">{g.links.length}</span>
                        <FaChevronDown className={`text-[9px] transition-transform ${open ? "" : "-rotate-90"}`} />
                      </button>
                    ) : (
                      <div className="mx-3 my-1.5 border-t border-slate-800" />
                    )}
                    {(open || !isExpanded) && <div className="space-y-0.5">{g.links.map(l => renderLink(l))}</div>}
                  </div>
                );
              })}
            </>
          )}
        </nav>

        {!q && (settingsLink || onLogoutClick) && (
          <div className="shrink-0 border-t border-slate-800/80 p-2 space-y-0.5">
            {settingsLink && renderLink(settingsLink)}
            {onLogoutClick && (
              <button
                type="button"
                onClick={onLogoutClick}
                title={!isExpanded ? "Logout" : undefined}
                className={`flex w-full items-center rounded-md text-[13px] text-rose-400 transition-colors hover:bg-slate-800/70 hover:text-rose-300 ${
                  isExpanded ? "h-8 gap-2.5 px-2.5" : "mx-auto h-9 w-9 justify-center"
                }`}
              >
                <span className="flex w-4 shrink-0 items-center justify-center"><FaSignOutAlt className="text-[15px]" /></span>
                {isExpanded && <span className="truncate">Logout</span>}
              </button>
            )}
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;
