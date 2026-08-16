import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@apollo/client";
import { GET_STOREFRONT_BY_SLUG } from "../graphql/queries/storefront";

interface TenantContextValue {
  storeSlug: string;
  loading: boolean;
  notFound: boolean;
  adminid: string | null;
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

  if (error) {
    // Surface the real cause in the console — "Store not found" on screen looks
    // the same whether the slug truly doesn't exist or the server/schema call
    // itself failed (server down, wrong URL, stale schema). Check this first.
    // eslint-disable-next-line no-console
    console.error("[getStorefrontByStoreSlug] GraphQL/network error:", error.message, error);
  }

  const value: TenantContextValue = {
    storeSlug,
    loading,
    notFound,
    adminid: info?.adminid ?? null,
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
