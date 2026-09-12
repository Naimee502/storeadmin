import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, ActivityIndicator, Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@apollo/client/react';
import { useSelector, useDispatch } from 'react-redux';
import { COLORS, FONTS, STRINGS, useTheme, IMG } from '../../../../config';
import { HomeScreenSkeleton } from '../../../../config/skeletonlayouts';
import { GET_SALES_ORDERS, GET_ACCOUNT, GET_TRANSACTIONS, RESOLVE_PRICE } from '../../../../apollo/queries/accounts';
import { useProductPage } from '../../../../apollo/hooks/products';
import { GET_CATEGORIES } from '../../../../apollo/queries/categories';
import { apolloClient } from '../../../../apollo/client';
import { formatINR, formatDate, formatBillNumber, ledgerEntryTotals, useIsEndUserParty } from '../../../../utils';
import { AppHeader, AppImage, AppTextInput, CategoryStrip, DynamicFlashList, HeroBanner, useNotificationCenter } from '../../../../components';
import type { CategoryItem } from '../../../../components';
import { addToCart, updateQty } from '../../../../store/slices';
import { useShowProductPrice, useShowProductStock, useHeroBannerSlides, useProductImageRatio, useCatalogPrice } from '../../../../apollo/hooks/adminsettings';
import type { RootState } from '../../../../store/rootreducer';

const STATUS_COLOR: Record<string, string> = {
  Cancelled: '#ef4444',
  Confirmed: '#3b82f6',
  Pending: '#f59e0b',
  Dispatched: '#0ea5e9',
  Delivered: '#22c55e',
};




const DUMMY_ORDERS = [
  { id: 'd1', billnumber: '000001', billdate: '2024-11-15', totalamount: 4788, isConverted: true, cancelStatus: null, salesmenid: { name: 'Rahul S.' } },
  { id: 'd2', billnumber: '000002', billdate: '2024-11-10', totalamount: 1260, isConverted: false, cancelStatus: null, salesmenid: null },
  { id: 'd3', billnumber: '000003', billdate: '2024-11-05', totalamount: 3200, isConverted: false, cancelStatus: 'cancelled', salesmenid: null },
];

const DUMMY_PRODUCTS = [
  { id: 'dp1', name: 'Premium Basmati Rice', imageurl: null, categoryid: { id: 'c1', categoryname: 'Grains' }, productvariants: [{ id: 'dv1', name: '1 kg', gst: 0, currentstock: 100, unitprices: [{ salesrate: 120, offerprice: 0, mrp: 140, discount: 0, unitid: null, quantity: 1 }] }] },
  { id: 'dp2', name: 'Toor Dal', imageurl: null, categoryid: { id: 'c2', categoryname: 'Pulses' }, productvariants: [{ id: 'dv2', name: '500 g', gst: 0, currentstock: 60, unitprices: [{ salesrate: 85, offerprice: 0, mrp: 95, discount: 0, unitid: null, quantity: 1 }] }] },
  { id: 'dp3', name: 'Refined Sunflower Oil', imageurl: null, categoryid: { id: 'c3', categoryname: 'Oils' }, productvariants: [{ id: 'dv3', name: '1 L', gst: 0, currentstock: 200, unitprices: [{ salesrate: 170, offerprice: 0, mrp: 195, discount: 0, unitid: null, quantity: 1 }] }] },
  { id: 'dp4', name: 'Whole Wheat Atta', imageurl: null, categoryid: { id: 'c1', categoryname: 'Grains' }, productvariants: [{ id: 'dv4', name: '5 kg', gst: 0, currentstock: 0, unitprices: [{ salesrate: 275, offerprice: 0, mrp: 310, discount: 0, unitid: null, quantity: 1 }] }] },
];

/**
 * One product card, memoised.
 *
 * Pulled out of the grid's .map() so that adding something to the cart
 * re-renders the one card whose quantity changed instead of all fifty. The
 * screen subscribes to `cart.items`, so every tap on + used to produce a new
 * render of the entire list — cheap per card, very much not cheap fifty times
 * while a finger is still on the screen.
 *
 * For React.memo to actually hold, everything crossing this boundary has to be
 * stable between renders: `product` is the object Apollo hands back (same
 * reference until the query result really changes), the callbacks are
 * useCallback'd by the parent, and the values that DO change per card are
 * passed as primitives. That is also why the price multiplier comes in rather
 * than useCatalogPrice's formatCatalogINR — the hook builds a new function on
 * every render, so passing it would make every card look changed, every time.
 */
interface ProductCardProps {
  product: any;
  colors: any;
  imgRatio: number | null;
  showPrice: boolean;
  showStock: boolean;
  /** Catalogue price multiplier (2 when "double display price" is on). */
  multiplier: number;
  unitIdx: number;
  cartQty: number;
  onOpen: (productId: string) => void;
  onAdd: (product: any) => void;
  onQty: (productId: string, variantId: string, unitId: string | undefined, qty: number) => void;
  onSelectUnit: (productId: string, unitIndex: number) => void;
}

const ProductCard = React.memo(function ProductCard({
  product: p, colors, imgRatio, showPrice, showStock, multiplier,
  unitIdx, cartQty, onOpen, onAdd, onQty, onSelectUnit,
}: ProductCardProps) {
  const v = p.productvariants?.[0];
  const up = v?.unitprices?.[unitIdx] ?? v?.unitprices?.[0];
  const unitId = up?.unitid?.id;
  const price = (up?.offerprice ?? 0) > 0 ? up.offerprice : (up?.salesrate ?? 0);
  const mrp = up?.mrp ?? 0;
  const hasMrp = mrp > 0;
  const outOfStock = v?.currentstock === 0;
  const multiUnit = (v?.unitprices?.length ?? 0) > 1;

  const unitLabel = (u: any) => {
    const name = u?.unitid?.unitname ?? 'Unit';
    const qty = u?.quantity ?? 1;
    return qty > 1 ? `${qty} × ${name}` : name;
  };

  return (
    <TouchableOpacity
      style={[styles.productCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
      onPress={() => onOpen(p.id)}
      activeOpacity={0.88}
    >
      <View>
        <View style={[styles.productImgWrap, { backgroundColor: colors.brandSoft }, imgRatio ? { height: undefined, aspectRatio: imgRatio } : null]}>
          {p.imageurl
            ? <AppImage uri={p.imageurl} width={IMG.card} style={styles.productImg} resizeMode="cover" />
            : <Icon name="package-variant-closed" size={26} color={colors.brand} />
          }
          {showStock && outOfStock && (
            <View style={styles.oosTag}>
              <Text style={styles.oosText}>Out of Stock</Text>
            </View>
          )}
        </View>

        <Text style={[styles.productName, { color: colors.text }]} numberOfLines={2}>{p.name}</Text>
        {p.categoryid?.categoryname && (
          <Text style={[styles.catText, { color: colors.subText }]}>{p.categoryid.categoryname}</Text>
        )}

        {multiUnit && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.unitScroll}>
            {v.unitprices.map((u: any, ui: number) => {
              const active = unitIdx === ui;
              return (
                <TouchableOpacity
                  key={`${u.unitid?.id ?? ui}`}
                  style={[styles.unitChip, active
                    ? { backgroundColor: colors.brand, borderColor: colors.brand }
                    : { backgroundColor: colors.raisedSurface, borderColor: colors.border },
                  ]}
                  onPress={() => onSelectUnit(p.id, ui)}
                >
                  <Text style={[styles.unitChipText, { color: active ? '#fff' : colors.text }]}>
                    {unitLabel(u)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {showPrice && (
          <View style={styles.priceRow}>
            <Text style={[styles.productPrice, { color: colors.brand }]}>{formatINR(price * multiplier)}</Text>
            {hasMrp && <Text style={[styles.mrp, { color: colors.subText }]}>{formatINR(mrp * multiplier)}</Text>}
          </View>
        )}
      </View>

      {v && !outOfStock && (
        cartQty === 0 ? (
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.brand }]}
            onPress={() => onAdd(p)}
          >
            <Icon name="plus" size={14} color="#fff" />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.qtyControl, { borderColor: colors.brand }]}>
            <TouchableOpacity
              style={[styles.qtyBtn, { backgroundColor: colors.brandSoft }]}
              onPress={() => onQty(p.id, v.id, unitId, cartQty - 1)}
            >
              <Icon name="minus" size={13} color={colors.brand} />
            </TouchableOpacity>
            <Text style={[styles.qtyText, { color: colors.brand }]}>{cartQty}</Text>
            <TouchableOpacity
              style={[styles.qtyBtn, { backgroundColor: colors.brandSoft }]}
              onPress={() => onQty(p.id, v.id, unitId, cartQty + 1)}
            >
              <Icon name="plus" size={13} color={colors.brand} />
            </TouchableOpacity>
          </View>
        )
      )}
    </TouchableOpacity>
  );
});

// Mirrors displayStatus() in MyOrders (orders/index.tsx) so the home screen's
// "Recent Orders" preview matches the real status shown on the full list —
// it was previously stuck on Cancelled/Confirmed/Pending and never showed
// Dispatched/Delivered.
function orderStatus(order: any): string {
  if (order.cancelStatus === 'cancelled') return 'Cancelled';
  if (order.deliveryStatus === 'delivered') return 'Delivered';
  if (order.deliveryStatus === 'dispatched') return 'Dispatched';
  const os = String(order.orderStatus || '').toLowerCase();
  if (os) return os.charAt(0).toUpperCase() + os.slice(1);
  if (order.isConverted) return 'Confirmed';
  return 'Pending';
}

export default function PartyHome() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const dispatch = useDispatch();
  const { bellIcon, NotificationsModal } = useNotificationCenter();
  const user = useSelector((s: RootState) => s.auth.user);
  const tenant = useSelector((s: RootState) => s.tenant);
  const cartItems = useSelector((s: RootState) => s.cart.items);
  const cartCount = cartItems.reduce((sum, i) => sum + i.qty, 0);
  const adminid = tenant.adminId ?? '';

  // Two Homes, chosen by who is signed in rather than by which business they
  // belong to. A shopper (EndUser channel, or no channel yet) gets the
  // storefront layout — hero banner, search, no business figures. A trade party
  // (Retailer / Wholesaler / Distributor) keeps the ordering view with their
  // outstanding balance and recent orders.
  //
  // This used to be keyed off the business code, which meant one business had
  // it and every one of its parties got it — including its distributors, who
  // want the figures. See utils/enduser.ts.
  const isEndUser          = useIsEndUserParty();
  const hideStatsAndOrders = isEndUser;   // Stats + Recent Orders hidden
  const showSearchBar      = isEndUser;   // same product search the Shop screen has
  const showHeroBanner     = isEndUser;   // website's Home page hero carousel
  const hideCatalogHeader  = isEndUser;   // "Products" / "Browse all" row hidden

  const [selectedUnits, setSelectedUnits] = useState<Record<string, number>>({});
  const [category, setCategory] = useState<string | null>(null); // null = "All"
  const [search, setSearch] = useState('');
  const showPrice = useShowProductPrice();
  // Display-only x2 markup on what the card prints. The add-to-cart handlers
  // below still work off the real unitprice, so the cart and the placed order
  // keep the admin's rate.
  // The multiplier, not the formatter: see the note on ProductCard above.
  const { multiplier } = useCatalogPrice();
  const showStock = useShowProductStock();
  // Settings -> General -> Product Image Ratio -> "App — Home & Shop".
  // null = the admin hasn't picked one, so the card keeps its fixed image
  // height as before.
  const imgRatio = useProductImageRatio();
  // Admin-managed hero slides from the web panel — only queried/rendered for
  // the business codes that opt in above.
  const heroSlides = useHeroBannerSlides();

  const { data: ordersData, loading: ordersLoading, refetch: refetchOrders } = useQuery(GET_SALES_ORDERS, {
    variables: { adminid, partyacc: user?.id },
    skip: !adminid || !user?.id,
    refetchPolicy: 'cache-and-network',
  });
  // One page at a time, search and category applied on the SERVER. This screen
  // renders its grid inside a plain ScrollView with .map(), so loading the whole
  // catalogue here mounted every card at once — the reason it used to ask for a
  // hard-coded 24 rows. Paging keeps it light without hiding anything.
  const {
    products: pagedProducts,
    initialLoading: productsInitialLoading,
    loading: productsLoading,
    loadingMore,
    loadMore,
  } = useProductPage({ adminid, search, categoryid: category });
  // Categories come from the category list itself, not from whichever products
  // happened to load. Same source the website's storefront uses.
  const { data: categoriesData } = useQuery(GET_CATEGORIES, {
    variables: { adminId: adminid },
    skip: !adminid,
  });
  const { data: accountData, refetch: refetchAccount } = useQuery(GET_ACCOUNT, {
    variables: { id: user?.id, adminId: adminid },
    skip: !user?.id || !adminid,
    refetchPolicy: 'network-only', // Always fetch fresh data
  });
  const partyAccount = (accountData as any)?.getAccountById;

  // Refetch on focus so a payment/order made elsewhere reflects immediately.
  useFocusEffect(useCallback(() => { refetchOrders?.(); refetchAccount?.(); }, [refetchOrders, refetchAccount]));

  const rawOrders = (ordersData?.getSalesOrders ?? []) as any[];
  const rawProducts = pagedProducts;

  // Use live data only — no dummy fallback (a fresh party has no orders/products).
  const orders = rawOrders;
  const products = rawProducts;

  // Outstanding = bill-wise due from the server (same basis as the salesman app).
  const outstanding = Math.max(0, partyAccount?.outstanding || 0);

  // Newest first — orders come back oldest-first, so reverse before taking
  // the most recent 2 for the home screen preview.
  const recent = [...orders].reverse().slice(0, 2);
  const pending = orders.filter((o: any) => !o.isConverted && o.cancelStatus !== 'cancelled').length;
  /**
   * Only the products hold the screen back.
   *
   * This used to be `ordersLoading || productsInitialLoading`, which put the
   * whole Home screen — the grid included — behind GET_SALES_ORDERS. Two costs,
   * both avoidable:
   *
   * - That query runs `cache-and-network`, so `loading` goes true on EVERY
   *   mount even when the answer is already cached. Coming back to Home from
   *   anywhere therefore threw away a grid that was ready to draw and showed
   *   the skeleton again while a network round-trip completed.
   * - A shopper (isEndUser) does not even get a Recent Orders section — for
   *   them the products were waiting on a query whose result is never shown.
   *
   * The products query is cache-first, so a return visit now paints the grid
   * from cache immediately and the orders section fills itself in behind.
   */
  const isLoading = !!adminid && productsInitialLoading;

  // Every active category the business has → "All" + one chip each. Derived
  // from the category list so a category is never missing just because none of
  // its products happened to be on the page that loaded.
  const categories = useMemo<CategoryItem[]>(() => {
    const list = ((categoriesData as any)?.getCategories ?? []) as any[];
    return list
      .filter((c: any) => c && c.status !== false)
      .map((c: any) => ({ id: c.id, name: c.categoryname, image: c.image }));
  }, [categoriesData]);

  // Search and category are already applied server-side by useProductPage, so
  // nothing is filtered again here — doing so would only hide rows the server
  // deliberately returned.
  const visibleProducts = products;

  // The hero banner advertises the catalogue, so it must not follow the search
  // box — otherwise typing a word empties the banner too. Remember the last
  // unfiltered page and keep showing that.
  const bannerRef = useRef<any[]>([]);
  if (!search && !category && products.length) bannerRef.current = products;
  const bannerProducts = bannerRef.current.length ? bannerRef.current : products;

  /**
   * Cart quantities as a lookup, built once per cart change.
   *
   * This used to be a `cartItems.find(...)` called once per card, which is a
   * linear scan of the cart for every product on screen, repeated on every
   * render of the list — the work grew with the cart AND the catalogue at the
   * same time, right while the user was scrolling. A Map makes each card's
   * lookup a single hash hit, and rebuilds only when the cart actually changes.
   */
  const cartQtyByKey = useMemo(() => {
    const m = new Map<string, number>();
    // `undefined` unitId is a real case (a product with no unit), and it has to
    // key differently from a unit literally named "undefined" — hence the ?? ''.
    for (const i of cartItems) m.set(`${i.productId}|${i.variantId}|${i.unitId ?? ''}`, i.qty);
    return m;
  }, [cartItems]);

  const getCartQty = (productId: string, variantId: string, unitId?: string) =>
    cartQtyByKey.get(`${productId}|${variantId}|${unitId ?? ''}`) ?? 0;

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
            unitid: up.unitid.id,
            adminid: adminid || null,
            accountid: user?.id ?? null,
            channelid: partyAccount?.channel?.id ?? null,
            region: partyAccount?.region ?? null,
          },
          fetchPolicy: 'network-only',
        });
        const rp = (pd as any)?.resolvePrice;
        if (rp) {
          if (rp.rate != null) rate = rp.rate;
          // Only override the base unit discount when resolvePrice returns a
          // real party/channel discount. A null/zero result must NOT wipe the
          // product's own unit discount.
          if (rp.discount != null && rp.discount > 0) disc = rp.discount;
        }
      } catch (e) {
        console.warn('[resolvePrice]', e);
      }
    }
    dispatch(addToCart({
      productId: p.id, productName: p.name,
      variantId: v.id, variantName: v.name,
      unitId: up?.unitid?.id,
      unitName: up?.unitid?.unitname,
      unitqty: up?.quantity ?? 1,
      imageUrl: p.imageurl,
      qty: 1, rate, discount: disc, gst: v.gst ?? 0,
      amount: (rate - disc) * 1,
    }));
  };

  // Stable identities for everything handed to a memoised card. Without these
  // each render builds new function objects, every card sees changed props, and
  // React.memo stops doing anything at all.
  //
  // handleAdd is deliberately read through a ref rather than wrapped: it closes
  // over selectedUnits, adminid, user and partyAccount, so a useCallback would
  // need all four as dependencies and would be rebuilt almost every render —
  // exactly what this is avoiding. The ref always holds the latest version, so
  // the callback below can stay identical for the life of the screen.
  const handleAddRef = useRef(handleAdd);
  handleAddRef.current = handleAdd;

  const onAdd        = useCallback((p: any) => handleAddRef.current(p), []);
  const onQty        = useCallback(
    (productId: string, variantId: string, unitId: string | undefined, qty: number) =>
      dispatch(updateQty({ productId, variantId, unitId, qty })),
    [dispatch],
  );
  const onOpen       = useCallback(
    (productId: string) => navigation.navigate('ProductDetail', { productId }),
    [navigation],
  );
  const onSelectUnit = useCallback(
    (productId: string, unitIndex: number) =>
      setSelectedUnits(prev => ({ ...prev, [productId]: unitIndex })),
    [],
  );

  const renderProduct = useCallback(({ item: p, index }: any) => {
    const v = p.productvariants?.[0];
    const unitIdx = selectedUnits[p.id] ?? 0;
    const up = v?.unitprices?.[unitIdx] ?? v?.unitprices?.[0];
    // The grid used to be a flex-wrap row with `gap: 12` inside a section
    // padded 18 a side. FlashList lays the columns out itself, so those two
    // spacings are rebuilt here: 18 on the outer edge of each column, 6 on the
    // inner, which meets in the middle as the same 12pt gutter as before.
    const isLeft = index % 2 === 0;
    return (
      <View style={[
        styles.productCell,
        isLeft ? { paddingLeft: 18, paddingRight: 6 } : { paddingLeft: 6, paddingRight: 18 },
      ]}>
      <ProductCard
        product={p}
        colors={colors}
        imgRatio={imgRatio}
        showPrice={showPrice}
        showStock={showStock}
        multiplier={multiplier}
        unitIdx={unitIdx}
        cartQty={v ? getCartQty(p.id, v.id, up?.unitid?.id) : 0}
        onOpen={onOpen}
        onAdd={onAdd}
        onQty={onQty}
        onSelectUnit={onSelectUnit}
      />
      </View>
    );
  }, [selectedUnits, colors, imgRatio, showPrice, showStock, multiplier, cartQtyByKey, onOpen, onAdd, onQty, onSelectUnit]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

      <AppHeader
        label={STRINGS.party.home}
        rightIcons={[
          bellIcon,
          {
            id: 'cart', name: 'cart-outline', color: colors.brand, badge: cartCount,
            onPress: () => navigation.navigate('CartScreen'),
          },
        ]}
      />
      {NotificationsModal}

      {isLoading ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
          <HomeScreenSkeleton />
        </ScrollView>
      ) : (
        // A virtualised list, not a ScrollView with .map().
        //
        // Every product card used to be mounted at once — 50 on the first page,
        // 100 after one scroll to the bottom, and each one carrying an image,
        // a horizontal unit strip and its own buttons. That is what made
        // scrolling stutter: the work was not the pictures arriving, it was
        // hundreds of live views the list had to keep laid out. FlashList keeps
        // roughly a screenful mounted and recycles the rest, so the cost of
        // scrolling stops growing with the size of the catalogue.
        //
        // Everything above the grid moves into ListHeaderComponent so it still
        // scrolls away with the content exactly as before.
        <DynamicFlashList
          data={visibleProducts}
          renderItem={renderProduct}
          numColumns={2}
          keyExtractor={(p: any) => String(p.id)}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          // Build cells about a screen ahead of the scroll instead of the
          // default 250px. A card's picture only starts downloading when its
          // cell mounts, so mounting earlier is what buys the image time to
          // arrive before the user reaches it — the difference between a photo
          // fading in under the thumb and one that is simply already there.
          // Roughly one extra row of two cards; far cheaper than the 50 the
          // screen used to hold, and it makes the scroll feel pre-loaded.
          drawDistance={600}
          // renderProduct is rebuilt when the cart or the selected units
          // change; without this the list would keep showing the rows it had
          // already recycled with the previous one.
          extraData={renderProduct}
          ListHeaderComponent={(
            <>

          {/* Stats — hidden when logged in with business code "#ADM0001" */}
          {!hideStatsAndOrders && (
          <Animated.View entering={FadeInUp.duration(400).delay(60)} style={styles.statsRow}>
            {[
              { icon: 'cash-multiple', value: formatINR(outstanding), label: STRINGS.party.outstanding },
              { icon: 'clipboard-list-outline', value: String(pending), label: STRINGS.party.pendingOrders },
              { icon: 'package-variant-closed', value: String(products.length), label: STRINGS.party.catalog },
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
          )}

          {/* Recent Orders — hidden when logged in with business code "#ADM0001" */}
          {!hideStatsAndOrders && (
          <Animated.View entering={FadeInUp.duration(400).delay(120)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{STRINGS.party.recentOrders}</Text>
              <TouchableOpacity onPress={() => navigation.navigate('MyOrders')}>
                <Text style={[styles.viewAll, { color: colors.brand }]}>{STRINGS.party.viewAll}</Text>
              </TouchableOpacity>
            </View>

            {recent.length === 0 ? (
              // "No orders yet" is a real answer, so it must not be shown while
              // the question is still being asked — this section no longer
              // holds up the rest of the screen, so it now has a moment of its
              // own to fill in.
              ordersLoading
                ? <View style={styles.footerLoader}><ActivityIndicator color={colors.brand} /></View>
                : <EmptyCard icon="clipboard-outline" label={STRINGS.party.noOrdersYet} colors={colors} />
            ) : (
              recent.map((order: any) => {
                const label = orderStatus(order);
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
                      <Text style={[styles.orderNum, { color: colors.text }]}>{formatBillNumber(order)}</Text>
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
          )}

          {/* Featured Products */}
          <Animated.View entering={FadeInUp.duration(400).delay(180)} style={styles.section}>
            {/* "Products" / "Browse all" row — hidden for "#ADM0001", whose
                Home leads with the hero banner instead. */}
            {!hideCatalogHeader && (
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{STRINGS.party.catalog}</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Catalog')}>
                  <Text style={[styles.viewAll, { color: colors.brand }]}>{STRINGS.party.browseAll}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Search, banner and category chips render ALWAYS. They used to sit
                inside a `products.length === 0` branch, so a search that matched
                nothing replaced the search box itself along with the banner and
                the chips — the user was left with no way to correct the query,
                and the input unmounting also dismissed the keyboard. Only the
                grid below reacts to an empty result. */}
            <>
                {/* Product search — "#ADM0001" only; mirrors the Shop screen. */}
                {showSearchBar && (
                  <AppTextInput
                    leftIcon="magnify"
                    placeholder={STRINGS.storefront.searchPlaceholder}
                    value={search}
                    onChangeText={setSearch}
                    autoCapitalize="none"
                    placeholderTextColor={colors.subText}
                    containerStyle={{ marginBottom: 12 }}
                  />
                )}

                {/* Hero banner — "#ADM0001" only; mirrors the website's
                    Settings → General → "Hero Banner" carousel. */}
                {showHeroBanner && (
                  <HeroBanner
                    slides={heroSlides}
                    products={bannerProducts}
                    horizontalPadding={18}
                    style={styles.heroBanner}
                    onPress={() => navigation.navigate('Catalog')}
                  />
                )}

                <CategoryStrip
                  categories={categories}
                  selected={category}
                  onSelect={setCategory}
                />

            </>
          </Animated.View>
            </>
          )}
          ListEmptyComponent={(
            <View style={styles.section}>
              <EmptyCard icon="package-variant-closed" label={STRINGS.party.noProducts} colors={colors} />
            </View>
          )}
          ListFooterComponent={loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator color={colors.brand} />
            </View>
          ) : null}
        />
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
  scroll: { paddingBottom: 110 },
  footerLoader: { paddingVertical: 18, alignItems: 'center' },

  statsRow: { flexDirection: 'row', paddingHorizontal: 18, gap: 10, marginTop: 14 },
  statCard: {
    flex: 1, borderRadius: 18, borderWidth: 1, padding: 14, alignItems: 'flex-start',
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  statIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statValue: { fontSize: 15, fontFamily: FONTS.bold },
  statLabel: { fontSize: 10, fontFamily: FONTS.regular, marginTop: 2 },

  // Tightened so the first row of products is reachable without scrolling.
  // The shopper came to see stock, not chrome.
  section: { marginTop: 12, paddingHorizontal: 18 },
  heroBanner: { marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: FONTS.bold },
  viewAll: { fontSize: 13, fontFamily: FONTS.semiBold },


  emptyCard: {
    borderRadius: 16, borderWidth: 1, paddingVertical: 22, alignItems: 'center', justifyContent: 'center',
  },
  orderCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10,
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  orderNum: { fontSize: 14, fontFamily: FONTS.bold },
  orderDate: { fontSize: 12, fontFamily: FONTS.regular, marginTop: 2 },
  orderAmt: { fontSize: 14, fontFamily: FONTS.bold, marginBottom: 4 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  statusText: { fontSize: 11, fontFamily: FONTS.semiBold },

  // Compact list row — image left, details middle, Add/qty right. Matches
  // the salesman app's Products list.
  // One column cell of the grid. The horizontal padding is applied per item in
  // renderProduct, since it differs between the left and right column.
  productCell: { flex: 1, marginBottom: 12 },
  productCard: {
    flex: 1, minHeight: 250, borderRadius: 18, borderWidth: 1, padding: 12,
    justifyContent: 'space-between',
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  productImgWrap: {
    height: 78, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
    marginBottom: 10, overflow: 'hidden',
  },
  productImg: { ...StyleSheet.absoluteFillObject },
  oosTag: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 3, alignItems: 'center' },
  oosText: { fontSize: 10, fontFamily: FONTS.semiBold, color: '#fff' },
  productName: { fontSize: 13, fontFamily: FONTS.semiBold, lineHeight: 18, marginBottom: 4 },
  catText: { fontSize: 11, fontFamily: FONTS.regular, marginBottom: 4 },
  unitScroll: { flexGrow: 0, marginBottom: 6 },
  unitChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, marginRight: 5 },
  unitChipText: { fontSize: 10, fontFamily: FONTS.semiBold },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  productPrice: { fontSize: 14, fontFamily: FONTS.bold },
  mrp: { fontSize: 12, fontFamily: FONTS.regular, textDecorationLine: 'line-through' },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 8, gap: 4 },
  addBtnText: { fontSize: 13, fontFamily: FONTS.bold, color: '#fff' },
  qtyControl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, borderWidth: 1.5, overflow: 'hidden' },
  qtyBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  qtyText: { fontSize: 14, fontFamily: FONTS.bold, minWidth: 24, textAlign: 'center' },

  cartBar: {
    position: 'absolute', bottom: 20, left: 18, right: 18,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 18, paddingHorizontal: 18, paddingVertical: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  cartBadge: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  cartBadgeText: { fontSize: 13, fontFamily: FONTS.bold, color: '#fff' },
  cartBarText: { flex: 1, fontSize: 15, fontFamily: FONTS.bold, color: '#fff' },
});
