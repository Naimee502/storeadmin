import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TextInput,
  TouchableOpacity,
  Dimensions,
  Modal,
  TouchableWithoutFeedback,
  StatusBar,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Animated, {
  FadeInDown,
  FadeInUp,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { AppHeader } from '../../../components';
import { COLORS, STRINGS, FONTS, useTheme } from '../../../config';
import { useUI } from '../../../utils';
import { DynamicFlashList } from '../../../components/flashlist';

const { width } = Dimensions.get('window');

// Premium high-quality monochrome mock products
const MOCK_PRODUCTS = [
  {
    id: '1',
    name: 'Organic Honey',
    category: 'Groceries',
    price: 12.99,
    rating: 4.8,
    image: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: '2',
    name: 'Fresh Strawberries',
    category: 'Groceries',
    price: 5.49,
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: '3',
    name: 'Gluten-Free Oats',
    category: 'Groceries',
    price: 7.99,
    rating: 4.6,
    image: 'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: '4',
    name: 'Smart Watch V2',
    category: 'Electronics',
    price: 199.99,
    rating: 4.7,
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: '5',
    name: 'Wireless Earbuds',
    category: 'Electronics',
    price: 89.99,
    rating: 4.5,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: '6',
    name: 'Cotton T-Shirt',
    category: 'Apparel',
    price: 24.99,
    rating: 4.4,
    image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: '7',
    name: 'Premium Hoodie',
    category: 'Apparel',
    price: 59.99,
    rating: 4.8,
    image: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: '8',
    name: 'Matte Lipstick',
    category: 'Cosmetics',
    price: 18.50,
    rating: 4.6,
    image: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: '9',
    name: 'Hydrating Serum',
    category: 'Cosmetics',
    price: 34.00,
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1608248597481-496100c80836?auto=format&fit=crop&w=400&q=80',
  },
];

const CATEGORIES = ['All', 'Groceries', 'Electronics', 'Apparel', 'Cosmetics'];

const PROMOTIONS = [
  {
    id: 'p1',
    title: 'Minimalist Harvest',
    subtitle: 'Pure Organic Groceries up to 30% OFF',
    image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'p2',
    title: 'Monochrome Tech',
    subtitle: 'Clean & premium sound experience',
    image: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=800&q=80',
  },
];

export default function Home() {
  const { colors, isDark } = useTheme();
  const sText = STRINGS.storefront;
  const { showToast } = useUI();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [products, setProducts] = useState(MOCK_PRODUCTS);
  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [activeBanner, setActiveBanner] = useState(0);
  const dealScale = useSharedValue(1);

  // Filters State
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterCategory, setFilterCategory] = useState('All');
  const [sortBy, setSortBy] = useState('none');

  // Apply filters and searches
  useEffect(() => {
    let filtered = MOCK_PRODUCTS.filter((product) => {
      const matchSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory = selectedCategory === 'All' || product.category === selectedCategory;
      return matchSearch && matchCategory;
    });

    if (sortBy === 'lowToHigh') {
      filtered.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'highToLow') {
      filtered.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    setProducts(filtered);
  }, [searchQuery, selectedCategory, sortBy]);

  useEffect(() => {
    dealScale.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 900 }),
        withTiming(1, { duration: 900 })
      ),
      -1,
      true
    );
  }, [dealScale]);

  const dealAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dealScale.value }],
  }));

  const handleAddToCart = useCallback((productName: string) => {
    setCartCount((prev) => prev + 1);
    showToast(`Added ${productName} to cart`, 'success');
  }, [showToast]);

  const handleToggleWishlist = useCallback((productName: string) => {
    setWishlistCount((prev) => prev + 1);
    showToast(`Added ${productName} to wishlist`, 'success');
  }, [showToast]);

  const applyBottomSheetFilters = () => {
    setSelectedCategory(filterCategory);
    setFilterVisible(false);
    showToast('Filters applied successfully', 'success');
  };

  const resetFilters = () => {
    setFilterCategory('All');
    setSortBy('none');
    setSelectedCategory('All');
    setFilterVisible(false);
    showToast('Filters cleared', 'success');
  };

  const rightIcons = [
    {
      id: 'wishlist',
      name: 'heart-outline',
      badge: wishlistCount,
      size: 26,
      onPress: () => showToast(sText.wishlistComingSoon, 'success'),
    },
    {
      id: 'cart',
      name: 'shopping-cart-outline',
      badge: cartCount,
      size: 26,
      onPress: () => showToast(sText.checkoutComingSoon, 'success'),
    },
  ];

  const visibleProducts = useMemo(
    () => products.slice(0, 4),
    [products],
  );

  const renderProductItem = useCallback(
    ({ item, index }: { item: any; index: number }) => {
      const cardStyle = [
        styles.productCard,
        {
          backgroundColor: colors.cardGlass,
          borderColor: colors.border,
          marginBottom: 12,
          marginHorizontal: 6,
        },
      ];

      const wishlistStyle = [
        styles.wishlistIcon,
        {
          backgroundColor: colors.iconOverlay,
        },
      ];

      const imageStyle = [
        styles.productImage,
        isDark && { opacity: 0.85 },
      ];

      return (
        <Animated.View
          entering={FadeInDown.duration(400).delay(index * 50)}
          layout={Layout.springify()}
          style={cardStyle}
        >
          <TouchableOpacity
            style={wishlistStyle}
            onPress={() => handleToggleWishlist(item.name)}
          >
            <Icon
              name="heart-outline"
              size={19}
              color={colors.brand}
            />
          </TouchableOpacity>

          <FastImage
            source={{ uri: item.image }}
            style={imageStyle}
            resizeMode={FastImage.resizeMode.cover}
          />

          <View style={styles.productDetails}>
            <Text
              style={[
                styles.productCategory,
                { color: colors.subText },
              ]}
            >
              {item.category}
            </Text>

            <Text
              numberOfLines={1}
              style={[
                styles.productName,
                { color: colors.text },
              ]}
            >
              {item.name}
            </Text>

            <View style={styles.ratingRow}>
              <Icon
                name="star"
                size={14}
                color={colors.rating}
              />

              <Text
                style={[
                  styles.ratingText,
                  { color: colors.text },
                ]}
              >
                {item.rating}
              </Text>
            </View>

            <View style={styles.priceRow}>
              <Text
                style={[
                  styles.productPrice,
                  { color: colors.text },
                ]}
              >
                ${item.price.toFixed(2)}
              </Text>

              <TouchableOpacity
                style={styles.addButton}
                onPress={() => handleAddToCart(item.name)}
              >
                <Icon
                  name="plus"
                  size={20}
                  color={colors.onBrand}
                />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      );
    },
    [
      colors.cardGlass,
      colors.border,
      colors.iconOverlay,
      colors.brand,
      colors.subText,
      colors.text,
      colors.rating,
      colors.onBrand,
      isDark,
      handleToggleWishlist,
      handleAddToCart,
    ],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />

      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />
      <View style={[styles.glow, styles.glowOne]} />
      <View style={[styles.glow, styles.glowTwo]} />

      <AppHeader label="FreshCart" rightIcons={rightIcons} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Animated.View entering={FadeInUp.duration(600)} style={[styles.locationCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
          <View style={[styles.locationIconWrap, { backgroundColor: colors.brandSoft }]}>
            <Icon name="map-marker" size={22} color={colors.brand} />
          </View>
          <View style={styles.locationTextWrap}>
            <Text style={[styles.locationLabel, { color: colors.subText }]}>Deliver to</Text>
            <Text style={[styles.locationTitle, { color: colors.text }]} numberOfLines={1}>Home - 221B Market Street</Text>
          </View>
          <Icon name="chevron-down" size={22} color={colors.subText} />
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(600).delay(80)} style={styles.quickInfoRow}>
          <View style={[styles.quickPill, { backgroundColor: colors.brandSoft }]}>
            <Icon name="clock-fast" size={16} color={colors.brand} />
            <Text style={[styles.quickText, { color: colors.brand }]}>18 min</Text>
          </View>
          <View style={[styles.quickPill, { backgroundColor: colors.raisedSurface, borderColor: colors.border }]}>
            <Icon name="truck-delivery-outline" size={16} color={colors.brand} />
            <Text style={[styles.quickText, { color: colors.text }]}>Free delivery</Text>
          </View>
          <Animated.View style={[styles.quickPill, styles.dealPill, { backgroundColor: colors.brand }, dealAnimatedStyle]}>
            <Icon name="brightness-percent" size={16} color={colors.onBrand} />
            <Text style={[styles.quickText, { color: colors.onBrand }]}>30% OFF</Text>
          </Animated.View>
        </Animated.View>

        {/* Search & Filter Trigger */}
        <Animated.View entering={FadeInUp.duration(600).delay(100)} style={styles.searchRow}>
          <View style={[styles.searchBar, { backgroundColor: colors.raisedSurface, borderColor: colors.border }]}>
            <Icon name="magnify" size={22} color={colors.subText} style={styles.searchIcon} />
            <TextInput
              placeholder={sText.searchPlaceholder}
              placeholderTextColor={colors.placeholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={[styles.searchInput, { color: colors.text }]}
            />
          </View>
          <TouchableOpacity
            onPress={() => {
              setFilterCategory(selectedCategory);
              setFilterVisible(true);
            }}
            style={styles.filterButton}
          >
            <Icon name="tune" size={22} color={colors.onBrand} />
          </TouchableOpacity>
        </Animated.View>

        {/* Promo Slider Banner */}
        <Animated.View entering={FadeInUp.duration(800).delay(200)} style={styles.promoContainer}>
          <FlatList
            data={PROMOTIONS}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / (width - 40));
              setActiveBanner(index);
            }}
            renderItem={({ item }) => (
              <View style={[styles.promoSlide, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <FastImage
                  source={{ uri: item.image }}
                  style={StyleSheet.absoluteFillObject}
                  resizeMode={FastImage.resizeMode.cover}
                />
                <View style={styles.promoOverlay} />
                <View style={styles.promoTextContent}>
                  <Text style={styles.promoTitle}>{item.title}</Text>
                  <Text style={styles.promoSubtitle}>{item.subtitle}</Text>
                </View>
              </View>
            )}
            keyExtractor={(item) => item.id}
          />
          <View style={styles.bannerDots}>
            {PROMOTIONS.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.bannerDot,
                  { backgroundColor: activeBanner === index ? colors.onBrand : colors.whiteOverlay },
                ]}
              />
            ))}
          </View>
        </Animated.View>

        {/* Horizontal Category Selectors */}
        <Animated.View entering={FadeInUp.duration(800).delay(300)} style={styles.categoriesContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll}>
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setSelectedCategory(cat)}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: isSelected ? colors.brand : colors.raisedSurface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      { color: isSelected ? colors.onBrand : colors.text },
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* Dynamic Products Grid */}
        <View style={styles.productsGridHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{sText.catalogTitle}</Text>
          <Text style={[styles.resultsText, { color: colors.brand }]}>View all</Text>
        </View>

        {products.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="dropbox" size={60} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.subText }]}>{sText.noItems}</Text>
          </View>
        ) : (
          <DynamicFlashList
            data={visibleProducts}
            renderItem={renderProductItem}
            keyExtractor={(item) => item.id}
            estimatedItemSize={260}
            numColumns={2}
            scrollEnabled={false}
            contentContainerStyle={styles.gridContent}
          />
        )}
      </ScrollView>

      {/* Dynamic Slide-Up Filter Modal */}
      <Modal
        visible={filterVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setFilterVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalSheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />

                <Text style={[styles.modalTitle, { color: colors.text }]}>{sText.sortFilters}</Text>

                {/* Categories filter */}
                <Text style={[styles.filterLabel, { color: colors.text }]}>{sText.selectCategory}</Text>
                <View style={styles.filterChipRow}>
                  {CATEGORIES.map((cat) => {
                    const isSel = filterCategory === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        onPress={() => setFilterCategory(cat)}
                        style={[
                          styles.filterChip,
                          {
                            backgroundColor: isSel ? colors.brand : colors.secondary,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Text style={[styles.filterChipText, { color: isSel ? colors.onBrand : colors.text }]}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Sorting options */}
                <Text style={[styles.filterLabel, { color: colors.text }]}>{sText.sortBy}</Text>
                <View style={styles.sortOptionsRow}>
                  {[
                    { key: 'none', label: sText.defaultSort },
                    { key: 'name', label: sText.alphabeticalSort },
                    { key: 'lowToHigh', label: sText.lowToHighSort },
                    { key: 'highToLow', label: sText.highToLowSort },
                  ].map((option) => {
                    const isSel = sortBy === option.key;
                    return (
                      <TouchableOpacity
                        key={option.key}
                        onPress={() => setSortBy(option.key)}
                        style={[
                          styles.sortOptionButton,
                          {
                            backgroundColor: isSel ? colors.brand : colors.secondary,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Text style={[styles.sortOptionText, { color: isSel ? colors.onBrand : colors.text }]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Bottom modal actions */}
                <View style={styles.modalActionsRow}>
                  <TouchableOpacity
                    onPress={resetFilters}
                    style={[styles.actionBtn, styles.resetBtn, { borderColor: colors.border }]}
                  >
                    <Text style={[styles.actionBtnText, { color: colors.text }]}>{sText.reset}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={applyBottomSheetFilters}
                    style={[styles.actionBtn, styles.applyBtn]}
                  >
                    <Text style={[styles.actionBtnText, { color: COLORS.light.onBrand }]}>{sText.applyFilters}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 104,
  },
  glow: {
    position: 'absolute',
    width: '120%',
    height: 210,
    opacity: 1,
  },
  glowOne: {
    backgroundColor: COLORS.light.brandSoft,
    top: -76,
    right: -34,
    borderBottomLeftRadius: 120,
    transform: [{ rotate: '-7deg' }],
  },
  glowTwo: {
    backgroundColor: COLORS.light.warmSoft,
    top: 286,
    left: -48,
    height: 150,
    borderTopRightRadius: 110,
    transform: [{ rotate: '-8deg' }],
  },
  locationCard: {
    marginHorizontal: 20,
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 20,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationTextWrap: {
    flex: 1,
    marginLeft: 10,
  },
  locationLabel: {
    fontSize: 11,
    fontFamily: FONTS.medium,
  },
  locationTitle: {
    fontSize: 15,
    fontFamily: FONTS.bold,
    marginTop: 2,
  },
  quickInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 10,
    gap: 8,
  },
  quickPill: {
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.light.transparent,
  },
  dealPill: {
    marginLeft: 'auto',
    borderWidth: 0,
  },
  quickText: {
    fontSize: 12,
    fontFamily: FONTS.bold,
    marginLeft: 5,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 12,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONTS.regular,
    padding: 0,
  },
  filterButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.light.brand,
    shadowColor: COLORS.light.brand,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 5,
  },
  promoContainer: {
    marginHorizontal: 20,
    marginTop: 14,
    height: 142,
    borderRadius: 22,
    overflow: 'hidden',
    position: 'relative',
  },
  promoSlide: {
    width: width - 40,
    height: 142,
    borderRadius: 22,
    overflow: 'hidden',
  },
  promoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.light.heroOverlay,
  },
  promoTextContent: {
    position: 'absolute',
    bottom: 18,
    left: 18,
    right: 18,
  },
  promoTitle: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: COLORS.light.onBrand,
    marginBottom: 4,
  },
  promoSubtitle: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.light.whiteOverlay,
  },
  bannerDots: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  bannerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  categoriesContainer: {
    marginTop: 14,
  },
  categoriesScroll: {
    paddingHorizontal: 20,
    gap: 10,
  },
  categoryChip: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
  },
  productsGridHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 18,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: FONTS.bold,
  },
  resultsText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  gridContent: {
    paddingHorizontal: 14,
    paddingBottom: 20,
  },
  productCard: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    padding: 12,
    position: 'relative',

    marginBottom: 12,
    marginHorizontal: 6,

    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  wishlistIcon: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productImage: {
    width: '100%',
    height: 96,
    borderRadius: 16,
    marginBottom: 8,
  },
  productDetails: {
    flex: 1,
  },
  productCategory: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  productName: {
    fontSize: 15,
    fontFamily: FONTS.bold,
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  ratingText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
  },
  productPrice: {
    fontSize: 16,
    fontFamily: FONTS.bold,
  },
  addButton: {
    width: 34,
    height: 34,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.light.brand,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: FONTS.medium,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.light.dimOverlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderTopWidth: 1.5,
    padding: 24,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: FONTS.bold,
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    marginBottom: 12,
    marginTop: 10,
  },
  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 15,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
  },
  sortOptionsRow: {
    flexDirection: 'column',
    gap: 8,
    marginBottom: 25,
  },
  sortOptionButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  sortOptionText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    height: 50,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetBtn: {
    borderWidth: 1,
  },
  applyBtn: {
    backgroundColor: COLORS.light.brand,
  },
  actionBtnText: {
    fontSize: 16,
    fontFamily: FONTS.bold,
  },
});
