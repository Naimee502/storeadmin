import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useQuery } from '@apollo/client/react';
import { useSelector, useDispatch } from 'react-redux';
import { COLORS, FONTS, STRINGS, useTheme } from '../../../../config';
import { ProfileSkeleton } from '../../../../config/skeletonlayouts';
import { GET_ACCOUNT } from '../../../../apollo/queries/party';
import { formatINR } from '../../../../utils';
import { AppHeader, AppModal } from '../../../../components';
import { logout } from '../../../../store/slices';
import { useAuth } from '../../../../navigation';
import type { RootState } from '../../../../store/rootreducer';

const DUMMY_ACCOUNT = {
  mobile:              '9876543210',
  email:               'mahesh.traders@example.com',
  gstnumber:           '27AABCU9603R1ZM',
  accountcode:         'CUST-001',
  address:             '15, Market Road',
  city:                'Nagpur',
  state:               'Maharashtra',
  pincode:             '440001',
  channel:             { name: 'Wholesale' },
  region:              'Western Maharashtra',
  salesmanid:          { name: 'Rahul Sharma' },
  creditlimit:         50000,
  openingbalance:      12000,
  openingbalancetype:  'Dr',
  ledgerid:            { ledgername: 'Mahesh Traders Ledger' },
};

function InfoRow({ icon, label, value, colors }: { icon: string; label: string; value?: string | null; colors: any }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: colors.brandSoft }]}>
        <Icon name={icon} size={15} color={colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.infoLabel, { color: colors.subText }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
      </View>
    </View>
  );
}

export default function PartyProfile() {
  const [logoutModal, setLogoutModal] = useState(false);
  const { colors, isDark } = useTheme();
  const dispatch  = useDispatch();
  const { signOut } = useAuth();
  const user    = useSelector((s: RootState) => s.auth.user);
  const tenant  = useSelector((s: RootState) => s.tenant);
  const adminid = tenant.adminId ?? '';

  const { data, loading } = useQuery(GET_ACCOUNT, {
    variables: { id: user?.id, adminId: adminid },
    skip: !adminid || !user?.id,
  });

  const account  = data?.getAccountById ?? DUMMY_ACCOUNT;
  const initials = (user?.name ?? 'P').substring(0, 2).toUpperCase();
  const address  = [account?.address, account?.city, account?.state, account?.pincode]
    .filter(Boolean).join(', ') || null;

  const handleLogout = async () => {
    setLogoutModal(false);
    dispatch(logout());
    await signOut();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

      <AppHeader label={STRINGS.party.profile} />

      {loading ? (
        <ProfileSkeleton />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* Avatar */}
          <Animated.View entering={FadeInUp.duration(400).delay(60)} style={styles.avatarSection}>
            <LinearGradient colors={[colors.brand, colors.brandDark]} style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{initials}</Text>
            </LinearGradient>
            <Text style={[styles.userName, { color: colors.text }]}>{user?.name ?? 'Party'}</Text>
            <View style={[styles.roleBadge, { backgroundColor: colors.brandSoft }]}>
              <Text style={[styles.roleText, { color: colors.brand }]}>{STRINGS.party.customer}</Text>
            </View>
          </Animated.View>

          {/* Account details */}
          <Animated.View entering={FadeInUp.duration(400).delay(120)}
            style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>{STRINGS.party.accountDetails}</Text>
            <InfoRow icon="phone-outline"            label="Mobile"       value={account?.mobile ?? user?.mobile} colors={colors} />
            <InfoRow icon="email-outline"            label="Email"        value={account?.email ?? user?.email}   colors={colors} />
            <InfoRow icon="file-certificate-outline" label="GSTIN"        value={account?.gstnumber}              colors={colors} />
            <InfoRow icon="identifier"               label="Account Code" value={account?.accountcode}            colors={colors} />
            <InfoRow icon="map-marker-outline"       label="Address"      value={address}                         colors={colors} />
            <InfoRow icon="tag-outline"              label="Channel"      value={account?.channel?.name}          colors={colors} />
            <InfoRow icon="map-outline"              label="Region"       value={account?.region}                 colors={colors} />
            <InfoRow icon="account-tie-outline"      label="Salesman"     value={account?.salesmanid?.name}       colors={colors} />
          </Animated.View>

          {/* Financial details */}
          {account && (account.creditlimit > 0 || account.openingbalance > 0 || account.ledgerid) && (
            <Animated.View entering={FadeInUp.duration(400).delay(180)}
              style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
            >
              <Text style={[styles.cardTitle, { color: colors.text }]}>{STRINGS.party.financial}</Text>
              <InfoRow icon="credit-card-outline"  label="Credit Limit"
                value={account.creditlimit > 0 ? formatINR(account.creditlimit) : null} colors={colors} />
              <InfoRow icon="cash-multiple"        label="Opening Balance"
                value={account.openingbalance > 0
                  ? `${formatINR(account.openingbalance)} (${account.openingbalancetype ?? 'Dr'})`
                  : null} colors={colors} />
              <InfoRow icon="book-account-outline" label="Ledger" value={account.ledgerid?.ledgername} colors={colors} />
            </Animated.View>
          )}

          {/* Sign out */}
          <Animated.View entering={FadeInUp.duration(400).delay(240)}>
            <TouchableOpacity
              style={[styles.signOutRow, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}
              onPress={() => setLogoutModal(true)}
              activeOpacity={0.75}
            >
              <View style={styles.signOutIconWrap}>
                <Icon name="logout-variant" size={18} color={colors.error} />
              </View>
              <Text style={[styles.signOutText, { color: colors.error }]}>{STRINGS.party.signOut}</Text>
              <Icon name="chevron-right" size={18} color={colors.error} style={{ opacity: 0.5 }} />
            </TouchableOpacity>
          </Animated.View>

        </ScrollView>
      )}

      <AppModal
        visible={logoutModal}
        title={STRINGS.party.signOut}
        message={STRINGS.party.signOutConfirm}
        confirmLabel={STRINGS.party.signOut}
        cancelLabel="Cancel"
        confirmColor={colors.error}
        iconName="logout-variant"
        onClose={() => setLogoutModal(false)}
        onConfirm={handleLogout}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll:    { paddingHorizontal: 18, paddingBottom: 120 },

  avatarSection: { alignItems: 'center', paddingVertical: 22 },
  avatarCircle:  {
    width: 76, height: 76, borderRadius: 38,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 26, fontFamily: FONTS.bold, color: '#fff' },
  userName:   { fontSize: 19, fontFamily: FONTS.bold, marginBottom: 8 },
  roleBadge:  { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 20 },
  roleText:   { fontSize: 12, fontFamily: FONTS.semiBold },

  card: {
    borderRadius: 20, borderWidth: 1, padding: 16, marginBottom: 14, gap: 12,
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  cardTitle: { fontSize: 14, fontFamily: FONTS.bold, marginBottom: 2 },

  infoRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoIcon:  { width: 30, height: 30, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  infoLabel: { fontSize: 10, fontFamily: FONTS.regular },
  infoValue: { fontSize: 13, fontFamily: FONTS.semiBold, marginTop: 1 },

  signOutRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 14,
  },
  signOutIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center', alignItems: 'center',
  },
  signOutText: { flex: 1, fontSize: 15, fontFamily: FONTS.semiBold },
});
