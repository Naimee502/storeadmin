import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StyleProp, ViewStyle,
  Animated, Easing,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { FONTS, useTheme, IMG } from '../config';
import { AppImage } from './appimage';
import { GET_CATEGORIES } from '../apollo/queries/categories';
import type { RootState } from '../store/rootreducer';
import { useIsEndUserParty } from '../utils/enduser';
import { useCategoryAutoScroll } from '../apollo/hooks/adminsettings';

// Auto-scroll (only when the admin turns the setting on). The row drifts
// continuously like an LED ticker. Slow enough that a customer can read a
// chip and tap it while it moves.
const MARQUEE_SPEED_PX_PER_SEC = 30;
const RESUME_AFTER_TOUCH_MS    = 1500; // ticker waits this long after a tap

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
/**
 * Memoised: this sits in Home's list header, which re-renders on every
 * keystroke in the search box and every tap on a card's +. Without memo the
 * whole category row — and its images — was rebuilt each time, for props that
 * had not changed.
 */
export const CategoryStrip: React.FC<Props> = React.memo(({
  categories, selected, onSelect, contentContainerStyle,
}) => {
  const { colors } = useTheme();
  const adminid = useSelector((s: RootState) => s.tenant.adminId ?? '');
  const asCircles = useIsEndUserParty();
  const autoScroll = useCategoryAutoScroll();

  // --- Auto-scroll (LED-ticker marquee) ---------------------------------
  // The items are drawn twice side by side and the whole row is slid left at
  // a constant speed on the native driver. When the first copy has fully slid
  // out, the row jumps back to 0 — which looks identical, because the second
  // copy is now exactly where the first one started — so the loop is seamless.
  // Touching the row pauses it (so a tap lands on the chip the customer aimed
  // at); it picks up again from the same spot shortly after. Runs only when
  // the setting is on AND the categories don't already fit on screen.
  const gap = asCircles ? 14 : 8;
  const translateX = useRef(new Animated.Value(0)).current;
  const posX = useRef(0);
  const running = useRef(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [viewW, setViewW] = useState(0);
  const [copyW, setCopyW] = useState(0);
  const marquee = autoScroll && viewW > 0 && copyW > viewW;
  const loopW = copyW + gap; // one copy plus the gap before the next copy

  const stop = useCallback(() => {
    running.current = false;
    translateX.stopAnimation(v => { posX.current = v; });
  }, [translateX]);

  const start = useCallback(() => {
    if (!marquee) return;
    running.current = true;
    const run = (from: number) => {
      const f = from <= -loopW || from > 0 ? 0 : from;
      translateX.setValue(f);
      Animated.timing(translateX, {
        toValue: -loopW,
        duration: ((loopW + f) / MARQUEE_SPEED_PX_PER_SEC) * 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && running.current) run(0);
      });
    };
    run(posX.current);
  }, [marquee, loopW, translateX]);

  // Timer callbacks always call the latest `start`.
  const startRef = useRef(start);
  startRef.current = start;

  useEffect(() => {
    if (!marquee) {
      stop();
      translateX.setValue(0);
      posX.current = 0;
      return;
    }
    start();
    return () => {
      stop();
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
  }, [marquee, start, stop, translateX]);

  const onTouchStart = useCallback(() => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    stop();
  }, [stop]);

  const onTouchEnd = useCallback(() => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => startRef.current(), RESUME_AFTER_TOUCH_MS);
  }, []);

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

  const renderItem = (item: CategoryItem, copy = 0) => {
        const active = selected === item.id;

        if (!asCircles) {
          return (
            <TouchableOpacity
              key={`${copy}-${item.id ?? 'all'}`}
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
            key={`${copy}-${item.id ?? 'all'}`}
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
                <AppImage uri={uri} width={IMG.thumb} style={styles.circleImg} resizeMode="cover" />
              ) : (
                <Icon
                  name={item.id ? 'image-off-outline' : 'view-grid-outline'}
                  size={24}
                  color={colors.subText}
                />
              )}
            </View>
            <Text
              // Two lines: real category names ("WITH HANDLE TRICYCLE",
              // "BATTERY TRACTOR") never fit on one, and a strip of
              // "MAGIC C…" / "WITH HA…" tells the customer nothing. Three
              // would push the products themselves off the first screen.
              numberOfLines={2}
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
  };

  const listStyle = asCircles ? styles.circleList : styles.chipList;

  if (autoScroll) {
    // "All" stays pinned on the left; only the real categories run in the
    // ticker beside it.
    const [allItem, ...catItems] = items;
    return (
      <View style={[styles.marqueeRow, { gap, paddingBottom: 8 }, contentContainerStyle]}>
        <View style={[listStyle, styles.marqueePinned]}>{renderItem(allItem)}</View>
        <View
          style={styles.marqueeWrap}
          onLayout={e => setViewW(e.nativeEvent.layout.width)}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
        >
          <Animated.View
            style={[
              styles.marqueeTrack,
              // Exactly two copies wide, so every chip sits inside the track's
              // bounds and stays tappable (Android ignores touches outside).
              marquee && { width: loopW + copyW },
              { transform: [{ translateX }] },
            ]}
          >
            <View
              style={[listStyle, styles.marqueeCopy]}
              onLayout={e => setCopyW(e.nativeEvent.layout.width)}
            >
              {catItems.map(item => renderItem(item, 0))}
            </View>
            {marquee && (
              <View style={[listStyle, styles.marqueeCopy, { marginLeft: gap }]}>
                {catItems.map(item => renderItem(item, 1))}
              </View>
            )}
          </Animated.View>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[listStyle, contentContainerStyle]}
      style={styles.scroll}
    >
      {items.map(item => renderItem(item))}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },

  // auto-scroll marquee
  marqueeRow:    { flexDirection: 'row', alignItems: 'flex-start' },
  marqueePinned: { flexDirection: 'row', flexShrink: 0, paddingBottom: 0 },
  marqueeWrap:   { flex: 1, overflow: 'hidden' },
  marqueeTrack: { flexDirection: 'row', alignSelf: 'flex-start' },
  marqueeCopy:  { flexDirection: 'row', flexShrink: 0, paddingBottom: 0 },

  // pill variant — same metrics the two screens used before
  chipList: { paddingBottom: 8, gap: 8 },
  chip:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  chipText: { fontSize: 13, fontFamily: FONTS.semiBold },

  // image-circle variant
  circleList:  { paddingBottom: 8, gap: 14, paddingHorizontal: 2 },
  // Wider than the 54px circle so a two-line name has room to break sensibly
  // instead of ellipsising after one word.
  circleItem:  { alignItems: 'center', width: 68 },
  circle: {
    width: 50, height: 50, borderRadius: 25,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  circleImg:         { width: '100%', height: '100%' },
  // minHeight reserves both lines so one-word categories don't sit higher than
  // their neighbours and leave the row looking ragged.
  circleLabel: {
    fontSize: 11, lineHeight: 14, minHeight: 28,
    fontFamily: FONTS.semiBold, marginTop: 4, textAlign: 'center',
  },
  circleLabelActive: { fontFamily: FONTS.bold },
});
