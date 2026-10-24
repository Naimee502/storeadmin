import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, StyleProp, ViewStyle,
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
const RESUME_AFTER_TOUCH_MS    = 2000; // drift waits this long after a touch / swipe
const TICK_MS                  = 33;   // ~30 fps

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

  // --- Auto-scroll -------------------------------------------------------
  // A normal horizontal ScrollView (so the customer can always swipe it by
  // hand) that also moves itself a pixel at a time. The categories are drawn
  // twice side by side; once the first copy has scrolled fully out of view
  // the offset jumps back by one copy, which looks identical, so it loops
  // without a seam. Any touch or swipe pauses the drift; it resumes from
  // wherever the customer left it, RESUME_AFTER_TOUCH_MS later. Runs only when
  // the setting is on AND the categories don't already fit on screen.
  const gap = asCircles ? 14 : 8;
  const scrollRef = useRef<ScrollView>(null);
  const offset = useRef(0);
  const paused = useRef(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [viewW, setViewW] = useState(0);
  const [copyW, setCopyW] = useState(0);
  const marquee = autoScroll && viewW > 0 && copyW > viewW;
  const loopW = copyW + gap; // one copy plus the gap before the next copy

  useEffect(() => {
    if (!marquee) return;
    const step = (MARQUEE_SPEED_PX_PER_SEC * TICK_MS) / 1000;
    const id = setInterval(() => {
      if (paused.current) return;
      let next = offset.current + step;
      if (next >= loopW) next -= loopW;
      offset.current = next;
      scrollRef.current?.scrollTo({ x: next, animated: false });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [marquee, loopW]);

  useEffect(() => () => { if (resumeTimer.current) clearTimeout(resumeTimer.current); }, []);

  const pause = useCallback(() => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    paused.current = true;
  }, []);

  const resumeLater = useCallback(() => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => {
      // Hand-scrolled past the first copy → fold back so the loop math holds.
      if (loopW > 0 && offset.current >= loopW) {
        offset.current -= loopW;
        scrollRef.current?.scrollTo({ x: offset.current, animated: false });
      }
      paused.current = false;
    }, RESUME_AFTER_TOUCH_MS);
  }, [loopW]);

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
            <Pressable
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
            </Pressable>
          );
        }

        const uri = item.image || (item.id ? imageById[item.id] : null);

        return (
          <Pressable
            key={`${copy}-${item.id ?? 'all'}`}
            style={styles.circleItem}
            onPress={() => onSelect(item.id)}
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
          </Pressable>
        );
  };

  const listStyle = asCircles ? styles.circleList : styles.chipList;

  if (autoScroll) {
    // "All" stays pinned on the left; the real categories scroll beside it —
    // by themselves, and by hand.
    const [allItem, ...catItems] = items;
    return (
      <View style={[styles.marqueeRow, { gap, paddingBottom: 8 }, contentContainerStyle]}>
        <View style={[listStyle, styles.marqueePinned]}>{renderItem(allItem)}</View>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.marqueeWrap}
          contentContainerStyle={styles.marqueeTrack}
          onLayout={e => setViewW(e.nativeEvent.layout.width)}
          scrollEventThrottle={16}
          onScroll={e => { offset.current = e.nativeEvent.contentOffset.x; }}
          onTouchStart={pause}
          onScrollBeginDrag={pause}
          onTouchEnd={resumeLater}
          onScrollEndDrag={resumeLater}
          onMomentumScrollEnd={resumeLater}
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
        </ScrollView>
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
  marqueeWrap:   { flex: 1, flexGrow: 1 },
  marqueeTrack: { flexDirection: 'row', alignItems: 'flex-start' },
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
