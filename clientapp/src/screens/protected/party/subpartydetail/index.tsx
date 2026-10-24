import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, Pressable, ActivityIndicator, Linking } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { COLORS, FONTS, useTheme } from '../../../../config';
import { formatINR, formatDate, formatBillNumber, formatPaymentCode, titleCase } from '../../../../utils';
import { BackHeader, DynamicFlashList } from '../../../../components';
import {
  GET_ACCOUNT, GET_SALES_ORDERS, GET_PAYMENTS, GET_ADMIN_SETTINGS, GET_PARTY_STOCK,
} from '../../../../apollo/queries/accounts';
import type { RootState } from '../../../../store/rootreducer';

const STATUS_COLOR: Record<string, string> = {
  cancelled: '#ef4444', confirmed: '#3b82f6', pending: '#f59e0b', dispatched: '#0ea5e9', delivered: '#22c55e',
};
const orderStatus = (o: any) => {
  if (o.cancelStatus === 'cancelled') return 'cancelled';
  if (o.deliveryStatus === 'delivered') return 'delivered';
  if (o.deliveryStatus === 'dispatched') return 'dispatched';
  const os = String(o.orderStatus || '').toLowerCase();
  if (os) return os;
  return o.isConverted ? 'confirmed' : 'pending';
};

/**
 * One sub-party, seen by its parent party (My Parties → tap a party):
 * profile + Orders / Payments (/ Stock with "Track party stock"), and
 * "New Order" to book an order for it from the catalogue.
 */
export default function SubPartyDetail() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors, isDark } = useTheme();
  const adminid = useSelector((s: RootState) => (s as any).tenant?.adminId ?? '');
  const partyId: string = route.params?.partyId;
  const fallbackName: string = route.params?.partyName ?? 'Party';
  const [tab, setTab] = useState<'orders' | 'payments' | 'stock'>('orders');

  const { data: accData, refetch: refetchAcc } = useQuery(GET_ACCOUNT, {
    variables: { id: partyId, adminId: adminid }, skip: !partyId || !adminid, fetchPolicy: 'cache-and-network',
  });
  const { data: ordData, loading: ordLoading, refetch: refetchOrd } = useQuery(GET_SALES_ORDERS, {
    variables: { adminid, partyacc: partyId }, skip: !partyId || !adminid, fetchPolicy: 'cache-and-network',
  });
  const { data: payData, loading: payLoading, refetch: refetchPay } = useQuery(GET_PAYMENTS, {
    variables: { adminid, partyid: partyId }, skip: !partyId || !adminid, fetchPolicy: 'cache-and-network',
  });
  const { data: settingsData } = useQuery(GET_ADMIN_SETTINGS, {
    variables: { adminid }, skip: !adminid, fetchPolicy: 'cache-and-network',
  });
  // Stock tab: "Track party stock" AND "Show stock on App / Website".
  const trackStock = (settingsData as any)?.getAdminSettings?.trackPartyStock === true
    && (settingsData as any)?.getAdminSettings?.displayStockOnWebsite !== false;
  const { data: stockData, loading: stockLoading, refetch: refetchStock } = useQuery(GET_PARTY_STOCK, {
    variables: { partyid: partyId }, skip: !partyId || !trackStock, fetchPolicy: 'cache-and-network',
  });

  useFocusEffect(useCallback(() => {
    refetchAcc?.(); refetchOrd?.(); refetchPay?.(); if (trackStock) refetchStock?.();
  }, [refetchAcc, refetchOrd, refetchPay, refetchStock, trackStock]));

  const party = (accData as any)?.getAccountById;
  const name = party?.name ?? fallbackName;
  const due = Math.max(0, Number(party?.outstanding) || 0);
  const orders = useMemo(() => [...(((ordData as any)?.getSalesOrders ?? []) as any[])].reverse(), [ordData]);
  const payments = useMemo(
    () => (((payData as any)?.getPayments ?? []) as any[]).filter((p) => p.status !== false).reverse(),
    [payData],
  );
  const stock = ((stockData as any)?.getPartyStock ?? []) as any[];
  const orderValue = orders.reduce((a, o) => a + (o.cancelStatus === 'cancelled' ? 0 : Number(o.totalamount) || 0), 0);
  const received = payments.reduce((a, p) => a + (Number(p.amount) || 0), 0);

  const newOrder = () => navigation.navigate('StaffCatalog', { partyId, partyName: name });

  const renderOrder = ({ item: o }: any) => {
    const st = orderStatus(o);
    const c = STATUS_COLOR[st] ?? colors.subText;
    return (
      <Pressable style={[styles.row, { backgroundColor: colors.cardGlass, borderColor: colors.border }]} onPress={() => navigation.navigate('OrderDetail', { orderId: o.id })}>
        <View style={[styles.dot, { backgroundColor: c }]} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: colors.text }]}>{formatBillNumber(o)}</Text>
          <Text style={[styles.meta, { color: colors.subText }]}>{formatDate(o.billdate)} • {o.productservice?.length ?? 0} items</Text>
          <View style={[styles.badge, { backgroundColor: c + '22' }]}><Text style={[styles.badgeText, { color: c }]}>{titleCase(st)}</Text></View>
        </View>
        <Text style={[styles.amount, { color: colors.text }]}>{formatINR(o.totalamount)}</Text>
        <Icon name="chevron-right" size={18} color={colors.subText} />
      </Pressable>
    );
  };
  const renderPayment = ({ item: p }: any) => (
    <Pressable style={[styles.row, { backgroundColor: colors.cardGlass, borderColor: colors.border }]} onPress={() => navigation.navigate('PaymentDetail', { payment: p, accountName: name })}>
      <View style={[styles.icon, { backgroundColor: colors.brandSoft }]}><Icon name="cash" size={16} color={colors.brand} /></View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{formatPaymentCode(p.paymentcode)}</Text>
        <Text style={[styles.meta, { color: colors.subText }]}>{formatDate(p.paymentdate)}{p.mode ? ` • ${titleCase(p.mode)}` : ''}</Text>
      </View>
      <Text style={[styles.amount, { color: '#16a34a' }]}>{formatINR(p.amount)}</Text>
    </Pressable>
  );
  const renderStock = ({ item: r }: any) => (
    <View style={[styles.row, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
      <View style={[styles.icon, { backgroundColor: colors.brandSoft }]}><Icon name="package-variant-closed" size={16} color={colors.brand} /></View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>{r.productname}</Text>
        <Text style={[styles.meta, { color: colors.subText }]} numberOfLines={1}>{[r.variantname, r.productcode].filter(Boolean).join(' · ') || '—'}</Text>
      </View>
      <Text style={[styles.amount, { color: Number(r.qty) < 0 ? '#ef4444' : colors.text }]}>{Number(r.qty).toLocaleString('en-IN')} {r.unitname || ''}</Text>
    </View>
  );

  const tabs = [
    { key: 'orders', label: 'Orders', count: orders.length },
    { key: 'payments', label: 'Payments', count: payments.length },
    ...(trackStock ? [{ key: 'stock', label: 'Stock', count: stock.length }] : []),
  ] as const;
  const list = tab === 'orders' ? orders : tab === 'payments' ? payments : stock;
  const loading = tab === 'orders' ? ordLoading && !ordData : tab === 'payments' ? payLoading && !payData : stockLoading && !stockData;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />
      <BackHeader label={name} />

      <View style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
        <View style={styles.head}>
          <View style={[styles.avatar, { backgroundColor: colors.brandSoft }]}>
            <Text style={[styles.avatarText, { color: colors.brand }]}>{String(name).charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{name}</Text>
            <Text style={[styles.meta, { color: colors.subText }]} numberOfLines={1}>
              {[party?.mobile, party?.city, party?.channel?.channelName].filter(Boolean).join(' • ') || '—'}
            </Text>
          </View>
          {!!party?.mobile && (
            <Pressable style={[styles.callBtn, { borderColor: colors.border }]} onPress={() => Linking.openURL(`tel:${party.mobile}`)}>
              <Icon name="phone-outline" size={18} color={colors.brand} />
            </Pressable>
          )}
        </View>
        <View style={[styles.stats, { borderTopColor: colors.border }]}>
          {[
            { label: 'Orders', value: String(orders.length), tint: '#3b82f6' },
            { label: 'Order value', value: formatINR(orderValue), tint: colors.brand },
            { label: 'Received', value: formatINR(received), tint: '#16a34a' },
            { label: 'Due', value: formatINR(due), tint: due > 0 ? '#ef4444' : colors.subText },
          ].map((s) => (
            <View key={s.label} style={styles.stat}>
              <Text style={[styles.statValue, { color: s.tint }]} numberOfLines={1} adjustsFontSizeToFit>{s.value}</Text>
              <Text style={[styles.meta, { color: colors.subText }]}>{s.label}</Text>
            </View>
          ))}
        </View>
        <View style={styles.actions}>
          <Pressable style={[styles.primaryBtn, { backgroundColor: colors.brand }]} onPress={newOrder}>
            <Icon name="cart-plus" size={18} color={colors.onBrand} />
            <Text style={[styles.primaryText, { color: colors.onBrand }]}>New Order</Text>
          </Pressable>
          {due > 0 && (
            <Pressable
              style={[styles.secondaryBtn, { borderColor: colors.brand }]}
              onPress={() => navigation.navigate('CollectPayment', { partyId, partyName: name, outstanding: due })}
            >
              <Icon name="cash-plus" size={18} color={colors.brand} />
              <Text style={[styles.primaryText, { color: colors.brand }]}>Collect</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={[styles.tabs, { backgroundColor: colors.raisedSurface, borderColor: colors.border }]}>
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <Pressable key={t.key} style={[styles.tab, active && { backgroundColor: colors.brand }]} onPress={() => setTab(t.key as any)}>
              <Text style={[styles.tabText, { color: active ? colors.onBrand : colors.subText }]}>{t.label} ({t.count})</Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.brand} /></View>
      ) : (
        <DynamicFlashList
          data={list}
          renderItem={tab === 'orders' ? renderOrder : tab === 'payments' ? renderPayment : renderStock}
          keyExtractor={(item: any) => item.id}
          estimatedItemSize={76}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <Icon name={tab === 'orders' ? 'clipboard-off-outline' : tab === 'payments' ? 'cash-remove' : 'package-variant'} size={42} color={colors.border} />
              <Text style={[styles.meta, { color: colors.subText, marginTop: 8 }]}>
                {tab === 'orders' ? 'No orders yet' : tab === 'payments' ? 'No payments yet' : 'No stock yet'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: {
    marginHorizontal: 18, marginTop: 12, borderRadius: 18, borderWidth: 1, padding: 14,
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontFamily: FONTS.bold },
  name: { fontSize: 16, fontFamily: FONTS.bold },
  meta: { fontSize: 12, fontFamily: FONTS.regular },
  callBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  stat: { flex: 1, alignItems: 'center', paddingHorizontal: 2 },
  statValue: { fontSize: 14, fontFamily: FONTS.bold },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  primaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 11 },
  secondaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 10, borderWidth: 1.5 },
  primaryText: { fontSize: 14, fontFamily: FONTS.bold },
  tabs: { flexDirection: 'row', marginHorizontal: 18, marginTop: 12, marginBottom: 6, borderRadius: 12, borderWidth: 1, padding: 3 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  tabText: { fontSize: 13, fontFamily: FONTS.semiBold },
  list: { paddingHorizontal: 18, paddingBottom: 40, paddingTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14, fontFamily: FONTS.bold },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, marginTop: 4 },
  badgeText: { fontSize: 11, fontFamily: FONTS.semiBold },
  amount: { fontSize: 14, fontFamily: FONTS.bold },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 50 },
});
