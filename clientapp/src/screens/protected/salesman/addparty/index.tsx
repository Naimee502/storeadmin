import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, StatusBar, Alert, TextInput } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useMutation } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { COLORS, FONTS, useTheme } from '../../../../config';
import { BackHeader, DynamicFlashList } from '../../../../components';
import { GET_ACCOUNTS } from '../../../../apollo/queries/accounts';
import { UPDATE_SALES_ROUTE } from '../../../../apollo/mutations/staffaccounts';
import type { RootState } from '../../../../store/rootreducer';
import { isNamedEndUserChannel } from '../../../../utils';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Days are stored inconsistently across the system: the admin web panel saves
// lowercase 3-letter keys ("sun", "mon"), while the mobile app historically used
// full names ("Sunday"). Normalise to a lowercase 3-letter key so both match.
const dayKey = (d?: string) => String(d ?? '').trim().slice(0, 3).toLowerCase();

export default function AddPartyToRoute() {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const { colors, isDark } = useTheme();

  const tenant  = useSelector((s: RootState) => s.tenant);
  const adminid = tenant.adminId ?? '';
  const user    = useSelector((s: RootState) => s.auth.user);

  const {
    routeId,
    routeName,
    day: preselectedDay,
    existingAccountIds = [] as string[],
    routeSalesmanId    = '',
    allDayWiseAccounts = [] as any[],
  } = route.params ?? {};

  const [search,       setSearch]       = useState('');
  // Keep the selected day as a normalised key so it matches whatever format the
  // route was stored in (admin "sun" or app "Sunday").
  const [selectedDay,  setSelectedDay]  = useState<string>(dayKey(preselectedDay));
  const [adding,       setAdding]       = useState<string | null>(null);

  const { data, loading } = useQuery(GET_ACCOUNTS, {
    variables: { admin: adminid, salesmanid: user?.id },
    skip: !adminid || !user?.id,
    fetchPolicy: 'cache-and-network',
  });

  const [updateRoute] = useMutation(UPDATE_SALES_ROUTE);

  const accounts = ((data as any)?.getAccounts ?? []) as any[];

  // The route as it stands NOW, kept on this screen. The salesman stays here
  // and adds several parties in a row, so every save must build on the
  // previous one — saving from the original snapshot each time would drop the
  // party added a moment ago.
  const [dayWise, setDayWise] = useState<any[]>(() => {
    const base = (allDayWiseAccounts ?? []).map((d: any) => ({ ...d, accounts: [...(d.accounts ?? [])] }));
    // Older callers only passed the ids for the opened day — fold them in.
    const key = dayKey(preselectedDay);
    if (key && existingAccountIds.length && !base.some((d: any) => dayKey(d.day) === key)) {
      base.push({ day: preselectedDay, visitorder: 0, accounts: [...existingAccountIds] });
    }
    return base;
  });

  // Parties already on the SELECTED day (follows the day chips).
  const alreadyOnDay = useMemo(
    () => new Set<string>(
      (dayWise.find((d: any) => dayKey(d.day) === selectedDay)?.accounts ?? []).map((a: any) => String(a?.id ?? a)),
    ),
    [dayWise, selectedDay],
  );

  // Short "Added ✓" banner instead of an OK popup that sent him back.
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const filtered = useMemo(() =>
    accounts.filter((a: any) => {
      const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.mobile?.includes(search);
      const notAdded    = !alreadyOnDay.has(String(a.id));
      // App / website shoppers are nobody's route stop (same as My Parties).
      if (isNamedEndUserChannel(a.channel?.channelName)) return false;
      // Only parties this salesman created (salesmanid linked to them).
      // Admin-created parties (no/other salesmanid) must not be addable here,
      // even if the server returned them via route-based scoping.
      const ownParty    = String(a.salesmanid?.id ?? a.salesmanid ?? '') === String(user?.id ?? '');
      return matchSearch && notAdded && ownParty;
    }),
    [accounts, search, alreadyOnDay, user?.id]
  );

  const handleAdd = (party: any) => {
    if (!selectedDay) {
      Alert.alert('Select Day', 'Please choose which day to add this party to.');
      return;
    }

    // One tap adds — no confirm, no "OK" that leaves the screen — so several
    // parties can be added in a row. A wrong add is undone from Manage (⋮).
    (async () => {
      setAdding(party.id);
      try {
        const updatedDayWise = buildUpdatedDayWise(dayWise, selectedDay, party.id);
        if (adminid && routeId) {
          await updateRoute({
            variables: {
              id: routeId,
              input: {
                adminid,
                routename: routeName,
                salesmanid: routeSalesmanId,
                dayWiseAccounts: updatedDayWise,
              },
            },
          });
        }
        setDayWise(updatedDayWise);
        const dayName = DAYS.find((d) => dayKey(d) === selectedDay) ?? selectedDay;
        showToast(`${party.name} added to ${dayName}`);
      } catch {
        Alert.alert('Error', 'Could not add party to route. Please try again.');
      } finally {
        setAdding(null);
      }
    })();
  };

  const renderItem = ({ item: a }: { item: any }) => (
    <View style={[styles.partyRow, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
      <View style={[styles.avatar, { backgroundColor: colors.brandSoft }]}>
        <Text style={[styles.avatarText, { color: colors.brand }]}>
          {a.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.partyName, { color: colors.text }]} numberOfLines={1}>{a.name}</Text>
        {!!a.channel?.channelName && (
          <View style={[styles.channelPill, { backgroundColor: colors.brandSoft }]}>
            <Icon name="account-network-outline" size={10} color={colors.brand} />
            <Text style={[styles.channelText, { color: colors.brand }]} numberOfLines={1}>
              {a.channel.channelName}
            </Text>
          </View>
        )}
        <View style={styles.metaRow}>
          {a.mobile && (
            <View style={styles.metaChip}>
              <Icon name="phone-outline" size={10} color={colors.subText} />
              <Text style={[styles.metaText, { color: colors.subText }]}>{a.mobile}</Text>
            </View>
          )}
          {a.city && (
            <View style={styles.metaChip}>
              <Icon name="map-marker-outline" size={10} color={colors.subText} />
              <Text style={[styles.metaText, { color: colors.subText }]}>{a.city}</Text>
            </View>
          )}
        </View>
        {a.accountcode && (
          <Text style={[styles.accountCode, { color: colors.subText }]}>{a.accountcode}</Text>
        )}
      </View>
      <Pressable
        style={[styles.addBtn, { backgroundColor: adding === a.id ? colors.border : colors.brand }]}
        onPress={() => handleAdd(a)}
        disabled={adding !== null}
      >
        {adding === a.id
          ? <Icon name="loading" size={16} color={colors.onBrand} />
          : <Icon name="plus" size={16} color={colors.onBrand} />
        }
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

      <BackHeader label="Add Party to Route" />

      {/* Route + day context banner */}
      <View style={[styles.contextBanner, { backgroundColor: colors.brandSoft }]}>
        <Icon name="map-marker-path" size={14} color={colors.brand} />
        <Text style={[styles.contextText, { color: colors.brand }]}>
          Route: <Text style={{ fontFamily: FONTS.bold }}>{routeName}</Text>
        </Text>
        <Pressable
          style={[styles.newPartyBtn, { backgroundColor: colors.brand }]}
          onPress={() => {
            if (!selectedDay) { Alert.alert('Select Day', 'Please choose which day to add the new party to.'); return; }
            navigation.navigate('SalesmanCreateParty', {
              routeId, routeName, day: selectedDay,
              routeSalesmanId, allDayWiseAccounts: dayWise,
            });
          }}
        >
          <Icon name="account-plus" size={13} color={colors.onBrand} />
          <Text style={[styles.newPartyText, { color: colors.onBrand }]}>New Party</Text>
        </Pressable>
      </View>

      {/* Day picker */}
      <View style={styles.daySection}>
        <Text style={[styles.dayLabel, { color: colors.text }]}>Select Day</Text>
        <View style={styles.dayChips}>
          {DAYS.map(d => {
            const active = selectedDay === dayKey(d);
            return (
              <Pressable
                key={d}
                style={[
                  styles.dayChip,
                  active
                    ? { backgroundColor: colors.brand,         borderColor: colors.brand }
                    : { backgroundColor: colors.raisedSurface, borderColor: colors.border },
                ]}
                onPress={() => setSelectedDay(dayKey(d))}
              >
                <Text style={[styles.dayChipText, { color: active ? colors.onBrand : colors.subText }]}>
                  {d.slice(0, 3)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: colors.raisedSurface, borderColor: colors.border }]}>
        <Icon name="magnify" size={18} color={colors.subText} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search parties..."
          placeholderTextColor={colors.subText}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')}>
            <Icon name="close-circle" size={16} color={colors.subText} />
          </Pressable>
        )}
      </View>

      {/* Party list */}
      <DynamicFlashList
        data={filtered}
        renderItem={renderItem}
        estimatedItemSize={80}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Icon name="account-search-outline" size={44} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.subText }]}>
              {search
                ? 'No parties match your search'
                : accounts.length === 0
                  ? 'No parties found for you'
                  : 'All your parties are already on this day'}
            </Text>
          </View>
        }
      />
      {/* "Added" confirmation — stays on this screen so more can be added. */}
      {!!toast && (
        <View pointerEvents="none" style={[styles.toast, { backgroundColor: colors.brand }]}>
          <Icon name="check-circle" size={16} color={colors.onBrand} />
          <Text style={[styles.toastText, { color: colors.onBrand }]} numberOfLines={2}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

function buildUpdatedDayWise(existing: any[], day: string, newAccountId: string): any[] {
  const copy = existing.map((d: any) => ({ ...d, accounts: [...(d.accounts ?? [])] }));
  // Match by normalised key so "sun" and "Sunday" resolve to the same entry
  // instead of creating a duplicate day.
  const idx  = copy.findIndex((d: any) => dayKey(d.day) === dayKey(day));
  if (idx >= 0) {
    if (!copy[idx].accounts.includes(newAccountId)) {
      copy[idx].accounts.push(newAccountId);
    }
  } else {
    copy.push({ day, visitorder: 0, accounts: [newAccountId] });
  }
  return copy.map((d: any) => ({ day: d.day, visitorder: d.visitorder ?? 0, accounts: d.accounts }));
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute', left: 18, right: 18, bottom: 30,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6,
  },
  toastText: { flex: 1, fontSize: 13, fontFamily: FONTS.semiBold },
  container:    { flex: 1 },
  listContent:  { paddingHorizontal: 18, paddingBottom: 40 },

  contextBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 18, marginTop: 10, marginBottom: 4,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  contextText: { fontSize: 13, fontFamily: FONTS.semiBold, flex: 1 },
  newPartyBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, marginLeft: 'auto' },
  newPartyText: { fontSize: 11, fontFamily: FONTS.bold },

  daySection: { paddingHorizontal: 18, marginTop: 12, marginBottom: 8 },
  dayLabel:   { fontSize: 13, fontFamily: FONTS.semiBold, marginBottom: 8 },
  dayChips:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip:    { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  dayChipText:{ fontSize: 12, fontFamily: FONTS.semiBold },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 18, marginBottom: 10,
    borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: FONTS.regular, paddingVertical: 0 },

  partyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, borderWidth: 1, padding: 12, marginBottom: 10,
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  avatar:      { width: 44, height: 44, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  avatarText:  { fontSize: 17, fontFamily: FONTS.bold },
  partyName:   { fontSize: 14, fontFamily: FONTS.semiBold, marginBottom: 4 },
  metaRow:     { flexDirection: 'row', gap: 10, marginBottom: 2 },
  channelPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, marginTop: 3, marginBottom: 3 },
  channelText: { fontSize: 10, fontFamily: FONTS.semiBold, flexShrink: 1 },
  metaChip:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText:    { fontSize: 11, fontFamily: FONTS.regular },
  accountCode: { fontSize: 11, fontFamily: FONTS.regular },

  addBtn: {
    width: 34, height: 34, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
  },

  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 14, fontFamily: FONTS.regular, textAlign: 'center' },
});
