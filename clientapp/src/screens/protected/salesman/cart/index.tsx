import React, { useState } from 'react';
import { useSalesmanOrderDiscount } from '../../../../apollo/hooks/adminsettings';
import { View, Text, StyleSheet, StatusBar, Alert, Modal, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, StackActions } from '@react-navigation/native';
import { useMutation } from '@apollo/client/react';
import { useSelector, useDispatch } from 'react-redux';
import { usePunchGate } from '../../../../apollo/hooks/attendance';
import { COLORS, FONTS, useTheme, IMG } from '../../../../config';
import { BackHeader, AppImage, DynamicFlashList } from '../../../../components';
import { ADD_SALES_ORDER } from '../../../../apollo/mutations/accounts';
import { MARK_VISIT } from '../../../../apollo/mutations/tracking';
import { getCurrentLatLng, getRecentFix, localYMD } from '../../../../utils/geo';
import { formatINR } from '../../../../utils';
import { clearCart, updateQty, removeFromCart } from '../../../../store/slices';
import { useChargePreview } from '../../../../apollo/hooks/chargerules';
import type { RootState } from '../../../../store/rootreducer';
import type { CartItem } from '../../../../store/slices/cart';

export default function SalesmanCart() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const dispatch   = useDispatch();
  const cartItems  = useSelector((s: RootState) => s.cart.items);
  const partyId    = useSelector((s: RootState) => s.cart.partyId);
  const partyName  = useSelector((s: RootState) => s.cart.partyName);
  const routeId    = useSelector((s: RootState) => s.cart.routeId);
  const routeDay   = useSelector((s: RootState) => s.cart.routeDay);
  const tenant     = useSelector((s: RootState) => s.tenant);
  const user       = useSelector((s: RootState) => s.auth.user);
  const adminid    = tenant.adminId ?? '';

  const [placing, setPlacing] = useState(false);
  const { blocked: punchBlocked } = usePunchGate();

  const [addSalesOrder] = useMutation(ADD_SALES_ORDER);
  const [markVisit] = useMutation(MARK_VISIT);

  const subtotal      = cartItems.reduce((s, i) => s + i.qty * i.rate, 0);
  const totaldiscount = cartItems.reduce((s, i) => s + i.qty * (i.discount ?? 0), 0);
  const totalgst      = cartItems.reduce((s, i) => s + (i.rate - (i.discount ?? 0)) * i.qty * (i.gst ?? 0) / 100, 0);
  const itemsTotal    = subtotal - totaldiscount + totalgst;

  // ── Extra order discount (Business Settings → salesman order discount) ──
  // Same maths as the admin panel's invoice discount: taken off the taxable
  // value (after item discounts), GST is left as computed on the lines.
  const discountAllowed = useSalesmanOrderDiscount();
  const [extraType, setExtraType]   = useState<'amount' | 'percent'>('amount');
  const [extraValue, setExtraValue] = useState(0);
  const [discOpen, setDiscOpen]     = useState(false);
  const [draftType, setDraftType]   = useState<'amount' | 'percent'>('amount');
  const [draftText, setDraftText]   = useState('');
  const taxable  = Math.max(0, subtotal - totaldiscount);
  const calcExtra = (type: 'amount' | 'percent', v: number) =>
    Math.round(Math.min(taxable, Math.max(0, type === 'percent' ? (taxable * v) / 100 : v)) * 100) / 100;
  const extraAmt = discountAllowed ? calcExtra(extraType, extraValue) : 0;
  const total    = itemsTotal - extraAmt;

  const openDiscount = () => {
    setDraftType(extraType);
    setDraftText(extraValue ? String(extraValue) : '');
    setDiscOpen(true);
  };
  const draftNum   = Number(draftText.replace(/,/g, '')) || 0;
  const draftError = draftNum < 0 ? 'Enter a valid discount'
    : draftType === 'percent' && draftNum > 100 ? 'Cannot be more than 100%'
    : draftType === 'amount' && draftNum > taxable ? `Cannot be more than ${formatINR(taxable)}`
    : null;
  const applyDiscount = () => {
    if (draftError) return;
    setExtraType(draftType);
    setExtraValue(Math.round(draftNum * 100) / 100);
    setDiscOpen(false);
  };
  const removeDiscount = () => { setExtraValue(0); setDiscOpen(false); };

  // Preview of the admin's auto-charges (delivery/handling/COD, etc.) —
  // display only. The order is still submitted with `total` (unchanged);
  // the server applies the same rules itself at order-creation time.
  const charges    = useChargePreview(subtotal, 'salesman');
  const grandTotal = total + charges.total;

  const handlePlaceOrder = async () => {
    if (!partyId || cartItems.length === 0) return;
    if (punchBlocked) { Alert.alert('Punch in required', 'Please punch in from the Attendance tab before taking orders.'); return; }

    Alert.alert('Confirm Order', `Place order of ${formatINR(grandTotal)} for ${partyName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Place Order',
        onPress: async () => {
          setPlacing(true);
          try {
            const { data: orderRes } = await addSalesOrder({
              variables: {
                input: {
                  adminid,
                  branchid:        tenant.branchId ?? '',
                  partyacc:        partyId,
                  salesmenid:      user?.id,
                  routeid:         routeId || undefined,
                  ordersource:     'app',
                  paymenttype:     'cash',
                  billdate:        localYMD(),
                  billtype:        'order',
                  taxorsupplytype: 'regular',
                  isservice:       false,
                  subtotal,
                  // Item discounts + the extra order discount, like the admin panel.
                  totaldiscount:   totaldiscount + extraAmt,
                  totalgst,
                  totalamount:     total,
                  ...(extraAmt > 0 ? { invoicediscount: extraType === 'amount' ? extraAmt : extraValue, invoicediscounttype: extraType } : {}),
                  createdby_id:    user?.id,
                  createdby_name:  user?.name,
                  createdby_type:  user?.role || 'salesman',
                  productservice: cartItems.map(i => ({
                    productserviceid: i.productId,
                    variantid:        i.variantId,
                    salesunitid:      i.unitId,
                    qty:              i.qty,
                    unitqty:          i.unitqty ?? i.qty,
                    rate:             i.rate,
                    discount:         i.discount ?? 0,
                    amount:           i.amount,
                    gst:              i.gst ?? 0,
                  })),
                },
              },
            });

            // Record the productive call (visited + order) in the background —
            // the order is already saved, so the confirmation never waits on GPS.
            const orderId = (orderRes as any)?.addSalesOrder?.id;
            (async () => {
              try {
                const here = getRecentFix(60000) ?? await getCurrentLatLng({ timeoutMs: 6000 });
                await markVisit({
                  variables: {
                    input: {
                      adminid,
                      branchid: tenant.branchId || undefined,
                      salesmanid: user?.id,
                      partyacc: partyId,
                      routeid: routeId || undefined,
                      day: routeDay || undefined,
                      outcome: 'productive',
                      orderid: orderId,
                      latitude: here?.lat,
                      longitude: here?.lng,
                      accuracy: here?.acc,
                    },
                  },
                });
              } catch (e: any) {
                console.warn('[visit] record failed:', e?.message);
              }
            })();

            dispatch(clearCart());
            Alert.alert('Order Placed!', `Order for ${partyName} has been submitted.`, [
              {
                text: 'OK',
                // Cart lives in the outer stack; the tabs are nested under
                // SalesmanDrawer → MainTabs, so target the tab through its parents
                // (a plain navigate('SalesmanOrders') from here throws).
                onPress: () => {
                  // Go back to the screen the visit started from — the route
                  // list (Routes tab) or My Parties — not the Orders tab, so
                  // the salesman carries on with the next party right away.
                  // Everything opened for this order (party visit → catalog →
                  // cart) is popped off the stack.
                  const state = navigation.getState?.();
                  const routes: any[] = state?.routes ?? [];
                  const firstIdx = routes.findIndex((r: any) =>
                    ['RoutePartyVisit', 'SalesmanCatalog', 'SalesmanCart'].includes(r.name),
                  );
                  if (firstIdx > 0) {
                    navigation.dispatch(StackActions.pop(routes.length - firstIdx));
                  } else {
                    navigation.navigate('SalesmanDrawer', {
                      screen: 'MainTabs',
                      params: { screen: 'SalesmanRoutes' },
                    });
                  }
                },
              },
            ]);
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to place order. Please try again.');
          } finally {
            setPlacing(false);
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: CartItem }) => {
    const disc      = item.discount ?? 0;
    const gst       = item.gst ?? 0;
    const priceInfo = [
      formatINR(item.rate),
      disc > 0 ? `(-${formatINR(disc)})` : null,
      `· GST ${gst}%`,
    ].filter(Boolean).join(' ');

    return (
      <View style={[styles.itemCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
        <View style={[styles.itemIcon, { backgroundColor: colors.brandSoft }]}>
          {item.imageUrl
            ? <AppImage uri={item.imageUrl} width={IMG.thumb} style={styles.itemImg} resizeMode="cover" fallback={<Icon name="package-variant-closed" size={20} color={colors.brand} />} />
            : <Icon name="package-variant-closed" size={20} color={colors.brand} />
          }
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>{item.productName}</Text>
          <Text style={[styles.itemVariant, { color: colors.brand }]}>
            {[item.variantName, item.unitName].filter(Boolean).join(' · ') || '—'}
          </Text>
          <Text style={[styles.itemRate, { color: colors.subText }]}>{priceInfo}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <View style={[styles.qtyControl, { borderColor: colors.brand }]}>
            <Pressable
              style={[styles.qtyBtn, { backgroundColor: colors.brandSoft }]}
              onPress={() => dispatch(updateQty({ productId: item.productId, variantId: item.variantId, unitId: item.unitId, qty: item.qty - 1 }))}
            >
              <Icon name={item.qty <= 1 ? 'trash-can-outline' : 'minus'} size={12} color={item.qty <= 1 ? '#ef4444' : colors.brand} />
            </Pressable>
            <Text style={[styles.qtyText, { color: colors.brand }]}>{item.qty}</Text>
            <Pressable
              style={[styles.qtyBtn, { backgroundColor: colors.brandSoft }]}
              onPress={() => dispatch(updateQty({ productId: item.productId, variantId: item.variantId, unitId: item.unitId, qty: item.qty + 1 }))}
            >
              <Icon name="plus" size={12} color={colors.brand} />
            </Pressable>
          </View>
          <Text style={[styles.itemAmount, { color: colors.text }]}>{formatINR(item.amount)}</Text>
        </View>
      </View>
    );
  };

  const renderFooter = () => (
    <View>
      {/* Price breakdown */}
      <View style={[styles.summaryCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
        <Text style={[styles.summaryTitle, { color: colors.text }]}>Order Summary</Text>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.subText }]}>Subtotal</Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>{formatINR(subtotal)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.subText }]}>Total Discount</Text>
          <Text style={[styles.summaryValue, { color: totaldiscount > 0 ? '#16a34a' : colors.subText }]}>
            {totaldiscount > 0 ? `-${formatINR(totaldiscount)}` : formatINR(0)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.subText }]}>GST</Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>{formatINR(totalgst)}</Text>
        </View>
        {discountAllowed && (
          extraAmt > 0 ? (
            <Pressable style={styles.summaryRow} onPress={openDiscount}>
              <View style={styles.extraLabelWrap}>
                <Text style={[styles.summaryLabel, { color: colors.subText }]}>
                  Extra discount{extraType === 'percent' ? ` (${extraValue}%)` : ''}
                </Text>
                <Icon name="pencil-outline" size={13} color={colors.brand} />
              </View>
              <Text style={[styles.summaryValue, { color: '#16a34a' }]}>-{formatINR(extraAmt)}</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.addDiscBtn, { borderColor: colors.brand, backgroundColor: colors.brandSoft }]}
              onPress={openDiscount}
            >
              <Icon name="tag-plus-outline" size={15} color={colors.brand} />
              <Text style={[styles.addDiscText, { color: colors.brand }]}>Add extra discount</Text>
            </Pressable>
          )
        )}
        {charges.lines.map((c) => (
          <View style={styles.summaryRow} key={c.ruleId}>
            <Text style={[styles.summaryLabel, { color: colors.subText }]}>{c.name}</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{formatINR(c.totalamount)}</Text>
          </View>
        ))}
        <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
          <Text style={[styles.totalLabel, { color: colors.text }]}>Total</Text>
          <Text style={[styles.totalValue, { color: colors.brand }]}>{formatINR(grandTotal)}</Text>
        </View>
      </View>

      <Pressable
        style={[styles.placeBtn, { backgroundColor: placing ? colors.border : colors.brand }]}
        onPress={handlePlaceOrder}
        disabled={placing}
      >
        {placing
          ? <Text style={[styles.placeBtnText, { color: colors.onBrand }]}>Placing Order…</Text>
          : <><Icon name="check-circle-outline" size={18} color={colors.onBrand} /><Text style={[styles.placeBtnText, { color: colors.onBrand }]}>Place Order · {formatINR(grandTotal)}</Text></>
        }
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

      <BackHeader label="Cart" />

      {/* Party context banner */}
      {partyName && (
        <View style={[styles.partyBanner, { backgroundColor: colors.brandSoft }]}>
          <Icon name="account-tie-outline" size={14} color={colors.brand} />
          <Text style={[styles.partyBannerText, { color: colors.brand }]}>
            Order for <Text style={{ fontFamily: FONTS.bold }}>{partyName}</Text>
          </Text>
          <Pressable onPress={() => navigation.navigate('SalesmanCatalog', { partyId, partyName })} style={{ marginLeft: 'auto' }}>
            <Text style={[styles.addMoreText, { color: colors.brand }]}>+ Add more</Text>
          </Pressable>
        </View>
      )}

      {cartItems.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Icon name="cart-off" size={52} color={colors.border} />
          <Text style={[styles.emptyText, { color: colors.subText }]}>Cart is empty</Text>
          <Pressable
            style={[styles.browseBtn, { backgroundColor: colors.brandSoft }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.browseBtnText, { color: colors.brand }]}>Browse Products</Text>
          </Pressable>
        </View>
      ) : (
        <DynamicFlashList
          data={cartItems}
          renderItem={renderItem}
          estimatedItemSize={88}
          keyExtractor={(item: any) => `${item.productId}-${item.variantId}-${item.unitId ?? ''}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={renderFooter()}
        />
      )}
      {/* Extra discount sheet */}
      <Modal visible={discOpen} transparent animationType="slide" onRequestClose={() => setDiscOpen(false)} statusBarTranslucent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={[styles.sheetBackdrop, { backgroundColor: colors.modalOverlay }]} onPress={() => setDiscOpen(false)}>
            <Pressable style={[styles.sheet, { backgroundColor: colors.raisedSurface }]} onPress={() => {}}>
              <View style={[styles.grabber, { backgroundColor: colors.border }]} />
              <View style={styles.sheetHead}>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>Extra discount</Text>
                <Pressable onPress={() => setDiscOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Icon name="close" size={20} color={colors.subText} />
                </Pressable>
              </View>
              <Text style={[styles.sheetSub, { color: colors.subText }]}>
                On order value {formatINR(taxable)} (after item discounts, before GST)
              </Text>

              {/* ₹ / % switch */}
              <View style={[styles.segment, { borderColor: colors.border, backgroundColor: colors.softSurface }]}>
                {(['amount', 'percent'] as const).map((t) => {
                  const on = draftType === t;
                  return (
                    <Pressable
                      key={t}
                      style={[styles.segBtn, on && { backgroundColor: colors.brand }]}
                      onPress={() => setDraftType(t)}
                    >
                      <Text style={[styles.segText, { color: on ? colors.onBrand : colors.text }]}>
                        {t === 'amount' ? '₹ Amount' : '% Percent'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={[styles.discInputWrap, { borderColor: draftError ? '#ef4444' : colors.brand }]}>
                <Text style={[styles.discAffix, { color: colors.subText }]}>{draftType === 'amount' ? '₹' : ''}</Text>
                <TextInput
                  value={draftText}
                  onChangeText={(t) => setDraftText(t.replace(/[^0-9.]/g, ''))}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.subText}
                  style={[styles.discInput, { color: colors.text }]}
                  autoFocus
                />
                <Text style={[styles.discAffix, { color: colors.subText }]}>{draftType === 'percent' ? '%' : ''}</Text>
              </View>

              {/* Quick picks */}
              <View style={styles.quickRow}>
                {(draftType === 'percent' ? [2, 5, 10, 15] : [50, 100, 200, 500]).map((q) => (
                  <Pressable
                    key={q}
                    style={[styles.quickChip, { borderColor: colors.border, backgroundColor: colors.softSurface }]}
                    onPress={() => setDraftText(String(q))}
                  >
                    <Text style={[styles.quickText, { color: colors.text }]}>{draftType === 'percent' ? `${q}%` : `₹${q}`}</Text>
                  </Pressable>
                ))}
              </View>

              {draftError ? (
                <Text style={styles.discError}>{draftError}</Text>
              ) : (
                <View style={[styles.previewBox, { backgroundColor: colors.brandSoft }]}>
                  <Text style={[styles.previewText, { color: colors.brand }]}>
                    Discount {formatINR(calcExtra(draftType, draftNum))}
                  </Text>
                  <Text style={[styles.previewTotal, { color: colors.brand }]}>
                    New total {formatINR(itemsTotal - calcExtra(draftType, draftNum) + charges.total)}
                  </Text>
                </View>
              )}

              <View style={styles.sheetBtns}>
                {extraValue > 0 && (
                  <Pressable style={[styles.sheetBtn, { borderWidth: 1, borderColor: '#ef4444' }]} onPress={removeDiscount}>
                    <Text style={[styles.sheetBtnText, { color: '#ef4444' }]}>Remove</Text>
                  </Pressable>
                )}
                <Pressable
                  style={[styles.sheetBtn, { backgroundColor: colors.brand, opacity: draftError ? 0.5 : 1 }]}
                  onPress={applyDiscount}
                  disabled={!!draftError}
                >
                  <Text style={[styles.sheetBtnText, { color: colors.onBrand }]}>Apply</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  extraLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addDiscBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 7, marginTop: 0, marginBottom: 8 },
  addDiscText:  { fontSize: 13, fontFamily: FONTS.semiBold },
  sheetBackdrop:{ flex: 1, justifyContent: 'flex-end' },
  sheet:        { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingBottom: 28 },
  grabber:      { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  sheetHead:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  sheetTitle:   { fontSize: 16, fontFamily: FONTS.bold },
  sheetSub:     { fontSize: 12, fontFamily: FONTS.regular, marginBottom: 12 },
  segment:      { flexDirection: 'row', borderWidth: 1, borderRadius: 12, padding: 3, marginBottom: 12 },
  segBtn:       { flex: 1, borderRadius: 9, paddingVertical: 8, alignItems: 'center' },
  segText:      { fontSize: 13, fontFamily: FONTS.semiBold },
  discInputWrap:{ flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14 },
  discAffix:    { fontSize: 20, fontFamily: FONTS.semiBold },
  discInput:    { flex: 1, fontSize: 22, fontFamily: FONTS.bold, paddingVertical: 10, paddingHorizontal: 6 },
  quickRow:     { flexDirection: 'row', gap: 8, marginTop: 10 },
  quickChip:    { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 7, alignItems: 'center' },
  quickText:    { fontSize: 12, fontFamily: FONTS.semiBold },
  discError:    { color: '#ef4444', fontSize: 12, fontFamily: FONTS.semiBold, marginTop: 12 },
  previewBox:   { flexDirection: 'row', justifyContent: 'space-between', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginTop: 12 },
  previewText:  { fontSize: 13, fontFamily: FONTS.semiBold },
  previewTotal: { fontSize: 13, fontFamily: FONTS.bold },
  sheetBtns:    { flexDirection: 'row', gap: 10, marginTop: 16 },
  sheetBtn:     { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  sheetBtnText: { fontSize: 14, fontFamily: FONTS.semiBold },
  container:   { flex: 1 },
  listContent: { paddingHorizontal: 18, paddingBottom: 40, paddingTop: 8 },

  partyBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 18, marginTop: 10, marginBottom: 4,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  partyBannerText: { fontSize: 13, fontFamily: FONTS.semiBold },
  addMoreText:     { fontSize: 12, fontFamily: FONTS.semiBold },

  itemCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10,
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  itemIcon:    { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  itemImg:     { ...StyleSheet.absoluteFillObject },
  itemName:    { fontSize: 13, fontFamily: FONTS.bold, marginBottom: 2 },
  itemVariant: { fontSize: 11, fontFamily: FONTS.regular, marginBottom: 2 },
  itemRate:    { fontSize: 11, fontFamily: FONTS.regular },
  itemAmount:  { fontSize: 14, fontFamily: FONTS.bold },
  qtyControl:  { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1.5, overflow: 'hidden' },
  qtyBtn:      { paddingHorizontal: 8, paddingVertical: 5 },
  qtyText:     { fontSize: 13, fontFamily: FONTS.bold, minWidth: 22, textAlign: 'center' },

  summaryCard: {
    borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 14, marginTop: 4,
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  summaryTitle: { fontSize: 14, fontFamily: FONTS.bold, marginBottom: 12 },
  summaryRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 13, fontFamily: FONTS.regular },
  summaryValue: { fontSize: 13, fontFamily: FONTS.semiBold },
  totalRow:     { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: 12, marginTop: 4 },
  totalLabel:   { fontSize: 15, fontFamily: FONTS.bold },
  totalValue:   { fontSize: 17, fontFamily: FONTS.bold },

  placeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 18, paddingVertical: 16, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  placeBtnText: { fontSize: 16, fontFamily: FONTS.bold },

  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  emptyText: { fontSize: 16, fontFamily: FONTS.semiBold },
  browseBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 16 },
  browseBtnText: { fontSize: 14, fontFamily: FONTS.bold },
});
