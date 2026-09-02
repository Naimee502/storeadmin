import React, { useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, InteractionManager } from 'react-native';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppModal } from '../components';
import { useAuth } from './authcontext';
import { COLORS, FONTS, STRINGS, useTheme } from '../config';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../store/slices';
import type { RootState } from '../store/rootreducer';

interface DrawerMenuItem {
  label: string;
  icon: string;
  screen?: string;
  tabScreen?: string;
  section?: boolean;
}

const PARTY_MENU: DrawerMenuItem[] = [
  { label: STRINGS.party.home,    icon: 'home-outline',           tabScreen: 'PartyHome' },
  { label: STRINGS.party.catalog, icon: 'store-outline',          tabScreen: 'Catalog'   },
  { label: STRINGS.party.orders,  icon: 'clipboard-list-outline', tabScreen: 'MyOrders'  },
  { label: 'Payments',            icon: 'cash-multiple',          tabScreen: 'Payments'  },
  { label: STRINGS.party.profile, icon: 'account-circle-outline', tabScreen: 'PartyProfile' },
  { label: 'separator1', icon: '', section: true },
  { label: 'Notifications', icon: 'bell-outline',       screen: 'Notifications' },
  { label: 'Help & Support', icon: 'help-circle-outline', screen: 'Support' },
  { label: 'separator2', icon: '', section: true },
  { label: 'Privacy Policy',    icon: 'shield-check-outline', screen: 'PrivacyPolicy' },
  { label: 'Terms & Conditions', icon: 'file-document-outline', screen: 'TermsCondition' },
];

const SALESMAN_MENU: DrawerMenuItem[] = [
  { label: 'Dashboard',   icon: 'view-dashboard-outline',  tabScreen: 'SalesmanDashboard'  },
  { label: 'My Routes',   icon: 'map-marker-path',         tabScreen: 'SalesmanRoutes'     },
  { label: 'Orders',      icon: 'clipboard-plus-outline',  tabScreen: 'SalesmanOrders'     },
  { label: 'separator1', icon: '', section: true },
  { label: 'Attendance',  icon: 'calendar-check-outline',  tabScreen: 'SalesmanAttendance' },
  { label: 'separator2', icon: '', section: true },
  { label: 'Notifications', icon: 'bell-outline',          screen: 'Notifications'  },
  { label: 'Help & Support', icon: 'help-circle-outline',  screen: 'Support'        },
  { label: 'separator3', icon: '', section: true },
  { label: 'Privacy Policy',     icon: 'shield-check-outline',  screen: 'PrivacyPolicy' },
  { label: 'Terms & Conditions', icon: 'file-document-outline', screen: 'TermsCondition' },
];

const DELIVERY_MENU: DrawerMenuItem[] = [
  { label: 'Dashboard',   icon: 'view-dashboard-outline',  tabScreen: 'DeliveryDashboard'   },
  { label: 'Deliveries',  icon: 'truck-delivery-outline',  tabScreen: 'DeliveryList'        },
  { label: 'Collections', icon: 'cash-multiple',           tabScreen: 'DeliveryCollections' },
  { label: 'separator1', icon: '', section: true },
  { label: 'Attendance',  icon: 'calendar-check-outline',  tabScreen: 'DeliveryAttendance'  },
  { label: 'separator2', icon: '', section: true },
  { label: 'Notifications', icon: 'bell-outline',         screen: 'Notifications' },
  { label: 'Help & Support', icon: 'help-circle-outline', screen: 'Support'       },
  { label: 'separator3', icon: '', section: true },
  { label: 'Privacy Policy',     icon: 'shield-check-outline',  screen: 'PrivacyPolicy' },
  { label: 'Terms & Conditions', icon: 'file-document-outline', screen: 'TermsCondition' },
];

const STAFF_MENU: DrawerMenuItem[] = [
  { label: 'Dashboard',  icon: 'view-dashboard-outline', tabScreen: 'StaffDashboard'  },
  { label: 'Orders',     icon: 'clipboard-list-outline', tabScreen: 'StaffOrders'     },
  { label: 'separator1', icon: '', section: true },
  { label: 'Attendance', icon: 'calendar-check-outline', tabScreen: 'StaffAttendance' },
  { label: 'separator2', icon: '', section: true },
  { label: 'Notifications', icon: 'bell-outline',         screen: 'Notifications' },
  { label: 'Help & Support', icon: 'help-circle-outline', screen: 'Support'       },
  { label: 'separator3', icon: '', section: true },
  { label: 'Privacy Policy',     icon: 'shield-check-outline',  screen: 'PrivacyPolicy' },
  { label: 'Terms & Conditions', icon: 'file-document-outline', screen: 'TermsCondition' },
];

const ROLE_LABELS: Record<string, string> = {
  party:       STRINGS.party.customer,
  salesman:    'Salesman',
  deliveryboy: 'Delivery Boy',
  staff:       'Staff',
};

const ROLE_MENUS: Record<string, DrawerMenuItem[]> = {
  party:       PARTY_MENU,
  salesman:    SALESMAN_MENU,
  deliveryboy: DELIVERY_MENU,
  staff:       STAFF_MENU,
};

export const CustomDrawerContent = (props: DrawerContentComponentProps) => {
  const [modalVisible, setModalVisible] = useState(false);
  const { signOut } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);

  const role  = user?.role ?? 'party';
  const menu  = ROLE_MENUS[role] ?? PARTY_MENU;
  const label = ROLE_LABELS[role] ?? 'User';

  const tabState     = props.state.routes[0]?.state;
  const activeTabIdx = tabState?.index ?? 0;
  const activeTab    = tabState ? (tabState.routes as any[])[activeTabIdx]?.name : undefined;

  const handleLogout = () => {
    setModalVisible(false);
    props.navigation.closeDrawer();
    // Defer the auth reset until the drawer/modal close transactions finish.
    // Resetting auth synchronously unmounts the whole navigator tree mid-
    // fragment-transaction, crashing with "FragmentManager is already
    // executing transactions" / removeViewAt errors on Android.
    InteractionManager.runAfterInteractions(() => {
      setTimeout(async () => {
        dispatch(logout());
        await signOut();
      }, 100);
    });
  };

  const navigateTo = (item: DrawerMenuItem) => {
    props.navigation.closeDrawer();
    if (item.tabScreen) {
      props.navigation.navigate('MainTabs', { screen: item.tabScreen });
    } else if (item.screen) {
      props.navigation.navigate(item.screen);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* The drawer slides over the whole screen, status bar included. The
          background is meant to run up behind the clock — only the content has
          to clear it, which is exactly what this padding does. Applied to the
          scroll content rather than with a SafeAreaView so the list still
          scrolls up into that space instead of being clipped short of it. The
          card's own margin supplies the gap; adding more here just left a band
          of empty white under the status bar. */}
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top, paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >

        {/* Header */}
        <LinearGradient
          colors={[colors.brandSoft, colors.brandSoftAlt]}
          style={styles.header}
        >
          {/* Avatar beside the details rather than above them. Stacked, the
              header ate roughly a third of the drawer before the first menu
              item — on a short phone that pushed Sign Out off the screen. Same
              information, about half the height, for every role. */}
          <View style={[styles.avatarWrap, { backgroundColor: colors.brand }]}>
            <Text style={styles.avatarText}>
              {(user?.name ?? 'U').charAt(0).toUpperCase()}
            </Text>
          </View>

          <View style={styles.headerText}>
            <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
              {user?.name ?? 'User'}
            </Text>
            {user?.mobile && (
              <Text style={[styles.userMobile, { color: colors.subText }]} numberOfLines={1}>
                +91 {user.mobile}
              </Text>
            )}
            <View style={[styles.roleBadge, { backgroundColor: colors.brandOverlay }]}>
              <Icon name="shield-account-outline" size={11} color={colors.brand} />
              <Text style={[styles.roleBadgeText, { color: colors.brand }]} numberOfLines={1}>{label}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Menu items */}
        {menu.map((item, idx) => {
          if (item.section) {
            return <View key={`sep-${idx}`} style={[styles.divider, { backgroundColor: colors.border }]} />;
          }
          const isActive = item.tabScreen ? item.tabScreen === activeTab : false;
          return (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuItem, isActive && { backgroundColor: colors.brandSoft }]}
              onPress={() => navigateTo(item)}
              activeOpacity={0.65}
            >
              <View style={[styles.menuIconWrap, { backgroundColor: isActive ? colors.brand + '22' : colors.softSurface }]}>
                <Icon name={item.icon} size={19} color={isActive ? colors.brand : colors.subText} />
              </View>
              <Text style={[styles.menuLabel, { color: isActive ? colors.brand : colors.text }]}>{item.label}</Text>
              {isActive && <View style={[styles.activeBar, { backgroundColor: colors.brand }]} />}
            </TouchableOpacity>
          );
        })}

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Logout */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.65}
        >
          <View style={[styles.menuIconWrap, { backgroundColor: '#FEF2F2' }]}>
            <Icon name="logout" size={19} color={colors.error} />
          </View>
          <Text style={[styles.menuLabel, { color: colors.error }]}>{STRINGS.party.signOut}</Text>
        </TouchableOpacity>

      </ScrollView>

      <AppModal
        visible={modalVisible}
        title={STRINGS.party.signOut}
        message={STRINGS.party.signOutConfirm}
        confirmLabel={STRINGS.party.signOut}
        cancelLabel="Cancel"
        confirmColor={colors.error}
        iconName="logout-variant"
        onClose={() => setModalVisible(false)}
        onConfirm={handleLogout}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root:    { flex: 1 },
  content: {},

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    margin: 14,
    padding: 14,
    borderRadius: 20,
  },
  avatarWrap: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },
  avatarText:  { fontSize: 20, fontFamily: FONTS.bold, color: '#fff' },
  // flex + minWidth let a long name ellipsize instead of shoving the avatar.
  headerText:  { flex: 1, minWidth: 0 },
  userName:    { fontSize: 16, fontFamily: FONTS.bold, marginBottom: 1 },
  userMobile:  { fontSize: 12, fontFamily: FONTS.regular, marginBottom: 5 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20, gap: 4,
  },
  roleBadgeText: { fontSize: 11, fontFamily: FONTS.semiBold },

  divider:  { height: 1, marginVertical: 8, marginHorizontal: 14, opacity: 0.6 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 14, marginVertical: 1,
    // Same inner padding as the header card, so every icon down the drawer
    // starts on the avatar's left edge instead of six pixels inside it.
    paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 14,
  },
  menuIconWrap: {
    width: 36, height: 36, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  menuLabel: { fontSize: 14, fontFamily: FONTS.semiBold, flex: 1 },
  activeBar: { width: 4, height: 20, borderRadius: 2 },
});
