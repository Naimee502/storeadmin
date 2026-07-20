import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, Alert, ActivityIndicator,
  Modal, FlatList, TextInput, ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useMutation } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { FONTS, useTheme } from '../../../../config';
import { formatINR } from '../../../../utils';
import { BackHeader } from '../../../../components';
import { GET_SALES_ORDER_BY_ID, GET_PRODUCTS, GET_ACCOUNT, RESOLVE_PRICE } from '../../../../apollo/queries/accounts';
import { EDIT_SALES_ORDER } from '../../../../apollo/mutations/accounts';
import { apolloClient } from '../../../../apollo/client';
import { useChargePreview } from '../../../../apollo/hooks/chargerules';
import { useShowProductPrice } from '../../../../apollo/hooks/adminsettings';
import type { RootState } from '../../../../store/rootreducer';

type Line = {
  productserviceid: string; productName: string;
  variantid: string | null; variantName: string;
  salesunitid: string | null; unitName: string; unitqty: number;
  qty: number; rate: number; discount: number; gst: number;
};

export default function OrderEdit() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors, isDark } = useTheme();
  const tenant = useSelector((s: RootState) => s.tenant);
  const user = useSelector((s: RootState) => s.auth.user);
  const orderId: string = route.params?.orderId;
  // Edit Order is shared across all role logins, but the "hide price"
  // business setting is a party-only restriction — salesman/staff/delivery
  // boy always see prices regardless of this flag.
  const priceSettingOn = useShowProductPrice();
  const showPrice = user?.role !== 'party' || priceSettingOn;

  const { data, loading } = useQuery(GET_SALES_ORDER_BY_ID, {
    variables: { id: orderId }, skip: !orderId, fetchPolicy: 'network-only',
  });
  const order: any = (data as any)?.getSalesOrderById;
  const partyId = order?.partyacc?.id;

  // Product catalog + the order's party account (for pricelist-correct rates).
  const { data: productsData } = useQuery(GET_PRODUCTS, {
    variables: { adminid: tenant.adminId, limit: 200 }, skip: !tenant.adminId,
  });
  const { data: accountData } = useQuery(GET_ACCOUNT, {
    variables: { id: partyId, adminId: tenant.adminId }, skip: !partyId || !tenant.adminId,
  });
  const partyAccount = (accountData as any)?.getAccountById;
  const products = (productsData as any)?.getProductServices ?? [];

  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!order) return;
    setLines((order.productservice || []).map((p: any) => ({
      productserviceid: p.productserviceid?.id,
      productName: p.productserviceid?.name || 'Item',
      variantid: p.variantid?.id || null,
      variantName: p.variantid?.name || '',
      salesunitid: p.salesunitid?.id || null,
      unitName: p.salesunitid?.unitname || '',
      unitqty: p.unitqty ?? 1,
      qty: p.qty ?? 0,
      rate: p.rate ?? 0,
      discount: p.discount ?? 0,
      gst: p.gst ?? 0,
    })));
  }, [order]);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, i) => s + i.qty * i.rate, 0);
    const totaldiscount = lines.reduce((s, i) => s + i.qty * (i.discount || 0), 0);
    const totalgst = lines.reduce((s, i) => s + (i.rate - (i.discount || 0)) * i.qty * (i.gst || 0) / 100, 0);
    const totalamount = subtotal - totaldiscount + totalgst;
    return { subtotal, totaldiscount, totalgst, totalamount };
  }, [lines]);

  // Preview of the admin's auto-charges (delivery/handling/COD, etc.) —
  // display only. The server re-evaluates and applies the same rules itself
  // when the edit is saved (editSalesOrder), same as a new order.
  const charges = useChargePreview(totals.subtotal, order?.createdby_type || 'party');
  const grandTotal = totals.totalamount + charges.total;

  const setQty = (idx: number, qty: number) => {
    setLines(prev => {
      if (qty <= 0) return prev.filter((_, i) => i !== idx);
      return prev.map((l, i) => i === idx ? { ...l, qty } : l);
    });
  };

  // Add a product (with a chosen unit — kg / box / etc.) to the order. Rate is
  // resolved via the assigned price list (same engine the catalog uses), using
  // THIS order's party account.
  const addProduct = async (product: any, variant: any, up: any) => {
    if (!variant || !up?.unitid?.id) {
      Alert.alert('No price', 'This unit has no price configured.');
      return;
    }
    setAdding(true);
    try {
      let rate = up.offerprice ?? up.salesrate ?? up.mrp ?? 0;
      let discount = up.discount ?? 0;
      try {
        const res = await apolloClient.query({
          query: RESOLVE_PRICE,
          variables: {
            productid: product.id,
            variantid: variant.id,
            unitid: up.unitid.id,
            adminid: tenant.adminId,
            accountid: partyId,
            channelid: partyAccount?.channel?.id || null,
            region: partyAccount?.region || null,
          },
          fetchPolicy: 'network-only',
        });
        const rp = (res.data as any)?.resolvePrice;
        if (rp) {
          rate = rp.rate ?? rate;
          if (rp.discount != null && rp.discount > 0) discount = rp.discount;
        }
      } catch (e) { /* fall back to unit price */ }

      const newLine: Line = {
        productserviceid: product.id,
        productName: product.name,
        variantid: variant.id,
        variantName: variant.name || '',
        salesunitid: up.unitid.id,
        unitName: up.unitid.unitname || '',
        unitqty: up.quantity ?? 1,
        qty: 1,
        rate,
        discount,
        gst: variant.gst ?? 0,
      };
      setLines(prev => {
        const idx = prev.findIndex(l =>
          l.productserviceid === newLine.productserviceid &&
          l.variantid === newLine.variantid &&
          l.salesunitid === newLine.salesunitid);
        if (idx >= 0) return prev.map((l, i) => i === idx ? { ...l, qty: l.qty + 1 } : l);
        return [...prev, newLine];
      });
      setPicker(false);
      setSearch('');
    } finally {
      setAdding(false);
    }
  };

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p: any) => (p.name || '').toLowerCase().includes(q));
  }, [products, search]);

  const handleSave = async () => {
    if (!order) return;
    if (lines.length === 0) { Alert.alert('Empty', 'Order must have at least one item.'); return; }
    setSaving(true);
    try {
      await editOrder({
        variables: {
          id: orderId,
          input: {
            adminid: tenant.adminId,
            branchid: tenant.branchId,
            partyacc: order.partyacc?.id,
            paymenttype: order.paymenttype || 'cash',
            billdate: order.billdate || new Date().toISOString().slice(0, 10),
            billtype: order.billtype || 'order',
            taxorsupplytype: order.taxorsupplytype || 'regular',
            isservice: !!order.isservice,
            subtotal: totals.subtotal,
            totaldiscount: totals.totaldiscount,
            totalgst: totals.totalgst,
            totalamount: totals.totalamount,
            createdby_id: user?.id,
            createdby_name: user?.name,
            createdby_type: user?.role || 'party',
            productservice: lines.map(l => ({
              productserviceid: l.productserviceid,
              variantid: l.variantid,
              salesunitid: l.salesunitid,
              unitqty: l.unitqty ?? 1,
              gst: l.gst ?? 0,
              qty: l.qty,
              rate: l.rate,
              amount: (l.rate - (l.discount || 0)) * l.qty,
              discount: l.discount ?? 0,
            })),
          },
        },
      });
      Alert.alert('Saved', 'Order updated successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update order.');
    } finally {
      setSaving(false);
    }
  };

  const [editOrder] = useMutation(EDIT_SALES_ORDER);

  if (loading || !order) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />
        <BackHeader label="Edit Order" />
        <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
      </View>
    );
  }

  if (order.isConverted || order.cancelStatus === 'cancelled') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />
        <BackHeader label="Edit Order" />
        <View style={styles.center}>
          <Icon name="lock-outline" size={40} color={colors.subText} />
          <Text style={[styles.note, { color: colors.subText }]}>
            This order is {order.isConverted ? 'already converted to an invoice' : 'cancelled'} and can't be edited.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />
      <BackHeader label={`Edit Order ${order.billnumber ? '#' + order.billnumber : ''}`} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        {lines.map((l, idx) => (
          <View key={idx} style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>{l.productName}</Text>
              <Text style={[styles.sub, { color: colors.brand }]}>
                {[l.variantName, l.unitName].filter(Boolean).join(' · ') || '—'}
              </Text>
              {showPrice && (
                <Text style={[styles.price, { color: colors.subText }]}>
                  {formatINR(l.rate)}{l.discount > 0 ? ` (-${formatINR(l.discount)})` : ''} · GST {l.gst}%
                </Text>
              )}
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <View style={[styles.qtyRow, { borderColor: colors.brand }]}>
                <TouchableOpacity style={[styles.qtyBtn, { backgroundColor: colors.brandSoft }]} onPress={() => setQty(idx, l.qty - 1)}>
                  <Icon name={l.qty <= 1 ? 'trash-can-outline' : 'minus'} size={13} color={l.qty <= 1 ? '#ef4444' : colors.brand} />
                </TouchableOpacity>
                <Text style={[styles.qtyNum, { color: colors.brand }]}>{l.qty}</Text>
                <TouchableOpacity style={[styles.qtyBtn, { backgroundColor: colors.brandSoft }]} onPress={() => setQty(idx, l.qty + 1)}>
                  <Icon name="plus" size={13} color={colors.brand} />
                </TouchableOpacity>
              </View>
              {showPrice && (
                <Text style={[styles.amt, { color: colors.text }]}>{formatINR((l.rate - l.discount) * l.qty)}</Text>
              )}
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.addBtn, { borderColor: colors.brand }]}
          onPress={() => setPicker(true)}
          activeOpacity={0.85}
        >
          <Icon name="plus-circle-outline" size={18} color={colors.brand} />
          <Text style={[styles.addText, { color: colors.brand }]}>Add Product</Text>
        </TouchableOpacity>

        {showPrice && (
          <View style={[styles.summary, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
            <Row label="Subtotal" value={formatINR(totals.subtotal)} colors={colors} />
            <Row label="Discount" value={`-${formatINR(totals.totaldiscount)}`} colors={colors} />
            <Row label="GST" value={formatINR(totals.totalgst)} colors={colors} />
            {charges.lines.map((c) => (
              <Row key={c.ruleId} label={c.name} value={formatINR(c.totalamount)} colors={colors} />
            ))}
            <View style={[styles.row, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, marginTop: 4 }]}>
              <Text style={[styles.totalLabel, { color: colors.text }]}>Total</Text>
              <Text style={[styles.totalValue, { color: colors.brand }]}>{formatINR(grandTotal)}</Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: saving ? colors.border : colors.brand }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.88}
        >
          <Icon name="content-save-outline" size={18} color="#fff" />
          <Text style={styles.saveText}>{saving ? 'Saving…' : (showPrice ? `Save Changes · ${formatINR(grandTotal)}` : 'Save Changes')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Add-product picker */}
      <Modal visible={picker} transparent animationType="slide" onRequestClose={() => setPicker(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
            <View style={styles.modalHead}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Product</Text>
              <TouchableOpacity onPress={() => { setPicker(false); setSearch(''); }}>
                <Icon name="close" size={22} color={colors.subText} />
              </TouchableOpacity>
            </View>
            <View style={[styles.searchRow, { borderColor: colors.border, backgroundColor: colors.raisedSurface }]}>
              <Icon name="magnify" size={16} color={colors.subText} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search products…"
                placeholderTextColor={colors.subText}
                value={search}
                onChangeText={setSearch}
              />
            </View>
            {adding && <ActivityIndicator color={colors.brand} style={{ marginVertical: 8 }} />}
            <FlatList
              data={filteredProducts}
              keyExtractor={(p: any) => p.id}
              style={{ maxHeight: 380 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }: any) => {
                const v = item.productvariants?.[0];
                const units = (v?.unitprices ?? []).filter((u: any) => u?.unitid?.id);
                return (
                  <View style={[styles.prodRow, { borderColor: colors.border }]}>
                    <Text style={[styles.prodName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                    {v?.name ? <Text style={[styles.prodMeta, { color: colors.brand }]}>{v.name}</Text> : null}
                    {/* Unit chips — pick kg / box / etc. (each has its own price) */}
                    <View style={styles.unitWrap}>
                      {units.length === 0 && (
                        <Text style={[styles.prodMeta, { color: colors.subText }]}>No unit price configured</Text>
                      )}
                      {units.map((u: any, ui: number) => {
                        const price = u.offerprice ?? u.salesrate ?? u.mrp;
                        return (
                          <TouchableOpacity
                            key={ui}
                            style={[styles.unitChip, { borderColor: colors.brand, backgroundColor: colors.brandSoft }]}
                            onPress={() => addProduct(item, v, u)}
                            disabled={adding}
                            activeOpacity={0.8}
                          >
                            <Icon name="plus" size={12} color={colors.brand} />
                            <Text style={[styles.unitChipText, { color: colors.brand }]}>
                              {u.unitid?.unitname}{showPrice && price != null ? ` · ${formatINR(price)}` : ''}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={<Text style={[styles.prodMeta, { color: colors.subText, padding: 16 }]}>No products found.</Text>}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const Row = ({ label, value, colors }: any) => (
  <View style={styles.row}>
    <Text style={[styles.rowLabel, { color: colors.subText }]}>{label}</Text>
    <Text style={[styles.rowValue, { color: colors.text }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 30 },
  note: { fontSize: 14, fontFamily: FONTS.semiBold, textAlign: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 12, marginTop: 10 },
  name: { fontSize: 13, fontFamily: FONTS.semiBold, marginBottom: 2 },
  sub: { fontSize: 11, fontFamily: FONTS.semiBold, marginBottom: 3 },
  price: { fontSize: 11, fontFamily: FONTS.regular },
  qtyRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1.5, overflow: 'hidden' },
  qtyBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  qtyNum: { fontSize: 13, fontFamily: FONTS.bold, minWidth: 22, textAlign: 'center' },
  amt: { fontSize: 13, fontFamily: FONTS.bold },
  summary: { borderRadius: 16, borderWidth: 1, padding: 16, marginTop: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  rowLabel: { fontSize: 13, fontFamily: FONTS.regular },
  rowValue: { fontSize: 13, fontFamily: FONTS.semiBold },
  totalLabel: { fontSize: 15, fontFamily: FONTS.bold },
  totalValue: { fontSize: 16, fontFamily: FONTS.bold },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 15, marginTop: 16, marginBottom: 24 },
  saveText: { fontSize: 15, fontFamily: FONTS.bold, color: '#fff' },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', paddingVertical: 12, marginTop: 12 },
  addText: { fontSize: 14, fontFamily: FONTS.bold },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 28 },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 16, fontFamily: FONTS.bold },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: FONTS.regular, padding: 0 },
  prodRow: { paddingVertical: 12, borderBottomWidth: 1 },
  prodName: { fontSize: 14, fontFamily: FONTS.semiBold },
  prodMeta: { fontSize: 12, fontFamily: FONTS.regular, marginTop: 2 },
  unitWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  unitChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  unitChipText: { fontSize: 12, fontFamily: FONTS.semiBold },
});
