import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, Alert, Linking, Platform } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useQuery, useMutation } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { COLORS, FONTS, useTheme } from '../../../../config';
import { AppHeader, DynamicFlashList } from '../../../../components';
import { formatINR, formatBillNumber } from '../../../../utils';
import { GET_DELIVERY_POOL, GET_MY_DELIVERIES } from '../../../../apollo/queries/accounts';
import { ASSIGN_INVOICE_DELIVERY_BOY, MARK_SALES_INVOICE_DELIVERED } from '../../../../apollo/mutations/accounts';
import { usePunchGate } from '../../../../apollo/hooks/attendance';
import type { RootState } from '../../../../store/rootreducer';

type FilterKey = 'available' | 'out' | 'delivered';
type LatLng    = { lat: number; lng: number };

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'available', label: 'Available'       },
  { key: 'out',       label: 'Out for Delivery' },
  { key: 'delivered', label: 'Delivered'       },
];

const STATUS_META: Record<string, { color: string; icon: string }> = {
  available: { color: '#f59e0b', icon: 'package-variant-closed' },
  out:       { color: '#0ea5e9', icon: 'truck-fast-outline'     },
  delivered: { color: '#22c55e', icon: 'check-circle-outline'   },
};

// Map a server order → the delivery card shape.
function toDelivery(o: any, bucket: FilterKey) {
  return {
    id: o.id,
    partyId: o.partyacc?.id ?? null,
    // These are invoices → always show the INV- prefix.
    orderNum: formatBillNumber({ billnumber: o.billnumber, isConverted: true }),
    party: o.partyacc?.accountname ?? '—',
    mobile: o.partyacc?.mobile ?? '',
    address: o.partyacc?.address ?? '',
    city: o.partyacc?.city ?? '',
    lat: o.partyacc?.latitude ?? null,
    lng: o.partyacc?.longitude ?? null,
    amount: o.totalamount ?? 0,
    outstanding: Math.max(0, o.outstanding ?? 0),
    paymenttype: o.paymenttype,
    status: bucket,
  };
}

// ── helpers ───────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDist(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

function openInMaps(lat: number, lng: number, label: string, fromLoc: LatLng | null) {
  const dest = `${lat},${lng}`;
  const origin = fromLoc ? `${fromLoc.lat},${fromLoc.lng}` : '';
  const googleUrl = origin
    ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`
    : `https://www.google.com/maps/search/?api=1&query=${dest}`;
  const appleUrl = origin
    ? `maps://?saddr=${origin}&daddr=${dest}`
    : `maps://?q=${encodeURIComponent(label)}&ll=${dest}`;
  const url = Platform.OS === 'ios' ? appleUrl : googleUrl;
  Linking.canOpenURL(url)
    .then(ok => Linking.openURL(ok ? url : googleUrl))
    .catch(() => Alert.alert('Maps Error', 'Could not open maps app.'));
}

// ── screen ────────────────────────────────────────────────────────────────────

export default function DeliveryList() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();

  const adminId = useSelector((s: RootState) => s.tenant.adminId);
  const user    = useSelector((s: RootState) => s.auth.user);

  const [filter,      setFilter]      = useState<FilterKey>('available');
  const [myLoc,       setMyLoc]       = useState<LatLng | null>(null);
  const [locLabel,    setLocLabel]    = useState<'fetching' | 'live' | 'off'>('fetching');

  // Available pool: unassigned end-user/party orders. My deliveries: assigned to me.
  const { data: poolData, refetch: refetchPool, error: poolError } = useQuery(GET_DELIVERY_POOL, {
    variables: { filter: { adminid: adminId, unassignedDelivery: true } },
    skip: !adminId,
    fetchPolicy: 'cache-and-network',
  });
  const { data: mineData, refetch: refetchMine, error: mineError } = useQuery(GET_MY_DELIVERIES, {
    variables: { filter: { adminid: adminId, deliveryboyid: user?.id } },
    skip: !adminId || !user?.id,
    fetchPolicy: 'cache-and-network',
  });

  // TEMP diagnostic — see what the app actually receives.
  console.log('[DELIV-APP] adminId=', adminId, 'user=', user?.id,
    '| pool=', (poolData as any)?.getSalesInvoices?.length,
    '| mine=', (mineData as any)?.getSalesInvoices?.length,
    '| poolError=', poolError?.message,
    '| mineError=', mineError?.message);

  const [assignToMe]   = useMutation(ASSIGN_INVOICE_DELIVERY_BOY);
  const { blocked: punchBlocked } = usePunchGate();
  const [markDelivered] = useMutation(MARK_SALES_INVOICE_DELIVERED);

  useFocusEffect(useCallback(() => { refetchPool?.(); refetchMine?.(); }, [refetchPool, refetchMine]));

  const available = useMemo(
    () => ((poolData as any)?.getSalesInvoices ?? []).map((o: any) => toDelivery(o, 'available')),
    [poolData],
  );
  const out = useMemo(
    () => ((mineData as any)?.getSalesInvoices ?? [])
      .filter((o: any) => o.deliveryStatus === 'dispatched')
      .map((o: any) => toDelivery(o, 'out')),
    [mineData],
  );
  const delivered = useMemo(
    () => ((mineData as any)?.getSalesInvoices ?? [])
      .filter((o: any) => o.deliveryStatus === 'delivered')
      .map((o: any) => toDelivery(o, 'delivered')),
    [mineData],
  );

  const fetchLocation = useCallback(() => {
    setLocLabel('fetching');
    try {
      navigator.geolocation.getCurrentPosition(
        pos => { setMyLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocLabel('live'); },
        ()  => { setMyLoc({ lat: 19.0760, lng: 72.8777 }); setLocLabel('off'); },
        { enableHighAccuracy: false, timeout: 8000 },
      );
    } catch {
      setMyLoc({ lat: 19.0760, lng: 72.8777 });
      setLocLabel('off');
    }
  }, []);

  useEffect(() => { fetchLocation(); }, [fetchLocation]);

  const filtered = filter === 'available' ? available : filter === 'out' ? out : delivered;

  const counts = useMemo(() => ({
    available: available.length,
    out:       out.length,
    delivered: delivered.length,
  }), [available, out, delivered]);

  const handleAccept = (item: any) => {
    if (punchBlocked) { Alert.alert('Punch in required', 'Please punch in from the Attendance tab before accepting deliveries.'); return; }
    Alert.alert('Accept Delivery', `Take ${item.orderNum} for delivery?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Accept',
        onPress: async () => {
          try { await assignToMe({ variables: { id: item.id, deliveryboyid: user?.id } }); refetchPool?.(); refetchMine?.(); setFilter('out'); }
          catch (e: any) { Alert.alert('Error', e?.message || 'Could not accept.'); }
        },
      },
    ]);
  };

  const handleMarkDelivered = (item: any) => {
    if (punchBlocked) { Alert.alert('Punch in required', 'Please punch in from the Attendance tab before updating deliveries.'); return; }
    Alert.alert('Mark Delivered', `Mark ${item.orderNum} as delivered?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          try { await markDelivered({ variables: { id: item.id, byId: user?.id, byName: user?.name, byType: 'deliveryboy' } }); refetchMine?.(); }
          catch (e: any) { Alert.alert('Error', e?.message || 'Could not update.'); }
        },
      },
    ]);
  };

  const handleCollectPayment = (item: any) =>
    navigation.navigate('DeliveryCollectPayment', {
      orderId:   item.id,
      orderNum:  item.orderNum,
      partyId:   item.partyId,
      partyName: item.party,
      // Prefill with the DUE (outstanding), not the full order value.
      amount:    item.outstanding > 0 ? item.outstanding : item.amount,
    });

  const locIcon  = locLabel === 'live' ? 'crosshairs-gps' : locLabel === 'fetching' ? 'loading' : 'crosshairs';
  const locColor = locLabel === 'live' ? '#22c55e'        : locLabel === 'fetching' ? colors.brand : colors.subText;
  const locTip   = locLabel === 'live' ? 'Live location'  : locLabel === 'fetching' ? 'Getting location…' : 'Approx. location';

  const renderItem = ({ item }: any) => {
    const meta   = STATUS_META[item.status];
    const distKm = (myLoc && item.lat != null && item.lng != null)
      ? haversineKm(myLoc.lat, myLoc.lng, item.lat, item.lng)
      : null;
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
        onPress={() => navigation.navigate('OrderDetail', { invoiceId: item.id })}
        activeOpacity={0.85}
      >
        <View style={[styles.iconWrap, { backgroundColor: meta.color + '18' }]}>
          <Icon name="truck-delivery-outline" size={22} color={meta.color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.cardTop}>
            <Text style={[styles.orderNum, { color: colors.text }]}>{item.orderNum}</Text>
            <Text style={[styles.amount, { color: colors.text }]}>{formatINR(item.amount)}</Text>
          </View>
          <Text style={[styles.partyName, { color: colors.text }]} numberOfLines={1}>{item.party}</Text>

          {/* tappable address row → opens maps */}
          <TouchableOpacity
            style={styles.addressRow}
            onPress={() => { if (item.lat != null && item.lng != null) openInMaps(item.lat, item.lng, item.party, myLoc); }}
            activeOpacity={0.7}
          >
            <Icon name="map-marker-outline" size={11} color={colors.brand} style={{ marginRight: 3 }} />
            <Text style={[styles.address, { color: colors.brand }]} numberOfLines={1}>
              {[item.address, item.city].filter(Boolean).join(', ') || (item.mobile ? `+91 ${item.mobile}` : 'No address')}
            </Text>
            {item.lat != null && <Icon name="open-in-new" size={10} color={colors.brand} style={{ marginLeft: 3 }} />}
          </TouchableOpacity>

          <View style={styles.cardBottom}>
            <View style={[styles.statusBadge, { backgroundColor: meta.color + '22' }]}>
              <Icon name={meta.icon} size={11} color={meta.color} style={{ marginRight: 3 }} />
              <Text style={[styles.statusText, { color: meta.color }]}>
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Text>
            </View>

            {/* distance badge → opens maps */}
            {distKm !== null && (
              <TouchableOpacity
                style={[styles.distBadge, { backgroundColor: colors.brandSoft }]}
                onPress={() => openInMaps(item.lat, item.lng, item.party, myLoc)}
                activeOpacity={0.75}
              >
                <Icon name="navigation-variant-outline" size={11} color={colors.brand} />
                <Text style={[styles.distText, { color: colors.brand }]}>{fmtDist(distKm)}</Text>
              </TouchableOpacity>
            )}

            {item.status === 'available' && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.brand }]}
                onPress={() => handleAccept(item)}
              >
                <Icon name="hand-okay" size={12} color="#fff" />
                <Text style={styles.actionBtnText}>Accept</Text>
              </TouchableOpacity>
            )}

            {item.status === 'out' && (
              <>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.brand }]}
                  onPress={() => handleMarkDelivered(item)}
                >
                  <Icon name="check" size={12} color="#fff" />
                  <Text style={styles.actionBtnText}>Delivered</Text>
                </TouchableOpacity>
                {item.outstanding > 0 && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#22c55e' }]}
                    onPress={() => handleCollectPayment(item)}
                  >
                    <Icon name="cash" size={12} color="#fff" />
                    <Text style={styles.actionBtnText}>Collect ₹</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>
        <Icon name="chevron-right" size={18} color={colors.subText} style={{ alignSelf: 'center', marginLeft: 2 }} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

      <AppHeader label="Deliveries" />

      {/* location status bar */}
      <View style={[styles.locBar, { backgroundColor: colors.cardGlass, borderBottomColor: colors.border }]}>
        <Icon name={locIcon} size={14} color={locColor} />
        <Text style={[styles.locBarText, { color: locColor }]}>{locTip}</Text>
        <Text style={[styles.locBarSub, { color: colors.subText }]}>· Distance per delivery</Text>
        <TouchableOpacity onPress={fetchLocation} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} style={{ marginLeft: 'auto' }}>
          <Icon name="refresh" size={16} color={colors.brand} />
        </TouchableOpacity>
      </View>

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

      <DynamicFlashList
        data={filtered}
        renderItem={renderItem}
        estimatedItemSize={130}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Icon name="truck-outline" size={44} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.subText }]}>No {filter} deliveries</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1 },

  locBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 18, paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  locBarText: { fontSize: 12, fontFamily: FONTS.semiBold },
  locBarSub:  { fontSize: 11, fontFamily: FONTS.regular },

  chipScroll: { flexGrow: 0 },
  chipList:   { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 8, gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5,
  },
  chipText:      { fontSize: 13, fontFamily: FONTS.semiBold },
  chipCount:     { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, minWidth: 20, alignItems: 'center' },
  chipCountText: { fontSize: 11, fontFamily: FONTS.bold },

  listContent: { paddingHorizontal: 18, paddingBottom: 110, paddingTop: 4 },
  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 10,
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  iconWrap:   { width: 42, height: 42, borderRadius: 13, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  cardTop:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  orderNum:   { fontSize: 13, fontFamily: FONTS.bold },
  amount:     { fontSize: 13, fontFamily: FONTS.bold },
  partyName:  { fontSize: 13, fontFamily: FONTS.semiBold, marginBottom: 3 },
  addressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  address:    { fontSize: 11, fontFamily: FONTS.regular, flex: 1 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  statusBadge:{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText: { fontSize: 11, fontFamily: FONTS.semiBold },
  distBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  distText:   { fontSize: 11, fontFamily: FONTS.bold },
  actionBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  actionBtnText: { fontSize: 11, fontFamily: FONTS.bold, color: '#fff' },
  cashText:   { fontSize: 12, fontFamily: FONTS.semiBold },

  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: FONTS.regular },
});
