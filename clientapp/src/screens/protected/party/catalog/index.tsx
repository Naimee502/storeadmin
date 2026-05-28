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
import { GET_PRODUCTS } from '../../../../apollo/queries/accounts';
import { formatINR } from '../../../../utils';
import { AppHeader, AppTextInput, DynamicFlashList } from '../../../../components';
import { addToCart, updateQty } from '../../../../store/slices';
import type { RootState } from '../../../../store/rootreducer';

const DUMMY_PRODUCTS = [
  { id: 'dp1', name: 'Premium Basmati Rice',   imageurl: null, status: true, categoryid: { id: 'c1', name: 'Grains & Cereals'  }, variants: [{ id: 'dv1', name: '5 kg',  currentstock: 150, unitprices: [{ salesrate: 560,  mrp: 680  }] }] },
  { id: 'dp2', name: 'Toor Dal',               imageurl: null, status: true, categoryid: { id: 'c2', name: 'Pulses & Lentils'  }, variants: [{ id: 'dv2', name: '2 kg',  currentstock: 85,  unitprices: [{ salesrate: 185,  mrp: 220  }] }] },
  { id: 'dp3', name: 'Refined Sunflower Oil',  imageurl: null, status: true, categoryid: { id: 'c3', name: 'Oils & Fats'       }, variants: [{ id: 'dv3', name: '1 L',   currentstock: 200, unitprices: [{ salesrate: 170,  mrp: 195  }] }] },
  { id: 'dp4', name: 'Whole Wheat Atta',       imageurl: null, status: true, categoryid: { id: 'c1', name: 'Grains & Cereals'  }, variants: [{ id: 'dv4', name: '5 kg',  currentstock: 0,   unitprices: [{ salesrate: 275,  mrp: 310  }] }] },
  { id: 'dp5', name: 'Sona Masoori Rice',      imageurl: null, status: true, categoryid: { id: 'c1', name: 'Grains & Cereals'  }, variants: [{ id: 'dv5', name: '10 kg', currentstock: 45,  unitprices: [{ salesrate: 680,  mrp: 750  }] }] },
  { id: 'dp6', name: 'Chana Dal',              imageurl: null, status: true, categoryid: { id: 'c2', name: 'Pulses & Lentils'  }, variants: [{ id: 'dv6', name: '1 kg',  currentstock: 120, unitprices: [{ salesrate: 95,   mrp: 110  }] }] },
  { id: 'dp7', name: 'Mustard Oil',            imageurl: null, status: true, categoryid: { id: 'c3', name: 'Oils & Fats'       }, variants: [{ id: 'dv7', name: '1 L',   currentstock: 80,  unitprices: [{ salesrate: 155,  mrp: 180  }] }] },
  { id: 'dp8', name: 'Moong Dal (Split)',      imageurl: null, status: true, categoryid: { id: 'c2', name: 'Pulses & Lentils'  }, variants: [{ id: 'dv8', name: '500 g', currentstock: 200, unitprices: [{ salesrate: 65,   mrp: 0    }] }] },
];

export default function Catalog() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const dispatch  = useDispatch();
  const tenant    = useSelector((s: RootState) => s.tenant);
  const cartItems = useSelector((s: RootState) => s.cart.items);
  const cartCount = cartItems.reduce((sum, i) => sum + i.qty, 0);
  const adminid   = tenant.adminId ?? '';

  const [search,   setSearch]   = useState('');
  const [category, setCategory] = useState<string | null>(null);

  const { data, loading } = useQuery(GET_PRODUCTS, {
    variables: { adminid, limit: 100 },
    skip: !adminid,
  });

  const rawProducts = (data?.getProductServices ?? []) as any[];
  const products    = rawProducts.length > 0 ? rawProducts : DUMMY_PRODUCTS;

  const categories = useMemo(() => {
    const seen = new Set<string>();
    const cats: { id: string; name: string }[] = [];
    products.forEach((p: any) => {
      if (p.categoryid?.id && !seen.has(p.categoryid.id)) {
        seen.add(p.categoryid.id);
        cats.push({ id: p.categoryid.id, name: p.categoryid.name });
      }
    });
    return cats;
  }, [products]);

  const filtered = useMemo(() => products.filter((p: any) => {
    const matchCat    = !category || p.categoryid?.id === category;
    const matchSearch = !search   || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch && p.status !== false;
  }), [products, category, search]);

  const getCartQty = (productId: string, variantId: string) =>
    cartItems.find(i => i.productId === productId && i.variantId === variantId)?.qty ?? 0;

  const handleAdd = (p: any) => {
    const v = p.variants?.[0];
    if (!v) return;
    const rate = v.unitprices?.[0]?.salesrate ?? 0;
    dispatch(addToCart({
      productId: p.id, productName: p.name,
      variantId: v.id, variantName: v.name,
      imageUrl: p.imageurl,
      qty: 1, rate, gst: 0, amount: rate,
    }));
  };

  const handleQty = (productId: string, variantId: string, qty: number) =>
    dispatch(updateQty({ productId, variantId, qty }));

  const renderProduct = ({ item: p, index }: any) => {
    const v           = p.variants?.[0];
    const price       = v?.unitprices?.[0]?.salesrate ?? 0;
    const mrp         = v?.unitprices?.[0]?.mrp ?? 0;
    const cartQty     = v ? getCartQty(p.id, v.id) : 0;
    const hasDiscount = mrp > 0 && mrp > price;
    const isLeft      = index % 2 === 0;

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
        <View style={[styles.imgWrap, { backgroundColor: colors.brandSoft }]}>
          {p.imageurl
            ? <Image source={{ uri: p.imageurl }} style={styles.img} resizeMode="cover" />
            : <Icon name="package-variant-closed" size={30} color={colors.brand} />
          }
          {v?.currentstock === 0 && (
            <View style={styles.oosTag}>
              <Text style={styles.oosText}>{STRINGS.party.outOfStock}</Text>
            </View>
          )}
        </View>

        <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>{p.name}</Text>
        {p.categoryid?.name && (
          <Text style={[styles.catText, { color: colors.subText }]}>{p.categoryid.name}</Text>
        )}
        <View style={styles.priceRow}>
          <Text style={[styles.price, { color: colors.brand }]}>{formatINR(price)}</Text>
          {hasDiscount && (
            <Text style={[styles.mrp, { color: colors.subText }]}>{formatINR(mrp)}</Text>
          )}
        </View>

        {v && (
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
                onPress={() => handleQty(p.id, v.id, cartQty - 1)}
              >
                <Icon name="minus" size={13} color={colors.brand} />
              </TouchableOpacity>
              <Text style={[styles.qtyText, { color: colors.brand }]}>{cartQty}</Text>
              <TouchableOpacity
                style={[styles.qtyBtn, { backgroundColor: colors.brandSoft }]}
                onPress={() => handleQty(p.id, v.id, cartQty + 1)}
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
      <View style={styles.searchWrap}>
        <AppTextInput
          leftIcon="magnify"
          placeholder={STRINGS.storefront.searchPlaceholder}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          containerStyle={{ marginBottom: 0 }}
        />
      </View>
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
                  ? { backgroundColor: colors.brand,         borderColor: colors.brand }
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
  container:   { flex: 1 },
  searchWrap:  { paddingTop: 10, paddingBottom: 4 },
  chipScroll:  { flexGrow: 0 },
  chipList:    { paddingBottom: 8, gap: 8 },
  chip:        { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  chipText:    { fontSize: 13, fontFamily: FONTS.semiBold },
  listContent: { paddingHorizontal: 18, paddingBottom: 110, paddingTop: 4 },
  card: {
    flex: 1, borderRadius: 18, borderWidth: 1, padding: 12, marginBottom: 12,
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  imgWrap: {
    height: 90, borderRadius: 12, marginBottom: 10,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  img:    { width: '100%', height: '100%' },
  oosTag: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 3, alignItems: 'center',
  },
  oosText:  { fontSize: 10, fontFamily: FONTS.semiBold, color: '#fff' },
  name:     { fontSize: 13, fontFamily: FONTS.semiBold, lineHeight: 18, marginBottom: 2 },
  catText:  { fontSize: 11, fontFamily: FONTS.regular, marginBottom: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  price:    { fontSize: 14, fontFamily: FONTS.bold },
  mrp:      { fontSize: 12, fontFamily: FONTS.regular, textDecorationLine: 'line-through' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, paddingVertical: 8, gap: 4,
  },
  addBtnText: { fontSize: 13, fontFamily: FONTS.bold, color: '#fff' },
  qtyControl: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 12, borderWidth: 1.5, overflow: 'hidden',
  },
  qtyBtn:  { paddingHorizontal: 12, paddingVertical: 8 },
  qtyText: { fontSize: 14, fontFamily: FONTS.bold, minWidth: 24, textAlign: 'center' },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 14, fontFamily: FONTS.regular },
});
