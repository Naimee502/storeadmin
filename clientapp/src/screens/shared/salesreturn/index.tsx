import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, TextInput, FlatList, RefreshControl, ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { FONTS, useTheme } from '../../../config';
import { BackHeader } from '../../../components';
import { GET_MY_SALES_RETURNS, GET_RETURNABLE_SALES_INVOICES } from '../../../apollo/queries/salesreturn';
import type { RootState } from '../../../store/rootreducer';

const inr = (n: number) => `₹${(Math.round((n || 0) * 100) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d?: string) => {
  if (!d) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : d;
};

/**
 * Drawer → Sales Returns (salesman / delivery boy).
 *   My Returns : credit notes this user has booked
 *   New Return : pick one of his invoices that still has something returnable,
 *                then tick the items on the next screen
 * The quickest route is still the "Sales Return" button on an order; this is
 * for goods handed back when that order isn't the one on screen.
 */
export default function SalesReturns() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const adminid = useSelector((s: RootState) => s.tenant.adminId) ?? '';
  const [tab, setTab] = useState<'mine' | 'new'>('mine');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const mine = useQuery(GET_MY_SALES_RETURNS, {
    variables: { adminid },
    skip: !adminid,
    fetchPolicy: 'cache-and-network',
  });
  const invoices = useQuery(GET_RETURNABLE_SALES_INVOICES, {
    variables: { search: debounced || undefined },
    skip: tab !== 'new',
    fetchPolicy: 'cache-and-network',
  });

  useFocusEffect(useCallback(() => { mine.refetch?.(); }, [mine.refetch]));

  const returns = [...((mine.data as any)?.getSalesReturns ?? [])].sort(
    (a: any, b: any) => String(b.createdAt || b.returndate).localeCompare(String(a.createdAt || a.returndate)),
  );
  const invList = (invoices.data as any)?.getReturnableSalesInvoices ?? [];

  const Seg = ({ id, label }: { id: 'mine' | 'new'; label: string }) => {
    const on = tab === id;
    return (
      <TouchableOpacity
        style={[styles.segBtn, on && { backgroundColor: colors.brand }]}
        onPress={() => setTab(id)}
        activeOpacity={0.85}
      >
        <Text style={[styles.segText, { color: on ? colors.onBrand : colors.text }]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />
      <BackHeader label="Sales Returns" />

      <View style={styles.body}>
        <View style={[styles.seg, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
          <Seg id="mine" label="My Returns" />
          <Seg id="new" label="+ New Return" />
        </View>

        {tab === 'mine' ? (
          <FlatList
            data={returns}
            keyExtractor={(r: any) => r.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={!!mine.loading} onRefresh={() => mine.refetch?.()} />}
            ListEmptyComponent={
              mine.loading ? null : (
                <View style={styles.empty}>
                  <Icon name="keyboard-return" size={40} color={colors.subText} />
                  <Text style={[styles.muted, { color: colors.subText }]}>No returns booked yet.</Text>
                  <TouchableOpacity onPress={() => setTab('new')}>
                    <Text style={[styles.link, { color: colors.brand }]}>Book a return</Text>
                  </TouchableOpacity>
                </View>
              )
            }
            renderItem={({ item: r }: any) => {
              const items = (r.productservice ?? []).length;
              return (
                <View style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
                  <View style={styles.rowBetween}>
                    <Text style={[styles.title, { color: colors.text, flex: 1, marginRight: 8 }]} numberOfLines={1}>
                      {r.billnumber || 'Return'}
                      {!!r.partyacc?.accountname && <Text style={[styles.party, { color: colors.subText }]}>  ·  {r.partyacc.accountname}</Text>}
                    </Text>
                    <Text style={[styles.amount, { color: '#ef4444' }]}>{inr(r.totalamount)}</Text>
                  </View>
                  <View style={[styles.rowBetween, { marginTop: 2 }]}>
                    <Text style={[styles.muted, { color: colors.subText, flex: 1 }]} numberOfLines={1}>
                      {fmtDate(r.returndate)}
                      {r.sourceBillNumber ? ` · INV-${r.sourceBillNumber}` : ''}
                      {r.sourceOrderNumber ? ` (SO-${r.sourceOrderNumber})` : ''}
                      {` · ${items} item${items === 1 ? '' : 's'}`}
                    </Text>
                    {!!r.reason && (
                      <View style={[styles.badge, { backgroundColor: colors.brandSoft }]}>
                        <Text style={[styles.badgeText, { color: colors.brand }]}>{r.reason}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            }}
          />
        ) : (
          <>
            <View style={[styles.search, { borderColor: colors.border, backgroundColor: colors.cardGlass }]}>
              <Icon name="magnify" size={18} color={colors.subText} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search party, INV or SO no."
                placeholderTextColor={colors.subText}
                style={[styles.searchInput, { color: colors.text }]}
              />
              {invoices.loading && <ActivityIndicator size="small" color={colors.brand} />}
            </View>
            <FlatList
              data={invList}
              keyExtractor={(i: any) => i.id}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                invList.length > 0 ? (
                  <Text style={[styles.muted, { color: colors.subText, marginBottom: 4 }]}>Pick the invoice the goods were sold on</Text>
                ) : null
              }
              ListEmptyComponent={
                invoices.loading ? null : (
                  <View style={styles.empty}>
                    <Icon name="file-search-outline" size={40} color={colors.subText} />
                    <Text style={[styles.muted, { color: colors.subText }]}>
                      {debounced ? 'No matching invoices.' : 'No invoices with items left to return.'}
                    </Text>
                  </View>
                )
              }
              renderItem={({ item: inv }: any) => (
                <TouchableOpacity
                  style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
                  onPress={() => navigation.navigate('SalesReturnCreate', { invoiceId: inv.id })}
                  activeOpacity={0.85}
                >
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <View style={styles.titleRow}>
                        <Text style={[styles.title, { color: colors.text }]}>INV-{inv.billnumber}</Text>
                        {!!inv.orderNumber && (
                          <View style={[styles.soTag, { backgroundColor: colors.brandSoft }]}>
                            <Text style={[styles.soText, { color: colors.brand }]}>SO-{inv.orderNumber}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.muted, { color: colors.subText }]} numberOfLines={1}>
                        {inv.partyName ? `${inv.partyName} · ` : ''}{fmtDate(inv.billdate)} · {inv.returnableQty} qty returnable
                      </Text>
                    </View>
                    <Text style={[styles.amount, { color: colors.text }]}>{inr(inv.totalamount)}</Text>
                    <Icon name="chevron-right" size={20} color={colors.subText} />
                  </View>
                </TouchableOpacity>
              )}
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 18 },
  seg: { flexDirection: 'row', borderWidth: 1, borderRadius: 12, padding: 3, marginTop: 10 },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 9 },
  segText: { fontSize: 13, fontFamily: FONTS.semiBold },
  list: { paddingBottom: 40, paddingTop: 4 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, marginTop: 8 },
  searchInput: { flex: 1, paddingVertical: 7, fontSize: 13, fontFamily: FONTS.regular },
  card: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, marginTop: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 14, fontFamily: FONTS.bold },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  soTag: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  soText: { fontSize: 11, fontFamily: FONTS.semiBold },
  amount: { fontSize: 14, fontFamily: FONTS.bold, marginRight: 2 },
  party: { fontSize: 13, fontFamily: FONTS.medium },
  muted: { fontSize: 12, fontFamily: FONTS.regular, marginTop: 2 },
  link: { fontSize: 13, fontFamily: FONTS.semiBold, marginTop: 4 },
  empty: { alignItems: 'center', gap: 8, paddingTop: 60 },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 },
  badgeText: { fontSize: 11, fontFamily: FONTS.semiBold },
});
