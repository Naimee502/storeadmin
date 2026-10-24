import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, Pressable, TextInput, ActivityIndicator, Linking } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { COLORS, FONTS, useTheme } from '../../../../config';
import { formatINR } from '../../../../utils';
import { BackHeader, DynamicFlashList } from '../../../../components';
import { GET_DOWNLINE_PARTY_BALANCES, GET_ADMIN_SETTINGS, GET_SALES_ORDERS } from '../../../../apollo/queries/accounts';
import type { RootState } from '../../../../store/rootreducer';

/**
 * My Parties — a channel party's sub-parties (Business Settings → "Party
 * manages downline"). Every level below this party, with what each one owes;
 * tap a card for its orders / payments, or book an order straight from it. Reached from the drawer,
 * which only shows the entry when the setting is on and this party actually
 * has parties under it.
 */
export default function SubParties() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const user = useSelector((s: RootState) => s.auth.user);
  const [q, setQ] = useState('');
  const adminId = useSelector((s: RootState) => (s as any).tenant?.adminId ?? '');
  const { data: settingsData } = useQuery(GET_ADMIN_SETTINGS, { variables: { adminid: adminId }, skip: !adminId, fetchPolicy: 'cache-and-network' });
  const trackStock = (settingsData as any)?.getAdminSettings?.trackPartyStock === true
    && (settingsData as any)?.getAdminSettings?.displayStockOnWebsite !== false;

  const { data, loading, refetch } = useQuery(GET_DOWNLINE_PARTY_BALANCES, {
    variables: { partyid: user?.id },
    skip: !user?.id,
    fetchPolicy: 'cache-and-network',
  });
  // Sub-parties' orders — for "Pending orders" (waiting on me) and this
  // month's sale through my parties.
  const { data: ordData, refetch: refetchOrd } = useQuery(GET_SALES_ORDERS, {
    variables: { adminid: adminId, partyacc: user?.id, includeDownline: true },
    skip: !adminId || !user?.id,
    fetchPolicy: 'cache-and-network',
  });
  useFocusEffect(useCallback(() => { refetch?.(); refetchOrd?.(); }, [refetch, refetchOrd]));

  const all = ((data as any)?.getDownlinePartyBalances ?? []) as any[];
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = !s ? all : all.filter((p) =>
      [p.name, p.mobile, p.city, p.channelName].some((x) => String(x || '').toLowerCase().includes(s)));
    return [...list].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }, [all, q]);
  const totalDue = all.reduce((a, p) => a + Math.max(0, Number(p.outstanding) || 0), 0);
  const downOrders = (((ordData as any)?.getSalesOrders ?? []) as any[])
    .filter((o) => o.partyacc?.id && o.partyacc.id !== user?.id && o.cancelStatus !== 'cancelled');
  // Pending = not yet confirmed / converted — the parent party has to act on it.
  const pendingOrders = downOrders.filter((o) =>
    !o.isConverted && !o.deliveryStatus?.match(/dispatched|delivered/) && (!o.orderStatus || String(o.orderStatus).toLowerCase() === 'pending')).length;
  const now = new Date();
  const monthSale = downOrders.reduce((a, o) => {
    const d = o.billdate ? new Date(/^\d+$/.test(String(o.billdate)) ? Number(o.billdate) : o.billdate) : null;
    return d && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() ? a + (Number(o.totalamount) || 0) : a;
  }, 0);

  const renderItem = ({ item }: any) => {
    const due = Math.max(0, Number(item.outstanding) || 0);
    const viaOther = item.parentId && item.parentId !== user?.id;
    return (
      <Pressable
        style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
        onPress={() => navigation.navigate('SubPartyDetail', { partyId: item.id, partyName: item.name })}
      >
        <View style={styles.row}>
          <View style={[styles.avatar, { backgroundColor: colors.brandSoft }]}>
            <Text style={[styles.avatarText, { color: colors.brand }]}>{String(item.name || 'P').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
            <Text style={[styles.meta, { color: colors.subText }]} numberOfLines={1}>
              {[item.mobile, item.city].filter(Boolean).join(' • ') || '—'}
            </Text>
            <View style={styles.badges}>
              {!!item.channelName && (
                <View style={[styles.badge, { backgroundColor: colors.brandSoft }]}>
                  <Icon name="tag-outline" size={11} color={colors.brand} />
                  <Text style={[styles.badgeText, { color: colors.brand }]} numberOfLines={1}>{item.channelName}</Text>
                </View>
              )}
              {viaOther && (
                <Text style={[styles.meta, { color: colors.subText }]} numberOfLines={1}>under {item.parentName}</Text>
              )}
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {due > 0 ? (
              <>
                <Text style={[styles.due, { color: '#ef4444' }]}>{formatINR(due)}</Text>
                <Text style={[styles.meta, { color: colors.subText }]}>Due</Text>
              </>
            ) : (
              <Text style={[styles.meta, { color: '#22c55e' }]}>No dues</Text>
            )}
          </View>
        </View>
        <View style={[styles.actions, { borderTopColor: colors.border }]}>
          <Pressable style={styles.action} onPress={() => navigation.navigate('StaffCatalog', { partyId: item.id, partyName: item.name })}>
            <Icon name="cart-plus" size={15} color={colors.brand} />
            <Text style={[styles.actionText, { color: colors.brand }]}>Order</Text>
          </Pressable>
          <Pressable style={styles.action} onPress={() => navigation.navigate('PartyPaymentsView', { partyId: item.id, partyName: item.name })}>
            <Icon name="cash-multiple" size={15} color={colors.brand} />
            <Text style={[styles.actionText, { color: colors.brand }]}>Payments</Text>
          </Pressable>
          {trackStock && (
            <Pressable style={styles.action} onPress={() => navigation.navigate('PartyStock', { partyId: item.id, partyName: item.name })}>
              <Icon name="package-variant" size={15} color={colors.brand} />
              <Text style={[styles.actionText, { color: colors.brand }]}>Stock</Text>
            </Pressable>
          )}
          {!!item.mobile && (
            <Pressable style={styles.action} onPress={() => Linking.openURL(`tel:${item.mobile}`)}>
              <Icon name="phone-outline" size={15} color={colors.brand} />
              <Text style={[styles.actionText, { color: colors.brand }]}>Call</Text>
            </Pressable>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />
      <BackHeader label="My Parties" />

      <View style={[styles.summary, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
        {[
          { label: 'Pending orders', value: String(pendingOrders), tint: pendingOrders > 0 ? '#f59e0b' : colors.subText },
          { label: 'This month', value: formatINR(monthSale), tint: colors.brand },
          { label: 'Total due', value: formatINR(totalDue), tint: totalDue > 0 ? '#ef4444' : colors.subText },
        ].map((st, i) => (
          <React.Fragment key={st.label}>
            {i > 0 && <View style={[styles.sep, { backgroundColor: colors.border }]} />}
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: st.tint }]} numberOfLines={1} adjustsFontSizeToFit>{st.value}</Text>
              <Text style={[styles.meta, { color: colors.subText }]}>{st.label}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>

      <View style={[styles.search, { backgroundColor: colors.raisedSurface, borderColor: colors.border }]}>
        <Icon name="magnify" size={18} color={colors.subText} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search name, mobile, city or channel"
          placeholderTextColor={colors.subText}
          style={[styles.searchInput, { color: colors.text }]}
        />
      </View>

      {loading && !data ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.brand} /></View>
      ) : (
        <DynamicFlashList
          data={rows}
          renderItem={renderItem}
          keyExtractor={(item: any) => item.id}
          estimatedItemSize={120}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <Icon name="account-group-outline" size={44} color={colors.border} />
              <Text style={[styles.meta, { color: colors.subText, marginTop: 8 }]}>
                {q ? 'No party matches your search' : 'No parties under you yet'}
              </Text>
            </View>
          }
        />
      )}

      {/* Add a party under me (goes in with me as its parent). */}
      <Pressable style={[styles.fab, { backgroundColor: colors.brand }]} onPress={() => navigation.navigate('StaffCreateParty')}>
        <Icon name="plus" size={20} color={colors.onBrand} />
        <Text style={[styles.fabText, { color: colors.onBrand }]}>Add Party</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  summary: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 18, marginTop: 12, marginBottom: 10,
    borderRadius: 16, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 8,
  },
  stat: { flex: 1, alignItems: 'center' },
  sep: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  statValue: { fontSize: 16, fontFamily: FONTS.bold },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 18, marginBottom: 8,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 12,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, fontFamily: FONTS.regular },
  list: { paddingHorizontal: 18, paddingBottom: 100, paddingTop: 4 },
  fab: {
    position: 'absolute', bottom: 28, right: 20, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 14, borderRadius: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 6,
  },
  fabText: { fontSize: 14, fontFamily: FONTS.bold },
  card: {
    borderRadius: 16, borderWidth: 1, marginBottom: 10, overflow: 'hidden',
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontFamily: FONTS.bold },
  name: { fontSize: 14, fontFamily: FONTS.bold },
  meta: { fontSize: 12, fontFamily: FONTS.regular },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, maxWidth: 140 },
  badgeText: { fontSize: 11, fontFamily: FONTS.semiBold },
  due: { fontSize: 14, fontFamily: FONTS.bold },
  actions: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  actionText: { fontSize: 12, fontFamily: FONTS.semiBold },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
});
