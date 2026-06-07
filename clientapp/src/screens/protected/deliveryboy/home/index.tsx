import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { COLORS, FONTS, useTheme } from '../../../../config';
import { AppHeader } from '../../../../components';
import { formatINR, formatBillNumber } from '../../../../utils';
import { GET_DELIVERY_POOL, GET_MY_DELIVERIES } from '../../../../apollo/queries/accounts';
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
  useFocusEffect(useCallback(() => { refetchPool?.(); refetchMine?.(); }, [refetchPool, refetchMine]));

  const today = new Date().toISOString().slice(0, 10);
  const availableOrders = (poolData as any)?.getSalesInvoices ?? [];
  const mineOrders      = (mineData as any)?.getSalesInvoices ?? [];
  const outOrders       = mineOrders.filter((o: any) => o.deliveryStatus === 'dispatched');
  const deliveredToday  = mineOrders.filter((o: any) => o.deliveryStatus === 'delivered' && (o.deliveredAt ?? '').startsWith(today));
  const collectedToday  = deliveredToday.reduce((s: number, o: any) => s + (o.totalamount ?? 0), 0);

  const stats = [
    { icon: 'package-variant-closed', value: String(availableOrders.length + outOrders.length), label: 'Pending',   color: '#f59e0b' },
    { icon: 'check-circle-outline',   value: String(deliveredToday.length),                     label: 'Delivered', color: '#22c55e' },
    { icon: 'cash-multiple',          value: formatINR(collectedToday),                         label: 'Collected', color: colors.brand },
  ];

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

      <AppHeader label={`Hello, ${user?.name?.split(' ')[0] ?? 'Driver'}`} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Stats */}
        <Animated.View entering={FadeInUp.duration(400).delay(60)} style={styles.statsRow}>
          {stats.map((s) => (
            <View key={s.label} style={[styles.statCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
              <View style={[styles.statIcon, { backgroundColor: s.color + '18' }]}>
                <Icon name={s.icon} size={17} color={s.color} />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: colors.subText }]}>{s.label}</Text>
            </View>
          ))}
        </Animated.View>

        {/* Today's deliveries */}
        <Animated.View entering={FadeInUp.duration(400).delay(120)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Today's Deliveries</Text>
            <TouchableOpacity onPress={() => navigation.navigate('DeliveryList')}>
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
              <View key={d.id} style={[styles.deliveryCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
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
              </View>
            );
          })}
        </Animated.View>

        {/* Quick actions */}
        <Animated.View entering={FadeInUp.duration(400).delay(180)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
          <View style={styles.actionsRow}>
            {[
              { icon: 'cash-multiple',          label: 'Collections',  screen: 'DeliveryCollections', color: '#22c55e' },
              { icon: 'calendar-check-outline', label: 'Attendance',   screen: 'DeliveryAttendance',  color: '#3b82f6' },
            ].map((a) => (
              <TouchableOpacity
                key={a.screen}
                style={[styles.actionCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
                onPress={() => navigation.navigate(a.screen)}
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

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll:    { paddingBottom: 110 },

  statsRow: { flexDirection: 'row', paddingHorizontal: 18, gap: 10, marginTop: 14 },
  statCard: {
    flex: 1, borderRadius: 18, borderWidth: 1, padding: 12, alignItems: 'flex-start',
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  statIcon:  { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statValue: { fontSize: 13, fontFamily: FONTS.bold },
  statLabel: { fontSize: 9, fontFamily: FONTS.regular, marginTop: 2 },

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
