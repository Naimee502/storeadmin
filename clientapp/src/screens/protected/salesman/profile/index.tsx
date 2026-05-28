import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@apollo/client/react';
import { useDispatch, useSelector } from 'react-redux';
import { COLORS, FONTS, useTheme } from '../../../../config';
import { formatINR } from '../../../../utils';
import { ProfileSkeleton } from '../../../../config/skeletonlayouts';
import { AppHeader, AppModal } from '../../../../components';
import { GET_STAFF_ACCOUNT } from '../../../../apollo/queries/staffaccounts';
import { logout } from '../../../../store/slices';
import { useAuth } from '../../../../navigation';
import type { RootState } from '../../../../store/rootreducer';

const MENU_ITEMS = [
  { icon: 'bell-outline',          label: 'Notifications',      screen: 'Notifications'  },
  { icon: 'help-circle-outline',   label: 'Help & Support',     screen: 'Support'        },
  { icon: 'shield-check-outline',  label: 'Privacy Policy',     screen: 'PrivacyPolicy'  },
  { icon: 'file-document-outline', label: 'Terms & Conditions', screen: 'TermsCondition' },
];

function InfoRow({ icon, label, value, colors }: { icon: string; label: string; value?: string | null; colors: any }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: colors.brandSoft }]}>
        <Icon name={icon} size={14} color={colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.infoLabel, { color: colors.subText }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
      </View>
    </View>
  );
}

export default function SalesmanProfile() {
  const navigation  = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const dispatch    = useDispatch();
  const { signOut } = useAuth();
  const user        = useSelector((s: RootState) => s.auth.user);
  const adminId     = useSelector((s: RootState) => s.tenant.adminId) ?? '';
  const [logoutModal, setLogoutModal] = useState(false);

  const { data, loading } = useQuery(GET_STAFF_ACCOUNT, {
    variables: { id: user?.id, adminId },
    skip: !user?.id,
  });

  const account = data?.getStaffAccountById;

  const handleLogout = async () => {
    setLogoutModal(false);
    dispatch(logout());
    await signOut();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />
      <AppHeader label="Profile" />

      {loading ? <ProfileSkeleton /> : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          <Animated.View entering={FadeInUp.duration(400).delay(60)}>
            <LinearGradient colors={[colors.brandSoft, colors.cardGlass]} style={[styles.avatarCard, { borderColor: colors.border }]}>
              <View style={[styles.avatar, { backgroundColor: colors.brand }]}>
                <Text style={styles.avatarText}>{(user?.name ?? 'S').charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={[styles.userName, { color: colors.text }]}>{user?.name ?? account?.name ?? 'Salesman'}</Text>
              <View style={[styles.roleBadge, { backgroundColor: colors.brand + '22' }]}>
                <Icon name="account-tie-outline" size={12} color={colors.brand} />
                <Text style={[styles.roleText, { color: colors.brand }]}>Salesman</Text>
                {account?.staffcode ? (
                  <Text style={[styles.staffCode, { color: colors.brand }]}>· {account.staffcode}</Text>
                ) : null}
              </View>
            </LinearGradient>
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(400).delay(120)}
            style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>Account Details</Text>
            <InfoRow icon="phone-outline"           label="Mobile"            value={account?.mobile ?? user?.mobile}                                                                   colors={colors} />
            <InfoRow icon="email-outline"           label="Email"             value={account?.email  ?? user?.email}                                                                    colors={colors} />
            <InfoRow icon="shield-account-outline"  label="Role"              value={account?.role}                                                                                     colors={colors} />
            <InfoRow icon="office-building-outline" label="Branch"            value={account?.branchid?.branchname}                                                                    colors={colors} />
            <InfoRow icon="map-marker-path"         label="Assigned Channels" value={account?.assignedChannels?.map((c: any) => c.channelName).join(', ') || null}                   colors={colors} />
            <InfoRow icon="map-marker-outline"      label="Address"           value={account?.address}                                                                                 colors={colors} />
            <InfoRow icon="currency-inr"            label="Commission"        value={account?.commission ? `${account.commission}%` : null}                                            colors={colors} />
            <InfoRow icon="cash-multiple"           label="Salary"            value={account?.salary ? formatINR(account.salary) : null}                                               colors={colors} />
            <InfoRow icon="book-account-outline"    label="Ledger"            value={account?.ledgerid?.ledgername}                                                                    colors={colors} />
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(400).delay(180)}
            style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
          >
            {MENU_ITEMS.map((item, i) => (
              <TouchableOpacity
                key={item.screen}
                style={[styles.menuRow, i < MENU_ITEMS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
                onPress={() => navigation.navigate(item.screen)}
                activeOpacity={0.7}
              >
                <View style={[styles.menuIcon, { backgroundColor: colors.brandSoft }]}>
                  <Icon name={item.icon} size={16} color={colors.brand} />
                </View>
                <Text style={[styles.menuLabel, { color: colors.text }]}>{item.label}</Text>
                <Icon name="chevron-right" size={16} color={colors.subText} />
              </TouchableOpacity>
            ))}
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(400).delay(220)}>
            <TouchableOpacity
              style={[styles.signOutRow, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}
              onPress={() => setLogoutModal(true)}
            >
              <View style={styles.signOutIconWrap}>
                <Icon name="logout-variant" size={18} color={colors.error} />
              </View>
              <Text style={[styles.signOutText, { color: colors.error }]}>Sign Out</Text>
              <Icon name="chevron-right" size={18} color={colors.error} style={{ opacity: 0.5 }} />
            </TouchableOpacity>
          </Animated.View>

        </ScrollView>
      )}

      <AppModal
        visible={logoutModal} title="Sign Out" message="Are you sure you want to sign out?"
        confirmLabel="Sign Out" cancelLabel="Cancel" confirmColor={colors.error}
        iconName="logout-variant" onClose={() => setLogoutModal(false)} onConfirm={handleLogout}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll:    { paddingHorizontal: 18, paddingBottom: 110 },
  avatarCard: { borderRadius: 24, borderWidth: 1, padding: 24, alignItems: 'center', marginTop: 14, marginBottom: 14 },
  avatar:     { width: 72, height: 72, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 12, shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  avatarText: { fontSize: 28, fontFamily: FONTS.bold, color: '#fff' },
  userName:   { fontSize: 18, fontFamily: FONTS.bold, marginBottom: 8 },
  roleBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  roleText:   { fontSize: 12, fontFamily: FONTS.semiBold },
  staffCode:  { fontSize: 12, fontFamily: FONTS.semiBold },
  card: { borderRadius: 20, borderWidth: 1, padding: 16, marginBottom: 14, shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  cardTitle:  { fontSize: 13, fontFamily: FONTS.bold, marginBottom: 14, opacity: 0.6 },
  infoRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  infoIcon:   { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  infoLabel:  { fontSize: 10, fontFamily: FONTS.regular },
  infoValue:  { fontSize: 13, fontFamily: FONTS.semiBold, marginTop: 1 },
  menuRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, gap: 12 },
  menuIcon:   { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  menuLabel:  { flex: 1, fontSize: 14, fontFamily: FONTS.semiBold },
  signOutRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, borderWidth: 1.5, padding: 14, marginBottom: 14 },
  signOutIconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center' },
  signOutText:     { flex: 1, fontSize: 14, fontFamily: FONTS.bold },
});
