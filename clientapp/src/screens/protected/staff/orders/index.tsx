import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { COLORS, FONTS, useTheme } from '../../../../config';
import { OrderListSkeleton } from '../../../../config/skeletonlayouts';
import { AppHeader, DynamicFlashList } from '../../../../components';
import { GET_SALES_ORDERS } from '../../../../apollo/queries/accounts';
import { formatINR, formatDate, formatBillNumber } from '../../../../utils';
import type { RootState } from '../../../../store/rootreducer';

type FilterKey = 'all' | 'pending' | 'confirmed' | 'cancelled';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',       label: 'All'       },
  { key: 'pending',   label: 'Pending'   },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const STATUS_COLOR: Record<string, string> = {
  cancelled: '#ef4444',
  confirmed: '#3b82f6',
  pending:   '#f59e0b',
};

const DUMMY_ORDERS = [
  { id: 'o1', billnumber: '000006', billdate: '2024-11-15', totalamount: 6800, partyacc: { accountname: 'Mehta Traders' },   isConverted: true,  cancelStatus: null,        productservice: [{},{},{},{}]         },
  { id: 'o2', billnumber: '000005', billdate: '2024-11-15', totalamount: 3200, partyacc: { accountname: 'Patel General' },   isConverted: false, cancelStatus: null,        productservice: [{},{}]               },
  { id: 'o3', billnumber: '000004', billdate: '2024-11-14', totalamount: 9100, partyacc: { accountname: 'Gupta Kirana' },    isConverted: false, cancelStatus: 'cancelled', productservice: [{},{},{},{},{},{}]    },
  { id: 'o4', billnumber: '000003', billdate: '2024-11-14', totalamount: 4500, partyacc: { accountname: 'Shah Stores' },     isConverted: true,  cancelStatus: null,        productservice: [{},{},{}]             },
  { id: 'o5', billnumber: '000002', billdate: '2024-11-13', totalamount: 2100, partyacc: { accountname: 'Modi Mart' },       isConverted: false, cancelStatus: null,        productservice: [{},{}]               },
  { id: 'o6', billnumber: '000001', billdate: '2024-11-12', totalamount: 7400, partyacc: { accountname: 'Iyer Provisions' }, isConverted: true,  cancelStatus: null,        productservice: [{},{},{},{},{}]       },
];

function getStatus(o: any): FilterKey {
  if (o.cancelStatus === 'cancelled') return 'cancelled';
  if (o.isConverted) return 'confirmed';
  return 'pending';
}

export default function StaffOrders() {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const { colors, isDark } = useTheme();
  const user   = useSelector((s: RootState) => s.auth.user);
  const tenant = useSelector((s: RootState) => s.tenant);
  const [filter, setFilter] = useState<FilterKey>(route.params?.initialFilter ?? 'all');

  // Keep the filter in sync when arriving from a home stat card (this is a
  // bottom-tab screen, so it can already be mounted with a stale filter).
  useEffect(() => {
    if (route.params?.initialFilter) setFilter(route.params.initialFilter);
  }, [route.params?.initialFilter]);

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
    pending:   allOrders.filter((o: any) => getStatus(o) === 'pending').length,
    confirmed: allOrders.filter((o: any) => getStatus(o) === 'confirmed').length,
    cancelled: allOrders.filter((o: any) => getStatus(o) === 'cancelled').length,
  }), [allOrders]);

  const renderOrder = ({ item: order }: any) => {
    const status = getStatus(order);
    const colour = STATUS_COLOR[status];
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
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </View>
        </View>
        <Icon name="chevron-right" size={18} color={colors.subText} style={{ marginLeft: 8, alignSelf: 'center' }} />
      </TouchableOpacity>
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
          <Text style={[styles.emptyText, { color: colors.subText }]}>No {filter} orders</Text>
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
