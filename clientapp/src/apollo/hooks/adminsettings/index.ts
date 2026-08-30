import { useEffect } from 'react';
import { useQuery } from '@apollo/client/react';
import { useDispatch, useSelector } from 'react-redux';
import { GET_ADMIN_SETTINGS } from '../../queries/accounts';
import { setBranding } from '../../../store/slices';
import type { RootState } from '../../../store/rootreducer';

// Whether product prices (price, MRP, discount, cart/order totals) should be
// shown. Admin-controlled via Business Settings → "Display Product Prices on
// App/Website" (displayProductPriceOnWebsite). Defaults to true (server
// default) so tenants who haven't touched the setting see no change.
export function useShowProductPrice(): boolean {
  const adminid = useSelector((s: RootState) => s.tenant.adminId) ?? '';
  const { data } = useQuery(GET_ADMIN_SETTINGS, {
    variables: { adminid },
    skip: !adminid,
    fetchPolicy: 'cache-and-network',
  });
  return (data as any)?.getAdminSettings?.displayProductPriceOnWebsite !== false;
}

// Whether product stock ("In stock", "Only X left", "Out of stock" text) is
// shown. Admin-controlled via Business Settings → "Display Product Stock on
// App/Website" (displayStockOnWebsite). Defaults to true (server default) so
// tenants who haven't touched the setting see no change. Purely a display
// toggle — the underlying stock number still blocks ordering past what's on
// hand regardless of this flag.
export function useShowProductStock(): boolean {
  const adminid = useSelector((s: RootState) => s.tenant.adminId) ?? '';
  const { data } = useQuery(GET_ADMIN_SETTINGS, {
    variables: { adminid },
    skip: !adminid,
    fetchPolicy: 'cache-and-network',
  });
  return (data as any)?.getAdminSettings?.displayStockOnWebsite !== false;
}

// Promo banner tiles the admin manages from the web panel (Settings → General
// → "Promo Banners"), the same list the website renders between Featured
// Products and New Arrivals. Empty list = the admin hasn't configured any, in
// which case the app simply shows nothing (no hardcoded fallback tiles).
export type PromoBanner = {
  image?: string | null;
  title?: string | null;
  subtitle?: string | null;
  cta?: string | null;
  link?: string | null;
};

export function usePromoBanners(): PromoBanner[] {
  const adminid = useSelector((s: RootState) => s.tenant.adminId) ?? '';
  const { data } = useQuery(GET_ADMIN_SETTINGS, {
    variables: { adminid },
    skip: !adminid,
    fetchPolicy: 'cache-and-network',
  });
  const banners = ((data as any)?.getAdminSettings?.promoBanners ?? []) as PromoBanner[];
  // Same guard the website uses — a row with neither image nor title is an
  // empty draft the admin hasn't filled in yet.
  return banners.filter(b => b?.image || b?.title);
}

// Hero banner slides the admin manages from the web panel (Settings → General
// → "Hero Banner") — the Home page carousel. Empty list = not configured, in
// which case HeroBanner builds its slides from this business's own catalog,
// same as the website does.
export type HeroSlide = PromoBanner;

export function useHeroBannerSlides(): HeroSlide[] {
  const adminid = useSelector((s: RootState) => s.tenant.adminId) ?? '';
  const { data } = useQuery(GET_ADMIN_SETTINGS, {
    variables: { adminid },
    skip: !adminid,
    fetchPolicy: 'cache-and-network',
  });
  const slides = ((data as any)?.getAdminSettings?.heroBannerSlides ?? []) as HeroSlide[];
  // The website only renders a slide once it has a title; an untitled row is
  // an empty draft the admin hasn't filled in yet.
  return slides.filter(s => s?.title);
}

/**
 * The activated business's own logo (admin panel → Settings → General →
 * Business Logo), for the surfaces that would otherwise show the generic app
 * mark — the login screen most of all, where the person is about to sign in to
 * *their supplier's* app, not to a product called "Business Suite".
 *
 * Falls back to whatever was stored on the tenant when the business was
 * activated, so the logo is on screen from the first frame rather than after
 * the settings query lands. Empty string = no logo set; the caller keeps its
 * own icon.
 */
export function useBrandLogo(): string {
  const adminid = useSelector((s: RootState) => s.tenant.adminId) ?? '';
  const storedLogo = useSelector((s: RootState) => s.tenant.logoUrl) ?? '';
  const { data } = useQuery(GET_ADMIN_SETTINGS, {
    variables: { adminid },
    skip: !adminid,
    fetchPolicy: 'cache-and-network',
  });
  return (data as any)?.getAdminSettings?.brandLogo || storedLogo || '';
}

/**
 * Keeps the stored branding in step with the web panel.
 *
 * Logo and theme colour are read once when a business is activated, so the
 * first screen is already wearing them rather than repainting a frame later.
 * That snapshot then goes stale the moment the admin changes either one, so
 * this runs high in the tree and writes any change back to the tenant slice —
 * which is what useTheme reads.
 */
export function useBrandingSync() {
  const dispatch = useDispatch();
  const adminid = useSelector((s: RootState) => s.tenant.adminId) ?? '';
  const storedLogo = useSelector((s: RootState) => s.tenant.logoUrl) ?? null;
  const storedColor = useSelector((s: RootState) => s.tenant.primaryColor) ?? null;

  const { data } = useQuery(GET_ADMIN_SETTINGS, {
    variables: { adminid },
    skip: !adminid,
    fetchPolicy: 'cache-and-network',
  });

  const settings = (data as any)?.getAdminSettings;

  useEffect(() => {
    if (!settings) return;
    const logoUrl = settings.brandLogo || null;
    const primaryColor = settings.themeBrandColor || null;
    if (logoUrl === storedLogo && primaryColor === storedColor) return;
    dispatch(setBranding({ logoUrl, primaryColor }));
  }, [settings, storedLogo, storedColor, dispatch]);
}
