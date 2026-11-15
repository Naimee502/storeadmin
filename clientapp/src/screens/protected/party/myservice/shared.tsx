import React from 'react';
import { View, Text, StyleSheet, StatusBar, ScrollView, RefreshControl, ActivityIndicator, Pressable } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { FONTS, useTheme } from '../../../../config';
import { BackHeader } from '../../../../components';

export const rupees = (n: any) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export const dateLabel = (ymd?: string | null) =>
  ymd ? new Date(`${String(ymd).slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '-';
export const whenLabel = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '';
export const time12 = (hhmm?: string | null) => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
export const daysText = (d: number | null | undefined) => d == null ? '' : d < 0 ? `Ended ${-d} day${d === -1 ? '' : 's'} ago` : d === 0 ? 'Ends today' : `${d} day${d === 1 ? '' : 's'} left`;

/** Screen frame for the customer's service screens. */
export function Screen({ title, loading, error, empty, onRefresh, children, footer }: {
  title: string; loading?: boolean; error?: string | null; empty?: string | null; onRefresh?: () => any; children?: React.ReactNode; footer?: React.ReactNode;
}) {
  const { colors, isDark } = useTheme();
  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />
      <BackHeader label={title} />
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={false} onRefresh={onRefresh} /> : undefined}>
        {loading ? <ActivityIndicator color={colors.brand} />
          : error ? <Text style={[s.sub, { color: '#e11d48' }]}>{error}</Text>
          : empty ? <Text style={[s.sub, { color: colors.subText, textAlign: 'center', marginTop: 20 }]}>{empty}</Text>
          : children}
      </ScrollView>
      {footer}
    </View>
  );
}

export function Card({ children, onPress, style }: { children: React.ReactNode; onPress?: () => void; style?: any }) {
  const { colors } = useTheme();
  return <Pressable disabled={!onPress} onPress={onPress} style={[s.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }, style]}>{children}</Pressable>;
}

export function Pill({ label, color }: { label: string; color: string }) {
  return <View style={[s.pillBox, { borderColor: color }]}><Text style={[s.pill, { color }]}>{label}</Text></View>;
}

export function Btn({ label, onPress, kind = 'primary', disabled, icon }: { label: string; onPress: () => void; kind?: 'primary' | 'outline' | 'danger'; disabled?: boolean; icon?: React.ReactNode }) {
  const { colors } = useTheme();
  const bg = kind === 'primary' ? colors.brand : 'transparent';
  const fg = kind === 'primary' ? '#fff' : kind === 'danger' ? '#e11d48' : colors.text;
  const border = kind === 'primary' ? colors.brand : kind === 'danger' ? '#fecdd3' : colors.border;
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[s.btn, { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.6 : 1 }]}>
      {icon}<Text style={[s.btnText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export const s = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: 16, gap: 10, paddingBottom: 40 },
  card: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  title: { fontSize: 15, fontFamily: FONTS.semiBold },
  name: { fontSize: 14, fontFamily: FONTS.semiBold },
  sub: { fontSize: 12, fontFamily: FONTS.regular },
  label: { fontSize: 11, fontFamily: FONTS.regular },
  value: { fontSize: 13, fontFamily: FONTS.semiBold },
  big: { fontSize: 20, fontFamily: FONTS.bold },
  pillBox: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'center' },
  pill: { fontSize: 11, fontFamily: FONTS.semiBold, includeFontPadding: false },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, flexGrow: 1 },
  btnText: { fontSize: 13, fontFamily: FONTS.semiBold },
  input: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 13, textAlignVertical: 'top' },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
