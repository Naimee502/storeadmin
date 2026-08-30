import { createContext, useContext, useLayoutEffect, type ReactNode } from "react";
import { useQuery } from "@apollo/client";
import { GET_STOREFRONT_BY_SLUG } from "../graphql/queries/storefront";
import { GET_ADMIN_BY_ID } from "../graphql/queries/accounts";
import { applyBrandTheme } from "../config/brandtheme";

interface TenantContextValue {
  storeSlug: string;
  loading: boolean;
  notFound: boolean;
  adminid: string | null;
  /** Business code, e.g. "#ADM0001" — drives the per-business brand override. */
  adminCode: string | null;
  branchid: string | null;
  companyName: string | null;
  address: string;
  codOnly: boolean;
  displayProductPrice: boolean;
  displayStock: boolean;
  /** Draw the tiled identity watermark over the storefront. */
  secureScreenWebsite: boolean;

  // Real contact details (Settings → General on the admin panel) — used by
  // Header/Footer instead of the static site config placeholders.
  supportEmail: string;
  supportPhone: string;
  supportWhatsapp: string;
  appDownloadUrl: string;

  // Admin-editable website content (Settings → General on the admin panel).
  // All blank by default — nothing static/hardcoded.
  websiteAboutContent: string;
  websitePrivacyContent: string;
  websiteTermsContent: string;
  websiteTagline: string;

  /**
   * The business's own logo (Settings → General on the admin panel). Empty
   * string means none was uploaded, and every surface that shows it falls back
   * to the lettered avatar it drew before.
   */
  brandLogo: string;

  /** Primary brand colour (#rrggbb). Empty = the built-in green/teal. */
  themeBrandColor: string;

  socialFacebookUrl: string;
  socialInstagramUrl: string;
  socialTwitterUrl: string;
  socialLinkedinUrl: string;

  featuredProductItems: { productid: string; unitid: string | null }[];
  newArrivalItems: { productid: string; unitid: string | null }[];

  dealOfDayEnabled: boolean;
  dealOfDayTitle: string;
  dealOfDaySubtitle: string;
  dealOfDayItems: { productid: string; unitid: string | null }[];

  /**
   * Whether the two category tiles sit beside the Home page hero. False makes
   * the hero span the full width instead.
   */
  heroBannerShowCategoryTiles: boolean;

  heroBannerSlides: { image?: string; title?: string; subtitle?: string; cta?: string; link?: string }[];
  promoBanners: { image?: string; title?: string; subtitle?: string; cta?: string; link?: string }[];

  // Home page "trust bar" stat tiles (Settings → General on the admin
  // panel). Empty = clientweb keeps its own built-in placeholder stats.
  businessStats: { label?: string; value?: string }[];
}

const TenantContext = createContext<TenantContextValue | null>(null);

// The real, dynamic replacement for the old hardcoded demo defaults —
// resolves the URL's storeslug (e.g. "rudra" from /rudra) to an actual
// admin via getStorefrontByStoreSlug, so every business's own link shows
// their own company name, home page layout and payment options.
export function TenantProvider({ storeSlug, children }: { storeSlug: string; children: ReactNode }) {
  const { data, loading, error } = useQuery(GET_STOREFRONT_BY_SLUG, {
    variables: { storeslug: storeSlug },
  });

  const info = data?.getStorefrontByStoreSlug;
  const notFound = !loading && (!!error || !info);

  // The business code is still surfaced for callers that want it, but the brand
  // no longer depends on it: colours come from the storefront record itself now
  // (Settings → General → Theme Colour), so a new business picks its own
  // without a code change.
  const { data: adminData, loading: adminLoading } = useQuery(GET_ADMIN_BY_ID, {
    variables: { id: info?.adminid },
    skip: !info?.adminid,
  });
  const adminCode: string | null = adminData?.getAdminById?.admincode ?? null;

  // useLayoutEffect, not useEffect: this must land before the browser paints,
  // or a black-brand store flashes teal for a frame. `loading` below keeps the
  // loader up until the storefront record has arrived at all.
  const themeBrandColor: string = info?.themeBrandColor ?? "";
  useLayoutEffect(() => {
    applyBrandTheme(themeBrandColor);
  }, [themeBrandColor]);

  if (error) {
    // Surface the real cause in the console — "Store not found" on screen looks
    // the same whether the slug truly doesn't exist or the server/schema call
    // itself failed (server down, wrong URL, stale schema). Check this first.
    // eslint-disable-next-line no-console
    console.error("[getStorefrontByStoreSlug] GraphQL/network error:", error.message, error);
  }

  const value: TenantContextValue = {
    storeSlug,
    loading: loading || adminLoading,
    notFound,
    adminid: info?.adminid ?? null,
    adminCode,
    branchid: info?.branchid ?? null,
    companyName: info?.companyName ?? null,
    address: info?.address ?? "",
    codOnly: info?.codOnly ?? false,
    displayProductPrice: info?.displayProductPriceOnWebsite ?? true,
    displayStock: info?.displayStockOnWebsite ?? true,
    secureScreenWebsite: info?.secureScreenWebsite ?? false,

    supportEmail: info?.supportEmail ?? "",
    supportPhone: info?.supportPhone ?? "",
    supportWhatsapp: info?.supportWhatsapp ?? "",
    appDownloadUrl: info?.appDownloadUrl ?? "",

    websiteAboutContent: info?.websiteAboutContent ?? "",
    websitePrivacyContent: info?.websitePrivacyContent ?? "",
    websiteTermsContent: info?.websiteTermsContent ?? "",
    websiteTagline: info?.websiteTagline ?? "",
    brandLogo: info?.brandLogo ?? "",
    themeBrandColor: info?.themeBrandColor ?? "",

    socialFacebookUrl: info?.socialFacebookUrl ?? "",
    socialInstagramUrl: info?.socialInstagramUrl ?? "",
    socialTwitterUrl: info?.socialTwitterUrl ?? "",
    socialLinkedinUrl: info?.socialLinkedinUrl ?? "",

    featuredProductItems: info?.featuredProductItems ?? [],
    newArrivalItems: info?.newArrivalItems ?? [],

    dealOfDayEnabled: info?.dealOfDayEnabled ?? true,
    dealOfDayTitle: info?.dealOfDayTitle ?? "",
    dealOfDaySubtitle: info?.dealOfDaySubtitle ?? "",
    dealOfDayItems: info?.dealOfDayItems ?? [],

    // Defaults to on — the tiles are what every storefront showed before the
    // switch existed, so an unset value has to keep meaning "show them".
    heroBannerShowCategoryTiles: info?.heroBannerShowCategoryTiles !== false,
    heroBannerSlides: info?.heroBannerSlides ?? [],
    promoBanners: info?.promoBanners ?? [],

    businessStats: info?.businessStats ?? [],
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
}
