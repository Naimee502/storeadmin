import { normalizeDomain, isValidDomain, clearCustomDomainCache } from "../../../utils/customdomain";
import { AdminSettings } from "../../../models/adminsettings";
import { encryptSecret } from "../../../utils/secret";
import { clearBusinessMailer, getBusinessSmtp, sendTestMail } from "../../../utils/mail";
import { Admin } from "../../../models/admin";
import { Branch } from "../../../models/branches";

const formatSettings = (s: any) =>
  s
    ? {
        ...s,
        id: s._id?.toString?.() ?? s.id,
        adminid: s.adminid?.toString?.() ?? s.adminid,
        // Non-null in the schema, but the mutation path re-reads with
        // .lean(), which skips mongoose defaults — so a settings row saved
        // before this flag existed would come back with the field missing
        // and fail the Boolean! check. Coerce it here rather than making
        // the field nullable for every caller.
        doubleDisplayPrice: !!s.doubleDisplayPrice,
        // Older rows have no value — treat missing as "show".
        websiteShowTrustBar: s.websiteShowTrustBar !== false,
        websiteShowPromoBanners: s.websiteShowPromoBanners !== false,
        websiteShowAppSection: s.websiteShowAppSection !== false,
        // Same reason, and these two default to TRUE: a row written before the
        // return-stock switches existed must read as "yes, move stock", not as
        // a missing field that trips Boolean! (or, worse, silently reads false
        // and stops returns from restoring stock all over again).
        autoCreateStockOnSalesReturn: s.autoCreateStockOnSalesReturn !== false,
        autoCreateStockOnPurchaseReturn: s.autoCreateStockOnPurchaseReturn !== false,
        // Same again, and it also defaults to TRUE: a settings row written
        // before this flag existed must read as "yes, cap at stock" rather
        // than as a missing field that trips Boolean!.
        restrictQuantityByStock: s.restrictQuantityByStock !== false,
        // Own mailbox for OTP mails: the password never leaves the server —
        // the panel only learns whether one is saved.
        smtpHost: s.smtpHost || "",
        smtpPort: Number(s.smtpPort) || 465,
        smtpUser: s.smtpUser || "",
        smtpPassSet: !!s.smtpPassEnc,
        smtpPassEnc: undefined,
        geoFenceEnabled: !!s.geoFenceEnabled,
        salesmanLeaderboardEnabled: s.salesmanLeaderboardEnabled !== false,
        geoFenceRadiusM: Number(s.geoFenceRadiusM) || 200,
        attendanceSelfieRequired: !!s.attendanceSelfieRequired,
        salesmanOrderDiscountEnabled: !!s.salesmanOrderDiscountEnabled,
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
    video: s.video || "",
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
    getStorefrontByStoreSlug: async (
      _: any,
      { storeslug, domain }: { storeslug?: string; domain?: string }
    ) => {
      // Business's own domain (dkmarketing.com) wins when given; otherwise
      // the /<storeslug> link as before.
      const host = normalizeDomain(domain);
      const normalized = String(storeslug || "").trim().toLowerCase();
      if (!host && !normalized) return null;

      const settings: any = host
        ? await AdminSettings.findOne({ customDomain: host }).lean()
        : await AdminSettings.findOne({ storeslug: normalized }).lean();
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
        // Defaults to true for rows predating the flag -- see the model.
        restrictQuantityByStock: settings.restrictQuantityByStock !== false,
        // Display-only x2 markup on catalogue prices. Safe to expose to an
        // anonymous visitor — the browser is what has to draw the doubled
        // number, and the real rate still travels on every product/cart
        // field, exactly as it did before this flag existed.
        doubleDisplayPrice: !!settings.doubleDisplayPrice,
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
        brandLogo: settings.brandLogo || "",
        themeBrandColor: settings.themeBrandColor || "",
        websiteDealProductImageRatio: settings.websiteDealProductImageRatio || "",
        websiteHomeProductImageRatio: settings.websiteHomeProductImageRatio || "",
        websiteShopProductImageRatio: settings.websiteShopProductImageRatio || "",
        websiteShopInfiniteScroll: !!settings.websiteShopInfiniteScroll,
        // Category row runs as a ticker (same switch as the app).
        appCategoryAutoScroll: !!settings.appCategoryAutoScroll,
        appProductAutoScroll: !!settings.appProductAutoScroll,

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

        heroBannerShowCategoryTiles: settings.heroBannerShowCategoryTiles !== false,
        heroBannerSlides: mapSlides(settings.heroBannerSlides),
        promoBanners: mapSlides(settings.promoBanners),

        businessStats: mapStats(settings.businessStats),
        websiteShowTrustBar: settings.websiteShowTrustBar !== false,
        websiteShowPromoBanners: settings.websiteShowPromoBanners !== false,
        websiteShowAppSection: settings.websiteShowAppSection !== false,
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
      const $unset: any = {};
      Object.keys(input || {}).forEach((k) => {
        if (input[k] !== undefined) $set[k] = input[k];
      });

      // Custom domain: normalise, validate, keep it unique across businesses.
      // Blank removes it — $unset rather than "", since the unique index is
      // sparse and two businesses with "" would collide.
      if ("customDomain" in $set) {
        const d = normalizeDomain($set.customDomain);
        delete $set.customDomain;
        if (!d) {
          $unset.customDomain = "";
        } else {
          if (!isValidDomain(d)) {
            throw new Error(`"${d}" is not a valid domain. Enter it like dkmarketing.com`);
          }
          const taken: any = await AdminSettings.findOne({ customDomain: d, _id: { $ne: doc._id } })
            .select("_id")
            .lean();
          if (taken) throw new Error(`The domain ${d} is already used by another business.`);
          $set.customDomain = d;
        }
        clearCustomDomainCache();
      }

      // Own mailbox for OTP mails (Business Settings -> Email (SMTP)).
      // smtpPass: blank = keep the saved one; anything else is encrypted.
      // Clearing the email turns the feature off (host + password go too).
      delete $set.smtpPassSet; // read-only, echoed back by the panel
      const smtpTouched = ["smtpHost", "smtpPort", "smtpUser", "smtpPass"].some((k) => k in $set);
      if ("smtpPass" in $set) {
        const pass = String($set.smtpPass ?? "").trim();
        delete $set.smtpPass;
        if (pass) $set.smtpPassEnc = encryptSecret(pass);
      }
      if ("smtpHost" in $set) $set.smtpHost = String($set.smtpHost ?? "").trim().toLowerCase();
      if ("smtpUser" in $set) {
        const u = String($set.smtpUser ?? "").trim().toLowerCase();
        $set.smtpUser = u;
        if (!u) {
          $set.smtpHost = "";
          $set.smtpPassEnc = "";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u)) {
          throw new Error(`"${u}" is not a valid email address for the SMTP mailbox.`);
        }
      }
      if ($set.smtpUser && "smtpHost" in $set && !$set.smtpHost) {
        throw new Error("SMTP host is required for the mailbox (e.g. smtp.hostinger.com), or clear the email to use the default mailbox.");
      }
      if ("smtpPort" in $set) {
        const port = Number($set.smtpPort);
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
          throw new Error("SMTP port must be a number like 465 or 587.");
        }
        $set.smtpPort = port;
      }
      if (smtpTouched) clearBusinessMailer(adminid);
      if ("geoFenceRadiusM" in $set) {
        const r = Math.round(Number($set.geoFenceRadiusM));
        if (!Number.isFinite(r) || r < 20 || r > 50000) {
          throw new Error("Geo-fence radius must be between 20 and 50,000 metres.");
        }
        $set.geoFenceRadiusM = r;
      }

      const update: any = { $set };
      if (Object.keys($unset).length) update.$unset = $unset;
      const updated = await AdminSettings.findByIdAndUpdate(
        doc._id,
        update,
        { new: true }
      ).lean();
      return formatSettings(updated);
    },

    // Sends a test mail through the business's SAVED mailbox and reports the
    // real SMTP error (wrong password / port / host) if it fails.
    testBusinessSmtp: async (_: any, { adminid, to }: { adminid: string; to: string }) => {
      const email = String(to || "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email to send the test mail to.");
      const c = await getBusinessSmtp(adminid);
      if (!c) throw new Error("Save the SMTP host, email and password first, then send a test mail.");
      const admin: any = await Admin.findById(adminid).select("companyName").lean();
      const err = await sendTestMail(c, email, admin?.companyName || "");
      if (err) throw new Error(`Test mail failed: ${err}`);
      return `Test mail sent to ${email} from ${c.user}.`;
    },
  },
};
