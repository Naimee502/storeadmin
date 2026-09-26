import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { FONTS, STRINGS, useTheme } from '../../../../config';
import { GET_CATEGORIES } from '../../../../apollo/queries/categories';
import { AppHeader, AppTextInput, AppTour, CategoryStrip, ProductCatalog, tourRef, useNotificationCenter } from '../../../../components';
import type { CategoryItem, TourStep } from '../../../../components';
import { HomeBanner } from './homebanner';
import type { RootState } from '../../../../store/rootreducer';

/**
 * Home — the same catalogue Shop shows, with the same component showing it.
 *
 * The listing is deliberately insulated from everything else on this screen.
 * Home carries what Shop does not: a notification bell that polls, a cart badge,
 * and for a trade party an outstanding balance and recent orders that refetch
 * whenever the screen comes back to the foreground. Each of those used to
 * re-render Home and, with it, the grid — rebuilt underneath the user while its
 * pictures were still arriving.
 *
 * Two things keep them apart now. ProductCatalog is memoised, so it re-renders
 * only when the search term or the category changes. And the trade figures live
 * in TradeOverview, which owns its own queries and is built here exactly once,
 * so neither its results nor its refetches reach the grid at all.
 */
// First-time guide for a party's Home — shown once per party on this device.
const HOME_TOUR: TourStep[] = [
  { target: 'party-menu',     title: 'Menu',          text: 'Open your profile, ledger, addresses and other options from here.' },
  { target: 'party-search',   title: 'Search',        text: 'Type a product name to find it quickly.' },
  { target: 'party-bell',     title: 'Notifications', text: 'Order updates, payment reminders and offers show up here.' },
  { target: 'party-cart',     title: 'Cart',          text: 'Everything you add lands here. Tap to review and place your order.' },
  { target: 'party-category', title: 'Categories',    text: 'Pick a category to see only those products.' },
  { target: 'tabbar',         title: 'Get Around',    text: 'Jump between your main screens — Home, Shop, Orders and more — from here.' },
];

export default function PartyHome() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const { bellIcon, NotificationsModal } = useNotificationCenter();
  const cartItems = useSelector((s: RootState) => s.cart.items);
  const cartCount = cartItems.reduce((sum, i) => sum + i.qty, 0);
  const adminid = useSelector((s: RootState) => s.tenant.adminId) ?? '';
  const userId = useSelector((s: RootState) => s.auth.user?.id) ?? '';

  // Every party, whatever its channel, gets the same storefront: search,
  // banner, categories, catalogue. No outstanding/pending cards or recent orders.

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);

  const { data: categoriesData } = useQuery(GET_CATEGORIES, {
    variables: { adminId: adminid },
    skip: !adminid,
  });
  const categories = useMemo<CategoryItem[]>(
    () => (((categoriesData as any)?.getCategories ?? []) as any[])
      .filter((c: any) => c && c.status !== false)
      .map((c: any) => ({ id: c.id, name: c.categoryname, image: c.image })),
    [categoriesData],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

      <AppHeader
        label={STRINGS.party.home}
        menuTourId="party-menu"
        rightIcons={[
          { ...bellIcon, tourId: 'party-bell' },
          {
            id: 'cart', tourId: 'party-cart', name: 'cart-outline', color: colors.brand, badge: cartCount,
            onPress: () => navigation.navigate('CartScreen'),
          },
        ]}
      />
      {NotificationsModal}

      {/* Search and categories sit above the grid, exactly as on Shop, so
          neither unmounts while the catalogue reloads underneath. */}
      <View style={styles.headerWrap}>
        <View ref={tourRef('party-search')} collapsable={false}>
        <AppTextInput
          leftIcon="magnify"
          placeholder={STRINGS.storefront.searchPlaceholder}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          placeholderTextColor={colors.subText}
          containerStyle={{ marginBottom: 8, marginTop: 10 }}
        />
        </View>
        <HomeBanner />

        <View ref={tourRef('party-category')} collapsable={false}>
          <CategoryStrip
            categories={categories}
            selected={category}
            onSelect={setCategory}
            contentContainerStyle={{ paddingTop: 0, paddingBottom: 8 }}
          />
        </View>
      </View>

      <ProductCatalog search={search} category={category} />

      {/* Categories arrive from the server — wait for the query so that step
          has something to point at (a business with none just skips it). */}
      <AppTour
        steps={HOME_TOUR}
        storageKey={`tour.partyHome.${userId}`}
        enabled={!!userId && !!categoriesData}
      />

      {cartCount > 0 && (
        <TouchableOpacity
          style={[styles.cartBar, { backgroundColor: colors.brand }]}
          onPress={() => navigation.navigate('CartScreen')}
          activeOpacity={0.9}
        >
          <View style={[styles.cartBadge, { backgroundColor: colors.onBrand + '40' }]}>
            <Text style={[styles.cartBadgeText, { color: colors.onBrand }]}>{cartCount}</Text>
          </View>
          <Text style={[styles.cartBarText, { color: colors.onBrand }]}>View Cart</Text>
          <Icon name="chevron-right" size={18} color={colors.onBrand} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // Matches the grid's own horizontal padding so the search box and the
  // category strip line up with the cards below them.
  headerWrap: { paddingHorizontal: 18 },

  cartBar: {
    position: 'absolute', bottom: 20, left: 18, right: 18,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 18, paddingHorizontal: 18, paddingVertical: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  cartBadge: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  cartBadgeText: { fontSize: 13, fontFamily: FONTS.bold },
  cartBarText: { flex: 1, fontSize: 15, fontFamily: FONTS.bold },
});
