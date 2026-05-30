import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, StatusBar,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@apollo/client/react';
import { useSelector, useDispatch } from 'react-redux';
import { COLORS, FONTS, STRINGS, useTheme } from '../../../../config';
import { HomeScreenSkeleton } from '../../../../config/skeletonlayouts';
import { GET_PRODUCTS, GET_SALES_ORDERS, GET_ACCOUNT, RESOLVE_PRICE } from '../../../../apollo/queries/accounts';
import { apolloClient } from '../../../../apollo/client';
import { formatINR, formatDate } from '../../../../utils';
import { AppHeader } from '../../../../components';
import { addToCart, updateQty } from '../../../../store/slices';
import type { RootState } from '../../../../store/rootreducer';

const STATUS_COLOR: Record<string, string> = {
  Cancelled: '#ef4444',
  Confirmed: '#3b82f6',
  Pending:   '#f59e0b',
};

const DUMMY_ORDERS = [
  { id: 'd1', billnumber: 'SO/2024/001', billdate: '2024-11-15T00:00:00.000Z', totalamount: 4788, status: true,  cancelStatus: null,        salesmenid: { name: 'Rahul S.' } },
  { id: 'd2', billnumber: 'SO/2024/002', billdate: '2024-11-10T00:00:00.000Z', totalamount: 1260, status: false, cancelStatus: null,        salesmenid: null },
  { id: 'd3', billnumber: 'SO/2024/003', billdate: '2024-11-05T00:00:00.000Z', totalamount: 3200, status: false, cancelStatus: 'cancelled', salesmenid: null },
];

const DUMMY_PRODUCTS = [
  { id: 'dp1', name: 'Premium Basmati Rice',  imageurl: null, categoryid: { id: 'c1', categoryname: 'Grains' },  productvariants: [{ id: 'dv1', name: '1 kg',  gst: 0, currentstock: 100, unitprices: [{ salesrate: 120, offerprice: 0, mrp: 140, discount: 0, unitid: null, quantity: 1 }] }] },
  { id: 'dp2', name: 'Toor Dal',              imageurl: null, categoryid: { id: 'c2', categoryname: 'Pulses' },  productvariants: [{ id: 'dv2', name: '500 g', gst: 0, currentstock: 60,  unitprices: [{ salesrate: 85,  offerprice: 0, mrp: 95,  discount: 0, unitid: null, quantity: 1 }] }] },
  { id: 'dp3', name: 'Refined Sunflower Oil', imageurl: null, categoryid: { id: 'c3', categoryname: 'Oils' },    productvariants: [{ id: 'dv3', name: '1 L',   gst: 0, currentstock: 200, unitprices: [{ salesrate: 170, offerprice: 0, mrp: 195, discount: 0, unitid: null, quantity: 1 }] }] },
  { id: 'dp4', name: 'Whole Wheat Atta',      imageurl: null, categoryid: { id: 'c1', categoryname: 'Grains' },  productvariants: [{ id: 'dv4', name: '5 kg',  gst: 0, currentstock: 0,   unitprices: [{ salesrate: 275, offerprice: 0, mrp: 310, discount: 0, unitid: null, quantity: 1 }] }] },
];

function orderStatus(order: any): string {
  if (order.cancelStatus === 'cancelled') return 'Cancelled';
  if (order.status) return 'Confirmed';
  return 'Pending';
}

export default function PartyHome() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const dispatch  = useDispatch();
  const user      = useSelector((s: RootState) => s.auth.user);
  const tenant    = useSelector((s: RootState) => s.tenant);
  const cartItems = useSelector((s: RootState) => s.cart.items);
  const cartCount = cartItems.reduce((sum, i) => sum + i.qty, 0);
  const adminid   = tenant.adminId ?? '';

  const [selectedUnits, setSelectedUnits] = useState<Record<string, number>>({});

  const { data: ordersData, loading: ordersLoading } = useQuery(GET_SALES_ORDERS, {
    variables: { adminid, partyaccid: user?.id },
    skip: !adminid || !user?.id,
  });
  const { data: productsData, loading: productsLoading } = useQuery(GET_PRODUCTS, {
    variables: { adminid, limit: 6 },
    skip: !adminid,
  });
  const { data: accountData } = useQuery(GET_ACCOUNT, {
    variables: { id: user?.id, adminId: adminid },
    skip: !user?.id || !adminid,
  });
  const partyAccount = (accountData as any)?.getAccountById;

  const rawOrders   = (ordersData?.getSalesOrders      ?? []) as any[];
  const rawProducts = (productsData?.getProductServices ?? []) as any[];
  const orders   = rawOrders.length   > 0 ? rawOrders   : DUMMY_ORDERS;
  const products = rawProducts.length > 0 ? rawProducts : DUMMY_PRODUCTS;
  const recent   = orders.slice(0, 5);
  const pending  = orders.filter((o: any) => !o.status && o.cancelStatus !== 'cancelled').length;
  const isLoading = adminid && (ordersLoading || productsLoading);

  const getCartQty = (productId: string, variantId: string, unitId?: string) =>
    cartItems.find(i => i.productId === productId && i.variantId === variantId && i.unitId === unitId)?.qty ?? 0;

  const getUnitLabel = (up: any) => {
    const name = up?.unitid?.unitname ?? 'Unit';
    const qty  = up?.quantity ?? 1;
    return qty > 1 ? `${qty} × ${name}` : name;
  };

  const handleAdd = async (p: any) => {
    const v = p.productvariants?.[0];
    if (!v) return;
    const unitIdx = selectedUnits[p.id] ?? 0;
    const up = v.unitprices?.[unitIdx] ?? v.unitprices?.[0];
    const defaultRate = (up?.offerprice ?? 0) > 0 ? up.offerprice : (up?.salesrate ?? 0);
    let rate = defaultRate, disc = up?.discount ?? 0;
    if (up?.unitid?.id) {
      try {
        const { data: pd } = await apolloClient.query({
          query: RESOLVE_PRICE,
          variables: {
            productid: p.id, variantid: v.id,
            unitid:    up.unitid.id,
            accountid: user?.id ?? null,
            channelid: partyAccount?.channel?.id ?? null,
            region:    partyAccount?.region ?? null,
          },
          fetchPolicy: 'network-only',
        });
        const rp = (pd as any)?.resolvePrice;
        if (rp?.rate != null) { rate = rp.rate; disc = rp.discount ?? 0; }
      } catch {}
    }
    dispatch(addToCart({
      productId: p.id, productName: p.name,
      variantId: v.id, variantName: v.name,
      unitId:   up?.unitid?.id,
      unitName: up?.unitid?.unitname,
      unitqty:  up?.quantity ?? 1,
      imageUrl: p.imageurl,
      qty: 1, rate, discount: disc, gst: v.gst ?? 0,
      amount: (rate - disc) * 1,
    }));
  };

  const handleQty = (productId: string, variantId: string, unitId: string | undefined, qty: number) =>
    dispatch(updateQty({ productId, variantId, unitId, qty }));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

      <AppHeader
        label={STRINGS.party.home}
        rightIcons={[{
          id: 'cart', name: 'cart-outline', color: colors.brand, badge: cartCount,
          onPress: () => navigation.navigate('CartScreen'),
        }]}
      />

      {isLoading ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
          <HomeScreenSkeleton />
        </ScrollView>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* Stats */}
          <Animated.View entering={FadeInUp.duration(400).delay(60)} style={styles.statsRow}>
            {[
              { icon: 'cash-multiple',          value: '₹0.00',                 label: STRINGS.party.outstanding  },
              { icon: 'clipboard-list-outline',  value: String(pending),         label: STRINGS.party.pendingOrders },
              { icon: 'package-variant-closed',  value: String(products.length), label: STRINGS.party.catalog      },
            ].map((s) => (
              <View key={s.label} style={[styles.statCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
                <View style={[styles.statIcon, { backgroundColor: colors.brandSoft }]}>
                  <Icon name={s.icon} size={17} color={colors.brand} />
                </View>
                <Text style={[styles.statValue, { color: colors.text }]}>{s.value}</Text>
                <Text style={[styles.statLabel, { color: colors.subText }]}>{s.label}</Text>
              </View>
            ))}
          </Animated.View>

          {/* Recent Orders */}
          <Animated.View entering={FadeInUp.duration(400).delay(120)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{STRINGS.party.recentOrders}</Text>
              <TouchableOpacity onPress={() => navigation.navigate('MyOrders')}>
                <Text style={[styles.viewAll, { color: colors.brand }]}>{STRINGS.party.viewAll}</Text>
              </TouchableOpacity>
            </View>

            {recent.length === 0 ? (
              <EmptyCard icon="clipboard-outline" label={STRINGS.party.noOrdersYet} colors={colors} />
            ) : (
              recent.map((order: any) => {
                const label  = orderStatus(order);
                const colour = STATUS_COLOR[label] ?? colors.brand;
                return (
                  <TouchableOpacity
                    key={order.id}
                    style={[styles.orderCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
                    onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.statusDot, { backgroundColor: colour }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.orderNum, { color: colors.text }]}>{order.billnumber ?? '–'}</Text>
                      <Text style={[styles.orderDate, { color: colors.subText }]}>{formatDate(order.billdate)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', marginRight: 8 }}>
                      <Text style={[styles.orderAmt, { color: colors.text }]}>{formatINR(order.totalamount)}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: colour + '22' }]}>
                        <Text style={[styles.statusText, { color: colour }]}>{label}</Text>
                      </View>
                    </View>
                    <Icon name="chevron-right" size={16} color={colors.subText} />
                  </TouchableOpacity>
                );
              })
            )}
          </Animated.View>

          {/* Featured Products */}
          <Animated.View entering={FadeInUp.duration(400).delay(180)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{STRINGS.party.catalog}</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Catalog')}>
                <Text style={[styles.viewAll, { color: colors.brand }]}>{STRINGS.party.browseAll}</Text>
              </TouchableOpacity>
            </View>

            {products.length === 0 ? (
              <EmptyCard icon="package-variant-closed" label={STRINGS.party.noProducts} colors={colors} />
            ) : (
              <View style={styles.productGrid}>
                {products.slice(0, 4).map((p: any) => {
                  const v        = p.productvariants?.[0];
                  const unitIdx  = selectedUnits[p.id] ?? 0;
                  const up       = v?.unitprices?.[unitIdx] ?? v?.unitprices?.[0];
                  const unitId   = up?.unitid?.id;
                  const price    = (up?.offerprice ?? 0) > 0 ? up.offerprice : (up?.salesrate ?? 0);
                  const mrp      = up?.mrp ?? 0;
                  const hasMrp   = mrp > 0;
                  const cartQty  = v ? getCartQty(p.id, v.id, unitId) : 0;
                  const outOfStock = v?.currentstock === 0;
                  const multiUnit  = (v?.unitprices?.length ?? 0) > 1;

                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.productCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
                      onPress={() => navigation.navigate('ProductDetail', { productId: p.id })}
                      activeOpacity={0.88}
                    >
                      <View style={[styles.productImgWrap, { backgroundColor: colors.brandSoft }]}>
                        {p.imageurl
                          ? <Image source={{ uri: p.imageurl }} style={styles.productImg} resizeMode="cover" />
                          : <Icon name="package-variant-closed" size={26} color={colors.brand} />
                        }
                        {outOfStock && (
                          <View style={styles.oosTag}>
                            <Text style={styles.oosText}>Out of Stock</Text>
                          </View>
                        )}
                      </View>

                      <Text style={[styles.productName, { color: colors.text }]} numberOfLines={2}>{p.name}</Text>

                      {multiUnit && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.unitScroll}>
                          {v.unitprices.map((u: any, ui: number) => {
                            const active = (selectedUnits[p.id] ?? 0) === ui;
                            return (
                              <TouchableOpacity
                                key={`${u.unitid?.id ?? ui}`}
                                style={[styles.unitChip, active
                                  ? { backgroundColor: colors.brand, borderColor: colors.brand }
                                  : { backgroundColor: colors.raisedSurface, borderColor: colors.border },
                                ]}
                                onPress={() => setSelectedUnits(prev => ({ ...prev, [p.id]: ui }))}
                              >
                                <Text style={[styles.unitChipText, { color: active ? '#fff' : colors.text }]}>
                                  {getUnitLabel(u)}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      )}

                      <View style={styles.priceRow}>
                        <Text style={[styles.productPrice, { color: colors.brand }]}>{formatINR(price)}</Text>
                        {hasMrp && <Text style={[styles.mrp, { color: colors.subText }]}>{formatINR(mrp)}</Text>}
                      </View>

                      {v && !outOfStock && (
                        cartQty === 0 ? (
                          <TouchableOpacity
                            style={[styles.addBtn, { backgroundColor: colors.brand }]}
                            onPress={() => handleAdd(p)}
                          >
                            <Icon name="plus" size={14} color="#fff" />
                            <Text style={styles.addBtnText}>Add</Text>
                          </TouchableOpacity>
                        ) : (
                          <View style={[styles.qtyControl, { borderColor: colors.brand }]}>
                            <TouchableOpacity
                              style={[styles.qtyBtn, { backgroundColor: colors.brandSoft }]}
                              onPress={() => handleQty(p.id, v.id, unitId, cartQty - 1)}
                            >
                              <Icon name="minus" size={13} color={colors.brand} />
                            </TouchableOpacity>
                            <Text style={[styles.qtyText, { color: colors.brand }]}>{cartQty}</Text>
                            <TouchableOpacity
                              style={[styles.qtyBtn, { backgroundColor: colors.brandSoft }]}
                              onPress={() => handleQty(p.id, v.id, unitId, cartQty + 1)}
                            >
                              <Icon name="plus" size={13} color={colors.brand} />
                            </TouchableOpacity>
                          </View>
                        )
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </Animated.View>

        </ScrollView>
      )}

      {cartCount > 0 && (
        <TouchableOpacity
          style={[styles.cartBar, { backgroundColor: colors.brand }]}
          onPress={() => navigation.navigate('CartScreen')}
          activeOpacity={0.9}
        >
          <View style={[styles.cartBadge, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
            <Text style={styles.cartBadgeText}>{cartCount}</Text>
          </View>
          <Text style={styles.cartBarText}>View Cart</Text>
          <Icon name="chevron-right" size={18} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

function EmptyCard({ icon, label, colors }: { icon: string; label: string; colors: any }) {
  return (
    <View style={[styles.emptyCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
      <Icon name={icon} size={28} color={colors.border} />
      <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 13, marginTop: 8 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll:    { paddingBottom: 110 },

  statsRow: { flexDirection: 'row', paddingHorizontal: 18, gap: 10, marginTop: 14 },
  statCard: {
    flex: 1, borderRadius: 18, borderWidth: 1, padding: 14, alignItems: 'flex-start',
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  statIcon:  { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statValue: { fontSize: 15, fontFamily: FONTS.bold },
  statLabel: { fontSize: 10, fontFamily: FONTS.regular, marginTop: 2 },

  section:       { marginTop: 22, paddingHorizontal: 18 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle:  { fontSize: 16, fontFamily: FONTS.bold },
  viewAll:       { fontSize: 13, fontFamily: FONTS.semiBold },

  emptyCard: {
    borderRadius: 16, borderWidth: 1, paddingVertical: 22, alignItems: 'center', justifyContent: 'center',
  },
  orderCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10,
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  statusDot:   { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  orderNum:    { fontSize: 14, fontFamily: FONTS.bold },
  orderDate:   { fontSize: 12, fontFamily: FONTS.regular, marginTop: 2 },
  orderAmt:    { fontSize: 14, fontFamily: FONTS.bold, marginBottom: 4 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  statusText:  { fontSize: 11, fontFamily: FONTS.semiBold },

  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  productCard: {
    width: '47%', borderRadius: 18, borderWidth: 1, padding: 12,
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  productImgWrap: {
    height: 78, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
    marginBottom: 10, overflow: 'hidden',
  },
  productImg:  { width: '100%', height: '100%' },
  oosTag:      { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 3, alignItems: 'center' },
  oosText:     { fontSize: 10, fontFamily: FONTS.semiBold, color: '#fff' },
  productName: { fontSize: 13, fontFamily: FONTS.semiBold, lineHeight: 18, marginBottom: 4 },
  unitScroll:   { flexGrow: 0, marginBottom: 6 },
  unitChip:     { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, marginRight: 5 },
  unitChipText: { fontSize: 10, fontFamily: FONTS.semiBold },
  priceRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  productPrice: { fontSize: 14, fontFamily: FONTS.bold },
  mrp:          { fontSize: 12, fontFamily: FONTS.regular, textDecorationLine: 'line-through' },
  addBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 8, gap: 4 },
  addBtnText:   { fontSize: 13, fontFamily: FONTS.bold, color: '#fff' },
  qtyControl:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, borderWidth: 1.5, overflow: 'hidden' },
  qtyBtn:       { paddingHorizontal: 12, paddingVertical: 8 },
  qtyText:      { fontSize: 14, fontFamily: FONTS.bold, minWidth: 24, textAlign: 'center' },

  cartBar: {
    position: 'absolute', bottom: 20, left: 18, right: 18,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 18, paddingHorizontal: 18, paddingVertical: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  cartBadge:     { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  cartBadgeText: { fontSize: 13, fontFamily: FONTS.bold, color: '#fff' },
  cartBarText:   { flex: 1, fontSize: 15, fontFamily: FONTS.bold, color: '#fff' },
});
