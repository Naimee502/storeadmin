import { AdminSettings } from "../../../models/adminsettings";
import { Admin } from "../../../models/admin";
import { Branch } from "../../../models/branches";

const formatSettings = (s: any) =>
  s
    ? {
        ...s,
        id: s._id?.toString?.() ?? s.id,
        adminid: s.adminid?.toString?.() ?? s.adminid,
      }
    : null;

// Shared by Featured Products / New Arrivals / Deal of the Day — each is
// an independent list of {productid, unitid} picks on the same shape.
const mapPickItems = (items: any[]) =>
  (items || []).map((d: any) => ({
    productid: String(d.productid),
    unitid: d.unitid ? String(d.unitid) : null,
  }));

// Shared by Hero Banner slides and Promo Banner tiles — same shape.
const mapSlides = (slides: any[]) =>
  (slides || []).map((s: any) => ({
    image: s.image || "",
    title: s.title || "",
    subtitle: s.subtitle || "",
    cta: s.cta || "",
    link: s.link || "",
  }));

// Home page "trust bar" stat tiles.
const mapStats = (stats: any[]) =>
  (stats || []).map((s: any) => ({
    label: s.label || "",
    value: s.value || "",
  }));

export const adminSettingsResolvers = {
  Query: {
    getAdminSettings: async (_: any, { adminid }: { adminid: string }) => {
      const doc = await AdminSettings.getOrCreateForAdmin(adminid);
      return formatSettings(doc.toObject ? doc.toObject() : doc);
    },

    // Public lookup for clientweb — resolves which admin a storefront link
    // (e.g. yourdomain.com/rudra) belongs to. No login/mobile check here
    // (unlike clientapp's getAdminByCode): browsing a public catalog isn't
    // sensitive, only the party-login step needs to check identity, and it
    // does that scoped to the adminid this query returns.
    getStorefrontByStoreSlug: async (_: any, { storeslug }: { storeslug: string }) => {
      const normalized = String(storeslug || "").trim().toLowerCase();
      if (!normalized) return null;

      const settings: any = await AdminSettings.findOne({ storeslug: normalized }).lean();
      if (!settings) return null;

      const admin: any = await Admin.findOne({ _id: settings.adminid, status: true }).lean();
      if (!admin) return null;

      // Same "first active branch" default clientapp's setup screen uses
      // (adminsetup/index.tsx → GET_BRANCHES) — resolved here so clientweb
      // gets a usable branchid for placing real orders without a second
      // round trip, and without needing its own branch-picker UI (a website
      // storefront always books to the business's default branch).
      const branch: any = await Branch.findOne({ admin: settings.adminid, status: true }).sort({ createdAt: 1 }).lean();

      return {
        adminid: String(settings.adminid),
        branchid: branch ? String(branch._id) : null,
        companyName: admin.companyName || admin.name || "",
        address: admin.address || "",
        codOnly: !!settings.websiteCodOnly,
        displayProductPriceOnWebsite: settings.displayProductPriceOnWebsite !== false,
        displayStockOnWebsite: settings.displayStockOnWebsite !== false,
        // Tiled watermark on the storefront. Browsers expose no
        // screen-capture detection API, so this is traceability, not
        // prevention — see the AdminSettings model for the full note.
        secureScreenWebsite: !!settings.secureScreenWebsite,

        supportEmail: settings.supportEmail || "",
        supportPhone: settings.supportPhone || "",
        supportWhatsapp: settings.supportWhatsapp || "",
        appDownloadUrl: settings.appDownloadUrl || "",

        websiteAboutContent: settings.websiteAboutContent || "",
        websitePrivacyContent: settings.websitePrivacyContent || "",
        websiteTermsContent: settings.websiteTermsContent || "",
        websiteTagline: settings.websiteTagline || "",

        socialFacebookUrl: settings.socialFacebookUrl || "",
        socialInstagramUrl: settings.socialInstagramUrl || "",
        socialTwitterUrl: settings.socialTwitterUrl || "",
        socialLinkedinUrl: settings.socialLinkedinUrl || "",

        featuredProductItems: mapPickItems(settings.featuredProductItems),
        newArrivalItems: mapPickItems(settings.newArrivalItems),

        dealOfDayEnabled: settings.dealOfDayEnabled !== false,
        dealOfDayTitle: settings.dealOfDayTitle || "",
        dealOfDaySubtitle: settings.dealOfDaySubtitle || "",
        dealOfDayItems: mapPickItems(settings.dealOfDayItems),

        heroBannerSlides: mapSlides(settings.heroBannerSlides),
        promoBanners: mapSlides(settings.promoBanners),

        businessStats: mapStats(settings.businessStats),
      };
    },
  },

  Mutation: {
    // Partial-merge update: only the fields present in `input` get written;
    // everything else is preserved. Lazy-creates the row first if missing
    // so first-time writers always succeed.
    updateAdminSettings: async (
      _: any,
      { adminid, input }: { adminid: string; input: any }
    ) => {
      const doc = await AdminSettings.getOrCreateForAdmin(adminid);
      const $set: any = {};
      Object.keys(input || {}).forEach((k) => {
        if (input[k] !== undefined) $set[k] = input[k];
      });
      const updated = await AdminSettings.findByIdAndUpdate(
        doc._id,
        { $set },
        { new: true }
      ).lean();
      return formatSettings(updated);
    },
  },
};
