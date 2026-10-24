import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, FONTS, useTheme } from '../config';
import { DateRangeSheet, ALL_TIME, rangeLabel, type DateRange } from './daterangesheet';

/** ₹ without paise, and lakh / crore for big numbers so it fits a stat tile. */
export function compactINR(n: number): string {
  const v = Math.round(n || 0);
  // Number(x.toFixed(2)) drops trailing zeros: 1.50 → 1.5, 10.00 → 10.
  if (v >= 1e7) return `₹${Number((v / 1e7).toFixed(2))}Cr`;
  if (v >= 1e5) return `₹${Number((v / 1e5).toFixed(2))}L`;
  return `₹${v.toLocaleString('en-IN')}`;
}

/**
 * Orders summary card shared by the salesman / party / staff order lists:
 * date-range filter on top, what the visible list adds up to below
 * (order count, order value, average per order — cancelled ones excluded
 * from the value). The date sheet lives inside, so a screen only keeps the
 * `range` state and filters its list with `inRange`.
 */
export const OrdersSummaryCard: React.FC<{
  caption: string;
  orders: any[];
  range: DateRange;
  onRangeChange: (r: DateRange) => void;
}> = ({ caption, orders, range, onRangeChange }) => {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const dateActive = range.preset !== 'all';

  const { total, avg } = useMemo(() => {
    let sum = 0; let n = 0;
    for (const o of orders) {
      if (o?.cancelStatus === 'cancelled') continue;
      sum += Number(o?.totalamount) || 0; n += 1;
    }
    return { total: sum, avg: n ? sum / n : 0 };
  }, [orders]);

  return (
    <View style={[styles.sumCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
      <View style={styles.sumHead}>
        <Text style={[styles.sumCaption, { color: colors.subText }]} numberOfLines={1}>{caption}</Text>
        <Pressable
          style={[styles.dateBtn, dateActive
            ? { backgroundColor: colors.brandSoft, borderColor: colors.brand }
            : { backgroundColor: colors.raisedSurface, borderColor: colors.border }]}
          onPress={() => setOpen(true)}
        >
          <Icon name="calendar-range" size={15} color={colors.brand} />
          <Text style={[styles.dateBtnText, { color: dateActive ? colors.brand : colors.text }]} numberOfLines={1}>
            {rangeLabel(range)}
          </Text>
          {dateActive ? (
            <Pressable onPress={() => onRangeChange(ALL_TIME)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="close-circle" size={16} color={colors.brand} />
            </Pressable>
          ) : (
            <Icon name="chevron-down" size={16} color={colors.subText} />
          )}
        </Pressable>
      </View>

      <View style={[styles.sumDivider, { backgroundColor: colors.border }]} />

      <View style={styles.statRow}>
        {[
          { icon: 'clipboard-text-outline', tint: '#3b82f6',    value: String(orders.length), label: orders.length === 1 ? 'Order' : 'Orders' },
          { icon: 'currency-inr',           tint: colors.brand, value: compactINR(total),     label: 'Order value' },
          { icon: 'chart-line',             tint: '#f59e0b',    value: compactINR(avg),       label: 'Avg / order' },
        ].map((st, i) => (
          <React.Fragment key={st.label}>
            {i > 0 && <View style={[styles.statSep, { backgroundColor: colors.border }]} />}
            <View style={styles.stat}>
              <View style={[styles.statIcon, { backgroundColor: st.tint + '1A' }]}>
                <Icon name={st.icon} size={16} color={st.tint} />
              </View>
              <View style={{ flexShrink: 1 }}>
                <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{st.value}</Text>
                <Text style={[styles.statLabel, { color: colors.subText }]} numberOfLines={1}>{st.label}</Text>
              </View>
            </View>
          </React.Fragment>
        ))}
      </View>

      <DateRangeSheet visible={open} value={range} onApply={onRangeChange} onClose={() => setOpen(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  sumCard: {
    marginHorizontal: 18, marginBottom: 10, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12,
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  sumHead:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sumCaption:  { fontSize: 13, fontFamily: FONTS.semiBold, flexShrink: 1 },
  sumDivider:  { height: StyleSheet.hairlineWidth, marginVertical: 12 },
  statRow:     { flexDirection: 'row', alignItems: 'center' },
  stat:        { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  statSep:     { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginHorizontal: 8 },
  statIcon:    { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  statValue:   { fontSize: 15, fontFamily: FONTS.bold },
  statLabel:   { fontSize: 11, fontFamily: FONTS.regular, marginTop: 1 },
  dateBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, maxWidth: '62%' },
  dateBtnText: { fontSize: 13, fontFamily: FONTS.semiBold, flexShrink: 1 },
});
