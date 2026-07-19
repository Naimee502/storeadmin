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
import { formatINR, formatBillNumber } from '../../../../utils';
import { GET_DELIVERY_POOL, GET_MY_DELIVERIES, GET_PAYMENTS } from '../../../../apollo/queries/accounts';
import { usePunchGate } from '../../../../apollo/hooks/attendance';
import type { RootState } from '../../../../store/rootreducer';

const STATUS_META: Record<string, { color: string; icon: string; label: string }> = {
  available: { color: '#f59e0b', icon: 'package-variant-closed',  label: 'Available' },
  out:       { color: '#0ea5e9', icon: 'truck-fast-outline',      label: 'Out'       },
  delivered: { color: '#22c55e', icon: 'check-circle-outline',    label: 'Delivered' },
};

export default function DeliveryDashboard() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const user    = useSelector((s: RootState) => s.auth.user);
  const adminId = useSelector((s: RootState) => s.tenant.adminId);
  const { bellIcon, NotificationsModal } = useNotificationCenter();
  const { blocked: punchBlocked } = usePunchGate();

  // Require punch-in before any delivery work. Attendance & Profile stay
  // accessible so the user can actually punch in / sign out.
  const goWithPunch = (screen: string, params?: any) => {
    if (punchBlocked && !/attendance|profile/i.test(screen)) {
      Alert.alert(
        'Punch in required',
        'Please punch in from the Attendance tab before starting your deliveries.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go to Attendance', onPress: () => navigation.navigate('DeliveryAttendance') },
        ],
      );
      return;
    }
    navigation.navigate(screen, params);
  };

  const { data: poolData, refetch: refetchPool } = useQuery(GET_DELIVERY_POOL, {
    variables: { filter: { adminid: adminId, unassignedDelivery: true } },
    skip: !adminId,
    fetchPolicy: 'cache-and-network',
  });
  const { data: mineData, refetch: refetchMine } = useQuery(GET_MY_DELIVERIES, {
    variables: { filter: { adminid: adminId, deliveryboyid: user?.id } },
    skip: !adminId || !user?.id,
    fetchPolicy: 'cache-and-network',
  });
  const { data: payData, refetch: refetchPay } = useQuery(GET_PAYMENTS, {
    variables: { adminid: adminId },
    skip: !adminId,
    fetchPolicy: 'cache-and-network',
  });
  useFocusEffect(useCallback(() => { refetchPool?.(); refetchMine?.(); refetchPay?.(); }, [refetchPool, refetchMine, refetchPay]));

  const today = new Date().toISOString().slice(0, 10);
  const ymd = (d: any) => {
    const t = Number(d); const dt = !isNaN(t) ? new Date(t) : new Date(d);
    return isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0, 10);
  };

  const availableOrders = (poolData as any)?.getSalesInvoices ?? [];
  const mineOrders      = (mineData as any)?.getSalesInvoices ?? [];
  const outOrders       = mineOrders.filter((o: any) => o.deliveryStatus === 'dispatched');
  const deliveredAll    = mineOrders.filter((o: any) => o.deliveryStatus === 'delivered');
  const deliveredToday  = deliveredAll.filter((o: any) => ymd(o.deliveredAt) === today);
  const deliveredTodayValue = deliveredToday.reduce((s: number, o: any) => s + (o.totalamount ?? 0), 0);

  // Cash actually collected BY THIS delivery boy today (receipts he recorded).
  const collectedToday = useMemo(() => {
    return ((payData as any)?.getPayments ?? [])
      .filter((p: any) =>
        p.type === 'receipt' && p.status !== false &&
        String(p.createdby_id || '') === String(user?.id || '') &&
        ymd(p.paymentdate) === today)
      .reduce((s: number, p: any) => s + (p.amount || 0), 0);
  }, [payData, today, user?.id]);

  const todaysDeliveries = useMemo(() => {
    const fmt = (o: any) => formatBillNumber({ billnumber: o.billnumber, isConverted: true });
    const out = outOrders.map((o: any) => ({ id: o.id, orderNum: fmt(o), party: o.partyacc?.accountname ?? '—', address: o.partyacc?.address ?? '', amount: o.totalamount ?? 0, status: 'out' }));
    const avail = availableOrders.map((o: any) => ({ id: o.id, orderNum: fmt(o), party: o.partyacc?.accountname ?? '—', address: o.partyacc?.address ?? '', amount: o.totalamount ?? 0, status: 'available' }));
    return [...out, ...avail].slice(0, 6);
  }, [mineData, poolData]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

      <AppHeader label={`Hello, ${user?.name?.split(' ')[0] ?? 'Driver'}`} rightIcons={[bellIcon]} />
      {NotificationsModal}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Today summary — delivered value + cash collected */}
        <Animated.View
          entering={FadeInUp.duration(400).delay(50)}
          style={[styles.todayCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
        >
          <View style={styles.todayHalf}>
            <View style={styles.todayLabelRow}>
              <Icon name="truck-check-outline" size={13} color={colors.brand} />
              <Text style={[styles.todayLabel, { color: colors.subText }]}>Delivered today</Text>
            </View>
            <Text style={[styles.todayValue, { color: colors.text }]} numberOfLines={1}>
              {deliveredToday.length}
            </Text>
          </View>
          <View style={[styles.todayVDivider, { backgroundColor: colors.border }]} />
          <View style={styles.todayHalf}>
            <View style={styles.todayLabelRow}>
              <Icon name="cash-check" size={13} color="#16a34a" />
              <Text style={[styles.todayLabel, { color: colors.subText }]}>Collected</Text>
            </View>
            <Text style={[styles.todayValue, { color: '#16a34a' }]} numberOfLines={1}>{formatINR(collectedToday)}</Text>
          </View>
        </Animated.View>

        {/* Compact stat strip */}
        <Animated.View
          entering={FadeInUp.duration(400).delay(90)}
          style={[styles.statStrip, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
        >
          {[
            { value: String(availableOrders.length), label: 'Available',  color: '#f59e0b' },
            { value: String(outOrders.length),       label: 'Out',        color: '#0ea5e9' },
            { value: String(deliveredToday.length),  label: 'Done Today', color: '#22c55e' },
            { value: String(deliveredAll.length),    label: 'Total Done', color: '#8b5cf6' },
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

        {/* Quick actions */}
        <Animated.View entering={FadeInUp.duration(400).delay(120)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
          <View style={styles.actionsRow}>
            {[
              { icon: 'truck-delivery-outline', label: 'Deliveries',  screen: 'DeliveryList',        color: '#f59e0b' },
              { icon: 'cash-multiple',          label: 'Collections', screen: 'DeliveryCollections', color: '#22c55e' },
              { icon: 'calendar-check-outline', label: 'Attendance',  screen: 'DeliveryAttendance',  color: '#3b82f6' },
            ].map((a) => (
              <TouchableOpacity
                key={a.screen}
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

        {/* Today's deliveries */}
        <Animated.View entering={FadeInUp.duration(400).delay(180)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Today's Deliveries</Text>
            <TouchableOpacity onPress={() => goWithPunch('DeliveryList')}>
              <Text style={[styles.viewAll, { color: colors.brand }]}>View all</Text>
            </TouchableOpacity>
          </View>

          {todaysDeliveries.length === 0 && (
            <View style={[styles.deliveryCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
              <Text style={[styles.address, { color: colors.subText }]}>No deliveries right now</Text>
            </View>
          )}
          {todaysDeliveries.map((d: any) => {
            const meta   = STATUS_META[d.status] ?? STATUS_META.available;
            return (
              <TouchableOpacity
                key={d.id}
                style={[styles.deliveryCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
                onPress={() => goWithPunch('OrderDetail', { invoiceId: d.id })}
                activeOpacity={0.85}
              >
                <View style={[styles.deliveryIcon, { backgroundColor: meta.color + '18' }]}>
                  <Icon name="truck-delivery-outline" size={20} color={meta.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.orderNum, { color: colors.text }]}>{d.orderNum}</Text>
                  <Text style={[styles.partyName, { color: colors.subText }]} numberOfLines={1}>{d.party}</Text>
                  <View style={styles.addressRow}>
                    <Icon name="map-marker-outline" size={11} color={colors.subText} style={{ marginRight: 3 }} />
                    <Text style={[styles.address, { color: colors.subText }]} numberOfLines={1}>{d.address}</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.amount, { color: colors.text }]}>{formatINR(d.amount)}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: meta.color + '22' }]}>
                    <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>
                <Icon name="chevron-right" size={18} color={colors.subText} style={{ alignSelf: 'center', marginLeft: 2 }} />
              </TouchableOpacity>
            );
          })}
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

  deliveryCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10,
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  deliveryIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  orderNum:     { fontSize: 13, fontFamily: FONTS.bold, marginBottom: 2 },
  partyName:    { fontSize: 12, fontFamily: FONTS.semiBold, marginBottom: 2 },
  addressRow:   { flexDirection: 'row', alignItems: 'center' },
  address:      { fontSize: 11, fontFamily: FONTS.regular, flex: 1 },
  amount:       { fontSize: 13, fontFamily: FONTS.bold, marginBottom: 4 },
  statusBadge:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText:   { fontSize: 10, fontFamily: FONTS.semiBold },

  actionsRow: { flexDirection: 'row', gap: 12 },
  actionCard: {
    flex: 1, borderRadius: 18, borderWidth: 1, padding: 16, alignItems: 'center', gap: 10,
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  actionIcon:  { width: 48, height: 48, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  actionLabel: { fontSize: 13, fontFamily: FONTS.semiBold },
});
