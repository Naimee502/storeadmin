import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { COLORS, FONTS, STRINGS, useTheme } from '../../../../config';
import { OrderListSkeleton } from '../../../../config/skeletonlayouts';
import { GET_SALES_ORDERS } from '../../../../apollo/queries/accounts';
import { formatINR, formatDate } from '../../../../utils';
import { AppHeader, DynamicFlashList } from '../../../../components';
import type { RootState } from '../../../../store/rootreducer';

type FilterKey = 'all' | 'confirmed' | 'cancelled';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const STATUS_COLOR: Record<string, string> = {
  cancelled:  '#ef4444',
  confirmed:  '#3b82f6',
  processing: '#94a3b8',
};

const DUMMY_ORDERS = [
  { id: 'd1', billnumber: 'SO/2024/001', billdate: '2024-11-15T00:00:00.000Z', totalamount: 4788, status: true,  cancelStatus: null,        salesmenid: { name: 'Rahul S.' }, productservice: [{}, {}, {}] },
  { id: 'd2', billnumber: 'SO/2024/002', billdate: '2024-11-10T00:00:00.000Z', totalamount: 1260, status: false, cancelStatus: null,        salesmenid: null,                 productservice: [{}, {}]    },
  { id: 'd3', billnumber: 'SO/2024/003', billdate: '2024-11-05T00:00:00.000Z', totalamount: 3200, status: false, cancelStatus: 'cancelled', salesmenid: null,                 productservice: [{}]        },
  { id: 'd4', billnumber: 'SO/2024/004', billdate: '2024-10-28T00:00:00.000Z', totalamount: 7500, status: true,  cancelStatus: null,        salesmenid: { name: 'Rahul S.' }, productservice: [{}, {}, {}, {}] },
  { id: 'd5', billnumber: 'SO/2024/005', billdate: '2024-10-20T00:00:00.000Z', totalamount: 2100, status: false, cancelStatus: null,        salesmenid: null,                 productservice: [{}]        },
];

type OrderStatus = FilterKey | 'processing';

const STATUS_LABEL: Record<OrderStatus, string> = {
  all:        'All',
  confirmed:  'Confirmed',
  cancelled:  'Cancelled',
  processing: 'Processing',
};

function getOrderStatus(order: any): OrderStatus {
  if (order.cancelStatus === 'cancelled') return 'cancelled';
  if (order.status) return 'confirmed';
  return 'processing';
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

  const { data, loading, refetch } = useQuery(GET_SALES_ORDERS, {
    variables: { adminid, partyacc: user?.id },
    skip: !adminid || !user?.id,
  });

  const orders = useMemo(() => (data as any)?.getSalesOrders ?? [], [data]);

  const filtered = useMemo(() => {
    if (filter === 'all') return orders;
    return orders.filter(o => getOrderStatus(o) === filter);
  }, [orders, filter]);

  const counts = useMemo(() => ({
    all:       orders.length,
    confirmed: orders.filter(o => getOrderStatus(o) === 'confirmed').length,
    cancelled: orders.filter(o => getOrderStatus(o) === 'cancelled').length,
  }), [orders]);

  const renderOrder = ({ item: order }: any) => {
    const status    = getOrderStatus(order);
    const colour    = STATUS_COLOR[status];
    const itemCount = order.productservice?.length ?? 0;

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
        onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
        activeOpacity={0.85}
      >
        <View style={[styles.statusDot, { backgroundColor: colour }]} />

        <View style={{ flex: 1 }}>
          <View style={styles.cardTop}>
            <Text style={[styles.billNum, { color: colors.text }]}>{order.billnumber ?? '–'}</Text>
            <Text style={[styles.amount, { color: colors.text }]}>{formatINR(order.totalamount)}</Text>
          </View>

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
                {STATUS_LABEL[status]}
              </Text>
            </View>
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
            {filter === 'all' ? STRINGS.party.noOrdersYet : `No ${STATUS_LABEL[filter].toLowerCase()} orders`}
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
  salesmanText: { fontSize: 11, fontFamily: FONTS.regular, flex: 1 },

  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  emptyText:   { fontSize: 14, fontFamily: FONTS.regular },
  clearFilter: { fontSize: 14, fontFamily: FONTS.semiBold, marginTop: 4 },
});
