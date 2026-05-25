import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, Image, ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@apollo/client/react';
import { useSelector, useDispatch } from 'react-redux';
import { COLORS, FONTS, useTheme } from '../../../../config';
import { GET_PRODUCTS } from '../../../../apollo/queries/party';
import { formatINR } from '../../../../utils';
import { BackHeader, AppButton } from '../../../../components';
import { addToCart, updateQty } from '../../../../store/slices';
import type { RootState } from '../../../../store/rootreducer';

const DUMMY_PRODUCT = {
  id: 'dp1',
  name: 'Premium Basmati Rice',
  imageurl: null,
  description: 'Long-grain aromatic basmati rice, aged for 2 years. Perfect for biryani, pulao and everyday cooking. Sourced directly from farms in Dehradun.',
  status: true,
  categoryid: { id: 'c1', name: 'Grains & Cereals' },
  variants: [
    { id: 'dv1', name: '1 kg',  currentstock: 250, unitprices: [{ salesrate: 120, mrp: 145,  offerprice: 0 }] },
    { id: 'dv2', name: '5 kg',  currentstock: 85,  unitprices: [{ salesrate: 560, mrp: 680,  offerprice: 0 }] },
    { id: 'dv3', name: '25 kg', currentstock: 12,  unitprices: [{ salesrate: 2600, mrp: 3200, offerprice: 0 }] },
  ],
};

export default function ProductDetail() {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const productId  = route.params?.productId;

  const { colors, isDark } = useTheme();
  const dispatch   = useDispatch();
  const cartItems  = useSelector((s: RootState) => s.cart.items);
  const tenant     = useSelector((s: RootState) => s.tenant);
  const adminid    = tenant.adminId ?? '';

  const { data, loading } = useQuery(GET_PRODUCTS, {
    variables: { adminid, limit: 200 },
    skip: !adminid,
  });

  const allProducts = (data?.getProductServices ?? []) as any[];
  const fetchedProduct = allProducts.find((p: any) => p.id === productId);
  const product = fetchedProduct ?? DUMMY_PRODUCT;

  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const variant   = product.variants?.[selectedVariantIdx];
  const price     = variant?.unitprices?.[0]?.salesrate ?? 0;
  const mrp       = variant?.unitprices?.[0]?.mrp ?? 0;
  const hasDiscount = mrp > 0 && mrp > price;
  const discountPct = hasDiscount ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const inStock   = (variant?.currentstock ?? 0) > 0;

  const cartQty = cartItems.find(
    i => i.productId === product.id && i.variantId === variant?.id,
  )?.qty ?? 0;

  const handleAdd = () => {
    if (!variant) return;
    dispatch(addToCart({
      productId:   product.id,
      productName: product.name,
      variantId:   variant.id,
      variantName: variant.name,
      imageUrl:    product.imageurl,
      qty: 1, rate: price, gst: 0, amount: price,
    }));
  };

  const handleQty = (delta: number) => {
    if (!variant) return;
    dispatch(updateQty({ productId: product.id, variantId: variant.id, qty: cartQty + delta }));
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />
        <BackHeader label="Product" />
        <View style={styles.loadingWrap}>
          <Icon name="package-variant-closed" size={48} color={colors.border} />
          <Text style={[styles.loadingText, { color: colors.subText }]}>Loading product…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

      <BackHeader label={product.name} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Product image */}
        <Animated.View entering={FadeInUp.duration(400).delay(40)} style={[styles.imgCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
          <View style={[styles.imgWrap, { backgroundColor: colors.brandSoft }]}>
            {product.imageurl
              ? <Image source={{ uri: product.imageurl }} style={styles.img} resizeMode="cover" />
              : <Icon name="package-variant-closed" size={72} color={colors.brand} />
            }
          </View>
          {!inStock && (
            <View style={styles.oosOverlay}>
              <Text style={styles.oosText}>Out of Stock</Text>
            </View>
          )}
        </Animated.View>

        {/* Name + category + price */}
        <Animated.View entering={FadeInUp.duration(400).delay(80)} style={styles.infoBlock}>
          {product.categoryid?.name && (
            <Text style={[styles.category, { color: colors.brand }]}>{product.categoryid.name}</Text>
          )}
          <Text style={[styles.productName, { color: colors.text }]}>{product.name}</Text>

          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: colors.brand }]}>{formatINR(price)}</Text>
            {hasDiscount && (
              <>
                <Text style={[styles.mrp, { color: colors.subText }]}>{formatINR(mrp)}</Text>
                <View style={[styles.discountBadge, { backgroundColor: '#22c55e22' }]}>
                  <Text style={[styles.discountText, { color: '#16a34a' }]}>{discountPct}% OFF</Text>
                </View>
              </>
            )}
          </View>

          <View style={styles.stockRow}>
            <Icon
              name={inStock ? 'check-circle-outline' : 'close-circle-outline'}
              size={14}
              color={inStock ? '#22c55e' : '#ef4444'}
            />
            <Text style={[styles.stockText, { color: inStock ? '#22c55e' : '#ef4444' }]}>
              {inStock ? `In stock (${variant?.currentstock ?? 0} units)` : 'Out of stock'}
            </Text>
          </View>
        </Animated.View>

        {/* Variants */}
        {product.variants?.length > 1 && (
          <Animated.View entering={FadeInUp.duration(400).delay(120)}
            style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>Pack Size</Text>
            <View style={styles.variantRow}>
              {product.variants.map((v: any, i: number) => {
                const active = i === selectedVariantIdx;
                return (
                  <TouchableOpacity
                    key={v.id}
                    style={[styles.variantChip, active
                      ? { backgroundColor: colors.brand,         borderColor: colors.brand }
                      : { backgroundColor: colors.raisedSurface, borderColor: colors.border },
                    ]}
                    onPress={() => setSelectedVariantIdx(i)}
                  >
                    <Text style={[styles.variantChipText, { color: active ? '#fff' : colors.text }]}>{v.name}</Text>
                    <Text style={[styles.variantPrice, { color: active ? 'rgba(255,255,255,0.8)' : colors.subText }]}>
                      {formatINR(v.unitprices?.[0]?.salesrate ?? 0)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* Description */}
        {product.description && (
          <Animated.View entering={FadeInUp.duration(400).delay(160)}
            style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>Description</Text>
            <Text style={[styles.description, { color: colors.subText }]}>{product.description}</Text>
          </Animated.View>
        )}

        {/* Add to cart */}
        <Animated.View entering={FadeInUp.duration(400).delay(200)} style={{ marginTop: 4, marginBottom: 32 }}>
          {cartQty === 0 ? (
            <AppButton
              title={inStock ? 'Add to Cart' : 'Out of Stock'}
              onPress={handleAdd}
              disabled={!inStock}
            />
          ) : (
            <View style={styles.cartControlWrap}>
              <TouchableOpacity
                style={[styles.cartBtn, { backgroundColor: colors.brandSoft, borderColor: colors.brand }]}
                onPress={() => handleQty(-1)}
              >
                <Icon name="minus" size={18} color={colors.brand} />
              </TouchableOpacity>
              <View style={[styles.cartQtyBox, { backgroundColor: colors.brand }]}>
                <Text style={styles.cartQtyText}>{cartQty}</Text>
                <Text style={styles.cartQtyLabel}>in cart</Text>
              </View>
              <TouchableOpacity
                style={[styles.cartBtn, { backgroundColor: colors.brandSoft, borderColor: colors.brand }]}
                onPress={() => handleQty(1)}
              >
                <Icon name="plus" size={18} color={colors.brand} />
              </TouchableOpacity>
            </View>
          )}
          {cartQty > 0 && (
            <AppButton
              title="Go to Cart"
              variant="outline"
              onPress={() => navigation.navigate('CartScreen')}
              style={{ marginTop: 10 }}
            />
          )}
        </Animated.View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  scroll:      { paddingHorizontal: 18, paddingBottom: 24 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, fontFamily: FONTS.regular },

  imgCard: {
    borderRadius: 24, borderWidth: 1, overflow: 'hidden', marginTop: 14, marginBottom: 16,
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2,
  },
  imgWrap: { height: 200, justifyContent: 'center', alignItems: 'center' },
  img:     { width: '100%', height: '100%' },
  oosOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 8, alignItems: 'center',
  },
  oosText: { fontSize: 13, fontFamily: FONTS.bold, color: '#fff' },

  infoBlock: { marginBottom: 14 },
  category:  { fontSize: 12, fontFamily: FONTS.semiBold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  productName: { fontSize: 20, fontFamily: FONTS.bold, lineHeight: 28, marginBottom: 10 },
  priceRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  price:     { fontSize: 22, fontFamily: FONTS.bold },
  mrp:       { fontSize: 15, fontFamily: FONTS.regular, textDecorationLine: 'line-through' },
  discountBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  discountText:  { fontSize: 12, fontFamily: FONTS.bold },
  stockRow:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stockText: { fontSize: 12, fontFamily: FONTS.semiBold },

  card: {
    borderRadius: 20, borderWidth: 1, padding: 16, marginBottom: 12,
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  cardTitle:   { fontSize: 14, fontFamily: FONTS.bold, marginBottom: 12 },
  variantRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  variantChip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5,
    alignItems: 'center', minWidth: 80,
  },
  variantChipText: { fontSize: 13, fontFamily: FONTS.bold, marginBottom: 2 },
  variantPrice:    { fontSize: 11, fontFamily: FONTS.regular },
  description: { fontSize: 13, fontFamily: FONTS.regular, lineHeight: 20 },

  cartControlWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  cartBtn: { width: 48, height: 48, borderRadius: 14, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  cartQtyBox: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 14, alignItems: 'center' },
  cartQtyText:  { fontSize: 18, fontFamily: FONTS.bold, color: '#fff' },
  cartQtyLabel: { fontSize: 10, fontFamily: FONTS.semiBold, color: 'rgba(255,255,255,0.8)' },
});
