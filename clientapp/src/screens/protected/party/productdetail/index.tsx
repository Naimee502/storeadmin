import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, Image, ScrollView, Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@apollo/client/react';
import { useSelector, useDispatch } from 'react-redux';
import { COLORS, FONTS, useTheme } from '../../../../config';
import { GET_PRODUCTS, GET_ACCOUNT, RESOLVE_PRICE } from '../../../../apollo/queries/accounts';
import { apolloClient } from '../../../../apollo/client';
import { formatINR } from '../../../../utils';
import { BackHeader } from '../../../../components';
import { addToCart, updateQty } from '../../../../store/slices';
import { useShowProductPrice } from '../../../../apollo/hooks/adminsettings';
import type { RootState } from '../../../../store/rootreducer';

const DUMMY_PRODUCT = {
  id: 'dp1',
  name: 'Premium Basmati Rice',
  imageurl: null,
  description: 'Long-grain aromatic basmati rice, aged for 2 years. Perfect for biryani, pulao and everyday cooking. Sourced directly from farms in Dehradun.',
  status: true,
  categoryid: { id: 'c1', categoryname: 'Grains & Cereals' },
  productvariants: [
    {
      id: 'dv1', name: '1 kg', gst: 0, currentstock: 250, unitprices: [
        { mrp: 145, salesrate: 120, offerprice: 0, discount: 0, discounttype: null, quantity: 1, unitid: { id: 'u1', unitname: 'Kg' } },
      ]
    },
    {
      id: 'dv2', name: '5 kg', gst: 0, currentstock: 85, unitprices: [
        { mrp: 680, salesrate: 560, offerprice: 0, discount: 0, discounttype: null, quantity: 5, unitid: { id: 'u1', unitname: 'Kg' } },
      ]
    },
    {
      id: 'dv3', name: '25 kg', gst: 0, currentstock: 12, unitprices: [
        { mrp: 3200, salesrate: 2600, offerprice: 0, discount: 0, discounttype: null, quantity: 25, unitid: { id: 'u1', unitname: 'Kg' } },
      ]
    },
  ],
};

function getUnitLabel(up: any): string {
  const name = up?.unitid?.unitname ?? 'Unit';
  const qty = up?.quantity ?? 1;
  return qty > 1 ? `${qty} × ${name}` : name;
}

function resolveUnitPrice(up: any): number {
  return (up?.offerprice ?? 0) > 0 ? up.offerprice : (up?.salesrate ?? 0);
}

export default function ProductDetail() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const productId = route.params?.productId;

  const { colors, isDark } = useTheme();
  const dispatch = useDispatch();
  const cartItems = useSelector((s: RootState) => s.cart.items);
  const user = useSelector((s: RootState) => s.auth.user);
  const tenant = useSelector((s: RootState) => s.tenant);
  const adminid = tenant.adminId ?? '';

  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const [selectedUnitIdx, setSelectedUnitIdx] = useState(0);
  const showPrice = useShowProductPrice();
  // Auto-fit the hero image to its own aspect ratio (no cropping) instead of
  // forcing every photo into one fixed box shape. Read the real pixel size
  // once the image loads, then size the box to match it exactly, capped so
  // a tall portrait photo doesn't take over the screen.
  //
  // Earlier attempt used CSS `aspectRatio` + `maxHeight` together, which
  // clamps height but leaves width at the parent's full size — the box's
  // shape no longer matched the photo's real ratio, so the image ended up
  // small and pinned to one side with dead space next to it. Fix: compute
  // width AND height together in JS from the same ratio, so the box is
  // always exactly the photo's shape, then center that box horizontally.
  const [imgRatio, setImgRatio] = useState<number | null>(null);
  const cardWidth = Dimensions.get('window').width - 36; // matches scroll's 18px side padding
  const HERO_MAX_H = 320;
  const HERO_MIN_H = 200;
  let imgBoxWidth = cardWidth;
  let imgBoxHeight = 220;
  if (imgRatio) {
    imgBoxHeight = cardWidth / imgRatio;
    if (imgBoxHeight > HERO_MAX_H) {
      imgBoxHeight = HERO_MAX_H;
      imgBoxWidth = imgBoxHeight * imgRatio; // shrink width to match — keeps the box's aspect identical to the photo's
    } else if (imgBoxHeight < HERO_MIN_H) {
      imgBoxHeight = HERO_MIN_H;
      imgBoxWidth = Math.min(cardWidth, imgBoxHeight * imgRatio);
    }
  }

  const { data, loading } = useQuery(GET_PRODUCTS, {
    variables: { adminid, limit: 200 },
    skip: !adminid,
  });

  const { data: accountData } = useQuery(GET_ACCOUNT, {
    variables: { id: user?.id, adminId: adminid },
    skip: !user?.id || !adminid,
  });
  const partyAccount = (accountData as any)?.getAccountById;

  const allProducts = (data as any)?.getProductServices ?? [];
  const fetchedProduct = allProducts.find((p: any) => p.id === productId);
  const product = fetchedProduct ?? DUMMY_PRODUCT;

  // New photo → forget the last one's measured ratio so we don't render it
  // with the wrong box size for a split second before onLoad fires again.
  useEffect(() => { setImgRatio(null); }, [product.imageurl]);

  const variant = product.productvariants?.[selectedVariantIdx];
  const unitprice = variant?.unitprices?.[selectedUnitIdx] ?? variant?.unitprices?.[0];
  const price = resolveUnitPrice(unitprice);
  const mrp = unitprice?.mrp ?? 0;
  const hasMrp = mrp > 0;
  const hasDiscount = hasMrp && mrp > price;
  const discountPct = hasDiscount ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const inStock = (variant?.currentstock ?? 0) > 0;
  const multiUnit = (variant?.unitprices?.length ?? 0) > 1;

  const cartQty = cartItems.find(
    i => i.productId === product.id && i.variantId === variant?.id && i.unitId === unitprice?.unitid?.id,
  )?.qty ?? 0;

  const handleAdd = async () => {
    if (!variant || !unitprice) return;
    let rate = price;
    let disc = unitprice.discount ?? 0;
    if (unitprice.unitid?.id) {
      try {
        const { data: pd } = await apolloClient.query({
          query: RESOLVE_PRICE,
          variables: {
            productid: product.id,
            variantid: variant.id,
            unitid: unitprice.unitid.id,
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
      productId: product.id,
      productName: product.name,
      variantId: variant.id,
      variantName: variant.name,
      unitId: unitprice.unitid?.id,
      unitName: unitprice.unitid?.unitname,
      unitqty: unitprice.quantity ?? 1,
      imageUrl: product.imageurl,
      qty: 1, rate, discount: disc,
      gst: variant.gst ?? 0,
      amount: (rate - disc) * 1,
    }));
  };

  const handleQty = (delta: number) => {
    if (!variant) return;
    dispatch(updateQty({ productId: product.id, variantId: variant.id, unitId: unitprice?.unitid?.id, qty: cartQty + delta }));
  };

  const selectVariant = (idx: number) => {
    setSelectedVariantIdx(idx);
    setSelectedUnitIdx(0);
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
          <View
            style={[
              styles.imgWrap,
              {
                backgroundColor: colors.brandSoft,
                width: imgBoxWidth,
                height: imgBoxHeight,
                alignSelf: 'center', // centers the box itself when it's narrower than the card (capped-height photos)
              },
            ]}
          >
            {product.imageurl
              ? (
                <Image
                  source={{ uri: product.imageurl }}
                  style={styles.img}
                  resizeMode="cover"
                  onLoad={(e) => {
                    const { width, height } = e.nativeEvent?.source ?? {};
                    if (width && height) setImgRatio(width / height);
                  }}
                />
              )
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
          {product.categoryid?.categoryname && (
            <Text style={[styles.category, { color: colors.brand }]}>{product.categoryid.categoryname}</Text>
          )}
          <Text style={[styles.productName, { color: colors.text }]}>{product.name}</Text>

          {showPrice && (
            <View style={styles.priceRow}>
              <Text style={[styles.price, { color: colors.brand }]}>{formatINR(price)}</Text>
              {hasMrp && (
                <Text style={[styles.mrp, { color: colors.subText }]}>{formatINR(mrp)}</Text>
              )}
              {hasDiscount && (
                <View style={[styles.discountBadge, { backgroundColor: '#22c55e22' }]}>
                  <Text style={[styles.discountText, { color: '#16a34a' }]}>{discountPct}% OFF</Text>
                </View>
              )}
            </View>
          )}

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

        {/* Variants (Pack Size) */}
        {(product.productvariants?.length ?? 0) > 1 && (
          <Animated.View entering={FadeInUp.duration(400).delay(120)}
            style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>Pack Size</Text>
            <View style={styles.chipRow}>
              {product.productvariants.map((v: any, i: number) => {
                const active = i === selectedVariantIdx;
                const vUp = v.unitprices?.[0];
                const vPrice = resolveUnitPrice(vUp);
                return (
                  <TouchableOpacity
                    key={v.id}
                    style={[styles.variantChip, active
                      ? { backgroundColor: colors.brand, borderColor: colors.brand }
                      : { backgroundColor: colors.raisedSurface, borderColor: colors.border },
                    ]}
                    onPress={() => selectVariant(i)}
                  >
                    <Text style={[styles.variantChipText, { color: active ? '#fff' : colors.text }]}>{v.name}</Text>
                    {showPrice && (
                      <Text style={[styles.variantPrice, { color: active ? 'rgba(255,255,255,0.8)' : colors.subText }]}>
                        {formatINR(vPrice)}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* Unit selection */}
        {multiUnit && (
          <Animated.View entering={FadeInUp.duration(400).delay(140)}
            style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>Unit</Text>
            <View style={styles.chipRow}>
              {variant.unitprices.map((up: any, i: number) => {
                const active = i === selectedUnitIdx;
                const uPrice = resolveUnitPrice(up);
                const uMrp = up?.mrp ?? 0;
                const uHasDisc = uMrp > 0 && uMrp > uPrice;
                return (
                  <TouchableOpacity
                    key={`${up.unitid?.id ?? i}-${up.quantity ?? i}`}
                    style={[styles.unitChip, active
                      ? { backgroundColor: colors.brand, borderColor: colors.brand }
                      : { backgroundColor: colors.raisedSurface, borderColor: colors.border },
                    ]}
                    onPress={() => setSelectedUnitIdx(i)}
                  >
                    <Text style={[styles.unitChipLabel, { color: active ? '#fff' : colors.text }]}>
                      {getUnitLabel(up)}
                    </Text>
                    {showPrice && (
                      <Text style={[styles.unitChipPrice, { color: active ? 'rgba(255,255,255,0.8)' : colors.brand }]}>
                        {formatINR(uPrice)}
                      </Text>
                    )}
                    {showPrice && uHasDisc && (
                      <Text style={[styles.unitChipMrp, { color: active ? 'rgba(255,255,255,0.55)' : colors.subText }]}>
                        {formatINR(uMrp)}
                      </Text>
                    )}
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
            <TouchableOpacity
              style={[styles.addCartBtn, { backgroundColor: inStock ? colors.brand : colors.border }]}
              onPress={handleAdd}
              disabled={!inStock}
              activeOpacity={0.85}
            >
              <Icon name="cart-plus" size={18} color="#fff" />
              <Text style={styles.addCartText}>{inStock ? 'Add to Cart' : 'Out of Stock'}</Text>
            </TouchableOpacity>
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
            <TouchableOpacity
              style={[styles.goCartBtn, { borderColor: colors.brand }]}
              onPress={() => navigation.navigate('CartScreen')}
              activeOpacity={0.8}
            >
              <Icon name="cart-outline" size={16} color={colors.brand} />
              <Text style={[styles.goCartText, { color: colors.brand }]}>Go to Cart</Text>
            </TouchableOpacity>
          )}
        </Animated.View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 18, paddingBottom: 24 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, fontFamily: FONTS.regular },

  imgCard: {
    borderRadius: 24, borderWidth: 1, overflow: 'hidden', marginTop: 14, marginBottom: 16,
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2,
  },
  imgWrap: { height: 200, justifyContent: 'center', alignItems: 'center' },
  img: { ...StyleSheet.absoluteFillObject },
  oosOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 8, alignItems: 'center',
  },
  oosText: { fontSize: 13, fontFamily: FONTS.bold, color: '#fff' },

  infoBlock: { marginBottom: 14 },
  category: { fontSize: 12, fontFamily: FONTS.semiBold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  productName: { fontSize: 20, fontFamily: FONTS.bold, lineHeight: 28, marginBottom: 10 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  price: { fontSize: 22, fontFamily: FONTS.bold },
  mrp: { fontSize: 15, fontFamily: FONTS.regular, textDecorationLine: 'line-through' },
  discountBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  discountText: { fontSize: 12, fontFamily: FONTS.bold },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stockText: { fontSize: 12, fontFamily: FONTS.semiBold },

  card: {
    borderRadius: 20, borderWidth: 1, padding: 16, marginBottom: 12,
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  cardTitle: { fontSize: 14, fontFamily: FONTS.bold, marginBottom: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  variantChip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5,
    alignItems: 'center', minWidth: 80,
  },
  variantChipText: { fontSize: 13, fontFamily: FONTS.bold, marginBottom: 2 },
  variantPrice: { fontSize: 11, fontFamily: FONTS.regular },

  unitChip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5,
    alignItems: 'center', minWidth: 80,
  },
  unitChipLabel: { fontSize: 13, fontFamily: FONTS.bold, marginBottom: 2 },
  unitChipPrice: { fontSize: 12, fontFamily: FONTS.semiBold },
  unitChipMrp: { fontSize: 10, fontFamily: FONTS.regular, textDecorationLine: 'line-through' },

  description: { fontSize: 13, fontFamily: FONTS.regular, lineHeight: 20 },

  cartControlWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  cartBtn: { width: 48, height: 48, borderRadius: 14, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  cartQtyBox: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 14, alignItems: 'center' },
  cartQtyText: { fontSize: 18, fontFamily: FONTS.bold, color: '#fff' },
  cartQtyLabel: { fontSize: 10, fontFamily: FONTS.semiBold, color: 'rgba(255,255,255,0.8)' },
  addCartBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 52, borderRadius: 16,
  },
  addCartText: { fontSize: 16, fontFamily: FONTS.bold, color: '#fff' },
  goCartBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 48, borderRadius: 16, borderWidth: 1.5, marginTop: 10,
  },
  goCartText: { fontSize: 15, fontFamily: FONTS.bold },
});
