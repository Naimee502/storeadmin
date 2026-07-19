import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, TextInput, Linking, Platform, Alert,
  PermissionsAndroid, ScrollView,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useQuery, useMutation } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { FONTS, useTheme } from '../../../../config';
import { BackHeader, DynamicFlashList } from '../../../../components';
import { GET_ACCOUNTS, GET_SALES_ORDERS } from '../../../../apollo/queries/accounts';
import { EDIT_ACCOUNT } from '../../../../apollo/mutations/accounts';
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
  const [channelFilter, setChannelFilter] = useState<string | null>(null); // null = "All"
  const [salesmanLoc, setSalesmanLoc] = useState<LatLng | null>(null);
  const [savingLocId, setSavingLocId] = useState<string | null>(null);
  const [editAccount] = useMutation(EDIT_ACCOUNT);

  // Android needs an explicit runtime grant before any GPS fix; iOS prompts
  // automatically the first time Geolocation is used. Shared by the initial
  // "my location" fetch and the per-party "Add location" button.
  const requestLocationPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location permission',
          message: 'Your location is used to show distance to each party.',
          buttonPositive: 'Allow',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch { return false; }
  };

  useEffect(() => {
    (async () => {
      const ok = await requestLocationPermission();
      if (!ok) { setSalesmanLoc(null); return; }
      try {
        Geolocation.getCurrentPosition(
          (pos: any) => setSalesmanLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => setSalesmanLoc(null),
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
        );
      } catch { setSalesmanLoc(null); }
    })();
  }, []);

  // Party has no GPS yet → capture the salesman's CURRENT position (he's
  // standing at the shop) and save it onto the party record.
  const handleAddLocation = async (item: any) => {
    if (savingLocId) return;
    const ok = await requestLocationPermission();
    if (!ok) {
      Alert.alert('Location permission needed', 'Please allow location access to add this party\'s location.');
      return;
    }
    setSavingLocId(item.id);
    Geolocation.getCurrentPosition(
      async (pos: any) => {
        try {
          await editAccount({
            variables: {
              id: item.id,
              input: {
                name: item.name,
                accountgroupid: item.accountgroupid?.id ?? item.accountgroupid,
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
              },
            },
          });
          await refetch();
        } catch (e: any) {
          Alert.alert('Error', e?.message || 'Could not save location.');
        } finally {
          setSavingLocId(null);
        }
      },
      () => {
        setSavingLocId(null);
        Alert.alert('Location Error', 'Could not get current location. Please enable GPS and try again.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

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

  // Distance from the salesman to a party (Infinity when either lacks GPS, so
  // located parties always sort above ones with no location).
  const distOf = (p: any) =>
    salesmanLoc && p.latitude != null && p.longitude != null
      ? haversineKm(salesmanLoc.lat, salesmanLoc.lng, p.latitude, p.longitude)
      : Infinity;

  // Distinct channels among this salesman's own parties → "All" + one chip
  // per channel actually in use (no point listing channels with 0 parties here).
  const channels = useMemo(() => {
    const seen = new Map<string, string>();
    parties.forEach((p: any) => {
      if (p.channel?.id && !seen.has(p.channel.id)) seen.set(p.channel.id, p.channel.channelName);
    });
    return Array.from(seen, ([id, channelName]) => ({ id, channelName }));
  }, [parties]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = q
      ? parties.filter((p: any) =>
          (p.name || '').toLowerCase().includes(q) || (p.mobile || '').includes(q))
      : parties;
    if (channelFilter) list = list.filter((p: any) => p.channel?.id === channelFilter);
    // Nearest party first (so the closest stop is on top, no scrolling). When we
    // have no GPS fix yet, fall back to pending-amount order.
    if (!salesmanLoc) {
      return [...list].sort((a: any, b: any) => (b.outstanding || 0) - (a.outstanding || 0));
    }
    return [...list].sort((a: any, b: any) => distOf(a) - distOf(b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parties, search, salesmanLoc, channelFilter]);

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
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
            {item.channel?.channelName ? (
              <View style={[styles.channelPill, { backgroundColor: colors.brandSoft }]}>
                <Icon name="account-network-outline" size={10} color={colors.brand} />
                <Text style={[styles.channelText, { color: colors.brand }]} numberOfLines={1}>
                  {item.channel.channelName}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Phone + location share one row to keep the card compact. */}
          <View style={styles.metaRow}>
            {item.mobile ? (
              <View style={styles.metaItem}>
                <Icon name="phone-outline" size={11} color={colors.subText} />
                <Text style={[styles.locText, { color: colors.subText }]} numberOfLines={1}>{item.mobile}</Text>
              </View>
            ) : null}

            {hasLoc ? (
              <TouchableOpacity
                style={[styles.metaItem, { flex: 1 }]}
                activeOpacity={0.7}
                onPress={() => openMapsForParty(item, salesmanLoc)}
              >
                <Icon name="map-marker-outline" size={11} color={colors.brand} />
                <Text style={[styles.locText, { color: colors.brand, flexShrink: 1 }]} numberOfLines={1}>
                  {[item.address, item.city].filter(Boolean).join(', ') || 'View on map'}
                </Text>
                <Icon name="open-in-new" size={10} color={colors.brand} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.metaItem}
                activeOpacity={0.7}
                disabled={savingLocId === item.id}
                onPress={() => handleAddLocation(item)}
              >
                <Icon name={savingLocId === item.id ? 'loading' : 'map-marker-plus-outline'} size={11} color={colors.brand} />
                <Text style={[styles.locText, { color: colors.brand }]} numberOfLines={1}>
                  {savingLocId === item.id ? 'Saving location…' : 'Add location'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {bal > 0 ? (
            <Text style={styles.outstanding}>Pending: ₹{out.toLocaleString('en-IN')}</Text>
          ) : bal < 0 ? (
            <Text style={[styles.outstanding, { color: '#16a34a' }]}>Advance: ₹{out.toLocaleString('en-IN')}</Text>
          ) : (
            <Text style={[styles.settled, { color: '#22c55e' }]}>No dues</Text>
          )}
        </View>

        <View style={styles.rightCol}>
          <View style={styles.rightTopRow}>
            <View style={[styles.statusPill, { backgroundColor: vm.color + '18' }]}>
              <Text style={[styles.statusPillText, { color: vm.color }]}>{vm.label}</Text>
            </View>
            <Icon name="chevron-right" size={18} color={colors.subText} />
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

      {channels.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipList}
          style={styles.chipScroll}
        >
          {[{ id: null, channelName: 'All' }, ...channels].map((c: any) => {
            const active = channelFilter === c.id;
            return (
              <TouchableOpacity
                key={c.id ?? 'all'}
                style={[
                  styles.chip,
                  active
                    ? { backgroundColor: colors.brand, borderColor: colors.brand }
                    : { backgroundColor: colors.raisedSurface, borderColor: colors.border },
                ]}
                onPress={() => setChannelFilter(c.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, { color: active ? '#fff' : colors.subText }]} numberOfLines={1}>
                  {c.channelName}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

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
  chipScroll: { flexGrow: 0, marginTop: 10 },
  chipList: { paddingHorizontal: 18, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  chipText: { fontSize: 12.5, fontFamily: FONTS.semiBold },
  listContent: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 30 },

  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 16, borderWidth: 1, padding: 13, marginBottom: 10 },
  visitIcon: { width: 36, height: 36, borderRadius: 11, justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 14, fontFamily: FONTS.bold, flexShrink: 1 },
  channelPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  channelText: { fontSize: 10.5, fontFamily: FONTS.semiBold, flexShrink: 1 },
  // Phone + location live in the same row now, so the card needs one fewer line.
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  locText: { fontSize: 11.5, fontFamily: FONTS.regular, flexShrink: 1 },
  outstanding: { fontSize: 12, fontFamily: FONTS.semiBold, color: '#ef4444', marginTop: 4 },
  settled: { fontSize: 11.5, fontFamily: FONTS.semiBold, marginTop: 4 },

  rightCol: { alignItems: 'flex-end', gap: 8 },
  // Chevron sits right next to the status pill instead of dangling below the
  // distance badge, so it doesn't drift away from "Visited"/"Pending".
  rightTopRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10 },
  statusPillText: { fontSize: 10, fontFamily: FONTS.semiBold },
  distBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  distText: { fontSize: 11, fontFamily: FONTS.semiBold },
  collectBtn: { width: 34, height: 34, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
});
