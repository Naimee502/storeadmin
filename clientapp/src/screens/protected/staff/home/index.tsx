import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Alert } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { COLORS, FONTS, useTheme } from '../../../../config';
import { AppHeader, useNotificationCenter } from '../../../../components';
import { formatINR, formatDate, formatBillNumber } from '../../../../utils';
import { GET_SALES_ORDERS } from '../../../../apollo/queries/accounts';
import { usePunchGate } from '../../../../apollo/hooks/attendance';
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

export default function StaffDashboard() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const user   = useSelector((s: RootState) => s.auth.user);
  const tenant = useSelector((s: RootState) => s.tenant);
  const adminid = tenant.adminId ?? '';
  const { bellIcon, NotificationsModal } = useNotificationCenter();
  const { blocked: punchBlocked } = usePunchGate();

  // Require punch-in before any work (orders / parties). Attendance & Profile
  // stay accessible so the user can actually punch in / sign out.
  const goWithPunch = (screen: string, params?: any) => {
    if (punchBlocked && !/attendance|profile/i.test(screen)) {
      Alert.alert(
        'Punch in required',
        'Please punch in from the Attendance tab before starting your work.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go to Attendance', onPress: () => navigation.navigate('StaffAttendance') },
        ],
      );
      return;
    }
    navigation.navigate(screen, params);
  };

  const { data, refetch } = useQuery(GET_SALES_ORDERS, {
    variables: { adminid },
    skip: !adminid,
    fetchPolicy: 'cache-and-network',
  });
  useFocusEffect(useCallback(() => { refetch?.(); }, [refetch]));

  // Newest first — orders come back oldest-first from the server.
  const orders = useMemo(() => [...((data as any)?.getSalesOrders ?? [])].reverse(), [data]);

  const today       = new Date().toISOString().slice(0, 10);
  const thisMonth   = today.slice(0, 7);
  const todayOrders = useMemo(() => orders.filter((o: any) => (o.billdate ?? '').startsWith(today)), [orders, today]);
  const pending     = useMemo(() => orders.filter((o: any) => !o.isConverted && o.cancelStatus !== 'cancelled').length, [orders]);
  const confirmed   = useMemo(() => orders.filter((o: any) => o.isConverted).length, [orders]);
  const recent      = useMemo(() => orders.slice(0, 3), [orders]);

  const todaySales = useMemo(
    () => todayOrders.reduce((s: number, o: any) => s + (o.totalamount || 0), 0),
    [todayOrders],
  );
  const monthSales = useMemo(
    () => orders
      .filter((o: any) => (o.billdate ?? '').startsWith(thisMonth) && o.cancelStatus !== 'cancelled')
      .reduce((s: number, o: any) => s + (o.totalamount || 0), 0),
    [orders, thisMonth],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

      <AppHeader label={`Hello, ${user?.name?.split(' ')[0] ?? 'Staff'}`} rightIcons={[bellIcon]} />
      {NotificationsModal}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Today summary — sales today + this month */}
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
              <Icon name="calendar-month-outline" size={13} color="#16a34a" />
              <Text style={[styles.todayLabel, { color: colors.subText }]}>This month</Text>
            </View>
            <Text style={[styles.todayValue, { color: '#16a34a' }]} numberOfLines={1}>{formatINR(monthSales)}</Text>
          </View>
        </Animated.View>

        {/* Compact stat strip */}
        <Animated.View
          entering={FadeInUp.duration(400).delay(90)}
          style={[styles.statStrip, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
        >
          {[
            { value: String(todayOrders.length), label: 'Today',     color: '#3b82f6', filter: 'all' },
            { value: String(pending),            label: 'Pending',   color: '#f59e0b', filter: 'pending' },
            { value: String(confirmed),          label: 'Confirmed', color: '#22c55e', filter: 'confirmed' },
            { value: String(orders.length),      label: 'Total',     color: '#8b5cf6', filter: 'all' },
          ].map((s, i) => (
            <React.Fragment key={s.label}>
              {i > 0 && <View style={[styles.stripDivider, { backgroundColor: colors.border }]} />}
              <TouchableOpacity
                style={styles.stripItem}
                onPress={() => goWithPunch('StaffOrders', { initialFilter: s.filter })}
                activeOpacity={0.7}
              >
                <Text style={[styles.stripValue, { color: s.color }]} numberOfLines={1}>{s.value}</Text>
                <Text style={[styles.stripLabel, { color: colors.subText }]}>{s.label}</Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </Animated.View>

        {/* Quick Actions */}
        <Animated.View entering={FadeInUp.duration(400).delay(120)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {[
              { icon: 'clipboard-plus-outline', label: 'New Order',  screen: 'StaffParties',    color: colors.brand },
              { icon: 'account-group-outline',  label: 'Parties',    screen: 'StaffParties',    color: '#3b82f6'    },
              { icon: 'calendar-check-outline', label: 'Attendance', screen: 'StaffAttendance', color: '#22c55e'    },
              { icon: 'account-circle-outline', label: 'Profile',    screen: 'StaffProfile',    color: '#8b5cf6'    },
            ].map((a) => (
              <TouchableOpacity
                key={a.label}
                style={[styles.actionCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
                onPress={() => goWithPunch(a.screen)}
                activeOpacity={0.82}
              >
                <View style={[styles.actionIcon, { backgroundColor: a.color + '18' }]}>
                  <Icon name={a.icon} size={22} color={a.color} />
                </View>
                <Text style={[styles.actionLabel, { color: colors.text }]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* Recent Orders */}
        <Animated.View entering={FadeInUp.duration(400).delay(180)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Orders</Text>
            <TouchableOpacity onPress={() => goWithPunch('StaffOrders')}>
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
                  onPress={() => goWithPunch('OrderDetail', { orderId: order.id })}
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
  section:       { marginTop: 22, paddingHorizontal: 18 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle:  { fontSize: 15, fontFamily: FONTS.bold, marginBottom: 12 },
  viewAll:       { fontSize: 13, fontFamily: FONTS.semiBold },
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
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionCard:  { width: '47%', flexGrow: 1, borderRadius: 18, borderWidth: 1, paddingVertical: 20, paddingHorizontal: 12, alignItems: 'center', gap: 10, shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  actionIcon:  { width: 48, height: 48, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  actionLabel: { fontSize: 13, fontFamily: FONTS.semiBold },
});
