import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { COLORS, FONTS, STRINGS, useTheme } from '../../../../config';
import { GET_SALES_ORDERS, GET_ACCOUNT } from '../../../../apollo/queries/accounts';
import { formatINR, formatDate, formatBillNumber } from '../../../../utils';
import type { RootState } from '../../../../store/rootreducer';

/**
 * A trade party's outstanding balance and last two orders, as Home's list
 * header.
 *
 * It owns its own queries on purpose. They used to live in Home's own body,
 * which meant every result — and every refetch when the screen came back to
 * the foreground — re-rendered Home, and with it the product grid underneath,
 * while that grid's pictures were still arriving. Here the work is contained:
 * when the balance updates, this component re-renders and nothing else does.
 *
 * Home hands it down as a single element built once, so the grid never sees a
 * changed header prop either.
 */

const STATUS_COLOR: Record<string, string> = {
  Cancelled: '#ef4444',
  Confirmed: '#3b82f6',
  Pending: '#f59e0b',
  Dispatched: '#0ea5e9',
  Delivered: '#22c55e',
};

// Mirrors displayStatus() in MyOrders (orders/index.tsx) so this preview shows
// the same status as the full list.
function orderStatus(order: any): string {
  if (order.cancelStatus === 'cancelled') return 'Cancelled';
  if (order.deliveryStatus === 'delivered') return 'Delivered';
  if (order.deliveryStatus === 'dispatched') return 'Dispatched';
  const os = String(order.orderStatus || '').toLowerCase();
  if (os) return os.charAt(0).toUpperCase() + os.slice(1);
  if (order.isConverted) return 'Confirmed';
  return 'Pending';
}

export const TradeOverview: React.FC = React.memo(function TradeOverview() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const user = useSelector((s: RootState) => s.auth.user);
  const adminid = useSelector((s: RootState) => s.tenant.adminId) ?? '';

  const { data: ordersData, loading: ordersLoading, refetch: refetchOrders } = useQuery(GET_SALES_ORDERS, {
    variables: { adminid, partyacc: user?.id },
    skip: !adminid || !user?.id,
  });
  const { data: accountData, refetch: refetchAccount } = useQuery(GET_ACCOUNT, {
    variables: { id: user?.id, adminId: adminid },
    skip: !user?.id || !adminid,
  });

  // Refetch on focus so a payment or order made elsewhere shows immediately.
  // Contained here, this no longer disturbs the grid.
  useFocusEffect(
    React.useCallback(() => { refetchOrders?.(); refetchAccount?.(); }, [refetchOrders, refetchAccount]),
  );

  const partyAccount = (accountData as any)?.getAccountById;
  const orders = ((ordersData as any)?.getSalesOrders ?? []) as any[];
  // Outstanding = bill-wise due from the server (same basis as the salesman app).
  const outstanding = Math.max(0, partyAccount?.outstanding || 0);
  // Orders come back oldest-first, so reverse before taking the most recent 2.
  const recent = [...orders].reverse().slice(0, 2);
  const pending = orders.filter((o: any) => !o.isConverted && o.cancelStatus !== 'cancelled').length;

  return (
    <>
      <View style={styles.statsRow}>
        {[
          { icon: 'cash-multiple', value: formatINR(outstanding), label: STRINGS.party.outstanding },
          { icon: 'clipboard-list-outline', value: String(pending), label: STRINGS.party.pendingOrders },
        ].map((s) => (
          <View key={s.label} style={[styles.statCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
            <View style={[styles.statIcon, { backgroundColor: colors.brandSoft }]}>
              <Icon name={s.icon} size={17} color={colors.brand} />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{s.value}</Text>
            <Text style={[styles.statLabel, { color: colors.subText }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{STRINGS.party.recentOrders}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('MyOrders')}>
            <Text style={[styles.viewAll, { color: colors.brand }]}>{STRINGS.party.viewAll}</Text>
          </TouchableOpacity>
        </View>

        {recent.length === 0 ? (
          // "No orders yet" is a real answer, so it must not be shown while the
          // question is still being asked.
          ordersLoading ? (
            <View style={styles.loader}><ActivityIndicator color={colors.brand} /></View>
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
              <Icon name="clipboard-outline" size={28} color={colors.border} />
              <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 13, marginTop: 8 }}>
                {STRINGS.party.noOrdersYet}
              </Text>
            </View>
          )
        ) : (
          recent.map((order: any) => {
            const label = orderStatus(order);
            const colour = STATUS_COLOR[label] ?? colors.brand;
            return (
              <TouchableOpacity
                key={order.id}
                style={[styles.orderCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
                onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
                activeOpacity={0.8}
              >
                <View style={[styles.statusDot, { backgroundColor: colour }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.orderNum, { color: colors.text }]}>{formatBillNumber(order)}</Text>
                  <Text style={[styles.orderDate, { color: colors.subText }]}>{formatDate(order.billdate)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', marginRight: 8 }}>
                  <Text style={[styles.orderAmt, { color: colors.text }]}>{formatINR(order.totalamount)}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: colour + '22' }]}>
                    <Text style={[styles.statusText, { color: colour }]}>{label}</Text>
                  </View>
                </View>
                <Icon name="chevron-right" size={16} color={colors.subText} />
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </>
  );
});

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  statCard: {
    flex: 1, borderRadius: 18, borderWidth: 1, padding: 14, alignItems: 'flex-start',
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  statIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statValue: { fontSize: 15, fontFamily: FONTS.bold },
  statLabel: { fontSize: 10, fontFamily: FONTS.regular, marginTop: 2 },

  section: { marginTop: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: FONTS.bold },
  viewAll: { fontSize: 13, fontFamily: FONTS.semiBold },
  loader: { paddingVertical: 18, alignItems: 'center' },
  emptyCard: {
    borderRadius: 16, borderWidth: 1, paddingVertical: 22, alignItems: 'center', justifyContent: 'center',
  },
  orderCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10,
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  orderNum: { fontSize: 14, fontFamily: FONTS.bold },
  orderDate: { fontSize: 12, fontFamily: FONTS.regular, marginTop: 2 },
  orderAmt: { fontSize: 14, fontFamily: FONTS.bold, marginBottom: 4 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  statusText: { fontSize: 11, fontFamily: FONTS.semiBold },
});
