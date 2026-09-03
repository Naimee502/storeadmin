// Settings — central control plane for the admin/branch.
//
// KEY DESIGN:
//  1. A single global dropdown at the top selects the target
//     (Branch for Admin, Staff for Branch). All child-management tabs share it.
//  2. When admin is logged in AND the SaaS flags are enabled, business-level
//     tabs (General, Business Modules, Business Permissions) are also shown
//     so the admin can manage everything from one page.

import { useEffect, useMemo, useRef, useState } from "react";
import HomeLayout from "../../layouts/home";
import FormField from "../../components/formfiled";
import FormSwitch from "../../components/formswitch";
import Button from "../../components/button";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { showMessage } from "../../redux/slices/message";
import {
  usePermissionsLazy,
  useEffectivePermissionsLazy,
  usePermissionsMutations,
} from "../../graphql/hooks/adminsettings";
import { useBranchesQuery, useBranchMutations } from "../../graphql/hooks/branches";
import { useStaffQuery, useStaffMutations } from "../../graphql/hooks/staffaccounts";
import {
  useAdminSettingsQuery,
  useAdminSettingsMutations,
} from "../../graphql/hooks/adminsettings";
import { useProductServicesQuery } from "../../graphql/hooks/products";
import { useImageUpload } from "../../graphql/hooks/uploads";
import RichTextEditor from "../../components/richtexteditor";

// Strips Apollo's injected __typename from every nested object/array before
// sending a query result back as a mutation input — needed once fields stop
// being flat scalars (heroBannerSlides / dealOfDayItems are objects, and
// GraphQL input types reject any field they don't declare, __typename included).
const deepStripTypename = (value: any): any =>
  JSON.parse(JSON.stringify(value), (key, val) => (key === "__typename" ? undefined : val));
import {
  MODULES,
  SECTION_LABELS,
  ADMIN_REGISTER_MODULES,
  DEFAULT_ON_MODULE_IDS,
  ACTION_LABELS,
  type ModuleAction,
} from "../../config/modules";

type TabKey =
  | "general"
  | "branch_modules"
  | "staff_modules"
  | "access";

const Settings = () => {
  const dispatch = useAppDispatch();
  const { type, admin, branch, staff } = useAppSelector((s: any) => s.auth);
  const adminId =
    type === "admin"
      ? admin?.id
      : type === "branch"
        ? branch?.admin?.id
        : type === "staff"
          ? staff?.admin?.id
          : undefined;

  const role = type?.toString().toLowerCase();
  const isAdmin = role === "admin";
  const isBranch = role === "branch";

  // ── Global target selection (lifted from individual tabs) ──
  const { data: branchesData } = useBranchesQuery();
  const { data: staffData } = useStaffQuery();

  const targetOptions = useMemo(() => {
    if (isAdmin) {
      return (branchesData?.getBranches ?? []).map((b: any) => ({
        value: b.id,
        label: b.branchname,
      }));
    }
    if (isBranch) {
      // Only "staff" role — salesmen and delivery boys don't get module settings.
      return (staffData?.getStaffAccounts ?? [])
        .filter((s: any) => (s.role ?? '').toString().toLowerCase() === 'staff')
        .map((s: any) => ({
          value: s.id,
          label: s.name,
        }));
    }
    return [];
  }, [isAdmin, isBranch, branchesData, staffData]);

  const [selectedTargetId, setSelectedTargetId] = useState<string>("");

  // ── Parent-allowed modules (strict hierarchy) ──
  const parentAllowed = useMemo(() => {
    const list = isAdmin ? admin?.allowedmodules : branch?.allowedmodules;
    if (list === undefined || list === null) return ADMIN_REGISTER_MODULES.map((m) => m.id);
    // Always surface default-on modules (newly added) so they can be granted /
    // permissioned even for tenants whose allowedmodules predate the module.
    const extra = DEFAULT_ON_MODULE_IDS.filter(
      (id) => !list.map((x: string) => x.toLowerCase()).includes(id.toLowerCase())
    );
    return [...list, ...extra];
  }, [isAdmin, admin, branch]);

  // ── Target's effective allowed modules ──
  const targetEffectiveAllowed = useMemo(() => {
    if (!selectedTargetId) return parentAllowed;

    let targetAllowed: string[] | null | undefined = undefined;
    if (isAdmin) {
      const selectedBranch = (branchesData?.getBranches ?? []).find((b: any) => b.id === selectedTargetId);
      targetAllowed = selectedBranch?.allowedmodules;
    } else if (isBranch) {
      const selectedStaff = (staffData?.getStaffAccounts ?? []).find((s: any) => s.id === selectedTargetId);
      targetAllowed = selectedStaff?.allowedmodules;
    }

    if (targetAllowed === null || targetAllowed === undefined) return parentAllowed;
    const parentLower = parentAllowed.map((p) => p.toLowerCase());
    return targetAllowed.filter((id: string) => parentLower.includes(id.toLowerCase()));
  }, [selectedTargetId, parentAllowed, isAdmin, isBranch, branchesData, staffData]);

  // ── Build visible tabs ──
  // Business tabs: shown to admin when SaaS flags allow (hide ONLY if flag === false)
  // Child tabs: Branch Modules + Branch Access for admin, Staff Modules + Staff Access for branch
  const visibleTabs: Array<[TabKey, string]> = useMemo(() => {
    const tabs: Array<[TabKey, string]> = [];

    if (isAdmin) {
      tabs.push(["general", "General"]);
      // Child-management tabs
      tabs.push(["branch_modules", "Branch Modules"]);
      tabs.push(["access", "Branch Access"]);
    } else if (isBranch) {
      tabs.push(["staff_modules", "Staff Modules"]);
      tabs.push(["access", "Staff Access"]);
    }
    return tabs;
  }, [isAdmin, isBranch]);

  const [tab, setTab] = useState<TabKey>(visibleTabs[0]?.[0] ?? "access");

  // Auto-fix current tab if it becomes hidden
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.find((t) => t[0] === tab)) {
      setTab(visibleTabs[0][0]);
    }
  }, [visibleTabs, tab]);

  if (type === "staff") {
    return (
      <HomeLayout>
        <div className="w-full px-2 sm:px-6 pt-4 pb-6">
          <div className="bg-white border rounded-lg p-6 text-sm text-gray-600">
            You don't have permission to open Settings.
          </div>
        </div>
      </HomeLayout>
    );
  }

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <h1 className="text-2xl font-semibold mb-4">Settings</h1>

        {/* ── GLOBAL Selection Dropdown ── */}
        <div className="bg-white border rounded-lg p-3 mb-4">
          <FormField
            label={isAdmin ? "Select Branch" : "Select Staff Member"}
            type="select"
            name="selectedTargetId"
            value={selectedTargetId}
            onChange={(e: any) => setSelectedTargetId(e.target.value)}
            options={targetOptions}
            searchable
          />
        </div>

        <div className="flex border-b mb-4 overflow-x-auto">
          {visibleTabs.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${
                tab === key
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── General tab — admin's own website settings, no branch/staff target needed ── */}
        {tab === "general" && isAdmin ? (
          <WebsiteTab adminId={adminId} dispatch={dispatch} />
        ) : !selectedTargetId ? (
          /* ── Child-management tabs (need target selection) ── */
          <div className="text-center py-10 bg-white border rounded-lg text-gray-500 text-sm">
            Please select {isAdmin ? "a Branch" : "a Staff member"} above to manage settings.
          </div>
        ) : (
          <>
            {tab === "branch_modules" && isAdmin && (
              <SubModulesTab
                scope="branch"
                title="Configure modules allowed for this Branch"
                dispatch={dispatch}
                selectedTargetId={selectedTargetId}
                parentAllowed={parentAllowed}
              />
            )}
            {tab === "staff_modules" && isBranch && (
              <SubModulesTab
                scope="staff"
                title="Configure modules allowed for this Staff member"
                dispatch={dispatch}
                selectedTargetId={selectedTargetId}
                parentAllowed={parentAllowed}
              />
            )}
            {tab === "access" && (
              <AccessTab
                adminId={adminId}
                dispatch={dispatch}
                scopeMode={isAdmin ? "branch" : "staff"}
                selectedTargetId={selectedTargetId}
                parentAllowed={targetEffectiveAllowed}
              />
            )}
          </>
        )}
      </div>
    </HomeLayout>
  );
};

export default Settings;

/* =====================================================================
   WEBSITE TAB — everything that drives the customer-facing website
   (clientweb): storefront link/payment mode, support & legal contacts,
   About/Privacy/Terms content, social links, Deal of the Day and Hero
   Banner copy. Moved here (from Business Settings) so the admin can
   manage their own website straight after logging in — no need to hop
   into the multi-tenant Business Settings screen.
   ===================================================================== */

/** The built-in brand colour, shown as the placeholder when none is set. */
const DEFAULT_BRAND_COLOR = "#0F766E";

// Shape of the product image box on product cards. One dropdown per surface
// (see PRODUCT_IMAGE_RATIO_FIELDS) because these grids were never the same
// size — the app's card, the Deal of the Day carousel tile and the Shop grid
// each had their own height. Blank keeps whatever height that surface used
// before this setting existed, so an untouched business sees no change.
// FormField's native <select> already prepends its own blank "Select ..."
// row, which is the "leave it at the default" choice — so this list holds
// only the real ratios. The server validates the "w:h" shape rather than a
// fixed list, so adding a ratio here is all it takes.
const PRODUCT_IMAGE_RATIO_OPTIONS = [
  { label: "Square (1:1)", value: "1:1" },
  { label: "Portrait (3:4)", value: "3:4" },
  { label: "Landscape (4:3)", value: "4:3" },
  { label: "Wide (16:9)", value: "16:9" },
];




const PRODUCT_IMAGE_RATIO_FIELDS: { key: string; label: string; help: string }[] = [
  { key: "appProductImageRatio", label: "App — Home & Shop", help: "The product cards in the mobile app." },
  { key: "websiteDealProductImageRatio", label: "Website — Deal of the Day", help: "The carousel tiles in the Deal of the Day strip." },
  { key: "websiteHomeProductImageRatio", label: "Website — Featured & New Arrivals", help: "Both Home page grids, and any other card on the site (related products, reorder grid)." },
  { key: "websiteShopProductImageRatio", label: "Website — Shop", help: "The All Products grid on the Shop page." },
];

const WebsiteTab: React.FC<{ adminId?: string; dispatch: any }> = ({ adminId, dispatch }) => {
  const { data, refetch } = useAdminSettingsQuery(adminId);
  const { updateAdminSettings } = useAdminSettingsMutations();
  const { uploadImageMutation, deleteImages } = useImageUpload();
  const settings = data?.getAdminSettings;
  const [draft, setDraft] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // The logo picked but not yet uploaded. Like every other picker in this app,
  // the file only goes up when Save is pressed.
  const [logoFile, setLogoFile] = useState<File | null>(null);

  // Images these settings were loaded with — banner slides and the logo. A
  // slide that is removed, or a picture swapped for another, leaves its old
  // file on the server with nothing able to show it, so anything here that the
  // saved settings no longer mention is deleted once the save succeeds.
  const originalImages = useRef<string[]>([]);

  // Uploaded during the current save attempt, so a failed save can take its own
  // uploads back off the disk instead of leaking one per attempt.
  const justUploadedUrls = useRef<string[]>([]);

  useEffect(() => {
    if (!settings) return;
    setDraft({ ...settings });
    setLogoFile(null);
    originalImages.current = [
      ...[...(settings.heroBannerSlides ?? []), ...(settings.promoBanners ?? [])].map(
        (slide: any) => slide?.image
      ),
      settings.brandLogo,
    ].filter(Boolean);
  }, [settings]);

  /** Preview the picked logo right away; it uploads on Save. */
  const handleLogoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (draft.brandLogo?.startsWith("blob:")) URL.revokeObjectURL(draft.brandLogo);
    setLogoFile(file);
    set("brandLogo", URL.createObjectURL(file));
    e.target.value = "";
  };

  const clearLogo = () => {
    if (draft.brandLogo?.startsWith("blob:")) URL.revokeObjectURL(draft.brandLogo);
    setLogoFile(null);
    // The file on the server goes when Save is pressed, not now.
    set("brandLogo", "");
  };

  if (!draft) return <div className="text-gray-500 text-sm">Loading…</div>;

  const set = (k: string, v: any) => setDraft((d: any) => ({ ...d, [k]: v }));

  const handleSave = async () => {
    if (!adminId) return;
    const { id, adminid, __typename, ...rest } = draft;
    setSaving(true);
    try {
      // Any slide with a newly picked file (not yet uploaded) gets uploaded
      // now, same as the product form — upload only happens on Save.
      const uploaded: string[] = [];

      const uploadSlides = (slides: any[]) =>
        Promise.all(
          (slides ?? []).map(async (s: any) => {
            let image = s.image ?? "";
            if (s._file) {
              const { data: uploadedFile } = await uploadImageMutation({ variables: { file: s._file } });
              if (uploadedFile?.uploadImage?.url) {
                image = uploadedFile.uploadImage.url;
                uploaded.push(image);
              }
            }
            // A blob: url is a preview of a file that never made it up. Storing
            // it would save a link that dies with the tab.
            if (image.startsWith("blob:")) image = "";
            return { image, title: s.title ?? "", subtitle: s.subtitle ?? "", cta: s.cta ?? "", link: s.link ?? "" };
          })
        );

      const heroBannerSlides = await uploadSlides(rest.heroBannerSlides);
      const promoBanners = await uploadSlides(rest.promoBanners);

      let brandLogo: string = rest.brandLogo ?? "";
      if (logoFile) {
        const { data: uploadedLogo } = await uploadImageMutation({ variables: { file: logoFile } });
        if (uploadedLogo?.uploadImage?.url) {
          brandLogo = uploadedLogo.uploadImage.url;
          uploaded.push(brandLogo);
        }
      }
      // A blob: url is a preview whose file never went up — storing it would
      // save a link that dies with the tab.
      if (brandLogo.startsWith("blob:")) brandLogo = "";

      justUploadedUrls.current = uploaded;

      const input = deepStripTypename({ ...rest, heroBannerSlides, promoBanners, brandLogo });
      await updateAdminSettings({ variables: { adminid: adminId, input } });

      // Saved. Whatever the settings used to point at and no longer do is now
      // unreachable — removed slides, and pictures that were swapped out.
      const keptUrls = [
        ...[...heroBannerSlides, ...promoBanners].map((slide: any) => slide.image),
        brandLogo,
      ].filter(Boolean);
      const droppedUrls = originalImages.current.filter((url) => !keptUrls.includes(url));
      originalImages.current = keptUrls;
      justUploadedUrls.current = [];
      setLogoFile(null);
      void deleteImages(droppedUrls);

      await refetch();
      dispatch(showMessage({ message: "Website settings saved.", type: "success" }));
    } catch (e: any) {
      // The images went up before the settings mutation ran, so a failed save
      // has just left them on disk with nothing referencing them.
      const orphans = justUploadedUrls.current;
      justUploadedUrls.current = [];
      void deleteImages(orphans);

      dispatch(showMessage({ message: e?.message || "Save failed.", type: "error" }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Section title="App and Web Support & Legal">
        <div className="text-xs text-gray-400 mb-1 px-1">
          Drives the mobile app's Help &amp; Support contact cards, the Privacy Policy / Terms &amp; Conditions links, the website footer tagline, the "Get the app" link, and the social icons shown on the website footer.
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <FormField
            label="Support Email"
            name="supportEmail"
            type="email"
            placeholder="support@yourbusiness.com"
            value={draft.supportEmail ?? ""}
            onChange={(e: any) => set("supportEmail", e.target.value)}
          />
          <FormField
            label="Support Phone"
            name="supportPhone"
            type="tel"
            placeholder="+91 98765 43210"
            value={draft.supportPhone ?? ""}
            onChange={(e: any) => set("supportPhone", e.target.value)}
          />
          <FormField
            label="WhatsApp Number"
            name="supportWhatsapp"
            type="tel"
            placeholder="919876543210"
            value={draft.supportWhatsapp ?? ""}
            onChange={(e: any) => set("supportWhatsapp", e.target.value)}
          />
          <FormField
            label="Privacy Policy URL"
            name="privacyPolicyUrl"
            type="url"
            placeholder="https://yourbusiness.com/privacy"
            value={draft.privacyPolicyUrl ?? ""}
            onChange={(e: any) => set("privacyPolicyUrl", e.target.value)}
          />
          <FormField
            label="Terms & Conditions URL"
            name="termsConditionsUrl"
            type="url"
            placeholder="https://yourbusiness.com/terms"
            value={draft.termsConditionsUrl ?? ""}
            onChange={(e: any) => set("termsConditionsUrl", e.target.value)}
          />
          <FormField
            label="Footer Tagline"
            name="websiteTagline"
            placeholder="A multi-category marketplace & B2B ordering platform — one storefront for retail shoppers and wholesale/manufacturer party accounts alike."
            value={draft.websiteTagline ?? ""}
            onChange={(e: any) => set("websiteTagline", e.target.value)}
          />
          <FormField
            label="App Download Link"
            name="appDownloadUrl"
            type="url"
            placeholder="https://play.google.com/store/apps/details?id=..."
            value={draft.appDownloadUrl ?? ""}
            onChange={(e: any) => set("appDownloadUrl", e.target.value)}
          />
          <FormField
            label="Facebook URL"
            name="socialFacebookUrl"
            type="url"
            placeholder="https://facebook.com/yourbusiness"
            value={draft.socialFacebookUrl ?? ""}
            onChange={(e: any) => set("socialFacebookUrl", e.target.value)}
          />
          <FormField
            label="Instagram URL"
            name="socialInstagramUrl"
            type="url"
            placeholder="https://instagram.com/yourbusiness"
            value={draft.socialInstagramUrl ?? ""}
            onChange={(e: any) => set("socialInstagramUrl", e.target.value)}
          />
          <FormField
            label="Twitter / X URL"
            name="socialTwitterUrl"
            type="url"
            placeholder="https://x.com/yourbusiness"
            value={draft.socialTwitterUrl ?? ""}
            onChange={(e: any) => set("socialTwitterUrl", e.target.value)}
          />
          <FormField
            label="LinkedIn URL"
            name="socialLinkedinUrl"
            type="url"
            placeholder="https://linkedin.com/company/yourbusiness"
            value={draft.socialLinkedinUrl ?? ""}
            onChange={(e: any) => set("socialLinkedinUrl", e.target.value)}
          />

          {/* One colour, and the website and app each build their own full
              palette from it — tints, hover states, gradients, the app's tab
              bar. This replaced a table of palettes hand-written per business
              code, which meant new colours needed a deploy. */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Theme Colour</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Theme colour"
                value={draft.themeBrandColor || DEFAULT_BRAND_COLOR}
                onChange={(e) => set("themeBrandColor", e.target.value.toUpperCase())}
                className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-gray-300 bg-white p-0.5"
              />
              <input
                type="text"
                value={draft.themeBrandColor ?? ""}
                onChange={(e) => set("themeBrandColor", e.target.value.toUpperCase())}
                placeholder={`${DEFAULT_BRAND_COLOR} (default)`}
                className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              {draft.themeBrandColor ? (
                <button
                  type="button"
                  title="Back to the default colour"
                  onClick={() => set("themeBrandColor", "")}
                  className="shrink-0 rounded-lg border border-gray-300 px-2 py-2 text-xs text-gray-500 hover:border-gray-400"
                >
                  Reset
                </button>
              ) : null}
            </div>
          </div>

          {/* Sits in the same grid as the fields above so it takes one cell,
              not a section of its own. The thumbnail is inline beside the
              picker rather than under a "Preview" label — at 32px it costs no
              extra height. */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Business Logo</label>
            <div className="flex items-center gap-2">
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-500 hover:border-gray-400">
                <span className="text-gray-400">🖼</span>
                <span className="truncate">{draft.brandLogo ? "Change logo" : "Choose file"}</span>
                <input type="file" accept="image/*" onChange={handleLogoPick} className="hidden" />
              </label>
              {draft.brandLogo && (
                <div className="relative shrink-0">
                  {/* Shown at the height the website header actually uses, and
                      on a chequered tile — a white or transparent logo looks
                      fine against a white panel here and then disappears on
                      the site, which is exactly the surprise worth avoiding. */}
                  <div
                    className="flex h-9 items-center rounded-lg px-1 ring-1 ring-black/10"
                    style={{
                      backgroundImage:
                        "linear-gradient(45deg,#e5e7eb 25%,transparent 25%),linear-gradient(-45deg,#e5e7eb 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e5e7eb 75%),linear-gradient(-45deg,transparent 75%,#e5e7eb 75%)",
                      backgroundSize: "10px 10px",
                      backgroundPosition: "0 0,0 5px,5px -5px,-5px 0",
                      backgroundColor: "#fff",
                    }}
                  >
                    <img
                      src={draft.brandLogo}
                      alt="Business logo"
                      className="h-7 w-auto max-w-[110px] object-contain"
                    />
                  </div>
                  <button
                    type="button"
                    title="Remove logo"
                    onClick={clearLogo}
                    className="absolute -top-1.5 -right-1.5 grid h-4 w-4 place-items-center rounded-full bg-red-600 text-[9px] font-bold leading-none text-white hover:bg-red-700"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <p className="mt-1.5 text-xs text-gray-400">
          Footer tagline: leave blank to keep the default line. Social links: the footer only shows an icon once a URL is filled in here.
          Business logo: shown on the website header, footer and login page, and on the app's login screen — leave it empty to keep the first letter of your business name.
          A wide or square PNG works; transparent backgrounds are fine, but avoid a logo that is entirely white, since it sits on a white plate.
          Theme colour: one colour drives the whole palette on your website and app — leave it blank (or press Reset) to keep the default green.
        </p>
      </Section>

      <Section title="Product Image Ratio (Home / Shop cards)">
        <div className="text-xs text-gray-400 mb-1 px-1">
          The shape of the picture box on product cards. The photo is cropped to fill it, so a catalogue of
          differently sized uploads still lines up. Each surface is set on its own because these grids are not the
          same size — leave one unselected to keep the card height it uses today.
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PRODUCT_IMAGE_RATIO_FIELDS.map((f) => (
            <div key={f.key} className="flex flex-col gap-1">
              <FormField
                label={f.label}
                name={f.key}
                type="select"
                options={PRODUCT_IMAGE_RATIO_OPTIONS}
                value={draft[f.key] ?? ""}
                onChange={(e: any) => set(f.key, e.target.value)}
              />
              <p className="text-xs text-gray-400">{f.help}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Website Content">
        <div className="text-xs text-gray-400 mb-1 px-1">
          Shown directly on your website's About Us / Privacy Policy / Terms &amp; Conditions pages. Leave blank and the page will say content hasn't been added yet.
        </div>
        <div className="space-y-4">
          <RichTextEditor
            label="About Us content"
            value={draft.websiteAboutContent ?? ""}
            onChange={(html) => set("websiteAboutContent", html)}
            placeholder="Tell customers about your business…"
          />
          <RichTextEditor
            label="Privacy Policy content"
            value={draft.websitePrivacyContent ?? ""}
            onChange={(html) => set("websitePrivacyContent", html)}
            placeholder="Your privacy policy…"
          />
          <RichTextEditor
            label="Terms & Conditions content"
            value={draft.websiteTermsContent ?? ""}
            onChange={(html) => set("websiteTermsContent", html)}
            placeholder="Your terms & conditions…"
          />
        </div>
      </Section>

      <Section title="Featured Products (Home page)">
        <div className="text-xs text-gray-400 mb-1 px-1">
          Pick exactly which products show in the Home page's "Featured Products" section. Leave empty to show the live catalog with category tabs instead.
        </div>
        <ProductPickerEditor
          idPrefix="featured"
          items={draft.featuredProductItems ?? []}
          onChange={(items) => set("featuredProductItems", items)}
        />
      </Section>

      <Section title="New Arrivals (Home page)">
        <div className="text-xs text-gray-400 mb-1 px-1">
          Pick exactly which products show in "New Arrivals". Leave empty and the newest products (by date added) are shown automatically.
        </div>
        <ProductPickerEditor
          idPrefix="newarrival"
          items={draft.newArrivalItems ?? []}
          onChange={(items) => set("newArrivalItems", items)}
        />
      </Section>

      <Section title="Deal of the Day (Home page)">
        <Toggle
          label="Show Deal of the Day section on website home page"
          checked={draft.dealOfDayEnabled !== false}
          onChange={(v: boolean) => set("dealOfDayEnabled", v)}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <FormField
            label="Title"
            name="dealOfDayTitle"
            placeholder="Deal of the Day"
            value={draft.dealOfDayTitle ?? ""}
            onChange={(e: any) => set("dealOfDayTitle", e.target.value)}
            disabled={draft.dealOfDayEnabled === false}
          />
          <FormField
            label="Subtitle"
            name="dealOfDaySubtitle"
            placeholder="Grab it before the clock runs out"
            value={draft.dealOfDaySubtitle ?? ""}
            onChange={(e: any) => set("dealOfDaySubtitle", e.target.value)}
            disabled={draft.dealOfDayEnabled === false}
          />
        </div>
        <div className="pt-3">
          <ProductPickerEditor
            idPrefix="dealofday"
            items={draft.dealOfDayItems ?? []}
            onChange={(items) => set("dealOfDayItems", items)}
            disabled={draft.dealOfDayEnabled === false}
          />
        </div>
      </Section>

      <Section title="Hero Banner (Home page slides)">
        <div className="text-xs text-gray-400 mb-1 px-1">
          Manage your own Home page banner slides — add as many as you like, edit or remove any of them. Leave empty to keep the automatic banner built from your categories instead.
        </div>
        <Toggle
          label="Show the two category tiles beside the banner — turn this off and the banner takes the full width"
          checked={draft.heroBannerShowCategoryTiles !== false}
          onChange={(v: boolean) => set("heroBannerShowCategoryTiles", v)}
        />
        <div className="pt-2" />
        <HeroBannerSlidesEditor
          slides={draft.heroBannerSlides ?? []}
          onChange={(slides) => set("heroBannerSlides", slides)}
        />
      </Section>

      <Section title="Promo Banners (between Featured Products and New Arrivals)">
        <div className="text-xs text-gray-400 mb-1 px-1">
          Manage the promo tiles shown between Featured Products and New Arrivals — add as many as you like, edit or remove any of them. Leave empty to keep the default two tiles.
        </div>
        <HeroBannerSlidesEditor
          slides={draft.promoBanners ?? []}
          onChange={(slides) => set("promoBanners", slides)}
        />
      </Section>

      <Section title="Trust Bar Stats (Home page)">
        <div className="text-xs text-gray-400 mb-1 px-1">
          The stat tiles shown under "Fast, Reliable Delivery" etc. on the Home page (e.g. "12,400+ / Active retail partners"). Add as many as you like, edit or remove any of them. Leave empty to keep the default placeholder numbers.
        </div>
        <BusinessStatsEditor
          stats={draft.businessStats ?? []}
          onChange={(stats) => set("businessStats", stats)}
        />
      </Section>

      <div className="flex justify-end">
        <Button variant="outline" onClick={handleSave} isLoading={saving}>
          {saving ? "Saving…" : "Save Website Settings"}
        </Button>
      </div>
    </div>
  );
};

/* =====================================================================
   PRODUCT PICKER — shared by Featured Products, New Arrivals and Deal of
   the Day. Search/select one of the admin's own products, optionally pick
   which unit (Piece, Dozen, ...) to feature, add it to the list; each row
   can be removed again. Each section keeps its own independent list.
   ===================================================================== */

const ProductPickerEditor: React.FC<{
  idPrefix: string;
  items: { productid: string; unitid?: string | null }[];
  onChange: (items: { productid: string; unitid?: string | null }[]) => void;
  disabled?: boolean;
}> = ({ idPrefix, items, onChange, disabled }) => {
  const { data } = useProductServicesQuery();
  const products = useMemo(() => data?.getProductServices ?? [], [data]);

  const [pendingProductId, setPendingProductId] = useState("");
  const [pendingUnitId, setPendingUnitId] = useState("");

  const productOptions = useMemo(
    () => products.map((p: any) => ({ value: p.id, label: p.name })),
    [products]
  );

  const pendingProduct = useMemo(
    () => products.find((p: any) => p.id === pendingProductId),
    [products, pendingProductId]
  );

  const unitOptions = useMemo(() => {
    const unitprices = pendingProduct?.productvariants?.[0]?.unitprices ?? [];
    return unitprices
      .filter((u: any) => u.unitid?.id)
      .map((u: any) => ({
        value: u.unitid.id,
        label: u.quantity > 1 ? `${u.quantity} × ${u.unitid.unitname}` : u.unitid.unitname,
      }));
  }, [pendingProduct]);

  const describe = (item: { productid: string; unitid?: string | null }) => {
    const product = products.find((p: any) => p.id === item.productid);
    if (!product) return { name: "Unknown product", unit: "" };
    const unitprices = product.productvariants?.[0]?.unitprices ?? [];
    const match = item.unitid ? unitprices.find((u: any) => u.unitid?.id === item.unitid) : null;
    const unit = match ? (match.quantity > 1 ? `${match.quantity} × ${match.unitid.unitname}` : match.unitid.unitname) : "";
    return { name: product.name, unit };
  };

  const addItem = () => {
    if (!pendingProductId || disabled) return;
    const next = { productid: pendingProductId, unitid: pendingUnitId || null };
    const exists = items.some((i) => i.productid === next.productid && (i.unitid || null) === next.unitid);
    if (!exists) onChange([...items, next]);
    setPendingProductId("");
    setPendingUnitId("");
  };

  const removeItem = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Selected products ({items.length})
      </div>

      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map((item, idx) => {
            const { name, unit } = describe(item);
            return (
              <div key={`${item.productid}-${item.unitid ?? ""}-${idx}`} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2">
                <div className="text-sm">
                  <span className="font-medium text-gray-800">{name}</span>
                  {unit && <span className="ml-2 text-xs text-gray-500">({unit})</span>}
                </div>
                <Button variant="ghost" className="!px-2 !py-1 text-red-600" onClick={() => removeItem(idx)} disabled={disabled}>
                  Remove
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[2fr_1.3fr_auto] gap-2 items-end">
        <FormField
          label="Product"
          name={`${idPrefix}Product`}
          type="select"
          searchable
          options={productOptions}
          value={pendingProductId}
          onChange={(e: any) => {
            setPendingProductId(e.target.value);
            setPendingUnitId("");
          }}
          disabled={disabled}
        />
        <FormField
          label="Unit / Variant (optional)"
          name={`${idPrefix}Unit`}
          type="select"
          searchable
          options={unitOptions}
          value={pendingUnitId}
          onChange={(e: any) => setPendingUnitId(e.target.value)}
          disabled={disabled || !pendingProductId || unitOptions.length === 0}
        />
        <Button variant="outline" onClick={addItem} disabled={disabled || !pendingProductId}>
          Add
        </Button>
      </div>
    </div>
  );
};

/* =====================================================================
   HERO BANNER SLIDES — admin-managed list, add/edit/remove any number.
   ===================================================================== */

const HeroBannerSlidesEditor: React.FC<{
  slides: { image?: string; title?: string; subtitle?: string; cta?: string; link?: string; _file?: File }[];
  onChange: (slides: { image?: string; title?: string; subtitle?: string; cta?: string; link?: string; _file?: File }[]) => void;
}> = ({ slides, onChange }) => {
  const updateSlide = (idx: number, patch: Partial<{ image: string; title: string; subtitle: string; cta: string; link: string; _file: File }>) => {
    onChange(slides.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const removeSlide = (idx: number) => {
    releasePreview(slides[idx]);
    // The file on the server, if this slide had a saved image, is deleted when
    // the settings are saved — not now, so backing out changes nothing.
    onChange(slides.filter((_, i) => i !== idx));
  };

  /** Drop a preview of a picked-but-never-uploaded file; nothing else frees it. */
  const releasePreview = (slide?: { image?: string; _file?: File }) => {
    if (slide?._file && slide.image?.startsWith("blob:")) URL.revokeObjectURL(slide.image);
  };

  const clearSlideImage = (idx: number) => {
    releasePreview(slides[idx]);
    onChange(slides.map((s, i) => (i === idx ? { ...s, image: "", _file: undefined } : s)));
  };

  const addSlide = () => {
    onChange([...slides, { image: "", title: "", subtitle: "", cta: "", link: "" }]);
  };

  const handleImagePick = (idx: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Preview immediately (like the product form) — the real upload only
    // happens when "Save Website Settings" is clicked.
    releasePreview(slides[idx]);
    updateSlide(idx, { image: URL.createObjectURL(file), _file: file });
  };

  return (
    <div className="space-y-4">
      {slides.map((slide, idx) => (
        <div key={idx} className="rounded-lg border border-gray-200 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Slide {idx + 1}</span>
            <Button variant="ghost" className="!px-2 !py-1 text-red-600" onClick={() => removeSlide(idx)}>
              Remove
            </Button>
          </div>

          <div className="flex items-start gap-4">
            <FormField
              label="Banner Image"
              name={`heroBannerImage-${idx}`}
              type="file"
              accept="image/*"
              onChange={handleImagePick(idx)}
              previewUrl={slide.image}
            />
            <div className="shrink-0">
              <label className="mb-1 block text-sm font-medium text-gray-700">Preview</label>
              {slide.image ? (
                <div className="relative h-20 w-36">
                  <img
                    src={slide.image}
                    alt={`Slide ${idx + 1} preview`}
                    className="h-20 w-36 rounded-lg border border-gray-200 object-cover"
                  />
                  {/* Lets a slide keep its copy but lose its picture. Without
                      this the only way to drop an image was to delete the whole
                      slide and type it out again. */}
                  <button
                    type="button"
                    title="Remove image"
                    onClick={() => clearSlideImage(idx)}
                    className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-red-600 text-[10px] font-bold leading-none text-white hover:bg-red-700"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex h-20 w-36 items-center justify-center rounded-lg border border-dashed border-gray-300 text-xs text-gray-400">
                  No image
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="Title"
              name={`heroBannerTitle-${idx}`}
              placeholder="e.g. Big Diwali Sale"
              value={slide.title ?? ""}
              onChange={(e: any) => updateSlide(idx, { title: e.target.value })}
            />
            <FormField
              label="Subtitle"
              name={`heroBannerSubtitle-${idx}`}
              placeholder="e.g. Up to 40% off, this week only"
              value={slide.subtitle ?? ""}
              onChange={(e: any) => updateSlide(idx, { subtitle: e.target.value })}
            />
            <FormField
              label="Button Text"
              name={`heroBannerCta-${idx}`}
              placeholder="e.g. Shop the Sale"
              value={slide.cta ?? ""}
              onChange={(e: any) => updateSlide(idx, { cta: e.target.value })}
            />
            <FormField
              label="Button Link (relative, e.g. /shop)"
              name={`heroBannerLink-${idx}`}
              placeholder="/shop"
              value={slide.link ?? ""}
              onChange={(e: any) => updateSlide(idx, { link: e.target.value })}
            />
          </div>
        </div>
      ))}

      <Button variant="outline" onClick={addSlide}>+ Add Slide</Button>
    </div>
  );
};

/* =====================================================================
   TRUST BAR STATS — simple label/value tiles for the Home page's stat
   strip (e.g. "12,400+ / Active retail partners"). Same add/edit/remove
   pattern as the banner slide editors, just without the image upload.
   ===================================================================== */

// The Home page renders these in a fixed 4-column strip (sm:grid-cols-4) —
// a 5th tile would just wrap awkwardly, so the editor caps it here instead
// of letting the admin add more than the layout can actually show.
const MAX_BUSINESS_STATS = 4;

const BusinessStatsEditor: React.FC<{
  stats: { label?: string; value?: string }[];
  onChange: (stats: { label?: string; value?: string }[]) => void;
}> = ({ stats, onChange }) => {
  const atLimit = stats.length >= MAX_BUSINESS_STATS;

  const updateStat = (idx: number, patch: Partial<{ label: string; value: string }>) => {
    onChange(stats.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const removeStat = (idx: number) => {
    onChange(stats.filter((_, i) => i !== idx));
  };

  const addStat = () => {
    if (atLimit) return;
    onChange([...stats, { label: "", value: "" }]);
  };

  return (
    <div className="space-y-4">
      {stats.map((stat, idx) => (
        <div key={idx} className="rounded-lg border border-gray-200 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Stat {idx + 1}</span>
            <Button variant="ghost" className="!px-2 !py-1 text-red-600" onClick={() => removeStat(idx)}>
              Remove
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="Value"
              name={`businessStatValue-${idx}`}
              placeholder="e.g. 12,400+"
              value={stat.value ?? ""}
              onChange={(e: any) => updateStat(idx, { value: e.target.value })}
            />
            <FormField
              label="Label"
              name={`businessStatLabel-${idx}`}
              placeholder="e.g. Active retail partners"
              value={stat.label ?? ""}
              onChange={(e: any) => updateStat(idx, { label: e.target.value })}
            />
          </div>
        </div>
      ))}

      <Button variant="outline" onClick={addStat} disabled={atLimit}>
        {atLimit ? `Max ${MAX_BUSINESS_STATS} stats` : "+ Add Stat"}
      </Button>
    </div>
  );
};

/* =====================================================================
   SUB-MODULES TAB — configure allowed modules for children (Admin -> Branch or Branch -> Staff)
   ===================================================================== */

const SubModulesTab: React.FC<{
  scope: "branch" | "staff";
  title: string;
  dispatch: any;
  selectedTargetId: string;          // ← from global dropdown
  parentAllowed: string[];           // ← strict parent chain
}> = ({ scope, title, dispatch, selectedTargetId, parentAllowed }) => {
  const [draft, setDraft] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);

  const { data: branchesData, refetch: refetchBranches } = useBranchesQuery();
  const { data: staffData, refetch: refetchStaff } = useStaffQuery();
  const { editBranchMutation } = useBranchMutations();
  const { editStaffMutation } = useStaffMutations();

  // Build lookup for current target's existing allowedmodules
  const targets = useMemo(() => {
    if (scope === "branch") {
      return (branchesData?.getBranches ?? []).map((b: any) => ({
        id: b.id,
        name: b.branchname,
        currentAllowed: b.allowedmodules, // Preserve null if not set
      }));
    }
    return (staffData?.getStaffAccounts ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
      currentAllowed: s.allowedmodules, // Preserve null if not set
    }));
  }, [scope, branchesData, staffData]);

  // When target changes, load its existing modules (or default to parent)
  useEffect(() => {
    const selected = targets.find((t) => t.id === selectedTargetId);
    if (selected) {
      // null/undefined = "never set, use parent default"; array (even []) = "explicit selection"
      const current =
        selected.currentAllowed !== null && selected.currentAllowed !== undefined
          ? selected.currentAllowed
          : parentAllowed;
      // STRICT: intersect with parentAllowed — child can never have more than parent
      setDraft(current.filter((id: string) => parentAllowed.map((p) => p.toLowerCase()).includes(id.toLowerCase())));
    } else {
      setDraft([]);
    }
    setDirty(false);
  }, [selectedTargetId, targets, parentAllowed]);

  const handleSave = async () => {
    if (!selectedTargetId) return;
    try {
      // STRICT: final save also intersects with parentAllowed
      const cleaned = draft.filter((id) =>
        parentAllowed.map((p) => p.toLowerCase()).includes(id.toLowerCase())
      );
      const input = { allowedmodules: cleaned };
      if (scope === "branch") {
        await editBranchMutation({ variables: { id: selectedTargetId, input } });
        // Refetch so Apollo cache has the updated allowedmodules
        await refetchBranches();
      } else {
        await editStaffMutation({ variables: { id: selectedTargetId, input } });
        // Refetch so Apollo cache has the updated allowedmodules
        await refetchStaff();
      }
      dispatch(showMessage({ message: "Modules updated successfully.", type: "success" }));
      setDirty(false);
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Save failed.", type: "error" }));
    }
  };

  const toggleOne = (id: string) => {
    setDirty(true);
    setDraft((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // STRICT: only show modules the parent (admin/branch) is allowed
  const eligibleModules = useMemo(
    () =>
      ADMIN_REGISTER_MODULES.filter((m) => {
        if (scope === "staff") {
          return ["accounts", "salesorder", "attendance", "posdashboard"].includes(m.id);
        }
        return parentAllowed.map((id) => id.toLowerCase()).includes(m.id.toLowerCase());
      }),
    [parentAllowed, scope]
  );

  const grouped = useMemo(() => {
    const map: Record<string, typeof ADMIN_REGISTER_MODULES> = {};
    eligibleModules.forEach((m) => {
      (map[m.section] ||= [] as any).push(m);
    });
    return map;
  }, [eligibleModules]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 font-medium">{title}</div>
      {Object.entries(grouped).map(([section, items]) => (
        <div key={section} className="bg-white border rounded-lg p-3">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {SECTION_LABELS[section as keyof typeof SECTION_LABELS]}
            </div>
            <label className="flex items-center gap-2 text-[10px] font-bold text-blue-600 uppercase cursor-pointer">
              <input
                type="checkbox"
                className="scale-90"
                checked={items.every((m: any) => draft.includes(m.id))}
                onChange={() => {
                  setDirty(true);
                  const sectionIds = items.map((m: any) => m.id);
                  const allSelected = sectionIds.every((id) => draft.includes(id));
                  if (allSelected) {
                    setDraft((prev) => prev.filter((id) => !sectionIds.includes(id)));
                  } else {
                    setDraft((prev) => Array.from(new Set([...prev, ...sectionIds])));
                  }
                }}
              />
              Select All {SECTION_LABELS[section as keyof typeof SECTION_LABELS]}
            </label>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-sm">
            {items.map((m: any) => (
              <label
                key={m.id}
                className={`flex items-center gap-2 px-2 py-1 rounded border ${
                  draft.includes(m.id) ? "bg-blue-50 border-blue-200" : "bg-white border-gray-200"
                }`}
              >
                <input type="checkbox" checked={draft.includes(m.id)} onChange={() => toggleOne(m.id)} />
                <span className="font-medium truncate">{m.label}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
      <div className="flex justify-end">
        <Button variant="outline" onClick={handleSave} disabled={!dirty}>
          Save Allowance
        </Button>
      </div>
    </div>
  );
};

const PermissionsTab: React.FC<{
  scope: "admin" | "branch" | "staff";
  scopeid?: string;
  title: string;
  dispatch: any;
  effectiveOverlay?: any;
  parentAllowed?: string[];
}> = ({ scope, scopeid, title, dispatch, effectiveOverlay, parentAllowed }) => {
  const [load, { data, loading }] = usePermissionsLazy();
  const { setPermissions } = usePermissionsMutations();
  const [draft, setDraft] = useState<any>(null);

  useEffect(() => {
    if (scopeid) load({ variables: { scope, scopeid } });
  }, [scope, scopeid, load]);

  useEffect(() => {
    if (data?.getPermissions) setDraft(data.getPermissions.permissions || {});
  }, [data]);

  const visibleModules = useMemo(() => {
    let list = MODULES.filter((m) => m.section !== "system");
    if (scope === "staff") {
      const allowed = ["accounts", "salesorder", "attendance", "posdashboard"];
      list = list.filter(m => allowed.includes(m.id));
    } else if (parentAllowed) {
      list = list.filter(m => parentAllowed.map(id => id.toLowerCase()).includes(m.id.toLowerCase()));
    }
    return list;
  }, [parentAllowed, scope]);

  if (!scopeid) return <div className="text-sm text-gray-500">Pick a target first.</div>;
  if (loading || !draft) return <div className="text-sm text-gray-500">Loading…</div>;

  const ALL_ACTIONS: ModuleAction[] = ["view", "add", "edit", "delete", "print", "return", "cancel", "convert", "whatsapp", "import", "export", "exportexcel", "exportcsv", "exportpdf", "reset"];

  const handleSave = async () => {
    try {
      // CRITICAL: Build a complete permissions object with explicit true/false
      // for every visible module's every action. This prevents the backend from
      // cascading parent defaults (true) for missing/undefined actions.
      const completePerms: Record<string, Record<string, boolean>> = {};
      visibleModules.forEach((m) => {
        completePerms[m.id] = {};
        m.actions.forEach((a) => {
          completePerms[m.id][a] = !!draft?.[m.id]?.[a]; // undefined/missing → false
        });
      });
      await setPermissions({ variables: { scope, scopeid, permissions: completePerms } });
      dispatch(showMessage({ message: "Permissions saved.", type: "success" }));
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Save failed.", type: "error" }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">{title}</div>
      {Object.entries(visibleModules.reduce<Record<string, typeof MODULES>>((acc, m) => { (acc[m.section] ||= [] as any).push(m); return acc; }, {})).map(([section, items]) => {
        // Find all actions supported by at least one module in this section
        const sectionActions = ALL_ACTIONS.filter(a => items.some(m => m.actions.includes(a)));

        return (
          <div key={section} className="bg-white border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {SECTION_LABELS[section as keyof typeof SECTION_LABELS]}
              </div>
              <label className="flex items-center gap-2 text-[10px] font-bold text-blue-600 uppercase cursor-pointer">
                <input
                  type="checkbox"
                  className="scale-90"
                  checked={items.every(m => m.actions.every(a => !!draft?.[m.id]?.[a]))}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setDraft((prev: any) => {
                      const next = { ...prev };
                      items.forEach(m => {
                        next[m.id] = { ...(next[m.id] || {}) };
                        m.actions.forEach(a => {
                          next[m.id][a] = val;
                        });
                      });
                      return next;
                    });
                  }}
                />
                Select All {SECTION_LABELS[section as keyof typeof SECTION_LABELS]}
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left bg-gray-50 border-b">
                    <th className="px-3 py-2 sticky left-0 bg-gray-50 border-r min-w-[150px]">Module</th>
                    {sectionActions.map((a) => (
                      <th key={a} className="px-2 py-2 text-center border-r last:border-r-0">
                        <div className="flex items-center justify-center gap-1.5 min-w-[70px]">
                          <input
                            type="checkbox"
                            className="scale-90"
                            checked={items.every((m) => !m.actions.includes(a) || !!draft?.[m.id]?.[a])}
                            onChange={(e) => {
                              const val = e.target.checked;
                              setDraft((prev: any) => {
                                const next = { ...prev };
                                items.forEach((m) => {
                                  if (m.actions.includes(a)) {
                                    next[m.id] = { ...(next[m.id] || {}), [a]: val };
                                  }
                                });
                                return next;
                              });
                            }}
                          />
                          <span className="capitalize whitespace-nowrap">{ACTION_LABELS[a] || a}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((m) => (
                    <tr key={m.id} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-2 sticky left-0 bg-white border-r font-medium">
                        {m.label}
                      </td>
                      {sectionActions.map((a) => (
                        <td key={a} className="px-2 py-2 text-center border-r last:border-r-0">
                          {m.actions.includes(a) ? (
                            <input
                              type="checkbox"
                              checked={!!draft?.[m.id]?.[a]}
                              onChange={(e) => setDraft((d: any) => ({
                                ...d,
                                [m.id]: { ...(d?.[m.id] || {}), [a]: e.target.checked }
                              }))}
                            />
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      <div className="flex justify-end">
        <Button variant="outline" onClick={handleSave}>Save Permissions</Button>
      </div>
    </div>
  );
};

const AccessTab: React.FC<{
  adminId?: string;
  dispatch: any;
  scopeMode: "branch" | "staff";
  selectedTargetId: string;          // ← from global dropdown
  parentAllowed: string[];           // ← strict parent chain
}> = ({ adminId, dispatch, scopeMode, selectedTargetId, parentAllowed }) => {
  const [load, { data: effectiveData }] = useEffectivePermissionsLazy();

  useEffect(() => {
    if (selectedTargetId) load({ variables: { scope: scopeMode, scopeid: selectedTargetId } });
  }, [scopeMode, selectedTargetId, load]);

  return (
    <div className="space-y-4">
      <PermissionsTab
        scope={scopeMode}
        scopeid={selectedTargetId}
        title={`Per-${scopeMode} override — empty cells inherit from admin defaults`}
        dispatch={dispatch}
        effectiveOverlay={effectiveData?.getEffectivePermissions?.permissions}
        parentAllowed={parentAllowed}
      />
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white border rounded-lg p-4">
    <div className="text-sm font-semibold mb-3 text-gray-700">{title}</div>
    <div className="space-y-2">{children}</div>
  </div>
);

const Toggle: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, checked, onChange }) => (
  <div className="flex items-center justify-between text-sm">
    <span>{label}</span>
    <FormSwitch label="" name={label} checked={!!checked} onChange={(v) => onChange(!!v)} />
  </div>
);
