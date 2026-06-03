import React from 'react';
import { View, Text, StyleSheet, StatusBar, ScrollView } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useRoute } from '@react-navigation/native';
import { COLORS, FONTS, useTheme } from '../../../../config';
import { formatINR, formatDate, formatTxnCode, titleCase } from '../../../../utils';
import { BackHeader } from '../../../../components';

export default function LedgerDetail() {
  const { colors, isDark } = useTheme();
  const route = useRoute<any>();
  const { transaction: tx, ledgerId } = route.params ?? {};

  const entries: any[] = tx?.entries ?? [];
  const totalDebit  = entries.reduce((s, e) => s + (e.debit ?? 0), 0);
  const totalCredit = entries.reduce((s, e) => s + (e.credit ?? 0), 0);

  const MetaRow = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
    <View style={styles.metaRow}>
      <View style={[styles.metaIcon, { backgroundColor: colors.brandSoft }]}>
        <Icon name={icon} size={14} color={colors.brand} />
      </View>
      <Text style={[styles.metaLabel, { color: colors.subText }]}>{label}</Text>
      <Text style={[styles.metaValue, { color: colors.text }]} numberOfLines={1}>{value}</Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

      <BackHeader label="Transaction Detail" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Summary header */}
        <Animated.View entering={FadeInUp.duration(350)} style={[styles.hero, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
          <Text style={[styles.heroCode, { color: colors.brand }]}>{formatTxnCode(tx?.transactioncode)}</Text>
          <Text style={[styles.heroNarr, { color: colors.text }]}>{tx?.narration ?? '—'}</Text>
          <View style={[styles.typeBadge, { backgroundColor: colors.brandSoft }]}>
            <Text style={[styles.typeBadgeText, { color: colors.brand }]}>{titleCase(tx?.entrytype) || 'Auto'}</Text>
          </View>
        </Animated.View>

        {/* Meta */}
        <Animated.View entering={FadeInUp.duration(350).delay(60)} style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
          <MetaRow icon="calendar-outline" label="Date"   value={formatDate(tx?.transactiondate)} />
          <MetaRow icon="check-decagram-outline" label="Status" value={tx?.status === false ? 'Inactive' : 'Active'} />
        </Animated.View>

        {/* Entries table */}
        <Animated.View entering={FadeInUp.duration(350).delay(120)} style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Journal Entries</Text>

          <View style={[styles.theadRow, { borderColor: colors.border }]}>
            <Text style={[styles.thLedger, { color: colors.subText }]}>Ledger</Text>
            <Text style={[styles.thAmt, { color: colors.subText }]}>Dr</Text>
            <Text style={[styles.thAmt, { color: colors.subText }]}>Cr</Text>
          </View>

          {entries.map((e, i) => {
            const isParty = String(e?.ledgerid?.id ?? e?.ledgerid) === String(ledgerId);
            return (
              <View key={i} style={[styles.entryRow, { borderColor: colors.border }]}>
                <View style={styles.entryLedgerCell}>
                  <Text style={[styles.entryLedger, { color: isParty ? colors.brand : colors.text }]} numberOfLines={1}>
                    {e?.ledgerid?.ledgername ?? '—'}
                  </Text>
                  {!!e?.remarks && (
                    <Text style={[styles.entryRemarks, { color: colors.subText }]} numberOfLines={1}>{e.remarks}</Text>
                  )}
                </View>
                <Text style={[styles.entryAmt, { color: (e.debit ?? 0) > 0 ? '#ef4444' : colors.subText }]}>
                  {(e.debit ?? 0) > 0 ? formatINR(e.debit) : '—'}
                </Text>
                <Text style={[styles.entryAmt, { color: (e.credit ?? 0) > 0 ? '#22c55e' : colors.subText }]}>
                  {(e.credit ?? 0) > 0 ? formatINR(e.credit) : '—'}
                </Text>
              </View>
            );
          })}

          <View style={[styles.totalRow, { borderColor: colors.border }]}>
            <Text style={[styles.totalLabel, { color: colors.text }]}>Total</Text>
            <Text style={[styles.entryAmt, { color: colors.text, fontFamily: FONTS.bold }]}>{formatINR(totalDebit)}</Text>
            <Text style={[styles.entryAmt, { color: colors.text, fontFamily: FONTS.bold }]}>{formatINR(totalCredit)}</Text>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 18, paddingBottom: 40 },

  hero: {
    borderRadius: 20, borderWidth: 1, padding: 18, alignItems: 'flex-start', marginBottom: 14,
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  heroCode: { fontSize: 16, fontFamily: FONTS.bold },
  heroNarr: { fontSize: 14, fontFamily: FONTS.semiBold, marginTop: 4 },
  typeBadge: { marginTop: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  typeBadgeText: { fontSize: 11, fontFamily: FONTS.semiBold },

  card: {
    borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 14,
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  metaIcon: { width: 28, height: 28, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  metaLabel: { fontSize: 12, fontFamily: FONTS.regular, width: 64 },
  metaValue: { fontSize: 13, fontFamily: FONTS.semiBold, flex: 1, textAlign: 'right' },

  sectionTitle: { fontSize: 14, fontFamily: FONTS.bold, marginBottom: 12 },
  theadRow: { flexDirection: 'row', borderBottomWidth: 1, paddingBottom: 8 },
  thLedger: { flex: 1, fontSize: 11, fontFamily: FONTS.semiBold },
  thAmt: { width: 78, fontSize: 11, fontFamily: FONTS.semiBold, textAlign: 'right' },

  entryRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, paddingVertical: 10 },
  entryLedgerCell: { flex: 1, paddingRight: 8 },
  entryLedger: { fontSize: 13, fontFamily: FONTS.semiBold },
  entryRemarks: { fontSize: 11, fontFamily: FONTS.regular, marginTop: 2 },
  entryAmt: { width: 78, fontSize: 12, fontFamily: FONTS.semiBold, textAlign: 'right' },

  totalRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 12 },
  totalLabel: { flex: 1, fontSize: 13, fontFamily: FONTS.bold },
});
