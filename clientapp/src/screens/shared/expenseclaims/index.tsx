import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, StatusBar, Alert, Modal, Image,
  KeyboardAvoidingView, Platform, ScrollView, TextInput, ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery, useMutation } from '@apollo/client/react';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { COLORS, FONTS, useTheme, resolveMediaUrl } from '../../../config';
import { BackHeader, DynamicFlashList } from '../../../components';
import { formatDate } from '../../../utils';
import { uploadImage } from '../../../utils/uploadimage';
import {
  GET_MY_EXPENSE_CLAIMS, ADD_EXPENSE_CLAIM, CANCEL_EXPENSE_CLAIM,
} from '../../../apollo/queries/expenseclaims';

/**
 * Expense Claims — a salesman / delivery boy / staff member asks to be paid
 * back for money spent in the field. The admin approves or rejects it in the
 * admin panel; an approved claim is reimbursed through Payments.
 */

const CATEGORIES = [
  { id: 'travel',  label: 'Travel',  icon: 'bus',                 color: '#3b82f6' },
  { id: 'fuel',    label: 'Fuel',    icon: 'gas-station',         color: '#f97316' },
  { id: 'food',    label: 'Food',    icon: 'food',                color: '#22c55e' },
  { id: 'lodging', label: 'Lodging', icon: 'bed',                 color: '#8b5cf6' },
  { id: 'phone',   label: 'Phone',   icon: 'cellphone',           color: '#14b8a6' },
  { id: 'other',   label: 'Other',   icon: 'dots-horizontal-circle-outline', color: '#64748b' },
];
const CAT = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

const STATUS: Record<string, { color: string; label: string }> = {
  pending:   { color: '#f59e0b', label: 'Pending'   },
  approved:  { color: '#22c55e', label: 'Approved'  },
  paid:      { color: '#3b82f6', label: 'Paid'      },
  partpaid:  { color: '#6366f1', label: 'Part Paid' },
  rejected:  { color: '#ef4444', label: 'Rejected'  },
  cancelled: { color: '#94a3b8', label: 'Cancelled' },
};

const MAX_RECEIPTS = 3;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtDate = (d: Date) => `${String(d.getDate()).padStart(2,'0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
const addDays = (d: Date, n: number) => { const c = new Date(d); c.setDate(c.getDate() + n); return c; };
const toYMD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const rupees = (n: any) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const statusKey = (c: any) => {
  if (c.status !== 'approved') return c.status;
  const due = Number(c.approvedamount ?? c.amount);
  const paid = Number(c.paidamount || 0);
  if (paid >= due - 0.009) return 'paid';
  if (paid > 0) return 'partpaid';
  return 'approved';
};

export default function ExpenseClaimsScreen() {
  const { colors, isDark } = useTheme();
  const { data, refetch, loading } = useQuery(GET_MY_EXPENSE_CLAIMS, { fetchPolicy: 'cache-and-network' });
  const [addClaim] = useMutation(ADD_EXPENSE_CLAIM);
  const [cancelClaim] = useMutation(CANCEL_EXPENSE_CLAIM);

  useFocusEffect(useCallback(() => { refetch?.(); }, [refetch]));

  const claims: any[] = (data as any)?.getMyExpenseClaims ?? [];
  const totals = useMemo(() => {
    let pending = 0, approved = 0, paid = 0;
    claims.forEach(c => {
      if (c.status === 'pending') pending += Number(c.amount || 0);
      if (c.status === 'approved') { approved += Number(c.approvedamount || 0); paid += Number(c.paidamount || 0); }
    });
    return { pending, toReceive: Math.max(approved - paid, 0), paid };
  }, [claims]);

  /* ── form ─────────────────────────────────────────────── */
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const [show, setShow] = useState(false);
  const [category, setCategory] = useState('travel');
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState('');
  const [km, setKm] = useState('');
  const [description, setDescription] = useState('');
  const [receipts, setReceipts] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const reset = () => {
    setCategory('travel'); setDate(today); setAmount(''); setKm(''); setDescription(''); setReceipts([]);
  };

  const pickReceipt = () => {
    if (receipts.length >= MAX_RECEIPTS) { Alert.alert('Bills', `You can attach up to ${MAX_RECEIPTS} photos.`); return; }
    const handle = async (result: any) => {
      const asset = result?.assets?.[0];
      if (!asset?.uri) return;
      setUploading(true);
      try {
        const url = await uploadImage(asset.uri, asset.fileName, asset.type);
        setReceipts(prev => [...prev, url]);
      } catch (e: any) {
        Alert.alert('Upload failed', e?.message || 'Could not upload the photo.');
      } finally {
        setUploading(false);
      }
    };
    // The system picker / camera intent is used, so no storage permission is
    // asked for — the bill photo is the only thing the app ever sees.
    const opts: any = { mediaType: 'photo', quality: 0.6, maxWidth: 1280, maxHeight: 1280 };
    Alert.alert('Attach Bill', 'Add a photo of the bill or receipt', [
      { text: 'Camera',  onPress: () => launchCamera(opts).then(handle).catch(() => {}) },
      { text: 'Gallery', onPress: () => launchImageLibrary(opts).then(handle).catch(() => {}) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const submit = async () => {
    const amt = Number(amount);
    if (!(amt > 0)) { Alert.alert('Amount', 'Enter the amount you spent.'); return; }
    if (category === 'other' && !description.trim()) { Alert.alert('Details', 'Describe what this expense was for.'); return; }
    setSubmitting(true);
    try {
      await addClaim({
        variables: { input: {
          claimdate: toYMD(date),
          category,
          amount: amt,
          distancekm: category === 'fuel' && km ? Number(km) : null,
          description: description.trim(),
          receipts,
        } },
      });
      await refetch?.();
      setShow(false);
      reset();
      Alert.alert('Submitted', 'Your expense claim has been sent for approval.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not submit the claim.');
    } finally {
      setSubmitting(false);
    }
  };

  const onCancel = (c: any) => {
    Alert.alert('Cancel Claim', `Cancel ${c.claimnumber}?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel', style: 'destructive',
        onPress: async () => {
          try { await cancelClaim({ variables: { id: c.id } }); refetch?.(); }
          catch (e: any) { Alert.alert('Error', e?.message || 'Could not cancel.'); }
        },
      },
    ]);
  };

  /* ── list ─────────────────────────────────────────────── */
  // Compact row: what + when on the left, amount + status on the right, the
  // rest (bill, approved / received, reason, cancel) on one short line below.
  const renderClaim = ({ item: c }: any) => {
    const cat = CAT[c.category] ?? CAT.other;
    const st = STATUS[statusKey(c)] ?? STATUS.pending;
    const partApproved = c.status === 'approved' && Number(c.approvedamount) !== Number(c.amount);
    const extra =
      c.status === 'approved' ? `Received ${rupees(c.paidamount)} of ${rupees(c.approvedamount)}`
      : c.status === 'rejected' && c.rejectionreason ? `Reason: ${c.rejectionreason}`
      : '';
    return (
      <View style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border, borderLeftColor: cat.color }]}>
        <View style={[styles.iconWrap, { backgroundColor: cat.color + '18' }]}>
          <Icon name={cat.icon} size={17} color={cat.color} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.rowBetween}>
            <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
              {cat.label}{c.distancekm ? ` · ${c.distancekm} km` : ''}{c.description ? ` · ${c.description}` : ''}
            </Text>
            <Text style={[styles.amount, { color: colors.text }]}>{rupees(c.amount)}</Text>
          </View>
          <View style={[styles.rowBetween, { marginTop: 2 }]}>
            <Text style={[styles.cardMeta, { color: colors.subText }]} numberOfLines={1}>
              {c.claimnumber} · {formatDate(c.claimdate)}
            </Text>
            <View style={[styles.badge, { backgroundColor: st.color + '20' }]}>
              <Text style={[styles.badgeText, { color: st.color }]}>{st.label}</Text>
            </View>
          </View>
          {(!!extra || partApproved || c.receipts?.length > 0 || c.status === 'pending') && (
            <View style={[styles.rowBetween, { marginTop: 4 }]}>
              <Text
                style={[styles.cardMeta, { color: c.status === 'rejected' ? '#ef4444' : colors.subText, flex: 1 }]}
                numberOfLines={1}
              >
                {partApproved ? `Approved ${rupees(c.approvedamount)} · ` : ''}{extra}
              </Text>
              <View style={styles.actions}>
                {c.receipts?.length > 0 && (
                  <Pressable style={styles.attach} onPress={() => setPreview(c.receipts[0])} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Icon name="paperclip" size={13} color={colors.subText} />
                    <Text style={[styles.cardMeta, { color: colors.subText }]}>{c.receipts.length}</Text>
                  </Pressable>
                )}
                {c.status === 'pending' && (
                  <Pressable onPress={() => onCancel(c)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}
        </View>
      </View>
    );
  };

  const Header = () => (
    <>
      <View style={styles.summaryRow}>
        {[
          { label: 'Pending',    value: totals.pending,   color: '#f59e0b', icon: 'clock-outline' },
          { label: 'To Receive', value: totals.toReceive, color: '#22c55e', icon: 'cash-refund' },
          { label: 'Received',   value: totals.paid,      color: '#3b82f6', icon: 'cash-check' },
        ].map(s => (
          <View key={s.label} style={[styles.sumCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
            <View style={[styles.sumIcon, { backgroundColor: s.color + '18' }]}><Icon name={s.icon} size={15} color={s.color} /></View>
            <Text style={[styles.sumValue, { color: colors.text }]}>{rupees(s.value)}</Text>
            <Text style={[styles.sumLabel, { color: colors.subText }]}>{s.label}</Text>
          </View>
        ))}
      </View>
      <View style={styles.rowBetween}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>My Claims</Text>
        <Pressable style={[styles.addBtn, { backgroundColor: colors.brand }]} onPress={() => { reset(); setShow(true); }}>
          <Icon name="plus" size={13} color={colors.onBrand} />
          <Text style={[styles.addBtnText, { color: colors.onBrand }]}>New Claim</Text>
        </Pressable>
      </View>
    </>
  );

  const selected = CAT[category];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />
      <BackHeader label="Expense Claims" />

      <DynamicFlashList
        data={claims}
        renderItem={renderClaim}
        estimatedItemSize={64}
        ListHeaderComponent={<Header />}
        ListEmptyComponent={
          loading ? <ActivityIndicator style={{ marginTop: 20 }} color={colors.brand} />
            : <Text style={[styles.empty, { color: colors.subText }]}>No claims yet. Tap “New Claim” to add your first expense.</Text>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* New claim */}
      <Modal visible={show} animationType="slide" transparent onRequestClose={() => setShow(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShow(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kav}>
            <View style={[styles.sheet, { backgroundColor: colors.background }]}>
              <View style={[styles.handle, { backgroundColor: colors.border }]} />
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>New Expense Claim</Text>
                <Pressable onPress={() => setShow(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Icon name="close" size={20} color={colors.subText} />
                </Pressable>
              </View>

              <ScrollView style={styles.sheetBody} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetScroll}>
                <Text style={[styles.label, { color: colors.text }]}>Category</Text>
                <View style={styles.chips}>
                  {CATEGORIES.map(c => {
                    const a = c.id === category;
                    return (
                      <Pressable
                        key={c.id}
                        style={[styles.chip, a ? { backgroundColor: c.color, borderColor: c.color } : { backgroundColor: colors.raisedSurface, borderColor: colors.border }]}
                        onPress={() => setCategory(c.id)}
                      >
                        <Icon name={c.icon} size={15} color={a ? '#fff' : c.color} />
                        <Text style={[styles.chipText, { color: a ? '#fff' : colors.text }]}>{c.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={[styles.label, { color: colors.text }]}>Date</Text>
                <View style={[styles.dateRow, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
                  <Pressable style={[styles.arrow, { backgroundColor: colors.raisedSurface }]} onPress={() => setDate(addDays(date, -1))}>
                    <Icon name="chevron-left" size={16} color={colors.text} />
                  </Pressable>
                  <Text style={[styles.dateText, { color: colors.text }]}>{fmtDate(date)}</Text>
                  <Pressable
                    style={[styles.arrow, { backgroundColor: colors.raisedSurface, opacity: date >= today ? 0.4 : 1 }]}
                    disabled={date >= today}
                    onPress={() => setDate(addDays(date, 1))}
                  >
                    <Icon name="chevron-right" size={16} color={colors.text} />
                  </Pressable>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: colors.text }]}>Amount (₹)</Text>
                    <TextInput
                      style={[styles.input, { color: colors.text, backgroundColor: colors.raisedSurface, borderColor: colors.border }]}
                      keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.subText}
                      value={amount} onChangeText={t => setAmount(t.replace(/[^0-9.]/g, ''))}
                    />
                  </View>
                  {category === 'fuel' && (
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.label, { color: colors.text }]}>Distance (km)</Text>
                      <TextInput
                        style={[styles.input, { color: colors.text, backgroundColor: colors.raisedSurface, borderColor: colors.border }]}
                        keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.subText}
                        value={km} onChangeText={t => setKm(t.replace(/[^0-9.]/g, ''))}
                      />
                    </View>
                  )}
                </View>

                <Text style={[styles.label, { color: colors.text }]}>Details</Text>
                <TextInput
                  style={[styles.input, styles.multi, { color: colors.text, backgroundColor: colors.raisedSurface, borderColor: colors.border }]}
                  placeholder="e.g. Bus fare Rajkot → Morbi for party visits" placeholderTextColor={colors.subText}
                  value={description} onChangeText={setDescription} multiline textAlignVertical="top"
                />

                <Text style={[styles.label, { color: colors.text }]}>Bill / Receipt photos</Text>
                <View style={styles.receiptRow}>
                  {receipts.map(url => (
                    <View key={url} style={styles.thumbWrap}>
                      <Image source={{ uri: resolveMediaUrl(url, 240) }} style={styles.thumb} />
                      <Pressable style={styles.thumbRemove} onPress={() => setReceipts(r => r.filter(x => x !== url))}>
                        <Icon name="close" size={12} color="#fff" />
                      </Pressable>
                    </View>
                  ))}
                  {receipts.length < MAX_RECEIPTS && (
                    <Pressable style={[styles.thumbAdd, { borderColor: colors.border }]} onPress={pickReceipt} disabled={uploading}>
                      {uploading ? <ActivityIndicator color={colors.brand} /> : <Icon name="camera-plus-outline" size={22} color={colors.subText} />}
                    </Pressable>
                  )}
                </View>

              </ScrollView>

              {/* Kept outside the ScrollView so it is always on screen, however
                  long the form gets or whatever the keyboard covers. */}
              <View style={[styles.sheetFooter, { borderTopColor: colors.border }]}>
                <Pressable
                  style={[styles.submit, { backgroundColor: submitting || uploading ? colors.border : selected.color }]}
                  onPress={submit}
                  disabled={submitting || uploading}
                >
                  <Icon name="send-outline" size={16} color="#fff" />
                  <Text style={styles.submitText}>{submitting ? 'Submitting…' : uploading ? 'Uploading photo…' : 'Submit for Approval'}</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Bill preview */}
      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable style={styles.previewWrap} onPress={() => setPreview(null)}>
          {!!preview && <Image source={{ uri: resolveMediaUrl(preview) }} style={styles.previewImg} resizeMode="contain" />}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: 18, paddingBottom: 60 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  summaryRow: { flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 16 },
  sumCard: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 10 },
  sumIcon: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  sumValue: { fontSize: 13, fontFamily: FONTS.bold },
  sumLabel: { fontSize: 10, fontFamily: FONTS.regular, marginTop: 1 },

  sectionTitle: { fontSize: 15, fontFamily: FONTS.bold },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12 },
  addBtnText: { fontSize: 12, fontFamily: FONTS.bold },
  empty: { textAlign: 'center', marginTop: 24, fontSize: 12, fontFamily: FONTS.regular },

  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, borderWidth: 1, borderLeftWidth: 3, paddingVertical: 8, paddingHorizontal: 10, marginTop: 8, shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  iconWrap: { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  cardTitle: { fontSize: 13, fontFamily: FONTS.semiBold, flex: 1, marginRight: 8 },
  cardMeta: { fontSize: 11, fontFamily: FONTS.regular },
  amount: { fontSize: 14, fontFamily: FONTS.bold },
  badge: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: 7 },
  badgeText: { fontSize: 10, fontFamily: FONTS.semiBold },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 14, marginLeft: 8 },
  attach: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  cancelText: { fontSize: 11, fontFamily: FONTS.semiBold, color: '#ef4444' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  kav: { maxHeight: '92%', width: '100%' },
  sheet: { maxHeight: '100%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === 'ios' ? 34 : 20, overflow: 'hidden' },
  // flexShrink lets the form scroll inside the sheet instead of pushing the footer off screen.
  sheetBody: { flexGrow: 0, flexShrink: 1 },
  sheetFooter: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  handle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  sheetTitle: { fontSize: 17, fontFamily: FONTS.bold },
  sheetScroll: { paddingHorizontal: 20, paddingBottom: 12 },

  label: { fontSize: 13, fontFamily: FONTS.bold, marginBottom: 8, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontSize: 12, fontFamily: FONTS.semiBold },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8 },
  arrow: { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  dateText: { fontSize: 14, fontFamily: FONTS.bold },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 12 : 8, fontSize: 14, fontFamily: FONTS.regular, marginBottom: 8 },
  multi: { minHeight: 70 },

  receiptRow: { flexDirection: 'row', gap: 10, marginBottom: 4, flexWrap: 'wrap' },
  thumbWrap: { width: 72, height: 72, borderRadius: 12, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  thumbRemove: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  thumbAdd: { width: 72, height: 72, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },

  submit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 14 },
  submitText: { fontSize: 15, fontFamily: FONTS.bold, color: '#fff' },

  previewWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  previewImg: { width: '92%', height: '80%' },
});
