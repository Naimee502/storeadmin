import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, TextInput, ActivityIndicator } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { COLORS, FONTS, useTheme } from '../../../../config';
import { BackHeader, DynamicFlashList } from '../../../../components';
import { GET_PARTY_STOCK } from '../../../../apollo/queries/accounts';
import type { RootState } from '../../../../store/rootreducer';

/**
 * Party stock (Business Settings → "Track party stock"). Opened from the
 * drawer for the party's own stock, or from My Parties with a partyId for a
 * sub-party's stock. Quantities are in each product's base unit.
 */
export default function PartyStockScreen() {
  const route = useRoute<any>();
  const { colors, isDark } = useTheme();
  const user = useSelector((s: RootState) => s.auth.user);
  const partyId: string | undefined = route.params?.partyId ?? user?.id;
  const partyName: string | undefined = route.params?.partyName;
  const [q, setQ] = useState('');

  const { data, loading, refetch } = useQuery(GET_PARTY_STOCK, {
    variables: { partyid: partyId },
    skip: !partyId,
    fetchPolicy: 'cache-and-network',
  });
  useFocusEffect(useCallback(() => { refetch?.(); }, [refetch]));

  const all = ((data as any)?.getPartyStock ?? []) as any[];
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return !s ? all : all.filter((r) => [r.productname, r.variantname, r.productcode].some((x) => String(x || '').toLowerCase().includes(s)));
  }, [all, q]);
  const inStock = all.filter((r) => Number(r.qty) > 0).length;

  const stats = [
    { icon: 'check-circle-outline', value: inStock, label: 'Products in stock', color: '#22c55e' },
    { icon: 'package-variant-closed', value: all.length, label: 'Products', color: '#3b82f6' },
  ];

  const renderItem = ({ item }: any) => {
    const qty = Number(item.qty) || 0;
    return (
      <View style={[styles.row, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
        <View style={[styles.iconChip, { backgroundColor: colors.brandSoft }]}>
          <Icon name="package-variant-closed" size={18} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.line}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{item.productname}</Text>
            <Text style={[styles.qty, { color: qty < 0 ? '#ef4444' : colors.text }]}>{qty.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.line}>
            <Text style={[styles.sub, { color: colors.subText }]} numberOfLines={1}>
              {[item.variantname, item.productcode].filter(Boolean).join(' · ') || '—'}
            </Text>
            <View style={[styles.unitPill, { backgroundColor: colors.brandSoft }]}>
              <Text style={[styles.unitText, { color: colors.brand }]}>{item.unitname || 'units'}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />
      <BackHeader label={partyName ? `${partyName} — Stock` : 'My Stock'} />

      <View style={styles.statsRow}>
        {stats.map((stat) => (
          <View key={stat.label} style={[styles.statCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
            <View style={[styles.statIcon, { backgroundColor: stat.color + '18' }]}>
              <Icon name={stat.icon} size={16} color={stat.color} />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{stat.value}</Text>
            <Text style={[styles.statLabel, { color: colors.subText }]}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.search, { backgroundColor: colors.raisedSurface, borderColor: colors.border }]}>
        <Icon name="magnify" size={18} color={colors.subText} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search product or code"
          placeholderTextColor={colors.subText}
          style={[styles.searchInput, { color: colors.text }]}
        />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Stock Items</Text>
        <Text style={[styles.countText, { color: colors.subText }]}>{rows.length} item{rows.length !== 1 ? 's' : ''}</Text>
      </View>

      {loading && !data ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.brand} /></View>
      ) : (
        <DynamicFlashList
          data={rows}
          renderItem={renderItem}
          keyExtractor={(item: any) => item.id}
          estimatedItemSize={84}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <Icon name="package-variant" size={42} color={colors.border} />
              <Text style={[styles.meta, { color: colors.subText, marginTop: 8 }]}>
                {q ? 'No product matches your search' : 'No stock yet — it is added when an invoice is made for this party'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  statsRow: { flexDirection: 'row', gap: 10, marginHorizontal: 18, marginTop: 14, marginBottom: 12 },
  statCard: {
    flex: 1, borderRadius: 18, borderWidth: 1, padding: 14, alignItems: 'flex-start',
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  statIcon: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statValue: { fontSize: 14, fontFamily: FONTS.bold, marginBottom: 2 },
  statLabel: { fontSize: 10, fontFamily: FONTS.regular },

  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 18, marginBottom: 12,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 12,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 13, fontFamily: FONTS.regular },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 18, marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontFamily: FONTS.bold },
  countText: { fontSize: 12, fontFamily: FONTS.regular },

  list: { paddingHorizontal: 18, paddingBottom: 40 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 13, marginBottom: 10,
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  iconChip: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, fontSize: 13, lineHeight: 18, fontFamily: FONTS.bold },
  sub: { flex: 1, fontSize: 12, lineHeight: 16, fontFamily: FONTS.regular },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  qty: { fontSize: 14, lineHeight: 18, fontFamily: FONTS.bold, textAlign: 'right' },
  unitPill: { paddingHorizontal: 8, paddingVertical: 1, borderRadius: 10, alignSelf: 'center' },
  unitText: { fontSize: 10, lineHeight: 14, fontFamily: FONTS.semiBold, textAlign: 'center' },
  meta: { fontSize: 12, fontFamily: FONTS.regular, textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 24 },
});
