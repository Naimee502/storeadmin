import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { COLORS, FONTS, useTheme } from '../../../../config';
import { AppHeader } from '../../../../components';
import { formatINR, formatDate } from '../../../../utils';
import type { RootState } from '../../../../store/rootreducer';

const DUMMY_STATS = { ordersToday: 7, pendingOrders: 3, attendanceToday: 'Present' };

const DUMMY_ORDERS = [
  { id: 'o1', billnumber: 'SO/2024/025', billdate: '2024-11-15T00:00:00.000Z', totalamount: 6800, partyName: 'Mehta Traders',  status: true,  cancelStatus: null        },
  { id: 'o2', billnumber: 'SO/2024/024', billdate: '2024-11-15T00:00:00.000Z', totalamount: 3200, partyName: 'Patel General',  status: false, cancelStatus: null        },
  { id: 'o3', billnumber: 'SO/2024/023', billdate: '2024-11-14T00:00:00.000Z', totalamount: 9100, partyName: 'Gupta Kirana',   status: false, cancelStatus: 'cancelled' },
  { id: 'o4', billnumber: 'SO/2024/022', billdate: '2024-11-14T00:00:00.000Z', totalamount: 4500, partyName: 'Shah Stores',    status: true,  cancelStatus: null        },
];

const STATUS_COLOR: Record<string, string> = {
  Cancelled: '#ef4444', Confirmed: '#3b82f6', Pending: '#f59e0b',
};

function orderLabel(o: any) {
  if (o.cancelStatus === 'cancelled') return 'Cancelled';
  if (o.status) return 'Confirmed';
  return 'Pending';
}

export default function StaffDashboard() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const user = useSelector((s: RootState) => s.auth.user);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

      <AppHeader label={`Hello, ${user?.name?.split(' ')[0] ?? 'Staff'}`} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Stats */}
        <Animated.View entering={FadeInUp.duration(400).delay(60)} style={styles.statsRow}>
          {[
            { icon: 'clipboard-list-outline',  value: String(DUMMY_STATS.ordersToday),  label: "Today's Orders", color: '#3b82f6' },
            { icon: 'clock-outline',           value: String(DUMMY_STATS.pendingOrders), label: 'Pending',       color: '#f59e0b' },
            { icon: 'calendar-check-outline',  value: DUMMY_STATS.attendanceToday,       label: 'Attendance',    color: '#22c55e' },
          ].map((s) => (
            <View key={s.label} style={[styles.statCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
              <View style={[styles.statIcon, { backgroundColor: s.color + '18' }]}>
                <Icon name={s.icon} size={17} color={s.color} />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: colors.subText }]}>{s.label}</Text>
            </View>
          ))}
        </Animated.View>

        {/* Recent Orders */}
        <Animated.View entering={FadeInUp.duration(400).delay(120)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Orders</Text>
            <TouchableOpacity onPress={() => navigation.navigate('StaffOrders')}>
              <Text style={[styles.viewAll, { color: colors.brand }]}>View all</Text>
            </TouchableOpacity>
          </View>
          {DUMMY_ORDERS.map((order) => {
            const label  = orderLabel(order);
            const colour = STATUS_COLOR[label] ?? colors.brand;
            return (
              <View key={order.id} style={[styles.orderCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
                <View style={[styles.statusDot, { backgroundColor: colour }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.orderNum, { color: colors.text }]}>{order.billnumber}</Text>
                  <Text style={[styles.orderParty, { color: colors.subText }]}>{order.partyName}</Text>
                  <Text style={[styles.orderDate, { color: colors.subText }]}>{formatDate(order.billdate)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.orderAmt, { color: colors.text }]}>{formatINR(order.totalamount)}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: colour + '22' }]}>
                    <Text style={[styles.statusText, { color: colour }]}>{label}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </Animated.View>

        {/* Quick actions */}
        <Animated.View entering={FadeInUp.duration(400).delay(180)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {[
              { icon: 'clipboard-plus-outline', label: 'New Order',  screen: 'StaffParties',    color: colors.brand   },
              { icon: 'account-group-outline',  label: 'Parties',    screen: 'StaffParties',    color: '#3b82f6'      },
              { icon: 'calendar-check-outline', label: 'Attendance', screen: 'StaffAttendance', color: '#22c55e'      },
              { icon: 'account-circle-outline', label: 'Profile',    screen: 'StaffProfile',    color: '#8b5cf6'      },
            ].map((a) => (
              <TouchableOpacity
                key={a.label}
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
  statsRow:  { flexDirection: 'row', paddingHorizontal: 18, gap: 10, marginTop: 14 },
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
