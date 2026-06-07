import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Alert } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useMutation } from '@apollo/client/react';
import { useSelector, useDispatch } from 'react-redux';
import { COLORS, FONTS, useTheme } from '../../../../config';
import { BackHeader, DynamicFlashList } from '../../../../components';
import { ADD_SALES_ORDER } from '../../../../apollo/mutations/accounts';
import { formatINR } from '../../../../utils';
import { clearCart, updateQty, removeFromCart } from '../../../../store/slices';
import type { RootState } from '../../../../store/rootreducer';
import type { CartItem } from '../../../../store/slices/cart';

export default function SalesmanCart() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const dispatch   = useDispatch();
  const cartItems  = useSelector((s: RootState) => s.cart.items);
  const partyId    = useSelector((s: RootState) => s.cart.partyId);
  const partyName  = useSelector((s: RootState) => s.cart.partyName);
  const tenant     = useSelector((s: RootState) => s.tenant);
  const user       = useSelector((s: RootState) => s.auth.user);
  const adminid    = tenant.adminId ?? '';

  const [placing, setPlacing] = useState(false);

  const [addSalesOrder] = useMutation(ADD_SALES_ORDER);

  const subtotal      = cartItems.reduce((s, i) => s + i.qty * i.rate, 0);
  const totaldiscount = cartItems.reduce((s, i) => s + i.qty * (i.discount ?? 0), 0);
  const totalgst      = cartItems.reduce((s, i) => s + (i.rate - (i.discount ?? 0)) * i.qty * (i.gst ?? 0) / 100, 0);
  const total         = subtotal - totaldiscount + totalgst;

  const handlePlaceOrder = async () => {
    if (!partyId || cartItems.length === 0) return;

    Alert.alert('Confirm Order', `Place order of ${formatINR(total)} for ${partyName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Place Order',
        onPress: async () => {
          setPlacing(true);
          try {
            await addSalesOrder({
              variables: {
                input: {
                  adminid,
                  branchid:        tenant.branchId ?? '',
                  partyacc:        partyId,
                  salesmenid:      user?.id,
                  paymenttype:     'cash',
                  billdate:        new Date().toISOString().slice(0, 10),
                  billtype:        'order',
                  taxorsupplytype: 'regular',
                  isservice:       false,
                  subtotal,
                  totaldiscount,
                  totalgst,
                  totalamount:     total,
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
            dispatch(clearCart());
            Alert.alert('Order Placed!', `Order for ${partyName} has been submitted.`, [
              {
                text: 'OK',
                // Cart lives in the outer stack; the tabs are nested under
                // SalesmanDrawer → MainTabs, so target the tab through its parents
                // (a plain navigate('SalesmanOrders') from here throws).
                onPress: () => navigation.navigate('SalesmanDrawer', {
                  screen: 'MainTabs',
                  params: { screen: 'SalesmanOrders' },
                }),
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
          <Icon name="package-variant-closed" size={20} color={colors.brand} />
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
            <TouchableOpacity
              style={[styles.qtyBtn, { backgroundColor: colors.brandSoft }]}
              onPress={() => dispatch(updateQty({ productId: item.productId, variantId: item.variantId, unitId: item.unitId, qty: item.qty - 1 }))}
            >
              <Icon name={item.qty <= 1 ? 'trash-can-outline' : 'minus'} size={12} color={item.qty <= 1 ? '#ef4444' : colors.brand} />
            </TouchableOpacity>
            <Text style={[styles.qtyText, { color: colors.brand }]}>{item.qty}</Text>
            <TouchableOpacity
              style={[styles.qtyBtn, { backgroundColor: colors.brandSoft }]}
              onPress={() => dispatch(updateQty({ productId: item.productId, variantId: item.variantId, unitId: item.unitId, qty: item.qty + 1 }))}
            >
              <Icon name="plus" size={12} color={colors.brand} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.itemAmount, { color: colors.text }]}>{formatINR(item.amount)}</Text>
        </View>
      </View>
    );
  };

  const Footer = () => (
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
        {totalgst > 0 && (
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.subText }]}>GST</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{formatINR(totalgst)}</Text>
          </View>
        )}
        <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
          <Text style={[styles.totalLabel, { color: colors.text }]}>Total</Text>
          <Text style={[styles.totalValue, { color: colors.brand }]}>{formatINR(total)}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.placeBtn, { backgroundColor: placing ? colors.border : colors.brand }]}
        onPress={handlePlaceOrder}
        disabled={placing}
        activeOpacity={0.88}
      >
        {placing
          ? <Text style={styles.placeBtnText}>Placing Order…</Text>
          : <><Icon name="check-circle-outline" size={18} color="#fff" /><Text style={styles.placeBtnText}>Place Order · {formatINR(total)}</Text></>
        }
      </TouchableOpacity>
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
          <TouchableOpacity onPress={() => navigation.navigate('SalesmanCatalog', { partyId, partyName })} style={{ marginLeft: 'auto' }}>
            <Text style={[styles.addMoreText, { color: colors.brand }]}>+ Add more</Text>
          </TouchableOpacity>
        </View>
      )}

      {cartItems.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Icon name="cart-off" size={52} color={colors.border} />
          <Text style={[styles.emptyText, { color: colors.subText }]}>Cart is empty</Text>
          <TouchableOpacity
            style={[styles.browseBtn, { backgroundColor: colors.brandSoft }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.browseBtnText, { color: colors.brand }]}>Browse Products</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <DynamicFlashList
          data={cartItems}
          renderItem={renderItem}
          estimatedItemSize={88}
          keyExtractor={(item: any) => `${item.productId}-${item.variantId}-${item.unitId ?? ''}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={<Footer />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  itemIcon:    { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
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
  placeBtnText: { fontSize: 16, fontFamily: FONTS.bold, color: '#fff' },

  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  emptyText: { fontSize: 16, fontFamily: FONTS.semiBold },
  browseBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 16 },
  browseBtnText: { fontSize: 14, fontFamily: FONTS.bold },
});
