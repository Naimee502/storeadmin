import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { COLORS, FONTS, useTheme } from '../../../../config';
import { OrderListSkeleton } from '../../../../config/skeletonlayouts';
import { AppHeader, DynamicFlashList } from '../../../../components';
import { GET_SALES_ORDERS } from '../../../../apollo/queries/accounts';
import { formatINR, formatDate } from '../../../../utils';
import type { RootState } from '../../../../store/rootreducer';

type FilterKey = 'all' | 'confirmed' | 'cancelled';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',       label: 'All'       },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const STATUS_COLOR: Record<string, string> = {
  cancelled:  '#ef4444',
  confirmed:  '#3b82f6',
  processing: '#94a3b8',
};

type OrderStatus = FilterKey | 'processing';

const STATUS_LABEL: Record<OrderStatus, string> = {
  all:        'All',
  confirmed:  'Confirmed',
  cancelled:  'Cancelled',
  processing: 'Processing',
};

const DUMMY_ORDERS = [
  { id: 'o1', billnumber: 'SO/2024/025', billdate: '2024-11-15T00:00:00.000Z', totalamount: 6800, partyName: 'Mehta Traders',   itemCount: 4, status: true,  cancelStatus: null        },
  { id: 'o2', billnumber: 'SO/2024/024', billdate: '2024-11-15T00:00:00.000Z', totalamount: 3200, partyName: 'Patel General',   itemCount: 2, status: false, cancelStatus: null        },
  { id: 'o3', billnumber: 'SO/2024/023', billdate: '2024-11-14T00:00:00.000Z', totalamount: 9100, partyName: 'Gupta Kirana',    itemCount: 6, status: false, cancelStatus: 'cancelled' },
  { id: 'o4', billnumber: 'SO/2024/022', billdate: '2024-11-14T00:00:00.000Z', totalamount: 4500, partyName: 'Shah Stores',     itemCount: 3, status: true,  cancelStatus: null        },
  { id: 'o5', billnumber: 'SO/2024/021', billdate: '2024-11-13T00:00:00.000Z', totalamount: 2100, partyName: 'Modi Mart',       itemCount: 2, status: false, cancelStatus: null        },
  { id: 'o6', billnumber: 'SO/2024/020', billdate: '2024-11-12T00:00:00.000Z', totalamount: 7400, partyName: 'Iyer Provisions', itemCount: 5, status: true,  cancelStatus: null        },
];

function getStatus(o: any): OrderStatus {
  if (o.cancelStatus === 'cancelled') return 'cancelled';
  if (o.status) return 'confirmed';
  return 'processing';
}

export default function StaffOrders() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const user   = useSelector((s: RootState) => s.auth.user);
  const tenant = useSelector((s: RootState) => s.tenant);
  const [filter, setFilter] = useState<FilterKey>('all');

  const { data, loading } = useQuery(GET_SALES_ORDERS, {
    variables: { adminid: tenant.adminId },
    skip: !tenant.adminId,
  });
  const allOrders = useMemo(() => (data as any)?.getSalesOrders ?? [], [data]);

  const filtered = useMemo(() => {
    if (filter === 'all') return allOrders;
    return allOrders.filter((o: any) => getStatus(o) === filter);
  }, [allOrders, filter]);

  const counts = useMemo(() => ({
    all:       allOrders.length,
    confirmed: allOrders.filter((o: any) => getStatus(o) === 'confirmed').length,
    cancelled: allOrders.filter((o: any) => getStatus(o) === 'cancelled').length,
  }), [allOrders]);

  const renderOrder = ({ item: order }: any) => {
    const status = getStatus(order);
    const colour = STATUS_COLOR[status];
    return (
      <View style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
        <View style={[styles.statusDot, { backgroundColor: colour }]} />
        <View style={{ flex: 1 }}>
          <View style={styles.cardTop}>
            <Text style={[styles.billNum, { color: colors.text }]}>{order.billnumber}</Text>
            <Text style={[styles.amount, { color: colors.text }]}>{formatINR(order.totalamount)}</Text>
          </View>
          <Text style={[styles.partyName, { color: colors.subText }]} numberOfLines={1}>
            {order.partyacc?.accountname ?? order.partyacc?.name ?? '—'}
          </Text>
          <View style={styles.cardMid}>
            <Icon name="calendar-outline" size={12} color={colors.subText} style={{ marginRight: 4 }} />
            <Text style={[styles.meta, { color: colors.subText }]}>{formatDate(order.billdate)}</Text>
            <View style={styles.dot} />
            <Icon name="package-variant-closed" size={12} color={colors.subText} style={{ marginRight: 4 }} />
            <Text style={[styles.meta, { color: colors.subText }]}>{order.productservice?.length ?? 0} items</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: colour + '22', alignSelf: 'flex-start' }]}>
            <Text style={[styles.statusText, { color: colour }]}>
              {STATUS_LABEL[status]}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

      <AppHeader label="Orders" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipList} style={styles.chipScroll}>
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
              <Text style={[styles.chipText, { color: active ? '#fff' : colors.subText }]}>{f.label}</Text>
              {count > 0 && (
                <View style={[styles.chipCount, { backgroundColor: active ? 'rgba(255,255,255,0.25)' : colors.brandSoft }]}>
                  <Text style={[styles.chipCountText, { color: active ? '#fff' : colors.brand }]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? <OrderListSkeleton /> : filtered.length === 0 ? (
        <View style={styles.center}>
          <Icon name="clipboard-off-outline" size={44} color={colors.border} />
          <Text style={[styles.emptyText, { color: colors.subText }]}>No {STATUS_LABEL[filter].toLowerCase()} orders</Text>
          <TouchableOpacity onPress={() => setFilter('all')}>
            <Text style={[styles.clearFilter, { color: colors.brand }]}>Show all orders</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <DynamicFlashList
          data={filtered}
          renderItem={renderOrder}
          estimatedItemSize={95}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB — New Order */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.brand }]}
        onPress={() => navigation.navigate('StaffParties')}
        activeOpacity={0.88}
      >
        <Icon name="plus" size={20} color="#fff" />
        <Text style={styles.fabText}>New Order</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1 },
  chipScroll: { flexGrow: 0 },
  chipList:   { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 8, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  chipText:      { fontSize: 13, fontFamily: FONTS.semiBold },
  chipCount:     { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, minWidth: 20, alignItems: 'center' },
  chipCountText: { fontSize: 11, fontFamily: FONTS.bold },
  listContent: { paddingHorizontal: 18, paddingBottom: 110, paddingTop: 4 },
  card: {
    flexDirection: 'row', alignItems: 'flex-start',
    borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 10,
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  statusDot:   { width: 10, height: 10, borderRadius: 5, marginRight: 14, marginTop: 4 },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  billNum:     { fontSize: 14, fontFamily: FONTS.bold },
  amount:      { fontSize: 14, fontFamily: FONTS.bold },
  partyName:   { fontSize: 12, fontFamily: FONTS.regular, marginBottom: 4 },
  cardMid:     { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  meta:        { fontSize: 12, fontFamily: FONTS.regular },
  dot:         { width: 3, height: 3, borderRadius: 2, backgroundColor: '#999', marginHorizontal: 6 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  statusText:  { fontSize: 11, fontFamily: FONTS.semiBold },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  emptyText:   { fontSize: 14, fontFamily: FONTS.regular },
  clearFilter: { fontSize: 14, fontFamily: FONTS.semiBold, marginTop: 4 },
  fab: {
    position: 'absolute', bottom: 100, right: 20,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 14, borderRadius: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 6,
  },
  fabText: { fontSize: 14, fontFamily: FONTS.bold, color: '#fff' },
});
