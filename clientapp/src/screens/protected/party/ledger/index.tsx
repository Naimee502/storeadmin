import React, { useMemo } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { COLORS, FONTS, STRINGS, useTheme } from '../../../../config';
import { LedgerSkeleton } from '../../../../config/skeletonlayouts';
import { GET_ACCOUNT, GET_TRANSACTIONS } from '../../../../apollo/queries/accounts';
import { formatINR, formatDate, ledgerEntryTotals, formatTxnCode } from '../../../../utils';
import { AppHeader, DynamicFlashList } from '../../../../components';
import type { RootState } from '../../../../store/rootreducer';

export default function Ledger() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const user    = useSelector((s: RootState) => s.auth.user);
  const tenant  = useSelector((s: RootState) => s.tenant);
  const adminid = tenant.adminId ?? '';

  const { data: accountData, loading: accountLoading } = useQuery(GET_ACCOUNT, {
    variables: { id: user?.id, adminId: adminid },
    skip: !adminid || !user?.id,
    refetchPolicy: 'network-only',
  });

  const account  = accountData?.getAccountById;
  const ledgerId = account?.ledgerid?.id;

  const { data: txData, loading: txLoading } = useQuery(GET_TRANSACTIONS, {
    variables: { adminid, ledgerid: ledgerId },
    skip: !adminid || !ledgerId,
    refetchPolicy: 'network-only',
  });

  const rawTx = (txData?.getTransactions ?? []) as any[];

  // Compute per-ledger debit/credit + running balance (chronological), then
  // present newest-first like a Tally day book.
  const { rows, totalDebit, totalCredit, balance } = useMemo(() => {
    const sorted = [...rawTx].sort((a, b) => {
      const da = Number(a.transactiondate) || new Date(a.transactiondate).getTime() || 0;
      const db = Number(b.transactiondate) || new Date(b.transactiondate).getTime() || 0;
      return da - db;
    });

    let run = 0, td = 0, tc = 0;
    const computed = sorted.map((tx) => {
      const { debit, credit } = ledgerEntryTotals(tx, ledgerId);
      run += debit - credit;
      td += debit; tc += credit;
      return { tx, debit, credit, running: run };
    });

    return {
      rows: computed.reverse(),
      totalDebit: td,
      totalCredit: tc,
      balance: run,
    };
  }, [rawTx, ledgerId]);

  const renderRow = ({ item }: any) => {
    const { tx, debit, credit, running } = item;
    const isDebit = debit > 0;
    const colour  = isDebit ? '#ef4444' : '#22c55e';

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => navigation.navigate('LedgerDetail', {
          transaction: tx,
          ledgerId,
          ledgername: account?.ledgerid?.ledgername ?? account?.name,
        })}
        style={[styles.row, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
      >
        <View style={[styles.rowIcon, { backgroundColor: colour + '18' }]}>
          <Icon name={isDebit ? 'arrow-up-bold' : 'arrow-down-bold'} size={16} color={colour} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[styles.rowCode, { color: colors.text }]} numberOfLines={1}>
            {formatTxnCode(tx.transactioncode)}
          </Text>
          <Text style={[styles.rowNarr, { color: colors.subText }]} numberOfLines={1}>
            {tx.narration ?? '—'}
          </Text>
          <Text style={[styles.rowDate, { color: colors.subText }]}>{formatDate(tx.transactiondate)}</Text>
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.rowAmt, { color: colour }]}>
            {isDebit ? 'Dr ' : 'Cr '}{formatINR(isDebit ? debit : credit)}
          </Text>
          <Text style={[styles.rowBal, { color: colors.subText }]}>
            Bal {formatINR(Math.abs(running))} {running >= 0 ? 'Dr' : 'Cr'}
          </Text>
        </View>

        <Icon name="chevron-right" size={16} color={colors.subText} style={{ marginLeft: 4 }} />
      </TouchableOpacity>
    );
  };

  const ListHeader = () => (
    <>
      <Animated.View entering={FadeInUp.duration(400).delay(60)} style={styles.summaryRow}>
        {[
          { icon: 'arrow-up-bold',   value: formatINR(totalDebit),  label: STRINGS.party.totalDebit,  colour: '#ef4444' },
          { icon: 'arrow-down-bold', value: formatINR(totalCredit), label: STRINGS.party.totalCredit, colour: '#22c55e' },
          { icon: 'scale-balance',   value: `${formatINR(Math.abs(balance))}`, label: balance >= 0 ? 'Balance (Dr)' : 'Balance (Cr)', colour: colors.brand },
        ].map((s) => (
          <View key={s.label} style={[styles.sumCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
            <View style={[styles.sumIcon, { backgroundColor: s.colour + '18' }]}>
              <Icon name={s.icon} size={15} color={s.colour} />
            </View>
            <Text style={[styles.sumValue, { color: colors.text }]}>{s.value}</Text>
            <Text style={[styles.sumLabel, { color: colors.subText }]}>{s.label}</Text>
          </View>
        ))}
      </Animated.View>

      <View style={styles.txHeader}>
        <Text style={[styles.txHeaderText, { color: colors.text }]}>{STRINGS.party.transactions}</Text>
        <Text style={[styles.txCount, { color: colors.subText }]}>{rows.length} entries</Text>
      </View>
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

      <AppHeader label={STRINGS.party.ledger} />

      {accountLoading || txLoading ? (
        <LedgerSkeleton />
      ) : (
        <DynamicFlashList
          data={rows}
          renderItem={renderRow}
          estimatedItemSize={84}
          keyExtractor={(item: any) => item.tx.id}
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

  summaryRow: { flexDirection: 'row', gap: 10, marginTop: 14, marginBottom: 16 },
  sumCard: {
    flex: 1, borderRadius: 18, borderWidth: 1, padding: 12, alignItems: 'flex-start',
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  sumIcon:  { width: 30, height: 30, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  sumValue: { fontSize: 12, fontFamily: FONTS.bold },
  sumLabel: { fontSize: 9, fontFamily: FONTS.regular, marginTop: 2 },

  txHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  txHeaderText: { fontSize: 15, fontFamily: FONTS.bold },
  txCount:      { fontSize: 12, fontFamily: FONTS.regular },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, borderWidth: 1, padding: 13, marginBottom: 10,
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  rowIcon: { width: 36, height: 36, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  rowCode: { fontSize: 13, fontFamily: FONTS.bold },
  rowNarr: { fontSize: 12, fontFamily: FONTS.regular, marginTop: 1 },
  rowDate: { fontSize: 11, fontFamily: FONTS.regular, marginTop: 2, opacity: 0.85 },
  rowAmt:  { fontSize: 13, fontFamily: FONTS.bold },
  rowBal:  { fontSize: 10, fontFamily: FONTS.regular, marginTop: 3 },

  txEmpty:   { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 14, fontFamily: FONTS.semiBold },
});
