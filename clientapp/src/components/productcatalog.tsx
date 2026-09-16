import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@apollo/client/react';
import { useSelector, useDispatch } from 'react-redux';
import { COLORS, FONTS, STRINGS, useTheme, IMG } from '../config';
import { ProductGridSkeleton } from '../config/skeletonlayouts';
import { GET_ACCOUNT, RESOLVE_PRICE } from '../apollo/queries/accounts';
import { useProductPage } from '../apollo/hooks/products';
import { apolloClient } from '../apollo/client';
import { AppImage } from './appimage';
import { DynamicFlashList } from './flashlist';
import { addToCart, updateQty } from '../store/slices';
import { useShowProductPrice, useShowProductStock, useProductImageRatio, useCatalogPrice } from '../apollo/hooks/adminsettings';
import { formatINR as formatINRValue } from '../utils/formatters';
import type { RootState } from '../store/rootreducer';

/**
 * The product grid, shared by Home and Shop.
 *
 * It was Shop's, and it stayed Shop's while Home had a grid of its own; the
 * two drifted — different cart lookups, different card memoisation, the same
 * bugs fixed once. Home now shows the same catalogue, so the catalogue is one
 * component and the screens above it own only their own chrome: Shop a search
 * box and a category strip, Home those plus a banner.
 *
 * Everything about how it loads is unchanged from Shop: the same
 * useProductPage, the same server-side search and category, the same skeleton
 * on first load and thin bar on a filter change, the same page size.
 */

/**
 * One card, memoised.
 *
 * The grid subscribes to the cart, so without this every tap on "+" re-rendered
 * every card on screen. For the memo to hold, everything crossing this boundary
 * has to be stable between renders: `product` is the object Apollo hands back,
 * the callbacks are useCallback'd by the parent, and what differs per card
 * arrives as primitives. That is also why the price multiplier comes in rather
 * than useCatalogPrice's formatter — the hook builds a new function every
 * render, so passing it would make every card look changed, every time.
 */
interface ProductCardProps {
  product: any;
  colors: any;
  imgRatio: number | null;
  showPrice: boolean;
  showStock: boolean;
  multiplier: number;
  unitIdx: number;
  cartQty: number;
  isLeft: boolean;
  onOpen: (productId: string) => void;
  onAdd: (product: any) => void;
  onQty: (productId: string, variantId: string, unitId: string | undefined, qty: number) => void;
  onSelectUnit: (productId: string, unitIndex: number) => void;
}

const unitLabel = (u: any) => {
  const name = u?.unitid?.unitname ?? 'Unit';
  const qty = u?.quantity ?? 1;
  return qty > 1 ? `${qty} × ${name}` : name;
};

const ProductCard = React.memo(function ProductCard({
  product: p, colors, imgRatio, showPrice, showStock, multiplier,
  unitIdx, cartQty, isLeft, onOpen, onAdd, onQty, onSelectUnit,
}: ProductCardProps) {
  const v = p.productvariants?.[0];
  const up = v?.unitprices?.[unitIdx] ?? v?.unitprices?.[0];
  const unitId = up?.unitid?.id;
  const price = (up?.offerprice ?? 0) > 0 ? up.offerprice : (up?.salesrate ?? 0);
  const mrp = up?.mrp ?? 0;
  const hasMrp = mrp > 0;
  const outOfStock = v?.currentstock === 0;
  const multiUnit = (v?.unitprices?.length ?? 0) > 1;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: colors.cardGlass, borderColor: colors.border },
        isLeft ? { marginRight: 6 } : { marginLeft: 6 },
      ]}
      onPress={() => onOpen(p.id)}
      activeOpacity={0.88}
    >
      <View>
        <View style={[styles.imgWrap, { backgroundColor: colors.brandSoft }, imgRatio ? { height: undefined, aspectRatio: imgRatio } : null]}>
          {p.imageurl
            ? <AppImage uri={p.imageurl} width={IMG.product} style={styles.img} resizeMode="cover" />
            : <Icon name="package-variant-closed" size={30} color={colors.brand} />
          }
          {showStock && outOfStock && (
            <View style={styles.oosTag}>
              <Text style={styles.oosText}>{STRINGS.party.outOfStock}</Text>
            </View>
          )}
        </View>

        <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>{p.name}</Text>
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
                  <Text style={[styles.unitChipText, { color: active ? colors.onBrand : colors.text }]}>
                    {unitLabel(u)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {showPrice && (
          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: colors.brand }]}>{formatINRValue(price * multiplier)}</Text>
            {hasMrp && (
              <Text style={[styles.mrp, { color: colors.subText }]}>{formatINRValue(mrp * multiplier)}</Text>
            )}
          </View>
        )}
      </View>

      {v && !outOfStock && (
        cartQty === 0 ? (
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.brand }]}
            onPress={() => onAdd(p)}
          >
            <Icon name="plus" size={14} color={colors.onBrand} />
            <Text style={[styles.addBtnText, { color: colors.onBrand }]}>{STRINGS.party.add}</Text>
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

export type ProductCatalogProps = {
  /** Raw text from the screen's search box; debounced inside useProductPage. */
  search: string;
  /** Selected category id, or null for "All". */
  category: string | null;
  /** Anything the screen wants scrolling above the grid (Home's stats/orders). */
  ListHeaderComponent?: React.ReactElement | null;
};

/**
 * Memoised, and that is the point of it.
 *
 * Shop renders this under a screen that does almost nothing else. Home renders
 * it under one that also polls notifications, watches the cart badge and (for a
 * trade party) fetches orders and an account balance, refetching both every
 * time the screen comes back to the foreground. Every one of those results
 * re-rendered Home, and an unmemoised child re-renders with its parent — so the
 * grid was being rebuilt underneath the user while its pictures were still
 * arriving, which is why the same catalogue looked settled on Shop and unsettled
 * on Home.
 *
 * With this, the grid re-renders only when `search`, `category` or the header
 * element actually change. Everything else on the screen is free to update
 * around it.
 */
export const ProductCatalog: React.FC<ProductCatalogProps> = React.memo(function ProductCatalog({
  search, category, ListHeaderComponent = null,
}) {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const dispatch = useDispatch();
  const user = useSelector((s: RootState) => s.auth.user);
  const adminid = useSelector((s: RootState) => s.tenant.adminId) ?? '';
  const cartItems = useSelector((s: RootState) => s.cart.items);

  const showPrice = useShowProductPrice();
  // Display-only x2 markup on the card price. Add-to-cart still passes the
  // real unitprice through, so the cart total and the order stay correct.
  const { multiplier } = useCatalogPrice();
  const showStock = useShowProductStock();
  // Settings -> General -> Product Image Ratio -> "App — Home & Shop".
  const imgRatio = useProductImageRatio();

  const [selectedUnits, setSelectedUnits] = useState<Record<string, number>>({});

  // One page at a time, with the search box and category chip applied on the
  // SERVER — see the hook for why that matters once a list is paginated.
  const { products, initialLoading, refreshing, loadingMore, loadMore } = useProductPage({
    adminid,
    search,
    categoryid: category,
  });

  const { data: accountData } = useQuery(GET_ACCOUNT, {
    variables: { id: user?.id, adminId: adminid },
    skip: !user?.id || !adminid,
  });
  const partyAccount = (accountData as any)?.getAccountById;

  // Search and category are already applied server-side; only the inactive
  // guard is left, since the storefront must never show a disabled product.
  const filtered = useMemo(
    () => products.filter((p: any) => p.status !== false),
    [products],
  );

  /**
   * Cart quantities as a lookup, rebuilt only when the cart changes.
   *
   * A `cartItems.find(...)` per card is a linear scan of the cart for every
   * product on screen, repeated on every render — work that grows with the cart
   * AND the catalogue at once, while the user is scrolling.
   */
  const cartQtyByKey = useMemo(() => {
    const m = new Map<string, number>();
    // An undefined unitId is a real case (a product with no unit) and has to
    // key differently from a unit literally named "undefined" — hence ?? ''.
    for (const i of cartItems) m.set(`${i.productId}|${i.variantId}|${i.unitId ?? ''}`, i.qty);
    return m;
  }, [cartItems]);

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
          // product's own unit discount (otherwise the discount disappears and
          // the total is computed on the full rate).
          if (rp.discount != null && rp.discount > 0) disc = rp.discount;
        }
      } catch (e) {
        console.warn('[resolvePrice] error:', e);
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

  // handleAdd closes over selectedUnits, adminid, user and partyAccount, so a
  // useCallback would list all four and be rebuilt almost every render — which
  // is what the memoised card is trying to avoid. The ref always holds the
  // latest version, so the callback below stays identical for the component's
  // life.
  const handleAddRef = useRef(handleAdd);
  handleAddRef.current = handleAdd;

  const onAdd = useCallback((p: any) => handleAddRef.current(p), []);
  const onQty = useCallback(
    (productId: string, variantId: string, unitId: string | undefined, qty: number) =>
      dispatch(updateQty({ productId, variantId, unitId, qty })),
    [dispatch],
  );
  const onOpen = useCallback(
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
    const key = v ? `${p.id}|${v.id}|${up?.unitid?.id ?? ''}` : '';
    return (
      <ProductCard
        product={p}
        colors={colors}
        imgRatio={imgRatio}
        showPrice={showPrice}
        showStock={showStock}
        multiplier={multiplier}
        unitIdx={unitIdx}
        cartQty={cartQtyByKey.get(key) ?? 0}
        isLeft={index % 2 === 0}
        onOpen={onOpen}
        onAdd={onAdd}
        onQty={onQty}
        onSelectUnit={onSelectUnit}
      />
    );
  }, [selectedUnits, colors, imgRatio, showPrice, showStock, multiplier, cartQtyByKey, onOpen, onAdd, onQty, onSelectUnit]);

  if (initialLoading) return <ProductGridSkeleton />;

  return (
    <>
      {/* A thin bar while a new category or search is fetched. The rows below
          stay put — the skeleton is only for the very first load, when there is
          genuinely nothing on screen yet. */}
      {refreshing && (
        <View style={styles.refreshBar}>
          <ActivityIndicator size="small" color={colors.brand} />
        </View>
      )}

      {filtered.length === 0 ? (
        <View style={styles.center}>
          <Icon name="magnify-close" size={44} color={colors.border} />
          <Text style={[styles.emptyText, { color: colors.subText }]}>{STRINGS.party.noProducts}</Text>
        </View>
      ) : (
        <DynamicFlashList
          data={filtered}
          renderItem={renderProduct}
          numColumns={2}
          keyExtractor={(p: any) => String(p.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          // renderProduct is rebuilt when the cart or the selected units change;
          // without this the list would keep showing rows it had already
          // recycled with the previous one.
          extraData={renderProduct}
          ListHeaderComponent={ListHeaderComponent}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator color={colors.brand} />
              </View>
            ) : null
          }
        />
      )}
    </>
  );
});

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: 18, paddingBottom: 110, paddingTop: 4 },
  footerLoader: { paddingVertical: 18, alignItems: 'center' },
  refreshBar: { paddingVertical: 6, alignItems: 'center' },
  card: {
    flex: 1, minHeight: 250, borderRadius: 18, borderWidth: 1, padding: 12, marginBottom: 12,
    justifyContent: 'space-between',
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  imgWrap: {
    height: 90, borderRadius: 12, marginBottom: 10,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  img: { ...StyleSheet.absoluteFillObject },
  oosTag: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 3, alignItems: 'center',
  },
  oosText: { fontSize: 10, fontFamily: FONTS.semiBold, color: '#fff' },
  name: { fontSize: 13, fontFamily: FONTS.semiBold, lineHeight: 18, marginBottom: 2 },
  catText: { fontSize: 11, fontFamily: FONTS.regular, marginBottom: 4 },
  unitScroll: { flexGrow: 0, marginBottom: 6 },
  unitChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, marginRight: 5 },
  unitChipText: { fontSize: 10, fontFamily: FONTS.semiBold },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  price: { fontSize: 14, fontFamily: FONTS.bold },
  mrp: { fontSize: 12, fontFamily: FONTS.regular, textDecorationLine: 'line-through' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, paddingVertical: 8, gap: 4,
  },
  addBtnText: { fontSize: 13, fontFamily: FONTS.bold },
  qtyControl: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 12, borderWidth: 1.5, overflow: 'hidden',
  },
  qtyBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  qtyText: { fontSize: 14, fontFamily: FONTS.bold, minWidth: 24, textAlign: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 14, fontFamily: FONTS.regular },
});
