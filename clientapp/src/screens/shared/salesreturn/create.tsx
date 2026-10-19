import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, Alert, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { FONTS, useTheme } from '../../../config';
import { BackHeader } from '../../../components';
import { GET_SALES_RETURN_DRAFT, ADD_SALES_RETURN, GET_MY_SALES_RETURNS, GET_RETURNABLE_SALES_INVOICES } from '../../../apollo/queries/salesreturn';
import { usePunchGate } from '../../../apollo/hooks/attendance';
import { localYMD } from '../../../utils/geo';
import type { RootState } from '../../../store/rootreducer';

type DraftLine = {
  productserviceid: string;
  productName: string;
  variantid?: string | null;
  variantName?: string | null;
  salesunitid?: string | null;
  unitname?: string | null;
  unitqty: number;
  gst: number;
  rate: number;
  discount: number;
  invoicedQty: number;
  returnedQty: number;
  returnableQty: number;
};

const REASONS = ['Damaged', 'Expired', 'Wrong item', 'Not required', 'Other'];
const fmtDate = (d?: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : (d || '');
};
const inr = (n: number) => `₹${(Math.round((n || 0) * 100) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Book a Sales Return (credit note) against one invoice — salesman and
 * delivery boy. Same rules as the admin panel's Add Sales Return:
 *   - every line of the invoice is listed, NOTHING selected; tick what came back
 *   - a ticked line takes its full returnable qty, adjustable with − / +
 *   - "returnable" already nets off earlier returns (server-computed)
 * The server re-validates every quantity before saving.
 */
export default function SalesReturnCreate() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors, isDark } = useTheme();
  const invoiceId: string = route.params?.invoiceId;

  const user = useSelector((s: RootState) => s.auth.user);
  const { blocked: punchBlocked } = usePunchGate();

  const { data, loading, error } = useQuery(GET_SALES_RETURN_DRAFT, {
    variables: { sourceInvoiceId: invoiceId },
    skip: !invoiceId,
    fetchPolicy: 'network-only',
  });
  const draft = (data as any)?.getSalesReturnDraft;
  const lines: DraftLine[] = useMemo(
    () => (draft?.lines ?? []).filter((l: DraftLine) => l.returnableQty > 0),
    [draft],
  );

  // qty per line index into `lines`; absent / 0 = not selected.
  const [qty, setQty] = useState<Record<number, number>>({});
  const [search, setSearch] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [refund, setRefund] = useState<'adjust' | 'cash'>('adjust');
  const [saving, setSaving] = useState(false);

  // A one-line invoice can only be returning that line.
  useEffect(() => {
    if (lines.length === 1) setQty({ 0: lines[0].returnableQty });
  }, [lines]);

  const [addReturn] = useMutation(ADD_SALES_RETURN, {
    refetchQueries: [{ query: GET_MY_SALES_RETURNS, variables: { adminid: draft?.adminid } }, { query: GET_RETURNABLE_SALES_INVOICES }],
  });

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => !q || `${line.productName} ${line.variantName ?? ''}`.toLowerCase().includes(q));
  }, [lines, search]);

  const isSel = (i: number) => (qty[i] ?? 0) > 0;
  const selectedCount = lines.filter((_, i) => isSel(i)).length;
  const allVisibleSelected = visible.length > 0 && visible.every(({ index }) => isSel(index));

  const toggle = (i: number) =>
    setQty((p) => ({ ...p, [i]: isSel(i) ? 0 : lines[i].returnableQty }));
  const toggleAll = () =>
    setQty((p) => {
      const n = { ...p };
      visible.forEach(({ line, index }) => { n[index] = allVisibleSelected ? 0 : line.returnableQty; });
      return n;
    });
  const setLineQty = (i: number, v: number) => {
    const max = lines[i].returnableQty;
    setQty((p) => ({ ...p, [i]: Math.max(0, Math.min(max, Math.floor(v || 0))) }));
  };

  const totals = useMemo(() => {
    let subtotal = 0, totaldiscount = 0, totalgst = 0;
    lines.forEach((l, i) => {
      const q = qty[i] ?? 0;
      if (q <= 0) return;
      const taxable = (l.rate - l.discount) * q;
      subtotal += taxable;
      totaldiscount += l.discount * q;
      totalgst += (taxable * l.gst) / 100;
    });
    const r2 = (n: number) => parseFloat(n.toFixed(2));
    return { subtotal: r2(subtotal), totaldiscount: r2(totaldiscount), totalgst: r2(totalgst), totalamount: r2(subtotal + totalgst) };
  }, [lines, qty]);

  const save = () => {
    if (punchBlocked) { Alert.alert('Punch in required', 'Please punch in from the Attendance tab first.'); return; }
    if (selectedCount === 0) { Alert.alert('Nothing selected', 'Tick the items the customer is returning.'); return; }
    if (!reason) { Alert.alert('Reason needed', 'Pick why these items are being returned.'); return; }

    const refundText = refund === 'cash'
      ? `Cash ${inr(totals.totalamount)} will be recorded as refunded to the customer.`
      : `${inr(totals.totalamount)} will be credited to the party's account.`;
    Alert.alert('Save Return', `${selectedCount} item(s) · ${inr(totals.totalamount)}\n${refundText}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Save', onPress: submit },
    ]);
  };

  const submit = async () => {
    setSaving(true);
    try {
      const input: any = {
        sourceInvoiceId: draft.invoiceId,
        salesmenid: draft.salesmenid || undefined,
        // "Cash refund" = refund mode auto on a cash return, which posts the
        // Cash Cr / Party Dr refund the same way the admin panel does.
        paymenttype: refund === 'cash' ? 'cash' : (draft.paymenttype || 'credit'),
        refundMode: refund === 'cash' ? 'auto' : 'advance',
        partyacc: draft.partyId,
        taxorsupplytype: draft.taxorsupplytype || 'exclusive',
        returndate: localYMD(),
        billtype: draft.billtype || 'tax',
        billnumber: null,
        reason,
        notes: notes.trim() || undefined,
        invoicetype: draft.invoicetype || undefined,
        subtotal: totals.subtotal,
        totaldiscount: totals.totaldiscount,
        totalgst: totals.totalgst,
        totalamount: totals.totalamount,
        roundoff: 0,
        invoicediscount: 0,
        invoicediscounttype: 'amount',
        adminid: draft.adminid,
        branchid: draft.branchid,
        isservice: !!draft.isservice,
        createdby_id: user?.id,
        createdby_name: user?.name,
        createdby_type: user?.role || 'staff',
        productservice: lines
          .map((l, i) => ({ l, q: qty[i] ?? 0 }))
          .filter(({ q }) => q > 0)
          .map(({ l, q }) => ({
            productserviceid: l.productserviceid,
            variantid: l.variantid || undefined,
            salesunitid: l.salesunitid || undefined,
            unitqty: l.unitqty || 1,
            gst: l.gst,
            qty: q,
            rate: l.rate,
            discount: l.discount,
            amount: parseFloat(((l.rate - l.discount) * q).toFixed(2)),
          })),
      };
      const res: any = await addReturn({ variables: { input } });
      const cn = res?.data?.addSalesReturn?.billnumber;
      Alert.alert('Return saved', cn ? `Credit note ${cn} created.` : 'Sales return created.');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
        <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />
        <BackHeader label="Sales Return" />

        {loading && !draft ? (
          <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
        ) : error || !draft ? (
          <View style={styles.center}>
            <Icon name="alert-circle-outline" size={40} color={colors.subText} />
            <Text style={[styles.muted, { color: colors.subText }]}>{error?.message || 'Invoice not found.'}</Text>
          </View>
        ) : (
          <>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {/* Invoice */}
              <View style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
                <View style={styles.rowBetween}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.invNo, { color: colors.text }]}>INV-{draft.billnumber}</Text>
                    {!!draft.orderNumber && (
                      <View style={[styles.soTag, { backgroundColor: colors.brandSoft }]}>
                        <Text style={[styles.soText, { color: colors.brand }]}>SO-{draft.orderNumber}</Text>
                      </View>
                    )}
                  </View>
                  {!!draft.billdate && <Text style={[styles.muted, { color: colors.subText }]}>{fmtDate(draft.billdate)}</Text>}
                </View>
                {!!draft.partyName && (
                  <Text style={[styles.party, { color: colors.subText, marginTop: 2 }]} numberOfLines={1}>{draft.partyName}</Text>
                )}
              </View>

              {lines.length === 0 ? (
                <View style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border, alignItems: 'center' }]}>
                  <Icon name="check-all" size={32} color={colors.subText} />
                  <Text style={[styles.muted, { color: colors.subText, marginTop: 8 }]}>Everything on this invoice has already been returned.</Text>
                </View>
              ) : (
                <View style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
                  <View style={styles.rowBetween}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>
                      Items <Text style={[styles.muted, { color: colors.subText }]}>({selectedCount}/{lines.length})</Text>
                    </Text>
                    <TouchableOpacity style={styles.selectAll} onPress={toggleAll} disabled={visible.length === 0} hitSlop={8}>
                      <Text style={[styles.selectAllText, { color: colors.brand }]}>
                        {allVisibleSelected ? 'Clear all' : 'Select all'}
                      </Text>
                      <Icon
                        name={allVisibleSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                        size={20}
                        color={allVisibleSelected ? colors.brand : colors.subText}
                      />
                    </TouchableOpacity>
                  </View>

                  {lines.length > 6 && (
                    <View style={[styles.search, { borderColor: colors.border, backgroundColor: colors.background }]}>
                      <Icon name="magnify" size={18} color={colors.subText} />
                      <TextInput
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Search items on this invoice"
                        placeholderTextColor={colors.subText}
                        style={[styles.searchInput, { color: colors.text }]}
                      />
                    </View>
                  )}


                  {visible.map(({ line: l, index: i }) => {
                    const sel = isSel(i);
                    const q = qty[i] ?? 0;
                    return (
                      <View key={`${l.productserviceid}_${l.variantid ?? ''}_${i}`} style={[styles.line, { borderTopColor: colors.border }]}>
                        <View style={styles.lineHead}>
                          <TouchableOpacity style={styles.lineTap} onPress={() => toggle(i)} activeOpacity={0.7}>
                            <Icon
                              name={sel ? 'checkbox-marked' : 'checkbox-blank-outline'}
                              size={20}
                              color={sel ? colors.brand : colors.subText}
                            />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.lineName, { color: sel ? colors.text : colors.subText }]} numberOfLines={1}>
                                {l.productName}{l.variantName ? ` · ${l.variantName}` : ''}
                              </Text>
                              <Text style={[styles.lineMeta, { color: colors.subText }]} numberOfLines={1}>
                                {sel
                                  ? `${inr((l.rate - l.discount) * q)} · max ${l.returnableQty}`
                                  : `Returnable ${l.returnableQty}${l.unitname ? ` ${l.unitname}` : ''} · ${inr(l.rate - l.discount)}`}
                              </Text>
                            </View>
                          </TouchableOpacity>
                          {sel && (
                            <View style={[styles.stepper, { borderColor: colors.border }]}>
                              <TouchableOpacity style={styles.stepBtn} onPress={() => setLineQty(i, q - 1)} hitSlop={6}>
                                <Icon name="minus" size={16} color={colors.text} />
                              </TouchableOpacity>
                              <TextInput
                                value={String(q)}
                                onChangeText={(t) => setLineQty(i, Number(t.replace(/[^0-9]/g, '')))}
                                keyboardType="number-pad"
                                style={[styles.stepInput, { color: colors.text }]}
                              />
                              <TouchableOpacity style={styles.stepBtn} onPress={() => setLineQty(i, q + 1)} disabled={q >= l.returnableQty} hitSlop={6}>
                                <Icon name="plus" size={16} color={q >= l.returnableQty ? colors.border : colors.text} />
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                  {visible.length === 0 && (
                    <Text style={[styles.muted, { color: colors.subText, textAlign: 'center', marginTop: 12 }]}>No matching items.</Text>
                  )}
                </View>
              )}

              {lines.length > 0 && (
                <>
                  {/* Reason */}
                  <View style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>Reason</Text>
                    <View style={styles.chips}>
                      {REASONS.map((r) => {
                        const on = reason === r;
                        return (
                          <TouchableOpacity
                            key={r}
                            onPress={() => setReason(r)}
                            style={[styles.chip, { borderColor: on ? colors.brand : colors.border, backgroundColor: on ? colors.brandSoft : 'transparent' }]}
                          >
                            <Text style={[styles.chipText, { color: on ? colors.brand : colors.text }]}>{r}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <TextInput
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="Notes (optional)"
                      placeholderTextColor={colors.subText}
                      multiline
                      style={[styles.notes, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                    />
                  </View>

                  {/* Refund */}
                  <View style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>Refund</Text>
                    <View style={styles.optRow}>
                      {([
                        { id: 'adjust', icon: 'account-cash-outline', title: 'Adjust in account', sub: 'Reduces party dues' },
                        { id: 'cash', icon: 'cash-refund', title: 'Cash refund', sub: 'Cash given back now' },
                      ] as const).map((o) => {
                        const on = refund === o.id;
                        return (
                          <TouchableOpacity
                            key={o.id}
                            onPress={() => setRefund(o.id)}
                            style={[styles.option, { borderColor: on ? colors.brand : colors.border, backgroundColor: on ? colors.brandSoft : 'transparent' }]}
                          >
                            <Icon name={o.icon} size={20} color={on ? colors.brand : colors.subText} />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.optTitle, { color: on ? colors.brand : colors.text }]} numberOfLines={1}>{o.title}</Text>
                              <Text style={[styles.lineMeta, { color: colors.subText }]} numberOfLines={1}>{o.sub}</Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </>
              )}
            </ScrollView>

            {lines.length > 0 && (
              <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.muted, { color: colors.subText }]}>
                    {selectedCount} item(s){totals.totalgst > 0 ? ` · incl. GST ${inr(totals.totalgst)}` : ''}
                  </Text>
                  <Text style={[styles.total, { color: colors.text }]}>{inr(totals.totalamount)}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: saving || selectedCount === 0 ? colors.border : '#ef4444' }]}
                  onPress={save}
                  disabled={saving || selectedCount === 0}
                  activeOpacity={0.88}
                >
                  <Icon name="keyboard-return" size={18} color="#fff" />
                  <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save Return'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingBottom: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  card: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, marginTop: 10 },
  cardTitle: { fontSize: 14, fontFamily: FONTS.bold },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  invNo: { fontSize: 15, fontFamily: FONTS.bold },
  titleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  soTag: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  soText: { fontSize: 11, fontFamily: FONTS.semiBold },
  party: { fontSize: 13, fontFamily: FONTS.medium },
  muted: { fontSize: 12, fontFamily: FONTS.regular },
  search: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, marginTop: 8 },
  searchInput: { flex: 1, paddingVertical: 6, fontSize: 13, fontFamily: FONTS.regular },
  selectAll: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  selectAllText: { fontSize: 13, fontFamily: FONTS.semiBold },
  line: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 8, marginTop: 4 },
  lineHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lineTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  lineName: { fontSize: 13, fontFamily: FONTS.semiBold },
  lineMeta: { fontSize: 11, fontFamily: FONTS.regular, marginTop: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10 },
  stepBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  stepInput: { minWidth: 34, textAlign: 'center', fontSize: 13, fontFamily: FONTS.bold, paddingVertical: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5 },
  chipText: { fontSize: 12, fontFamily: FONTS.medium },
  notes: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginTop: 8, minHeight: 40, textAlignVertical: 'top', fontSize: 13, fontFamily: FONTS.regular },
  optRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  option: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  optTitle: { fontSize: 13, fontFamily: FONTS.semiBold },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20, borderTopWidth: StyleSheet.hairlineWidth },
  total: { fontSize: 18, fontFamily: FONTS.bold },
  saveBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
  saveText: { color: '#fff', fontSize: 14, fontFamily: FONTS.bold },
});
