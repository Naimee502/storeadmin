import React, { useMemo } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, ActivityIndicator } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { COLORS, FONTS, useTheme } from '../../../../config';
import { formatINR, formatDate, formatBillNumber, formatPaymentCode, titleCase, ledgerEntryTotals } from '../../../../utils';
import { AppHeader, DynamicFlashList } from '../../../../components';
import { GET_SALES_ORDERS, GET_ACCOUNT, GET_PAYMENTS, GET_TRANSACTIONS } from '../../../../apollo/queries/accounts';
import type { RootState } from '../../../../store/rootreducer';

const MODE_ICON: Record<string, string> = {
  cash: 'cash', cheque: 'checkbook', check: 'checkbook',
  bank: 'bank', 'bank transfer': 'bank-transfer', upi: 'cellphone',
};

export default function Payments() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const user = useSelector((s: RootState) => s.auth.user);
  const tenant = useSelector((s: RootState) => s.tenant);
  const adminid = tenant.adminId ?? '';

  const { data: accountData } = useQuery(GET_ACCOUNT, {
    variables: { id: user?.id, adminId: adminid },
    skip: !user?.id || !adminid,
    refetchPolicy: 'network-only',
  });

  const { data: ordersData, loading: ordersLoading } = useQuery(GET_SALES_ORDERS, {
    variables: { adminid, partyacc: user?.id },
    skip: !adminid || !user?.id,
    refetchPolicy: 'network-only',
  });

  // Payments are keyed by the party account (partyid); a Payment's own
  // ledgerid is the cash/bank ledger, so do NOT filter by the party ledger.
  const { data: paymentsData, loading: paymentsLoading } = useQuery(GET_PAYMENTS, {
    variables: { adminid, partyid: user?.id },
    skip: !adminid || !user?.id,
    refetchPolicy: 'network-only',
  });

  const account = accountData?.getAccountById;
  const ledgerId = account?.ledgerid?.id;
  const orders = (ordersData?.getSalesOrders ?? []) as any[];
  const payments = ((paymentsData?.getPayments ?? []) as any[]).filter(p => p.status !== false);

  // Authoritative outstanding = the party ledger balance (same source as Home
  // & Ledger), so the three screens never disagree.
  const { data: txData } = useQuery(GET_TRANSACTIONS, {
    variables: { adminid, ledgerid: ledgerId },
    skip: !adminid || !ledgerId,
    refetchPolicy: 'network-only',
  });
  const transactions = (txData?.getTransactions ?? []) as any[];

  const convertedOrders = orders.filter(o => o.isConverted && o.cancelStatus !== 'cancelled');

  const { totalOutstanding, totalPaid } = useMemo(() => {
    // Ledger balance: sum of this ledger's debits − credits across all entries.
    const balance = transactions.reduce((sum: number, t: any) => {
      const { debit, credit } = ledgerEntryTotals(t, ledgerId);
      return sum + debit - credit;
    }, 0);
    const paid = payments.reduce((s: number, p: any) => s + (p.amount ?? 0), 0);
    return { totalOutstanding: Math.max(balance, 0), totalPaid: paid };
  }, [transactions, ledgerId, payments]);

  const renderPayment = ({ item: p }: any) => {
    const mode = (p.mode ?? '').toLowerCase();
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => navigation.navigate('PaymentDetail', { payment: p, accountName: account?.name ?? user?.name })}
        style={[styles.payRow, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
      >
        <View style={[styles.payIcon, { backgroundColor: '#22c55e18' }]}>
          <Icon name={MODE_ICON[mode] ?? 'cash-multiple'} size={18} color="#22c55e" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.payCode, { color: colors.text }]}>{formatPaymentCode(p.paymentcode)}</Text>
          <Text style={[styles.paySub, { color: colors.subText }]} numberOfLines={1}>
            {titleCase(p.type) || 'Receipt'} · {titleCase(p.mode) || 'Cash'}
          </Text>
          <Text style={[styles.payDate, { color: colors.subText }]}>{formatDate(p.paymentdate)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.payAmt, { color: '#22c55e' }]}>{formatINR(p.amount)}</Text>
          <View style={[styles.payBadge, { backgroundColor: colors.brandSoft }]}>
            <Text style={[styles.payBadgeText, { color: colors.brand }]}>Active</Text>
          </View>
        </View>
        <Icon name="chevron-right" size={16} color={colors.subText} style={{ marginLeft: 2 }} />
      </TouchableOpacity>
    );
  };

  const ListHeader = () => (
    <>
      <Animated.View entering={FadeInUp.duration(400).delay(60)} style={styles.statsRow}>
        {[
          { icon: 'alert-circle-outline', value: formatINR(totalOutstanding), label: 'Total Outstanding', color: '#ef4444' },
          { icon: 'check-circle-outline', value: formatINR(totalPaid), label: 'Total Paid', color: '#22c55e' },
        ].map((stat) => (
          <View key={stat.label} style={[styles.statCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
            <View style={[styles.statIcon, { backgroundColor: stat.color + '18' }]}>
              <Icon name={stat.icon} size={16} color={stat.color} />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{stat.value}</Text>
            <Text style={[styles.statLabel, { color: colors.subText }]}>{stat.label}</Text>
          </View>
        ))}
      </Animated.View>

      {/* Payment history (admin "Manage Payments" style) */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Payment History</Text>
        <Text style={[styles.countText, { color: colors.subText }]}>
          {payments.length} payment{payments.length !== 1 ? 's' : ''}
        </Text>
      </View>
    </>
  );

  const ListFooter = () => {
    if (!convertedOrders.length) return null;
    return (
      <View style={{ marginTop: 20 }}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Outstanding Invoices</Text>
          <Text style={[styles.countText, { color: colors.subText }]}>
            {convertedOrders.length} invoice{convertedOrders.length !== 1 ? 's' : ''}
          </Text>
        </View>
        {convertedOrders.map((o: any) => (
          <View key={o.id} style={[styles.invCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
            <View style={styles.invTop}>
              <View>
                <Text style={[styles.invNum, { color: colors.text }]}>{formatBillNumber(o)}</Text>
                <Text style={[styles.invDate, { color: colors.subText }]}>{formatDate(o.billdate)}</Text>
              </View>
              <Text style={[styles.invAmt, { color: colors.brand }]}>{formatINR(o.totalamount)}</Text>
            </View>
            <View style={[styles.invDivider, { backgroundColor: colors.border }]} />
            {o.subtotal != null && <Row label="Subtotal" value={formatINR(o.subtotal)} colors={colors} />}
            {o.totaldiscount > 0 && <Row label="Discount" value={`−${formatINR(o.totaldiscount)}`} colors={colors} valueColor="#22c55e" />}
            {o.totalgst > 0 && <Row label="GST" value={formatINR(o.totalgst)} colors={colors} />}
          </View>
        ))}
      </View>
    );
  };

  const Empty = () => (
    <View style={styles.empty}>
      <Icon name="cash-remove" size={42} color={colors.border} />
      <Text style={[styles.emptyText, { color: colors.subText }]}>No payments yet</Text>
    </View>
  );

  const loading = ordersLoading || paymentsLoading;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

      <AppHeader label="Payments" />

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.brand} /></View>
      ) : (
        <DynamicFlashList
          data={payments}
          renderItem={renderPayment}
          estimatedItemSize={84}
          keyExtractor={(item: any) => item.id}
          ListHeaderComponent={<ListHeader />}
          ListFooterComponent={<ListFooter />}
          ListEmptyComponent={<Empty />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

function Row({ label, value, colors, valueColor }: { label: string; value: string; colors: any; valueColor?: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.subText }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: valueColor ?? colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 18, paddingBottom: 110 },

  statsRow: { flexDirection: 'row', gap: 10, marginTop: 14, marginBottom: 16 },
  statCard: {
    flex: 1, borderRadius: 18, borderWidth: 1, padding: 14, alignItems: 'flex-start',
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  statIcon: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statValue: { fontSize: 14, fontFamily: FONTS.bold, marginBottom: 2 },
  statLabel: { fontSize: 10, fontFamily: FONTS.regular },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontFamily: FONTS.bold },
  countText: { fontSize: 12, fontFamily: FONTS.regular },

  payRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, borderWidth: 1, padding: 13, marginBottom: 10,
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  payIcon: { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  payCode: { fontSize: 13, fontFamily: FONTS.bold },
  paySub: { fontSize: 12, fontFamily: FONTS.regular, marginTop: 1 },
  payDate: { fontSize: 11, fontFamily: FONTS.regular, marginTop: 2, opacity: 0.85 },
  payAmt: { fontSize: 14, fontFamily: FONTS.bold },
  payBadge: { marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  payBadgeText: { fontSize: 10, fontFamily: FONTS.semiBold },

  invCard: {
    borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10,
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  invTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  invNum: { fontSize: 14, fontFamily: FONTS.bold },
  invDate: { fontSize: 11, fontFamily: FONTS.regular, marginTop: 2 },
  invAmt: { fontSize: 15, fontFamily: FONTS.bold },
  invDivider: { height: 1, marginVertical: 10, opacity: 0.6 },

  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  detailLabel: { fontSize: 12, fontFamily: FONTS.regular },
  detailValue: { fontSize: 12, fontFamily: FONTS.semiBold },

  empty: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: FONTS.semiBold },
});
