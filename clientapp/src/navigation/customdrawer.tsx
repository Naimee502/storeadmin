import React, { useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ScrollView } from 'react-native';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
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
  { label: STRINGS.party.ledger,  icon: 'book-account-outline',   tabScreen: 'Ledger'    },
  { label: 'Payments',            icon: 'cash-multiple',          tabScreen: 'Payments'  },
  { label: STRINGS.party.profile, icon: 'account-circle-outline', screen: 'PartyProfile' },
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
  const { colors, isDark } = useTheme();
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);

  const role  = user?.role ?? 'party';
  const menu  = ROLE_MENUS[role] ?? PARTY_MENU;
  const label = ROLE_LABELS[role] ?? 'User';

  const tabState     = props.state.routes[0]?.state;
  const activeTabIdx = tabState?.index ?? 0;
  const activeTab    = tabState ? (tabState.routes as any[])[activeTabIdx]?.name : undefined;

  const handleLogout = async () => {
    setModalVisible(false);
    dispatch(logout());
    await signOut();
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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <LinearGradient
          colors={isDark ? [colors.brandSoft, colors.brandSoft] : [colors.brandSoft, '#f0fdf4']}
          style={styles.header}
        >
          <View style={[styles.avatarWrap, { backgroundColor: colors.brand }]}>
            <Text style={styles.avatarText}>
              {(user?.name ?? 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
            {user?.name ?? 'User'}
          </Text>
          {user?.mobile && (
            <Text style={[styles.userMobile, { color: colors.subText }]}>
              +91 {user.mobile}
            </Text>
          )}
          <View style={[styles.roleBadge, { backgroundColor: colors.brandOverlay }]}>
            <Icon name="shield-account-outline" size={11} color={colors.brand} />
            <Text style={[styles.roleBadgeText, { color: colors.brand }]}>{label}</Text>
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
  content: { paddingBottom: 24 },

  header: {
    margin: 14,
    padding: 18,
    borderRadius: 24,
  },
  avatarWrap: {
    width: 52, height: 52, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },
  avatarText:  { fontSize: 22, fontFamily: FONTS.bold, color: '#fff' },
  userName:    { fontSize: 17, fontFamily: FONTS.bold, marginBottom: 2 },
  userMobile:  { fontSize: 12, fontFamily: FONTS.regular, marginBottom: 8 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, gap: 4,
  },
  roleBadgeText: { fontSize: 11, fontFamily: FONTS.semiBold },

  divider:  { height: 1, marginVertical: 8, marginHorizontal: 14, opacity: 0.6 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 14, marginVertical: 1,
    paddingVertical: 10, paddingHorizontal: 8,
    borderRadius: 14,
  },
  menuIconWrap: {
    width: 36, height: 36, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  menuLabel: { fontSize: 14, fontFamily: FONTS.semiBold, flex: 1 },
  activeBar: { width: 4, height: 20, borderRadius: 2 },
});
