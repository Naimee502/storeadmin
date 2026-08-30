import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Dimensions,
  NativeSyntheticEvent, NativeScrollEvent, StyleProp, ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, FONTS, useTheme, resolveMediaUrl } from '../config';

/** One normalised slide, whatever fed it (hero slides, promo tiles, …). */
export type BannerSlide = {
  /** Photo background. Wins over `bg` / `gradient`. */
  image?: string | null;
  /** Small caps line above the title. */
  eyebrow?: string;
  title?: string;
  /** Optional supporting line under the title. */
  body?: string;
  cta?: string;
  /** Decorative watermark icon, for slides with no photo. */
  icon?: string;
  /** Flat background tint, for slides with no photo. */
  bg?: string;
  /** Gradient background, for slides with no photo or tint. */
  gradient?: [string, string];
  /** true = white text (photo / dark tile); false = dark text on a light tint. */
  onDark?: boolean;
};

type Props = {
  slides: BannerSlide[];
  /** Card height — hero banners are taller than promo tiles. */
  height?: number;
  /** Horizontal page padding, so each screen keeps its own gutter. */
  horizontalPadding?: number;
  onPress?: (slide: BannerSlide, index: number) => void;
  style?: StyleProp<ViewStyle>;
};

const AUTO_ADVANCE_MS = 5000;

/** Breathing room between two slides while swiping. */
const SLIDE_GAP = 12;

/**
 * The swipeable banner carousel shared by HeroBanner and PromoBanners.
 *
 * Both were the same thing — a paged row of image/copy/CTA cards with dots —
 * so the mechanics (paging, 5s auto-advance matching the website carousel,
 * rotation-safe card width, text colours) live here once and each caller just
 * supplies already-normalised `BannerSlide`s.
 *
 * The auto-advance timer restarts after a manual swipe so it never fights
 * the user mid-drag.
 */
export const BannerCarousel: React.FC<Props> = ({
  slides, height = 176, horizontalPadding = 18, onPress, style,
}) => {
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [active, setActive] = useState(0);
  const [width, setWidth] = useState(
    Dimensions.get('window').width - horizontalPadding * 2,
  );

  // Keep the card width correct on rotation / split screen.
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) =>
      setWidth(window.width - horizontalPadding * 2),
    );
    return () => sub.remove();
  }, [horizontalPadding]);

  useEffect(() => {
    if (active >= slides.length) setActive(0);
  }, [active, slides.length]);

  // One card plus the gap after it — the distance a single swipe travels.
  const stride = width + SLIDE_GAP;

  useEffect(() => {
    if (slides.length < 2) return;
    const id = setInterval(() => {
      setActive(prev => {
        const next = (prev + 1) % slides.length;
        scrollRef.current?.scrollTo({ x: next * stride, animated: true });
        return next;
      });
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(id);
    // `active` is a dep so a manual swipe restarts the countdown.
  }, [slides.length, stride, active]);

  if (slides.length === 0) return null;

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / stride);
    if (idx !== active) setActive(idx);
  };

  return (
    <View style={style}>
      <ScrollView
        ref={scrollRef}
        horizontal
        // `pagingEnabled` snaps to the ScrollView's own width, which ignores
        // the gap — snapping to the stride keeps every card edge-aligned.
        snapToInterval={stride}
        snapToAlignment="start"
        disableIntervalMomentum
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        scrollEventThrottle={16}
        style={styles.scroll}
      >
        {slides.map((s, i) => {
          const onDark       = s.onDark !== false;
          const textColor    = onDark ? '#FFFFFF' : colors.text;
          const eyebrowColor = onDark ? 'rgba(255,255,255,0.85)' : colors.brand;
          const bodyColor    = onDark ? 'rgba(255,255,255,0.85)' : colors.subText;
          const ctaBg        = onDark ? '#FFFFFF' : colors.brand;
          const ctaFg        = onDark ? colors.text : colors.onBrand;

          return (
            <TouchableOpacity
              key={i}
              activeOpacity={onPress ? 0.9 : 1}
              disabled={!onPress}
              onPress={() => onPress?.(s, i)}
              style={i === slides.length - 1 ? undefined : { marginRight: SLIDE_GAP }}
            >
              <View style={[styles.card, { width, height, backgroundColor: s.bg ?? colors.softSurface }]}>
                {s.image ? (
                  <>
                    <Image source={{ uri: resolveMediaUrl(s.image) }} style={styles.image} resizeMode="cover" />
                    <View style={[styles.overlay, { backgroundColor: colors.heroOverlay }]} />
                  </>
                ) : !s.bg ? (
                  <LinearGradient
                    colors={s.gradient ?? [colors.brand, colors.brandDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                ) : null}

                {/* Watermark icon for slides that have no photo. */}
                {!!s.icon && !s.image && (
                  <Icon
                    name={s.icon}
                    size={110}
                    color={onDark ? 'rgba(255,255,255,0.16)' : 'rgba(180,83,9,0.18)'}
                    style={styles.bgIcon}
                  />
                )}

                <View style={styles.content}>
                  {!!s.eyebrow && (
                    <Text style={[styles.eyebrow, { color: eyebrowColor }]} numberOfLines={1}>
                      {s.eyebrow.toUpperCase()}
                    </Text>
                  )}
                  {!!s.title && (
                    <Text style={[styles.title, { color: textColor }]} numberOfLines={2}>
                      {s.title}
                    </Text>
                  )}
                  {!!s.body && (
                    <Text style={[styles.body, { color: bodyColor }]} numberOfLines={2}>
                      {s.body}
                    </Text>
                  )}
                  {!!s.cta && (
                    <View style={[styles.ctaPill, { backgroundColor: ctaBg }]}>
                      <Text style={[styles.ctaText, { color: ctaFg }]}>{s.cta}</Text>
                      <Icon name="arrow-right" size={13} color={ctaFg} />
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {slides.length > 1 && (
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === active
                  ? { width: 16, backgroundColor: colors.brand }
                  : { backgroundColor: colors.border },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  card: {
    borderRadius: 18, overflow: 'hidden', justifyContent: 'center',
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  image: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  overlay: StyleSheet.absoluteFillObject,
  bgIcon: { position: 'absolute', right: -14, bottom: -18 },
  content: { paddingHorizontal: 18, paddingVertical: 22, paddingRight: 96 },
  eyebrow: { fontSize: 10, fontFamily: FONTS.semiBold, letterSpacing: 0.8, marginBottom: 5 },
  title: { fontSize: 18, fontFamily: FONTS.bold, lineHeight: 24 },
  body: { fontSize: 11, fontFamily: FONTS.regular, lineHeight: 16, marginTop: 4 },
  ctaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    marginTop: 12, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12,
  },
  ctaText: { fontSize: 12, fontFamily: FONTS.bold },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
