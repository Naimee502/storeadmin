import React from 'react';
import { View, Text, StyleSheet, StatusBar, ScrollView } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useRoute } from '@react-navigation/native';
import { COLORS, FONTS, useTheme } from '../../../../config';
import { formatINR, formatDate, formatPaymentCode, titleCase } from '../../../../utils';
import { BackHeader } from '../../../../components';

export default function PaymentDetail() {
  const { colors, isDark } = useTheme();
  const route = useRoute<any>();
  const { payment: p, accountName } = route.params ?? {};

  const invoices: any[] = p?.invoices ?? [];
  const isReceipt = (p?.type ?? 'receipt').toLowerCase() === 'receipt';
  const cashLedger = p?.ledgerid?.ledgername ?? 'Cash / Bank';

  const MetaRow = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
    <View style={styles.metaRow}>
      <View style={[styles.metaIcon, { backgroundColor: colors.brandSoft }]}>
        <Icon name={icon} size={14} color={colors.brand} />
      </View>
      <Text style={[styles.metaLabel, { color: colors.subText }]}>{label}</Text>
      <Text style={[styles.metaValue, { color: colors.text }]} numberOfLines={1}>{value}</Text>
    </View>
  );

  // Journal preview: Receipt → Dr Cash/Bank, Cr Party. Payment → reverse.
  const journal = isReceipt
    ? [
        { ledger: cashLedger, dr: p?.amount ?? 0, cr: 0 },
        { ledger: `${accountName ?? 'Party'} (Debtor)`, dr: 0, cr: p?.amount ?? 0 },
      ]
    : [
        { ledger: `${accountName ?? 'Party'} (Creditor)`, dr: p?.amount ?? 0, cr: 0 },
        { ledger: cashLedger, dr: 0, cr: p?.amount ?? 0 },
      ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

      <BackHeader label="Payment Detail" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero amount */}
        <Animated.View entering={FadeInUp.duration(350)} style={[styles.hero, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
          <Text style={[styles.heroCode, { color: colors.brand }]}>{formatPaymentCode(p?.paymentcode)}</Text>
          <Text style={[styles.heroAmt, { color: '#22c55e' }]}>{formatINR(p?.amount)}</Text>
          <View style={[styles.typeBadge, { backgroundColor: colors.brandSoft }]}>
            <Text style={[styles.typeBadgeText, { color: colors.brand }]}>
              {titleCase(p?.type) || 'Receipt'} · {titleCase(p?.mode) || 'Cash'}
            </Text>
          </View>
        </Animated.View>

        {/* Meta */}
        <Animated.View entering={FadeInUp.duration(350).delay(60)} style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
          <MetaRow icon="calendar-outline" label="Date" value={formatDate(p?.paymentdate)} />
          <MetaRow icon="account-outline" label="Party" value={accountName ?? '—'} />
          <MetaRow icon="bank-outline" label="Ledger" value={cashLedger} />
          {!!p?.reference && <MetaRow icon="pound" label="Reference" value={p.reference} />}
          {!!p?.remarks && <MetaRow icon="note-text-outline" label="Remarks" value={p.remarks} />}
        </Animated.View>

        {/* Settled invoices */}
        {invoices.length > 0 && (
          <Animated.View entering={FadeInUp.duration(350).delay(120)} style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Settled Invoices</Text>
            {invoices.map((inv, i) => (
              <View key={i} style={[styles.invRow, { borderColor: colors.border }]}>
                <Text style={[styles.invModel, { color: colors.text }]} numberOfLines={1}>
                  {(inv.invoicemodel ?? 'Invoice')}
                </Text>
                <Text style={[styles.invAmt, { color: '#22c55e' }]}>{formatINR(inv.settledamount)}</Text>
              </View>
            ))}
          </Animated.View>
        )}

        {/* Journal preview */}
        <Animated.View entering={FadeInUp.duration(350).delay(180)} style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Journal Entry</Text>
          <View style={[styles.theadRow, { borderColor: colors.border }]}>
            <Text style={[styles.thLedger, { color: colors.subText }]}>Ledger</Text>
            <Text style={[styles.thAmt, { color: colors.subText }]}>Dr</Text>
            <Text style={[styles.thAmt, { color: colors.subText }]}>Cr</Text>
          </View>
          {journal.map((j, i) => (
            <View key={i} style={[styles.entryRow, { borderColor: colors.border }]}>
              <Text style={[styles.entryLedger, { color: colors.text }]} numberOfLines={1}>{j.ledger}</Text>
              <Text style={[styles.entryAmt, { color: j.dr > 0 ? '#ef4444' : colors.subText }]}>{j.dr > 0 ? formatINR(j.dr) : '—'}</Text>
              <Text style={[styles.entryAmt, { color: j.cr > 0 ? '#22c55e' : colors.subText }]}>{j.cr > 0 ? formatINR(j.cr) : '—'}</Text>
            </View>
          ))}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 18, paddingBottom: 40 },

  hero: {
    borderRadius: 20, borderWidth: 1, padding: 20, alignItems: 'center', marginBottom: 14,
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  heroCode: { fontSize: 14, fontFamily: FONTS.semiBold },
  heroAmt: { fontSize: 28, fontFamily: FONTS.bold, marginTop: 6 },
  typeBadge: { marginTop: 12, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  typeBadgeText: { fontSize: 12, fontFamily: FONTS.semiBold },

  card: {
    borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 14,
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  metaIcon: { width: 28, height: 28, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  metaLabel: { fontSize: 12, fontFamily: FONTS.regular, width: 72 },
  metaValue: { fontSize: 13, fontFamily: FONTS.semiBold, flex: 1, textAlign: 'right' },

  sectionTitle: { fontSize: 14, fontFamily: FONTS.bold, marginBottom: 12 },
  invRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, paddingVertical: 10 },
  invModel: { fontSize: 13, fontFamily: FONTS.semiBold, flex: 1, paddingRight: 8 },
  invAmt: { fontSize: 13, fontFamily: FONTS.bold },

  theadRow: { flexDirection: 'row', borderBottomWidth: 1, paddingBottom: 8 },
  thLedger: { flex: 1, fontSize: 11, fontFamily: FONTS.semiBold },
  thAmt: { width: 78, fontSize: 11, fontFamily: FONTS.semiBold, textAlign: 'right' },
  entryRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, paddingVertical: 10 },
  entryLedger: { flex: 1, fontSize: 13, fontFamily: FONTS.semiBold, paddingRight: 8 },
  entryAmt: { width: 78, fontSize: 12, fontFamily: FONTS.semiBold, textAlign: 'right' },
});
