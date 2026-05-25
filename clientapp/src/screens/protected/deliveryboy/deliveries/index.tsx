import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, Alert, Linking, Platform } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS, useTheme } from '../../../../config';
import { AppHeader, DynamicFlashList } from '../../../../components';
import { formatINR } from '../../../../utils';

type FilterKey = 'all' | 'pending' | 'delivered' | 'failed';
type LatLng    = { lat: number; lng: number };

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',       label: 'All'       },
  { key: 'pending',   label: 'Pending'   },
  { key: 'delivered', label: 'Delivered' },
  { key: 'failed',    label: 'Failed'    },
];

const STATUS_META: Record<string, { color: string; icon: string }> = {
  pending:   { color: '#f59e0b', icon: 'clock-outline'        },
  delivered: { color: '#22c55e', icon: 'check-circle-outline' },
  failed:    { color: '#ef4444', icon: 'close-circle-outline' },
};

const DUMMY_DELIVERIES = [
  { id: 'd1', orderNum: 'SO/2024/021', party: 'Mehta Traders',   city: 'Andheri West', address: 'Shop 12, Andheri Market',   lat: 19.1197, lng: 72.8468, amount: 4200,  status: 'pending',   cashCollected: 0     },
  { id: 'd2', orderNum: 'SO/2024/020', party: 'Patel General',   city: 'Jogeshwari',   address: '5B, Link Road',             lat: 19.1362, lng: 72.8497, amount: 8750,  status: 'delivered', cashCollected: 8750  },
  { id: 'd3', orderNum: 'SO/2024/019', party: 'Sharma Stores',   city: 'Goregaon',     address: 'SV Road, Goregaon West',    lat: 19.1530, lng: 72.8464, amount: 2300,  status: 'pending',   cashCollected: 0     },
  { id: 'd4', orderNum: 'SO/2024/018', party: 'Gupta Kirana',    city: 'Malad West',   address: 'Near Inorbit Mall',         lat: 19.1875, lng: 72.8488, amount: 6400,  status: 'failed',    cashCollected: 0     },
  { id: 'd5', orderNum: 'SO/2024/017', party: 'Shah Stores',     city: 'Borivali',     address: 'IC Colony, Borivali West',  lat: 19.2290, lng: 72.8567, amount: 1850,  status: 'pending',   cashCollected: 0     },
  { id: 'd6', orderNum: 'SO/2024/016', party: 'Modi Mart',       city: 'Bandra West',  address: 'Hill Road, Bandra',         lat: 19.0596, lng: 72.8295, amount: 9200,  status: 'delivered', cashCollected: 9200  },
];

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

  const [filter,      setFilter]      = useState<FilterKey>('all');
  const [myLoc,       setMyLoc]       = useState<LatLng | null>(null);
  const [locLabel,    setLocLabel]    = useState<'fetching' | 'live' | 'off'>('fetching');

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

  const filtered = useMemo(() => {
    if (filter === 'all') return DUMMY_DELIVERIES;
    return DUMMY_DELIVERIES.filter(d => d.status === filter);
  }, [filter]);

  const counts = useMemo(() => ({
    all:       DUMMY_DELIVERIES.length,
    pending:   DUMMY_DELIVERIES.filter(d => d.status === 'pending').length,
    delivered: DUMMY_DELIVERIES.filter(d => d.status === 'delivered').length,
    failed:    DUMMY_DELIVERIES.filter(d => d.status === 'failed').length,
  }), []);

  const handleMarkDelivered = (item: any) =>
    Alert.alert('Mark Delivered', `Mark ${item.orderNum} as delivered?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: () => {} },
    ]);

  const handleCollectPayment = (item: any) =>
    navigation.navigate('DeliveryCollectPayment', {
      orderId:   item.id,
      orderNum:  item.orderNum,
      partyName: item.party,
      amount:    item.amount,
    });

  const locIcon  = locLabel === 'live' ? 'crosshairs-gps' : locLabel === 'fetching' ? 'loading' : 'crosshairs';
  const locColor = locLabel === 'live' ? '#22c55e'        : locLabel === 'fetching' ? colors.brand : colors.subText;
  const locTip   = locLabel === 'live' ? 'Live location'  : locLabel === 'fetching' ? 'Getting location…' : 'Approx. location';

  const renderItem = ({ item }: any) => {
    const meta   = STATUS_META[item.status];
    const distKm = myLoc ? haversineKm(myLoc.lat, myLoc.lng, item.lat, item.lng) : null;
    return (
      <View style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
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
            onPress={() => openInMaps(item.lat, item.lng, item.party, myLoc)}
            activeOpacity={0.7}
          >
            <Icon name="map-marker-outline" size={11} color={colors.brand} style={{ marginRight: 3 }} />
            <Text style={[styles.address, { color: colors.brand }]} numberOfLines={1}>
              {item.address}, {item.city}
            </Text>
            <Icon name="open-in-new" size={10} color={colors.brand} style={{ marginLeft: 3 }} />
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

            {item.status === 'pending' && (
              <>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.brand }]}
                  onPress={() => handleMarkDelivered(item)}
                >
                  <Icon name="check" size={12} color="#fff" />
                  <Text style={styles.actionBtnText}>Delivered</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#22c55e' }]}
                  onPress={() => handleCollectPayment(item)}
                >
                  <Icon name="cash" size={12} color="#fff" />
                  <Text style={styles.actionBtnText}>Collect ₹</Text>
                </TouchableOpacity>
              </>
            )}

            {item.status === 'delivered' && item.cashCollected > 0 && (
              <Text style={[styles.cashText, { color: '#22c55e' }]}>
                ₹{item.cashCollected.toLocaleString('en-IN')} collected
              </Text>
            )}

            {item.status === 'failed' && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#f59e0b' }]}
                onPress={() => handleCollectPayment(item)}
              >
                <Icon name="cash" size={12} color="#fff" />
                <Text style={styles.actionBtnText}>Collect ₹</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
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
