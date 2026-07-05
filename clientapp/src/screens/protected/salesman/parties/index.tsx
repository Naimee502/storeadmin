import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, TextInput, Linking, Platform, Alert,
  PermissionsAndroid,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { FONTS, useTheme } from '../../../../config';
import { BackHeader, DynamicFlashList } from '../../../../components';
import { GET_ACCOUNTS, GET_SALES_ORDERS } from '../../../../apollo/queries/accounts';
import type { RootState } from '../../../../store/rootreducer';

type LatLng = { lat: number; lng: number };

function openInMaps(lat: number, lng: number, label: string, from?: LatLng | null) {
  const dest = `${lat},${lng}`;
  const origin = from ? `${from.lat},${from.lng}` : '';
  const googleUrl = origin
    ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`
    : `https://www.google.com/maps/search/?api=1&query=${dest}`;
  const url = Platform.OS === 'ios'
    ? (origin ? `maps://?saddr=${origin}&daddr=${dest}` : `maps://?q=${encodeURIComponent(label)}&ll=${dest}`)
    : googleUrl;
  Linking.openURL(url).catch(() => Alert.alert('Maps Error', 'Could not open maps app.'));
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
const fmtDist = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

// Open maps by GPS coords when the party has them, else fall back to a text
// search on the address — so the map always opens even without lat/lng.
function openMapsForParty(item: any, from?: LatLng | null) {
  if (item.latitude != null && item.longitude != null) {
    openInMaps(item.latitude, item.longitude, item.name, from);
    return;
  }
  const q = encodeURIComponent([item.name, item.address, item.city].filter(Boolean).join(', '));
  if (!q) return;
  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`)
    .catch(() => Alert.alert('Maps Error', 'Could not open maps app.'));
}

// Direct (route-less) order flow: lists the salesman's parties with the same rich
// detail as My Routes — address, live outstanding, visited/pending — and taps
// into the party visit hub (Order / Collect Payment).
export default function SalesmanParties() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const tenant = useSelector((s: RootState) => s.tenant);
  const user = useSelector((s: RootState) => s.auth.user);
  const adminid = tenant.adminId ?? '';
  const [search, setSearch] = useState('');
  const [salesmanLoc, setSalesmanLoc] = useState<LatLng | null>(null);

  useEffect(() => {
    (async () => {
      if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: 'Location permission',
              message: 'Your location is used to show distance to each party.',
              buttonPositive: 'Allow',
            },
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) { setSalesmanLoc(null); return; }
        } catch { setSalesmanLoc(null); return; }
      }
      try {
        Geolocation.getCurrentPosition(
          (pos: any) => setSalesmanLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => setSalesmanLoc(null),
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
        );
      } catch { setSalesmanLoc(null); }
    })();
  }, []);

  const { data, loading, refetch } = useQuery(GET_ACCOUNTS, {
    variables: { admin: adminid, salesmanid: user?.id },
    skip: !adminid || !user?.id,
    fetchPolicy: 'cache-and-network',
  });
  const parties = (data as any)?.getAccounts ?? [];

  useEffect(() => {
    console.log('🧑‍🤝‍🧑 [MyParties] salesmanLoc:', salesmanLoc,
      '| parties:', parties.map((p: any) => ({
        name: p.name, outstanding: p.outstanding, lat: p.latitude, lng: p.longitude,
      })));
  }, [parties, salesmanLoc]);

  // Today's orders by this salesman → mark which parties are "visited" today.
  const { data: ordersData, refetch: refetchOrders } = useQuery(GET_SALES_ORDERS, {
    variables: { adminid, salesmenid: user?.id },
    skip: !adminid || !user?.id,
    fetchPolicy: 'cache-and-network',
  });
  const visitedSet = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const set = new Set<string>();
    ((ordersData as any)?.getSalesOrders ?? []).forEach((o: any) => {
      if ((o.billdate ?? '').startsWith(today) && o.partyacc?.id) set.add(String(o.partyacc.id));
    });
    return set;
  }, [ordersData]);

  useFocusEffect(useCallback(() => { refetch?.(); refetchOrders?.(); }, [refetch, refetchOrders]));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? parties.filter((p: any) =>
          (p.name || '').toLowerCase().includes(q) || (p.mobile || '').includes(q))
      : parties;
    // Pending (with outstanding) first, then visited.
    return [...list].sort((a: any, b: any) => (b.outstanding || 0) - (a.outstanding || 0));
  }, [parties, search]);

  const openParty = (item: any) =>
    navigation.navigate('RoutePartyVisit', {
      partyId: item.id, partyName: item.name, mobile: item.mobile,
      outstanding: Math.max(0, item.outstanding || 0),
    });

  const renderItem = ({ item }: any) => {
    const visited = visitedSet.has(String(item.id));
    const bal = Math.round((item.outstanding || 0) * 100) / 100; // signed: + = due, − = advance
    const out = Math.abs(bal);
    const hasLoc = item.latitude != null && item.longitude != null;
    const distKm = (salesmanLoc && hasLoc)
      ? haversineKm(salesmanLoc.lat, salesmanLoc.lng, item.latitude, item.longitude)
      : null;
    const vm = visited
      ? { color: '#22c55e', icon: 'check-circle', label: 'Visited' }
      : { color: '#f59e0b', icon: 'clock-outline', label: 'Pending' };
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
        onPress={() => openParty(item)}
        activeOpacity={0.85}
      >
        <View style={[styles.visitIcon, { backgroundColor: vm.color + '18' }]}>
          <Icon name={vm.icon} size={18} color={vm.color} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>

          {item.channel?.channelName ? (
            <View style={[styles.channelPill, { backgroundColor: colors.brandSoft }]}>
              <Icon name="account-network-outline" size={10} color={colors.brand} />
              <Text style={[styles.channelText, { color: colors.brand }]} numberOfLines={1}>
                {item.channel.channelName}
              </Text>
            </View>
          ) : null}

          {item.mobile ? (
            <View style={styles.metaRow}>
              <Icon name="phone-outline" size={11} color={colors.subText} />
              <Text style={[styles.locText, { color: colors.subText }]} numberOfLines={1}>{item.mobile}</Text>
            </View>
          ) : null}

          {(item.address || item.city) ? (
            <TouchableOpacity
              style={styles.locRow}
              activeOpacity={0.7}
              onPress={() => openMapsForParty(item, salesmanLoc)}
            >
              <Icon name="map-marker-outline" size={11} color={colors.brand} />
              <Text style={[styles.locText, { color: colors.brand }]} numberOfLines={1}>
                {[item.address, item.city].filter(Boolean).join(', ')}
              </Text>
              <Icon name="open-in-new" size={10} color={colors.brand} />
            </TouchableOpacity>
          ) : null}

          {bal > 0 ? (
            <Text style={styles.outstanding}>Pending: ₹{out.toLocaleString('en-IN')}</Text>
          ) : bal < 0 ? (
            <Text style={[styles.outstanding, { color: '#16a34a' }]}>Advance: ₹{out.toLocaleString('en-IN')}</Text>
          ) : (
            <Text style={[styles.settled, { color: '#22c55e' }]}>No dues</Text>
          )}
        </View>

        <View style={styles.rightCol}>
          <View style={[styles.statusPill, { backgroundColor: vm.color + '18' }]}>
            <Text style={[styles.statusPillText, { color: vm.color }]}>{vm.label}</Text>
          </View>
          {distKm !== null ? (
            <TouchableOpacity
              style={[styles.distBadge, { backgroundColor: colors.brandSoft }]}
              activeOpacity={0.75}
              onPress={() => openInMaps(item.latitude, item.longitude, item.name, salesmanLoc)}
            >
              <Icon name="navigation-variant-outline" size={11} color={colors.brand} />
              <Text style={[styles.distText, { color: colors.brand }]}>{fmtDist(distKm)}</Text>
            </TouchableOpacity>
          ) : null}
          <Icon name="chevron-right" size={18} color={colors.subText} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />
      <BackHeader label="My Parties" />

      <View style={[styles.searchRow, { backgroundColor: colors.raisedSurface, borderColor: colors.border }]}>
        <Icon name="magnify" size={16} color={colors.subText} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search party / mobile…"
          placeholderTextColor={colors.subText}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <TouchableOpacity
        style={[styles.addRow, { borderColor: colors.brand }]}
        onPress={() => navigation.navigate('SalesmanCreateParty')}
        activeOpacity={0.85}
      >
        <Icon name="account-plus-outline" size={18} color={colors.brand} />
        <Text style={[styles.addText, { color: colors.brand }]}>Add New Party</Text>
      </TouchableOpacity>

      {loading && parties.length === 0 ? (
        <View style={styles.center}><Text style={[styles.locText, { color: colors.subText }]}>Loading…</Text></View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Icon name="account-off-outline" size={42} color={colors.border} />
          <Text style={[styles.locText, { color: colors.subText }]}>No parties found.</Text>
        </View>
      ) : (
        <DynamicFlashList
          data={filtered}
          renderItem={renderItem}
          estimatedItemSize={92}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 18, marginTop: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: FONTS.regular, padding: 0 },
  addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 18, marginTop: 10, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 11 },
  addText: { fontSize: 14, fontFamily: FONTS.bold },
  listContent: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 30 },

  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 16, borderWidth: 1, padding: 13, marginBottom: 10 },
  visitIcon: { width: 36, height: 36, borderRadius: 11, justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  name: { fontSize: 14, fontFamily: FONTS.bold },
  channelPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, marginTop: 4 },
  channelText: { fontSize: 10.5, fontFamily: FONTS.semiBold, flexShrink: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  locText: { fontSize: 11.5, fontFamily: FONTS.regular, flexShrink: 1 },
  outstanding: { fontSize: 12, fontFamily: FONTS.semiBold, color: '#ef4444', marginTop: 4 },
  settled: { fontSize: 11.5, fontFamily: FONTS.semiBold, marginTop: 4 },

  rightCol: { alignItems: 'flex-end', gap: 8 },
  statusPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10 },
  statusPillText: { fontSize: 10, fontFamily: FONTS.semiBold },
  distBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  distText: { fontSize: 11, fontFamily: FONTS.semiBold },
  collectBtn: { width: 34, height: 34, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
});
