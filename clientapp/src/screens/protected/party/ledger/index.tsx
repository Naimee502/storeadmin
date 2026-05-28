import React, { useMemo } from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { COLORS, FONTS, STRINGS, useTheme } from '../../../../config';
import { LedgerSkeleton } from '../../../../config/skeletonlayouts';
import { GET_ACCOUNT, GET_TRANSACTIONS } from '../../../../apollo/queries/accounts';
import { formatINR, formatDate } from '../../../../utils';
import { AppHeader, DynamicFlashList } from '../../../../components';
import type { RootState } from '../../../../store/rootreducer';

const DUMMY_ACCOUNT = {
  mobile:      '9876543210',
  email:       'mahesh.traders@example.com',
  gstnumber:   '27AABCU9603R1ZM',
  creditlimit: 50000,
  ledgerid:    { id: 'dl1', ledgername: 'Mahesh Traders Ledger' },
};

const DUMMY_TRANSACTIONS = [
  { id: 'dt1', transactioncode: 'INV/2024/001', narration: 'Sales Invoice',     transactiondate: '2024-11-15T00:00:00.000Z', totaldebit: 4788, totalcredit: 0    },
  { id: 'dt2', transactioncode: 'REC/2024/001', narration: 'Payment Received',  transactiondate: '2024-11-12T00:00:00.000Z', totaldebit: 0,    totalcredit: 5000 },
  { id: 'dt3', transactioncode: 'INV/2024/002', narration: 'Sales Invoice',     transactiondate: '2024-11-10T00:00:00.000Z', totaldebit: 1260, totalcredit: 0    },
  { id: 'dt4', transactioncode: 'REC/2024/002', narration: 'Payment Received',  transactiondate: '2024-11-08T00:00:00.000Z', totaldebit: 0,    totalcredit: 2000 },
  { id: 'dt5', transactioncode: 'INV/2024/003', narration: 'Sales Invoice',     transactiondate: '2024-10-28T00:00:00.000Z', totaldebit: 7500, totalcredit: 0    },
  { id: 'dt6', transactioncode: 'REC/2024/003', narration: 'Advance Payment',   transactiondate: '2024-10-20T00:00:00.000Z', totaldebit: 0,    totalcredit: 3000 },
];

function InfoRow({ icon, label, value, colors }: { icon: string; label: string; value?: string | null; colors: any }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: colors.brandSoft }]}>
        <Icon name={icon} size={14} color={colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.infoLabel, { color: colors.subText }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
      </View>
    </View>
  );
}

export default function Ledger() {
  const { colors, isDark } = useTheme();
  const user    = useSelector((s: RootState) => s.auth.user);
  const tenant  = useSelector((s: RootState) => s.tenant);
  const adminid = tenant.adminId ?? '';

  const { data: accountData, loading: accountLoading } = useQuery(GET_ACCOUNT, {
    variables: { id: user?.id, adminId: adminid },
    skip: !adminid || !user?.id,
  });

  const account  = accountData?.getAccountById ?? DUMMY_ACCOUNT;
  const ledgerId = account?.ledgerid?.id;

  const { data: txData } = useQuery(GET_TRANSACTIONS, {
    variables: { adminid, ledgerid: ledgerId },
    skip: !adminid || !ledgerId,
  });

  const rawTx       = (txData?.getTransactions ?? []) as any[];
  const transactions = rawTx.length > 0 ? rawTx : DUMMY_TRANSACTIONS;

  const { totalDebit, totalCredit, outstanding } = useMemo(() => {
    const d = transactions.reduce((s, t) => s + (t.totaldebit  ?? 0), 0);
    const c = transactions.reduce((s, t) => s + (t.totalcredit ?? 0), 0);
    return { totalDebit: d, totalCredit: c, outstanding: d - c };
  }, [transactions]);

  const renderTx = ({ item: tx }: any) => {
    const isDebit = (tx.totaldebit ?? 0) > 0;
    const amount  = isDebit ? tx.totaldebit : tx.totalcredit;
    const colour  = isDebit ? '#ef4444' : '#22c55e';
    const icon    = isDebit ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline';

    return (
      <View style={[styles.txCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
        <View style={[styles.txIconWrap, { backgroundColor: colour + '18' }]}>
          <Icon name={icon} size={22} color={colour} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.txCode, { color: colors.text }]} numberOfLines={1}>
            {tx.transactioncode ?? tx.narration ?? '–'}
          </Text>
          {tx.narration && tx.transactioncode && (
            <Text style={[styles.txNarr, { color: colors.subText }]} numberOfLines={1}>{tx.narration}</Text>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon name="calendar-outline" size={11} color={colors.subText} style={{ marginRight: 3 }} />
            <Text style={[styles.txDate, { color: colors.subText }]}>{formatDate(tx.transactiondate)}</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.txAmount, { color: colour }]}>
            {isDebit ? '+' : '-'}{formatINR(amount)}
          </Text>
          <Text style={[styles.txType, { color: colour + 'cc' }]}>{isDebit ? 'Debit' : 'Credit'}</Text>
        </View>
      </View>
    );
  };

  const ListHeader = () => (
    <>
      {/* Summary cards */}
      <Animated.View entering={FadeInUp.duration(400).delay(60)} style={styles.summaryRow}>
        {[
          { icon: 'arrow-up-circle-outline',  value: formatINR(totalDebit),            label: STRINGS.party.totalDebit,  colour: '#ef4444' },
          { icon: 'arrow-down-circle-outline', value: formatINR(totalCredit),           label: STRINGS.party.totalCredit, colour: '#22c55e' },
          { icon: 'cash-multiple',             value: formatINR(Math.abs(outstanding)), label: outstanding > 0 ? STRINGS.party.outstanding : 'Advance', colour: colors.brand },
        ].map((s) => (
          <View key={s.label} style={[styles.sumCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
            <View style={[styles.sumIcon, { backgroundColor: s.colour + '18' }]}>
              <Icon name={s.icon} size={16} color={s.colour} />
            </View>
            <Text style={[styles.sumValue, { color: colors.text }]}>{s.value}</Text>
            <Text style={[styles.sumLabel, { color: colors.subText }]}>{s.label}</Text>
          </View>
        ))}
      </Animated.View>

      {/* Account info card */}
      {account && (
        <Animated.View entering={FadeInUp.duration(400).delay(120)}
          style={[styles.accountCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
        >
          <InfoRow icon="phone-outline"            label="Mobile"       value={account.mobile ?? user?.mobile}  colors={colors} />
          <InfoRow icon="email-outline"            label="Email"        value={account.email}                   colors={colors} />
          <InfoRow icon="file-certificate-outline" label="GSTIN"        value={account.gstnumber}               colors={colors} />
          <InfoRow icon="credit-card-outline"      label="Credit Limit" value={account.creditlimit > 0 ? formatINR(account.creditlimit) : null} colors={colors} />
        </Animated.View>
      )}

      {/* Transactions header */}
      <View style={styles.txHeader}>
        <Text style={[styles.txHeaderText, { color: colors.text }]}>{STRINGS.party.transactions}</Text>
        <Text style={[styles.txCount, { color: colors.subText }]}>{transactions.length} entries</Text>
      </View>
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

      <AppHeader label={STRINGS.party.ledger} />

      {accountLoading ? (
        <LedgerSkeleton />
      ) : (
        <DynamicFlashList
          data={transactions}
          renderItem={renderTx}
          estimatedItemSize={72}
          ListHeaderComponent={<ListHeader />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.txEmpty}>
              <Icon name="book-open-blank-variant" size={36} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.subText }]}>No transactions found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: 18, paddingBottom: 110 },

  summaryRow: { flexDirection: 'row', gap: 10, marginTop: 14, marginBottom: 14 },
  sumCard: {
    flex: 1, borderRadius: 18, borderWidth: 1, padding: 12, alignItems: 'flex-start',
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  sumIcon:  { width: 30, height: 30, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  sumValue: { fontSize: 12, fontFamily: FONTS.bold },
  sumLabel: { fontSize: 9, fontFamily: FONTS.regular, marginTop: 2 },

  accountCard: {
    borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 18, gap: 12,
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  infoRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoIcon:  { width: 30, height: 30, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  infoLabel: { fontSize: 10, fontFamily: FONTS.regular },
  infoValue: { fontSize: 13, fontFamily: FONTS.semiBold, marginTop: 1 },

  txHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  txHeaderText: { fontSize: 15, fontFamily: FONTS.bold },
  txCount:      { fontSize: 12, fontFamily: FONTS.regular },

  txCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10,
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  txIconWrap: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  txCode:     { fontSize: 13, fontFamily: FONTS.semiBold, marginBottom: 2 },
  txNarr:     { fontSize: 12, fontFamily: FONTS.regular, marginBottom: 3 },
  txDate:     { fontSize: 11, fontFamily: FONTS.regular },
  txAmount:   { fontSize: 13, fontFamily: FONTS.bold },
  txType:     { fontSize: 10, fontFamily: FONTS.semiBold, marginTop: 2 },

  txEmpty:   { alignItems: 'center', paddingVertical: 30, gap: 10 },
  emptyText: { fontSize: 14, fontFamily: FONTS.regular },
});
