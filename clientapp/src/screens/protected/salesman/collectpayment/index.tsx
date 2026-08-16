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
import { BackHeader, BillAllocation } from '../../../../components';
import type { Allocation } from '../../../../components';
import { ADD_PAYMENT } from '../../../../apollo/mutations/accounts';
import { PREVIEW_ALLOCATION } from '../../../../apollo/queries/accounts';
import { usePunchGate } from '../../../../apollo/hooks/attendance';
import { GET_ACCOUNT_LEDGERS, GET_ACCOUNT, GET_TRANSACTIONS, GET_ADMIN_SETTINGS } from '../../../../apollo/queries/accounts';
import { ledgerEntryTotals } from '../../../../utils';
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

export default function CollectPayment() {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const { colors, isDark } = useTheme();

  const { partyId, partyName, outstanding: outstandingParam = 0 } = route.params ?? {};

  const tenant  = useSelector((s: RootState) => s.tenant);
  const user    = useSelector((s: RootState) => s.auth.user);
  const adminid = tenant.adminId ?? '';

  // Compute the party's live outstanding here too, so it always shows correctly
  // regardless of what (if anything) was passed in via navigation params.
  const { data: accountData } = useQuery(GET_ACCOUNT, {
    variables: { id: partyId, adminId: adminid },
    skip: !adminid || !partyId,
    fetchPolicy: 'cache-and-network',
  });
  const partyLedgerId = (accountData as any)?.getAccountById?.ledgerid?.id ?? null;

  const { data: txData } = useQuery(GET_TRANSACTIONS, {
    variables: { adminid, ledgerid: partyLedgerId },
    skip: !adminid || !partyLedgerId,
    fetchPolicy: 'cache-and-network',
  });
  const liveOutstanding = useMemo(() => {
    const txs = (txData as any)?.getTransactions;
    if (!partyLedgerId || !txs) return outstandingParam;
    return txs.reduce((run: number, tx: any) => {
      const { debit, credit } = ledgerEntryTotals(tx, partyLedgerId);
      return run + debit - credit;
    }, 0);
  }, [txData, partyLedgerId, outstandingParam]);
  const outstanding = Math.max(0, Math.round(liveOutstanding * 100) / 100);

  // Cash / Bank ledger this receipt is deposited to — same as the admin panel's
  // "Cash / Bank Ledger" selector. Dr this ledger, Cr the party (on-account / Tally style).
  const { data: ledgerData } = useQuery(GET_ACCOUNT_LEDGERS, {
    variables: { adminId: adminid },
    skip: !adminid,
    fetchPolicy: 'cache-and-network',
  });
  // ALL active ledgers — same as the admin panel's "Cash / Bank Ledger" dropdown
  // (any ledger can be the deposit account).
  const cashBankLedgers = useMemo(
    () => ((ledgerData as any)?.getAccountLedgers ?? []).filter((l: any) => l.status !== false),
    [ledgerData],
  );

  // Discount & Commission feature flag (per business) — same as admin Add Payment.
  const { data: settingsData } = useQuery(GET_ADMIN_SETTINGS, {
    variables: { adminid }, skip: !adminid, fetchPolicy: 'cache-and-network',
  });
  const dcEnabled = !!(settingsData as any)?.getAdminSettings?.enablePaymentDiscountCommission;

  const [addPayment] = useMutation(ADD_PAYMENT);
  // Same server-side FIFO the admin panel uses: opening balance first, then the
  // oldest bills. network-only so the collector always sees live figures.
  const [previewAllocation] = useLazyQuery(PREVIEW_ALLOCATION, { fetchPolicy: 'network-only' });
  const { blocked: punchBlocked } = usePunchGate();

  const [mode,      setMode]      = useState<PaymentMode>('cash');
  const [ledgerId,  setLedgerId]  = useState<string>('');
  const [ledgerPickerOpen, setLedgerPickerOpen] = useState(false);
  const selectedLedgerName = useMemo(
    () => cashBankLedgers.find((l: any) => l.id === ledgerId)?.ledgername ?? '',
    [cashBankLedgers, ledgerId],
  );
  const [amount,    setAmount]    = useState('');
  // On-account = plain receipt (Cr party); Settle bills = Tally Agst Ref.
  const [settleMode, setSettleMode] = useState<'onaccount' | 'bills'>('onaccount');
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  // Cash actually collected = bills cleared − discount + commission.
  const allocatedTotal = useMemo(
    () => parseFloat(
      allocations.reduce(
        (s, a) => s + (a.settledamount || 0) - (dcEnabled ? (a.discount || 0) : 0) + (dcEnabled ? (a.commission || 0) : 0),
        0,
      ).toFixed(2),
    ),
    [allocations, dcEnabled],
  );
  const [amountTouched, setAmountTouched] = useState(false);
  const [reference, setReference] = useState('');
  const [notes,     setNotes]     = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Prefill the amount with the live outstanding once it's known, unless the
  // salesman has already typed something.
  useEffect(() => {
    if (!amountTouched && outstanding > 0) setAmount(String(outstanding));
  }, [outstanding, amountTouched]);

  // Default the deposit ledger to one matching the mode (cash→cash, else→bank),
  // falling back to the first available cash/bank ledger.
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
  const parsedAmount = settleMode === 'bills' ? allocatedTotal : (parseFloat(amount) || 0);

  const handleSubmit = async () => {
    if (punchBlocked) { Alert.alert('Punch in required', 'Please punch in from the Attendance tab before collecting payment.'); return; }
    if (!parsedAmount || parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount.');
      return;
    }
    if (!adminid || !tenant.branchId) {
      Alert.alert('Branch not set', 'No branch is assigned to your account. Please contact the admin.');
      return;
    }
    if (!ledgerId) {
      Alert.alert('Select deposit account', 'Choose which Cash / Bank ledger this payment is deposited to.');
      return;
    }

    // Direct / On Account: work out where the money will land and show it BEFORE
    // writing anything, exactly like the admin panel's Confirm Auto Settlement.
    // Bill-wise needs no preview — the collector picked the rows themselves.
    let proposal: any = null;
    if (settleMode !== 'bills') {
      try {
        const res: any = await previewAllocation({
          variables: {
            partyid: partyId,
            invoicemodel: 'SalesInvoice',
            adminid,
            branchid: tenant.branchId,
            amount: parsedAmount,
          },
        });
        proposal = res?.data?.previewAllocation ?? null;
      } catch {
        // Preview is a courtesy; a plain on-account receipt is still valid.
      }
    }

    const breakdown = (() => {
      if (settleMode === 'bills' || !proposal) return '';
      const money = (n: any) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
      const rows: string[] = [];
      if (proposal.openingsettled > 0) rows.push(`Opening balance  ${money(proposal.openingsettled)}`);
      (proposal.lines ?? []).forEach((l: any) =>
        rows.push(`INV-${l.billnumber}  ${money(l.settledamount)}${l.fullysettled ? '  (cleared)' : '  (part)'}`),
      );
      if (proposal.unallocated > 0) rows.push(`On Account  ${money(proposal.unallocated)}`);
      // The opening balance is the oldest debt, so it is cleared before any
      // invoice. Say so when it swallowed the whole amount — otherwise the
      // collector records the payment and the bills look untouched.
      const billsDue = Math.max(0, (proposal.totaloutstanding || 0) - (proposal.openingdue || 0));
      const note =
        proposal.openingsettled > 0 && !(proposal.lines ?? []).length && billsDue > 0.005
          ? `\n\nOpening balance is cleared first, so bills worth ${money(billsDue)} stay pending. Use Invoice-wise to pay a specific bill.`
          : '';
      return rows.length ? `\n\nApplied as:\n${rows.join('\n')}${note}` : '';
    })();

    Alert.alert(
      'Confirm Payment',
      `Record ${selectedMode.label} payment of ₹${parsedAmount.toLocaleString('en-IN')} from ${partyName}?${breakdown}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setSubmitting(true);
            try {
              await addPayment({
                variables: {
                  input: {
                    adminid,
                    branchid: tenant.branchId,
                    type: 'receipt',
                    mode,
                    partyid: partyId,
                    ledgerid: ledgerId,
                    amount: parsedAmount,
                    invoices:
                      settleMode === 'bills'
                        ? allocations
                            .filter(a => a.invoiceid)
                            .map(a => ({
                              invoiceid: a.invoiceid,
                              invoicemodel: a.invoicemodel,
                              settledamount: a.settledamount,
                              discount: dcEnabled ? (a.discount || 0) : 0,
                              commission: dcEnabled ? (a.commission || 0) : 0,
                              allocatedmode: 'manual',
                            }))
                        : (proposal?.lines ?? []).map((l: any) => ({
                            invoiceid: l.invoiceid,
                            invoicemodel: l.invoicemodel,
                            settledamount: l.settledamount,
                            discount: 0,
                            commission: 0,
                            allocatedmode: 'auto_fifo',
                          })),
                    // Part of this receipt that cleared the opening balance.
                    openingsettled: settleMode === 'bills' ? 0 : (proposal?.openingsettled ?? 0),
                    reference: reference.trim() || null,
                    remarks: notes.trim() || null,
                    paymentdate: new Date().toISOString().slice(0, 10),
                    createdby_id: user?.id,
                    createdby_name: user?.name,
                    createdby_type: user?.role || 'staff',
                    status: true,
                  },
                },
              });
              Alert.alert(
                'Payment Recorded!',
                `₹${parsedAmount.toLocaleString('en-IN')} via ${selectedMode.label} collected from ${partyName}.`,
                [{ text: 'OK', onPress: () => navigation.goBack() }],
              );
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Could not record payment. Please try again.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
        <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

        <BackHeader label="Collect Payment" />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Party card */}
          <View style={[styles.partyCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
            <View style={[styles.partyAvatar, { backgroundColor: colors.brandSoft }]}>
              <Text style={[styles.partyAvatarText, { color: colors.brand }]}>
                {(partyName ?? 'P').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.partyName, { color: colors.text }]}>{partyName}</Text>
              {outstanding > 0 && (
                <Text style={styles.outstanding}>Outstanding: ₹{outstanding.toLocaleString('en-IN')}</Text>
              )}
            </View>
            {outstanding > 0 && (
              <TouchableOpacity
                style={[styles.useOutstandingBtn, { backgroundColor: colors.brandSoft }]}
                onPress={() => setAmount(String(outstanding))}
              >
                <Text style={[styles.useOutstandingText, { color: colors.brand }]}>Use full</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Settle mode segmented control */}
          <View style={[styles.segment, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
            {([
              // Same two words as the admin panel's Settlement Mode toggle, so a
              // salesman and the back office describe the same thing the same way.
              { id: 'onaccount', label: 'Direct / On Account', icon: 'account-cash' },
              { id: 'bills', label: 'Invoice-wise', icon: 'file-document-multiple' },
            ] as const).map(s => {
              const active = settleMode === s.id;
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.segmentBtn, active && { backgroundColor: colors.brand }]}
                  activeOpacity={0.85}
                  onPress={() => { setSettleMode(s.id); if (s.id === 'onaccount') setAllocations([]); }}
                >
                  <Icon name={s.icon} size={15} color={active ? '#fff' : colors.subText} />
                  <Text style={[styles.segmentText, { color: active ? '#fff' : colors.subText }]}>{s.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Bill allocation (Tally Agst Ref) */}
          {settleMode === 'bills' && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.text }]}>Outstanding Bills</Text>
              <View style={{ marginBottom: 20 }}>
                <BillAllocation
                  adminid={adminid}
                  partyId={partyId}
                  invoicemodel="SalesInvoice"
                  value={allocations}
                  onChange={setAllocations}
                  showDiscountCommission={dcEnabled}
                />
              </View>
            </>
          )}

          {/* Payment mode selector */}
          <Text style={[styles.sectionLabel, { color: colors.text }]}>Payment Mode</Text>
          <View style={styles.modeRow}>
            {MODES.map(m => {
              const active = mode === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.modeCard,
                    {
                      backgroundColor: active ? m.color + '18' : colors.cardGlass,
                      borderColor:     active ? m.color         : colors.border,
                    },
                  ]}
                  onPress={() => setMode(m.id)}
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

          {/* Amount input — on-account only; in Settle Bills the total comes from allocations */}
          {settleMode === 'onaccount' ? (
            <>
              <Text style={[styles.sectionLabel, { color: colors.text }]}>Amount (₹)</Text>
              <View style={[styles.inputWrap, { backgroundColor: colors.raisedSurface, borderColor: colors.border }]}>
                <Text style={[styles.currencySymbol, { color: colors.brand }]}>₹</Text>
                <TextInput
                  style={[styles.amountInput, { color: colors.text }]}
                  placeholder="0.00"
                  placeholderTextColor={colors.subText}
                  value={amount}
                  onChangeText={(t) => { setAmount(t); setAmountTouched(true); }}
                  keyboardType="numeric"
                  returnKeyType="done"
                />
              </View>
            </>
          ) : null}

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
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              returnKeyType="done"
            />
          </View>

          {/* Summary strip */}
          {parsedAmount > 0 && (
            <View style={[styles.summaryStrip, { backgroundColor: selectedMode.color + '14', borderColor: selectedMode.color + '44' }]}>
              <Icon name={selectedMode.icon} size={16} color={selectedMode.color} />
              <Text style={[styles.summaryText, { color: selectedMode.color }]}>
                Collecting <Text style={{ fontFamily: FONTS.bold }}>₹{parsedAmount.toLocaleString('en-IN')}</Text> via {selectedMode.label}
              </Text>
            </View>
          )}

          {/* Submit button */}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              { backgroundColor: submitting ? colors.border : selectedMode.color },
            ]}
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

  partyCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 18, borderWidth: 1, padding: 14, marginTop: 14, marginBottom: 20,
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  partyAvatar:       { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  partyAvatarText:   { fontSize: 18, fontFamily: FONTS.bold },
  partyName:         { fontSize: 15, fontFamily: FONTS.bold, marginBottom: 2 },
  outstanding:       { fontSize: 12, fontFamily: FONTS.semiBold, color: '#ef4444' },
  useOutstandingBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  useOutstandingText:{ fontSize: 12, fontFamily: FONTS.semiBold },

  sectionLabel: { fontSize: 13, fontFamily: FONTS.semiBold, marginBottom: 10 },

  segment: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, padding: 4, marginBottom: 18, gap: 4 },
  segmentBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  segmentText: { fontSize: 13, fontFamily: FONTS.semiBold },

  ledgerWrap:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  ledgerChip:    { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 9 },
  ledgerChipText:{ fontSize: 12, fontFamily: FONTS.semiBold, maxWidth: 140 },

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
    borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 4,
    marginBottom: 18,
  },
  notesWrap:     { paddingVertical: 10, alignItems: 'flex-start' },
  currencySymbol:{ fontSize: 20, fontFamily: FONTS.bold, marginRight: 6 },
  amountInput:   { flex: 1, fontSize: 26, fontFamily: FONTS.bold, paddingVertical: 10 },
  textInput:     { flex: 1, fontSize: 14, fontFamily: FONTS.regular, paddingVertical: 8 },
  notesInput:    { minHeight: 72 },

  summaryStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 18,
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
