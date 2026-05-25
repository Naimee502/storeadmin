import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS, useTheme } from '../../../../config';
import { AppHeader, DynamicFlashList } from '../../../../components';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TODAY_DAY = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];

type VisitStatus = 'pending' | 'visited' | 'skipped';

const DUMMY_ROUTES = [
  {
    id: 'r1', routename: 'North Zone', routecode: 'RT001', status: true,
    dayWiseAccounts: [
      {
        day: 'Monday', accounts: [
          { id: 'a1', name: 'Mehta Traders',   mobile: '9876541001', outstanding: 12500, visitStatus: 'visited'  as VisitStatus },
          { id: 'a2', name: 'Patel General',   mobile: '9876541002', outstanding: 4200,  visitStatus: 'visited'  as VisitStatus },
          { id: 'a3', name: 'Gupta Kirana',    mobile: '9876541003', outstanding: 0,     visitStatus: 'pending'  as VisitStatus },
          { id: 'a4', name: 'Sharma Stores',   mobile: '9876541004', outstanding: 7800,  visitStatus: 'pending'  as VisitStatus },
          { id: 'a5', name: 'Singh Provision', mobile: '9876541005', outstanding: 2100,  visitStatus: 'skipped'  as VisitStatus },
        ],
      },
      {
        day: 'Thursday', accounts: [
          { id: 'a6', name: 'Shah Stores',     mobile: '9876541006', outstanding: 5500,  visitStatus: 'pending'  as VisitStatus },
          { id: 'a7', name: 'Modi Mart',       mobile: '9876541007', outstanding: 900,   visitStatus: 'pending'  as VisitStatus },
        ],
      },
    ],
  },
  {
    id: 'r2', routename: 'South Market', routecode: 'RT002', status: true,
    dayWiseAccounts: [
      {
        day: 'Tuesday', accounts: [
          { id: 'a8',  name: 'Iyer Provisions', mobile: '9876542001', outstanding: 3300, visitStatus: 'pending' as VisitStatus },
          { id: 'a9',  name: 'Nair Shop',        mobile: '9876542002', outstanding: 0,    visitStatus: 'pending' as VisitStatus },
        ],
      },
      {
        day: 'Friday', accounts: [
          { id: 'a10', name: 'Pillai Traders',  mobile: '9876542003', outstanding: 6700, visitStatus: 'pending' as VisitStatus },
          { id: 'a11', name: 'Raj Bazaar',       mobile: '9876542004', outstanding: 1200, visitStatus: 'pending' as VisitStatus },
          { id: 'a12', name: 'Kumar Stores',     mobile: '9876542005', outstanding: 0,    visitStatus: 'pending' as VisitStatus },
        ],
      },
    ],
  },
];

const VISIT_META: Record<VisitStatus, { color: string; icon: string; label: string }> = {
  visited: { color: '#22c55e', icon: 'check-circle',           label: 'Visited'  },
  pending: { color: '#f59e0b', icon: 'clock-outline',          label: 'Pending'  },
  skipped: { color: '#ef4444', icon: 'minus-circle-outline',   label: 'Skipped'  },
};

function RouteCard({ route, colors, onPartyPress, onAddParty, onManageParty, allRoutes }: {
  route: any; colors: any;
  onPartyPress:   (party: any) => void;
  onAddParty:     (routeId: string, routeName: string, day: string, existingIds: string[], allDayWise: any[], salesmanId: string) => void;
  onManageParty:  (party: any, routeId: string, routeName: string, day: string, dayWiseAccounts: any[], salesmanId: string, allRoutes: any[]) => void;
  allRoutes:      any[];
}) {
  const [expanded, setExpanded] = useState(route.id === 'r1');

  const totalAccounts = route.dayWiseAccounts.reduce((s: number, d: any) => s + d.accounts.length, 0);
  const visitedCount  = route.dayWiseAccounts.reduce(
    (s: number, d: any) => s + d.accounts.filter((a: any) => a.visitStatus === 'visited').length, 0
  );

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
        {/* Progress bar */}
        <View style={styles.progressWrap}>
          <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
            <View style={[styles.progressFill, { backgroundColor: colors.brand, width: `${(visitedCount / totalAccounts) * 100}%` as any }]} />
          </View>
          <Text style={[styles.progressText, { color: colors.brand }]}>{Math.round((visitedCount / totalAccounts) * 100)}%</Text>
        </View>
        <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.subText} style={{ marginLeft: 8 }} />
      </TouchableOpacity>

      {/* Day sections */}
      {expanded && route.dayWiseAccounts.map((day: any) => {
        const isToday = day.day === TODAY_DAY;
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
                  route.id,
                  route.routename,
                  day.day,
                  day.accounts.map((a: any) => a.id),
                  route.dayWiseAccounts,
                  route.salesmanid?.id ?? '',
                )}
              >
                <Icon name="plus" size={13} color={colors.brand} />
                <Text style={[styles.addPartyText, { color: colors.brand }]}>Add</Text>
              </TouchableOpacity>
            </View>

            {day.accounts.map((party: any, idx: number) => {
              const vm = VISIT_META[party.visitStatus];
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
                    onPress={() => onPartyPress({ ...party, routeName: route.routename })}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.visitIcon, { backgroundColor: vm.color + '18' }]}>
                      <Icon name={vm.icon} size={16} color={vm.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.partyName, { color: colors.text }]}>{party.name}</Text>
                      {party.outstanding > 0 && (
                        <Text style={[styles.outstanding, { color: '#ef4444' }]}>
                          Pending: ₹{party.outstanding.toLocaleString('en-IN')}
                        </Text>
                      )}
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: vm.color + '18' }]}>
                      <Text style={[styles.statusPillText, { color: vm.color }]}>{vm.label}</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.manageBtn, { backgroundColor: colors.raisedSurface }]}
                    onPress={() => onManageParty(
                      party,
                      route.id,
                      route.routename,
                      day.day,
                      route.dayWiseAccounts,
                      route.salesmanid?.id ?? '',
                      allRoutes,
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

export default function SalesmanRoutes() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();

  const handlePartyPress = (party: any) => {
    navigation.navigate('RoutePartyVisit', {
      partyId:   party.id,
      partyName: party.name,
      mobile:    party.mobile,
      outstanding: party.outstanding,
      routeName: party.routeName,
    });
  };

  const handleAddParty = (
    routeId: string, routeName: string, day: string,
    existingAccountIds: string[], allDayWiseAccounts: any[], salesmanId: string,
  ) => {
    navigation.navigate('AddPartyToRoute', {
      routeId, routeName, day,
      existingAccountIds, allDayWiseAccounts,
      routeSalesmanId: salesmanId,
    });
  };

  const handleManageParty = (
    party: any,
    routeId: string, routeName: string, day: string,
    dayWiseAccounts: any[], salesmanId: string,
    allRoutes: any[],
  ) => {
    navigation.navigate('ManagePartyRoute', {
      partyId:               party.id,
      partyName:             party.name,
      currentRouteId:        routeId,
      currentRouteName:      routeName,
      currentDay:            day,
      currentDayWiseAccounts: dayWiseAccounts,
      currentSalesmanId:     salesmanId,
      availableRoutes:       allRoutes.map((r: any) => ({
        id:              r.id,
        routename:       r.routename,
        dayWiseAccounts: r.dayWiseAccounts,
        salesmanid:      r.salesmanid,
      })),
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

      <AppHeader label="My Routes" />

      <DynamicFlashList
        data={DUMMY_ROUTES}
        renderItem={({ item }: any) => (
          <RouteCard
            route={item}
            colors={colors}
            onPartyPress={handlePartyPress}
            onAddParty={handleAddParty}
            onManageParty={handleManageParty}
            allRoutes={DUMMY_ROUTES}
          />
        )}
        estimatedItemSize={280}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Icon name="map-marker-off-outline" size={48} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.subText }]}>No routes assigned</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  listContent: { paddingHorizontal: 18, paddingBottom: 110, paddingTop: 14 },

  routeCard: {
    borderRadius: 18, borderWidth: 1, marginBottom: 14, overflow: 'hidden',
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  routeHeader:   { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  routeIconWrap: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  routeName:     { fontSize: 14, fontFamily: FONTS.bold },
  routeMeta:     { fontSize: 12, fontFamily: FONTS.regular, marginTop: 2 },

  progressWrap:  { alignItems: 'center', gap: 3 },
  progressBar:   { width: 44, height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: 2 },
  progressText:  { fontSize: 10, fontFamily: FONTS.bold },

  daySection:    { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 },
  dayHeaderRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  dayLabel:      { fontSize: 13, fontFamily: FONTS.bold },
  todayBadge:    { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  todayText:     { fontSize: 10, fontFamily: FONTS.bold },
  dayCount:      { fontSize: 11, fontFamily: FONTS.regular, marginLeft: 'auto' },
  addPartyBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, marginLeft: 8 },
  addPartyText:  { fontSize: 11, fontFamily: FONTS.bold },

  partyRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  partyRowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  manageBtn:    { width: 30, height: 30, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginLeft: 4 },
  visitIcon:    { width: 30, height: 30, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  partyName:    { fontSize: 13, fontFamily: FONTS.semiBold },
  outstanding:  { fontSize: 11, fontFamily: FONTS.semiBold, marginTop: 2 },
  statusPill:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusPillText: { fontSize: 10, fontFamily: FONTS.semiBold },

  emptyWrap:  { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText:  { fontSize: 14, fontFamily: FONTS.regular },
});
