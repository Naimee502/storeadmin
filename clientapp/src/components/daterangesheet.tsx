import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TouchableOpacity, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { FONTS, useTheme } from '../config';

/**
 * Date range filter — quick presets for the everyday cases (Today, This week…)
 * plus a "Custom" calendar where the first tap picks the start and the second
 * the end. Pure JS, no native date-picker dependency (no rebuild needed).
 *
 * Ranges are whole local days: `from` and `to` are YYYY-MM-DD (inclusive);
 * null on both = all time.
 */

export type DatePreset = 'all' | 'today' | 'yesterday' | 'last7' | 'thisMonth' | 'lastMonth' | 'custom';
export type DateRange = { preset: DatePreset; from: string | null; to: string | null };

export const ALL_TIME: DateRange = { preset: 'all', from: null, to: null };

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const PRESETS: { key: DatePreset; label: string; icon: string }[] = [
  { key: 'all',       label: 'All time',     icon: 'infinity' },
  { key: 'today',     label: 'Today',        icon: 'calendar-today' },
  { key: 'yesterday', label: 'Yesterday',    icon: 'calendar-arrow-left' },
  { key: 'last7',     label: 'Last 7 days',  icon: 'calendar-week' },
  { key: 'thisMonth', label: 'This month',   icon: 'calendar-month' },
  { key: 'lastMonth', label: 'Last month',   icon: 'calendar-month-outline' },
  { key: 'custom',    label: 'Custom range', icon: 'calendar-range' },
];

/** Resolve a preset to concrete days (evaluated now, so "Today" is always today). */
export function presetRange(preset: DatePreset): DateRange {
  const now = new Date();
  switch (preset) {
    case 'today':     return { preset, from: ymd(now), to: ymd(now) };
    case 'yesterday': { const y = addDays(now, -1); return { preset, from: ymd(y), to: ymd(y) }; }
    case 'last7':     return { preset, from: ymd(addDays(now, -6)), to: ymd(now) };
    case 'thisMonth': return { preset, from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: ymd(now) };
    case 'lastMonth': return {
      preset,
      from: ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: ymd(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
    default: return ALL_TIME;
  }
}

/** Is a date (Date or null) inside the range? */
export function inRange(d: Date | null, r: DateRange): boolean {
  if (!r.from && !r.to) return true;
  if (!d) return false;
  const k = ymd(d);
  return (!r.from || k >= r.from) && (!r.to || k <= r.to);
}

const fmtDay = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}${y !== new Date().getFullYear() ? ` ${y}` : ''}`;
};

/** Short label for the filter button: "This month", "3 Oct – 18 Oct". */
export function rangeLabel(r: DateRange): string {
  if (r.preset !== 'custom') return PRESETS.find((p) => p.key === r.preset)?.label ?? 'All time';
  if (!r.from) return 'All time';
  return r.from === r.to ? fmtDay(r.from) : `${fmtDay(r.from)} – ${fmtDay(r.to ?? r.from)}`;
}

export const DateRangeSheet: React.FC<{
  visible: boolean;
  value: DateRange;
  onApply: (r: DateRange) => void;
  onClose: () => void;
}> = ({ visible, value, onApply, onClose }) => {
  const { colors } = useTheme();
  const today = ymd(new Date());
  const [draft, setDraft] = useState<DateRange>(value);
  const [month, setMonth] = useState(() => new Date());

  // Re-open on what is applied; calendar starts on the selected (or current) month.
  useEffect(() => {
    if (!visible) return;
    setDraft(value);
    const base = value.from ? new Date(`${value.from}T00:00:00`) : new Date();
    setMonth(new Date(base.getFullYear(), base.getMonth(), 1));
  }, [visible, value]);

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const lead = (first.getDay() + 6) % 7; // Monday-first grid
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells: (string | null)[] = Array(lead).fill(null);
    for (let i = 1; i <= count; i++) cells.push(ymd(new Date(month.getFullYear(), month.getMonth(), i)));
    while (cells.length % 7) cells.push(null);
    return cells;
  }, [month]);

  const pickPreset = (p: DatePreset) => {
    if (p === 'custom') {
      setDraft((d) => ({ preset: 'custom', from: d.from, to: d.to }));
      return;
    }
    // Presets apply straight away — one tap, done.
    onApply(presetRange(p));
    onClose();
  };

  const pickDay = (k: string) => {
    if (k > today) return; // no orders in the future
    setDraft((d) => {
      // First tap (or a tap after a complete range) starts a new range.
      if (d.preset !== 'custom' || !d.from || (d.from && d.to && d.from !== d.to) || (d.from && d.to && d.from === d.to && k === d.from)) {
        return { preset: 'custom', from: k, to: k };
      }
      // Second tap closes it; tapping an earlier day swaps the ends.
      return k < d.from ? { preset: 'custom', from: k, to: d.from } : { preset: 'custom', from: d.from, to: k };
    });
  };

  const canNext = new Date(month.getFullYear(), month.getMonth() + 1, 1) <= new Date();
  const isCustom = draft.preset === 'custom';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.modalOverlay }]} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.raisedSurface }]} onPress={() => {}}>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <View style={styles.headRow}>
            <Text style={[styles.title, { color: colors.text }]}>Filter by date</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="close" size={20} color={colors.subText} />
            </TouchableOpacity>
          </View>

          <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
            <View style={styles.presetWrap}>
              {PRESETS.map((p) => {
                const active = draft.preset === p.key;
                return (
                  <TouchableOpacity
                    key={p.key}
                    onPress={() => pickPreset(p.key)}
                    activeOpacity={0.8}
                    style={[styles.preset, active
                      ? { backgroundColor: colors.brand, borderColor: colors.brand }
                      : { backgroundColor: colors.softSurface, borderColor: colors.border }]}
                  >
                    <Icon name={p.icon} size={15} color={active ? colors.onBrand : colors.brand} />
                    <Text style={[styles.presetText, { color: active ? colors.onBrand : colors.text }]}>{p.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {isCustom && (
              <View style={[styles.calendar, { borderColor: colors.border }]}>
                {/* From / To summary */}
                <View style={styles.rangeRow}>
                  {(['from', 'to'] as const).map((k) => (
                    <View key={k} style={[styles.rangeBox, { backgroundColor: colors.brandSoft }]}>
                      <Text style={[styles.rangeCap, { color: colors.subText }]}>{k === 'from' ? 'From' : 'To'}</Text>
                      <Text style={[styles.rangeVal, { color: draft[k] ? colors.brand : colors.subText }]}>
                        {draft[k] ? fmtDay(draft[k]!) : 'Select'}
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={styles.monthRow}>
                  <TouchableOpacity onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={styles.navBtn}>
                    <Icon name="chevron-left" size={22} color={colors.text} />
                  </TouchableOpacity>
                  <Text style={[styles.monthText, { color: colors.text }]}>
                    {MONTHS[month.getMonth()]} {month.getFullYear()}
                  </Text>
                  <TouchableOpacity
                    disabled={!canNext}
                    onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                    style={[styles.navBtn, !canNext && { opacity: 0.3 }]}
                  >
                    <Icon name="chevron-right" size={22} color={colors.text} />
                  </TouchableOpacity>
                </View>

                <View style={styles.grid}>
                  {WEEKDAYS.map((w, i) => (
                    <Text key={`w${i}`} style={[styles.weekday, { color: colors.subText }]}>{w}</Text>
                  ))}
                  {days.map((k, i) => {
                    if (!k) return <View key={`e${i}`} style={styles.cell} />;
                    const future = k > today;
                    const isStart = k === draft.from;
                    const isEnd = k === draft.to;
                    const between = !!draft.from && !!draft.to && k > draft.from && k < draft.to;
                    const edge = isStart || isEnd;
                    return (
                      <View key={k} style={styles.cell}>
                        {/* Band behind the range (half-band on the ends). */}
                        {(between || (edge && draft.from !== draft.to)) && (
                          <View style={[
                            styles.band, { backgroundColor: colors.brandSoft },
                            isStart && { left: '50%' }, isEnd && { right: '50%' },
                          ]} />
                        )}
                        <TouchableOpacity
                          disabled={future}
                          onPress={() => pickDay(k)}
                          style={[styles.dayBtn, edge && { backgroundColor: colors.brand },
                            !edge && k === today && { borderWidth: 1, borderColor: colors.brand }]}
                        >
                          <Text style={[styles.dayText, {
                            color: edge ? colors.onBrand : future ? colors.border : colors.text,
                            fontFamily: edge || k === today ? FONTS.semiBold : FONTS.regular,
                          }]}>
                            {Number(k.slice(8))}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>

                <Text style={[styles.hint, { color: colors.subText }]}>
                  Tap a start date, then an end date. Tap one date twice for a single day.
                </Text>
              </View>
            )}
          </ScrollView>

          {isCustom && (
            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.btn, { borderColor: colors.border, borderWidth: 1 }]}
                onPress={() => { onApply(ALL_TIME); onClose(); }}
              >
                <Text style={[styles.btnText, { color: colors.text }]}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={!draft.from}
                style={[styles.btn, { backgroundColor: colors.brand, opacity: draft.from ? 1 : 0.5 }]}
                onPress={() => { onApply({ preset: 'custom', from: draft.from, to: draft.to ?? draft.from }); onClose(); }}
              >
                <Text style={[styles.btnText, { color: colors.onBrand }]}>Apply</Text>
              </TouchableOpacity>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingBottom: 28, maxHeight: '88%' },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  title: { fontSize: 16, fontFamily: FONTS.bold },
  presetWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  preset: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  presetText: { fontSize: 13, fontFamily: FONTS.semiBold },
  calendar: { marginTop: 14, borderWidth: 1, borderRadius: 16, padding: 12 },
  rangeRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  rangeBox: { flex: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 },
  rangeCap: { fontSize: 11, fontFamily: FONTS.regular },
  rangeVal: { fontSize: 14, fontFamily: FONTS.semiBold, marginTop: 2 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  navBtn: { padding: 4 },
  monthText: { fontSize: 15, fontFamily: FONTS.semiBold },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 11, fontFamily: FONTS.semiBold, paddingVertical: 6 },
  cell: { width: `${100 / 7}%`, height: 40, justifyContent: 'center', alignItems: 'center' },
  band: { position: 'absolute', left: 0, right: 0, top: 4, bottom: 4 },
  dayBtn: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  dayText: { fontSize: 13 },
  hint: { fontSize: 11, fontFamily: FONTS.regular, textAlign: 'center', marginTop: 8 },
  footer: { flexDirection: 'row', gap: 10, paddingTop: 12 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  btnText: { fontSize: 14, fontFamily: FONTS.semiBold },
});
