import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Image, ScrollView } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@apollo/client/react';
import { useSelector, useDispatch } from 'react-redux';
import { COLORS, FONTS, useTheme } from '../../../../config';
import { BackHeader, AppTextInput, DynamicFlashList } from '../../../../components';
import { GET_PRODUCTS, GET_ACCOUNT, RESOLVE_PRICE } from '../../../../apollo/queries/accounts';
import { apolloClient } from '../../../../apollo/client';
import { formatINR } from '../../../../utils';
import { addToCart, updateQty } from '../../../../store/slices';
import type { RootState } from '../../../../store/rootreducer';

export default function SalesmanCatalog() {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const { colors, isDark } = useTheme();
  const dispatch   = useDispatch();
  const tenant     = useSelector((s: RootState) => s.tenant);
  const cartItems  = useSelector((s: RootState) => s.cart.items);
  const adminid    = tenant.adminId ?? '';

  const { partyId, partyName } = route.params ?? {};

  const [search,        setSearch]        = useState('');
  const [category,     setCategory]     = useState<string | null>(null);
  const [selectedUnits, setSelectedUnits] = useState<Record<string, number>>({});

  const { data } = useQuery(GET_PRODUCTS, {
    variables: { adminid, limit: 100 },
    skip: !adminid,
  });

  const { data: accountData } = useQuery(GET_ACCOUNT, {
    variables: { id: partyId, adminId: adminid },
    skip: !partyId || !adminid,
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
    const matchCat    = !category || p.categoryid?.id === category;
    const matchSearch = !search   || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch && p.status !== false;
  }), [products, category, search]);

  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0);

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
            adminid:   adminid || null,
            accountid: partyId ?? null,
            channelid: partyAccount?.channel?.id ?? null,
            region:    partyAccount?.region ?? null,
          },
          fetchPolicy: 'network-only',
        });
        const rp = (pd as any)?.resolvePrice;
        if (rp) {
          if (rp.rate != null) rate = rp.rate;
          // Only override the product's own unit discount when resolvePrice
          // returns a real party/channel discount. A null/zero result must NOT
          // wipe the unit discount, otherwise item + total discount show as 0.
          if (rp.discount != null && rp.discount > 0) disc = rp.discount;
        }
      } catch (e) {
        console.warn('[resolvePrice]', e);
      }
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

  const renderProduct = ({ item: p, index }: any) => {
    const v        = p.productvariants?.[0];
    const unitIdx  = selectedUnits[p.id] ?? 0;
    const up       = v?.unitprices?.[unitIdx] ?? v?.unitprices?.[0];
    const unitId   = up?.unitid?.id;
    const price    = (up?.offerprice ?? 0) > 0 ? up.offerprice : (up?.salesrate ?? 0);
    const mrp      = up?.mrp ?? 0;
    const cartQty  = v ? getCartQty(p.id, v.id, unitId) : 0;
    const hasMrp   = mrp > 0;
    const isLeft   = index % 2 === 0;
    const outOfStock = v?.currentstock === 0;
    const multiUnit  = (v?.unitprices?.length ?? 0) > 1;

    return (
      <View
        style={[
          styles.card,
          { backgroundColor: colors.cardGlass, borderColor: colors.border },
          isLeft ? { marginRight: 6 } : { marginLeft: 6 },
        ]}
      >
        <View style={[styles.imgWrap, { backgroundColor: colors.brandSoft }]}>
          {p.imageurl
            ? <Image source={{ uri: p.imageurl }} style={styles.img} resizeMode="cover" />
            : <Icon name="package-variant-closed" size={30} color={colors.brand} />
          }
          {outOfStock && (
            <View style={styles.oosTag}>
              <Text style={styles.oosText}>Out of Stock</Text>
            </View>
          )}
        </View>
        <Text style={[styles.productName, { color: colors.text }]} numberOfLines={2}>{p.name}</Text>
        {p.categoryid?.categoryname && <Text style={[styles.catText, { color: colors.subText }]}>{p.categoryid.categoryname}</Text>}
        {v?.name && <Text style={[styles.variantText, { color: colors.subText }]}>{v.name}</Text>}

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

        <View style={styles.priceRow}>
          <Text style={[styles.price, { color: colors.brand }]}>{formatINR(price)}</Text>
          {hasMrp && <Text style={[styles.mrp, { color: colors.subText }]}>{formatINR(mrp)}</Text>}
        </View>
        {v && !outOfStock && (
          cartQty === 0 ? (
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.brand }]} onPress={() => handleAdd(p)}>
              <Icon name="plus" size={14} color="#fff" />
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.qtyControl, { borderColor: colors.brand }]}>
              <TouchableOpacity style={[styles.qtyBtn, { backgroundColor: colors.brandSoft }]} onPress={() => handleQty(p.id, v.id, unitId, cartQty - 1)}>
                <Icon name="minus" size={13} color={colors.brand} />
              </TouchableOpacity>
              <Text style={[styles.qtyText, { color: colors.brand }]}>{cartQty}</Text>
              <TouchableOpacity style={[styles.qtyBtn, { backgroundColor: colors.brandSoft }]} onPress={() => handleQty(p.id, v.id, unitId, cartQty + 1)}>
                <Icon name="plus" size={13} color={colors.brand} />
              </TouchableOpacity>
            </View>
          )
        )}
      </View>
    );
  };

  const ListHeader = () => (
    <>
      {partyName && (
        <View style={[styles.partyBanner, { backgroundColor: colors.brandSoft, borderColor: colors.brand + '44' }]}>
          <Icon name="account-tie-outline" size={16} color={colors.brand} />
          <Text style={[styles.partyBannerText, { color: colors.brand }]}>
            Taking order for <Text style={{ fontFamily: FONTS.bold }}>{partyName}</Text>
          </Text>
        </View>
      )}
      <AppTextInput
        leftIcon="magnify"
        placeholder="Search products..."
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
        containerStyle={{ marginBottom: 8, marginTop: 10 }}
      />
      {categories.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipList} style={styles.chipScroll}>
          {[{ id: null, name: 'All' }, ...categories].map((item: any) => {
            const active = category === item.id;
            return (
              <TouchableOpacity
                key={item.id ?? 'all'}
                style={[styles.chip, active
                  ? { backgroundColor: colors.brand,         borderColor: colors.brand }
                  : { backgroundColor: colors.raisedSurface, borderColor: colors.border },
                ]}
                onPress={() => setCategory(item.id)}
              >
                <Text style={[styles.chipText, { color: active ? '#fff' : colors.subText }]}>{item.name}</Text>
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

      <BackHeader
        label="Products"
        rightIcons={cartCount > 0 ? [{
          id: 'cart', name: 'cart-outline', color: colors.brand, badge: cartCount,
          onPress: () => navigation.navigate('SalesmanCart'),
        }] : []}
      />

      {filtered.length === 0 ? (
        <>
          <ListHeader />
          <View style={styles.center}>
            <Icon name="magnify-close" size={44} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.subText }]}>No products found</Text>
          </View>
        </>
      ) : (
        <DynamicFlashList
          data={filtered}
          renderItem={renderProduct}
          numColumns={2}
          estimatedItemSize={230}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={<ListHeader />}
        />
      )}

      {cartCount > 0 && (
        <TouchableOpacity
          style={[styles.cartBar, { backgroundColor: colors.brand }]}
          onPress={() => navigation.navigate('SalesmanCart')}
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

const styles = StyleSheet.create({
  container:   { flex: 1 },
  listContent: { paddingHorizontal: 18, paddingBottom: 110, paddingTop: 4 },

  partyBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, borderWidth: 1, padding: 10, marginTop: 10, marginBottom: 4,
  },
  partyBannerText: { fontSize: 13, fontFamily: FONTS.semiBold, flex: 1 },

  chipScroll:  { flexGrow: 0 },
  chipList:    { paddingTop: 0, paddingBottom: 8, gap: 8 },
  chip:        { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  chipText:    { fontSize: 13, fontFamily: FONTS.semiBold },

  card: {
    flex: 1, borderRadius: 18, borderWidth: 1, padding: 12, marginBottom: 12,
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  imgWrap: { height: 90, borderRadius: 12, marginBottom: 10, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  img:     { width: '100%', height: '100%' },
  oosTag:  { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 3, alignItems: 'center' },
  oosText: { fontSize: 10, fontFamily: FONTS.semiBold, color: '#fff' },
  productName: { fontSize: 13, fontFamily: FONTS.semiBold, lineHeight: 18, marginBottom: 2 },
  catText:     { fontSize: 10, fontFamily: FONTS.regular, marginBottom: 1 },
  variantText: { fontSize: 11, fontFamily: FONTS.semiBold, marginBottom: 4 },
  priceRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  price:       { fontSize: 14, fontFamily: FONTS.bold },
  mrp:         { fontSize: 12, fontFamily: FONTS.regular, textDecorationLine: 'line-through' },
  unitScroll:   { flexGrow: 0, marginBottom: 6 },
  unitChip:     { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, marginRight: 5 },
  unitChipText: { fontSize: 10, fontFamily: FONTS.semiBold },
  addBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 8, gap: 4 },
  addBtnText:  { fontSize: 13, fontFamily: FONTS.bold, color: '#fff' },
  qtyControl:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, borderWidth: 1.5, overflow: 'hidden' },
  qtyBtn:      { paddingHorizontal: 12, paddingVertical: 8 },
  qtyText:     { fontSize: 14, fontFamily: FONTS.bold, minWidth: 24, textAlign: 'center' },

  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 14, fontFamily: FONTS.regular },

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
