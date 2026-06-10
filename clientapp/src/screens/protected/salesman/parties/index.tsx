import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, TextInput,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { FONTS, useTheme } from '../../../../config';
import { AppHeader, DynamicFlashList } from '../../../../components';
import { GET_ACCOUNTS } from '../../../../apollo/queries/accounts';
import type { RootState } from '../../../../store/rootreducer';

// Direct (route-less) order flow: lists the salesman's assigned-channel parties
// (the server already filters getAccounts by the salesman's channels), and taps
// straight into the party visit hub (Order / Collect Payment) — no route needed.
export default function SalesmanParties() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const tenant = useSelector((s: RootState) => s.tenant);
  const user = useSelector((s: RootState) => s.auth.user);
  const adminid = tenant.adminId ?? '';
  const [search, setSearch] = useState('');

  // Only THIS salesman's parties — the party's salesmanid is set to the salesman
  // when they add it, so we filter by salesmanid (not the whole channel).
  const { data, loading, error } = useQuery(GET_ACCOUNTS, {
    variables: { admin: adminid, salesmanid: user?.id }, skip: !adminid || !user?.id, fetchPolicy: 'cache-and-network',
  });
  const parties = (data as any)?.getAccounts ?? [];

  // ── TEMP DIAGNOSTIC ──
  React.useEffect(() => {
    console.log('🧑‍💼 [SalesmanParties] user.id:', user?.id, '| role:', user?.role,
      '| adminid:', adminid,
      '| parties:', parties.length,
      '| error:', error?.message);
  }, [parties.length, user?.id, adminid, error]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return parties;
    return parties.filter((p: any) =>
      (p.name || '').toLowerCase().includes(q) || (p.mobile || '').includes(q));
  }, [parties, search]);

  const renderItem = ({ item }: any) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
      onPress={() => navigation.navigate('RoutePartyVisit', {
        partyId: item.id, partyName: item.name, mobile: item.mobile,
      })}
      activeOpacity={0.85}
    >
      <View style={[styles.avatar, { backgroundColor: colors.brandSoft }]}>
        <Text style={[styles.avatarText, { color: colors.brand }]}>{(item.name || 'P').charAt(0).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[styles.meta, { color: colors.subText }]} numberOfLines={1}>
          {[item.mobile, item.city].filter(Boolean).join(' · ') || '—'}
        </Text>
      </View>
      <Icon name="chevron-right" size={18} color={colors.subText} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />
      <AppHeader label="My Parties" />

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
        <View style={styles.center}><Text style={[styles.meta, { color: colors.subText }]}>Loading…</Text></View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Icon name="account-off-outline" size={42} color={colors.border} />
          <Text style={[styles.meta, { color: colors.subText }]}>No parties found.</Text>
        </View>
      ) : (
        <DynamicFlashList
          data={filtered}
          renderItem={renderItem}
          estimatedItemSize={72}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
  listContent: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 30 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 16, fontFamily: FONTS.bold },
  name: { fontSize: 14, fontFamily: FONTS.semiBold },
  meta: { fontSize: 12, fontFamily: FONTS.regular, marginTop: 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
});
