import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, Image, Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { COLORS, FONTS, useTheme } from '../../../../config';
import { formatINR } from '../../../../utils';
import { AppHeader, AppButton, DynamicFlashList } from '../../../../components';
import { updateQty, removeFromCart, clearCart } from '../../../../store/slices';
import type { RootState } from '../../../../store/rootreducer';

const DUMMY_ITEMS = [
  { productId: 'dp1', productName: 'Premium Basmati Rice', variantId: 'dv1', variantName: '5 kg',  imageUrl: null, qty: 3, rate: 560,  gst: 0, amount: 1680 },
  { productId: 'dp2', productName: 'Toor Dal',             variantId: 'dv2', variantName: '2 kg',  imageUrl: null, qty: 4, rate: 185,  gst: 0, amount: 740  },
  { productId: 'dp3', productName: 'Refined Sunflower Oil',variantId: 'dv3', variantName: '1 L',   imageUrl: null, qty: 6, rate: 170,  gst: 0, amount: 1020 },
];

export default function CartScreen() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const dispatch  = useDispatch();
  const cartItems = useSelector((s: RootState) => s.cart.items);
  const tenant    = useSelector((s: RootState) => s.tenant);
  const [placing, setPlacing] = useState(false);

  const items = cartItems.length > 0 ? cartItems : DUMMY_ITEMS;
  const isDummy = cartItems.length === 0;

  const subtotal  = items.reduce((s, i) => s + i.rate * i.qty, 0);
  const gstAmt    = items.reduce((s, i) => s + ((i.gst ?? 0) / 100) * i.rate * i.qty, 0);
  const total     = subtotal + gstAmt;

  const handlePlaceOrder = async () => {
    if (isDummy) {
      Alert.alert('Demo Mode', 'Add products from the catalog to place a real order.');
      return;
    }
    setPlacing(true);
    try {
      // TODO: call ADD_SALES_ORDER mutation with cart items
      await new Promise<void>(r => setTimeout(() => r(), 1200));
      dispatch(clearCart());
      Alert.alert('Order Placed!', 'Your order has been placed successfully.', [
        { text: 'View Orders', onPress: () => navigation.navigate('MyOrders') },
        { text: 'Continue Shopping', onPress: () => navigation.goBack() },
      ]);
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
        <Text style={[styles.itemVariant, { color: colors.subText }]}>{item.variantName}</Text>
        <Text style={[styles.itemRate, { color: colors.brand }]}>{formatINR(item.rate)} / unit</Text>
      </View>

      <View style={styles.itemRight}>
        <Text style={[styles.itemTotal, { color: colors.text }]}>{formatINR(item.rate * item.qty)}</Text>
        {!isDummy && (
          <View style={[styles.qtyRow, { borderColor: colors.brand }]}>
            <TouchableOpacity
              style={[styles.qtyBtn, { backgroundColor: colors.brandSoft }]}
              onPress={() => item.qty <= 1
                ? dispatch(removeFromCart({ productId: item.productId, variantId: item.variantId }))
                : dispatch(updateQty({ productId: item.productId, variantId: item.variantId, qty: item.qty - 1 }))
              }
            >
              <Icon name={item.qty <= 1 ? 'trash-can-outline' : 'minus'} size={13} color={item.qty <= 1 ? colors.error : colors.brand} />
            </TouchableOpacity>
            <Text style={[styles.qtyNum, { color: colors.brand }]}>{item.qty}</Text>
            <TouchableOpacity
              style={[styles.qtyBtn, { backgroundColor: colors.brandSoft }]}
              onPress={() => dispatch(updateQty({ productId: item.productId, variantId: item.variantId, qty: item.qty + 1 }))}
            >
              <Icon name="plus" size={13} color={colors.brand} />
            </TouchableOpacity>
          </View>
        )}
        {isDummy && (
          <View style={[styles.qtyBadge, { backgroundColor: colors.brandSoft }]}>
            <Text style={[styles.qtyBadgeText, { color: colors.brand }]}>× {item.qty}</Text>
          </View>
        )}
      </View>
    </View>
  );

  const Footer = () => (
    <Animated.View entering={FadeInUp.duration(400).delay(60)}>
      {/* Price breakdown */}
      <View style={[styles.summaryCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
        <Text style={[styles.summaryTitle, { color: colors.text }]}>Price Details</Text>

        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.subText }]}>
            Subtotal ({items.length} item{items.length !== 1 ? 's' : ''})
          </Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>{formatINR(subtotal)}</Text>
        </View>

        {gstAmt > 0 && (
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.subText }]}>GST</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{formatINR(gstAmt)}</Text>
          </View>
        )}

        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={[styles.totalLabel, { color: colors.text }]}>Total Payable</Text>
          <Text style={[styles.totalValue, { color: colors.brand }]}>{formatINR(total)}</Text>
        </View>
      </View>

      {isDummy && (
        <View style={[styles.demoNote, { backgroundColor: colors.brandSoft, borderColor: colors.brand + '44' }]}>
          <Icon name="information-outline" size={14} color={colors.brand} />
          <Text style={[styles.demoNoteText, { color: colors.brand }]}>
            Preview mode — add products from catalog to create a real order
          </Text>
        </View>
      )}

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

      <DynamicFlashList
        data={items}
        renderItem={renderItem}
        estimatedItemSize={90}
        keyExtractor={(item: any) => `${item.productId}-${item.variantId}`}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={<Footer />}
      />
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
  itemName:    { fontSize: 13, fontFamily: FONTS.semiBold, lineHeight: 18, marginBottom: 2 },
  itemVariant: { fontSize: 11, fontFamily: FONTS.regular, marginBottom: 4 },
  itemRate:    { fontSize: 12, fontFamily: FONTS.semiBold },
  itemRight:   { alignItems: 'flex-end', gap: 8 },
  itemTotal:   { fontSize: 14, fontFamily: FONTS.bold },

  qtyRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 10, borderWidth: 1.5, overflow: 'hidden',
  },
  qtyBtn:  { paddingHorizontal: 10, paddingVertical: 6 },
  qtyNum:  { fontSize: 13, fontFamily: FONTS.bold, minWidth: 22, textAlign: 'center' },
  qtyBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  qtyBadgeText: { fontSize: 12, fontFamily: FONTS.semiBold },

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

  demoNote: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 12,
  },
  demoNoteText: { fontSize: 12, fontFamily: FONTS.regular, flex: 1, lineHeight: 17 },
});
