import React, { useMemo } from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, FONTS, useTheme } from '../../../../config';
import { AppHeader, DynamicFlashList } from '../../../../components';
import { formatINR, formatDate } from '../../../../utils';

const DUMMY_COLLECTIONS = [
  { id: 'c1', orderNum: 'SO/2024/020', party: 'Patel General',  date: '2024-11-15T00:00:00.000Z', amount: 8750,  mode: 'cash',   status: 'collected' },
  { id: 'c2', orderNum: 'SO/2024/016', party: 'Modi Mart',       date: '2024-11-15T00:00:00.000Z', amount: 9200,  mode: 'cash',   status: 'collected' },
  { id: 'c3', orderNum: 'SO/2024/015', party: 'Iyer Provisions', date: '2024-11-14T00:00:00.000Z', amount: 3400,  mode: 'upi',    status: 'collected' },
  { id: 'c4', orderNum: 'SO/2024/014', party: 'Nair Shop',       date: '2024-11-14T00:00:00.000Z', amount: 5600,  mode: 'cheque', status: 'collected' },
  { id: 'c5', orderNum: 'SO/2024/013', party: 'Raj Bazaar',      date: '2024-11-13T00:00:00.000Z', amount: 2100,  mode: 'cash',   status: 'pending'   },
  { id: 'c6', orderNum: 'SO/2024/012', party: 'Kumar Stores',    date: '2024-11-13T00:00:00.000Z', amount: 7800,  mode: 'cash',   status: 'collected' },
];

const MODE_META: Record<string, { icon: string; label: string }> = {
  cash:   { icon: 'cash',         label: 'Cash'   },
  upi:    { icon: 'qrcode-scan',  label: 'UPI'    },
  cheque: { icon: 'checkbook',    label: 'Cheque' },
};

export default function DeliveryCollections() {
  const { colors, isDark } = useTheme();

  const { totalCollected, cashTotal, upiTotal, chequeTotal } = useMemo(() => {
    const collected = DUMMY_COLLECTIONS.filter(c => c.status === 'collected');
    return {
      totalCollected: collected.reduce((s, c) => s + c.amount, 0),
      cashTotal:      collected.filter(c => c.mode === 'cash'  ).reduce((s, c) => s + c.amount, 0),
      upiTotal:       collected.filter(c => c.mode === 'upi'   ).reduce((s, c) => s + c.amount, 0),
      chequeTotal:    collected.filter(c => c.mode === 'cheque').reduce((s, c) => s + c.amount, 0),
    };
  }, []);

  const renderItem = ({ item: c }: any) => {
    const mode = MODE_META[c.mode] ?? MODE_META.cash;
    const isCollected = c.status === 'collected';
    const colour = isCollected ? '#22c55e' : '#f59e0b';
    return (
      <View style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
        <View style={[styles.iconWrap, { backgroundColor: colour + '18' }]}>
          <Icon name={mode.icon} size={20} color={colour} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.orderNum, { color: colors.text }]}>{c.orderNum}</Text>
          <Text style={[styles.partyName, { color: colors.subText }]}>{c.party}</Text>
          <View style={styles.bottomRow}>
            <View style={[styles.modeBadge, { backgroundColor: colors.raisedSurface, borderColor: colors.border }]}>
              <Text style={[styles.modeText, { color: colors.subText }]}>{mode.label}</Text>
            </View>
            <Icon name="calendar-outline" size={11} color={colors.subText} style={{ marginRight: 3 }} />
            <Text style={[styles.dateText, { color: colors.subText }]}>{formatDate(c.date)}</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.amount, { color: colour }]}>{formatINR(c.amount)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: colour + '22' }]}>
            <Text style={[styles.statusText, { color: colour }]}>
              {isCollected ? 'Collected' : 'Pending'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const ListHeader = () => (
    <Animated.View entering={FadeInUp.duration(400).delay(60)} style={styles.summaryGrid}>
      {[
        { icon: 'cash-multiple', value: formatINR(totalCollected), label: 'Total',   color: '#22c55e' },
        { icon: 'cash',          value: formatINR(cashTotal),      label: 'Cash',    color: '#3b82f6' },
        { icon: 'qrcode-scan',   value: formatINR(upiTotal),       label: 'UPI',     color: '#8b5cf6' },
        { icon: 'checkbook',     value: formatINR(chequeTotal),    label: 'Cheque',  color: '#f59e0b' },
      ].map((s) => (
        <View key={s.label} style={[styles.sumCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
          <View style={[styles.sumIcon, { backgroundColor: s.color + '18' }]}>
            <Icon name={s.icon} size={16} color={s.color} />
          </View>
          <Text style={[styles.sumValue, { color: colors.text }]}>{s.value}</Text>
          <Text style={[styles.sumLabel, { color: colors.subText }]}>{s.label}</Text>
        </View>
      ))}
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

      <AppHeader label="Collections" />

      <DynamicFlashList
        data={DUMMY_COLLECTIONS}
        renderItem={renderItem}
        estimatedItemSize={88}
        ListHeaderComponent={<ListHeader />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Icon name="cash-remove" size={44} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.subText }]}>No collections today</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  listContent: { paddingHorizontal: 18, paddingBottom: 110 },

  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14, marginBottom: 14 },
  sumCard: {
    width: '47%', flexGrow: 1, borderRadius: 16, borderWidth: 1, padding: 12, alignItems: 'flex-start',
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  sumIcon:  { width: 30, height: 30, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  sumValue: { fontSize: 11, fontFamily: FONTS.bold },
  sumLabel: { fontSize: 9, fontFamily: FONTS.regular, marginTop: 2 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10,
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  iconWrap:    { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  orderNum:    { fontSize: 13, fontFamily: FONTS.bold, marginBottom: 2 },
  partyName:   { fontSize: 12, fontFamily: FONTS.regular, marginBottom: 6 },
  bottomRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  modeBadge:   { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1 },
  modeText:    { fontSize: 10, fontFamily: FONTS.semiBold },
  dateText:    { fontSize: 11, fontFamily: FONTS.regular },
  amount:      { fontSize: 14, fontFamily: FONTS.bold, marginBottom: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText:  { fontSize: 10, fontFamily: FONTS.semiBold },

  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: FONTS.regular },
});
