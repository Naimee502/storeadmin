import React, { useMemo } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { useSelector } from 'react-redux';
import { useTheme } from '../config';
import { BannerCarousel } from './bannercarousel';
import type { BannerSlide } from './bannercarousel';
import type { HeroSlide } from '../apollo/hooks/adminsettings';
import type { RootState } from '../store/rootreducer';

type Props = {
  /** Admin-configured slides (Settings → General → "Hero Banner"). */
  slides: HeroSlide[];
  /** Products the screen already fetched — drives the default slides. */
  products: any[];
  onPress?: (slide: HeroSlide | null) => void;
  horizontalPadding?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * The website's Hero Banner (clientweb/src/components/herobanner), rendered as
 * a swipeable carousel.
 *
 * Same two-tier behaviour as the site: when the admin has configured Hero
 * Banner slides in the web panel those fully replace the carousel, otherwise
 * the slides are built from this business's own catalog — brand name, its
 * category list and its biggest category — so nothing is ever hardcoded per
 * business.
 *
 * The website's side promo tiles are deliberately not repeated here: they are
 * category shortcuts, and the app already shows every category in the
 * CategoryStrip directly underneath.
 */
export const HeroBanner: React.FC<Props> = ({
  slides, products, onPress, horizontalPadding = 18, style,
}) => {
  const { colors } = useTheme();
  const companyName = useSelector((s: RootState) => s.tenant.companyName);
  const brandName = companyName || 'our store';

  const carouselSlides = useMemo<BannerSlide[]>(() => {
    // Admin-configured slides win outright, exactly like the website.
    if (slides.length > 0) {
      return slides.map(s => ({
        image: s.image,
        eyebrow: s.subtitle || 'Featured',
        title: s.title || undefined,
        cta: s.cta || 'Shop Now',
        onDark: true,
      }));
    }

    // Otherwise mirror the site's catalog-driven defaults. Category product
    // counts come from the products already on screen, so no extra request.
    const counts = new Map<string, { name: string; items: number }>();
    products.forEach((p: any) => {
      const id = p.categoryid?.id;
      if (!id) return;
      const entry = counts.get(id);
      if (entry) entry.items += 1;
      else counts.set(id, { name: p.categoryid.categoryname, items: 1 });
    });
    const categories = [...counts.values()];
    const names = categories.slice(0, 3).map(c => c.name);
    const catalogLine = names.length > 0
      ? `${names.join(', ')}${categories.length > 3 ? ' & more' : ''} — all in one place.`
      : 'Everything you need, all in one place.';

    const base: BannerSlide[] = [
      {
        eyebrow: 'Welcome',
        title: `Shop everything from ${brandName}`,
        body: catalogLine,
        cta: 'Start Shopping',
        gradient: [colors.brand, colors.brandDark],
        onDark: true,
      },
      {
        eyebrow: 'Retailers & Wholesalers',
        title: 'Bulk pricing on every order',
        // The site's copy invites visitors to apply for an account; in the app
        // the user already has one, so it points at the negotiated rates.
        body: 'Your party account unlocks negotiated rates and route-based delivery.',
        cta: 'Browse catalog',
        icon: 'truck-outline',
        gradient: ['#2B2B2B', '#0F0F0F'],
        onDark: true,
      },
    ];

    const top = [...categories].sort((a, b) => b.items - a.items)[0];
    if (top) {
      base.push({
        eyebrow: 'Popular category',
        title: `Fresh picks in ${top.name}`,
        body: `${top.items} products waiting for you in ${top.name}.`,
        cta: `Shop ${top.name}`,
        icon: 'star-outline',
        gradient: [colors.brandDark, colors.brand],
        onDark: true,
      });
    }

    return base;
  }, [slides, products, brandName, colors.brand, colors.brandDark]);

  return (
    <BannerCarousel
      slides={carouselSlides}
      height={196}
      horizontalPadding={horizontalPadding}
      style={style}
      onPress={(_, i) => onPress?.(slides[i] ?? null)}
    />
  );
};
