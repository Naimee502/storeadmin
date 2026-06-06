import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@apollo/client/react';
import { useDispatch, useSelector } from 'react-redux';
import { COLORS, FONTS, useTheme } from '../../../../config';
import { BackHeader } from '../../../../components';
import { setCartParty } from '../../../../store/slices';
import { GET_SALES_ORDERS, GET_ACCOUNT, GET_TRANSACTIONS } from '../../../../apollo/queries/accounts';
import { formatINR, formatDate, formatBillNumber, ledgerEntryTotals } from '../../../../utils';
import type { RootState } from '../../../../store/rootreducer';

const STATUS_COLOR: Record<string, string> = {
  Cancelled: '#ef4444', Confirmed: '#3b82f6', Pending: '#f59e0b',
};

function orderLabel(o: any) {
  if (o.cancelStatus === 'cancelled') return 'Cancelled';
  if (o.isConverted) return 'Confirmed';
  return 'Pending';
}

export default function RoutePartyVisit() {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const { colors, isDark } = useTheme();
  const dispatch   = useDispatch();
  const cartItems  = useSelector((s: RootState) => s.cart.items);
  const cartPartyId = useSelector((s: RootState) => s.cart.partyId);
  const adminid    = useSelector((s: RootState) => s.tenant.adminId) ?? '';
  const salesmanId = useSelector((s: RootState) => s.auth.user?.id);

  const { partyId, partyName, mobile, outstanding = 0, routeName } = route.params ?? {};

  // Live recent orders for this party — only the ones THIS salesman has taken.
  const { data: ordersData, refetch: refetchOrders } = useQuery(GET_SALES_ORDERS, {
    variables: { adminid, partyacc: partyId, salesmenid: salesmanId },
    skip: !adminid || !partyId,
    fetchPolicy: 'cache-and-network',
  });
  const recentOrders = ((ordersData as any)?.getSalesOrders ?? []).slice(0, 5);

  // Live outstanding = running balance of the party's ledger (same as party login).
  const { data: accountData } = useQuery(GET_ACCOUNT, {
    variables: { id: partyId, adminId: adminid },
    skip: !adminid || !partyId,
    fetchPolicy: 'cache-and-network',
  });
  const ledgerId = (accountData as any)?.getAccountById?.ledgerid?.id ?? null;

  const { data: txData, refetch: refetchTx } = useQuery(GET_TRANSACTIONS, {
    variables: { adminid, ledgerid: ledgerId },
    skip: !adminid || !ledgerId,
    fetchPolicy: 'cache-and-network',
  });
  const liveOutstanding = useMemo(() => {
    const txs = (txData as any)?.getTransactions;
    if (!ledgerId || !txs) return outstanding; // fall back to the value passed in
    return txs.reduce((run: number, tx: any) => {
      const { debit, credit } = ledgerEntryTotals(tx, ledgerId);
      return run + debit - credit;
    }, 0);
  }, [txData, ledgerId, outstanding]);
  const outstandingAmt = Math.max(0, Math.round(liveOutstanding));

  // Refresh orders + balance when returning to this screen (e.g. after a collection or new order).
  useFocusEffect(useCallback(() => {
    refetchOrders?.();
    refetchTx?.();
  }, [refetchOrders, refetchTx]));

  const cartCount = cartPartyId === partyId
    ? cartItems.reduce((s, i) => s + i.qty, 0)
    : 0;

  const handleTakeOrder = () => {
    dispatch(setCartParty({ partyId, partyName }));
    navigation.navigate('SalesmanCatalog', { partyId, partyName });
  };

  const handleCollectPayment = () => {
    navigation.navigate('CollectPayment', { partyId, partyName, outstanding: outstandingAmt });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

      <BackHeader
        label={partyName ?? 'Party Visit'}
        rightIcons={cartCount > 0 ? [{
          id: 'cart', name: 'cart-outline', color: colors.brand, badge: cartCount,
          onPress: () => navigation.navigate('SalesmanCart'),
        }] : []}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Party info card */}
        <Animated.View
          entering={FadeInUp.duration(400).delay(60)}
          style={[styles.partyCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
        >
          <View style={[styles.partyAvatar, { backgroundColor: colors.brandSoft }]}>
            <Text style={[styles.partyAvatarText, { color: colors.brand }]}>
              {(partyName ?? 'P').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.partyTitle, { color: colors.text }]}>{partyName}</Text>
            {mobile && (
              <View style={styles.infoRow}>
                <Icon name="phone-outline" size={12} color={colors.subText} style={{ marginRight: 4 }} />
                <Text style={[styles.infoText, { color: colors.subText }]}>{mobile}</Text>
              </View>
            )}
            {routeName && (
              <View style={styles.infoRow}>
                <Icon name="map-marker-path" size={12} color={colors.subText} style={{ marginRight: 4 }} />
                <Text style={[styles.infoText, { color: colors.subText }]}>{routeName}</Text>
              </View>
            )}
          </View>
          {outstandingAmt > 0 && (
            <View style={styles.outstandingBadge}>
              <Text style={styles.outstandingLabel}>Outstanding</Text>
              <Text style={styles.outstandingAmount}>{formatINR(outstandingAmt)}</Text>
            </View>
          )}
        </Animated.View>

        {/* Action buttons */}
        <Animated.View entering={FadeInUp.duration(400).delay(120)} style={styles.actionsGrid}>
          {[
            {
              icon: 'cart-plus',
              label: 'Take Order',
              sub: 'Browse & add products',
              color: colors.brand,
              onPress: handleTakeOrder,
            },
            {
              icon: 'cash-multiple',
              label: 'Collect Payment',
              sub: outstandingAmt > 0 ? `${formatINR(outstandingAmt)} pending` : 'Record payment',
              color: '#22c55e',
              onPress: handleCollectPayment,
            },
          ].map((a) => (
            <TouchableOpacity
              key={a.label}
              style={[styles.actionCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
              onPress={a.onPress}
              activeOpacity={0.82}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: a.color + '18' }]}>
                <Icon name={a.icon} size={26} color={a.color} />
              </View>
              <Text style={[styles.actionLabel, { color: colors.text }]}>{a.label}</Text>
              <Text style={[styles.actionSub, { color: colors.subText }]}>{a.sub}</Text>
            </TouchableOpacity>
          ))}
        </Animated.View>

        {/* Active cart banner */}
        {cartCount > 0 && cartPartyId === partyId && (
          <Animated.View entering={FadeInUp.duration(300)}>
            <TouchableOpacity
              style={[styles.cartBanner, { backgroundColor: colors.brand }]}
              onPress={() => navigation.navigate('SalesmanCart')}
              activeOpacity={0.88}
            >
              <Icon name="cart-outline" size={18} color="#fff" />
              <Text style={styles.cartBannerText}>{cartCount} item{cartCount !== 1 ? 's' : ''} in cart — Review Order</Text>
              <Icon name="chevron-right" size={18} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Recent orders */}
        <Animated.View entering={FadeInUp.duration(400).delay(180)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Orders</Text>
          {recentOrders.length === 0 ? (
            <View style={[styles.orderRow, { backgroundColor: colors.cardGlass, borderColor: colors.border, justifyContent: 'center' }]}>
              <Text style={[styles.orderDate, { color: colors.subText }]}>No orders yet for this party</Text>
            </View>
          ) : recentOrders.map((order: any) => {
            const label  = orderLabel(order);
            const colour = STATUS_COLOR[label] ?? colors.brand;
            return (
              <TouchableOpacity
                key={order.id}
                style={[styles.orderRow, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
                onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
                activeOpacity={0.85}
              >
                <View style={[styles.orderDot, { backgroundColor: colour }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.orderNum, { color: colors.text }]}>{formatBillNumber(order)}</Text>
                  <Text style={[styles.orderDate, { color: colors.subText }]}>{formatDate(order.billdate)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.orderAmt, { color: colors.text }]}>{formatINR(order.totalamount)}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: colour + '22' }]}>
                    <Text style={[styles.statusText, { color: colour }]}>{label}</Text>
                  </View>
                </View>
                <Icon name="chevron-right" size={16} color={colors.subText} style={{ marginLeft: 6, alignSelf: 'center' }} />
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
  scroll:    { paddingHorizontal: 18, paddingBottom: 40 },

  partyCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    borderRadius: 20, borderWidth: 1, padding: 16, marginTop: 14, marginBottom: 14,
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  partyAvatar:     { width: 48, height: 48, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  partyAvatarText: { fontSize: 20, fontFamily: FONTS.bold },
  partyTitle:      { fontSize: 16, fontFamily: FONTS.bold, marginBottom: 6 },
  infoRow:         { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  infoText:        { fontSize: 12, fontFamily: FONTS.regular },
  outstandingBadge:  { alignItems: 'center', backgroundColor: '#FEF2F2', borderRadius: 12, padding: 8 },
  outstandingLabel:  { fontSize: 9, fontFamily: FONTS.semiBold, color: '#ef4444' },
  outstandingAmount: { fontSize: 13, fontFamily: FONTS.bold, color: '#ef4444' },

  actionsGrid: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  actionCard: {
    flex: 1, borderRadius: 20, borderWidth: 1, padding: 16, alignItems: 'center', gap: 8,
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  actionIconWrap: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  actionLabel:    { fontSize: 14, fontFamily: FONTS.bold, textAlign: 'center' },
  actionSub:      { fontSize: 11, fontFamily: FONTS.regular, textAlign: 'center' },

  cartBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 16, padding: 14, marginBottom: 20,
  },
  cartBannerText: { flex: 1, fontSize: 13, fontFamily: FONTS.bold, color: '#fff' },

  section:      { marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontFamily: FONTS.bold, marginBottom: 12 },
  orderRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 8,
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1,
  },
  orderDot:    { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  orderNum:    { fontSize: 13, fontFamily: FONTS.bold },
  orderDate:   { fontSize: 11, fontFamily: FONTS.regular, marginTop: 2 },
  orderAmt:    { fontSize: 13, fontFamily: FONTS.bold, marginBottom: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  statusText:  { fontSize: 10, fontFamily: FONTS.semiBold },
});
