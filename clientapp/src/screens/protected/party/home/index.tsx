import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { FONTS, STRINGS, useTheme } from '../../../../config';
import { GET_CATEGORIES } from '../../../../apollo/queries/categories';
import { useIsEndUserParty } from '../../../../utils';
import { AppHeader, AppTextInput, CategoryStrip, ProductCatalog, useNotificationCenter } from '../../../../components';
import type { CategoryItem } from '../../../../components';
import { HomeBanner } from './homebanner';
import { TradeOverview } from './tradeoverview';
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
export default function PartyHome() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const { bellIcon, NotificationsModal } = useNotificationCenter();
  const cartItems = useSelector((s: RootState) => s.cart.items);
  const cartCount = cartItems.reduce((sum, i) => sum + i.qty, 0);
  const adminid = useSelector((s: RootState) => s.tenant.adminId) ?? '';

  // A shopper (EndUser channel, or no channel yet) gets the storefront: search,
  // categories, catalogue. A trade party keeps their figures above it.
  // See utils/enduser.ts.
  const isEndUser = useIsEndUserParty();

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

  // Built once. A new element here on every render would be a changed prop, and
  // the memoised grid would re-render for it — the very thing being avoided.
  const listHeader = useMemo(
    () => (isEndUser ? null : <TradeOverview />),
    [isEndUser],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

      <AppHeader
        label={STRINGS.party.home}
        rightIcons={[
          bellIcon,
          {
            id: 'cart', name: 'cart-outline', color: colors.brand, badge: cartCount,
            onPress: () => navigation.navigate('CartScreen'),
          },
        ]}
      />
      {NotificationsModal}

      {/* Search and categories sit above the grid, exactly as on Shop, so
          neither unmounts while the catalogue reloads underneath. */}
      <View style={styles.headerWrap}>
        {isEndUser && (
          <AppTextInput
            leftIcon="magnify"
            placeholder={STRINGS.storefront.searchPlaceholder}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            placeholderTextColor={colors.subText}
            containerStyle={{ marginBottom: 8, marginTop: 10 }}
          />
        )}
        <HomeBanner />

        <CategoryStrip
          categories={categories}
          selected={category}
          onSelect={setCategory}
          contentContainerStyle={{ paddingTop: 0, paddingBottom: 8 }}
        />
      </View>

      <ProductCatalog search={search} category={category} ListHeaderComponent={listHeader} />

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
