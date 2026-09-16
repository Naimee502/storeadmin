import React, { useMemo, useState } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { STRINGS, useTheme } from '../../../../config';
import { GET_CATEGORIES } from '../../../../apollo/queries/categories';
import { AppHeader, AppTextInput, CategoryStrip, ProductCatalog } from '../../../../components';
import type { CategoryItem } from '../../../../components';
import type { RootState } from '../../../../store/rootreducer';

/**
 * Shop — the search box, the category strip, and the shared product grid.
 *
 * The grid, the cards, the paging and the cart handlers all moved into
 * components/productcatalog.tsx when Home started showing the same catalogue.
 * Nothing about how it loads changed; this screen just stopped owning it.
 */
export default function Catalog() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const cartItems = useSelector((s: RootState) => s.cart.items);
  const cartCount = cartItems.reduce((sum, i) => sum + i.qty, 0);
  const adminid = useSelector((s: RootState) => s.tenant.adminId) ?? '';

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);

  // Categories come from the category list, not from whichever products are on
  // the current page — otherwise the chips would change as the user scrolls.
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
        label={STRINGS.party.catalog}
        rightIcons={[{
          id: 'cart', name: 'cart-outline', color: colors.brand, badge: cartCount,
          onPress: () => navigation.navigate('CartScreen'),
        }]}
      />

      {/* Search and categories render here, above the grid rather than inside
          its header. They used to be a ListHeader component declared inside
          this one, which gave React a new element type on every render —
          remounting the TextInput and dismissing the keyboard after a single
          character. Out here they never unmount, and they stay put while the
          grid scrolls. */}
      <View style={styles.headerWrap}>
        <AppTextInput
          leftIcon="magnify"
          placeholder={STRINGS.storefront.searchPlaceholder}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          placeholderTextColor={colors.subText}
          containerStyle={{ marginBottom: 8, marginTop: 10 }}
        />
        <CategoryStrip
          categories={categories}
          selected={category}
          onSelect={setCategory}
          contentContainerStyle={{ paddingTop: 0, paddingBottom: 8 }}
        />
      </View>

      <ProductCatalog search={search} category={category} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // Matches the grid's own horizontal padding so the search box and the
  // category strip line up with the cards below them.
  headerWrap: { paddingHorizontal: 18 },
});
