import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, Image, Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useMutation } from '@apollo/client/react';
import { useSelector, useDispatch } from 'react-redux';
import { COLORS, FONTS, useTheme } from '../../../../config';
import { formatINR } from '../../../../utils';
import { AppHeader, AppButton, DynamicFlashList } from '../../../../components';
import { ADD_SALES_ORDER } from '../../../../apollo/mutations/accounts';
import { updateQty, removeFromCart, clearCart } from '../../../../store/slices';
import type { RootState } from '../../../../store/rootreducer';

export default function CartScreen() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const dispatch  = useDispatch();
  const cartItems = useSelector((s: RootState) => s.cart.items);
  const user      = useSelector((s: RootState) => s.auth.user);
  const tenant    = useSelector((s: RootState) => s.tenant);
  const adminid   = tenant.adminId ?? '';
  const branchid  = tenant.branchId ?? '';
  const [placing, setPlacing] = useState(false);

  const [addSalesOrder] = useMutation(ADD_SALES_ORDER);

  const subtotal      = cartItems.reduce((s, i) => s + i.qty * i.rate, 0);
  const totaldiscount = cartItems.reduce((s, i) => s + i.qty * (i.discount ?? 0), 0);
  const totalgst      = cartItems.reduce((s, i) => s + (i.rate - (i.discount ?? 0)) * i.qty * (i.gst ?? 0) / 100, 0);
  const total         = subtotal - totaldiscount + totalgst;

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) return;
    setPlacing(true);
    try {
      await addSalesOrder({
        variables: {
          input: {
            adminid,
            branchid,
            partyacc:         user?.id,
            paymenttype:      'cash',
            billdate:         new Date().toISOString().slice(0, 10),
            billtype:         'order',
            taxorsupplytype:  'regular',
            isservice:        false,
            subtotal,
            totaldiscount,
            totalgst,
            totalamount:      total,
            createdby_id:     user?.id,
            createdby_name:   user?.name,
            createdby_type:   'party',
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
      Alert.alert('Order Placed!', 'Your order has been placed successfully.', [
        { text: 'View Orders', onPress: () => navigation.navigate('MyOrders') },
        { text: 'Continue Shopping', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to place order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  const renderItem = ({ item }: any) => (
    <View style={[styles.itemCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
      <View style={[styles.itemImg, { backgroundColor: colors.brandSoft }]}>
        {item.imageUrl
          ? <Image source={{ uri: item.imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          : <Icon name="package-variant-closed" size={24} color={colors.brand} />
        }
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={2}>{item.productName}</Text>
        <Text style={[styles.itemVariant, { color: colors.subText }]}>
          {[item.variantName, item.unitName].filter(Boolean).join(' · ') || '—'}
        </Text>
        <Text style={[styles.itemRate, { color: colors.brand }]}>{formatINR(item.rate)} / {item.unitName ?? 'unit'}</Text>
        {(item.discount ?? 0) > 0 && (
          <Text style={[styles.itemDiscount, { color: colors.success ?? '#16a34a' }]}>
            -{formatINR(item.discount)} discount
          </Text>
        )}
      </View>

      <View style={styles.itemRight}>
        <Text style={[styles.itemTotal, { color: colors.text }]}>{formatINR(item.amount)}</Text>
        <View style={[styles.qtyRow, { borderColor: colors.brand }]}>
          <TouchableOpacity
            style={[styles.qtyBtn, { backgroundColor: colors.brandSoft }]}
            onPress={() => item.qty <= 1
              ? dispatch(removeFromCart({ productId: item.productId, variantId: item.variantId, unitId: item.unitId }))
              : dispatch(updateQty({ productId: item.productId, variantId: item.variantId, unitId: item.unitId, qty: item.qty - 1 }))
            }
          >
            <Icon name={item.qty <= 1 ? 'trash-can-outline' : 'minus'} size={13} color={item.qty <= 1 ? colors.error : colors.brand} />
          </TouchableOpacity>
          <Text style={[styles.qtyNum, { color: colors.brand }]}>{item.qty}</Text>
          <TouchableOpacity
            style={[styles.qtyBtn, { backgroundColor: colors.brandSoft }]}
            onPress={() => dispatch(updateQty({ productId: item.productId, variantId: item.variantId, unitId: item.unitId, qty: item.qty + 1 }))}
          >
            <Icon name="plus" size={13} color={colors.brand} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const Footer = () => (
    <Animated.View entering={FadeInUp.duration(400).delay(60)}>
      <View style={[styles.summaryCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
        <Text style={[styles.summaryTitle, { color: colors.text }]}>Price Details</Text>

        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.subText }]}>
            Subtotal ({cartItems.length} item{cartItems.length !== 1 ? 's' : ''})
          </Text>
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

        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={[styles.totalLabel, { color: colors.text }]}>Total Payable</Text>
          <Text style={[styles.totalValue, { color: colors.brand }]}>{formatINR(total)}</Text>
        </View>
      </View>

      <AppButton
        title="Place Order"
        onPress={handlePlaceOrder}
        loading={placing}
        style={{ marginTop: 8, marginBottom: 32 }}
      />
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

      <AppHeader label="My Cart" />

      {cartItems.length === 0 ? (
        <View style={styles.center}>
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
          estimatedItemSize={90}
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
  listContent: { paddingHorizontal: 18, paddingTop: 10 },

  itemCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderRadius: 16, borderWidth: 1, padding: 12, marginBottom: 10,
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  itemImg: {
    width: 60, height: 60, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  itemName:     { fontSize: 13, fontFamily: FONTS.semiBold, lineHeight: 18, marginBottom: 2 },
  itemVariant:  { fontSize: 11, fontFamily: FONTS.regular, marginBottom: 2 },
  itemRate:     { fontSize: 12, fontFamily: FONTS.semiBold },
  itemDiscount: { fontSize: 11, fontFamily: FONTS.semiBold, marginTop: 2 },
  itemRight:    { alignItems: 'flex-end', gap: 8 },
  itemTotal:    { fontSize: 14, fontFamily: FONTS.bold },

  qtyRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 10, borderWidth: 1.5, overflow: 'hidden',
  },
  qtyBtn:  { paddingHorizontal: 10, paddingVertical: 6 },
  qtyNum:  { fontSize: 13, fontFamily: FONTS.bold, minWidth: 22, textAlign: 'center' },

  summaryCard: {
    borderRadius: 20, borderWidth: 1, padding: 18, marginTop: 6, marginBottom: 12,
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  summaryTitle: { fontSize: 15, fontFamily: FONTS.bold, marginBottom: 14 },
  summaryRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  summaryLabel: { fontSize: 13, fontFamily: FONTS.regular },
  summaryValue: { fontSize: 13, fontFamily: FONTS.semiBold },
  totalRow:     { borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 12, marginTop: 4, marginBottom: 0 },
  totalLabel:   { fontSize: 15, fontFamily: FONTS.bold },
  totalValue:   { fontSize: 17, fontFamily: FONTS.bold },

  center:        { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  emptyText:     { fontSize: 16, fontFamily: FONTS.semiBold },
  browseBtn:     { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 16 },
  browseBtnText: { fontSize: 14, fontFamily: FONTS.bold },
});
