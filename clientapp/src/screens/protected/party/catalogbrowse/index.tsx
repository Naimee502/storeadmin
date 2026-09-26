import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, StatusBar, BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useQuery } from '@apollo/client/react';
import { useDispatch, useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { FONTS, useTheme } from '../../../../config';
import { GET_CATEGORIES, GET_SUBCATEGORIES } from '../../../../apollo/queries/categories';
import { GET_PRODUCTS } from '../../../../apollo/queries/accounts';
import { AppHeader, AppTextInput, AppTour, HeroBanner, tourRef, useNotificationCenter } from '../../../../components';
import type { TourStep } from '../../../../components';
import { useHeroBannerSlides } from '../../../../apollo/hooks/adminsettings';
import { addToCart } from '../../../../store/slices';
import { useUI } from '../../../../utils';
import { useShowProductPrice, useCatalogPrice, useRestrictQtyByStock } from '../../../../apollo/hooks/adminsettings';
import { baseQtyOf, maxPacksFor, stockOf } from '../../../../utils/stocklimit';
import type { RootState } from '../../../../store/rootreducer';
import { TileGrid, ImageViewer, type Tile } from './tiles';

type Stage =
  | { name: 'categories' }
  | { name: 'subcategories'; category: Tile }
  | { name: 'products'; category: Tile; subcategory?: Tile };

/**
 * The catalogue browser — Business Settings → "App Home browses a catalogue".
 *
 * Category tiles, then sub-category tiles, then an order sheet: every product
 * on its own line with a quantity box, and one Add to Cart at the bottom that
 * takes the whole sheet at once. That last part is the point of the mode. A
 * customer ordering forty sizes of the same fitting should type forty numbers
 * and press one button, not tap Add forty times through a grid of pictures.
 *
 * All three stages live in one screen rather than three routes: the flow is
 * strictly linear, the data is one products query the whole way down, and
 * keeping it here means the tab bar's back behaviour stays with the tab.
 */
// First-time guides for the catalogue Home (Business Settings → "App Home
// browses a catalogue"). Different screen, different controls, so a different
// tour from the storefront Home's — each shown once per party on this device.
const CATALOG_HOME_TOUR: TourStep[] = [
  { target: 'cat-menu',  title: 'Menu',          text: 'Open your profile, ledger, addresses and other options from here.' },
  { target: 'cat-bell',  title: 'Notifications', text: 'Order updates, payment reminders and offers show up here.' },
  { target: 'cat-cart',  title: 'Cart',          text: 'Everything you add lands here. Tap to review and place your order.' },
  { target: 'cat-tiles', title: 'Categories',    text: 'Tap a category, then a sub-category, to open its order sheet.' },
  { target: 'tabbar',    title: 'Get Around',    text: 'Jump between your main screens — Home, Shop, Orders and more — from here.' },
];

// The order sheet is a screen of its own the first time someone reaches it.
const ORDER_SHEET_TOUR: TourStep[] = [
  { target: 'sheet-qty',   title: 'Quantity',    text: 'Type how many you want against each item. Leave it empty to skip that item.' },
  { target: 'sheet-image', title: 'Photo',       text: 'Tap to see the product picture.' },
  { target: 'sheet-add',   title: 'Add to Cart', text: 'Adds every item you typed a quantity for in one go. Cancel goes back.' },
];

export default function CatalogBrowse({ navigation, variant = 'home' }: any) {
  const { colors, isDark } = useTheme();
  const dispatch = useDispatch();
  const { showToast } = useUI();
  const showPrice = useShowProductPrice();
  // Display-only x2 markup on the order sheet's rate column. The quantity
  // boxes below still build the order off the real unitprice.
  const { formatCatalogINR } = useCatalogPrice();
  const insets = useSafeAreaInsets();
  const { bellIcon, NotificationsModal } = useNotificationCenter();
  const heroSlides = useHeroBannerSlides();

  const adminid = useSelector((s: RootState) => s.tenant.adminId) ?? '';
  const userId = useSelector((s: RootState) => s.auth.user?.id) ?? '';
  const cartItems = useSelector((s: RootState) => s.cart.items);
  const restrictQty = useRestrictQtyByStock();
  const cartCount = cartItems.reduce((sum, i) => sum + i.qty, 0);

  const [stage, setStage] = useState<Stage>({ name: 'categories' });
  const [search, setSearch] = useState('');
  const [qty, setQty] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<string | null>(null);

  const { data: catData } = useQuery(GET_CATEGORIES, {
    variables: { adminId: adminid },
    skip: !adminid,
    fetchPolicy: 'cache-and-network',
  });
  const { data: subData } = useQuery(GET_SUBCATEGORIES, {
    variables: { adminId: adminid },
    skip: !adminid,
    fetchPolicy: 'cache-and-network',
  });
  const { data: prodData } = useQuery(GET_PRODUCTS, {
    variables: { adminid },
    skip: !adminid,
    fetchPolicy: 'cache-and-network',
  });

  const categories: any[] = (catData as any)?.getCategories ?? [];
  const subcategories: any[] = (subData as any)?.getSubCategories ?? [];
  const products: any[] = ((prodData as any)?.getProductServices ?? []).filter(
    (p: any) => p?.status !== false,
  );

  /* ------------------------------------------------------------------ *
   * Android back walks the stages before it leaves the tab, which is what
   * a hardware back button is expected to do inside a drill-down.
   * ------------------------------------------------------------------ */
  const goBack = useCallback(() => {
    setStage((s) => {
      setSearch('');
      if (s.name === 'products') {
        return s.subcategory ? { name: 'subcategories', category: s.category } : { name: 'categories' };
      }
      if (s.name === 'subcategories') return { name: 'categories' };
      return s;
    });
  }, []);

  // The order sheet owns the bottom of the screen — Cancel and Add to Cart sit
  // there. The tab bar floats above everything, so it is asked to stand down
  // for that stage and comes back on the way out.
  useEffect(() => {
    // setOptions on THIS screen: the custom tab bar reads the ACTIVE route's
    // own options. Going up to the parent navigator set it on the wrong screen,
    // which is why the bar never stood down.
    navigation.setOptions({
      tabBarStyle: stage.name === 'products' ? { display: 'none' } : undefined,
    });
    return () => navigation.setOptions({ tabBarStyle: undefined });
  }, [navigation, stage.name]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (stage.name === 'categories') return false;
        goBack();
        return true;
      });
      return () => sub.remove();
    }, [stage.name, goBack]),
  );

  /**
   * One box, filtering whatever the current stage is showing — categories,
   * sub-categories, or the lines of an order sheet. A separate product search
   * would be a second way to reach the same thing and would have to explain
   * itself; narrowing what is already in front of you needs no explanation.
   */
  const matches = useCallback(
    (label: string) => {
      const q = search.trim().toLowerCase();
      return !q || label.toLowerCase().includes(q);
    },
    [search],
  );

  const categoryTiles: Tile[] = useMemo(
    () =>
      categories
        .filter((c: any) => c?.status !== false && matches(c.categoryname ?? ''))
        .map((c: any) => ({ id: c.id, label: c.categoryname, image: c.image })),
    [categories, matches],
  );

  const subTilesFor = useCallback(
    (categoryId: string): Tile[] =>
      subcategories
        .filter(
          (sc: any) =>
            sc?.status !== false &&
            sc?.category?.id === categoryId &&
            matches(sc.subcategoryname ?? ''),
        )
        .map((sc: any) => ({ id: sc.id, label: sc.subcategoryname, image: sc.image })),
    [subcategories, matches],
  );

  const openCategory = (tile: Tile) => {
    // Counted against every sub-category, not the search-filtered list: whether
    // this category HAS a middle screen cannot depend on what is typed in the
    // box at the moment it is tapped.
    const subs = subcategories.filter(
      (sc: any) => sc?.status !== false && sc?.category?.id === tile.id,
    );
    setSearch('');
    // A category with no sub-categories opens straight onto its order sheet —
    // an empty middle screen would just be a dead end to tap through.
    setStage(subs.length ? { name: 'subcategories', category: tile } : { name: 'products', category: tile });
  };

  const sheetProducts = useMemo(() => {
    if (stage.name !== 'products') return [];
    return products.filter((p: any) => {
      if (p?.categoryid?.id !== stage.category.id) return false;
      if (!matches(p?.name ?? '')) return false;
      if (stage.subcategory) return p?.subcategoryid?.id === stage.subcategory.id;
      return true;
    });
  }, [products, stage, matches]);

  /**
   * The pack this product is counted in — "1 / RU", "50 / PCS".
   *
   * The old system had a free-text packing phrase per product ("pcs standard in
   * one bag"); this one does not, and writing that sentence in code put words
   * on the screen that no admin had typed and none could change. So only what
   * is actually stored: the unit price's quantity over its unit name.
   */
  const packLine = (p: any) => {
    const up = p?.productvariants?.[0]?.unitprices?.[0];
    const count = Number(up?.quantity) || 0;
    const unit = up?.unitid?.unitname;
    if (!count || !unit) return '';
    return `${count} / ${unit}`;
  };

  const addSheetToCart = () => {
    const lines = sheetProducts
      .map((p: any) => ({ p, n: Number(qty[p.id]) || 0 }))
      .filter((l) => l.n > 0);

    if (!lines.length) {
      showToast('Enter a quantity against at least one item.', 'danger');
      return;
    }

    // "Restrict quantity by stock": trim each line to what is left on hand,
    // counting what this product already has in the cart, and say so.
    const trimmed: string[] = [];
    const skipped: string[] = [];
    let added = 0;

    lines.forEach(({ p, n: wanted }) => {
      const v = p.productvariants?.[0];
      const up = v?.unitprices?.[0];
      const unitId = up?.unitid?.id;
      const baseqty = baseQtyOf(v, unitId, up?.quantity);
      const inCart =
        cartItems.find(i => i.productId === p.id && i.variantId === (v?.id ?? p.id) && i.unitId === unitId)?.qty ?? 0;
      const room =
        maxPacksFor({
          restrict: restrictQty,
          stock: stockOf(v),
          baseqty,
          items: cartItems,
          productId: p.id,
          variantId: v?.id ?? p.id,
          unitId,
        }) - inCart;
      const n = Math.min(wanted, room);
      if (n <= 0) {
        skipped.push(p.name);
        return;
      }
      if (n < wanted) trimmed.push(`${p.name} (only ${n})`);
      added += 1;
      const rate = (Number(up?.offerprice) || 0) > 0 ? Number(up.offerprice) : Number(up?.salesrate) || 0;
      dispatch(
        addToCart({
          productId: p.id,
          productName: p.name,
          variantId: v?.id ?? p.id,
          variantName: v?.name ?? '',
          unitId: up?.unitid?.id,
          unitName: up?.unitid?.unitname,
          unitqty: Number(up?.quantity) || 1,
          imageUrl: p.imageurl,
          qty: n,
          rate,
          discount: Number(up?.discount) || 0,
          gst: Number(v?.gst) || 0,
          amount: rate * n,
          stock: stockOf(v),
          baseqty,
        }),
      );
    });

    if (skipped.length || trimmed.length) {
      const parts = [
        skipped.length ? `Out of stock: ${skipped.join(', ')}` : '',
        trimmed.length ? `Added only what is in stock: ${trimmed.join(', ')}` : '',
      ].filter(Boolean);
      showToast(parts.join('. ') + '.', 'danger');
    }
    if (!added) return;

    setQty({});
    if (!skipped.length && !trimmed.length) {
      showToast(`${added} item${added > 1 ? 's' : ''} added to cart.`, 'success');
    }
    navigation.navigate('CartScreen');
  };

  const title =
    stage.name === 'products'
      ? (stage.subcategory?.label ?? stage.category.label)
      : stage.name === 'subcategories'
        ? stage.category.label
        : variant === 'shop' ? 'Shop' : 'Home';

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* The shared header rather than a hand-rolled one. Rolling my own here
          quietly dropped the notification bell, and would have gone on dropping
          whatever else every other screen's header gains later. Only the left
          button differs by stage: the drawer at the top level, back inside. */}
      <AppHeader
        label={title}
        leftIcon={stage.name === 'categories' ? 'menu' : 'arrow-left'}
        onPress={stage.name === 'categories' ? undefined : goBack}
        menuTourId={variant === 'home' && stage.name === 'categories' ? 'cat-menu' : undefined}
        rightIcons={[
          { ...bellIcon, tourId: variant === 'home' ? 'cat-bell' : undefined },
          {
            id: 'cart',
            tourId: variant === 'home' ? 'cat-cart' : undefined,
            name: 'cart-outline',
            color: colors.brand,
            // Units, not lines: a sheet with 10 typed against one product has
            // ten things in the cart, and a badge reading "1" would be wrong.
            badge: cartCount,
            onPress: () => navigation.navigate('CartScreen'),
          },
        ]}
      />
      {NotificationsModal}

      {/* Only on the category screen. Deeper in, the list on screen is already
          the answer to one choice the customer just made, and a box that
          re-filters it is one more thing between them and the quantity column. */}
      {variant === 'shop' && stage.name === 'categories' && (
        <View style={styles.searchWrap}>
          <AppTextInput
            leftIcon="magnify"
            placeholder="Search…"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            placeholderTextColor={colors.subText}
            containerStyle={styles.searchInput}
          />
        </View>
      )}

      {stage.name === 'categories' && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Home wears the banner — the business's own artwork, and the first
              thing a returning customer looks for. Shop does not: it is the
              screen you go to when you already know what you are after, so it
              gets the search box instead.
              The padded wrapper is not decoration. BannerCarousel sizes its card
              to the screen minus this same inset and lays the cards in a plain
              horizontal ScrollView, so without the padding here the viewport is
              wider than the card and the next slide sits peeking at the edge. */}
          {variant === 'home' && (
            <View style={styles.bannerWrap}>
              <HeroBanner
                slides={heroSlides}
                products={products}
                horizontalPadding={18}
                onPress={() => {}}
              />
            </View>
          )}
          <View ref={variant === 'home' ? tourRef('cat-tiles') : undefined} collapsable={false}>
            <TileGrid tiles={categoryTiles} onPress={openCategory} emptyLabel="No categories yet." />
          </View>
        </ScrollView>
      )}

      {stage.name === 'subcategories' && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <TileGrid
            tiles={subTilesFor(stage.category.id)}
            onPress={(t) => {
              setSearch('');
              setStage({ name: 'products', category: stage.category, subcategory: t });
            }}
            emptyLabel="No sub-categories here."
          />
        </ScrollView>
      )}

      {stage.name === 'products' && (
        <>
          {/* Column headings, held above the list so they stay put while a long
              sheet scrolls under them. */}
          <View style={[styles.sheetHead, { backgroundColor: colors.brand }]}>
            <Text style={[styles.sheetHeadText, { color: colors.onBrand }]}>Items</Text>
            <View style={[styles.sheetHeadDivider, { backgroundColor: colors.onBrand }]} />
            <Text style={[styles.sheetHeadText, styles.sheetHeadQty, { color: colors.onBrand }]}>
              Quantity
            </Text>
          </View>

          {/* flex: 1 is load-bearing. A ScrollView with siblings in a flex column
              and no flex of its own consumes the whole remaining height, which
              pushed Cancel / Add to Cart off the bottom of the screen — present
              in the tree, never on the glass. */}
          <ScrollView
            style={styles.sheetList}
            contentContainerStyle={styles.sheetScroll}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            {sheetProducts.length === 0 ? (
              <View style={styles.empty}>
                <Icon name="package-variant-closed" size={40} color={colors.placeholder} />
                <Text style={[styles.emptyText, { color: colors.subText }]}>No items here yet.</Text>
              </View>
            ) : (
              sheetProducts.map((p: any, rowIndex: number) => {
                const pack = packLine(p);
                const up = p?.productvariants?.[0]?.unitprices?.[0];
                // Same rule the product grid uses, so one product never shows
                // two different prices in the same app.
                const price = (up?.offerprice ?? 0) > 0 ? up.offerprice : (up?.salesrate ?? 0);
                const mrp = Number(up?.mrp) || 0;
                return (
                  <View key={p.id} style={[styles.row, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                    <View style={styles.rowText}>
                      <Text style={[styles.rowName, { color: colors.text }]}>{p.name}</Text>
                      {!!pack && (
                        <Text style={[styles.rowPack, { color: colors.subText }]}>{pack}</Text>
                      )}
                      {showPrice && price > 0 && (
                        <View style={styles.rowPriceLine}>
                          <Text style={[styles.rowRate, { color: colors.brand }]}>{formatCatalogINR(price)}</Text>
                          {mrp > 0 && (
                            <Text style={[styles.rowMrp, { color: colors.subText }]}>{formatCatalogINR(mrp)}</Text>
                          )}
                        </View>
                      )}
                    </View>

                    <TextInput
                      ref={rowIndex === 0 ? (tourRef('sheet-qty') as any) : undefined}
                      style={[styles.qtyInput, { borderColor: colors.brand, color: colors.text }]}
                      value={qty[p.id] ?? ''}
                      onChangeText={(t) => setQty((q) => ({ ...q, [p.id]: t.replace(/[^0-9]/g, '') }))}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={colors.placeholder}
                      textAlign="center"
                    />

                    <TouchableOpacity
                      ref={rowIndex === 0 ? (tourRef('sheet-image') as any) : undefined}
                      style={styles.imgBtn}
                      activeOpacity={0.7}
                      disabled={!p.imageurl}
                      onPress={() => setPreview(p.imageurl)}
                    >
                      <Icon
                        name={p.imageurl ? 'image' : 'image-off-outline'}
                        size={28}
                        color={p.imageurl ? colors.brand : colors.placeholder}
                      />
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* The inset is padding on a plain View rather than a SafeAreaView so
              the brand colour is painted across the whole strip — buttons AND
              the gesture area under them. SafeAreaView reserves that space but
              leaves what shows through it to whatever is behind, which on this
              screen is the white page. */}
          <View
            style={[
              styles.actionsWrap,
              { backgroundColor: colors.brand, paddingBottom: insets.bottom },
            ]}
          >
            <View style={styles.actions}>
              <TouchableOpacity style={styles.actionBtn} onPress={goBack} activeOpacity={0.8}>
                <Text style={[styles.actionText, { color: colors.onBrand }]}>Cancel</Text>
              </TouchableOpacity>
              <View style={[styles.actionDivider, { backgroundColor: colors.onBrand }]} />
              <TouchableOpacity ref={tourRef('sheet-add') as any} style={styles.actionBtn} onPress={addSheetToCart} activeOpacity={0.8}>
                <Text style={[styles.actionText, { color: colors.onBrand }]}>Add to Cart</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      <ImageViewer uri={preview} onClose={() => setPreview(null)} />

      {variant === 'home' && stage.name === 'categories' && (
        <AppTour
          steps={CATALOG_HOME_TOUR}
          storageKey={`tour.catalogHome.${userId}`}
          enabled={!!userId && !!catData}
        />
      )}
      {stage.name === 'products' && (
        <AppTour
          steps={ORDER_SHEET_TOUR}
          storageKey={`tour.orderSheet.${userId}`}
          enabled={!!userId && sheetProducts.length > 0}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },


  scroll: { paddingBottom: 110 },
  bannerWrap: { paddingHorizontal: 18, paddingTop: 12 },
  searchWrap: { paddingHorizontal: 18, paddingTop: 12 },
  // AppTextInput ships a 12pt bottom margin of its own; the grid below
  // already supplies the gap, and the two together left a hole.
  searchInput: { marginBottom: 0 },

  sheetHead: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  sheetHeadText: { flex: 1, fontSize: 18, fontFamily: FONTS.bold, paddingHorizontal: 18 },
  sheetHeadQty: { flex: 0.9 },
  sheetHeadDivider: { width: 1, alignSelf: 'stretch', opacity: 0.5 },
  sheetList: { flex: 1 },
  // Room under the last line so it clears the action bar rather than
  // stopping flush against it, where a thumb reaching for the box lands
  // on Add to Cart instead.
  sheetScroll: { paddingBottom: 28 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1,
  },
  rowText: { flex: 1 },
  rowName: { fontSize: 14, fontFamily: FONTS.semiBold, lineHeight: 20 },
  rowPack: { fontSize: 12, fontFamily: FONTS.regular, marginTop: 2 },
  rowPriceLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  rowRate: { fontSize: 13, fontFamily: FONTS.bold },
  rowMrp: { fontSize: 12, fontFamily: FONTS.regular, textDecorationLine: 'line-through' },
  qtyInput: {
    width: 78, height: 42, borderWidth: 1.5, borderRadius: 4,
    fontSize: 15, fontFamily: FONTS.semiBold, paddingVertical: 0,
  },
  imgBtn: { padding: 4 },

  actionsWrap: { width: '100%' },
  actions: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { flex: 1, paddingVertical: 16, alignItems: 'center' },
  actionDivider: { width: 1, alignSelf: 'stretch', opacity: 0.5 },
  actionText: { fontSize: 17, fontFamily: FONTS.bold },

  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { fontSize: 13, fontFamily: FONTS.regular },
});
