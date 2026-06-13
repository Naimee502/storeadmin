import React, { useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { COLORS, FONTS, useTheme } from '../../../../config';
import { AppHeader } from '../../../../components';
import { formatINR, formatDate, formatBillNumber } from '../../../../utils';
import { GET_SALES_ORDERS, GET_PAYMENTS, GET_ACCOUNTS } from '../../../../apollo/queries/accounts';
import type { RootState } from '../../../../store/rootreducer';

const STATUS_COLOR: Record<string, string> = {
  Cancelled: '#ef4444', Confirmed: '#3b82f6', Pending: '#f59e0b',
  Dispatched: '#0ea5e9', Delivered: '#22c55e',
};

function orderLabel(o: any): string {
  if (o.cancelStatus === 'cancelled') return 'Cancelled';
  if (o.deliveryStatus === 'delivered') return 'Delivered';
  if (o.deliveryStatus === 'dispatched') return 'Dispatched';
  if (o.isConverted) return 'Confirmed';
  return 'Pending';
}

export default function SalesmanDashboard() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const user   = useSelector((s: RootState) => s.auth.user);
  const tenant = useSelector((s: RootState) => s.tenant);
  const adminid = tenant.adminId ?? '';

  const { data, refetch } = useQuery(GET_SALES_ORDERS, {
    variables: { adminid, salesmenid: user?.id },
    skip: !adminid || !user?.id,
    fetchPolicy: 'cache-and-network',
  });

  // Today's collections (this salesman's receipts) + my parties (for outstanding).
  const { data: payData, refetch: refetchPay } = useQuery(GET_PAYMENTS, {
    variables: { adminid },
    skip: !adminid,
    fetchPolicy: 'cache-and-network',
  });
  const { data: partyData, refetch: refetchParties } = useQuery(GET_ACCOUNTS, {
    variables: { admin: adminid, salesmanid: user?.id },
    skip: !adminid || !user?.id,
    fetchPolicy: 'cache-and-network',
  });

  // Re-pull whenever the dashboard regains focus, so new orders/payments show immediately.
  useFocusEffect(useCallback(() => { refetch?.(); refetchPay?.(); refetchParties?.(); }, [refetch, refetchPay, refetchParties]));

  const orders = useMemo(() => (data as any)?.getSalesOrders ?? [], [data]);

  const today       = new Date().toISOString().slice(0, 10);
  const todayOrders = useMemo(() => orders.filter((o: any) => (o.billdate ?? '').startsWith(today)), [orders, today]);
  const pending     = useMemo(() => orders.filter((o: any) => !o.isConverted && o.cancelStatus !== 'cancelled').length, [orders]);
  const confirmed   = useMemo(() => orders.filter((o: any) => o.isConverted).length, [orders]);
  const recent      = useMemo(() => orders.slice(0, 5), [orders]);

  const ymd = (d: any) => {
    const t = Number(d); const dt = !isNaN(t) ? new Date(t) : new Date(d);
    return isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0, 10);
  };
  const todaySales = useMemo(
    () => todayOrders.reduce((s: number, o: any) => s + (o.totalamount || 0), 0),
    [todayOrders],
  );
  const todayCollection = useMemo(() => {
    return ((payData as any)?.getPayments ?? [])
      .filter((p: any) => p.type === 'receipt' && p.status !== false && ymd(p.paymentdate) === today)
      .reduce((s: number, p: any) => s + (p.amount || 0), 0);
  }, [payData, today]);
  const parties = useMemo(() => (partyData as any)?.getAccounts ?? [], [partyData]);
  const totalOutstanding = useMemo(
    () => parties.reduce((s: number, p: any) => s + Math.max(0, p.outstanding || 0), 0),
    [parties],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

      <AppHeader label={`Hello, ${user?.name?.split(' ')[0] ?? 'Salesman'}`} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Today summary — clean card, brand only as accent */}
        <Animated.View
          entering={FadeInUp.duration(400).delay(50)}
          style={[styles.todayCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
        >
          <View style={styles.todayHalf}>
            <View style={styles.todayLabelRow}>
              <Icon name="trending-up" size={13} color={colors.brand} />
              <Text style={[styles.todayLabel, { color: colors.subText }]}>Sales today</Text>
            </View>
            <Text style={[styles.todayValue, { color: colors.text }]} numberOfLines={1}>{formatINR(todaySales)}</Text>
          </View>
          <View style={[styles.todayVDivider, { backgroundColor: colors.border }]} />
          <View style={styles.todayHalf}>
            <View style={styles.todayLabelRow}>
              <Icon name="cash-check" size={13} color="#16a34a" />
              <Text style={[styles.todayLabel, { color: colors.subText }]}>Collected</Text>
            </View>
            <Text style={[styles.todayValue, { color: '#16a34a' }]} numberOfLines={1}>{formatINR(todayCollection)}</Text>
          </View>
        </Animated.View>

        {/* Compact stat strip */}
        <Animated.View
          entering={FadeInUp.duration(400).delay(90)}
          style={[styles.statStrip, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
        >
          {[
            { value: String(todayOrders.length),  label: 'Orders',     color: '#3b82f6' },
            { value: String(pending),             label: 'Pending',    color: '#f59e0b' },
            { value: formatINR(totalOutstanding), label: 'To Collect', color: '#ef4444' },
            { value: String(parties.length),      label: 'Parties',    color: '#8b5cf6' },
          ].map((s, i) => (
            <React.Fragment key={s.label}>
              {i > 0 && <View style={[styles.stripDivider, { backgroundColor: colors.border }]} />}
              <View style={styles.stripItem}>
                <Text style={[styles.stripValue, { color: s.color }]} numberOfLines={1}>{s.value}</Text>
                <Text style={[styles.stripLabel, { color: colors.subText }]}>{s.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </Animated.View>

        {/* Today's Route */}
        <Animated.View entering={FadeInUp.duration(400).delay(120)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Today's Route</Text>
          <TouchableOpacity
            style={[styles.routeCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
            onPress={() => navigation.navigate('SalesmanRoutes')}
            activeOpacity={0.82}
          >
            <View style={[styles.routeIconWrap, { backgroundColor: colors.brandSoft }]}>
              <Icon name="map-marker-path" size={24} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.routeName, { color: colors.text }]}>View My Route</Text>
              <Text style={[styles.routeCode, { color: colors.subText }]}>Tap to see today's stops</Text>
            </View>
            <Icon name="chevron-right" size={18} color={colors.subText} style={{ marginLeft: 8 }} />
          </TouchableOpacity>

          {/* Direct (route-less) ordering — pick any party from your channel */}
          <TouchableOpacity
            style={[styles.routeCard, { backgroundColor: colors.cardGlass, borderColor: colors.border, marginTop: 10 }]}
            onPress={() => navigation.navigate('SalesmanParties')}
            activeOpacity={0.82}
          >
            <View style={[styles.routeIconWrap, { backgroundColor: colors.brandSoft }]}>
              <Icon name="account-group-outline" size={24} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.routeName, { color: colors.text }]}>All Parties</Text>
              <Text style={[styles.routeCode, { color: colors.subText }]}>Take an order without a route</Text>
            </View>
            <Icon name="chevron-right" size={18} color={colors.subText} style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </Animated.View>

        {/* Recent Orders */}
        <Animated.View entering={FadeInUp.duration(400).delay(180)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Orders</Text>
            <TouchableOpacity onPress={() => navigation.navigate('SalesmanOrders')}>
              <Text style={[styles.viewAll, { color: colors.brand }]}>View all</Text>
            </TouchableOpacity>
          </View>

          {recent.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
              <Icon name="clipboard-outline" size={28} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.subText }]}>No orders yet</Text>
            </View>
          ) : (
            recent.map((order: any) => {
              const label  = orderLabel(order);
              const colour = STATUS_COLOR[label] ?? colors.brand;
              return (
                <TouchableOpacity
                  key={order.id}
                  style={[styles.orderCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
                  onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
                  activeOpacity={0.85}
                >
                  <View style={[styles.statusDot, { backgroundColor: colour }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.orderNum, { color: colors.text }]}>{formatBillNumber(order)}</Text>
                    <Text style={[styles.orderParty, { color: colors.subText }]} numberOfLines={1}>
                      {order.partyacc?.accountname ?? '—'}
                    </Text>
                    <Text style={[styles.orderDate, { color: colors.subText }]}>{formatDate(order.billdate)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.orderAmt, { color: colors.text }]}>{formatINR(order.totalamount)}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: colour + '22' }]}>
                      <Text style={[styles.statusText, { color: colour }]}>{label}</Text>
                    </View>
                  </View>
                  <Icon name="chevron-right" size={18} color={colors.subText} style={{ marginLeft: 8 }} />
                </TouchableOpacity>
              );
            })
          )}
        </Animated.View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll:    { paddingBottom: 110 },

  todayCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 18, marginTop: 14,
    borderRadius: 16, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 16,
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  todayHalf:      { flex: 1 },
  todayLabelRow:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  todayLabel:     { fontSize: 11.5, fontFamily: FONTS.regular },
  todayValue:     { fontSize: 20, fontFamily: FONTS.bold, marginTop: 3 },
  todayVDivider:  { width: 1, height: 38, marginHorizontal: 14 },

  statStrip: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 18, marginTop: 10,
    borderRadius: 16, borderWidth: 1, paddingVertical: 12,
  },
  stripItem:    { flex: 1, alignItems: 'center' },
  stripDivider: { width: 1, height: 26 },
  stripValue:   { fontSize: 14, fontFamily: FONTS.bold },
  stripLabel:   { fontSize: 10, fontFamily: FONTS.regular, marginTop: 3 },

  section:       { marginTop: 20, paddingHorizontal: 18 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle:  { fontSize: 15, fontFamily: FONTS.bold, marginBottom: 12 },
  viewAll:       { fontSize: 13, fontFamily: FONTS.semiBold },

  routeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 18, borderWidth: 1, padding: 14,
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  routeIconWrap: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  routeName:     { fontSize: 14, fontFamily: FONTS.bold },
  routeCode:     { fontSize: 12, fontFamily: FONTS.regular, marginTop: 2 },

  emptyCard: { borderRadius: 16, borderWidth: 1, paddingVertical: 22, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { fontSize: 13, fontFamily: FONTS.regular },

  orderCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10,
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  statusDot:   { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  orderNum:    { fontSize: 13, fontFamily: FONTS.bold },
  orderParty:  { fontSize: 12, fontFamily: FONTS.regular, marginTop: 1 },
  orderDate:   { fontSize: 11, fontFamily: FONTS.regular, marginTop: 2 },
  orderAmt:    { fontSize: 13, fontFamily: FONTS.bold, marginBottom: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText:  { fontSize: 10, fontFamily: FONTS.semiBold },
});
