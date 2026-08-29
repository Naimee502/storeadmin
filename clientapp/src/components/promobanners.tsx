import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { BannerCarousel } from './bannercarousel';
import type { BannerSlide } from './bannercarousel';
import type { PromoBanner } from '../apollo/hooks/adminsettings';

type Props = {
  banners: PromoBanner[];
  /** Tapping a banner — the screen decides where its `link` should go. */
  onPress?: (banner: PromoBanner | null) => void;
  horizontalPadding?: number;
  /**
   * Show the website's built-in default tiles when the admin hasn't configured
   * any banners yet. Matches clientweb's `fallbackTiles`; pass false to render
   * nothing at all instead.
   */
  showFallback?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * The exact two tiles clientweb falls back to when the admin hasn't set any
 * Promo Banners up (see clientweb/src/components/promobanners/index.tsx).
 * Kept here so the app and the website never show a different Home page for
 * the same business — as soon as the admin adds real banners in the panel,
 * both switch to those instead.
 */
const FALLBACK_SLIDES: BannerSlide[] = [
  {
    eyebrow: 'Home & Furniture',
    title: 'Refresh your space, save 30%',
    cta: 'Shop the sale',
    icon: 'sofa',
    bg: '#FFFBEB',      // amber-50, same as the website tile
    onDark: false,
  },
  {
    eyebrow: 'For Retailers & Wholesalers',
    title: 'Order in bulk with a Party Account',
    body: 'Credit terms, route-based delivery & custom price lists.',
    // The website says "Apply now" (it targets logged-out visitors); in the
    // app the user already has a party account, so the CTA goes shopping.
    cta: 'Browse catalog',
    icon: 'office-building',
    onDark: true,
  },
];

/**
 * The website's Promo Banners, rendered as a swipeable carousel.
 *
 * Content is admin-managed from the web panel (Settings → General → "Promo
 * Banners") — image, title, subtitle and CTA — so nothing is per-business
 * hardcoded. When that list is empty the website's own default tiles are
 * shown instead, so both surfaces always look the same.
 */
export const PromoBanners: React.FC<Props> = ({
  banners, onPress, horizontalPadding = 18, showFallback = true, style,
}) => {
  const slides: BannerSlide[] = banners.length > 0
    ? banners.map(b => ({
        image: b.image,
        // The website renders a configured banner's `subtitle` as the small
        // eyebrow above the title — mirrored here.
        eyebrow: b.subtitle || undefined,
        title: b.title || undefined,
        cta: b.cta || undefined,
        onDark: true,
      }))
    : showFallback ? FALLBACK_SLIDES : [];

  return (
    <BannerCarousel
      slides={slides}
      height={176}
      horizontalPadding={horizontalPadding}
      style={style}
      onPress={(_, i) => onPress?.(banners[i] ?? null)}
    />
  );
};
