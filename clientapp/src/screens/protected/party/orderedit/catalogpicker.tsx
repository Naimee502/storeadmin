import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, ScrollView, StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, FONTS, useTheme, IMG } from '../../../../config';
import { formatINR } from '../../../../utils';
import { AppImage, AppTextInput, ProductImageViewer, productImages } from '../../../../components';
import { RESOLVE_PRICE } from '../../../../apollo/queries/accounts';
import { apolloClient } from '../../../../apollo/client';
import { useShowProductStock, useRestrictQtyByStock } from '../../../../apollo/hooks/adminsettings';

/**
 * "Add Product" for Edit Order, shown as the same catalogue the party / salesman
 * order from (photo, name, category · variant, price + MRP, unit chips,
 * Add → − qty +), instead of a plain list of unit chips.
 *
 * It does not keep its own cart: the quantities shown are the edit screen's
 * order lines (read through `getQty`), and Add / − / + change those lines
 * directly, so closing this sheet just shows the order with the changes in it.
 */
type Props = {
  visible: boolean;
  onClose: () => void;
  products: any[];
  adminid: string | null | undefined;
  /** The ORDER's party — its price list decides the rate, not the logged-in user. */
  partyId: string | null | undefined;
  partyAccount: any;
  partyName?: string;
  showPrice: boolean;
  /** Lines in the order + their total, for the Done bar. */
  itemCount: number;
  total: number;
  getQty: (productId: string, variantId: string, unitId: string) => number;
  onAdd: (product: any, variant: any, unitprice: any) => void;
  onQty: (productId: string, variantId: string, unitId: string, qty: number) => void;
};

type Resolved = { rate: number; discount: number } | null;

const unitLabel = (u: any) => {
  const name = u?.unitid?.unitname ?? 'Unit';
  const qty = u?.quantity ?? 1;
  return qty > 1 ? `${qty} × ${name}` : name;
};

export default function CatalogPicker({
  visible, onClose, products, adminid, partyId, partyAccount, partyName, showPrice,
  itemCount, total, getQty, onAdd, onQty,
}: Props) {
  const { colors, isDark } = useTheme();
  const showStock = useShowProductStock();
  const restrict = useRestrictQtyByStock();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [selectedUnits, setSelectedUnits] = useState<Record<string, number>>({});
  // Tap a photo → all of the product's photos (same viewer as the catalogue).
  const [preview, setPreview] = useState<{ images: string[]; title: string } | null>(null);

  // ---- Party price list: resolve every product+unit once, so the card shows
  // the same rate that goes into the order line. ----
  const [priceMap, setPriceMap] = useState<Record<string, Resolved>>({});
  const priceMapRef = useRef(priceMap);
  priceMapRef.current = priceMap;
  const keyOf = (p: string, v: string, u: string) => `${p}:${v}:${u}`;

  useEffect(() => { setPriceMap({}); }, [partyId, adminid]);

  useEffect(() => {
    if (!visible || !partyId || !adminid || products.length === 0) return;
    const channelid = partyAccount?.channel?.id ?? null;
    const region = partyAccount?.region ?? null;
    let cancelled = false;
    (async () => {
      const updates: Record<string, Resolved> = {};
      await Promise.all(products.flatMap((p: any) => {
        const v = p.productvariants?.[0];
        if (!v) return [];
        return (v.unitprices ?? []).map(async (up: any) => {
          const uid = up?.unitid?.id;
          if (!uid) return;
          const key = keyOf(p.id, v.id, uid);
          if (priceMapRef.current[key] !== undefined) return;
          try {
            const { data } = await apolloClient.query({
              query: RESOLVE_PRICE,
              variables: { productid: p.id, variantid: v.id, unitid: uid, adminid, accountid: partyId, channelid, region },
              fetchPolicy: 'cache-first',
            });
            const rp = (data as any)?.resolvePrice;
            updates[key] = rp?.rate != null ? { rate: rp.rate, discount: Number(rp.discount) || 0 } : null;
          } catch {
            updates[key] = null;
          }
        });
      }));
      if (!cancelled && Object.keys(updates).length) setPriceMap(prev => ({ ...prev, ...updates }));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, products, partyAccount, partyId, adminid]);

  const categories = useMemo(() => {
    const seen = new Set<string>();
    const cats: { id: string; name: string }[] = [];
    products.forEach((p: any) => {
      if (p.categoryid?.id && !seen.has(p.categoryid.id)) {
        seen.add(p.categoryid.id);
        cats.push({ id: p.categoryid.id, name: p.categoryid.categoryname });
      }
    });
    return cats;
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const isOut = (p: any) => (typeof p.productvariants?.[0]?.currentstock === 'number' && p.productvariants[0].currentstock <= 0 ? 1 : 0);
    return products
      .filter((p: any) => p.status !== false)
      .filter((p: any) => !category || p.categoryid?.id === category)
      .filter((p: any) => !q
        || (p.name || '').toLowerCase().includes(q)
        || (p.productvariants?.[0]?.sku || '').toLowerCase().includes(q))
      .map((p: any, i: number) => ({ p, i }))
      .sort((a: any, b: any) => isOut(a.p) - isOut(b.p) || a.i - b.i)
      .map((x: any) => x.p);
  }, [products, search, category]);

  const close = () => { setSearch(''); onClose(); };

  const renderItem = ({ item: p }: any) => {
    const v = p.productvariants?.[0];
    const unitIdx = selectedUnits[p.id] ?? 0;
    const up = v?.unitprices?.[unitIdx] ?? v?.unitprices?.[0];
    const unitId = up?.unitid?.id;
    const basePrice = (up?.offerprice ?? 0) > 0 ? up.offerprice : (up?.salesrate ?? 0);
    const resolved = v && unitId ? priceMap[keyOf(p.id, v.id, unitId)] : undefined;
    const price = resolved?.rate != null ? resolved.rate : basePrice;
    const mrp = up?.mrp ?? 0;
    const hasMrp = mrp > 0 && mrp > price;
    const outOfStock = typeof v?.currentstock === 'number' && v.currentstock <= 0;
    const multiUnit = (v?.unitprices?.length ?? 0) > 1;
    const qty = v && unitId ? getQty(p.id, v.id, unitId) : 0;
    // Out of stock blocks adding only when "Restrict quantity by stock" is on.
    const canAdd = !!v && !!unitId && !(restrict && outOfStock);
    const imgs = productImages(p);
    const cover = imgs[0];

    return (
      <View style={[styles.row, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.thumb, { backgroundColor: colors.brandSoft }]}
          onPress={() => cover && setPreview({ images: imgs, title: p.name })}
          disabled={!cover}
          activeOpacity={0.8}
        >
          {cover
            ? <AppImage uri={cover} width={IMG.product} style={styles.img} resizeMode="cover"
                fallback={<Icon name="package-variant-closed" size={24} color={colors.brand} />} />
            : <Icon name="package-variant-closed" size={24} color={colors.brand} />}
          {imgs.length > 1 && (
            <View style={styles.imgCount}>
              <Icon name="image-multiple-outline" size={10} color="#fff" />
              <Text style={styles.imgCountText}>{imgs.length}</Text>
            </View>
          )}
          {showStock && outOfStock && (
            <View style={styles.oosTag}><Text style={styles.oosText}>Out</Text></View>
          )}
        </TouchableOpacity>

        <View style={styles.rowMid}>
          <Text style={[styles.productName, { color: colors.text }]} numberOfLines={1}>{p.name}</Text>
          {(p.categoryid?.categoryname || v?.name) ? (
            <Text style={[styles.catText, { color: colors.subText }]} numberOfLines={1}>
              {[p.categoryid?.categoryname, v?.name].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
          {showPrice && (
            <View style={styles.priceRow}>
              <Text style={[styles.price, { color: colors.brand }]}>{formatINR(price)}</Text>
              {hasMrp && <Text style={[styles.mrp, { color: colors.subText }]}>{formatINR(mrp)}</Text>}
            </View>
          )}
          <View style={styles.unitSlot}>
            {multiUnit && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {v.unitprices.map((u: any, ui: number) => {
                  const active = unitIdx === ui;
                  return (
                    <TouchableOpacity
                      key={`${u.unitid?.id ?? ui}`}
                      style={[styles.unitChip, active
                        ? { backgroundColor: colors.brand, borderColor: colors.brand }
                        : { backgroundColor: colors.raisedSurface, borderColor: colors.border }]}
                      onPress={() => setSelectedUnits(prev => ({ ...prev, [p.id]: ui }))}
                    >
                      <Text style={[styles.unitChipText, { color: active ? colors.onBrand : colors.text }]}>{unitLabel(u)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>

        <View style={styles.rowRight}>
          {qty > 0 ? (
            <View style={[styles.qtyControl, { borderColor: colors.brand }]}>
              <TouchableOpacity style={[styles.qtyBtn, { backgroundColor: colors.brandSoft }]} onPress={() => onQty(p.id, v.id, unitId, qty - 1)}>
                <Icon name="minus" size={13} color={colors.brand} />
              </TouchableOpacity>
              <Text style={[styles.qtyText, { color: colors.brand }]}>{qty}</Text>
              <TouchableOpacity style={[styles.qtyBtn, { backgroundColor: colors.brandSoft }]} onPress={() => onQty(p.id, v.id, unitId, qty + 1)}>
                <Icon name="plus" size={13} color={colors.brand} />
              </TouchableOpacity>
            </View>
          ) : canAdd ? (
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.brand }]} onPress={() => onAdd(p, v, up)}>
              <Icon name="plus" size={14} color={colors.onBrand} />
              <Text style={[styles.addBtnText, { color: colors.onBrand }]}>Add</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={close} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Icon name="arrow-left" size={24} color={colors.brand} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Add Products</Text>
          <View style={{ width: 24 }} />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(p: any) => String(p.id)}
          renderItem={renderItem}
          extraData={[priceMap, selectedUnits, getQty]}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <>
              {partyName ? (
                <View style={[styles.partyBanner, { backgroundColor: colors.brandSoft, borderColor: colors.brand + '44' }]}>
                  <Icon name="account-tie-outline" size={16} color={colors.brand} />
                  <Text style={[styles.partyBannerText, { color: colors.brand }]}>
                    Adding to order for <Text style={{ fontFamily: FONTS.bold }}>{partyName}</Text>
                  </Text>
                </View>
              ) : null}
              <AppTextInput
                leftIcon="magnify"
                placeholder="Search products..."
                value={search}
                onChangeText={setSearch}
                autoCapitalize="none"
                containerStyle={{ marginBottom: 8, marginTop: 10 }}
              />
              {categories.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipList} style={{ flexGrow: 0 }}>
                  {[{ id: null, name: 'All' }, ...categories].map((c: any) => {
                    const active = category === c.id;
                    return (
                      <TouchableOpacity
                        key={c.id ?? 'all'}
                        style={[styles.chip, active
                          ? { backgroundColor: colors.brand, borderColor: colors.brand }
                          : { backgroundColor: colors.raisedSurface, borderColor: colors.border }]}
                        onPress={() => setCategory(c.id)}
                      >
                        <Text style={[styles.chipText, { color: active ? colors.onBrand : colors.text }]}>{c.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="magnify-close" size={40} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.subText }]}>No products found.</Text>
            </View>
          }
        />

        {/* Back to the order with everything added above. */}
        <TouchableOpacity style={[styles.doneBar, { backgroundColor: colors.brand }]} onPress={close} activeOpacity={0.9}>
          <View style={[styles.doneBadge, { backgroundColor: colors.onBrand }]}>
            <Text style={[styles.doneBadgeText, { color: colors.brand }]}>{itemCount}</Text>
          </View>
          <Text style={[styles.doneText, { color: colors.onBrand }]}>
            {showPrice ? `Done · ${formatINR(total)}` : 'Done'}
          </Text>
          <Icon name="check" size={20} color={colors.onBrand} />
        </TouchableOpacity>

        <ProductImageViewer
          visible={!!preview}
          images={preview?.images ?? []}
          title={preview?.title}
          onClose={() => setPreview(null)}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontFamily: FONTS.bold },
  listContent: { paddingHorizontal: 18, paddingBottom: 110, paddingTop: 4 },
  partyBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, padding: 10, marginTop: 10, marginBottom: 4 },
  partyBannerText: { fontSize: 13, fontFamily: FONTS.semiBold, flex: 1 },
  chipList: { paddingBottom: 8, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  chipText: { fontSize: 13, fontFamily: FONTS.semiBold },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 98,
    borderRadius: 14, borderWidth: 1, padding: 10, marginBottom: 10,
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  thumb: { width: 78, height: 78, borderRadius: 12, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', alignSelf: 'flex-start' },
  img: { ...StyleSheet.absoluteFillObject },
  imgCount: { position: 'absolute', top: 4, right: 4, flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 8 },
  imgCountText: { color: '#fff', fontSize: 9, fontFamily: FONTS.semiBold },
  oosTag: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.55)', paddingVertical: 2, alignItems: 'center' },
  oosText: { fontSize: 8, fontFamily: FONTS.semiBold, color: '#fff' },
  rowMid: { flex: 1, justifyContent: 'center' },
  rowRight: { justifyContent: 'center', alignItems: 'flex-end' },
  productName: { fontSize: 13.5, fontFamily: FONTS.semiBold, marginBottom: 2 },
  catText: { fontSize: 11, fontFamily: FONTS.regular, marginBottom: 3 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  price: { fontSize: 14, fontFamily: FONTS.bold },
  mrp: { fontSize: 11.5, fontFamily: FONTS.regular, textDecorationLine: 'line-through' },
  unitSlot: { height: 26, justifyContent: 'center', marginTop: 2 },
  unitChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, marginRight: 5 },
  unitChipText: { fontSize: 10, fontFamily: FONTS.semiBold },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 11, paddingVertical: 8, paddingHorizontal: 16, gap: 4 },
  addBtnText: { fontSize: 13, fontFamily: FONTS.bold },
  qtyControl: { flexDirection: 'row', alignItems: 'center', borderRadius: 11, borderWidth: 1.5, overflow: 'hidden' },
  qtyBtn: { paddingHorizontal: 11, paddingVertical: 7 },
  qtyText: { fontSize: 14, fontFamily: FONTS.bold, minWidth: 26, textAlign: 'center' },
  empty: { alignItems: 'center', paddingVertical: 50, gap: 10 },
  emptyText: { fontSize: 14, fontFamily: FONTS.regular },
  doneBar: {
    position: 'absolute', bottom: 20, left: 18, right: 18,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 18, paddingHorizontal: 18, paddingVertical: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  doneBadge: { minWidth: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  doneBadgeText: { fontSize: 13, fontFamily: FONTS.bold },
  doneText: { flex: 1, fontSize: 15, fontFamily: FONTS.bold },
});
