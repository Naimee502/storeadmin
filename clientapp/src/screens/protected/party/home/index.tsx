import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, StatusBar,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { COLORS, FONTS, STRINGS, useTheme } from '../../../../config';
import { HomeScreenSkeleton } from '../../../../config/skeletonlayouts';
import { GET_PRODUCTS, GET_SALES_ORDERS } from '../../../../apollo/queries/party';
import { formatINR, formatDate } from '../../../../utils';
import { AppHeader } from '../../../../components';
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
  { id: 'dp1', name: 'Premium Basmati Rice',  imageurl: null, categoryid: { name: 'Grains' },  variants: [{ unitprices: [{ salesrate: 120 }] }] },
  { id: 'dp2', name: 'Toor Dal',              imageurl: null, categoryid: { name: 'Pulses' },  variants: [{ unitprices: [{ salesrate: 85  }] }] },
  { id: 'dp3', name: 'Refined Sunflower Oil', imageurl: null, categoryid: { name: 'Oils' },    variants: [{ unitprices: [{ salesrate: 170 }] }] },
  { id: 'dp4', name: 'Whole Wheat Atta',      imageurl: null, categoryid: { name: 'Grains' },  variants: [{ unitprices: [{ salesrate: 55  }] }] },
];

function orderStatus(order: any): string {
  if (order.cancelStatus === 'cancelled') return 'Cancelled';
  if (order.status) return 'Confirmed';
  return 'Pending';
}

export default function PartyHome() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const user      = useSelector((s: RootState) => s.auth.user);
  const tenant    = useSelector((s: RootState) => s.tenant);
  const cartItems = useSelector((s: RootState) => s.cart.items);
  const cartCount = cartItems.reduce((sum, i) => sum + i.qty, 0);
  const adminid   = tenant.adminId ?? '';

  const { data: ordersData, loading: ordersLoading } = useQuery(GET_SALES_ORDERS, {
    variables: { adminid, partyaccid: user?.id },
    skip: !adminid || !user?.id,
  });
  const { data: productsData, loading: productsLoading } = useQuery(GET_PRODUCTS, {
    variables: { adminid, limit: 6 },
    skip: !adminid,
  });

  const rawOrders   = (ordersData?.getSalesOrders      ?? []) as any[];
  const rawProducts = (productsData?.getProductServices ?? []) as any[];
  const orders   = rawOrders.length   > 0 ? rawOrders   : DUMMY_ORDERS;
  const products = rawProducts.length > 0 ? rawProducts : DUMMY_PRODUCTS;
  const recent   = orders.slice(0, 5);
  const pending  = orders.filter((o: any) => !o.status && o.cancelStatus !== 'cancelled').length;
  const isLoading = adminid && (ordersLoading || productsLoading);

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
              { icon: 'cash-multiple',          value: '₹0.00',              label: STRINGS.party.outstanding  },
              { icon: 'clipboard-list-outline',  value: String(pending),      label: STRINGS.party.pendingOrders },
              { icon: 'package-variant-closed',  value: String(products.length), label: STRINGS.party.catalog  },
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
                  const price = p.variants?.[0]?.unitprices?.[0]?.salesrate ?? 0;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.productCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
                      onPress={() => navigation.navigate('ProductDetail', { productId: p.id })}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.productImgWrap, { backgroundColor: colors.brandSoft }]}>
                        {p.imageurl
                          ? <Image source={{ uri: p.imageurl }} style={styles.productImg} resizeMode="cover" />
                          : <Icon name="package-variant-closed" size={26} color={colors.brand} />
                        }
                      </View>
                      <Text style={[styles.productName, { color: colors.text }]} numberOfLines={2}>{p.name}</Text>
                      <Text style={[styles.productPrice, { color: colors.brand }]}>{formatINR(price)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </Animated.View>

        </ScrollView>
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
  productImg:   { width: '100%', height: '100%' },
  productName:  { fontSize: 13, fontFamily: FONTS.semiBold, lineHeight: 18 },
  productPrice: { fontSize: 14, fontFamily: FONTS.bold, marginTop: 6 },
});
