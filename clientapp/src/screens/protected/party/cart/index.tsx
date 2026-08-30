import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, Image, Alert, Modal, ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useApolloClient } from '@apollo/client/react';
import { useSelector, useDispatch } from 'react-redux';
import { COLORS, FONTS, useTheme, resolveMediaUrl } from '../../../../config';
import { formatINR } from '../../../../utils';
import { AppHeader, DynamicFlashList, AddressForm } from '../../../../components';
import { ADD_SALES_ORDER } from '../../../../apollo/mutations/accounts';
import { GET_SALES_ORDERS, GET_ACCOUNT } from '../../../../apollo/queries/accounts';
import { updateQty, removeFromCart, clearCart } from '../../../../store/slices';
import { useChargePreview } from '../../../../apollo/hooks/chargerules';
import { useShowProductPrice } from '../../../../apollo/hooks/adminsettings';
import type { RootState } from '../../../../store/rootreducer';

export default function CartScreen() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const dispatch = useDispatch();
  const apolloClient = useApolloClient();
  const cartItems = useSelector((s: RootState) => s.cart.items);
  const user = useSelector((s: RootState) => s.auth.user);
  const tenant = useSelector((s: RootState) => s.tenant);
  const adminid = tenant.adminId ?? '';
  const branchid = tenant.branchId ?? '';
  const [placing, setPlacing] = useState(false);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const showPrice = useShowProductPrice();

  const [addSalesOrder] = useMutation(ADD_SALES_ORDER);

  // A delivery address is required before placing an order — same fields
  // the admin panel's Add Account "Address Info" section collects.
  const { data: accountData, refetch: refetchAccount } = useQuery(GET_ACCOUNT, {
    variables: { id: user?.id, adminId: adminid },
    skip: !user?.id || !adminid,
  });
  const fullAccount = (accountData as any)?.getAccountById;
  const hasAddress = !!(fullAccount?.address && fullAccount?.city && fullAccount?.state && fullAccount?.pincode);

  const subtotal = cartItems.reduce((s, i) => s + i.qty * i.rate, 0);
  const totaldiscount = cartItems.reduce((s, i) => s + i.qty * (i.discount ?? 0), 0);
  const totalgst = cartItems.reduce((s, i) => s + (i.rate - (i.discount ?? 0)) * i.qty * (i.gst ?? 0) / 100, 0);
  const total = subtotal - totaldiscount + totalgst;

  // Preview of the admin's auto-charges (delivery/handling/COD, etc.) —
  // display only. The order is still submitted with `total` (unchanged);
  // the server applies the same rules itself at order-creation time.
  const charges = useChargePreview(subtotal, 'party');
  const grandTotal = total + charges.total;

  const handlePlaceOrder = () => {
    if (cartItems.length === 0) return;
    if (!hasAddress) {
      setAddressModalOpen(true);
      return;
    }
    submitOrder();
  };

  const submitOrder = async () => {
    if (cartItems.length === 0) return;
    setPlacing(true);
    try {
      await addSalesOrder({
        variables: {
          input: {
            adminid, branchid,
            partyacc: user?.id,
            paymenttype: 'cash',
            billdate: new Date().toISOString().slice(0, 10),
            billtype: 'order',
            taxorsupplytype: 'regular',
            isservice: false,
            subtotal, totaldiscount, totalgst,
            totalamount: total,
            createdby_id: user?.id,
            createdby_name: user?.name,
            createdby_type: user?.role || 'party',
            productservice: cartItems.map(i => ({
              productserviceid: i.productId,
              variantid: i.variantId,
              salesunitid: i.unitId,
              qty: i.qty,
              unitqty: i.unitqty ?? i.qty,
              rate: i.rate,
              discount: i.discount ?? 0,
              amount: i.amount,
              gst: i.gst ?? 0,
            })),
          },
        },
      });
      dispatch(clearCart());

      // Refetch orders to show new order immediately
      await apolloClient.refetchQueries({
        include: [GET_SALES_ORDERS],
      });

      Alert.alert('Order Placed!', 'Your order has been placed successfully.', [
        {
          text: 'View Orders',
          // Cart lives in the outer stack; the tabs are nested under
          // PartyDrawer → MainTabs, so target the tab through its parents
          // (a plain navigate('MyOrders') from here throws).
          onPress: () => navigation.navigate('PartyDrawer', {
            screen: 'MainTabs',
            params: { screen: 'MyOrders' },
          }),
        },
        { text: 'Continue Shopping', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to place order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  const renderItem = ({ item }: any) => {
    const disc = item.discount ?? 0;
    const gst = item.gst ?? 0;
    // price info line: ₹120.00 (-₹10.00) · GST 5%
    const priceInfo = [
      formatINR(item.rate),
      disc > 0 ? `(-${formatINR(disc)})` : null,
      `· GST ${gst}%`,
    ].filter(Boolean).join(' ');

    return (
      <View style={[styles.itemCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
        {/* Product image */}
        <View style={[styles.itemImg, { backgroundColor: colors.brandSoft }]}>
          {item.imageUrl
            ? <Image source={{ uri: resolveMediaUrl(item.imageUrl) }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
            : <Icon name="package-variant-closed" size={22} color={colors.brand} />
          }
        </View>

        {/* Info */}
        <View style={{ flex: 1 }}>
          <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={2}>{item.productName}</Text>
          {/* Subtitle in brand green — same as POS */}
          <Text style={[styles.itemVariant, { color: colors.brand }]}>
            {[item.variantName, item.unitName].filter(Boolean).join(' · ') || '—'}
          </Text>
          {/* Price line: ₹rate (-₹disc) · GST gst% — same format as POS */}
          {showPrice && (
            <Text style={[styles.itemPriceInfo, { color: colors.subText }]}>{priceInfo}</Text>
          )}
        </View>

        {/* Right: qty control + amount (same column, amount below qty like POS) */}
        <View style={styles.itemRight}>
          <View style={[styles.qtyRow, { borderColor: colors.brand }]}>
            <TouchableOpacity
              style={[styles.qtyBtn, { backgroundColor: colors.brandSoft }]}
              onPress={() => item.qty <= 1
                ? dispatch(removeFromCart({ productId: item.productId, variantId: item.variantId, unitId: item.unitId }))
                : dispatch(updateQty({ productId: item.productId, variantId: item.variantId, unitId: item.unitId, qty: item.qty - 1 }))
              }
            >
              <Icon
                name={item.qty <= 1 ? 'trash-can-outline' : 'minus'}
                size={13}
                color={item.qty <= 1 ? '#ef4444' : colors.brand}
              />
            </TouchableOpacity>
            <Text style={[styles.qtyNum, { color: colors.brand }]}>{item.qty}</Text>
            <TouchableOpacity
              style={[styles.qtyBtn, { backgroundColor: colors.brandSoft }]}
              onPress={() => dispatch(updateQty({ productId: item.productId, variantId: item.variantId, unitId: item.unitId, qty: item.qty + 1 }))}
            >
              <Icon name="plus" size={13} color={colors.brand} />
            </TouchableOpacity>
          </View>
          {showPrice && (
            <Text style={[styles.itemTotal, { color: colors.text }]}>{formatINR(item.amount)}</Text>
          )}
        </View>
      </View>
    );
  };

  const Footer = () => (
    <Animated.View entering={FadeInUp.duration(400).delay(60)}>
      {showPrice && (
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
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.subText }]}>GST</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{formatINR(totalgst)}</Text>
          </View>
          {charges.lines.map((c) => (
            <View style={styles.summaryRow} key={c.ruleId}>
              <Text style={[styles.summaryLabel, { color: colors.subText }]}>{c.name}</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{formatINR(c.totalamount)}</Text>
            </View>
          ))}
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={[styles.totalLabel, { color: colors.text }]}>Total Payable</Text>
            <Text style={[styles.totalValue, { color: colors.brand }]}>{formatINR(grandTotal)}</Text>
          </View>
        </View>
      )}

      {/* Place Order button with total — same as POS "Place Order • ₹115.50" */}
      <TouchableOpacity
        style={[styles.placeBtn, { backgroundColor: placing ? colors.border : colors.brand }, !showPrice && { marginTop: 6 }]}
        onPress={handlePlaceOrder}
        disabled={placing}
        activeOpacity={0.88}
      >
        {placing ? (
          <Text style={styles.placeBtnText}>Placing Order…</Text>
        ) : (
          <>
            <Icon name="check-circle-outline" size={18} color="#fff" />
            <Text style={styles.placeBtnText}>{showPrice ? `Place Order · ${formatINR(grandTotal)}` : 'Place Order'}</Text>
          </>
        )}
      </TouchableOpacity>
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
          estimatedItemSize={95}
          keyExtractor={(item: any) => `${item.productId}-${item.variantId}-${item.unitId ?? ''}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={<Footer />}
        />
      )}

      {/* Delivery address required before placing an order — same fields
          the admin panel's Add Account "Address Info" section collects. */}
      <Modal visible={addressModalOpen} transparent animationType="slide" onRequestClose={() => setAddressModalOpen(false)}>
        <View style={styles.addrOverlay}>
          <View style={[styles.addrSheet, { backgroundColor: colors.background }]}>
            <View style={styles.addrHeader}>
              <Icon name="map-marker-outline" size={22} color={colors.brand} />
              <Text style={[styles.addrTitle, { color: colors.text }]}>Add a delivery address</Text>
              <TouchableOpacity onPress={() => setAddressModalOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name="close" size={22} color={colors.subText} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.addrSubtitle, { color: colors.subText }]}>
              We need this to deliver your order — you'll only have to do this once.
            </Text>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {!!user?.id && (
                <AddressForm
                  accountId={user.id}
                  name={fullAccount?.name || user?.name || ''}
                  accountGroupId={fullAccount?.accountgroupid?.id}
                  initial={fullAccount}
                  submitLabel="Save & Place Order"
                  onSaved={() => {
                    setAddressModalOpen(false);
                    refetchAccount();
                    submitOrder();
                  }}
                />
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: 18, paddingTop: 10 },

  itemCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, borderWidth: 1, padding: 12, marginBottom: 10,
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  itemImg: {
    width: 52, height: 52, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden', flexShrink: 0,
  },
  itemName: { fontSize: 13, fontFamily: FONTS.semiBold, lineHeight: 18, marginBottom: 2 },
  itemVariant: { fontSize: 11, fontFamily: FONTS.semiBold, marginBottom: 3 },
  itemPriceInfo: { fontSize: 11, fontFamily: FONTS.regular },
  itemRight: { alignItems: 'flex-end', gap: 6 },
  itemTotal: { fontSize: 13, fontFamily: FONTS.bold },

  qtyRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 10, borderWidth: 1.5, overflow: 'hidden',
  },
  qtyBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  qtyNum: { fontSize: 13, fontFamily: FONTS.bold, minWidth: 22, textAlign: 'center' },

  summaryCard: {
    borderRadius: 20, borderWidth: 1, padding: 18, marginTop: 6, marginBottom: 12,
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  summaryTitle: { fontSize: 15, fontFamily: FONTS.bold, marginBottom: 14 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  summaryLabel: { fontSize: 13, fontFamily: FONTS.regular },
  summaryValue: { fontSize: 13, fontFamily: FONTS.semiBold },
  totalRow: { borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 12, marginTop: 4, marginBottom: 0 },
  totalLabel: { fontSize: 15, fontFamily: FONTS.bold },
  totalValue: { fontSize: 17, fontFamily: FONTS.bold },

  placeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 18, paddingVertical: 16, marginBottom: 32,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  placeBtnText: { fontSize: 16, fontFamily: FONTS.bold, color: '#fff' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  emptyText: { fontSize: 16, fontFamily: FONTS.semiBold },
  browseBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 16 },
  browseBtnText: { fontSize: 14, fontFamily: FONTS.bold },

  addrOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  addrSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
  addrHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  addrTitle: { flex: 1, fontSize: 17, fontFamily: FONTS.bold },
  addrSubtitle: { fontSize: 13, fontFamily: FONTS.regular, marginBottom: 16, lineHeight: 19 },
});
