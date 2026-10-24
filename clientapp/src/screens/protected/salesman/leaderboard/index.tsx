import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, StatusBar, RefreshControl } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { COLORS, FONTS, useTheme } from '../../../../config';
import { BackHeader } from '../../../../components';
import { GET_SALESMAN_LEADERBOARD } from '../../../../apollo/queries/salesmanreport';
import { localYMD } from '../../../../utils/geo';
import type { RootState } from '../../../../store/rootreducer';

// Team leaderboard: every salesman's monthly target vs achievement, ranked by
// % of target achieved (then order value). Same server figures as the admin
// Salesman Field Report.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MEDAL = ['#f5b301', '#9ca3af', '#c27c3e'];
const inr0 = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
const shiftMonth = (ym: string, d: number) => {
  const dt = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + d, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
};

export default function SalesmanLeaderboard() {
  const { colors, isDark } = useTheme();
  const adminid = useSelector((s: RootState) => s.tenant.adminId) ?? '';
  const userId = useSelector((s: RootState) => s.auth.user?.id);
  const thisMonth = localYMD().slice(0, 7);
  const [month, setMonth] = useState(thisMonth);

  const { data, loading, refetch } = useQuery(GET_SALESMAN_LEADERBOARD, {
    variables: { adminid, month, salesmanid: userId },
    skip: !adminid,
    fetchPolicy: 'cache-and-network',
  });
  useFocusEffect(useCallback(() => { refetch?.(); }, [refetch]));

  const enabled = (data as any)?.getSalesmanLeaderboard?.enabled !== false;
  const rows: any[] = (data as any)?.getSalesmanLeaderboard?.rows ?? [];
  const me = rows.find((r) => r.isMe);
  const label = `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
  const isCurrent = month === thisMonth;

  const pctColor = (r: any) => !r.monthTarget ? colors.subText
    : r.monthAchievedPct >= 100 ? '#16a34a' : r.monthAchievedPct >= 60 ? colors.brand : r.monthAchievedPct >= 30 ? '#f59e0b' : '#ef4444';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />
      <BackHeader label="Team Leaderboard" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading && rows.length > 0} onRefresh={() => refetch?.()} />}
      >
        {/* Month switcher */}
        <View style={[styles.monthBar, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
          <Pressable onPress={() => setMonth(shiftMonth(month, -1))} hitSlop={10}>
            <Icon name="chevron-left" size={22} color={colors.brand} />
          </Pressable>
          <Text style={[styles.monthText, { color: colors.text }]}>{label}{isCurrent ? ' · so far' : ''}</Text>
          <Pressable onPress={() => !isCurrent && setMonth(shiftMonth(month, 1))} hitSlop={10} disabled={isCurrent}>
            <Icon name="chevron-right" size={22} color={isCurrent ? colors.border : colors.brand} />
          </Pressable>
        </View>

        {/* My position */}
        {me && (
          <Animated.View entering={FadeInUp.duration(350)} style={[styles.meCard, { backgroundColor: colors.brand }]}>
            <View>
              <Text style={[styles.meSmall, { color: colors.onBrand }]}>Your rank</Text>
              <Text style={[styles.meRank, { color: colors.onBrand }]}>#{me.rank}<Text style={styles.meOf}> of {rows.length}</Text></Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.meSmall, { color: colors.onBrand }]}>{me.monthTarget ? 'Target achieved' : 'Order value'}</Text>
              <Text style={[styles.meRank, { color: colors.onBrand }]}>
                {me.monthTarget ? `${Math.round(me.monthAchievedPct)}%` : inr0(me.monthAchieved)}
              </Text>
            </View>
          </Animated.View>
        )}

        {!enabled && (
          <View style={styles.empty}>
            <Icon name="lock-outline" size={44} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.subText }]}>The team leaderboard is turned off by your company.</Text>
          </View>
        )}

        {enabled && rows.length === 0 && !loading && (
          <View style={styles.empty}>
            <Icon name="trophy-outline" size={44} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.subText }]}>No data for {label}.</Text>
          </View>
        )}

        {rows.map((r, i) => {
          const pct = Math.min(100, Math.max(0, r.monthAchievedPct));
          const pc = pctColor(r);
          return (
            <Animated.View
              key={r.salesmanid}
              entering={FadeInUp.duration(300).delay(Math.min(i, 8) * 40)}
              style={[
                styles.row,
                { backgroundColor: colors.cardGlass, borderColor: r.isMe ? colors.brand : colors.border, borderWidth: r.isMe ? 1.5 : 1 },
              ]}
            >
              <View style={[styles.rankBadge, { backgroundColor: r.rank <= 3 ? MEDAL[r.rank - 1] : colors.raisedSurface }]}>
                {r.rank <= 3
                  ? <Icon name="trophy" size={16} color="#fff" />
                  : <Text style={[styles.rankText, { color: colors.subText }]}>{r.rank}</Text>}
              </View>

              <View style={{ flex: 1 }}>
                <View style={styles.rowTop}>
                  <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                    {r.salesmanname}{r.isMe ? ' (You)' : ''}
                  </Text>
                  <Text style={[styles.pct, { color: pc }]}>{r.monthTarget ? `${Math.round(r.monthAchievedPct)}%` : '—'}</Text>
                </View>

                <View style={[styles.track, { backgroundColor: colors.border }]}>
                  <View style={{ width: `${pct}%`, height: '100%', backgroundColor: pc, borderRadius: 4 }} />
                </View>

                <View style={styles.metaRow}>
                  <Text style={[styles.meta, { color: colors.subText }]} numberOfLines={1}>
                    {inr0(r.monthAchieved)}{r.monthTarget ? ` / ${inr0(r.monthTarget)}` : ' · no target'}
                  </Text>
                  <Text style={[styles.meta, { color: colors.subText }]} numberOfLines={1}>
                    {r.orders} orders · {Math.round(r.productivityPct)}% productive
                  </Text>
                </View>
              </View>
            </Animated.View>
          );
        })}

        <Text style={[styles.note, { color: colors.subText }]}>
          Ranked by % of monthly target achieved, then by order value. Cancelled orders are not counted.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll:    { paddingHorizontal: 18, paddingBottom: 40, paddingTop: 12 },
  monthBar:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  monthText: { fontSize: 14, fontFamily: FONTS.bold },
  meCard:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 16, padding: 16, marginBottom: 14 },
  meSmall:   { fontSize: 11.5, fontFamily: FONTS.regular, opacity: 0.85 },
  meRank:    { fontSize: 24, fontFamily: FONTS.bold, marginTop: 2 },
  meOf:      { fontSize: 13, fontFamily: FONTS.regular },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 12, marginBottom: 10,
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  rankBadge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  rankText:  { fontSize: 14, fontFamily: FONTS.bold },
  rowTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  name:      { flex: 1, fontSize: 14, fontFamily: FONTS.bold },
  pct:       { fontSize: 14, fontFamily: FONTS.bold },
  track:     { height: 6, borderRadius: 4, overflow: 'hidden', marginTop: 7 },
  metaRow:   { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 6 },
  meta:      { fontSize: 11, fontFamily: FONTS.regular, flexShrink: 1 },
  empty:     { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 13, fontFamily: FONTS.regular },
  note:      { fontSize: 11, fontFamily: FONTS.regular, textAlign: 'center', marginTop: 8 },
});
