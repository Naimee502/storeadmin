import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, TextInput, Alert, Modal, FlatList,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useMutation, useLazyQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { FONTS, useTheme } from '../../../../config';
import { BackHeader, BillAllocation } from '../../../../components';
import type { Allocation } from '../../../../components';
import { GET_ACCOUNT_LEDGERS, PREVIEW_INVOICE_JOURNAL, GET_ALL_TRANSACTIONS } from '../../../../apollo/queries/accounts';
import { ADD_TRANSACTION } from '../../../../apollo/mutations/accounts';
import type { RootState } from '../../../../store/rootreducer';

type EntryRow = { ledgerid: string; debit: string; credit: string; remarks: string };

// New Ledger Entry — the app counterpart of the admin Transaction page.
//  • Full Journal: pull an invoice's full journal (Dr Debtor / Cr Sales / Cr GST)
//    and post it as a TRANSACTION only — no payment, no bill settlement, the
//    party's outstanding/due is NOT changed (same as the admin "Full Journal").
//  • Receipt/Payment: Dr Cash/Bank · Cr Party against selected bills — this DOES
//    settle the bills (reduces the due), like collecting a payment.
export default function AddLedgerEntry() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors, isDark } = useTheme();
  const user = useSelector((s: RootState) => s.auth.user);
  const tenant = useSelector((s: RootState) => s.tenant);
  const adminid = tenant.adminId ?? '';

  const { partyId, partyName } = route.params ?? {};

  const { data: ledgerData } = useQuery(GET_ACCOUNT_LEDGERS, {
    variables: { adminId: adminid }, skip: !adminid, fetchPolicy: 'cache-and-network',
  });
  const ledgers = useMemo(() => ((ledgerData as any)?.getAccountLedgers ?? []).filter((l: any) => l.status !== false), [ledgerData]);

  const [addTransaction] = useMutation(ADD_TRANSACTION);
  const [fetchPreview] = useLazyQuery(PREVIEW_INVOICE_JOURNAL, { fetchPolicy: 'network-only' });

  // All transactions — to find which invoices already have a journal recorded
  // (so the same bill can't be recorded twice).
  const { data: txnData } = useQuery(GET_ALL_TRANSACTIONS, {
    variables: { adminid }, skip: !adminid, fetchPolicy: 'cache-and-network',
  });
  const recordedInvoiceIds = useMemo(() => {
    const ids: string[] = [];
    ((txnData as any)?.getTransactions ?? []).forEach((txn: any) => {
      (txn.invoices ?? []).forEach((inv: any) => { if (inv.invoiceid) ids.push(inv.invoiceid); });
    });
    return ids;
  }, [txnData]);

  const [narration, setNarration] = useState('');
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [entries, setEntries] = useState<EntryRow[]>([{ ledgerid: '', debit: '', credit: '', remarks: '' }]);
  const [pickerFor, setPickerFor] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Full Journal: pull each selected invoice's full accounting journal
  // (Dr Party · Cr Sales · Cr GST) — recorded as a plain journal; the due is NOT
  // changed. No settlement (this is not a payment collection).
  useEffect(() => {
    if (allocations.length === 0) return;
    let cancelled = false;
    (async () => {
      const lines: EntryRow[] = [];
      for (const a of allocations) {
        const res: any = await fetchPreview({ variables: { invoiceid: a.invoiceid, invoicemodel: a.invoicemodel } });
        (res?.data?.previewInvoiceJournal || []).forEach((l: any) => lines.push({
          ledgerid: l.ledgerid || '', debit: l.debit ? String(l.debit) : '', credit: l.credit ? String(l.credit) : '', remarks: l.remarks || '',
        }));
      }
      if (!cancelled && lines.length) setEntries(lines);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(allocations.map(a => a.invoiceid))]);

  const ledgerName = (id: string) => ledgers.find((l: any) => l.id === id)?.ledgername || 'Select ledger';
  const setEntry = (i: number, field: keyof EntryRow, v: string) =>
    setEntries(prev => prev.map((e, idx) => (idx === i ? { ...e, [field]: v } : e)));
  const addRow = () => setEntries(prev => [...prev, { ledgerid: '', debit: '', credit: '', remarks: '' }]);
  const removeRow = (i: number) => setEntries(prev => prev.filter((_, idx) => idx !== i));

  const totalDebit = entries.reduce((s, e) => s + (parseFloat(e.debit) || 0), 0);
  const totalCredit = entries.reduce((s, e) => s + (parseFloat(e.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const onPickLedger = (id: string) => {
    if (typeof pickerFor === 'number') setEntry(pickerFor, 'ledgerid', id);
    setPickerFor(null);
  };

  const handleSubmit = async () => {
    if (entries.some(e => !e.ledgerid)) { Alert.alert('Incomplete', 'Every entry needs a ledger.'); return; }
    if (!balanced) { Alert.alert('Not balanced', `Debit (${totalDebit.toFixed(2)}) must equal Credit (${totalCredit.toFixed(2)}).`); return; }
    setSubmitting(true);
    try {
      await addTransaction({
        variables: {
          input: {
            adminid, branchid: tenant.branchId,
            entrytype: 'manual',
            transactiondate: new Date().toISOString().slice(0, 10),
            narration: narration.trim() || `Ledger entry for ${partyName || ''}`,
            entries: entries.map(e => ({
              ledgerid: e.ledgerid,
              debit: parseFloat(e.debit) || 0,
              credit: parseFloat(e.credit) || 0,
              remarks: e.remarks,
            })),
            partyid: partyId || null,
            // Full Journal records the sale as a plain journal — the due is NOT
            // touched (settledamount 0). The invoice link is stored only so the same
            // bill can't be journal-recorded twice (it's hidden in the picker next time).
            invoices: allocations
              .filter(a => a.invoiceid)
              .map(a => ({ invoiceid: a.invoiceid, invoicemodel: a.invoicemodel, settledamount: 0 })),
            createdby_id: user?.id, createdby_name: user?.name, createdby_type: user?.role || 'party',
            status: true,
          },
        },
      });
      Alert.alert('Saved', 'Ledger entry recorded.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save the entry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />
      <BackHeader label="New Ledger Entry" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {!!partyName && (
          <View style={[styles.partyChip, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
            <View style={[styles.avatar, { backgroundColor: colors.brandSoft }]}>
              <Text style={{ color: colors.brand, fontFamily: FONTS.bold }}>{(partyName || 'P').charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={[styles.partyName, { color: colors.text }]}>{partyName}</Text>
          </View>
        )}

        <Text style={[styles.label, { color: colors.text }]}>Narration</Text>
        <View style={[styles.inputWrap, { backgroundColor: colors.raisedSurface, borderColor: colors.border }]}>
          <TextInput style={[styles.input, { color: colors.text }]} placeholder="Optional note" placeholderTextColor={colors.subText} value={narration} onChangeText={setNarration} />
        </View>

        {/* Record Full Journal — pick a bill to record its journal (no settlement) */}
        <Text style={[styles.section, { color: colors.text }]}>Record Full Journal (Against Invoices)</Text>
        <Text style={[styles.hint, { color: colors.subText }]}>
          Pick a bill — its full journal (Dr Party · Cr Sales · Cr GST) is recorded as a
          plain entry. The due is NOT changed. A bill already recorded won't appear again.
        </Text>

        <BillAllocation
          adminid={adminid}
          partyId={partyId}
          invoicemodel="SalesInvoice"
          value={allocations}
          onChange={setAllocations}
          mode="record"
          excludeInvoiceIds={recordedInvoiceIds}
        />

        {/* Entries */}
        <Text style={[styles.section, { color: colors.text }]}>Entries</Text>
        {entries.map((e, i) => (
          <View key={i} style={[styles.entryCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
            <TouchableOpacity style={[styles.ledgerSel, { borderColor: colors.border }]} onPress={() => setPickerFor(i)}>
              <Text style={[styles.ledgerSelText, { color: e.ledgerid ? colors.text : colors.subText }]} numberOfLines={1}>{ledgerName(e.ledgerid)}</Text>
              <Icon name="chevron-down" size={16} color={colors.subText} />
            </TouchableOpacity>
            <View style={styles.drcrRow}>
              <View style={[styles.drcr, { backgroundColor: colors.raisedSurface, borderColor: colors.border }]}>
                <Text style={[styles.drcrLbl, { color: colors.subText }]}>Dr</Text>
                <TextInput style={[styles.drcrInput, { color: colors.text }]} value={e.debit} onChangeText={(v) => setEntry(i, 'debit', v)} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.subText} />
              </View>
              <View style={[styles.drcr, { backgroundColor: colors.raisedSurface, borderColor: colors.border }]}>
                <Text style={[styles.drcrLbl, { color: colors.subText }]}>Cr</Text>
                <TextInput style={[styles.drcrInput, { color: colors.text }]} value={e.credit} onChangeText={(v) => setEntry(i, 'credit', v)} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.subText} />
              </View>
              {entries.length > 1 && (
                <TouchableOpacity style={styles.delBtn} onPress={() => removeRow(i)}>
                  <Icon name="trash-can-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
        <TouchableOpacity style={[styles.addRow, { borderColor: colors.brand }]} onPress={addRow}>
          <Icon name="plus" size={16} color={colors.brand} />
          <Text style={[styles.addRowText, { color: colors.brand }]}>Add Entry</Text>
        </TouchableOpacity>

        <View style={[styles.totals, { borderColor: colors.border }]}>
          <Text style={[styles.totText, { color: balanced ? '#16a34a' : '#ef4444' }]}>
            Dr ₹{totalDebit.toFixed(2)} · Cr ₹{totalCredit.toFixed(2)} {balanced ? '· Balanced' : '· Not balanced'}
          </Text>
        </View>

        <TouchableOpacity style={[styles.submit, { backgroundColor: submitting ? colors.border : colors.brand }]} onPress={handleSubmit} disabled={submitting} activeOpacity={0.88}>
          <Icon name="check-circle-outline" size={18} color="#fff" />
          <Text style={styles.submitText}>{submitting ? 'Saving…' : 'Save Ledger Entry'}</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={pickerFor !== null} transparent statusBarTranslucent animationType="fade" onRequestClose={() => setPickerFor(null)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setPickerFor(null)}>
          <View style={[styles.sheet, { backgroundColor: colors.background }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Select Ledger</Text>
            <FlatList
              data={ledgers}
              keyExtractor={(l: any) => l.id}
              style={{ maxHeight: 380 }}
              renderItem={({ item }: any) => (
                <TouchableOpacity style={[styles.sheetRow, { borderBottomColor: colors.border }]} onPress={() => onPickLedger(item.id)}>
                  <Text style={[styles.sheetRowText, { color: colors.text }]}>{item.ledgername}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 18, paddingBottom: 40 },

  partyChip: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 12, marginTop: 14, marginBottom: 4 },
  avatar: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  partyName: { fontSize: 15, fontFamily: FONTS.bold },

  label: { fontSize: 12.5, fontFamily: FONTS.semiBold, marginTop: 14, marginBottom: 6 },
  section: { fontSize: 14, fontFamily: FONTS.bold, marginTop: 20, marginBottom: 8 },
  hint: { fontSize: 11.5, fontFamily: FONTS.regular, marginBottom: 12 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 4 },
  input: { flex: 1, fontSize: 14, fontFamily: FONTS.regular, paddingVertical: 9 },

  segment: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  segBtn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  segText: { fontSize: 12, fontFamily: FONTS.semiBold, textAlign: 'center' },

  entryCard: { borderRadius: 14, borderWidth: 1, padding: 10, marginBottom: 10 },
  ledgerSel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
  ledgerSelText: { fontSize: 13.5, fontFamily: FONTS.semiBold, flex: 1 },
  drcrRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  drcr: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, paddingHorizontal: 10 },
  drcrLbl: { fontSize: 12, fontFamily: FONTS.bold, marginRight: 6 },
  drcrInput: { flex: 1, fontSize: 14, fontFamily: FONTS.semiBold, paddingVertical: 8, textAlign: 'right' },
  delBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

  addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 11, marginTop: 2 },
  addRowText: { fontSize: 13.5, fontFamily: FONTS.bold },

  totals: { borderTopWidth: 1, marginTop: 16, paddingTop: 12, alignItems: 'flex-end' },
  totText: { fontSize: 13, fontFamily: FONTS.bold },

  submit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 15, marginTop: 18 },
  submitText: { fontSize: 16, fontFamily: FONTS.bold, color: '#fff' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  sheetTitle: { fontSize: 16, fontFamily: FONTS.bold, marginBottom: 10 },
  sheetRow: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  sheetRowText: { fontSize: 14, fontFamily: FONTS.regular },
});
