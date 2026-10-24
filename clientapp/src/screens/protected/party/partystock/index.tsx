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

  const renderItem = ({ item }: any) => {
    const qty = Number(item.qty) || 0;
    return (
      <View style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
        <View style={[styles.icon, { backgroundColor: colors.brandSoft }]}>
          <Icon name="package-variant-closed" size={18} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{item.productname}</Text>
          <Text style={[styles.meta, { color: colors.subText }]} numberOfLines={1}>
            {[item.variantname, item.productcode].filter(Boolean).join(' · ') || '—'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.qty, { color: qty < 0 ? '#ef4444' : colors.text }]}>{qty.toLocaleString('en-IN')}</Text>
          <Text style={[styles.meta, { color: colors.subText }]}>{item.unitname || 'units'}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />
      <BackHeader label={partyName ? `${partyName} — Stock` : 'My Stock'} />

      <View style={[styles.summary, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.brand }]}>{inStock}</Text>
          <Text style={[styles.meta, { color: colors.subText }]}>Products in stock</Text>
        </View>
        <View style={[styles.sep, { backgroundColor: colors.border }]} />
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: '#3b82f6' }]}>{all.length}</Text>
          <Text style={[styles.meta, { color: colors.subText }]}>Products</Text>
        </View>
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

      {loading && !data ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.brand} /></View>
      ) : (
        <DynamicFlashList
          data={rows}
          renderItem={renderItem}
          keyExtractor={(item: any) => item.id}
          estimatedItemSize={70}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <Icon name="package-variant" size={44} color={colors.border} />
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
  summary: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 18, marginTop: 12, marginBottom: 10,
    borderRadius: 16, borderWidth: 1, paddingVertical: 12,
  },
  stat: { flex: 1, alignItems: 'center' },
  sep: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  statValue: { fontSize: 18, fontFamily: FONTS.bold },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 18, marginBottom: 8,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 12,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, fontFamily: FONTS.regular },
  list: { paddingHorizontal: 18, paddingBottom: 40, paddingTop: 4 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10,
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 14, fontFamily: FONTS.bold },
  meta: { fontSize: 12, fontFamily: FONTS.regular, textAlign: 'center' },
  qty: { fontSize: 16, fontFamily: FONTS.bold },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 24 },
});
