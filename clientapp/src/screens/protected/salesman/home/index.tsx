import React, { useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { COLORS, FONTS, useTheme } from '../../../../config';
import { AppHeader, useNotificationCenter } from '../../../../components';
import { formatINR } from '../../../../utils';
import { GET_SALESMAN_DASHBOARD, GET_SALESMAN_LEADERBOARD } from '../../../../apollo/queries/salesmanreport';
import { localYMD } from '../../../../utils/geo';
import { useLeaderboardEnabled } from '../../../../apollo/hooks/adminsettings';
import { GET_ACCOUNTS, GET_SALES_ORDERS } from '../../../../apollo/queries/accounts';
import { usePunchGate } from '../../../../apollo/hooks/attendance';
import { usePaymentsEnabled } from '../../../../apollo/hooks/admin';
import type { RootState } from '../../../../store/rootreducer';

// Call outcome colours (same meaning as the admin Salesman Field Report).
const CALL = {
  productive:   { color: '#16a34a', label: 'Productive' },
  unproductive: { color: '#f59e0b', label: 'No order' },
  missed:       { color: '#ef4444', label: 'Missed' },
  pending:      { color: '#9ca3af', label: 'Pending' },
};
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SalesmanDashboard() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const paymentsEnabled = usePaymentsEnabled();
  const user   = useSelector((s: RootState) => s.auth.user);
  const tenant = useSelector((s: RootState) => s.tenant);
  const adminid = tenant.adminId ?? '';
  const { blocked: punchBlocked } = usePunchGate();
  const { bellIcon, NotificationsModal } = useNotificationCenter();

  // Require punch-in before going to Route / Parties / an order (any visit/order work).
  const goWithPunch = (screen: string, params?: any) => {
    if (punchBlocked) {
      Alert.alert(
        'Punch in required',
        'Please punch in from the Attendance tab before starting your visits.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go to Attendance', onPress: () => navigation.navigate('SalesmanAttendance') },
        ],
      );
      return;
    }
    navigation.navigate(screen, params);
  };

  // Everything on this screen comes from the server dashboard (same rules as
  // the admin Salesman Field Report): today's calls, this month's target and
  // the last 7 days.
  const { data, refetch } = useQuery(GET_SALESMAN_DASHBOARD, {
    variables: { adminid, salesmanid: user?.id, date: localYMD() },
    skip: !adminid || !user?.id,
    fetchPolicy: 'cache-and-network',
  });
  const { data: partyData, refetch: refetchParties } = useQuery(GET_ACCOUNTS, {
    variables: { admin: adminid, salesmanid: user?.id },
    skip: !adminid || !user?.id,
    fetchPolicy: 'cache-and-network',
  });

  // My rank this month (team leaderboard) + my orders still awaiting confirmation.
  const { data: lbData, refetch: refetchLb } = useQuery(GET_SALESMAN_LEADERBOARD, {
    variables: { adminid, salesmanid: user?.id },
    skip: !adminid || !user?.id,
    fetchPolicy: 'cache-and-network',
  });
  const { data: ordData, refetch: refetchOrd } = useQuery(GET_SALES_ORDERS, {
    variables: { adminid, salesmenid: user?.id },
    skip: !adminid || !user?.id,
    fetchPolicy: 'cache-and-network',
  });

  useFocusEffect(useCallback(() => {
    refetch?.(); refetchParties?.(); refetchLb?.(); refetchOrd?.();
  }, [refetch, refetchParties, refetchLb, refetchOrd]));

  const leaderboardOn = useLeaderboardEnabled();
  const lbRows: any[] = (lbData as any)?.getSalesmanLeaderboard?.rows ?? [];
  const myRank = lbRows.find((r) => r.isMe)?.rank;
  const pendingOrders = useMemo(
    () => ((ordData as any)?.getSalesOrders ?? []).filter((o: any) => !o.isConverted && o.cancelStatus !== 'cancelled').length,
    [ordData],
  );

  const dash  = (data as any)?.getSalesmanDashboard;
  const today = dash?.today;
  const month = dash?.month;
  const last7: any[] = dash?.last7 ?? [];

  const parties = useMemo(() => (partyData as any)?.getAccounts ?? [], [partyData]);
  const totalOutstanding = useMemo(
    () => parties.reduce((s: number, p: any) => s + Math.max(0, p.outstanding || 0), 0),
    [parties],
  );

  // Whole rupees with Indian grouping (₹5,00,000) — decimals only add noise here.
  const inr0 = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
  const hasPlan = (today?.plannedCalls ?? 0) > 0;
  const targetPct = Math.min(100, Math.max(0, month?.monthAchievedPct ?? 0));
  const targetColor = (month?.monthAchievedPct ?? 0) >= 100 ? '#16a34a' : targetPct >= 60 ? colors.brand : targetPct >= 30 ? '#f59e0b' : '#ef4444';
  const maxCalls = Math.max(1, ...last7.map((d) => d.productive + d.unproductive + d.missed + d.pending));
  const weekAmount = last7.reduce((s, d) => s + (d.amount || 0), 0);
  const weekProductive = last7.reduce((s, d) => s + (d.productive || 0), 0);
  const weekCalls = last7.reduce((s, d) => s + (d.productive || 0) + (d.unproductive || 0), 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

      <AppHeader label={`Hello, ${user?.name?.split(' ')[0] ?? 'Salesman'}`} rightIcons={[bellIcon]} />
      {NotificationsModal}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Today summary — clean card, brand only as accent */}
        <Animated.View
          entering={FadeInUp.duration(400).delay(50)}
          style={[styles.todayCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
        >
          <View style={styles.todayHalf}>
            <View style={styles.todayLabelRow}>
              <Icon name="trending-up" size={13} color={colors.brand} />
              <Text style={[styles.todayLabel, { color: colors.subText }]}>Sales today</Text>
            </View>
            <Text style={[styles.todayValue, { color: colors.text }]} numberOfLines={1}>{formatINR(today?.orderAmount ?? 0)}</Text>
          </View>
          {paymentsEnabled && (
            <>
              <View style={[styles.todayVDivider, { backgroundColor: colors.border }]} />
              <View style={styles.todayHalf}>
                <View style={styles.todayLabelRow}>
                  <Icon name="cash-check" size={13} color="#16a34a" />
                  <Text style={[styles.todayLabel, { color: colors.subText }]}>Collected</Text>
                </View>
                <Text style={[styles.todayValue, { color: '#16a34a' }]} numberOfLines={1}>{formatINR(today?.collections ?? 0)}</Text>
              </View>
            </>
          )}
        </Animated.View>

        {/* Compact stat strip */}
        <Animated.View
          entering={FadeInUp.duration(400).delay(90)}
          style={[styles.statStrip, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
        >
          {[
            ...(leaderboardOn ? [{ value: myRank ? `#${myRank}/${lbRows.length}` : '—', label: 'My Rank', color: '#f59e0b', onPress: () => navigation.navigate('SalesmanLeaderboard') }] : []),
            { value: String(pendingOrders), label: 'Pending Orders', color: '#3b82f6', onPress: () => goWithPunch('SalesmanOrders') },
            ...(paymentsEnabled ? [{ value: inr0(totalOutstanding), label: 'To Collect', color: '#ef4444', onPress: undefined }] : []),
            { value: String(parties.length), label: 'Parties', color: '#8b5cf6', onPress: () => goWithPunch('SalesmanParties') },
          ].map((s, i) => (
            <React.Fragment key={s.label}>
              {i > 0 && <View style={[styles.stripDivider, { backgroundColor: colors.border }]} />}
              <TouchableOpacity style={styles.stripItem} onPress={s.onPress} disabled={!s.onPress} activeOpacity={0.7}>
                <Text style={[styles.stripValue, { color: s.color }]} numberOfLines={1} adjustsFontSizeToFit>{s.value}</Text>
                <Text style={[styles.stripLabel, { color: colors.subText }]} numberOfLines={1}>{s.label}</Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </Animated.View>

        {/* Today's calls */}
        <Animated.View entering={FadeInUp.duration(400).delay(100)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Today's Calls</Text>
          <View style={[styles.perfCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
            <View style={styles.callsRow}>
              {[
                // No route planned today (or the business doesn't use routes):
                // show visits instead of planned / remaining.
                ...(hasPlan ? [{ k: 'planned', v: today.plannedCalls, l: 'Planned', c: colors.text }]
                            : [{ k: 'visits', v: today?.totalCalls ?? 0, l: 'Visits', c: colors.text }]),
                { k: 'productive', v: today?.productiveCalls ?? 0, l: CALL.productive.label, c: CALL.productive.color },
                { k: 'unproductive', v: today?.unproductiveCalls ?? 0, l: CALL.unproductive.label, c: CALL.unproductive.color },
                ...(hasPlan ? [{ k: 'pending', v: today.pendingCalls, l: 'Remaining', c: CALL.pending.color }]
                            : [{ k: 'productivity', v: `${Math.round(today?.productivityPct ?? 0)}%`, l: 'Productivity', c: '#3b82f6' }]),
              ].map((x, i) => (
                <React.Fragment key={x.k}>
                  {i > 0 && <View style={[styles.stripDivider, { backgroundColor: colors.border }]} />}
                  <View style={styles.callCell}>
                    <Text style={[styles.callValue, { color: x.c }]} numberOfLines={1}>{x.v}</Text>
                    <Text style={[styles.callLabel, { color: colors.subText }]} numberOfLines={1}>{x.l}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
            {(today?.plannedCalls ?? 0) > 0 && (
              <View style={[styles.stackBar, { backgroundColor: colors.border }]}>
                {(['productive', 'unproductive', 'pending'] as const).map((k) => {
                  const v = k === 'productive' ? today.productiveCalls : k === 'unproductive' ? today.unproductiveCalls : today.pendingCalls;
                  return v ? <View key={k} style={{ flex: v, backgroundColor: CALL[k].color }} /> : null;
                })}
              </View>
            )}
            {hasPlan && (
              <View style={[styles.footRow, { borderTopColor: colors.border }]}>
                <Icon name="map-marker-check-outline" size={13} color={colors.subText} />
                <Text style={[styles.footText, { color: colors.subText }]} numberOfLines={1}>
                  {`Route covered ${Math.round(today?.coveragePct ?? 0)}%${(today?.offRouteCalls ?? 0) > 0 ? ` · ${today.offRouteCalls} off-route` : ''}`}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Today's Route */}
        <Animated.View entering={FadeInUp.duration(400).delay(120)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Today's Route</Text>
          <TouchableOpacity
            style={[styles.routeCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
            onPress={() => goWithPunch('SalesmanRoutes')}
            activeOpacity={0.82}
          >
            <View style={[styles.routeIconWrap, { backgroundColor: colors.brandSoft }]}>
              <Icon name="map-marker-path" size={24} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.routeName, { color: colors.text }]}>View My Route</Text>
              <Text style={[styles.routeCode, { color: colors.subText }]}>Tap to see today's stops</Text>
            </View>
            <Icon name="chevron-right" size={18} color={colors.subText} style={{ marginLeft: 8 }} />
          </TouchableOpacity>

          {/* Direct (route-less) ordering — pick any party from your channel */}
          <TouchableOpacity
            style={[styles.routeCard, { backgroundColor: colors.cardGlass, borderColor: colors.border, marginTop: 10 }]}
            onPress={() => goWithPunch('SalesmanParties')}
            activeOpacity={0.82}
          >
            <View style={[styles.routeIconWrap, { backgroundColor: colors.brandSoft }]}>
              <Icon name="account-group-outline" size={24} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.routeName, { color: colors.text }]}>All Parties</Text>
              <Text style={[styles.routeCode, { color: colors.subText }]}>Take an order without a route</Text>
            </View>
            <Icon name="chevron-right" size={18} color={colors.subText} style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </Animated.View>

        {/* Monthly target */}
        <Animated.View entering={FadeInUp.duration(400).delay(110)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Monthly Target</Text>
            {leaderboardOn && (
              <TouchableOpacity onPress={() => navigation.navigate('SalesmanLeaderboard')}>
                <Text style={[styles.viewAll, { color: colors.brand }]}>Leaderboard</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={[styles.perfCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
            {month?.monthTarget ? (
              <>
                <View style={styles.callsRow}>
                  {[
                    { k: 'ach', l: 'Achieved', v: inr0(month.monthAchieved), c: colors.text },
                    { k: 'tgt', l: 'Target', v: inr0(month.monthTarget), c: colors.brand },
                    { k: 'rem', l: month.monthAchievedPct >= 100 ? 'Extra' : 'To go', v: inr0(month.monthAchievedPct >= 100 ? month.monthAchieved - month.monthTarget : month.monthRemaining), c: month.monthAchievedPct >= 100 ? '#16a34a' : '#ef4444' },
                  ].map((x, i) => (
                    <React.Fragment key={x.k}>
                      {i > 0 && <View style={[styles.stripDivider, { backgroundColor: colors.border }]} />}
                      <View style={styles.callCell}>
                        <Text style={[styles.targetVal, { color: x.c }]} numberOfLines={1} adjustsFontSizeToFit>{x.v}</Text>
                        <Text style={[styles.callLabel, { color: colors.subText }]}>{x.l}</Text>
                      </View>
                    </React.Fragment>
                  ))}
                </View>
                <View style={styles.progressRow}>
                  <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                    <View style={{ width: `${targetPct}%`, backgroundColor: targetColor, height: '100%', borderRadius: 5 }} />
                  </View>
                  <Text style={[styles.targetPct, { color: targetColor }]}>{Math.round(month.monthAchievedPct)}%</Text>
                </View>
              </>
            ) : (
              <Text style={[styles.perfFoot, { color: colors.subText }]}>
                No target set for you yet. This month: {formatINR(month?.monthAchieved ?? 0)} booked.
              </Text>
            )}
          </View>
        </Animated.View>

        {/* Last 7 days */}
        <Animated.View entering={FadeInUp.duration(400).delay(115)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Last 7 Days</Text>
            <TouchableOpacity onPress={() => goWithPunch('SalesmanOrders')}>
              <Text style={[styles.viewAll, { color: colors.brand }]}>My orders</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.perfCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
            <View style={styles.weekTop}>
              <View>
                <Text style={[styles.callLabel, { color: colors.subText }]}>Order value</Text>
                <Text style={[styles.weekVal, { color: colors.text }]}>{formatINR(weekAmount)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.callLabel, { color: colors.subText }]}>Productive calls</Text>
                <Text style={[styles.weekVal, { color: CALL.productive.color }]}>{weekProductive}/{weekCalls}</Text>
              </View>
            </View>
            <View style={styles.chart}>
              {last7.map((d) => {
                const total = d.productive + d.unproductive + d.missed + d.pending;
                const dow = DOW[new Date(`${d.date}T00:00:00`).getDay()];
                return (
                  <View key={d.date} style={styles.chartCol}>
                    <Text style={[styles.chartAmt, { color: colors.subText }]} numberOfLines={1}>
                      {d.amount ? (d.amount >= 1000 ? `${Math.round(d.amount / 1000)}k` : Math.round(d.amount)) : ''}
                    </Text>
                    <View style={styles.chartBarArea}>
                      <View style={[styles.chartBar, { height: `${(total / maxCalls) * 100}%` }]}>
                        {(['pending', 'missed', 'unproductive', 'productive'] as const).map((k) =>
                          d[k] ? <View key={k} style={{ flex: d[k], backgroundColor: CALL[k].color }} /> : null,
                        )}
                      </View>
                    </View>
                    <Text style={[styles.chartDay, { color: colors.subText }]}>{dow}</Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.legend}>
              {(['productive', 'unproductive', 'missed', 'pending'] as const).map((k) => (
                <View key={k} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: CALL[k].color }]} />
                  <Text style={[styles.legendText, { color: colors.subText }]}>{CALL[k].label}</Text>
                </View>
              ))}
            </View>
          </View>
        </Animated.View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll:    { paddingBottom: 110 },

  todayCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 18, marginTop: 14,
    borderRadius: 16, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 16,
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  todayHalf:      { flex: 1 },
  todayLabelRow:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  todayLabel:     { fontSize: 11.5, fontFamily: FONTS.regular },
  todayValue:     { fontSize: 20, fontFamily: FONTS.bold, marginTop: 3 },
  todayVDivider:  { width: 1, height: 38, marginHorizontal: 14 },

  statStrip: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 18, marginTop: 10,
    borderRadius: 16, borderWidth: 1, paddingVertical: 12,
  },
  stripItem:    { flex: 1, alignItems: 'center' },
  stripDivider: { width: 1, height: 26 },
  stripValue:   { fontSize: 14, fontFamily: FONTS.bold },
  stripLabel:   { fontSize: 10, fontFamily: FONTS.regular, marginTop: 3 },

  section:       { marginTop: 20, paddingHorizontal: 18 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle:  { fontSize: 15, fontFamily: FONTS.bold, marginBottom: 12 },
  viewAll:       { fontSize: 13, fontFamily: FONTS.semiBold },

  routeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 18, borderWidth: 1, padding: 14,
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  routeIconWrap: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  routeName:     { fontSize: 14, fontFamily: FONTS.bold },
  routeCode:     { fontSize: 12, fontFamily: FONTS.regular, marginTop: 2 },

  perfCard: {
    borderRadius: 16, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 12,
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  callsRow:      { flexDirection: 'row', alignItems: 'center' },
  callCell:      { flex: 1, alignItems: 'center' },
  callValue:     { fontSize: 18, fontFamily: FONTS.bold },
  callLabel:     { fontSize: 10.5, fontFamily: FONTS.regular, marginTop: 3 },
  footRow:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  footText:      { flex: 1, fontSize: 11.5, fontFamily: FONTS.regular },
  targetVal:     { fontSize: 15, fontFamily: FONTS.bold },
  progressRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  stackBar:      { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 12 },
  perfFoot:      { fontSize: 11.5, fontFamily: FONTS.regular, marginTop: 8 },
  targetTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  targetAch:     { fontSize: 20, fontFamily: FONTS.bold },
  targetPct:     { fontSize: 14, fontFamily: FONTS.bold, minWidth: 38, textAlign: 'right' },
  progressTrack: { flex: 1, height: 8, borderRadius: 5, overflow: 'hidden' },
  weekTop:       { flexDirection: 'row', justifyContent: 'space-between' },
  weekVal:       { fontSize: 16, fontFamily: FONTS.bold, marginTop: 2 },
  chart:         { flexDirection: 'row', alignItems: 'flex-end', height: 130, marginTop: 12, gap: 6 },
  chartCol:      { flex: 1, alignItems: 'center', height: '100%' },
  chartAmt:      { fontSize: 9, fontFamily: FONTS.regular, height: 12 },
  chartBarArea:  { flex: 1, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  chartBar:      { width: '70%', maxWidth: 22, borderRadius: 4, overflow: 'hidden', flexDirection: 'column', minHeight: 2 },
  chartDay:      { fontSize: 10, fontFamily: FONTS.regular, marginTop: 4 },
  legend:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10, justifyContent: 'center' },
  legendItem:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:     { width: 8, height: 8, borderRadius: 2 },
  legendText:    { fontSize: 10.5, fontFamily: FONTS.regular },

  emptyCard: { borderRadius: 16, borderWidth: 1, paddingVertical: 22, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { fontSize: 13, fontFamily: FONTS.regular },

  orderCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10,
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  statusDot:   { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  orderNum:    { fontSize: 13, fontFamily: FONTS.bold },
  orderParty:  { fontSize: 12, fontFamily: FONTS.regular, marginTop: 1 },
  orderDate:   { fontSize: 11, fontFamily: FONTS.regular, marginTop: 2 },
  orderAmt:    { fontSize: 13, fontFamily: FONTS.bold, marginBottom: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText:  { fontSize: 10, fontFamily: FONTS.semiBold },
});
