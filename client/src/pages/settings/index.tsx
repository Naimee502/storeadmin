// Settings — central control plane for the admin/branch.
//
// KEY DESIGN
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
import { findSectionPerms, resolveAction } from "../../redux/slices/permissions";
import FormPermissionsTab from "../businesssettings/formpermissionstab";

type TabKey =
  | "general"
  | "branch_modules"
  | "staff_modules"
  | "access"
  | "formperms";

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

  // Admin can manage a Branch OR a Staff member directly (a branch login
  // always manages its own staff).
  const [targetKind, setTargetKind] = useState<"branch" | "staff">("branch");
  const manageStaff = isBranch || (isAdmin && targetKind === "staff");

  const targetOptions = useMemo(() => {
    if (isAdmin && targetKind === "staff") {
      // Same rule as a branch login: only "staff" role (not salesman / delivery boy).
      return (staffData?.getStaffAccounts ?? [])
        .filter((s: any) => (s.role ?? '').toString().toLowerCase() === 'staff')
        .map((s: any) => ({
          value: s.id,
          label: s.branchid?.branchname ? `${s.name} (${s.branchid.branchname})` : s.name,
        }));
    }
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
  }, [isAdmin, isBranch, targetKind, branchesData, staffData]);

  const [selectedTargetId, setSelectedTargetId] = useState<string>("");
  // Switching Branch ↔ Staff clears the pick (ids belong to different lists).
  useEffect(() => { setSelectedTargetId(""); }, [targetKind]);

  // Admin managing a staff member: that staff's branch is the parent level.
  const selectedStaffRec = useMemo(
    () => (manageStaff ? (staffData?.getStaffAccounts ?? []).find((s: any) => s.id === selectedTargetId) : null),
    [manageStaff, staffData, selectedTargetId]
  );
  const staffBranchId: string | undefined = isAdmin ? selectedStaffRec?.branchid?.id : undefined;

  // ── Parent-allowed modules (strict hierarchy) ──
  const parentAllowed = useMemo(() => {
    let list = isAdmin ? admin?.allowedmodules : branch?.allowedmodules;
    if (isAdmin && targetKind === "staff" && staffBranchId) {
      const sb = (branchesData?.getBranches ?? []).find((b: any) => b.id === staffBranchId);
      const bl = sb?.allowedmodules;
      if (bl) {
        const adminLower = list ? list.map((x: string) => x.toLowerCase()) : null;
        list = adminLower ? bl.filter((id: string) => adminLower.includes(id.toLowerCase())) : bl;
      }
    }
    if (list === undefined || list === null) return ADMIN_REGISTER_MODULES.map((m) => m.id);
    // Always surface default-on modules (newly added) so they can be granted /
    // permissioned even for tenants whose allowedmodules predate the module.
    const extra = DEFAULT_ON_MODULE_IDS.filter(
      (id) => !list.map((x: string) => x.toLowerCase()).includes(id.toLowerCase())
    );
    return [...list, ...extra];
  }, [isAdmin, admin, branch, targetKind, staffBranchId, branchesData]);

  // ── Target's effective allowed modules ──
  const targetEffectiveAllowed = useMemo(() => {
    if (!selectedTargetId) return parentAllowed;

    let targetAllowed: string[] | null | undefined = undefined;
    if (isAdmin && targetKind === "branch") {
      const selectedBranch = (branchesData?.getBranches ?? []).find((b: any) => b.id === selectedTargetId);
      targetAllowed = selectedBranch?.allowedmodules;
    } else if (manageStaff) {
      const selectedStaff = (staffData?.getStaffAccounts ?? []).find((s: any) => s.id === selectedTargetId);
      targetAllowed = selectedStaff?.allowedmodules;
    }

    if (targetAllowed === null || targetAllowed === undefined) return parentAllowed;
    const parentLower = parentAllowed.map((p) => p.toLowerCase());
    return targetAllowed.filter((id: string) => parentLower.includes(id.toLowerCase()));
  }, [selectedTargetId, parentAllowed, isAdmin, manageStaff, targetKind, branchesData, staffData]);

  // ── Build visible tabs ──
  // Business tabs: shown to admin when SaaS flags allow (hide ONLY if flag false)
  // Child tabs: Branch Modules + Branch Access for admin, Staff Modules + Staff Access for branch
  const visibleTabs: Array<[TabKey, string]> = useMemo(() => {
    const tabs: Array<[TabKey, string]> = [];

    if (isAdmin && targetKind === "branch") {
      tabs.push(["general", "General"]);
      // Child-management tabs
      tabs.push(["branch_modules", "Branch Modules"]);
      tabs.push(["access", "Branch Access"]);
      tabs.push(["formperms", "Branch Form Permissions"]);
    } else if (manageStaff) {
      tabs.push(["staff_modules", "Staff Modules"]);
      tabs.push(["access", "Staff Access"]);
      tabs.push(["formperms", "Staff Form Permissions"]);
    }
    return tabs;
  }, [isAdmin, targetKind, manageStaff]);

  const [tab, setTab] = useState<TabKey>(visibleTabs[0]?.[0] ?? "access");

  // The logged-in user's own effective form permissions: a branch / staff
  // member can be given at most these fields.
  const myFormPerms = useAppSelector((s: any) => s.permissions?.permissions?.formPermissions || {});
  const [loadBranchEff, { data: branchEffData }] = useEffectivePermissionsLazy({ fetchPolicy: "network-only" });
  useEffect(() => {
    if (staffBranchId) loadBranchEff({ variables: { scope: "branch", scopeid: staffBranchId } });
  }, [staffBranchId, loadBranchEff]);
  const formCeiling =
    isAdmin && targetKind === "staff"
      ? (staffBranchId ? branchEffData?.getEffectivePermissions?.permissions?.formPermissions || {} : myFormPerms)
      : myFormPerms;

  // Auto-fix current tab if it becomes hidden
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.find((t) => t[0] === tab)) {
      setTab(visibleTabs[0][0]);
    }
  }, [visibleTabs, tab]);

  if (type === "staff") {
    return (
      <HomeLayout>
        <div className="w-full p-4 space-y-3">
          <div className="rounded-lg border border-slate-200 bg-white p-3 text-[13px] text-slate-600">
            You don't have permission to open Settings.
          </div>
        </div>
      </HomeLayout>
    );
  }

  return (
    <HomeLayout>
      <div className="w-full p-4 space-y-3">
        <h1 className="text-base font-semibold text-slate-900">Settings</h1>

        {/* ── GLOBAL Selection Dropdown ── */}
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          {isAdmin && (
            <div className="mb-2 inline-flex gap-1 rounded-md bg-slate-100 p-0.5">
              {(["branch", "staff"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTargetKind(k)}
                  className={`h-7 rounded px-3 text-[12px] font-medium ${
                    targetKind === k ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {k === "branch" ? "Branch" : "Staff"}
                </button>
              ))}
            </div>
          )}
          <FormField
            label={isAdmin && targetKind === "branch" ? "Select Branch" : "Select Staff Member"}
            type="select"
            name="selectedTargetId"
            value={selectedTargetId}
            onChange={(e: any) => setSelectedTargetId(e.target.value)}
            options={targetOptions}
            searchable
          />
        </div>

        <div className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-slate-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {visibleTabs.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`h-9 px-3 text-[13px] font-medium whitespace-nowrap outline-none focus-visible:bg-slate-100 rounded-t ${
                tab === key
                  ? "border-b-2 border-indigo-600 text-indigo-700"
                  : "border-b-2 border-transparent text-slate-600 hover:text-slate-900"
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
          <div className="rounded-lg border border-slate-200 bg-white py-6 text-center text-[13px] text-slate-500">
            Please select {isAdmin && targetKind === "branch" ? "a Branch" : "a Staff member"} above to manage settings.
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
            {tab === "staff_modules" && manageStaff && (
              <SubModulesTab
                scope="staff"
                title="Configure modules allowed for this Staff member"
                dispatch={dispatch}
                selectedTargetId={selectedTargetId}
                parentAllowed={parentAllowed}
              />
            )}
            {tab === "formperms" && (
              <FormPermissionsTab
                key={selectedTargetId}
                scope={manageStaff ? "staff" : "branch"}
                scopeid={selectedTargetId}
                dispatch={dispatch}
                ceiling={formCeiling}
                allowedModules={targetEffectiveAllowed}
              />
            )}
            {tab === "access" && (
              <AccessTab
                adminId={adminId}
                dispatch={dispatch}
                scopeMode={manageStaff ? "staff" : "branch"}
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
      ...[...(settings.heroBannerSlides ?? []), ...(settings.promoBanners ?? [])].flatMap(
        (slide: any) => [slide?.image, slide?.video]
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
              const { data: uploadedFile } = await uploadImageMutation({ variables: { file: s._file } }, 'banner');
              if (uploadedFile?.uploadImage?.url) {
                image = uploadedFile.uploadImage.url;
                uploaded.push(image);
              }
            }
            // A blob: url is a preview of a file that never made it up. Storing
            // it would save a link that dies with the tab.
            if (image.startsWith("blob:")) image = "";

            // Optional short video (hero slides). Picked from disk like the
            // image and uploaded through the same mutation — no URL typing.
            let video = s.video ?? "";
            if (s._videoFile) {
              const { data: uploadedVideo } = await uploadImageMutation({ variables: { file: s._videoFile } });
              if (uploadedVideo?.uploadImage?.url) {
                video = uploadedVideo.uploadImage.url;
                uploaded.push(video);
              }
            }
            if (video.startsWith("blob:")) video = "";

            return { image, video, title: s.title ?? "", subtitle: s.subtitle ?? "", cta: s.cta ?? "", link: s.link ?? "" };
          })
        );

      const heroBannerSlides = await uploadSlides(rest.heroBannerSlides);
      const promoBanners = await uploadSlides(rest.promoBanners);

      let brandLogo: string = rest.brandLogo ?? "";
      if (logoFile) {
        const { data: uploadedLogo } = await uploadImageMutation({ variables: { file: logoFile } }, 'logo');
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
        ...[...heroBannerSlides, ...promoBanners].flatMap((slide: any) => [slide.image, slide.video]),
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
    <div className="space-y-3">
      <Section title="App and Web Support & Legal">
        <div className="text-[11px] leading-snug text-slate-400">
          Drives the mobile app's Help &amp; Support contact cards, the Privacy Policy / Terms &amp; Conditions links, the website footer tagline, the "Get the app" link, and the social icons shown on the website footer.
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-3 gap-y-2">
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
            <label className="text-[12px] font-medium text-slate-600">Theme Colour</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Theme colour"
                value={draft.themeBrandColor || DEFAULT_BRAND_COLOR}
                onChange={(e) => set("themeBrandColor", e.target.value.toUpperCase())}
                className="h-8 w-8 shrink-0 cursor-pointer rounded-md border border-slate-300 bg-white p-0.5"
              />
              <input
                type="text"
                value={draft.themeBrandColor ?? ""}
                onChange={(e) => set("themeBrandColor", e.target.value.toUpperCase())}
                placeholder={`${DEFAULT_BRAND_COLOR} (default)`}
                className="h-8 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 text-[13px] outline-none focus:border-indigo-500"
              />
              {draft.themeBrandColor ? (
                <button
                  type="button"
                  title="Back to the default colour"
                  onClick={() => set("themeBrandColor", "")}
                  className="inline-flex h-8 shrink-0 items-center rounded-md border border-slate-300 bg-white px-2 text-[12px] font-medium text-slate-700 hover:bg-slate-50"
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
            <label className="text-[12px] font-medium text-slate-600">Business Logo</label>
            <div className="flex items-center gap-2">
              <label className="flex h-8 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-2 text-[13px] text-slate-500 hover:border-slate-400">
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
                    className="flex h-8 items-center rounded-md px-1 ring-1 ring-black/10"
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
                      className="h-6 w-auto max-w-[110px] object-contain"
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
        <p className="mt-1 text-[11px] leading-snug text-slate-400">
          Footer tagline: leave blank to keep the default line. Social links: the footer only shows an icon once a URL is filled in here.
          Business logo: shown on the website header, footer and login page, and on the app's login screen — leave it empty to keep the first letter of your business name.
          A wide or square PNG works; transparent backgrounds are fine, but avoid a logo that is entirely white, since it sits on a white plate.
          Theme colour: one colour drives the whole palette on your website and app — leave it blank (or press Reset) to keep the default green.
        </p>
      </Section>

      <Section title="Product Image Ratio (Home / Shop cards)">
        <div className="text-[11px] leading-snug text-slate-400">
          The shape of the picture box on product cards. The photo is cropped to fill it, so a catalogue of
          differently sized uploads still lines up. Each surface is set on its own because these grids are not the
          same size — leave one unselected to keep the card height it uses today.
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-2">
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
              <p className="text-[11px] leading-snug text-slate-400">{f.help}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="App & Website Options">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-2">
          <div className="flex flex-col gap-1">
            <FormSwitch
              label="Product Image Download"
              name="allowProductImageDownload"
              checked={draft.allowProductImageDownload !== false}
              onChange={(v) => set("allowProductImageDownload", !!v)}
            />
            <p className="text-[11px] leading-snug text-slate-400">Download button on the product photo (App &amp; Website).</p>
          </div>
          <div className="flex flex-col gap-1">
            <FormSwitch
              label="WhatsApp Chat Button"
              name="showWhatsappChat"
              checked={draft.showWhatsappChat !== false}
              onChange={(v) => set("showWhatsappChat", !!v)}
            />
            <p className="text-[11px] leading-snug text-slate-400">Floating chat button using the WhatsApp Number above (App &amp; Website).</p>
          </div>
          <div className="flex flex-col gap-1">
            <FormSwitch
              label="Shop Infinite Scroll"
              name="websiteShopInfiniteScroll"
              checked={!!draft.websiteShopInfiniteScroll}
              onChange={(v) => set("websiteShopInfiniteScroll", !!v)}
            />
            <p className="text-[11px] leading-snug text-slate-400">Website Shop page loads more on scroll instead of page numbers.</p>
          </div>
        </div>
      </Section>

      <Section title="Website Content">
        <div className="text-[11px] leading-snug text-slate-400">
          Shown directly on your website's About Us / Privacy Policy / Terms &amp; Conditions pages. Leave blank and the page will say content hasn't been added yet.
        </div>
        <div className="space-y-3">
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
        <div className="text-[11px] leading-snug text-slate-400">
          Pick exactly which products show in the Home page's "Featured Products" section. Leave empty to show the live catalog with category tabs instead.
        </div>
        <ProductPickerEditor
          idPrefix="featured"
          items={draft.featuredProductItems ?? []}
          onChange={(items) => set("featuredProductItems", items)}
        />
      </Section>

      <Section title="New Arrivals (Home page)">
        <div className="text-[11px] leading-snug text-slate-400">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-2 pt-1">
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
        <div className="pt-2">
          <ProductPickerEditor
            idPrefix="dealofday"
            items={draft.dealOfDayItems ?? []}
            onChange={(items) => set("dealOfDayItems", items)}
            disabled={draft.dealOfDayEnabled === false}
          />
        </div>
      </Section>

      <Section title="Hero Banner (Home page slides)">
        <div className="text-[11px] leading-snug text-slate-400">
          Manage your own Home page banner slides — add as many as you like, edit or remove any of them. Leave empty to keep the automatic banner built from your categories instead.
        </div>
        <Toggle
          label="Show the two category tiles beside the banner — turn this off and the banner takes the full width"
          checked={draft.heroBannerShowCategoryTiles !== false}
          onChange={(v: boolean) => set("heroBannerShowCategoryTiles", v)}
        />
        <div className="pt-1" />
        <HeroBannerSlidesEditor
          allowVideo
          slides={draft.heroBannerSlides ?? []}
          onChange={(slides) => set("heroBannerSlides", slides)}
        />
      </Section>

      <Section title="Promo Banners (between Featured Products and New Arrivals)">
        <Toggle
          label="Show Promo Banners on website home page"
          checked={draft.websiteShowPromoBanners !== false}
          onChange={(v: boolean) => set("websiteShowPromoBanners", v)}
        />
        <div className="text-[11px] leading-snug text-slate-400 pt-1">
          Manage the promo tiles shown between Featured Products and New Arrivals — add as many as you like, edit or remove any of them. Leave empty to keep the default two tiles.
        </div>
        <div className={draft.websiteShowPromoBanners === false ? "opacity-50 pointer-events-none" : ""}>
          <HeroBannerSlidesEditor
            slides={draft.promoBanners ?? []}
            onChange={(slides) => set("promoBanners", slides)}
          />
        </div>
      </Section>

      <Section title="Trust Bar Stats (Home page)">
        <Toggle
          label="Show Trust Bar stats on website home page"
          checked={draft.websiteShowTrustBar !== false}
          onChange={(v: boolean) => set("websiteShowTrustBar", v)}
        />
        <div className="text-[11px] leading-snug text-slate-400 pt-1">
          The stat tiles shown under "Fast, Reliable Delivery" etc. on the Home page (e.g. "12,400+ / Active retail partners"). Add as many as you like, edit or remove any of them. Leave empty to keep the default placeholder numbers.
        </div>
        <div className={draft.websiteShowTrustBar === false ? "opacity-50 pointer-events-none" : ""}>
          <BusinessStatsEditor
            stats={draft.businessStats ?? []}
            onChange={(stats) => set("businessStats", stats)}
          />
        </div>
      </Section>

      <Section title="Newsletter & Get the App (Home page)">
        <Toggle
          label='Show "Get deals before everyone else" section (newsletter + Get the app) on website home page'
          checked={draft.websiteShowAppSection !== false}
          onChange={(v: boolean) => set("websiteShowAppSection", v)}
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
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Selected products ({items.length})
      </div>

      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map((item, idx) => {
            const { name, unit } = describe(item);
            return (
              <div key={`${item.productid}-${item.unitid ?? ""}-${idx}`} className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-2.5 py-1">
                <div className="text-[13px]">
                  <span className="font-medium text-slate-800">{name}</span>
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

type EditableSlide = {
  image?: string;
  video?: string;
  title?: string;
  subtitle?: string;
  cta?: string;
  link?: string;
  _file?: File;
  _videoFile?: File;
};

/** Largest banner video accepted. Keep clips short — every visitor downloads it. */
const MAX_BANNER_VIDEO_MB = 25;

const HeroBannerSlidesEditor: React.FC<{
  slides: EditableSlide[];
  onChange: (slides: EditableSlide[]) => void;
  /** Hero slides can carry a short video; promo tiles are image-only. */
  allowVideo?: boolean;
}> = ({ slides, onChange, allowVideo = false }) => {
  const dispatch = useAppDispatch();
  const updateSlide = (idx: number, patch: Partial<EditableSlide>) => {
    onChange(slides.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const removeSlide = (idx: number) => {
    releasePreview(slides[idx]);
    releaseVideoPreview(slides[idx]);
    // The file on the server, if this slide had a saved image, is deleted when
    // the settings are saved — not now, so backing out changes nothing.
    onChange(slides.filter((_, i) => i !== idx));
  };

  /** Drop a preview of a picked-but-never-uploaded file; nothing else frees it. */
  const releasePreview = (slide?: EditableSlide) => {
    if (slide?._file && slide.image?.startsWith("blob:")) URL.revokeObjectURL(slide.image);
  };

  const releaseVideoPreview = (slide?: EditableSlide) => {
    if (slide?._videoFile && slide.video?.startsWith("blob:")) URL.revokeObjectURL(slide.video);
  };

  const clearSlideVideo = (idx: number) => {
    releaseVideoPreview(slides[idx]);
    onChange(slides.map((s, i) => (i === idx ? { ...s, video: "", _videoFile: undefined } : s)));
  };

  const handleVideoPick = (idx: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      dispatch(showMessage({ message: "Please choose a video file (MP4 works everywhere).", type: "error" }));
      return;
    }
    if (file.size > MAX_BANNER_VIDEO_MB * 1024 * 1024) {
      dispatch(showMessage({ message: `Video is too large — keep it under ${MAX_BANNER_VIDEO_MB} MB.`, type: "error" }));
      return;
    }
    // Preview now; the upload happens on Save, same as the image.
    releaseVideoPreview(slides[idx]);
    updateSlide(idx, { video: URL.createObjectURL(file), _videoFile: file });
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
    <div className="space-y-3">
      {slides.map((slide, idx) => (
        <div key={idx} className="rounded-lg border border-slate-200 p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Slide {idx + 1}</span>
            <Button variant="ghost" className="!px-2 !py-1 text-red-600" onClick={() => removeSlide(idx)}>
              Remove
            </Button>
          </div>

          <div className="flex items-start gap-3">
            <FormField
              label="Banner Image"
              name={`heroBannerImage-${idx}`}
              type="file"
              accept="image/*"
              onChange={handleImagePick(idx)}
              previewUrl={slide.image}
            />
            <div className="shrink-0">
              <label className="mb-1 block text-[12px] font-medium text-slate-600">Preview</label>
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

          {allowVideo && (
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <FormField
                  label="Banner Video (optional — short MP4)"
                  name={`heroBannerVideo-${idx}`}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,video/*"
                  onChange={handleVideoPick(idx)}
                />
                <p className="mt-1 text-[11px] leading-snug text-slate-400">
                  Up to {MAX_BANNER_VIDEO_MB} MB, plays muted. If you add both an image and a video, the banner shows the image first and then the video as the next slide.
                </p>
              </div>
              <div className="shrink-0">
                <label className="mb-1 block text-[12px] font-medium text-slate-600">Video</label>
                {slide.video ? (
                  <div className="relative h-20 w-36">
                    <video
                      src={slide.video}
                      muted
                      loop
                      autoPlay
                      playsInline
                      className="h-20 w-36 rounded-lg border border-gray-200 bg-black object-cover"
                    />
                    <button
                      type="button"
                      title="Remove video"
                      onClick={() => clearSlideVideo(idx)}
                      className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-red-600 text-[10px] font-bold leading-none text-white hover:bg-red-700"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="flex h-20 w-36 items-center justify-center rounded-lg border border-dashed border-gray-300 text-xs text-gray-400">
                    No video
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-2">
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

// The Home page renders these in a fixed 4-column strip (sm:grid-cols-4)
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
    <div className="space-y-3">
      {stats.map((stat, idx) => (
        <div key={idx} className="rounded-lg border border-slate-200 p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Stat {idx + 1}</span>
            <Button variant="ghost" className="!px-2 !py-1 text-red-600" onClick={() => removeStat(idx)}>
              Remove
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-2">
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
        // Staff get whatever their branch has (branch ∩ business) — parentAllowed
        // already carries that chain, so no hard-coded staff list.
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
    <div className="space-y-3">
      <div className="text-[13px] font-medium text-slate-600">{title}</div>
      {Object.entries(grouped).map(([section, items]) => (
        <div key={section} className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {SECTION_LABELS[section as keyof typeof SECTION_LABELS]}
            </div>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 uppercase cursor-pointer">
              <input
                type="checkbox"
                className="h-3.5 w-3.5"
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-1.5 text-[13px]">
            {items.map((m: any) => (
              <label
                key={m.id}
                className={`flex h-8 items-center gap-2 px-2.5 rounded-md border ${
                  draft.includes(m.id) ? "bg-indigo-50 border-indigo-200" : "bg-white border-slate-200"
                }`}
              >
                <input type="checkbox" className="h-3.5 w-3.5" checked={draft.includes(m.id)} onChange={() => toggleOne(m.id)} />
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
  // Always read the stored document fresh: Access and Form Permissions save
  // the same document, so a cached copy from the other tab would write the
  // other tab's changes back over themselves.
  const [load, { data, loading }] = usePermissionsLazy({ fetchPolicy: "network-only" });
  const { setPermissions } = usePermissionsMutations();
  const [draft, setDraft] = useState<any>(null);

  useEffect(() => {
    if (scopeid) load({ variables: { scope, scopeid } });
  }, [scope, scopeid, load]);

  // Draw the matrix from the SAME rule the app enforces (resolveAction), not
  // from the raw record. A module with no record at all is unconfigured and
  // therefore allowed, so its boxes must start ticked; a module that HAS a
  // record shows exactly what that record grants, and any action missing from
  // it — a capability added in a later release — starts unticked because that
  // is how it now behaves. Saving then writes every box explicitly, so the
  // record can never fall behind the module definition again.
  const seedDraft = (saved: Record<string, any>) => {
    const next: Record<string, any> = { ...(saved || {}) };
    MODULES.forEach((m) => {
      const rec = findSectionPerms(saved || {}, m.id);
      next[m.id] = {};
      m.actions.forEach((a) => {
        next[m.id][a] = resolveAction(rec, a);
      });
    });
    return next;
  };

  useEffect(() => {
    if (!data?.getPermissions) return;
    const saved = data.getPermissions.permissions || {};
    setDraft(scope === "admin" ? seedDraft(saved) : saved);
  }, [data]);

  const visibleModules = useMemo(() => {
    let list = MODULES.filter((m) => m.section !== "system");
    if (parentAllowed) {
      list = list.filter(m => parentAllowed.map(id => id.toLowerCase()).includes(m.id.toLowerCase()));
    }
    return list;
  }, [parentAllowed, scope]);

  if (!scopeid) return <div className="text-sm text-gray-500">Pick a target first.</div>;
  if (loading || !draft) return <div className="text-sm text-gray-500">Loading…</div>;

  const ALL_ACTIONS: ModuleAction[] = ["view", "add", "edit", "delete", "print", "return", "cancel", "convert", "whatsapp", "import", "export", "exportexcel", "exportcsv", "exportpdf", "rearrange", "reset", "clear", "claims"];

  const handleSave = async () => {
    try {
      // CRITICAL: write an explicit true/false for every visible module's every
      // action. A key left out is a key that behaves differently from the box
      // that was drawn for it, which is how Print / WhatsApp ended up showing on
      // orders nobody had granted them to.
      //
      // Start from what is already stored so this save only rewrites the matrix
      // on screen: the same document also holds `formPermissions` and any module
      // hidden by the business's allowed-modules list, and building a fresh
      // object from scratch silently wiped both.
      const stored = data?.getPermissions?.permissions || {};
      const completePerms: Record<string, any> = { ...stored };
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
    <div className="space-y-3">
      <div className="text-[13px] text-slate-600">{title}</div>
      {Object.entries(visibleModules.reduce<Record<string, typeof MODULES>>((acc, m) => { (acc[m.section] ||= [] as any).push(m); return acc; }, {})).map(([section, items]) => {
        // Find all actions supported by at least one module in this section
        const sectionActions = ALL_ACTIONS.filter(a => items.some(m => m.actions.includes(a)));

        return (
          <div key={section} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-b border-slate-200">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {SECTION_LABELS[section as keyof typeof SECTION_LABELS]}
              </div>
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 uppercase cursor-pointer">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5"
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
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-left bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase text-slate-500">
                    <th className="px-2 py-1.5 sticky left-0 bg-slate-50 border-r border-slate-200 min-w-[150px]">Module</th>
                    {sectionActions.map((a) => (
                      <th key={a} className="px-2 py-1.5 text-center border-r border-slate-200 last:border-r-0">
                        <div className="flex items-center justify-center gap-1.5 min-w-[60px]">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5"
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
                          <span className="whitespace-nowrap">{ACTION_LABELS[a] || a}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((m) => (
                    <tr key={m.id} className="border-t border-slate-200 hover:bg-slate-50">
                      <td className="px-2 py-1 sticky left-0 bg-white border-r border-slate-200 text-[13px] font-medium text-slate-800">
                        {m.label}
                      </td>
                      {sectionActions.map((a) => (
                        <td key={a} className="px-2 py-1 text-center border-r border-slate-200 last:border-r-0">
                          {m.actions.includes(a) ? (
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5"
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
    <div className="space-y-3">
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
  <div className="rounded-lg border border-slate-200 bg-white p-3">
    <div className="text-[13px] font-semibold mb-2 text-slate-900">{title}</div>
    <div className="space-y-2">{children}</div>
  </div>
);

const Toggle: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, checked, onChange }) => (
  <div className="flex items-center justify-between text-[13px]">
    <span>{label}</span>
    <FormSwitch label="" name={label} checked={!!checked} onChange={(v) => onChange(!!v)} />
  </div>
);
