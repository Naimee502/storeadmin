import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Linking, Platform, Alert, PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { COLORS, FONTS, useTheme } from '../../../../config';
import { AppHeader, DynamicFlashList } from '../../../../components';
import { useSalesRoutesQuery } from '../../../../apollo/hooks/staffaccounts';
import { GET_SALES_ORDERS, GET_ACCOUNTS } from '../../../../apollo/queries/accounts';
import type { RootState } from '../../../../store/rootreducer';

// Days come in mixed formats: admin panel saves "sun"/"mon", the app used
// "Sunday"/"Monday". Normalise to a lowercase 3-letter key everywhere.
const dayKey = (d?: string) => String(d ?? '').trim().slice(0, 3).toLowerCase();

const DAY_ORDER: Record<string, number> = {
  mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7,
};

// Map a server SalesRoute (dayWiseAccounts.accounts are full Account docs) into the
// shape the cards render. Keeps the existing UI untouched.
function mapServerRoutes(serverRoutes: any[], visitedSet: Set<string>, allowedIds?: Set<string> | null): any[] {
  return (serverRoutes ?? []).map((r: any) => ({
    id: r.id,
    routename: r.routename,
    routecode: r.routecode ?? '',
    status: r.status,
    salesmanid: r.salesmanid,
    dayWiseAccounts: [...(r.dayWiseAccounts ?? [])]
      .sort((a: any, b: any) => (DAY_ORDER[dayKey(a.day)] ?? 99) - (DAY_ORDER[dayKey(b.day)] ?? 99))
      .map((dw: any) => ({
        day: dw.day,
        visitorder: dw.visitorder ?? 0,
        accounts: (dw.accounts ?? [])
          // Only this salesman's own parties (same set as the My Parties list).
          // When the allow-set is empty/unknown, show all (don't blank the route).
          .filter((a: any) => !allowedIds || allowedIds.size === 0 || allowedIds.has(String(a.id)))
          .map((a: any) => ({
          id: a.id,
          name: a.name,
          mobile: a.mobile ?? '',
          city: a.city ?? '',
          address: a.address ?? '',
          channelName: a.channel?.channelName ?? '',
          lat: a.latitude ?? null,
          lng: a.longitude ?? null,
          // Live ledger balance from the server (Dr−Cr of posted transactions),
          // same basis as the party-login ledger. 0 when the party has no activity.
          outstanding: a.outstanding ?? 0,
          // "visited" = this party already got an order from the salesman today.
          visitStatus: (visitedSet.has(String(a.id)) ? 'visited' : 'pending') as VisitStatus,
        })),
      })),
  }));
}

// Convert mapped dayWiseAccounts (full objects) → the ID-only shape the
// add/manage mutations expect ({ day, visitorder, accounts: [id] }).
function toDayWiseIds(dayWise: any[]): any[] {
  return (dayWise ?? []).map((d: any) => ({
    day: d.day,
    visitorder: d.visitorder ?? 0,
    accounts: (d.accounts ?? []).map((a: any) => a.id ?? a),
  }));
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
// getDay(): 0=Sunday … 6=Saturday. DAYS is Mon-first, so Sunday → last index (6).
// TODAY_DAY is a normalised key ("mon"…"sun") for format-agnostic comparison.
const TODAY_DAY = dayKey(DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]);

type VisitStatus = 'pending' | 'visited' | 'skipped';
type LatLng = { lat: number; lng: number };

// ── dummy data (with location) ──────────────────────────────────────────────

const DUMMY_ROUTES = [
  {
    id: 'r1', routename: 'North Zone', routecode: 'RT001', status: true,
    dayWiseAccounts: [
      {
        day: 'Monday', accounts: [
          { id: 'a1', name: 'Mehta Traders',   mobile: '9876541001', outstanding: 12500, visitStatus: 'visited' as VisitStatus, city: 'Andheri West',  address: 'Shop 12, Andheri Market',    lat: 19.1197, lng: 72.8468 },
          { id: 'a2', name: 'Patel General',   mobile: '9876541002', outstanding: 4200,  visitStatus: 'visited' as VisitStatus, city: 'Jogeshwari',    address: '5B, Link Road',              lat: 19.1362, lng: 72.8497 },
          { id: 'a3', name: 'Gupta Kirana',    mobile: '9876541003', outstanding: 0,     visitStatus: 'pending' as VisitStatus, city: 'Goregaon',      address: 'SV Road, Goregaon West',     lat: 19.1530, lng: 72.8464 },
          { id: 'a4', name: 'Sharma Stores',   mobile: '9876541004', outstanding: 7800,  visitStatus: 'pending' as VisitStatus, city: 'Malad West',    address: 'Near Inorbit Mall',          lat: 19.1875, lng: 72.8488 },
          { id: 'a5', name: 'Singh Provision', mobile: '9876541005', outstanding: 2100,  visitStatus: 'skipped' as VisitStatus, city: 'Kandivali',     address: 'Thakur Village, Kandivali',  lat: 19.2053, lng: 72.8563 },
        ],
      },
      {
        day: 'Thursday', accounts: [
          { id: 'a6', name: 'Shah Stores',     mobile: '9876541006', outstanding: 5500,  visitStatus: 'pending' as VisitStatus, city: 'Borivali',      address: 'IC Colony, Borivali West',   lat: 19.2290, lng: 72.8567 },
          { id: 'a7', name: 'Modi Mart',       mobile: '9876541007', outstanding: 900,   visitStatus: 'pending' as VisitStatus, city: 'Dahisar',       address: 'Dahisar East Market',        lat: 19.2521, lng: 72.8583 },
        ],
      },
    ],
  },
  {
    id: 'r2', routename: 'South Market', routecode: 'RT002', status: true,
    dayWiseAccounts: [
      {
        day: 'Tuesday', accounts: [
          { id: 'a8',  name: 'Iyer Provisions', mobile: '9876542001', outstanding: 3300,  visitStatus: 'pending' as VisitStatus, city: 'Bandra West',  address: 'Hill Road, Bandra',          lat: 19.0596, lng: 72.8295 },
          { id: 'a9',  name: 'Nair Shop',        mobile: '9876542002', outstanding: 0,     visitStatus: 'pending' as VisitStatus, city: 'Santacruz',    address: 'SV Road, Santacruz West',    lat: 19.0815, lng: 72.8408 },
        ],
      },
      {
        day: 'Friday', accounts: [
          { id: 'a10', name: 'Pillai Traders',  mobile: '9876542003', outstanding: 6700,  visitStatus: 'pending' as VisitStatus, city: 'Dadar',        address: 'Dadar TT Circle',            lat: 19.0178, lng: 72.8478 },
          { id: 'a11', name: 'Raj Bazaar',       mobile: '9876542004', outstanding: 1200,  visitStatus: 'pending' as VisitStatus, city: 'Sion',         address: 'Sion Circle, East',          lat: 19.0390, lng: 72.8619 },
          { id: 'a12', name: 'Kumar Stores',     mobile: '9876542005', outstanding: 0,     visitStatus: 'pending' as VisitStatus, city: 'Kurla',        address: 'LBS Marg, Kurla West',       lat: 19.0728, lng: 72.8826 },
        ],
      },
    ],
  },
];

const VISIT_META: Record<VisitStatus, { color: string; icon: string; label: string }> = {
  visited: { color: '#22c55e', icon: 'check-circle',         label: 'Visited' },
  pending: { color: '#f59e0b', icon: 'clock-outline',        label: 'Pending' },
  skipped: { color: '#ef4444', icon: 'minus-circle-outline', label: 'Skipped' },
};

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
  const dest   = `${lat},${lng}`;
  const origin = fromLoc ? `${fromLoc.lat},${fromLoc.lng}` : '';

  const googleUrl = origin
    ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`
    : `https://www.google.com/maps/search/?api=1&query=${dest}`;

  const appleUrl = origin
    ? `maps://?saddr=${origin}&daddr=${dest}`
    : `maps://?q=${encodeURIComponent(label)}&ll=${dest}`;

  const url = Platform.OS === 'ios' ? appleUrl : googleUrl;

  Linking.canOpenURL(url)
    .then(supported => {
      if (supported) return Linking.openURL(url);
      return Linking.openURL(googleUrl);
    })
    .catch(() => Alert.alert('Maps Error', 'Could not open maps app.'));
}

// ── RouteCard ─────────────────────────────────────────────────────────────────

function RouteCard({ route, colors, salesmanLoc, onPartyPress, onAddParty, onManageParty, allRoutes, onNavigate, defaultExpanded }: {
  route: any; colors: any; salesmanLoc: LatLng | null;
  onNavigate: (lat: number, lng: number, label: string) => void;
  onPartyPress:   (party: any) => void;
  onAddParty:     (routeId: string, routeName: string, day: string, existingIds: string[], allDayWise: any[], salesmanId: string) => void;
  onManageParty:  (party: any, routeId: string, routeName: string, day: string, dayWiseAccounts: any[], salesmanId: string, allRoutes: any[]) => void;
  allRoutes:      any[];
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(!!defaultExpanded);

  const totalAccounts = route.dayWiseAccounts.reduce((s: number, d: any) => s + d.accounts.length, 0);
  const visitedCount  = route.dayWiseAccounts.reduce(
    (s: number, d: any) => s + d.accounts.filter((a: any) => a.visitStatus === 'visited').length, 0
  );
  const pct = totalAccounts > 0 ? Math.round((visitedCount / totalAccounts) * 100) : 0;

  return (
    <Animated.View entering={FadeInUp.duration(400)} style={[styles.routeCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>

      {/* Route header */}
      <TouchableOpacity style={styles.routeHeader} onPress={() => setExpanded(v => !v)} activeOpacity={0.82}>
        <View style={[styles.routeIconWrap, { backgroundColor: colors.brandSoft }]}>
          <Icon name="map-marker-path" size={20} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.routeName, { color: colors.text }]}>{route.routename}</Text>
          <Text style={[styles.routeMeta, { color: colors.subText }]}>
            {route.routecode}  ·  {visitedCount}/{totalAccounts} visited
          </Text>
        </View>
        <View style={styles.progressWrap}>
          <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
            <View style={[styles.progressFill, { backgroundColor: colors.brand, width: `${pct}%` as any }]} />
          </View>
          <Text style={[styles.progressText, { color: colors.brand }]}>{pct}%</Text>
        </View>
        <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.subText} style={{ marginLeft: 8 }} />
      </TouchableOpacity>

      {/* Day sections */}
      {expanded && route.dayWiseAccounts.map((day: any) => {
        const isToday = dayKey(day.day) === TODAY_DAY;
        return (
          <View key={day.day} style={[styles.daySection, { borderTopColor: colors.border }]}>
            <View style={styles.dayHeaderRow}>
              <Text style={[styles.dayLabel, { color: isToday ? colors.brand : colors.text }]}>{day.day}</Text>
              {isToday && (
                <View style={[styles.todayBadge, { backgroundColor: colors.brandSoft }]}>
                  <Text style={[styles.todayText, { color: colors.brand }]}>Today</Text>
                </View>
              )}
              <Text style={[styles.dayCount, { color: colors.subText }]}>{day.accounts.length} parties</Text>
              <TouchableOpacity
                style={[styles.addPartyBtn, { backgroundColor: colors.brandSoft }]}
                onPress={() => onAddParty(
                  route.id, route.routename, day.day,
                  day.accounts.map((a: any) => a.id),
                  route.dayWiseAccounts,
                  route.salesmanid?.id ?? '',
                )}
              >
                <Icon name="plus" size={13} color={colors.brand} />
                <Text style={[styles.addPartyText, { color: colors.brand }]}>Add</Text>
              </TouchableOpacity>
            </View>

            {[...day.accounts]
              .sort((a: any, b: any) => {
                // Nearest party first so the closest stop is on top (no scrolling).
                // No GPS fix → keep the route's planned order (both Infinity).
                const da = (salesmanLoc && a.lat != null && a.lng != null)
                  ? haversineKm(salesmanLoc.lat, salesmanLoc.lng, a.lat, a.lng) : Infinity;
                const db = (salesmanLoc && b.lat != null && b.lng != null)
                  ? haversineKm(salesmanLoc.lat, salesmanLoc.lng, b.lat, b.lng) : Infinity;
                return da - db;
              })
              .map((party: any, idx: number) => {
              const vm = VISIT_META[party.visitStatus];
              const distKm = (salesmanLoc && party.lat != null && party.lng != null)
                ? haversineKm(salesmanLoc.lat, salesmanLoc.lng, party.lat, party.lng)
                : null;
              return (
                <View
                  key={party.id}
                  style={[
                    styles.partyRow,
                    { borderBottomColor: colors.border },
                    idx === day.accounts.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.partyRowMain}
                    onPress={() => onPartyPress({ ...party, routeName: route.routename, routeId: route.id, routeDay: day.day })}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.visitIcon, { backgroundColor: vm.color + '18' }]}>
                      <Icon name={vm.icon} size={16} color={vm.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.partyName, { color: colors.text }]}>{party.name}</Text>
                      {!!party.channelName && (
                        <View style={[styles.channelPill, { backgroundColor: colors.brandSoft }]}>
                          <Icon name="account-network-outline" size={10} color={colors.brand} />
                          <Text style={[styles.channelText, { color: colors.brand }]} numberOfLines={1}>
                            {party.channelName}
                          </Text>
                        </View>
                      )}
                      {!!party.mobile && (
                        <View style={styles.partyLocRow}>
                          <Icon name="phone-outline" size={11} color={colors.subText} />
                          <Text style={[styles.partyCity, { color: colors.subText }]} numberOfLines={1}>
                            {party.mobile}
                          </Text>
                        </View>
                      )}
                      {/* tappable location row → opens maps */}
                      <TouchableOpacity
                        style={styles.partyLocRow}
                        onPress={() => onNavigate(party.lat, party.lng, party.name)}
                        activeOpacity={0.7}
                      >
                        <Icon name="map-marker-outline" size={11} color={colors.brand} />
                        <Text style={[styles.partyCity, { color: colors.brand }]} numberOfLines={1}>
                          {party.address}, {party.city}
                        </Text>
                        <Icon name="open-in-new" size={10} color={colors.brand} />
                      </TouchableOpacity>
                      {party.outstanding > 0 ? (
                        <Text style={[styles.outstanding, { color: '#ef4444' }]}>
                          Pending: ₹{Math.abs(party.outstanding).toLocaleString('en-IN')}
                        </Text>
                      ) : party.outstanding < 0 ? (
                        <Text style={[styles.outstanding, { color: '#16a34a' }]}>
                          Advance: ₹{Math.abs(party.outstanding).toLocaleString('en-IN')}
                        </Text>
                      ) : (
                        <Text style={[styles.outstanding, { color: '#16a34a' }]}>No dues</Text>
                      )}
                    </View>
                    <View style={styles.partyRight}>
                      {distKm !== null && (
                        <TouchableOpacity
                          style={[styles.distBadge, { backgroundColor: colors.brandSoft }]}
                          onPress={() => onNavigate(party.lat, party.lng, party.name)}
                          activeOpacity={0.75}
                        >
                          <Icon name="navigation-variant-outline" size={12} color={colors.brand} />
                          <Text style={[styles.distText, { color: colors.brand }]}>{fmtDist(distKm)}</Text>
                        </TouchableOpacity>
                      )}
                      <View style={[styles.statusPill, { backgroundColor: vm.color + '18' }]}>
                        <Text style={[styles.statusPillText, { color: vm.color }]}>{vm.label}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.manageBtn, { backgroundColor: colors.raisedSurface }]}
                    onPress={() => onManageParty(
                      party, route.id, route.routename, day.day,
                      route.dayWiseAccounts, route.salesmanid?.id ?? '', allRoutes,
                    )}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  >
                    <Icon name="dots-vertical" size={16} color={colors.subText} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        );
      })}
    </Animated.View>
  );
}

// ── main screen ───────────────────────────────────────────────────────────────

export default function SalesmanRoutes() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const [salesmanLoc, setSalesmanLoc] = useState<LatLng | null>(null);
  const [locLabel,    setLocLabel]    = useState<'fetching' | 'live' | 'off'>('fetching');

  const fetchLocation = useCallback(async () => {
    setLocLabel('fetching');

    // Android needs an explicit runtime permission before the first fix.
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
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setSalesmanLoc(null);
          setLocLabel('off');
          return;
        }
      } catch {
        setSalesmanLoc(null);
        setLocLabel('off');
        return;
      }
    }

    try {
      Geolocation.getCurrentPosition(
        (pos: any) => {
          setSalesmanLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocLabel('live');
        },
        () => {
          // No fix available — hide distances rather than show a fake one.
          setSalesmanLoc(null);
          setLocLabel('off');
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
      );
    } catch {
      setSalesmanLoc(null);
      setLocLabel('off');
    }
  }, []);

  useEffect(() => { fetchLocation(); }, [fetchLocation]);

  // Live sales routes for the logged-in salesman (admin/branch/salesman filtered server-side).
  const { data, loading, refetch } = useSalesRoutesQuery();

  // Today's orders by this salesman → used to mark which parties are "visited".
  const adminId    = useSelector((s: RootState) => s.tenant.adminId);
  const salesmanId = useSelector((s: RootState) => s.auth.user?.id);
  const { data: ordersData, refetch: refetchOrders } = useQuery(GET_SALES_ORDERS, {
    variables: { adminid: adminId, salesmenid: salesmanId },
    skip: !adminId || !salesmanId,
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

  // This salesman's own parties (same source as the My Parties screen) — used
  // to scope the route to only their parties.
  const { data: myPartiesData } = useQuery(GET_ACCOUNTS, {
    variables: { admin: adminId, salesmanid: salesmanId },
    skip: !adminId || !salesmanId,
    fetchPolicy: 'cache-and-network',
  });
  const myPartyIds = useMemo(() => {
    const list = (myPartiesData as any)?.getAccounts ?? [];
    return new Set(list.map((a: any) => String(a.id)));
  }, [myPartiesData]);

  const routes = useMemo(
    () => mapServerRoutes((data as any)?.getSalesRoutes ?? [], visitedSet, myPartyIds),
    [data, visitedSet, myPartyIds],
  );

  React.useEffect(() => {
    const total = ((data as any)?.getSalesRoutes ?? [])
      .reduce((s: number, r: any) => s + (r.dayWiseAccounts ?? []).reduce((d: number, dw: any) => d + (dw.accounts ?? []).length, 0), 0);
    const shown = routes.reduce((s: number, r: any) => s + r.dayWiseAccounts.reduce((d: number, dw: any) => d + dw.accounts.length, 0), 0);
    console.log('🗺️ [MyRoutes] myPartyIds:', myPartyIds.size, '| route parties total:', total, '| shown after filter:', shown);
  }, [data, routes, myPartyIds]);

  // Refresh whenever the screen regains focus (e.g. after add / manage party / new order).
  useFocusEffect(useCallback(() => { refetch?.(); refetchOrders?.(); }, [refetch, refetchOrders]));

  const handleNavigate = useCallback((lat: number, lng: number, label: string) => {
    if (lat == null || lng == null) return;
    openInMaps(lat, lng, label, salesmanLoc);
  }, [salesmanLoc]);

  const handlePartyPress = (party: any) => {
    navigation.navigate('RoutePartyVisit', {
      partyId: party.id, partyName: party.name,
      mobile: party.mobile, outstanding: party.outstanding,
      routeName: party.routeName, routeId: party.routeId, routeDay: party.routeDay,
    });
  };

  const handleAddParty = (
    routeId: string, routeName: string, day: string,
    existingAccountIds: string[], allDayWiseAccounts: any[], salesmanId: string,
  ) => {
    navigation.navigate('AddPartyToRoute', {
      routeId, routeName, day,
      existingAccountIds,
      // mutation expects account IDs, not full objects
      allDayWiseAccounts: toDayWiseIds(allDayWiseAccounts),
      routeSalesmanId: salesmanId,
    });
  };

  const handleManageParty = (
    party: any, routeId: string, routeName: string, day: string,
    dayWiseAccounts: any[], salesmanId: string, allRoutes: any[],
  ) => {
    navigation.navigate('ManagePartyRoute', {
      partyId: party.id, partyName: party.name,
      currentRouteId: routeId, currentRouteName: routeName,
      currentDay: day, currentDayWiseAccounts: toDayWiseIds(dayWiseAccounts),
      currentSalesmanId: salesmanId,
      availableRoutes: allRoutes.map((r: any) => ({
        id: r.id, routename: r.routename,
        dayWiseAccounts: toDayWiseIds(r.dayWiseAccounts), salesmanid: r.salesmanid,
      })),
    });
  };

  const locIcon  = locLabel === 'live' ? 'crosshairs-gps'    : locLabel === 'fetching' ? 'loading' : 'crosshairs';
  const locColor = locLabel === 'live' ? '#22c55e'           : locLabel === 'fetching' ? colors.brand : colors.subText;
  const locTip   = locLabel === 'live' ? 'Live location'     : locLabel === 'fetching' ? 'Getting location…' : 'Approx. location';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

      <AppHeader label="My Routes" />

      {/* location status bar */}
      <View style={[styles.locBar, { backgroundColor: colors.cardGlass, borderBottomColor: colors.border }]}>
        <Icon name={locIcon} size={14} color={locColor} />
        <Text style={[styles.locBarText, { color: locColor }]}>{locTip}</Text>
        <Text style={[styles.locBarSub, { color: colors.subText }]}>· Distances shown per party</Text>
        <TouchableOpacity onPress={fetchLocation} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} style={{ marginLeft: 'auto' }}>
          <Icon name="refresh" size={16} color={colors.brand} />
        </TouchableOpacity>
      </View>

      <DynamicFlashList
        data={routes}
        renderItem={({ item, index }: any) => (
          <RouteCard
            route={item}
            colors={colors}
            salesmanLoc={salesmanLoc}
            onPartyPress={handlePartyPress}
            onAddParty={handleAddParty}
            onManageParty={handleManageParty}
            onNavigate={handleNavigate}
            allRoutes={routes}
            defaultExpanded={index === 0}
          />
        )}
        estimatedItemSize={280}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onRefresh={refetch}
        refreshing={loading && routes.length > 0}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Icon name={loading ? 'map-marker-radius-outline' : 'map-marker-off-outline'} size={48} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.subText }]}>
              {loading ? 'Loading routes…' : 'No routes assigned'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  listContent: { paddingHorizontal: 18, paddingBottom: 110, paddingTop: 14 },

  locBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 18, paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  locBarText: { fontSize: 12, fontFamily: FONTS.semiBold },
  locBarSub:  { fontSize: 11, fontFamily: FONTS.regular },

  routeCard: {
    borderRadius: 18, borderWidth: 1, marginBottom: 14, overflow: 'hidden',
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  routeHeader:   { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  routeIconWrap: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  routeName:     { fontSize: 14, fontFamily: FONTS.bold },
  routeMeta:     { fontSize: 12, fontFamily: FONTS.regular, marginTop: 2 },

  progressWrap: { alignItems: 'center', gap: 3 },
  progressBar:  { width: 44, height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  progressText: { fontSize: 10, fontFamily: FONTS.bold },

  daySection:   { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 },
  dayHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  dayLabel:     { fontSize: 13, fontFamily: FONTS.bold },
  todayBadge:   { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  todayText:    { fontSize: 10, fontFamily: FONTS.bold },
  dayCount:     { fontSize: 11, fontFamily: FONTS.regular, marginLeft: 'auto' },
  addPartyBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, marginLeft: 8 },
  addPartyText: { fontSize: 11, fontFamily: FONTS.bold },

  partyRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  partyRowMain: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  manageBtn:    { width: 30, height: 30, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginLeft: 4 },
  visitIcon:    { width: 30, height: 30, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  partyName:    { fontSize: 13, fontFamily: FONTS.semiBold },
  channelPill:  { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, marginTop: 3 },
  channelText:  { fontSize: 10, fontFamily: FONTS.semiBold, flexShrink: 1 },
  partyLocRow:  { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  partyCity:    { fontSize: 11, fontFamily: FONTS.regular, flex: 1 },
  outstanding:  { fontSize: 11, fontFamily: FONTS.semiBold, marginTop: 2, color: '#ef4444' },

  partyRight:   { alignItems: 'flex-end', gap: 5, marginTop: 2 },
  distBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  distText:     { fontSize: 11, fontFamily: FONTS.bold },
  statusPill:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusPillText: { fontSize: 10, fontFamily: FONTS.semiBold },

  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: FONTS.regular },
});
