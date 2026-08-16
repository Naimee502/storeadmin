import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, Alert,
  TextInput, KeyboardAvoidingView, Platform, ScrollView, Modal, FlatList,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { COLORS, FONTS, useTheme } from '../../../../config';
import { BackHeader } from '../../../../components';
import { ADD_PAYMENT, MARK_SALES_INVOICE_DELIVERED } from '../../../../apollo/mutations/accounts';
import { PREVIEW_ALLOCATION } from '../../../../apollo/queries/accounts';
import { GET_ACCOUNT_LEDGERS } from '../../../../apollo/queries/accounts';
import type { RootState } from '../../../../store/rootreducer';

type PaymentMode = 'cash' | 'bank' | 'upi' | 'card' | 'cheque' | 'other';

const MODES: { id: PaymentMode; label: string; icon: string; color: string }[] = [
  { id: 'cash',   label: 'Cash',   icon: 'cash',                color: '#22c55e' },
  { id: 'bank',   label: 'Bank',   icon: 'bank',                color: '#0ea5e9' },
  { id: 'upi',    label: 'UPI',    icon: 'qrcode-scan',         color: '#6366f1' },
  { id: 'card',   label: 'Card',   icon: 'credit-card-outline', color: '#a855f7' },
  { id: 'cheque', label: 'Cheque', icon: 'checkbook',           color: '#f59e0b' },
  { id: 'other',  label: 'Other',  icon: 'dots-horizontal',     color: '#64748b' },
];

export default function DeliveryCollectPayment() {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const { colors, isDark } = useTheme();

  const { orderId, orderNum, partyId, partyName, amount = 0 } = route.params ?? {};

  const tenant  = useSelector((s: RootState) => s.tenant);
  const user    = useSelector((s: RootState) => s.auth.user);
  const adminid = tenant.adminId ?? '';

  const { data: ledgerData } = useQuery(GET_ACCOUNT_LEDGERS, {
    variables: { adminId: adminid }, skip: !adminid, fetchPolicy: 'cache-and-network',
  });
  // ALL active ledgers — same as the admin panel's "Cash / Bank Ledger" dropdown.
  const cashBankLedgers = useMemo(
    () => ((ledgerData as any)?.getAccountLedgers ?? []).filter((l: any) => l.status !== false),
    [ledgerData],
  );

  const [addPayment]    = useMutation(ADD_PAYMENT);
  // COD fills the delivered bill first (priorityInvoiceId), then the opening
  // balance, then older bills — money handed over for THIS delivery must not
  // silently disappear into an older debt.
  const [previewAllocation] = useLazyQuery(PREVIEW_ALLOCATION, { fetchPolicy: 'network-only' });
  const [markDelivered] = useMutation(MARK_SALES_INVOICE_DELIVERED);

  const [mode,       setMode]       = useState<PaymentMode>('cash');
  const [ledgerId,   setLedgerId]   = useState<string>('');
  const [ledgerPickerOpen, setLedgerPickerOpen] = useState(false);
  const [inputAmt,   setInputAmt]   = useState(amount > 0 ? String(amount) : '');
  const [reference,  setReference]  = useState('');
  const [notes,      setNotes]      = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedLedgerName = useMemo(
    () => cashBankLedgers.find((l: any) => l.id === ledgerId)?.ledgername ?? '',
    [cashBankLedgers, ledgerId],
  );

  // Auto-pick a sensible deposit ledger by mode (cash→Cash, bank→Bank, else first).
  useEffect(() => {
    if (ledgerId || cashBankLedgers.length === 0) return;
    const byName = (re: RegExp) => cashBankLedgers.find((l: any) => re.test(l.ledgername || ''));
    const match =
      mode === 'cash' ? (byName(/cash/i) || cashBankLedgers[0])
      : mode === 'bank' ? (byName(/bank/i) || byName(/cash/i) || cashBankLedgers[0])
      : (byName(/cash/i) || byName(/bank/i) || cashBankLedgers[0]);
    if (match) setLedgerId(match.id);
  }, [cashBankLedgers, mode, ledgerId]);

  const selectedMode = MODES.find(m => m.id === mode)!;
  const parsedAmount = parseFloat(inputAmt) || 0;

  const handleSubmit = async () => {
    if (!parsedAmount || parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid collection amount.');
      return;
    }
    if ((mode === 'upi' || mode === 'cheque') && !reference.trim()) {
      Alert.alert('Reference Required', mode === 'upi' ? 'Please enter the UPI transaction ID.' : 'Please enter the cheque number.');
      return;
    }
    if (!adminid || !tenant.branchId) { Alert.alert('Branch not set', 'No branch assigned. Contact admin.'); return; }
    if (!partyId) { Alert.alert('Missing party', 'Could not resolve the party for this order.'); return; }
    // Deposit ledger: whichever the user picked from the dropdown.
    const depositLedger = cashBankLedgers.find((l: any) => l.id === ledgerId) ?? cashBankLedgers[0];
    if (!depositLedger) { Alert.alert('No ledger', 'Ask the admin to create a Cash / Bank ledger.'); return; }

    // Ask the server where this lands, show it, then write it. It also avoids a
    // hard failure: allocating the whole amount to a bill that owes less now
    // trips the server's over-settlement guard, so any excess has to be routed
    // to the opening balance / older bills instead of stuffed onto this one.
    let proposal: any = null;
    try {
      const res: any = await previewAllocation({
        variables: {
          partyid: partyId,
          invoicemodel: 'SalesInvoice',
          adminid,
          branchid: tenant.branchId,
          amount: parsedAmount,
          priorityInvoiceId: orderId || null,
        },
      });
      proposal = res?.data?.previewAllocation ?? null;
    } catch {
      // Preview is a courtesy; the receipt is still valid without it.
    }

    const breakdown = (() => {
      if (!proposal) return '';
      const money = (n: any) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
      const rows: string[] = [];
      (proposal.lines ?? []).forEach((l: any) =>
        rows.push(`INV-${l.billnumber}  ${money(l.settledamount)}${l.fullysettled ? '  (cleared)' : '  (part)'}`),
      );
      if (proposal.openingsettled > 0) rows.push(`Opening balance  ${money(proposal.openingsettled)}`);
      if (proposal.unallocated > 0) rows.push(`On Account  ${money(proposal.unallocated)}`);
      return rows.length ? `\n\nApplied as:\n${rows.join('\n')}` : '';
    })();

    Alert.alert(
      'Confirm Collection',
      `Record ${selectedMode.label} payment of ₹${parsedAmount.toLocaleString('en-IN')} from ${partyName} for ${orderNum}? This also marks the order delivered.${breakdown}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setSubmitting(true);
            try {
              await addPayment({
                variables: { input: {
                  adminid, branchid: tenant.branchId, type: 'receipt', mode,
                  partyid: partyId, ledgerid: depositLedger.id, amount: parsedAmount,
                  // COD settles the delivered invoice itself (Tally Agst Ref),
                  // so the invoice's outstanding clears on collection.
                  invoices: (proposal?.lines ?? []).map((l: any) => ({
                    invoiceid: l.invoiceid,
                    invoicemodel: l.invoicemodel,
                    settledamount: l.settledamount,
                    discount: 0,
                    commission: 0,
                    allocatedmode: 'auto_fifo',
                  })),
                  openingsettled: proposal?.openingsettled ?? 0,
                  reference: reference.trim() || null, remarks: notes.trim() || `COD for ${orderNum}`,
                  paymentdate: new Date().toISOString().slice(0, 10),
                  createdby_id: user?.id, createdby_name: user?.name, createdby_type: 'deliveryboy', status: true,
                } },
              });
              // Mark the order delivered on COD collection.
              if (orderId) {
                try { await markDelivered({ variables: { id: orderId, byId: user?.id, byName: user?.name, byType: 'deliveryboy' } }); } catch {}
              }
              Alert.alert(
                'Payment Recorded!',
                `₹${parsedAmount.toLocaleString('en-IN')} via ${selectedMode.label} collected from ${partyName}.`,
                [{ text: 'OK', onPress: () => navigation.goBack() }],
              );
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Could not record payment.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
        <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

        <BackHeader label="Collect Payment" />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Order card */}
          <View style={[styles.orderCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
            <View style={[styles.orderIconWrap, { backgroundColor: colors.brandSoft }]}>
              <Icon name="truck-delivery-outline" size={22} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.orderNum, { color: colors.text }]}>{orderNum}</Text>
              <Text style={[styles.partyName, { color: colors.subText }]}>{partyName}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.orderAmt, { color: colors.text }]}>₹{amount.toLocaleString('en-IN')}</Text>
              <Text style={[styles.orderAmtLabel, { color: colors.subText }]}>Order value</Text>
            </View>
          </View>

          {/* Use full amount button */}
          {amount > 0 && parsedAmount !== amount && (
            <TouchableOpacity
              style={[styles.useFullBtn, { backgroundColor: colors.brandSoft, borderColor: colors.brand + '44' }]}
              onPress={() => setInputAmt(String(amount))}
            >
              <Icon name="lightning-bolt" size={14} color={colors.brand} />
              <Text style={[styles.useFullText, { color: colors.brand }]}>
                Use full amount  ₹{amount.toLocaleString('en-IN')}
              </Text>
            </TouchableOpacity>
          )}

          {/* Payment mode */}
          <Text style={[styles.sectionLabel, { color: colors.text }]}>Payment Mode</Text>
          <View style={styles.modeRow}>
            {MODES.map(m => {
              const active = mode === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.modeCard, {
                    backgroundColor: active ? m.color + '18' : colors.cardGlass,
                    borderColor:     active ? m.color         : colors.border,
                  }]}
                  onPress={() => { setMode(m.id); setReference(''); }}
                  activeOpacity={0.8}
                >
                  <Icon name={m.icon} size={22} color={active ? m.color : colors.subText} />
                  <Text style={[styles.modeLabel, { color: active ? m.color : colors.subText }]}>{m.label}</Text>
                  {active && (
                    <View style={[styles.modeCheck, { backgroundColor: m.color }]}>
                      <Icon name="check" size={9} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Amount */}
          <Text style={[styles.sectionLabel, { color: colors.text }]}>Amount (₹)</Text>
          <View style={[styles.inputWrap, { backgroundColor: colors.raisedSurface, borderColor: colors.border }]}>
            <Text style={[styles.currencySymbol, { color: colors.brand }]}>₹</Text>
            <TextInput
              style={[styles.amountInput, { color: colors.text }]}
              placeholder="0.00"
              placeholderTextColor={colors.subText}
              value={inputAmt}
              onChangeText={setInputAmt}
              keyboardType="numeric"
              returnKeyType="done"
            />
          </View>

          {/* Cash / Bank Ledger — dropdown with ALL ledgers (same as admin panel) */}
          <Text style={[styles.sectionLabel, { color: colors.text }]}>Cash / Bank Ledger</Text>
          {cashBankLedgers.length === 0 ? (
            <View style={[styles.inputWrap, { backgroundColor: colors.raisedSurface, borderColor: colors.border }]}>
              <Icon name="information-outline" size={16} color={colors.subText} style={{ marginRight: 8 }} />
              <Text style={[styles.textInput, { color: colors.subText, paddingVertical: 8 }]}>
                No ledger found. Ask the admin to create one.
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.inputWrap, { backgroundColor: colors.raisedSurface, borderColor: colors.border }]}
              onPress={() => setLedgerPickerOpen(true)}
              activeOpacity={0.8}
            >
              <Icon name="bank-outline" size={16} color={colors.subText} style={{ marginRight: 8 }} />
              <Text style={[styles.textInput, { color: selectedLedgerName ? colors.text : colors.subText, paddingVertical: 10 }]} numberOfLines={1}>
                {selectedLedgerName || 'Select ledger'}
              </Text>
              <Icon name="chevron-down" size={18} color={colors.subText} />
            </TouchableOpacity>
          )}

          {/* Reference — any non-cash mode (UTR / cheque no. / card / etc.) */}
          {mode !== 'cash' && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.text }]}>
                {mode === 'upi' ? 'UPI Transaction ID'
                  : mode === 'cheque' ? 'Cheque Number'
                  : mode === 'card' ? 'Card / Approval Ref'
                  : 'Reference'}
              </Text>
              <View style={[styles.inputWrap, { backgroundColor: colors.raisedSurface, borderColor: colors.border }]}>
                <Icon name={mode === 'cheque' ? 'numeric' : 'identifier'} size={18} color={colors.subText} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.textInput, { color: colors.text }]}
                  placeholder="Cheque no., UTR, etc."
                  placeholderTextColor={colors.subText}
                  value={reference}
                  onChangeText={setReference}
                  autoCapitalize="characters"
                  returnKeyType="done"
                />
              </View>
            </>
          )}

          {/* Notes */}
          <Text style={[styles.sectionLabel, { color: colors.text }]}>Notes (optional)</Text>
          <View style={[styles.inputWrap, styles.notesWrap, { backgroundColor: colors.raisedSurface, borderColor: colors.border }]}>
            <TextInput
              style={[styles.textInput, styles.notesInput, { color: colors.text }]}
              placeholder="Add a note..."
              placeholderTextColor={colors.subText}
              value={notes}
              onChangeText={setNotes}
              multiline numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Summary strip */}
          {parsedAmount > 0 && (
            <View style={[styles.summaryStrip, { backgroundColor: selectedMode.color + '14', borderColor: selectedMode.color + '44' }]}>
              <Icon name={selectedMode.icon} size={16} color={selectedMode.color} />
              <Text style={[styles.summaryText, { color: selectedMode.color }]}>
                Collecting{' '}
                <Text style={{ fontFamily: FONTS.bold }}>₹{parsedAmount.toLocaleString('en-IN')}</Text>
                {' '}via {selectedMode.label}
              </Text>
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: submitting ? colors.border : selectedMode.color }]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.88}
          >
            {submitting ? (
              <Text style={styles.submitBtnText}>Recording…</Text>
            ) : (
              <>
                <Icon name="check-circle-outline" size={18} color="#fff" />
                <Text style={styles.submitBtnText}>
                  {parsedAmount > 0 ? `Record ₹${parsedAmount.toLocaleString('en-IN')}` : 'Record Payment'}
                </Text>
              </>
            )}
          </TouchableOpacity>

        </ScrollView>

        {/* Cash / Bank ledger picker */}
        <Modal visible={ledgerPickerOpen} transparent statusBarTranslucent animationType="fade" onRequestClose={() => setLedgerPickerOpen(false)}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setLedgerPickerOpen(false)}>
            <View style={[styles.sheet, { backgroundColor: colors.background }]}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Select Cash / Bank Ledger</Text>
              <FlatList
                data={cashBankLedgers}
                keyExtractor={(l: any) => l.id}
                style={{ maxHeight: 400 }}
                renderItem={({ item }: any) => {
                  const active = ledgerId === item.id;
                  return (
                    <TouchableOpacity
                      style={[styles.sheetRow, { borderBottomColor: colors.border }]}
                      onPress={() => { setLedgerId(item.id); setLedgerPickerOpen(false); }}
                    >
                      <Icon name={item.ledgertype === 'bank' ? 'bank-outline' : 'cash'} size={16} color={active ? colors.brand : colors.subText} style={{ marginRight: 10 }} />
                      <Text style={[styles.sheetRowText, { color: active ? colors.brand : colors.text }]} numberOfLines={1}>{item.ledgername}</Text>
                      {active && <Icon name="check" size={16} color={colors.brand} style={{ marginLeft: 'auto' }} />}
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll:    { paddingHorizontal: 18, paddingBottom: 40 },

  orderCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 18, borderWidth: 1, padding: 14, marginTop: 14, marginBottom: 12,
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  orderIconWrap:  { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  orderNum:       { fontSize: 14, fontFamily: FONTS.bold, marginBottom: 2 },
  partyName:      { fontSize: 12, fontFamily: FONTS.regular },
  orderAmt:       { fontSize: 15, fontFamily: FONTS.bold },
  orderAmtLabel:  { fontSize: 10, fontFamily: FONTS.regular, marginTop: 2 },

  useFullBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 18,
  },
  useFullText: { fontSize: 13, fontFamily: FONTS.semiBold },

  sectionLabel: { fontSize: 13, fontFamily: FONTS.semiBold, marginBottom: 10 },

  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  modeCard: {
    flexBasis: '30%', flexGrow: 1, alignItems: 'center', gap: 6,
    borderRadius: 16, borderWidth: 1.5, paddingVertical: 14,
    position: 'relative',
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1,
  },
  modeLabel: { fontSize: 12, fontFamily: FONTS.semiBold },
  modeCheck: {
    position: 'absolute', top: 6, right: 6,
    width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center',
  },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 4, marginBottom: 18,
  },
  notesWrap:      { paddingVertical: 10, alignItems: 'flex-start' },
  currencySymbol: { fontSize: 20, fontFamily: FONTS.bold, marginRight: 6 },
  amountInput:    { flex: 1, fontSize: 26, fontFamily: FONTS.bold, paddingVertical: 10 },
  textInput:      { flex: 1, fontSize: 14, fontFamily: FONTS.regular, paddingVertical: 8 },
  notesInput:     { minHeight: 72 },

  summaryStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 18,
  },
  summaryText: { fontSize: 13, fontFamily: FONTS.regular },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 18, paddingVertical: 16, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  submitBtnText: { fontSize: 16, fontFamily: FONTS.bold, color: '#fff' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  sheetTitle: { fontSize: 16, fontFamily: FONTS.bold, marginBottom: 10 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  sheetRowText: { fontSize: 14, fontFamily: FONTS.regular },
});
