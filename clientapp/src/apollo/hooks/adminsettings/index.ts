import { useEffect } from 'react';
import { useQuery } from '@apollo/client/react';
import { useDispatch, useSelector } from 'react-redux';
import { GET_ADMIN_SETTINGS, GET_PARTY_STOCK } from '../../queries/accounts';
import { setBranding } from '../../../store/slices';
import type { RootState } from '../../../store/rootreducer';
import { formatINR } from '../../../utils/formatters';

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

/**
 * Settings -> General -> "Product Image Download". Shows the download button
 * on the Product Detail photo. Defaults to true (server default) so tenants
 * who haven't touched the setting get the button; an admin can turn it off.
 */
export function useAllowProductImageDownload(): boolean {
  const adminid = useSelector((s: RootState) => s.tenant.adminId) ?? '';
  const { data } = useQuery(GET_ADMIN_SETTINGS, {
    variables: { adminid },
    skip: !adminid,
    fetchPolicy: 'cache-and-network',
  });
  return (data as any)?.getAdminSettings?.allowProductImageDownload !== false;
}

/**
 * Settings -> General -> "WhatsApp Chat Button". Returns the business's
 * WhatsApp number as wa.me digits (91 added to a bare 10-digit mobile), or ''
 * when the button should not show — switched off, or no number saved. Unlike
 * the Help & Support card there is deliberately NO placeholder number here:
 * a floating button must never open a chat with a number nobody owns.
 */
export function useWhatsappChatNumber(): string {
  const adminid = useSelector((s: RootState) => s.tenant.adminId) ?? '';
  const { data } = useQuery(GET_ADMIN_SETTINGS, {
    variables: { adminid },
    skip: !adminid,
    fetchPolicy: 'cache-and-network',
  });
  const s = (data as any)?.getAdminSettings;
  if (!s || s.showWhatsappChat === false) return '';
  let d = String(s.supportWhatsapp || '').replace(/\D/g, '');
  if (d.length === 10) d = `91${d}`;
  return d.length >= 8 ? d : '';
}

/**
 * Business Settings -> "Auto-scroll the category row on the App"
 * (appCategoryAutoScroll). Off by default: only businesses that ask for it get
 * a self-scrolling category strip on Home / Shop; everyone else keeps the
 * plain swipe-only row.
 */
export function useCategoryAutoScroll(): boolean {
  const adminid = useSelector((s: RootState) => s.tenant.adminId) ?? '';
  const { data } = useQuery(GET_ADMIN_SETTINGS, {
    variables: { adminid },
    skip: !adminid,
    fetchPolicy: 'cache-and-network',
  });
  return (data as any)?.getAdminSettings?.appCategoryAutoScroll === true;
}

/**
 * Business Settings -> "Restrict quantity by stock". On (the default): a
 * customer can't put more of a product in the cart than the branch has, and
 * can't add an out-of-stock one at all. Off: they can order past it. The
 * server holds party orders to the same rule, so this is the friendly front
 * of it, not the only check.
 */
export function useRestrictQtyByStock(): boolean {
  const adminid = useSelector((s: RootState) => s.tenant.adminId) ?? '';
  const { data } = useQuery(GET_ADMIN_SETTINGS, {
    variables: { adminid },
    skip: !adminid,
    fetchPolicy: 'cache-and-network',
  });
  return (data as any)?.getAdminSettings?.restrictQuantityByStock !== false;
}

/**
 * Catalogue prices rendered at twice the stored rate. Admin-controlled via
 * Business Settings -> "Show Double Price on App/Website".
 *
 * This is a *display* markup for businesses that quote a padded list price up
 * front and settle at the real one. It touches only what the party reads on
 * the catalogue — Home, Shop/Catalog, the catalogue browse sheet and Product
 * Detail. Everything downstream keeps the admin's real rate: the cart lines,
 * the cart total, the order that gets placed, the invoice and the ledger. That
 * is why it is exposed as its own formatter rather than being folded into
 * `formatINR` — doubling has to be opted into per call site, so a real
 * transaction amount can never pick it up by accident.
 *
 *   const { formatCatalogINR } = useCatalogPrice();
 *   formatCatalogINR(price)   // "\u20b9120.00" when on, "\u20b960.00" when off
 */
export function useCatalogPrice() {
  const adminid = useSelector((s: RootState) => s.tenant.adminId) ?? '';
  const { data } = useQuery(GET_ADMIN_SETTINGS, {
    variables: { adminid },
    skip: !adminid,
    fetchPolicy: 'cache-and-network',
  });
  const doubled = (data as any)?.getAdminSettings?.doubleDisplayPrice === true;
  const multiplier = doubled ? 2 : 1;

  /** Raw amount as the catalogue should show it. */
  const catalogAmount = (n: number) => (Number(n) || 0) * multiplier;

  /** Same thing, already run through the app's rupee formatter. */
  const formatCatalogINR = (n: number) => formatINR(catalogAmount(n));

  return { doubled, multiplier, catalogAmount, formatCatalogINR };
}

// Shape of the product image box on the Home and Shop cards. Admin-controlled
// via Settings -> General -> Product Image Ratio -> "App — Home & Shop"
// (appProductImageRatio). The app has its own value rather than sharing the
// website's: the phone card is small and two-up, so a ratio that suits the
// site's wide Shop grid would leave a tall gap here. Returned as a number
// ready for RN's `aspectRatio` style (e.g. "3:4" -> 0.75); null means the
// admin hasn't picked one and the card keeps the fixed image height it
// always had.
export function useProductImageRatio(): number | null {
  const adminid = useSelector((s: RootState) => s.tenant.adminId) ?? '';
  const { data } = useQuery(GET_ADMIN_SETTINGS, {
    variables: { adminid },
    skip: !adminid,
    fetchPolicy: 'cache-and-network',
  });
  const raw = String((data as any)?.getAdminSettings?.appProductImageRatio ?? '');
  const [w, h] = raw.split(':').map(Number);
  if (!w || !h) return null;
  return w / h;
}

// Promo banner tiles the admin manages from the web panel (Settings → General
// → "Promo Banners"), the same list the website renders between Featured
// Products and New Arrivals. Empty list = the admin hasn't configured any, in
// which case the app simply shows nothing (no hardcoded fallback tiles).
export type PromoBanner = {
  image?: string | null;
  /** Uploaded banner video (hero slides only); plays in place of `image`. */
  video?: string | null;
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
  // A slide counts once it has a title OR an image — an image-only slide is a
  // finished banner artwork. Filtering on title alone dropped uploaded
  // banners entirely. A row with neither is an empty draft.
  return slides.filter(s => s?.title || s?.image || s?.video);
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

/**
 * Business Settings -> "Auto-scroll the products" (appProductAutoScroll).
 * Off by default. On: the Home / Shop product grid drifts down slowly by
 * itself; touching or scrolling it by hand pauses the drift.
 */
export function useProductAutoScroll(): boolean {
  const adminid = useSelector((s: RootState) => s.tenant.adminId) ?? '';
  const { data } = useQuery(GET_ADMIN_SETTINGS, {
    variables: { adminid },
    skip: !adminid,
    fetchPolicy: 'cache-and-network',
  });
  return (data as any)?.getAdminSettings?.appProductAutoScroll === true;
}

/**
 * Business Settings -> "Geo-fencing for salesmen". On: the salesman only sees
 * parties within `radiusM` of his live GPS and can take an order / mark a
 * no-order call only from there. Off by default.
 */
export function useGeoFence(): { enabled: boolean; radiusM: number } {
  const adminid = useSelector((s: RootState) => s.tenant.adminId) ?? '';
  const { data } = useQuery(GET_ADMIN_SETTINGS, {
    variables: { adminid },
    skip: !adminid,
    fetchPolicy: 'cache-and-network',
  });
  const st = (data as any)?.getAdminSettings;
  return { enabled: st?.geoFenceEnabled === true, radiusM: Number(st?.geoFenceRadiusM) || 200 };
}

/** Business Settings -> "Team Leaderboard in the salesman app". On by default. */
export function useLeaderboardEnabled(): boolean {
  const adminid = useSelector((s: RootState) => s.tenant.adminId) ?? '';
  const { data } = useQuery(GET_ADMIN_SETTINGS, {
    variables: { adminid },
    skip: !adminid,
    fetchPolicy: 'cache-and-network',
  });
  return (data as any)?.getAdminSettings?.salesmanLeaderboardEnabled !== false;
}

/** Business Settings -> "Selfie on Punch In". Off by default. */
export function useAttendanceSelfieRequired(): boolean {
  const adminid = useSelector((s: RootState) => s.tenant.adminId) ?? '';
  const { data } = useQuery(GET_ADMIN_SETTINGS, {
    variables: { adminid },
    skip: !adminid,
    fetchPolicy: 'cache-and-network',
  });
  return (data as any)?.getAdminSettings?.attendanceSelfieRequired === true;
}

/** Business Settings -> "Salesman can give an extra discount on the order". Off by default. */
export function useSalesmanOrderDiscount(): boolean {
  const adminid = useSelector((s: RootState) => s.tenant.adminId) ?? '';
  const { data } = useQuery(GET_ADMIN_SETTINGS, {
    variables: { adminid },
    skip: !adminid,
    fetchPolicy: 'cache-and-network',
  });
  return (data as any)?.getAdminSettings?.salesmanOrderDiscountEnabled === true;
}


/**
 * Party stock is SHOWN only when the business has "Party manages downline",
 * "Track party stock" AND "Show stock on App / Website" all on. (The stock
 * itself is kept whenever tracking is on; this only decides display.)
 */
export function usePartyStockVisible(): boolean {
  const adminid = useSelector((s: RootState) => s.tenant.adminId) ?? '';
  const { data } = useQuery(GET_ADMIN_SETTINGS, {
    variables: { adminid },
    skip: !adminid,
    fetchPolicy: 'cache-and-network',
  });
  const st = (data as any)?.getAdminSettings;
  return st?.partyManagesDownline === true && st?.trackPartyStock === true && st?.displayStockOnWebsite !== false;
}

/** Whether the business tracks party stock at all (display aside). */
export function usePartyStockTracked(): boolean {
  const adminid = useSelector((s: RootState) => s.tenant.adminId) ?? '';
  const { data } = useQuery(GET_ADMIN_SETTINGS, {
    variables: { adminid },
    skip: !adminid,
    fetchPolicy: 'cache-and-network',
  });
  const st = (data as any)?.getAdminSettings;
  return st?.partyManagesDownline === true && st?.trackPartyStock === true;
}

/** A party's stock as a lookup: `${productid}:${variantid}` → { qty, unit }. */
export function usePartyStockMap(partyId?: string | null, enabled = true) {
  const { data } = useQuery(GET_PARTY_STOCK, {
    variables: { partyid: partyId },
    skip: !partyId || !enabled,
    fetchPolicy: 'cache-and-network',
  });
  const rows = ((data as any)?.getPartyStock ?? []) as any[];
  const map: Record<string, { qty: number; unit: string }> = {};
  rows.forEach((r) => { map[`${r.productid}:${r.variantid ?? ''}`] = { qty: Number(r.qty) || 0, unit: r.unitname || '' }; });
  return { map, loaded: !!data };
}
