import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Alert, TextInput } from 'react-native';
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

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DUMMY_ACCOUNTS = [
  { id: 'acc1',  name: 'Ramesh Traders',    mobile: '9876500001', accountcode: 'AC001', city: 'Mumbai'    },
  { id: 'acc2',  name: 'Suresh General',    mobile: '9876500002', accountcode: 'AC002', city: 'Mumbai'    },
  { id: 'acc3',  name: 'Kamal Provisions',  mobile: '9876500003', accountcode: 'AC003', city: 'Thane'     },
  { id: 'acc4',  name: 'Vikram Wholesale',  mobile: '9876500004', accountcode: 'AC004', city: 'Thane'     },
  { id: 'acc5',  name: 'Santosh Kirana',    mobile: '9876500005', accountcode: 'AC005', city: 'Navi Mumbai'},
  { id: 'acc6',  name: 'Dinesh Stores',     mobile: '9876500006', accountcode: 'AC006', city: 'Pune'      },
  { id: 'acc7',  name: 'Pradeep Mart',      mobile: '9876500007', accountcode: 'AC007', city: 'Pune'      },
  { id: 'acc8',  name: 'Rajesh Bazaar',     mobile: '9876500008', accountcode: 'AC008', city: 'Nashik'    },
  { id: 'acc9',  name: 'Mahesh Retailers',  mobile: '9876500009', accountcode: 'AC009', city: 'Nashik'    },
  { id: 'acc10', name: 'Sunil Emporium',    mobile: '9876500010', accountcode: 'AC010', city: 'Aurangabad' },
];

export default function AddPartyToRoute() {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const { colors, isDark } = useTheme();

  const tenant  = useSelector((s: RootState) => s.tenant);
  const adminid = tenant.adminId ?? '';

  const {
    routeId,
    routeName,
    day: preselectedDay,
    existingAccountIds = [] as string[],
    routeSalesmanId    = '',
    allDayWiseAccounts = [] as any[],
  } = route.params ?? {};

  const [search,       setSearch]       = useState('');
  const [selectedDay,  setSelectedDay]  = useState<string>(preselectedDay ?? '');
  const [adding,       setAdding]       = useState<string | null>(null);

  const { data } = useQuery(GET_ACCOUNTS, {
    variables: { admin: adminid },
    skip: !adminid,
  });

  const [updateRoute] = useMutation(UPDATE_SALES_ROUTE);

  const rawAccounts = (data?.getAccounts ?? []) as any[];
  const accounts    = rawAccounts.length > 0 ? rawAccounts : DUMMY_ACCOUNTS;

  const alreadyOnDay = new Set<string>(existingAccountIds);

  const filtered = useMemo(() =>
    accounts.filter((a: any) => {
      const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.mobile?.includes(search);
      const notAdded    = !alreadyOnDay.has(a.id);
      return matchSearch && notAdded;
    }),
    [accounts, search, existingAccountIds]
  );

  const handleAdd = (party: any) => {
    if (!selectedDay) {
      Alert.alert('Select Day', 'Please choose which day to add this party to.');
      return;
    }

    Alert.alert(
      'Add Party to Route',
      `Add "${party.name}" to ${routeName} on ${selectedDay}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          onPress: async () => {
            setAdding(party.id);
            try {
              if (adminid && routeId && rawAccounts.length > 0) {
                const updatedDayWise = buildUpdatedDayWise(allDayWiseAccounts, selectedDay, party.id);
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
              Alert.alert(
                'Party Added',
                `${party.name} has been added to ${routeName} on ${selectedDay}.`,
                [{ text: 'OK', onPress: () => navigation.goBack() }],
              );
            } catch {
              Alert.alert('Error', 'Could not add party to route. Please try again.');
            } finally {
              setAdding(null);
            }
          },
        },
      ],
    );
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
      <TouchableOpacity
        style={[styles.addBtn, { backgroundColor: adding === a.id ? colors.border : colors.brand }]}
        onPress={() => handleAdd(a)}
        disabled={adding !== null}
        activeOpacity={0.8}
      >
        {adding === a.id
          ? <Icon name="loading" size={16} color="#fff" />
          : <Icon name="plus" size={16} color="#fff" />
        }
      </TouchableOpacity>
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
      </View>

      {/* Day picker */}
      <View style={styles.daySection}>
        <Text style={[styles.dayLabel, { color: colors.text }]}>Select Day</Text>
        <View style={styles.dayChips}>
          {DAYS.map(d => {
            const active = selectedDay === d;
            return (
              <TouchableOpacity
                key={d}
                style={[
                  styles.dayChip,
                  active
                    ? { backgroundColor: colors.brand,         borderColor: colors.brand }
                    : { backgroundColor: colors.raisedSurface, borderColor: colors.border },
                ]}
                onPress={() => setSelectedDay(d)}
              >
                <Text style={[styles.dayChipText, { color: active ? '#fff' : colors.subText }]}>
                  {d.slice(0, 3)}
                </Text>
              </TouchableOpacity>
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
          <TouchableOpacity onPress={() => setSearch('')}>
            <Icon name="close-circle" size={16} color={colors.subText} />
          </TouchableOpacity>
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
              {search ? 'No parties match your search' : 'All parties already on this day'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

function buildUpdatedDayWise(existing: any[], day: string, newAccountId: string): any[] {
  const copy = existing.map((d: any) => ({ ...d, accounts: [...(d.accounts ?? [])] }));
  const idx  = copy.findIndex((d: any) => d.day === day);
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
  container:    { flex: 1 },
  listContent:  { paddingHorizontal: 18, paddingBottom: 40 },

  contextBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 18, marginTop: 10, marginBottom: 4,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  contextText: { fontSize: 13, fontFamily: FONTS.semiBold },

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
