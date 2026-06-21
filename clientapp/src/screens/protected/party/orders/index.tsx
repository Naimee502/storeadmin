import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { COLORS, FONTS, STRINGS, useTheme } from '../../../../config';
import { OrderListSkeleton } from '../../../../config/skeletonlayouts';
import { GET_SALES_ORDERS, GET_ADMIN_SETTINGS } from '../../../../apollo/queries/accounts';
import { formatINR, formatDate, formatBillNumber } from '../../../../utils';
import { AppHeader, DynamicFlashList } from '../../../../components';
import type { RootState } from '../../../../store/rootreducer';

type FilterKey = 'all' | 'pending' | 'confirmed' | 'dispatched' | 'delivered' | 'cancelled';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',        label: 'All' },
  { key: 'pending',    label: 'Pending' },
  { key: 'confirmed',  label: 'Confirmed' },
  { key: 'dispatched', label: 'Dispatched' },
  { key: 'delivered',  label: 'Delivered' },
  { key: 'cancelled',  label: 'Cancelled' },
];

const STATUS_COLOR: Record<string, string> = {
  cancelled:  '#ef4444',
  confirmed:  '#3b82f6',
  pending:    '#f59e0b',
  dispatched: '#0ea5e9',
  delivered:  '#22c55e',
};

// Real status for the badge (includes delivered/dispatched).
function displayStatus(order: any): string {
  if (order.cancelStatus === 'cancelled') return 'cancelled';
  if (order.deliveryStatus === 'delivered') return 'delivered';
  if (order.deliveryStatus === 'dispatched') return 'dispatched';
  // Use the server-derived orderStatus (confirmed even without invoice conversion,
  // e.g. when the sales-invoice module is off and the order is just confirmed).
  const os = String(order.orderStatus || '').toLowerCase();
  if (os) return os;
  if (order.isConverted) return 'confirmed';
  return 'pending';
}
// Filter bucket = the real status (each stage is its own filter now).
function getOrderStatus(order: any): FilterKey {
  return displayStatus(order) as FilterKey;
}

export default function MyOrders() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const user      = useSelector((s: RootState) => s.auth.user);
  const tenant    = useSelector((s: RootState) => s.tenant);
  const cartItems = useSelector((s: RootState) => s.cart.items);
  const cartCount = cartItems.reduce((sum, i) => sum + i.qty, 0);
  const adminid   = tenant.adminId ?? '';

  const [filter, setFilter] = useState<FilterKey>('all');

  // Downline: when the business lets a channel party manage its sub-parties,
  // this party also sees orders of the parties under it.
  const { data: settingsData } = useQuery(GET_ADMIN_SETTINGS, {
    variables: { adminid }, skip: !adminid, fetchPolicy: 'cache-and-network',
  });
  const manageDownline = (settingsData as any)?.getAdminSettings?.partyManagesDownline === true;

  const { data, loading, refetch } = useQuery(GET_SALES_ORDERS, {
    variables: { adminid, partyacc: user?.id, includeDownline: manageDownline },
    skip: !adminid || !user?.id,
    fetchPolicy: 'cache-and-network',
  });

  // Refetch on focus so a status change (confirm/dispatch/etc.) made on the
  // order detail reflects here when you come back.
  useFocusEffect(useCallback(() => { refetch?.(); }, [refetch]));

  const allOrders = useMemo(() => (data as any)?.getSalesOrders ?? [], [data]);

  // Scope: own orders vs sub-party (downline) orders. Only meaningful when
  // downline management is on; otherwise everything is "mine".
  const [scope, setScope] = useState<'mine' | 'downline' | 'all'>('mine');
  const orders = useMemo(() => {
    if (!manageDownline || scope === 'all') return allOrders;
    if (scope === 'mine') return allOrders.filter((o: any) => o.partyacc?.id === user?.id);
    return allOrders.filter((o: any) => o.partyacc?.id && o.partyacc.id !== user?.id);
  }, [allOrders, scope, manageDownline, user?.id]);

  const filtered = useMemo(() => {
    if (filter === 'all') return orders;
    return orders.filter(o => getOrderStatus(o) === filter);
  }, [orders, filter]);

  const counts = useMemo(() => ({
    all:        orders.length,
    pending:    orders.filter(o => getOrderStatus(o) === 'pending').length,
    confirmed:  orders.filter(o => getOrderStatus(o) === 'confirmed').length,
    dispatched: orders.filter(o => getOrderStatus(o) === 'dispatched').length,
    delivered:  orders.filter(o => getOrderStatus(o) === 'delivered').length,
    cancelled:  orders.filter(o => getOrderStatus(o) === 'cancelled').length,
  }), [orders]);

  const renderOrder = ({ item: order }: any) => {
    const status    = displayStatus(order);
    const colour    = STATUS_COLOR[status];
    const itemCount = order.productservice?.length ?? 0;
    const channel   = order.partyacc?.channelName;

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
        onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
        activeOpacity={0.85}
      >
        <View style={[styles.statusDot, { backgroundColor: colour }]} />

        <View style={{ flex: 1 }}>
          <View style={styles.cardTop}>
            <Text style={[styles.billNum, { color: colors.text }]}>{formatBillNumber(order)}</Text>
            <Text style={[styles.amount, { color: colors.text }]}>{formatINR(order.totalamount)}</Text>
          </View>

          {order.partyacc?.id && order.partyacc.id !== user?.id && (
            <View style={styles.cardMid}>
              <Icon name="store-outline" size={12} color={colors.subText} style={{ marginRight: 4 }} />
              <Text style={[styles.meta, { color: colors.subText }]} numberOfLines={1}>
                {order.partyacc.accountname || 'Sub-party'}
              </Text>
            </View>
          )}

          <View style={styles.cardMid}>
            <Icon name="calendar-outline" size={12} color={colors.subText} style={{ marginRight: 4 }} />
            <Text style={[styles.meta, { color: colors.subText }]}>{formatDate(order.billdate)}</Text>
            {itemCount > 0 && (
              <>
                <View style={styles.dot} />
                <Icon name="package-variant-closed" size={12} color={colors.subText} style={{ marginRight: 4 }} />
                <Text style={[styles.meta, { color: colors.subText }]}>
                  {itemCount} item{itemCount !== 1 ? 's' : ''}
                </Text>
              </>
            )}
          </View>

          <View style={styles.cardBottom}>
            <View style={[styles.statusBadge, { backgroundColor: colour + '22' }]}>
              <Text style={[styles.statusText, { color: colour }]}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </View>
            {!!channel && (
              <View style={[styles.channelBadge, { backgroundColor: colors.brandSoft }]}>
                <Icon name="tag-outline" size={11} color={colors.brand} style={{ marginRight: 3 }} />
                <Text style={[styles.channelText, { color: colors.brand }]} numberOfLines={1}>
                  {channel}
                </Text>
              </View>
            )}
            {order.salesmenid?.name && (
              <Text style={[styles.salesmanText, { color: colors.subText }]} numberOfLines={1}>
                via {order.salesmenid.name}
              </Text>
            )}
          </View>
        </View>

        <Icon name="chevron-right" size={18} color={colors.subText} style={{ marginLeft: 8 }} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

      <AppHeader
        label={STRINGS.party.orders}
        rightIcons={[{
          id: 'cart', name: 'cart-outline', color: colors.brand, badge: cartCount,
          onPress: () => navigation.navigate('CartScreen'),
        }]}
      />

      {/* Scope segmented toggle (own vs sub-party) — only when downline is on */}
      {manageDownline && (
        <View style={[styles.segment, { backgroundColor: colors.raisedSurface, borderColor: colors.border }]}>
          {([
            { key: 'mine',     label: 'My Orders' },
            { key: 'downline', label: 'Parties Orders' },
            { key: 'all',      label: 'All' },
          ] as const).map((s) => {
            const active = scope === s.key;
            return (
              <TouchableOpacity
                key={s.key}
                style={[styles.segmentItem, active && { backgroundColor: colors.brand }]}
                onPress={() => setScope(s.key)}
                activeOpacity={0.85}
              >
                <Text style={[styles.segmentText, { color: active ? '#fff' : colors.subText }]}>{s.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Filter chips — horizontal ScrollView (NOT FlatList) to avoid full-height expansion */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipList}
        style={styles.chipScroll}
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const count  = counts[f.key];
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, active
                ? { backgroundColor: colors.brand,         borderColor: colors.brand }
                : { backgroundColor: colors.raisedSurface, borderColor: colors.border },
              ]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.chipText, { color: active ? '#fff' : colors.subText }]}>
                {f.label}
              </Text>
              {count > 0 && (
                <View style={[styles.chipCount, {
                  backgroundColor: active ? 'rgba(255,255,255,0.25)' : colors.brandSoft,
                }]}>
                  <Text style={[styles.chipCountText, { color: active ? '#fff' : colors.brand }]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <OrderListSkeleton />
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Icon name="clipboard-off-outline" size={44} color={colors.border} />
          <Text style={[styles.emptyText, { color: colors.subText }]}>
            {filter === 'all' ? STRINGS.party.noOrdersYet : `No ${filter} orders`}
          </Text>
          {filter !== 'all' && (
            <TouchableOpacity onPress={() => setFilter('all')}>
              <Text style={[styles.clearFilter, { color: colors.brand }]}>Show all orders</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <DynamicFlashList
          data={filtered}
          renderItem={renderOrder}
          estimatedItemSize={90}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onRefresh={adminid ? refetch : undefined}
          refreshing={loading}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1 },
  segment: {
    flexDirection: 'row', marginHorizontal: 18, marginTop: 12,
    borderRadius: 12, borderWidth: 1, padding: 3,
  },
  segmentItem: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  segmentText: { fontSize: 13, fontFamily: FONTS.semiBold },
  chipScroll: { flexGrow: 0 },
  chipList:   { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 8, gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5,
  },
  chipText:      { fontSize: 13, fontFamily: FONTS.semiBold },
  chipCount:     { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, minWidth: 20, alignItems: 'center' },
  chipCountText: { fontSize: 11, fontFamily: FONTS.bold },

  listContent: { paddingHorizontal: 18, paddingBottom: 110, paddingTop: 4 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 10,
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 14 },

  cardTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  billNum:  { fontSize: 14, fontFamily: FONTS.bold },
  amount:   { fontSize: 14, fontFamily: FONTS.bold },
  cardMid:  { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  meta:     { fontSize: 12, fontFamily: FONTS.regular },
  dot:      { width: 3, height: 3, borderRadius: 2, backgroundColor: '#999', marginHorizontal: 6 },
  cardBottom:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusBadge:  { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  statusText:   { fontSize: 11, fontFamily: FONTS.semiBold },
  channelBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, maxWidth: 130 },
  channelText:  { fontSize: 11, fontFamily: FONTS.semiBold },
  salesmanText: { fontSize: 11, fontFamily: FONTS.regular, flex: 1 },

  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  emptyText:   { fontSize: 14, fontFamily: FONTS.regular },
  clearFilter: { fontSize: 14, fontFamily: FONTS.semiBold, marginTop: 4 },
});
