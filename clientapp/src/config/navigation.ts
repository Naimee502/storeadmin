import {
  Login, Signup, ForgotPassword, Splash, Introduction,
  PrivacyPolicy, TermsCondition, Notifications, Support, OTPVerification,
  // Party
  PartyHome, Catalog, MyOrders, Ledger, LedgerDetail, Payments, PaymentDetail, PartyProfile,
  ProductDetail, OrderDetail, CartScreen,
  // Salesman
  SalesmanDashboard, SalesmanRoutes, SalesmanOrders, SalesmanAttendance, SalesmanProfile,
  RoutePartyVisit, SalesmanCatalog, SalesmanCart, CollectPayment, AddPartyToRoute, ManagePartyRoute,
  // Delivery boy
  DeliveryDashboard, DeliveryList, DeliveryCollections, DeliveryAttendance, DeliveryProfile, DeliveryCollectPayment,
  // Staff
  StaffDashboard, StaffOrders, StaffAttendance, StaffProfile,
  StaffParties, StaffCreateParty, StaffCatalog, StaffCart,
} from '../screens';

export const Screens: any = {
  // Public
  Splash,
  Introduction,
  Login,
  Signup,
  ForgotPassword,
  OTPVerification,
  // Shared
  PrivacyPolicy,
  TermsCondition,
  Notifications,
  Support,
  // Party
  PartyHome,
  Catalog,
  MyOrders,
  Ledger,
  LedgerDetail,
  Payments,
  PaymentDetail,
  PartyProfile,
  ProductDetail,
  OrderDetail,
  CartScreen,
  // Salesman
  SalesmanDashboard,
  SalesmanRoutes,
  SalesmanOrders,
  SalesmanAttendance,
  SalesmanProfile,
  RoutePartyVisit,
  SalesmanCatalog,
  SalesmanCart,
  CollectPayment,
  AddPartyToRoute,
  ManagePartyRoute,
  // Delivery boy
  DeliveryDashboard,
  DeliveryList,
  DeliveryCollections,
  DeliveryAttendance,
  DeliveryProfile,
  DeliveryCollectPayment,
  // Staff
  StaffDashboard,
  StaffOrders,
  StaffAttendance,
  StaffProfile,
  StaffParties,
  StaffCreateParty,
  StaffCatalog,
  StaffCart,
};

export const NavIcons = {
  // common
  home:       { focused: 'home',             unfocused: 'home-outline' },
  profile:    { focused: 'account-circle',   unfocused: 'account-circle-outline' },
  // party
  catalog:    { focused: 'store',            unfocused: 'store-outline' },
  orders:     { focused: 'clipboard-list',   unfocused: 'clipboard-list-outline' },
  ledger:     { focused: 'book-account',     unfocused: 'book-account-outline' },
  payments:   { focused: 'cash-multiple',    unfocused: 'cash-multiple' },
  // salesman / delivery
  dashboard:  { focused: 'view-dashboard',   unfocused: 'view-dashboard-outline' },
  routes:     { focused: 'map-marker-path',  unfocused: 'map-marker-path' },
  salesOrders:{ focused: 'clipboard-plus',   unfocused: 'clipboard-plus-outline' },
  attendance: { focused: 'calendar-check',   unfocused: 'calendar-check-outline' },
  deliveries: { focused: 'truck-delivery',   unfocused: 'truck-delivery-outline' },
  collections:{ focused: 'cash-multiple',    unfocused: 'cash-multiple' },
  staffOrders:{ focused: 'clipboard-list',   unfocused: 'clipboard-list-outline' },
};

export const getNavIcon = (name: keyof typeof NavIcons) => NavIcons[name];

export const NavConfig: any = {
  // ── Public stack ────────────────────────────────────────────────────
  public: {
    type: 'stack',
    screens: [
      { name: 'Login',            options: { headerShown: false } },
      { name: 'Signup',           label: 'Create Account',  options: { title: 'Create Account',    headerShown: false } },
      { name: 'ForgotPassword',   label: 'Reset Password',  options: { title: 'Recover Password',  headerShown: false } },
      { name: 'OTPVerification',  label: 'OTP Verification',options: { title: 'Verification',      headerShown: false } },
    ],
  },

  // ── Party: stack → drawer → tabs (detail screens pushed on outer stack) ──
  party: {
    type: 'stack',
    screens: [
      {
        name: 'PartyDrawer',
        options: { headerShown: false },
        subNavigator: {
          type: 'drawer',
          showDrawer: true,
          showBottomTabs: true,
          screens: [
            {
              name: 'MainTabs',
              label: 'Main',
              options: { headerShown: false },
              subNavigator: {
                type: 'tabs',
                screens: [
                  { name: 'PartyHome', label: 'Home',   icon: getNavIcon('home'),    options: { headerShown: false } },
                  { name: 'Catalog',   label: 'Shop',   icon: getNavIcon('catalog'), options: { headerShown: false } },
                  { name: 'MyOrders',  label: 'Orders', icon: getNavIcon('orders'),   options: { headerShown: false } },
                  { name: 'Ledger',    label: 'Ledger', icon: getNavIcon('ledger'),   options: { headerShown: false } },
                  { name: 'Payments',  label: 'Payments', icon: getNavIcon('payments'), options: { headerShown: false } },
                ],
              },
            },
            { name: 'PartyProfile', label: 'Profile',  icon: getNavIcon('profile'),  options: { headerShown: false } },
          ],
        },
      },
      { name: 'ProductDetail', options: { headerShown: false } },
      { name: 'OrderDetail',   options: { headerShown: false } },
      { name: 'LedgerDetail',  options: { headerShown: false } },
      { name: 'PaymentDetail', options: { headerShown: false } },
      { name: 'CartScreen',    options: { headerShown: false } },
    ],
  },

  // ── Salesman: stack → drawer → tabs ─────────────────────────────────
  salesman: {
    type: 'stack',
    screens: [
      {
        name: 'SalesmanDrawer',
        options: { headerShown: false },
        subNavigator: {
          type: 'drawer',
          showDrawer: true,
          showBottomTabs: true,
          screens: [
            {
              name: 'MainTabs',
              label: 'Main',
              options: { headerShown: false },
              subNavigator: {
                type: 'tabs',
                screens: [
                  { name: 'SalesmanDashboard',  label: 'Home',       icon: getNavIcon('home'),        options: { headerShown: false } },
                  { name: 'SalesmanRoutes',     label: 'Routes',     icon: getNavIcon('routes'),      options: { headerShown: false } },
                  { name: 'SalesmanOrders',     label: 'Orders',     icon: getNavIcon('salesOrders'), options: { headerShown: false } },
                  { name: 'SalesmanAttendance', label: 'Attendance & Leave', icon: getNavIcon('attendance'),  options: { headerShown: false } },
                  { name: 'SalesmanProfile',    label: 'Profile',    icon: getNavIcon('profile'),     options: { headerShown: false } },
                ],
              },
            },
          ],
        },
      },
      { name: 'RoutePartyVisit', options: { headerShown: false } },
      { name: 'SalesmanCatalog', options: { headerShown: false } },
      { name: 'SalesmanCart',    options: { headerShown: false } },
      { name: 'CollectPayment',   options: { headerShown: false } },
      { name: 'AddPartyToRoute',  options: { headerShown: false } },
      { name: 'ManagePartyRoute', options: { headerShown: false } },
      { name: 'OrderDetail',      options: { headerShown: false } },
    ],
  },

  // ── Delivery boy: stack → drawer → tabs ──────────────────────────────
  deliveryboy: {
    type: 'stack',
    screens: [
      {
        name: 'DeliveryDrawer',
        options: { headerShown: false },
        subNavigator: {
          type: 'drawer',
          showDrawer: true,
          showBottomTabs: true,
          screens: [
            {
              name: 'MainTabs',
              label: 'Main',
              options: { headerShown: false },
              subNavigator: {
                type: 'tabs',
                screens: [
                  { name: 'DeliveryDashboard',   label: 'Home',        icon: getNavIcon('home'),        options: { headerShown: false } },
                  { name: 'DeliveryList',        label: 'Deliveries',  icon: getNavIcon('deliveries'),  options: { headerShown: false } },
                  { name: 'DeliveryCollections', label: 'Collections', icon: getNavIcon('collections'), options: { headerShown: false } },
                  { name: 'DeliveryAttendance',  label: 'Attendance & Leave', icon: getNavIcon('attendance'),  options: { headerShown: false } },
                  { name: 'DeliveryProfile',     label: 'Profile',     icon: getNavIcon('profile'),     options: { headerShown: false } },
                ],
              },
            },
          ],
        },
      },
      { name: 'DeliveryCollectPayment', options: { headerShown: false } },
    ],
  },

  // ── Staff: stack → drawer → tabs ─────────────────────────────────────
  staff: {
    type: 'stack',
    screens: [
      {
        name: 'StaffDrawer',
        options: { headerShown: false },
        subNavigator: {
          type: 'drawer',
          showDrawer: true,
          showBottomTabs: true,
          screens: [
            {
              name: 'MainTabs',
              label: 'Main',
              options: { headerShown: false },
              subNavigator: {
                type: 'tabs',
                screens: [
                  { name: 'StaffDashboard',  label: 'Home',       icon: getNavIcon('home'),        options: { headerShown: false } },
                  { name: 'StaffOrders',     label: 'Orders',     icon: getNavIcon('staffOrders'), options: { headerShown: false } },
                  { name: 'StaffAttendance', label: 'Attendance & Leave', icon: getNavIcon('attendance'),  options: { headerShown: false } },
                  { name: 'StaffProfile',    label: 'Profile',    icon: getNavIcon('profile'),     options: { headerShown: false } },
                ],
              },
            },
          ],
        },
      },
      { name: 'StaffParties',     options: { headerShown: false } },
      { name: 'StaffCreateParty', options: { headerShown: false } },
      { name: 'StaffCatalog',     options: { headerShown: false } },
      { name: 'StaffCart',        options: { headerShown: false } },
      { name: 'OrderDetail',      options: { headerShown: false } },
    ],
  },

  // ── Shared modals ────────────────────────────────────────────────────
  shared: [
    { name: 'PrivacyPolicy',  options: { title: 'Privacy Policy',    presentation: 'modal' } },
    { name: 'TermsCondition', options: { title: 'Terms & Conditions', presentation: 'modal' } },
    { name: 'Notifications',  options: { headerShown: false } },
    { name: 'Support',        options: { headerShown: false } },
  ],
};

export const getScreenComponent = (
  name: string
): React.ComponentType<any> | null => {
  return Screens[name.replace('_Drawer', '')] || null;
};
