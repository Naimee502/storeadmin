import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, Image, ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@apollo/client/react';
import { useSelector, useDispatch } from 'react-redux';
import { COLORS, FONTS, STRINGS, useTheme } from '../../../../config';
import { ProductGridSkeleton } from '../../../../config/skeletonlayouts';
import { GET_PRODUCTS, GET_ACCOUNT, RESOLVE_PRICE } from '../../../../apollo/queries/accounts';
import { apolloClient } from '../../../../apollo/client';
import { formatINR } from '../../../../utils';
import { AppHeader, AppTextInput, DynamicFlashList } from '../../../../components';
import { addToCart, updateQty } from '../../../../store/slices';
import { useShowProductPrice, useShowProductStock } from '../../../../apollo/hooks/adminsettings';
import type { RootState } from '../../../../store/rootreducer';

export default function Catalog() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const dispatch = useDispatch();
  const user = useSelector((s: RootState) => s.auth.user);
  const tenant = useSelector((s: RootState) => s.tenant);
  const cartItems = useSelector((s: RootState) => s.cart.items);
  const cartCount = cartItems.reduce((sum, i) => sum + i.qty, 0);
  const adminid = tenant.adminId ?? '';
  const showPrice = useShowProductPrice();
  const showStock = useShowProductStock();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [selectedUnits, setSelectedUnits] = useState<Record<string, number>>({});

  const { data, loading } = useQuery(GET_PRODUCTS, {
    variables: { adminid, limit: 100 },
    skip: !adminid,
  });

  const { data: accountData } = useQuery(GET_ACCOUNT, {
    variables: { id: user?.id, adminId: adminid },
    skip: !user?.id || !adminid,
  });
  const partyAccount = (accountData as any)?.getAccountById;

  const products = (data as any)?.getProductServices ?? [];

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

  const filtered = useMemo(() => products.filter((p: any) => {
    const matchCat = !category || p.categoryid?.id === category;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch && p.status !== false;
  }), [products, category, search]);

  const getCartQty = (productId: string, variantId: string, unitId?: string) =>
    cartItems.find(i => i.productId === productId && i.variantId === variantId && i.unitId === unitId)?.qty ?? 0;

  const getUnitLabel = (up: any) => {
    const name = up?.unitid?.unitname ?? 'Unit';
    const qty = up?.quantity ?? 1;
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
        const vars = {
          productid: p.id, variantid: v.id,
          unitid: up.unitid.id,
          adminid: adminid || null,
          accountid: user?.id ?? null,
          channelid: partyAccount?.channel?.id ?? null,
          region: partyAccount?.region ?? null,
        };
        console.log('[resolvePrice] calling with:', JSON.stringify(vars));
        const { data: pd } = await apolloClient.query({
          query: RESOLVE_PRICE,
          variables: vars,
          fetchPolicy: 'network-only',
        });
        const rp = (pd as any)?.resolvePrice;
        console.log('[resolvePrice] result:', JSON.stringify(rp));
        if (rp) {
          if (rp.rate != null) rate = rp.rate;
          // Only override the base unit discount when resolvePrice returns a
          // real party/channel discount. A null/zero result must NOT wipe the
          // product's own unit discount (otherwise discount disappears & total
          // is computed on the full rate).
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

  const handleQty = (productId: string, variantId: string, unitId: string | undefined, qty: number) =>
    dispatch(updateQty({ productId, variantId, unitId, qty }));

  const renderProduct = ({ item: p, index }: any) => {
    const v = p.productvariants?.[0];
    const unitIdx = selectedUnits[p.id] ?? 0;
    const up = v?.unitprices?.[unitIdx] ?? v?.unitprices?.[0];
    const unitId = up?.unitid?.id;
    const price = (up?.offerprice ?? 0) > 0 ? up.offerprice : (up?.salesrate ?? 0);
    const mrp = up?.mrp ?? 0;
    const cartQty = v ? getCartQty(p.id, v.id, unitId) : 0;
    const hasMrp = mrp > 0;
    const isLeft = index % 2 === 0;
    const outOfStock = v?.currentstock === 0;
    const multiUnit = (v?.unitprices?.length ?? 0) > 1;

    return (
      <TouchableOpacity
        style={[
          styles.card,
          { backgroundColor: colors.cardGlass, borderColor: colors.border },
          isLeft ? { marginRight: 6 } : { marginLeft: 6 },
        ]}
        onPress={() => navigation.navigate('ProductDetail', { productId: p.id })}
        activeOpacity={0.88}
      >
        <View>
          <View style={[styles.imgWrap, { backgroundColor: colors.brandSoft }]}>
            {p.imageurl
              ? <Image source={{ uri: p.imageurl }} style={styles.img} resizeMode="cover" />
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

          {/* Unit chips */}
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

          {showPrice && (
            <View style={styles.priceRow}>
              <Text style={[styles.price, { color: colors.brand }]}>{formatINR(price)}</Text>
              {hasMrp && (
                <Text style={[styles.mrp, { color: colors.subText }]}>{formatINR(mrp)}</Text>
              )}
            </View>
          )}
        </View>

        {v && !outOfStock && (
          cartQty === 0 ? (
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.brand }]}
              onPress={() => handleAdd(p)}
            >
              <Icon name="plus" size={14} color="#fff" />
              <Text style={styles.addBtnText}>{STRINGS.party.add}</Text>
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
  };

  const ListHeader = () => (
    <>
      <AppTextInput
        leftIcon="magnify"
        placeholder={STRINGS.storefront.searchPlaceholder}
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
        containerStyle={{ marginBottom: 8, marginTop: 10 }}
      />
      {categories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipList}
          style={styles.chipScroll}
        >
          {[{ id: null, name: 'All' }, ...categories].map((item: any) => {
            const active = category === item.id;
            return (
              <TouchableOpacity
                key={item.id ?? 'all'}
                style={[styles.chip, active
                  ? { backgroundColor: colors.brand, borderColor: colors.brand }
                  : { backgroundColor: colors.raisedSurface, borderColor: colors.border },
                ]}
                onPress={() => setCategory(item.id)}
              >
                <Text style={[styles.chipText, { color: active ? '#fff' : colors.subText }]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

      <AppHeader
        label={STRINGS.party.catalog}
        rightIcons={[{
          id: 'cart', name: 'cart-outline', color: colors.brand, badge: cartCount,
          onPress: () => navigation.navigate('CartScreen'),
        }]}
      />

      {loading ? (
        <>
          <ListHeader />
          <ProductGridSkeleton />
        </>
      ) : filtered.length === 0 ? (
        <>
          <ListHeader />
          <View style={styles.center}>
            <Icon name="magnify-close" size={44} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.subText }]}>{STRINGS.party.noProducts}</Text>
          </View>
        </>
      ) : (
        <DynamicFlashList
          data={filtered}
          renderItem={renderProduct}
          numColumns={2}
          estimatedItemSize={220}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={<ListHeader />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  chipScroll: { flexGrow: 0 },
  chipList: { paddingTop: 0, paddingBottom: 8, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  chipText: { fontSize: 13, fontFamily: FONTS.semiBold },
  listContent: { paddingHorizontal: 18, paddingBottom: 110, paddingTop: 4 },
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
  addBtnText: { fontSize: 13, fontFamily: FONTS.bold, color: '#fff' },
  qtyControl: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 12, borderWidth: 1.5, overflow: 'hidden',
  },
  qtyBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  qtyText: { fontSize: 14, fontFamily: FONTS.bold, minWidth: 24, textAlign: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 14, fontFamily: FONTS.regular },
});
