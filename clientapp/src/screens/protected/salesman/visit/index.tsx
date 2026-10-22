import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Modal, Alert, ActivityIndicator, TextInput } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useQuery, useMutation, useApolloClient } from '@apollo/client/react';
import { CHECK_GEO_FENCE } from '../../../../apollo/queries/salesmanreport';
import { MARK_VISIT } from '../../../../apollo/mutations/tracking';
import { EDIT_ACCOUNT } from '../../../../apollo/mutations/accounts';
import { useGeoFence } from '../../../../apollo/hooks/adminsettings';
import { getCurrentLatLng, getRecentFix, GEO_ACC_CAP_M } from '../../../../utils/geo';
import { usePaymentsEnabled } from '../../../../apollo/hooks/admin';
import { useDispatch, useSelector } from 'react-redux';
import { COLORS, FONTS, useTheme } from '../../../../config';
import { BackHeader, AppImage, ProductImageViewer } from '../../../../components';
import { setCartParty } from '../../../../store/slices';
import { GET_SALES_ORDERS, GET_ACCOUNT, GET_TRANSACTIONS, GET_PARTY_SALES_INVOICES } from '../../../../apollo/queries/accounts';
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

// Reasons a salesman can pick when he visited but got no order (unproductive call).
const NO_ORDER_REASONS = [
  'Shop closed',
  'Owner / buyer not available',
  'Stock still available',
  'Payment pending — no new order',
  'Price / scheme issue',
  'Will order later',
  'Other',
];

export default function RoutePartyVisit() {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const { colors, isDark } = useTheme();
  const paymentsEnabled = usePaymentsEnabled();
  const dispatch   = useDispatch();
  const cartItems  = useSelector((s: RootState) => s.cart.items);
  const cartPartyId = useSelector((s: RootState) => s.cart.partyId);
  const adminid    = useSelector((s: RootState) => s.tenant.adminId) ?? '';
  const salesmanId = useSelector((s: RootState) => s.auth.user?.id);

  const { partyId, partyName, mobile, outstanding = 0, routeName, routeId, routeDay } = route.params ?? {};

  // Live recent orders for this party — only the ones THIS salesman has taken.
  const { data: ordersData, refetch: refetchOrders } = useQuery(GET_SALES_ORDERS, {
    variables: { adminid, partyacc: partyId, salesmenid: salesmanId },
    skip: !adminid || !partyId,
    fetchPolicy: 'cache-and-network',
  });
  const recentOrders = ((ordersData as any)?.getSalesOrders ?? []).slice(0, 5);

  // The party's actual invoices (same numbers + outstanding as the admin panel).
  const { data: invData, refetch: refetchInvoices } = useQuery(GET_PARTY_SALES_INVOICES, {
    variables: { adminid, partyacc: partyId },
    skip: !adminid || !partyId,
    fetchPolicy: 'cache-and-network',
  });
  const bills = ((invData as any)?.getSalesInvoices ?? [])
    .filter((b: any) => b.status)
    .slice(0, 8);

  // Live outstanding = running balance of the party's ledger (same as party login).
  const { data: accountData, refetch: refetchAccount } = useQuery(GET_ACCOUNT, {
    variables: { id: partyId, adminId: adminid },
    skip: !adminid || !partyId,
    fetchPolicy: 'cache-and-network',
  });
  const ledgerId = (accountData as any)?.getAccountById?.ledgerid?.id ?? null;
  const partyChannel = (accountData as any)?.getAccountById?.channel?.channelName ?? '';
  const shopImage: string | null = (accountData as any)?.getAccountById?.shopimage || null;
  const [shopPreview, setShopPreview] = useState(false);
  // Authoritative outstanding = server-computed ledger balance (role-free), same
  // value the admin panel & My Routes use. Falls back to the navigation param.
  const serverOutstanding = (accountData as any)?.getAccountById?.outstanding;

  const { data: txData, refetch: refetchTx } = useQuery(GET_TRANSACTIONS, {
    variables: { adminid, ledgerid: ledgerId },
    skip: !adminid || !ledgerId,
    fetchPolicy: 'cache-and-network',
  });
  const liveOutstanding = useMemo(() => {
    if (typeof serverOutstanding === 'number') return serverOutstanding;
    const txs = (txData as any)?.getTransactions;
    if (!ledgerId || !txs) return outstanding; // fall back to the value passed in
    return txs.reduce((run: number, tx: any) => {
      const { debit, credit } = ledgerEntryTotals(tx, ledgerId);
      return run + debit - credit;
    }, 0);
  }, [serverOutstanding, txData, ledgerId, outstanding]);
  const balance = Math.round(liveOutstanding); // signed: + = due, − = advance/credit
  const outstandingAmt = Math.max(0, balance);

  // Refresh orders + balance when returning to this screen (e.g. after a collection or new order).
  useFocusEffect(useCallback(() => {
    refetchOrders?.();
    refetchTx?.();
    refetchAccount?.();
    refetchInvoices?.();
  }, [refetchOrders, refetchTx, refetchAccount, refetchInvoices]));

  const cartCount = cartPartyId === partyId
    ? cartItems.reduce((s, i) => s + i.qty, 0)
    : 0;

  // ── Geo-fence + calls ────────────────────────────────────────────────
  const apollo = useApolloClient();
  const geo = useGeoFence();
  const [checking, setChecking] = useState(false);
  const [markVisit] = useMutation(MARK_VISIT);
  const [noOrderOpen, setNoOrderOpen] = useState(false);
  const [noOrderReason, setNoOrderReason] = useState('');
  const [noOrderNote, setNoOrderNote] = useState('');
  const [savingNoOrder, setSavingNoOrder] = useState(false);

  const [editAccount] = useMutation(EDIT_ACCOUNT);

  /** When geo-fencing is on, confirm the salesman is at the party. Returns the fix (or null when allowed without one). */
  const ensureAtParty = async (): Promise<{ ok: boolean; lat?: number; lng?: number; acc?: number }> => {
    // Geo-fencing OFF: no location check and no GPS wait at all — straight
    // to the order, same as before geo-fencing existed. A recent fix (if the
    // list screen had one) is attached to the visit, nothing more.
    if (!geo.enabled) {
      const recent = getRecentFix();
      return { ok: true, lat: recent?.lat, lng: recent?.lng, acc: recent?.acc };
    }
    // GPS → network/Wi-Fi location → last fix from the list screen (≤ 3 min).
    const here = await getCurrentLatLng({ fresh: true });
    if (!here) {
      Alert.alert(
        'Location not found',
        'Could not get your location. Make sure Location is ON, step near the shop door for a few seconds, and try again.',
      );
      return { ok: false };
    }
    try {
      const { data } = await apollo.query({
        query: CHECK_GEO_FENCE,
        variables: { adminid, partyacc: partyId, latitude: here.lat, longitude: here.lng, accuracy: here.acc },
        fetchPolicy: 'network-only',
      });
      const r = (data as any)?.checkGeoFence;
      if (r && !r.allowed) {
        Alert.alert('Not at the party', r.message || 'You must be at the party\'s location.');
        return { ok: false };
      }
      // First visit to a party with no saved location: the salesman is at the
      // shop now, so this fix becomes the party's location (only if precise
      // enough to be a fair geo-fence centre). Best-effort — never blocks.
      if (r && !r.partyHasLocation && (here.acc == null || here.acc <= GEO_ACC_CAP_M)) {
        const acc = (accountData as any)?.getAccountById;
        editAccount({
          variables: {
            id: partyId,
            input: {
              name: acc?.name ?? partyName,
              accountgroupid: acc?.accountgroupid?.id ?? acc?.accountgroupid,
              latitude: here.lat,
              longitude: here.lng,
            },
          },
        }).then(() => refetchAccount?.()).catch((e: any) => console.warn('[visit] save party location failed:', e?.message));
      }
      return { ok: true, lat: here.lat, lng: here.lng, acc: here.acc };
    } catch (e: any) {
      Alert.alert('Location check failed', e?.message || 'Could not verify your location. Try again.');
      return { ok: false };
    }
  };

  const handleTakeOrder = async () => {
    if (checking) return;
    setChecking(true);
    const r = await ensureAtParty();
    setChecking(false);
    if (!r.ok) return;
    dispatch(setCartParty({ partyId, partyName, routeId, routeDay }));
    navigation.navigate('SalesmanCatalog', { partyId, partyName });
  };

  const submitNoOrder = async () => {
    if (!noOrderReason) { Alert.alert('Select a reason', 'Pick why there was no order.'); return; }
    setSavingNoOrder(true);
    const r = await ensureAtParty();
    if (!r.ok) { setSavingNoOrder(false); return; }
    try {
      await markVisit({
        variables: {
          input: {
            adminid,
            salesmanid: salesmanId,
            partyacc: partyId,
            routeid: routeId || undefined,
            day: routeDay || undefined,
            outcome: 'unproductive',
            reason: noOrderReason,
            notes: noOrderNote.trim() || undefined,
            latitude: r.lat,
            longitude: r.lng,
            accuracy: r.acc,
          },
        },
      });
      setNoOrderOpen(false);
      setNoOrderReason('');
      setNoOrderNote('');
      Alert.alert('Visit recorded', `${partyName}: no order — ${noOrderReason}.`);
    } catch (e: any) {
      Alert.alert('Could not record visit', e?.message || 'Please try again.');
    } finally {
      setSavingNoOrder(false);
    }
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
          {/* Shop photo when saved (tap to view), else the initial. */}
          <TouchableOpacity
            style={[styles.partyAvatar, { backgroundColor: colors.brandSoft, overflow: 'hidden' }]}
            onPress={() => shopImage && setShopPreview(true)}
            disabled={!shopImage}
            activeOpacity={0.85}
          >
            {shopImage ? (
              <AppImage
                uri={shopImage}
                width={480}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
                fallback={<Text style={[styles.partyAvatarText, { color: colors.brand }]}>{(partyName ?? 'P').charAt(0).toUpperCase()}</Text>}
              />
            ) : (
              <Text style={[styles.partyAvatarText, { color: colors.brand }]}>
                {(partyName ?? 'P').charAt(0).toUpperCase()}
              </Text>
            )}
          </TouchableOpacity>
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
            {!!partyChannel && (
              <View style={[styles.channelPill, { backgroundColor: colors.brandSoft }]}>
                <Icon name="account-network-outline" size={11} color={colors.brand} />
                <Text style={[styles.channelText, { color: colors.brand }]} numberOfLines={1}>
                  {partyChannel}
                </Text>
              </View>
            )}
          </View>
          {balance > 0 ? (
            <View style={styles.outstandingBadge}>
              <Text style={styles.outstandingLabel}>Outstanding</Text>
              <Text style={styles.outstandingAmount}>{formatINR(balance)}</Text>
            </View>
          ) : balance < 0 ? (
            <View style={[styles.outstandingBadge, { backgroundColor: '#ECFDF5' }]}>
              <Text style={[styles.outstandingLabel, { color: '#16a34a' }]}>Advance</Text>
              <Text style={[styles.outstandingAmount, { color: '#16a34a' }]}>{formatINR(Math.abs(balance))}</Text>
            </View>
          ) : null}
        </Animated.View>

        {/* Action buttons */}
        <Animated.View entering={FadeInUp.duration(400).delay(120)} style={styles.actionsGrid}>
          {[
            {
              icon: 'cart-plus',
              label: checking ? 'Checking location…' : 'Take Order',
              sub: 'Browse & add products',
              color: colors.brand,
              onPress: handleTakeOrder,
            },
            {
              icon: 'cart-off',
              label: 'No Order',
              sub: 'Visited, no order',
              color: '#f59e0b',
              onPress: () => setNoOrderOpen(true),
            },
            // Only when there's an actual due — avoids collecting twice on a
            // fully-paid party (no-due → button hidden).
            // Also gone when the business has the Payments module off.
            ...(paymentsEnabled && outstandingAmt > 0 ? [{
              icon: 'cash-multiple',
              label: 'Collect Payment',
              sub: `${formatINR(outstandingAmt)} pending`,
              color: '#22c55e',
              onPress: handleCollectPayment,
            }] : []),
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
              <Icon name="cart-outline" size={18} color={colors.onBrand} />
              <Text style={[styles.cartBannerText, { color: colors.onBrand }]}>{cartCount} item{cartCount !== 1 ? 's' : ''} in cart — Review Order</Text>
              <Icon name="chevron-right" size={18} color={colors.onBrand} />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Bills — actual invoices (same numbers as admin) + per-bill outstanding */}
        {bills.length > 0 && (
          <Animated.View entering={FadeInUp.duration(400).delay(150)} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Bills</Text>
            {bills.map((b: any) => {
              const due = Math.max(0, Math.round((b.outstanding ?? 0) * 100) / 100);
              const paid = due <= 0;
              return (
                <View
                  key={b.id}
                  style={[styles.orderRow, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
                >
                  <View style={[styles.orderDot, { backgroundColor: paid ? '#22c55e' : '#ef4444' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.orderNum, { color: colors.text }]}>INV-{b.billnumber}</Text>
                    <Text style={[styles.orderDate, { color: colors.subText }]}>
                      {formatDate(b.billdate)} · Total {formatINR(b.totalamount)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    {paid ? (
                      <View style={[styles.statusBadge, { backgroundColor: '#22c55e22' }]}>
                        <Text style={[styles.statusText, { color: '#16a34a' }]}>Paid</Text>
                      </View>
                    ) : (
                      <>
                        <Text style={[styles.orderAmt, { color: '#ef4444' }]}>{formatINR(due)}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: '#ef444422' }]}>
                          <Text style={[styles.statusText, { color: '#ef4444' }]}>Due</Text>
                        </View>
                      </>
                    )}
                  </View>
                </View>
              );
            })}
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

      {/* No-order (unproductive call) reason sheet */}
      <Modal visible={noOrderOpen} transparent animationType="slide" onRequestClose={() => setNoOrderOpen(false)}>
        <View style={styles.sheetBackdrop}>
          <View style={[styles.sheet, { backgroundColor: colors.background }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>No order from {partyName}</Text>
            <Text style={[styles.sheetSub, { color: colors.subText }]}>Pick the reason — it shows in your call report.</Text>
            {NO_ORDER_REASONS.map((r) => {
              const on = noOrderReason === r;
              return (
                <TouchableOpacity
                  key={r}
                  style={[styles.reasonRow, { borderColor: on ? colors.brand : colors.border, backgroundColor: on ? colors.brandSoft : 'transparent' }]}
                  onPress={() => setNoOrderReason(r)}
                  activeOpacity={0.8}
                >
                  <Icon name={on ? 'radiobox-marked' : 'radiobox-blank'} size={18} color={on ? colors.brand : colors.subText} />
                  <Text style={[styles.reasonText, { color: colors.text }]}>{r}</Text>
                </TouchableOpacity>
              );
            })}
            <TextInput
              value={noOrderNote}
              onChangeText={setNoOrderNote}
              placeholder="Note (optional)"
              placeholderTextColor={colors.subText}
              style={[styles.noteInput, { borderColor: colors.border, color: colors.text }]}
            />
            <View style={styles.sheetActions}>
              <TouchableOpacity style={[styles.sheetBtn, { borderColor: colors.border, borderWidth: 1 }]} onPress={() => setNoOrderOpen(false)}>
                <Text style={[styles.sheetBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sheetBtn, { backgroundColor: '#f59e0b' }]} onPress={submitNoOrder} disabled={savingNoOrder}>
                {savingNoOrder ? <ActivityIndicator color="#fff" /> : <Text style={[styles.sheetBtnText, { color: '#fff' }]}>Save visit</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <ProductImageViewer
        visible={shopPreview && !!shopImage}
        images={shopImage ? [shopImage] : []}
        title={partyName || 'Shop photo'}
        onClose={() => setShopPreview(false)}
      />
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
  channelPill:     { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 4 },
  channelText:     { fontSize: 11, fontFamily: FONTS.semiBold },
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
  cartBannerText: { flex: 1, fontSize: 13, fontFamily: FONTS.bold },

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

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet:         { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 28 },
  sheetTitle:    { fontSize: 16, fontFamily: FONTS.bold },
  sheetSub:      { fontSize: 12, fontFamily: FONTS.regular, marginTop: 2, marginBottom: 12 },
  reasonRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8 },
  reasonText:    { fontSize: 13, fontFamily: FONTS.semiBold },
  noteInput:     { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, fontFamily: FONTS.regular, marginTop: 4 },
  sheetActions:  { flexDirection: 'row', gap: 10, marginTop: 14 },
  sheetBtn:      { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  sheetBtnText:  { fontSize: 14, fontFamily: FONTS.bold },
});
