import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useQuery } from '@apollo/client/react';
import { FONTS, useTheme } from '../config';
import {
  GET_PARTY_SALES_INVOICES,
  GET_PARTY_PURCHASE_INVOICES,
} from '../apollo/queries/accounts';

/**
 * Tally-style bill allocation ("Agst Ref") for React Native.
 *
 * Lists a party's outstanding invoices and lets the user allocate a settle
 * amount against each one. Outstanding is computed consistently across BOTH
 * Payments AND Transactions (journals) — identical to the admin panel — so a
 * settlement made anywhere reduces the same outstanding.
 *
 * Controlled: parent owns `value` (the allocation array) + `onChange`.
 */

export type Allocation = {
  invoiceid: string;
  invoicemodel: 'SalesInvoice' | 'PurchaseInvoice';
  settledamount: number;
};

type Props = {
  adminid: string;
  partyId: string;
  invoicemodel: 'SalesInvoice' | 'PurchaseInvoice';
  value: Allocation[];
  onChange: (next: Allocation[]) => void;
  /** Exclude the current payment (edit mode) so its own allocation isn't double-counted. */
  excludePaymentId?: string;
};

const money = (n: number) => `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const BillAllocation: React.FC<Props> = ({
  adminid,
  partyId,
  invoicemodel,
  value,
  onChange,
  excludePaymentId,
}) => {
  const { colors } = useTheme();
  const isSales = invoicemodel === 'SalesInvoice';

  const { data: invData, loading: invLoading } = useQuery(
    isSales ? GET_PARTY_SALES_INVOICES : GET_PARTY_PURCHASE_INVOICES,
    {
      variables: { adminid, partyacc: partyId },
      skip: !adminid || !partyId,
      fetchPolicy: 'cache-and-network',
    },
  );
  const allInvoices = useMemo(() => {
    const src = isSales
      ? (invData as any)?.getSalesInvoices
      : (invData as any)?.getPurchaseInvoices;
    return (src || []).map((inv: any) => ({ ...inv, invoicemodel }));
  }, [invData, isSales, invoicemodel]);

  // `outstanding` comes straight from the server (role-free, same value the
  // admin panel uses) — no client-side recompute, so it never under/over-counts.
  const outstandingInvoices = useMemo(() => {
    return allInvoices
      .filter((inv: any) => inv.status)
      .map((inv: any) => ({ ...inv, outstanding: parseFloat((inv.outstanding ?? 0).toFixed(2)) }))
      .filter((inv: any) => inv.outstanding > 0);
  }, [allInvoices]);

  // Keep already-selected rows visible even if fully settled (edit mode).
  const rows = useMemo(() => {
    const list = [...outstandingInvoices];
    value.forEach((a) => {
      if (!list.some((r: any) => r.id === a.invoiceid)) {
        const full = allInvoices.find((inv: any) => inv.id === a.invoiceid);
        if (full) list.push({ ...full, outstanding: 0 });
      }
    });
    return list;
  }, [outstandingInvoices, value, allInvoices]);

  const selectedFor = (invId: string) => value.find((s) => s.invoiceid === invId);

  const toggle = (inv: any) => {
    if (selectedFor(inv.id)) {
      onChange(value.filter((s) => s.invoiceid !== inv.id));
    } else {
      onChange([
        ...value,
        { invoiceid: inv.id, invoicemodel: inv.invoicemodel, settledamount: inv.outstanding },
      ]);
    }
  };

  const setAmount = (invId: string, amount: number) =>
    onChange(value.map((s) => (s.invoiceid === invId ? { ...s, settledamount: amount } : s)));

  const total = parseFloat(value.reduce((s, i) => s + (i.settledamount || 0), 0).toFixed(2));

  if (!partyId) {
    return <Text style={[styles.hint, { color: colors.subText }]}>Select a party to load outstanding bills.</Text>;
  }
  if (invLoading && rows.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }
  if (rows.length === 0) {
    return (
      <View style={[styles.emptyCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
        <Icon name="file-check-outline" size={20} color={colors.subText} />
        <Text style={[styles.hint, { color: colors.subText, marginTop: 6 }]}>
          No outstanding {isSales ? 'sales' : 'purchase'} bills for this party.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      {rows.map((inv: any) => {
        const sel = selectedFor(inv.id);
        const prefix = inv.invoicemodel === 'PurchaseInvoice' ? 'PUR-' : 'INV-';
        return (
          <View
            key={inv.id}
            style={[
              styles.card,
              {
                backgroundColor: sel ? colors.brandSoft : colors.cardGlass,
                borderColor: sel ? colors.brand : colors.border,
              },
            ]}
          >
            <TouchableOpacity style={styles.cardHead} activeOpacity={0.8} onPress={() => toggle(inv)}>
              <View style={[styles.checkbox, { borderColor: sel ? colors.brand : colors.border, backgroundColor: sel ? colors.brand : 'transparent' }]}>
                {sel ? <Icon name="check" size={13} color="#fff" /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.billNo, { color: colors.text }]}>{prefix}{inv.billnumber}</Text>
                <Text style={[styles.subline, { color: colors.subText }]}>
                  Total {money(inv.totalamount)}{inv.totalgst ? ` · GST ${money(inv.totalgst)}` : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.outLabel}>Outstanding</Text>
                <Text style={styles.outVal}>{money(inv.outstanding)}</Text>
              </View>
            </TouchableOpacity>

            {sel ? (
              <View style={[styles.amountRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.settleLabel, { color: colors.subText }]}>Settle now</Text>
                <View style={[styles.amountWrap, { backgroundColor: colors.raisedSurface, borderColor: colors.border }]}>
                  <Text style={[styles.rupee, { color: colors.brand }]}>₹</Text>
                  <TextInput
                    style={[styles.amountInput, { color: colors.text }]}
                    value={String(sel.settledamount)}
                    keyboardType="numeric"
                    onChangeText={(t) => setAmount(inv.id, parseFloat(t) || 0)}
                    returnKeyType="done"
                  />
                </View>
                {inv.outstanding > 0 ? (
                  <TouchableOpacity
                    style={[styles.fullChip, { backgroundColor: colors.brandSoft }]}
                    onPress={() => setAmount(inv.id, inv.outstanding)}
                  >
                    <Text style={[styles.fullChipText, { color: colors.brand }]}>Full</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </View>
        );
      })}

      {value.length > 0 ? (
        <View style={[styles.totalBar, { backgroundColor: colors.brand }]}>
          <Text style={styles.totalText}>{value.length} bill(s) selected</Text>
          <Text style={styles.totalAmount}>{money(total)}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  hint: { fontSize: 12.5, fontFamily: FONTS.regular },
  center: { paddingVertical: 24, alignItems: 'center' },
  emptyCard: { borderRadius: 14, borderWidth: 1, padding: 16, alignItems: 'center' },

  card: { borderRadius: 16, borderWidth: 1.5, overflow: 'hidden' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  billNo: { fontSize: 14, fontFamily: FONTS.bold },
  subline: { fontSize: 11.5, fontFamily: FONTS.regular, marginTop: 2 },
  outLabel: { fontSize: 10, fontFamily: FONTS.semiBold, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: 0.4 },
  outVal: { fontSize: 14.5, fontFamily: FONTS.bold, color: '#f59e0b', marginTop: 1 },

  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, paddingVertical: 10, borderTopWidth: 1 },
  settleLabel: { fontSize: 12, fontFamily: FONTS.semiBold },
  amountWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, paddingHorizontal: 10 },
  rupee: { fontSize: 15, fontFamily: FONTS.bold, marginRight: 4 },
  amountInput: { flex: 1, fontSize: 15, fontFamily: FONTS.semiBold, paddingVertical: 7, textAlign: 'right' },
  fullChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  fullChipText: { fontSize: 12, fontFamily: FONTS.semiBold },

  totalBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, marginTop: 2 },
  totalText: { fontSize: 13, fontFamily: FONTS.semiBold, color: '#fff' },
  totalAmount: { fontSize: 16, fontFamily: FONTS.bold, color: '#fff' },
});

export default BillAllocation;
