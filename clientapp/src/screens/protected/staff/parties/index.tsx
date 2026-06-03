import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, TextInput } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { COLORS, FONTS, useTheme } from '../../../../config';
import { BackHeader, DynamicFlashList } from '../../../../components';
import { GET_ACCOUNTS } from '../../../../apollo/queries/accounts';
import type { RootState } from '../../../../store/rootreducer';

function avatarLetter(name: string) {
  return name?.trim().charAt(0).toUpperCase() ?? '?';
}

function avatarColor(name: string) {
  const colors = ['#6366f1','#f59e0b','#22c55e','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

export default function StaffParties() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const tenant  = useSelector((s: RootState) => s.tenant);
  const adminid = tenant.adminId ?? '';

  const [search, setSearch] = useState('');

  const { data } = useQuery(GET_ACCOUNTS, {
    variables: { admin: adminid },
    skip: !adminid,
  });

  // Use ONLY real accounts. Dummy accounts have non-ObjectId ids (e.g. "ac1"),
  // which break order placement ("Cast to ObjectId failed for value ...").
  const accounts = (data?.getAccounts ?? []) as any[];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a: any) =>
      a.name?.toLowerCase().includes(q) || a.mobile?.includes(q) || a.city?.toLowerCase().includes(q)
    );
  }, [accounts, search]);

  const renderItem = ({ item, index }: any) => {
    const ac  = avatarColor(item.name ?? '');
    const ltr = avatarLetter(item.name ?? '');
    return (
      <Animated.View entering={FadeInUp.duration(300).delay(index * 30)}>
        <View style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: ac + '22', borderColor: ac + '44' }]}>
            <Text style={[styles.avatarText, { color: ac }]}>{ltr}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.partyName, { color: colors.text }]}>{item.name}</Text>
            <View style={styles.metaRow}>
              <Icon name="phone-outline" size={11} color={colors.subText} />
              <Text style={[styles.meta, { color: colors.subText }]}>{item.mobile}</Text>
              {item.city ? (
                <>
                  <View style={styles.dot} />
                  <Icon name="map-marker-outline" size={11} color={colors.subText} />
                  <Text style={[styles.meta, { color: colors.subText }]}>{item.city}</Text>
                </>
              ) : null}
            </View>
            {item.accountcode ? (
              <Text style={[styles.code, { color: colors.subText }]}>{item.accountcode}</Text>
            ) : null}
          </View>
          <TouchableOpacity
            style={[styles.orderBtn, { backgroundColor: colors.brand }]}
            onPress={() => navigation.navigate('StaffCatalog', { partyId: item.id, partyName: item.name })}
            activeOpacity={0.82}
          >
            <Icon name="clipboard-plus-outline" size={14} color="#fff" />
            <Text style={styles.orderBtnText}>Order</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

      <BackHeader label="Parties" />

      {/* search */}
      <View style={[styles.searchWrap, { backgroundColor: colors.raisedSurface, borderColor: colors.border }]}>
        <Icon name="magnify" size={18} color={colors.subText} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search by name, mobile or city…"
          placeholderTextColor={colors.subText}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="close-circle" size={16} color={colors.subText} />
          </TouchableOpacity>
        )}
      </View>

      <DynamicFlashList
        data={filtered}
        renderItem={renderItem}
        estimatedItemSize={80}
        keyExtractor={(item: any) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Icon name="account-search-outline" size={44} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.subText }]}>No parties found</Text>
          </View>
        }
      />

      {/* FAB — Add Party */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.brand }]}
        onPress={() => navigation.navigate('StaffCreateParty')}
        activeOpacity={0.88}
      >
        <Icon name="plus" size={22} color="#fff" />
        <Text style={styles.fabText}>Add Party</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  searchWrap:  {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 18, marginTop: 10, marginBottom: 6,
    borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 13, fontFamily: FONTS.regular, paddingVertical: 0 },
  listContent: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 100 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10,
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  avatar:     { width: 42, height: 42, borderRadius: 14, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 17, fontFamily: FONTS.bold },
  partyName:  { fontSize: 14, fontFamily: FONTS.bold, marginBottom: 3 },
  metaRow:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta:       { fontSize: 11, fontFamily: FONTS.regular },
  dot:        { width: 3, height: 3, borderRadius: 2, backgroundColor: '#aaa' },
  code:       { fontSize: 10, fontFamily: FONTS.regular, marginTop: 3 },
  orderBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  orderBtnText: { fontSize: 12, fontFamily: FONTS.bold, color: '#fff' },
  fab: {
    position: 'absolute', bottom: 28, right: 20,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 14, borderRadius: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 6,
  },
  fabText:   { fontSize: 14, fontFamily: FONTS.bold, color: '#fff' },
  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: FONTS.regular },
});
