import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, StyleSheet,
  StyleProp, ViewStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { FONTS, useTheme, resolveMediaUrl } from '../config';
import { GET_CATEGORIES } from '../apollo/queries/categories';
import type { RootState } from '../store/rootreducer';
import { useIsEndUserParty } from '../utils/enduser';

export type CategoryItem = { id: string | null; name: string; image?: string | null };

type Props = {
  categories: CategoryItem[];
  /** Currently selected category id; null = the "All" entry. */
  selected: string | null;
  onSelect: (id: string | null) => void;
  /** Per-screen spacing, so each screen keeps the padding it had before. */
  contentContainerStyle?: StyleProp<ViewStyle>;
};


/**
 * The horizontal category filter row shared by Home and Shop.
 *
 * Both screens had an identical copy of this row; it lives here so the two
 * cannot drift apart. Two visual variants:
 *
 *  - pills (default)  — text-only chips, exactly as before.
 *  - image circles    — round category image + name underneath, for shoppers
 *                       (EndUser channel, or no channel yet), matching the
 *                       storefront. Trade parties keep the pills, which fit a
 *                       long ordering list better than a row of photos.
 *
 * Images are fetched here rather than taken from the products: the server
 * populates a product's categoryid with `select: "id categoryname"` only, so
 * `item.image` arrives empty. GET_CATEGORIES does return it, and is skipped
 * entirely for the pill variant so no other business pays for the request.
 * `item.image` still wins when present, in case that projection is widened.
 */
export const CategoryStrip: React.FC<Props> = ({
  categories, selected, onSelect, contentContainerStyle,
}) => {
  const { colors } = useTheme();
  const adminid = useSelector((s: RootState) => s.tenant.adminId ?? '');
  const asCircles = useIsEndUserParty();

  const { data: catData } = useQuery(GET_CATEGORIES, {
    variables: { adminId: adminid },
    skip: !asCircles || !adminid,
  });

  const imageById = useMemo(() => {
    const map: Record<string, string> = {};
    ((catData as any)?.getCategories ?? []).forEach((c: any) => {
      if (c?.id && c.image) map[c.id] = c.image;
    });
    return map;
  }, [catData]);

  if (categories.length === 0) return null;

  // "All" always leads the row and clears the filter.
  const items: CategoryItem[] = [{ id: null, name: 'All', image: null }, ...categories];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[asCircles ? styles.circleList : styles.chipList, contentContainerStyle]}
      style={styles.scroll}
    >
      {items.map(item => {
        const active = selected === item.id;

        if (!asCircles) {
          return (
            <TouchableOpacity
              key={item.id ?? 'all'}
              style={[styles.chip, active
                ? { backgroundColor: colors.brand, borderColor: colors.brand }
                : { backgroundColor: colors.raisedSurface, borderColor: colors.border },
              ]}
              onPress={() => onSelect(item.id)}
            >
              <Text style={[styles.chipText, { color: active ? colors.onBrand : colors.categoryLabel }]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          );
        }

        const uri = item.image || (item.id ? imageById[item.id] : null);

        return (
          <TouchableOpacity
            key={item.id ?? 'all'}
            style={styles.circleItem}
            onPress={() => onSelect(item.id)}
            activeOpacity={0.75}
          >
            <View style={[
              styles.circle,
              {
                backgroundColor: colors.softSurface,
                borderColor: active ? colors.brand : colors.border,
                borderWidth:  active ? 2.5 : 1,
              },
            ]}>
              {uri ? (
                <Image source={{ uri: resolveMediaUrl(uri) }} style={styles.circleImg} resizeMode="cover" />
              ) : (
                <Icon
                  name={item.id ? 'image-off-outline' : 'view-grid-outline'}
                  size={24}
                  color={colors.subText}
                />
              )}
            </View>
            <Text
              numberOfLines={1}
              style={[
                styles.circleLabel,
                { color: active ? colors.brand : colors.categoryLabel },
                active && styles.circleLabelActive,
              ]}
            >
              {item.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },

  // pill variant — same metrics the two screens used before
  chipList: { paddingBottom: 12, gap: 8 },
  chip:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  chipText: { fontSize: 13, fontFamily: FONTS.semiBold },

  // image-circle variant
  circleList:  { paddingBottom: 12, gap: 14, paddingHorizontal: 2 },
  circleItem:  { alignItems: 'center', width: 68 },
  circle: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  circleImg:         { width: '100%', height: '100%' },
  circleLabel:       { fontSize: 11, fontFamily: FONTS.semiBold, marginTop: 6, textAlign: 'center' },
  circleLabelActive: { fontFamily: FONTS.bold },
});
