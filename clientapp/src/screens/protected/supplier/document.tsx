import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, ScrollView, Pressable, TextInput, ActivityIndicator, Linking, Alert } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useRoute } from '@react-navigation/native';
import { useMutation, useQuery } from '@apollo/client/react';
import { FONTS, useTheme } from '../../../config';
import { API_CONFIG } from '../../../config/apiconfig';
import { BackHeader } from '../../../components';
import { GET_SUPPLIER_DOCUMENT, SUPPLIER_PRINT_LINK, UPDATE_SUPPLIER_ORDER } from '../../../apollo/queries/supplier';

const rupees = (n: any) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateLabel = (ymd?: string | null) =>
  ymd ? new Date(`${String(ymd).slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '-';
const STATUS_COLOR: Record<string, string> = { pending: '#d97706', confirmed: '#0284c7', received: '#16a34a', cancelled: '#e11d48', returned: '#64748b' };
const lineTotal = (l: any) => { const t = (Number(l.rate) - (Number(l.discount) || 0)) * Number(l.qty); return t + (t * (Number(l.gst) || 0)) / 100; };

/** A supplier's purchase order or bill: items, totals, print, and edit while the order is pending. */
export default function SupplierDocument() {
  const { colors, isDark } = useTheme();
  const { kind, id } = (useRoute<any>().params || {}) as { kind: string; id: string };
  const { data, loading, error, refetch } = useQuery(GET_SUPPLIER_DOCUMENT, { variables: { kind, id }, fetchPolicy: 'network-only' });
  const [printLink, { loading: printing }] = useMutation(SUPPLIER_PRINT_LINK);
  const [save, { loading: saving }] = useMutation(UPDATE_SUPPLIER_ORDER);
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [note, setNote] = useState('');
  const d = (data as any)?.getSupplierDocument;
  useEffect(() => { if (d) { setRows(d.lines.map((l: any) => ({ ...l, qty: String(l.qty), rate: String(l.rate) }))); setNote(d.suppliernote || ''); } }, [d]);
  const title = kind === 'order' ? 'Purchase Order' : 'Bill';

  const print = async () => {
    try {
      const { data: r } = await printLink({ variables: { kind, id } });
      await Linking.openURL(`${API_CONFIG.GRAPHQL_URL.replace(/\/graphql$/, '')}${(r as any)?.supplierPrintLink}`);
    } catch (e: any) {
      Alert.alert('Could not open print', e?.message || 'Please try again.');
    }
  };

  const submit = async () => {
    try {
      await save({ variables: { id, note, lines: rows.map((r) => ({ lineid: r.lineid, qty: Number(r.qty) || 0, rate: Number(r.rate) || 0 })) } });
      setEditing(false);
      await refetch();
      Alert.alert('Order updated', 'The business has been told about your changes.');
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Please try again.');
    }
  };

  const setRow = (lineid: string, patch: any) => setRows((rs) => rs.map((r) => (r.lineid === lineid ? { ...r, ...patch } : r)));
  const shown = editing ? rows.filter((r) => Number(r.qty) > 0) : d?.lines || [];
  const line = (label: string, value: string, bold = false) => (
    <View style={styles.line} key={label}>
      <Text style={[bold ? styles.name : styles.sub, { color: bold ? colors.text : colors.subText }]}>{label}</Text>
      <Text style={[bold ? styles.name : styles.sub, { color: colors.text }]}>{value}</Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />
      <BackHeader label={title} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {!d && loading ? <ActivityIndicator color={colors.brand} /> : !d ? <Text style={[styles.sub, { color: '#e11d48' }]}>{error?.message || 'Not found.'}</Text> : (
          <>
            <View style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
              <View style={styles.line}>
                <Text style={[styles.head, { color: colors.text }]}>{title} {d.billnumber ? `${kind === 'order' ? 'PO' : 'INV'}-${d.billnumber}` : ''}</Text>
                {!!d.orderStatus && <Text style={[styles.badge, { color: STATUS_COLOR[d.orderStatus], borderColor: STATUS_COLOR[d.orderStatus] }]}>{d.orderStatus.charAt(0).toUpperCase() + d.orderStatus.slice(1)}</Text>}
                {d.outstanding != null && <Text style={[styles.badge, { color: d.outstanding > 0 ? '#d97706' : '#16a34a', borderColor: d.outstanding > 0 ? '#d97706' : '#16a34a' }]}>{d.outstanding > 0 ? `Unpaid ${rupees(d.outstanding)}` : 'Paid'}</Text>}
              </View>
              <Text style={[styles.sub, { color: colors.subText }]}>Date {dateLabel(d.billdate)}{d.duedate ? ` · Due ${dateLabel(d.duedate)}` : ''}</Text>
              <View style={styles.actions}>
                {d.editable && !editing && (
                  <Pressable onPress={() => setEditing(true)} style={[styles.btn, { borderColor: colors.border }]}>
                    <Icon name="pencil-outline" size={16} color={colors.text} /><Text style={[styles.btnText, { color: colors.text }]}>Edit Order</Text>
                  </Pressable>
                )}
                <Pressable onPress={print} disabled={printing} style={[styles.btn, { backgroundColor: colors.brand, borderColor: colors.brand, opacity: printing ? 0.6 : 1 }]}>
                  <Icon name="printer-outline" size={16} color="#fff" /><Text style={[styles.btnText, { color: '#fff' }]}>Print / PDF</Text>
                </Pressable>
              </View>
            </View>
            {editing && <Text style={styles.warn}>Change quantity or rate, or remove an item. You can edit only until the business confirms the order.</Text>}

            {shown.map((l: any, i: number) => (
              <View key={l.lineid} style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
                <View style={styles.line}>
                  <Text style={[styles.name, { color: colors.text, flex: 1 }]} numberOfLines={2}>{i + 1}. {l.name}</Text>
                  <Text style={[styles.name, { color: colors.text }]}>{rupees(editing ? lineTotal(l) : l.amount)}</Text>
                </View>
                {editing ? (
                  <View style={styles.editRow}>
                    <Text style={[styles.sub, { color: colors.subText }]}>Qty</Text>
                    <TextInput value={l.qty} onChangeText={(t) => setRow(l.lineid, { qty: t.replace(/[^0-9.]/g, '') })} keyboardType="decimal-pad"
                      style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
                    <Text style={[styles.sub, { color: colors.subText }]}>Rate</Text>
                    <TextInput value={l.rate} onChangeText={(t) => setRow(l.lineid, { rate: t.replace(/[^0-9.]/g, '') })} keyboardType="decimal-pad"
                      style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
                    <Pressable onPress={() => setRow(l.lineid, { qty: '0' })} hitSlop={8}><Icon name="trash-can-outline" size={20} color="#e11d48" /></Pressable>
                  </View>
                ) : (
                  <Text style={[styles.sub, { color: colors.subText }]}>
                    {l.qty} {l.unit || ''} × {rupees(l.rate)}{l.discount ? ` · Disc ${rupees(l.discount)}` : ''} · GST {l.gst || 0}%
                  </Text>
                )}
              </View>
            ))}

            {editing ? (
              <>
                <TextInput value={note} onChangeText={setNote} placeholder="Note for the business (optional)" placeholderTextColor={colors.subText} multiline
                  style={[styles.note, { color: colors.text, borderColor: colors.border, backgroundColor: colors.raisedSurface }]} />
                <View style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
                  {line('New total (items)', rupees(rows.reduce((t, r) => t + (Number(r.qty) > 0 ? lineTotal(r) : 0), 0)), true)}
                </View>
                <View style={styles.actions}>
                  <Pressable onPress={() => { setEditing(false); setRows(d.lines.map((l: any) => ({ ...l, qty: String(l.qty), rate: String(l.rate) }))); setNote(d.suppliernote || ''); }}
                    style={[styles.btn, styles.flex, { borderColor: colors.border }]}><Text style={[styles.btnText, { color: colors.text }]}>Cancel</Text></Pressable>
                  <Pressable onPress={submit} disabled={saving || !rows.some((r) => Number(r.qty) > 0)}
                    style={[styles.btn, styles.flex, { backgroundColor: colors.brand, borderColor: colors.brand, opacity: saving ? 0.6 : 1 }]}><Text style={[styles.btnText, { color: '#fff' }]}>{saving ? 'Saving...' : 'Save Changes'}</Text></Pressable>
                </View>
              </>
            ) : (
              <View style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
                {line('Subtotal', rupees(d.subtotal))}
                {d.totaldiscount > 0 && line('Discount', `-${rupees(d.totaldiscount)}`)}
                {line('GST', rupees(d.totalgst))}
                {d.charges.map((c: any) => line(c.name, rupees(c.amount)))}
                {!!d.roundoff && line('Round off', rupees(d.roundoff))}
                {line('Total', rupees(d.totalamount), true)}
                {!!d.notes && <Text style={[styles.sub, { color: colors.text, marginTop: 6 }]}>Notes: {d.notes}</Text>}
                {!!d.suppliernote && <Text style={[styles.sub, { color: colors.text }]}>Your note: {d.suppliernote}</Text>}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: 16, gap: 10, paddingBottom: 40 },
  head: { flex: 1, fontSize: 16, fontFamily: FONTS.bold },
  name: { fontSize: 14, fontFamily: FONTS.semiBold },
  sub: { fontSize: 12, fontFamily: FONTS.regular },
  card: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 6 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  badge: { fontSize: 11, fontFamily: FONTS.semiBold, borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  btnText: { fontSize: 13, fontFamily: FONTS.semiBold },
  flex: { flex: 1 },
  warn: { backgroundColor: '#fffbeb', color: '#92400e', borderRadius: 10, padding: 10, fontSize: 12 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, minWidth: 64, fontSize: 13, textAlign: 'right' },
  note: { borderWidth: 1, borderRadius: 10, padding: 10, minHeight: 60, fontSize: 13, textAlignVertical: 'top' },
});
