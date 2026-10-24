import { useEffect, useMemo, useState } from "react";
import HomeLayout from "../../layouts/home";
import loginBg from "../../assets/images/loginbg.jpg";
import FormField from "../../components/formfiled";
import Button from "../../components/button";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { showMessage } from "../../redux/slices/message";
import { setAllowedModules } from "../../redux/slices/auth";
import { setAdminSettings } from "../../redux/slices/adminsettings";
import {
  setPermissions as setReduxPermissions,
  findSectionPerms,
  resolveAction,
} from "../../redux/slices/permissions";
import {
  useAdminSettingsQuery,
  useAdminSettingsMutations,
  usePermissionsLazy,
  usePermissionsMutations,
} from "../../graphql/hooks/adminsettings";
import { useAdminsQuery, useUpdateAdminMutation } from "../../graphql/hooks/admin";
import {
  MODULES,
  SECTION_LABELS,
  ADMIN_REGISTER_MODULES,
  DEFAULT_ON_MODULE_IDS,
  ACTION_LABELS,
  type ModuleAction,
} from "../../config/modules";
import FormPermissionsTab from "./formpermissionstab";

// Strips Apollo's injected __typename from every nested object/array before
// sending a query result back as a mutation input — the settings draft here
// includes nested arrays (heroBannerSlides, dealOfDayItems, etc.) fetched by
// the same query, and GraphQL input types reject any field they don't
// declare, __typename included.
const deepStripTypename = (value: any): any =>
  JSON.parse(JSON.stringify(value), (key, val) => (key === "__typename" ? undefined : val));

type TabKey = "general" | "modules" | "permissions" | "formpermissions";

const FEATURE_TO_MODULES: Record<string, string[]> = {
  enableGst: ["reports.gst"],
};

const BusinessSettings = () => {
  const dispatch = useAppDispatch();
  const { type, admin } = useAppSelector((s: any) => s.auth);
  const [selectedAdminId, setSelectedAdminId] = useState<string>("");
  const [tab, setTab] = useState<TabKey>("general");

  const { data: adminsData } = useAdminsQuery();
  const adminOptions = useMemo(() => 
    (adminsData?.getAdmins ?? []).map((a: any) => ({ value: a.id, label: a.companyName || a.name })), 
  [adminsData]);

  // If no manual selection, but we are logged in as admin, default to self
  useEffect(() => {
    if (!selectedAdminId && type === "admin" && admin?.id) {
      setSelectedAdminId(admin.id);
    }
  }, [type, admin, selectedAdminId]);

  const visibleTabs = useMemo<Array<[TabKey, string]>>(() => [
    ["general", "General"],
    ["modules", "Business Modules"],
    ["permissions", "Business Permissions"],
    ["formpermissions", "Business Form Permissions"],
  ], []);

  // Auto-fix current tab if it becomes hidden
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.find(t => t[0] === tab)) {
      setTab(visibleTabs[0][0]);
    }
  }, [visibleTabs, tab]);

  return (
    <HomeLayout hideNav>
      <div 
        className="min-h-screen bg-cover bg-center py-8 px-4"
        style={{ backgroundImage: `url(${loginBg})` }}
      >
        <div className="max-w-[95%] mx-auto bg-white/95 backdrop-blur-sm p-6 rounded-2xl shadow-2xl border border-white/20">
          <h1 className="text-2xl font-bold mb-6 text-gray-800 border-b pb-4">Business Settings</h1>

        <div className="bg-white border rounded-lg p-3 mb-6">
          <FormField
            label="Select Admin / Business"
            type="select"
            name="selectedAdminId"
            value={selectedAdminId}
            onChange={(e: any) => setSelectedAdminId(e.target.value)}
            options={adminOptions}
            searchable
          />
        </div>

        {selectedAdminId ? (
          <>
            {/* Tabs */}
            <div className="flex border-b mb-4 overflow-x-auto">
              {visibleTabs.map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key as TabKey)}
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

            {tab === "general" && (
              <GeneralTab adminId={selectedAdminId} dispatch={dispatch} />
            )}
            {tab === "modules" && (
              <ModulesTab adminId={selectedAdminId} dispatch={dispatch} />
            )}
            {tab === "permissions" && (
              <PermissionsTab
                scope="admin"
                scopeid={selectedAdminId}
                title="Admin defaults — apply to all branches/staff unless overridden"
                dispatch={dispatch}
                parentAllowed={
                  // Use the TARGET admin's allowedmodules so we only show
                  // modules that are actually enabled for this admin.
                  adminsData?.getAdmins?.find((a: any) => a.id === selectedAdminId)?.allowedmodules
                  ?? admin?.allowedmodules
                }
              />
            )}
            {tab === "formpermissions" && (
              <FormPermissionsTab
                scope="admin"
                scopeid={selectedAdminId}
                dispatch={dispatch}
              />
            )}
          </>
        ) : (
          <div className="text-center py-10 bg-white/50 backdrop-blur-sm border rounded-lg text-gray-500">
            Please select an Admin to manage business settings.
          </div>
        )}
        </div>
      </div>
    </HomeLayout>
  );
};

export default BusinessSettings;

// ── Exported for reuse in /settings page when flags are enabled ──
export { GeneralTab as BusinessGeneralTab };
export { ModulesTab as BusinessModulesTab };
export { PermissionsTab as BusinessPermissionsTab };

/* =====================================================================
   GENERAL TAB
   ===================================================================== */


// Usual SSL/TLS port per provider; 465 (implicit SSL) is the safe default.
const defaultSmtpPort = (host: string): number => {
  const h = (host || "").toLowerCase();
  if (/office365|outlook|hotmail|live\.com|sendgrid|mailgun|amazonaws|brevo|sendinblue/.test(h)) return 587;
  return 465;
};

const GeneralTab: React.FC<{ adminId?: string; dispatch: any }> = ({
  adminId,
  dispatch,
}) => {
  const { admin: loggedInAdmin } = useAppSelector((s: any) => s.auth);
  const { data, refetch } = useAdminSettingsQuery(adminId);
  const { updateAdminSettings, testBusinessSmtp, testingSmtp } = useAdminSettingsMutations();
  const settings = data?.getAdminSettings;
  const [draft, setDraft] = useState<any>(null);
  const [smtpTestTo, setSmtpTestTo] = useState("");

  // Switching business: drop the previous one's draft at once so its values
  // (mailbox, password, domain…) are never shown — or saved — under the new one.
  useEffect(() => { setDraft(null); setSmtpTestTo(""); }, [adminId]);
  useEffect(() => {
    if (settings && (!adminId || settings.adminid === adminId || !settings.adminid)) {
      setDraft({ ...settings, smtpPass: "" });
    }
  }, [settings, adminId]);

  if (!draft) return <div className="text-gray-500 text-sm">Loading…</div>;

  const set = (k: string, v: any) => setDraft((d: any) => ({ ...d, [k]: v }));

  const handleSave = async () => {
    if (!adminId) return;
    const { id, adminid, __typename, smtpPassSet, smtpPass, smtpPortTouched, ...rest } = draft;
    const input = deepStripTypename(rest);
    // SMTP sanity: a mailbox needs its host; blank port = the provider default.
    if (input.smtpUser && !input.smtpHost) {
      dispatch(showMessage({ message: "Enter the SMTP Host for the mailbox, or clear the email to use the default Rudra mailbox.", type: "error" }));
      return;
    }
    if (input.smtpUser && !smtpPassSet && !smtpPass) {
      dispatch(showMessage({ message: "Enter the mailbox password.", type: "error" }));
      return;
    }
    if (input.smtpPort === "" || input.smtpPort == null) input.smtpPort = defaultSmtpPort(input.smtpHost || "");
    // Password: only sent when typed — blank keeps the saved one.
    if (smtpPass) input.smtpPass = smtpPass;
    try {
      await updateAdminSettings({ variables: { adminid: adminId, input } });
      const { data: updated } = await refetch();
      if (updated?.getAdminSettings && adminId === loggedInAdmin?.id) {
        dispatch(setAdminSettings(updated.getAdminSettings));
      }
      dispatch(showMessage({ message: "Settings saved.", type: "success" }));
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Save failed.", type: "error" }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Grouped by area, 4 switches per row. The longer explanation of each
          switch is on hover (the ⓘ next to its name), not printed below it. */}
      <Section title="Stock & Inventory">
        <Grid>
          <Toggle label="Auto-deduct stock on Sales Invoice" checked={draft.autoCreateStockOnSalesInvoice} onChange={(v) => set("autoCreateStockOnSalesInvoice", v)} />
          <Toggle label="Auto-add stock on Purchase Invoice" checked={draft.autoCreateStockOnPurchaseInvoice} onChange={(v) => set("autoCreateStockOnPurchaseInvoice", v)} />
          <Toggle label="Auto-add stock on Sales Return" checked={draft.autoCreateStockOnSalesReturn !== false} onChange={(v) => set("autoCreateStockOnSalesReturn", v)} />
          <Toggle label="Auto-deduct stock on Purchase Return" checked={draft.autoCreateStockOnPurchaseReturn !== false} onChange={(v) => set("autoCreateStockOnPurchaseReturn", v)} />
          <Toggle label="Allow negative stock" hint="On: a bill can be saved even when the quantity is more than the stock on hand. Off (recommended): such a Sales Invoice is refused." checked={!!draft.allowNegativeStock} onChange={(v) => set("allowNegativeStock", v)} />
          <Toggle label="Restrict customer order qty by stock" hint="A customer (app / website) cannot put more in the cart than the branch has on hand." checked={draft.restrictQuantityByStock !== false} onChange={(v) => set("restrictQuantityByStock", v)} />
          <Toggle label="Show stock on App / Website" checked={draft.displayStockOnWebsite} onChange={(v) => set("displayStockOnWebsite", v)} />
        </Grid>
      </Section>

      <Section title="Orders & Pricing">
        <Grid>
          <Toggle label="GST tracking" checked={draft.enableGst} onChange={(v) => set("enableGst", v)} />
          <Toggle label="Show prices on App / Website" checked={draft.displayProductPriceOnWebsite} onChange={(v) => set("displayProductPriceOnWebsite", v)} />
          <Toggle label="Show double price (display only)" hint="Catalogue prices on the app and website show at twice the rate. Cart, checkout and the order use the real rate." checked={!!draft.doubleDisplayPrice} onChange={(v: boolean) => set("doubleDisplayPrice", v)} />
          <Toggle label="Encrypt invoice prices" checked={draft.encryptInvoicePrices} onChange={(v) => set("encryptInvoicePrices", v)} />
          <Toggle label="Price-list discount on salesman orders" hint="On: orders a salesman / staff takes get the party's price-list discount. Off: only the party's own App / Website orders get it — salesman orders use the price-list rate with no discount." checked={draft.salesmanPriceListDiscount !== false} onChange={(v: boolean) => set("salesmanPriceListDiscount", v)} />
          <Toggle label="Salesman extra discount on order" hint="The salesman app cart shows an Extra discount (₹ or %) on the whole order." checked={!!draft.salesmanOrderDiscountEnabled} onChange={(v: boolean) => set("salesmanOrderDiscountEnabled", v)} />
          <Toggle label="Deliver via Delivery Boy" hint="Off: the salesman delivers on his route." checked={draft.deliveryMode === "deliveryboy"} onChange={(v: boolean) => set("deliveryMode", v ? "deliveryboy" : "salesman")} />
          <Toggle label="Party manages downline" hint="A channel party handles its sub-parties' orders and payments." checked={!!draft.partyManagesDownline} onChange={(v: boolean) => set("partyManagesDownline", v)} />
          {draft.partyManagesDownline && (
            <Toggle label="Company sees direct-party orders only" hint="On: Sales Orders shows only orders of your direct parties (no parent party, e.g. Super Stockist). Sub-party orders are handled by their parent party. Off: the whole channel's orders, as before." checked={!!draft.directPartyOrdersOnly} onChange={(v: boolean) => set("directPartyOrdersOnly", v)} />
          )}
          {draft.partyManagesDownline && (
            <Toggle label="Track party stock" hint="Each party gets its own stock. A Sales Invoice to a direct party adds to that party's stock (your stock goes down as usual). When a parent party converts its sub-party's order to an invoice, the parent's stock goes down and the sub-party's goes up — your stock is not touched." checked={!!draft.trackPartyStock} onChange={(v: boolean) => set("trackPartyStock", v)} />
          )}
        </Grid>
      </Section>

      <Section title="Payments & Accounts">
        <Grid>
          <Toggle label="Discount & Commission on payment" hint="Enter a discount / commission per invoice while collecting a payment." checked={!!draft.enablePaymentDiscountCommission} onChange={(v: boolean) => set("enablePaymentDiscountCommission", v)} />
          <Toggle label="Last payment on Outstanding reports" hint="Adds last payment date, amount and days ago to Customer / Vendor Outstanding and their exports." checked={!!draft.showLastPaymentOnStatement} onChange={(v: boolean) => set("showLastPaymentOnStatement", v)} />
          <Toggle label="Delete invoice only from inside it" hint="Hides the delete icon on the Sales / Purchase Invoice lists; Delete is inside the invoice instead." checked={!!draft.deleteInvoiceFromInsideOnly} onChange={(v: boolean) => set("deleteInvoiceFromInsideOnly", v)} />
        </Grid>
      </Section>

      <Section title="App & Website Display">
        <Grid>
          <Toggle label="App Home as catalogue (order sheet)" hint="Category → Sub-category → order sheet with quantity boxes, instead of the storefront. Party logins only." checked={!!draft.appCatalogBrowseMode} onChange={(v: boolean) => set("appCatalogBrowseMode", v)} />
          <Toggle label="Auto-scroll category row" hint="Category chips slide by themselves (App Home & Shop, Website)." checked={!!draft.appCategoryAutoScroll} onChange={(v: boolean) => set("appCategoryAutoScroll", v)} />
          <Toggle label="Auto-scroll products" hint="The product list moves slowly by itself (App Home & Shop, Website Deal of the Day)." checked={!!draft.appProductAutoScroll} onChange={(v: boolean) => set("appProductAutoScroll", v)} />
        </Grid>
      </Section>

      <Section title="Salesman & Staff">
        <Grid>
          <Toggle label="Team Leaderboard (salesman app)" hint="Salesmen see each other's target, sales and rank." checked={draft.salesmanLeaderboardEnabled !== false} onChange={(v: boolean) => set("salesmanLeaderboardEnabled", v)} />
          <Toggle label="Geo-fencing for salesmen" hint="Orders / no-order calls only within the set distance of the party's saved location." checked={!!draft.geoFenceEnabled} onChange={(v: boolean) => set("geoFenceEnabled", v)} />
          <Toggle label="Selfie on Punch In" hint="Punch In from the app needs a front-camera selfie." checked={!!draft.attendanceSelfieRequired} onChange={(v: boolean) => set("attendanceSelfieRequired", v)} />
          <Toggle label="Auto punch-out" hint="Anyone still punched in at this time is punched out automatically." checked={draft.autoPunchOutEnabled !== false} onChange={(v: boolean) => set("autoPunchOutEnabled", v)} />
        </Grid>
        {(draft.geoFenceEnabled || draft.autoPunchOutEnabled !== false) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 pt-1">
            {draft.geoFenceEnabled && (
              <FormField
                label="Geo-fence distance (metres)"
                type="number"
                name="geoFenceRadiusM"
                placeholder="200"
                value={draft.geoFenceRadiusM ?? 200}
                onChange={(e: any) => set("geoFenceRadiusM", e.target.value === "" ? 200 : Number(e.target.value))}
              />
            )}
            {draft.autoPunchOutEnabled !== false && (
              <label className="flex flex-col gap-1 text-sm">
                <span>Auto punch-out time</span>
                <input
                  type="time"
                  className="border rounded px-2 py-2 text-sm"
                  value={draft.autoPunchOutTime || "22:00"}
                  onChange={(e) => set("autoPunchOutTime", e.target.value || "22:00")}
                />
              </label>
            )}
          </div>
        )}
      </Section>

      <Section title="Login & Signup">
        <Grid>
          <Toggle label="Panel login email OTP" hint="Admin, Branch & Staff panel login asks for a 6-digit OTP sent to the login's email." checked={!!draft.loginEmailOtp} onChange={(v: boolean) => set("loginEmailOtp", v)} />
          <Toggle label="Party login email OTP" hint="Customer login on the App & Website asks for a 4-digit OTP sent to the party's email." checked={!!draft.partyLoginEmailOtp} onChange={(v: boolean) => set("partyLoginEmailOtp", v)} />
          <Toggle label="New signups need approval" hint="Self-registered customers stay Pending and cannot log in until approved from Party Accounts." checked={!!draft.requirePartyApproval} onChange={(v: boolean) => set("requirePartyApproval", v)} />
        </Grid>
      </Section>

      <Section title="Invoice Print">
        <Grid>
          <Toggle label="Company header" checked={draft.printShowCompanyHeader !== false} onChange={(v: boolean) => set("printShowCompanyHeader", v)} />
          <Toggle label={'Company name in signature'} checked={draft.printShowCompanyNameInSignature !== false} onChange={(v: boolean) => set("printShowCompanyNameInSignature", v)} />
          <Toggle label="Terms & Conditions" checked={draft.printShowTermsAndConditions !== false} onChange={(v: boolean) => set("printShowTermsAndConditions", v)} />
          <Toggle label="Party Previous / Current balance" checked={!!draft.printShowPartyBalance} onChange={(v: boolean) => set("printShowPartyBalance", v)} />
          <Toggle label="E-Way Bill / Distance" checked={draft.printShowEwayBillDistance !== false} onChange={(v: boolean) => set("printShowEwayBillDistance", v)} />
          <Toggle label="Delivery / Due Date" checked={draft.printShowDeliveryDueDate !== false} onChange={(v: boolean) => set("printShowDeliveryDueDate", v)} />
          <Toggle label="GSTIN No." checked={draft.printShowGstin !== false} onChange={(v: boolean) => set("printShowGstin", v)} />
          <Toggle label="HSN column" checked={draft.printShowHsnColumn !== false} onChange={(v: boolean) => set("printShowHsnColumn", v)} />
          <Toggle label="GST% column" checked={draft.printShowGstColumn !== false} onChange={(v: boolean) => set("printShowGstColumn", v)} />
          <Toggle label="Total GST" checked={draft.printShowTotalGst !== false} onChange={(v: boolean) => set("printShowTotalGst", v)} />
        </Grid>
        <div className="pt-1">
          <FormField
            label="Terms & Conditions text (one line per point)"
            name="printTermsAndConditions"
            value={draft.printTermsAndConditions ?? ""}
            onChange={(e: any) => set("printTermsAndConditions", e.target.value)}
            multiline
            disabled={draft.printShowTermsAndConditions === false}
          />
        </div>
      </Section>

      <Section title="Website Storefront">
        <div className="text-xs text-gray-400 mb-1 px-1">
          Controls your customer-facing website (clientweb) link, and which payment methods appear at checkout.
        </div>
        {/* Store handle and custom domain side by side (stacked on small screens). */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <FormField
              label="Website Link (store handle)"
              name="storeslug"
              placeholder="e.g. rudra"
              value={draft.storeslug ?? ""}
              onChange={(e: any) =>
                set("storeslug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
              }
            />
            {draft.storeslug && (
              <p className="mt-1.5 text-xs text-gray-400">
                Your website link:{" "}
                <span className="font-medium text-gray-600">yourdomain.com/{draft.storeslug}</span>{" "}
                — share this with your customers.
              </p>
            )}
          </div>
          <div>
            <FormField
              label="Custom Domain (optional)"
              name="customDomain"
              placeholder="e.g. rudradigisys.com"
              value={draft.customDomain ?? ""}
              onChange={(e: any) => set("customDomain", e.target.value.toLowerCase().replace(/\s/g, ""))}
            />
            <p className="mt-1.5 text-xs text-gray-400">
              {draft.customDomain ? (
                <>
                  Store also opens at{" "}
                  <span className="font-medium text-gray-600">https://{String(draft.customDomain).replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "")}</span>{" "}
                  — set the domain's DNS A record (@ and www) to{" "}
                  <span className="font-medium text-gray-600">72.61.226.71</span>; it goes live with https
                  automatically within ~5 minutes of the DNS update.
                </>
              ) : (
                <>Your own domain (like rudradigisys.com) to open the store directly on it.</>
              )}
            </p>
          </div>
        </div>
        <div className="pt-2">
          <Toggle
            label="Cash on Delivery only (hide UPI / Card / Net Banking / Party billing on website checkout)"
            checked={!!draft.websiteCodOnly}
            onChange={(v: boolean) => set("websiteCodOnly", v)}
          />
        </div>
      </Section>

      {/* The business's own mailbox for OTP mails. Blank = the platform
          mailbox sends them (with the business name as sender name). */}
      <Section title="Email (SMTP) — OTP mails from your own email">
        <div className="text-xs text-gray-400 mb-1 px-1">
          Registration and login OTP mails for this business are sent from this mailbox (e.g.
          veer@dkmarketing.co.in). Leave the email blank to use the default Rudra mailbox. For a
          Hostinger email use host <span className="font-medium text-gray-600">smtp.hostinger.com</span>,
          port <span className="font-medium text-gray-600">465</span>.
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            label="Email (mailbox)"
            type="email"
            name="biz-smtp-mailbox"
            noAutofill
            placeholder="e.g. veer@dkmarketing.co.in"
            value={draft.smtpUser ?? ""}
            onChange={(e: any) => set("smtpUser", e.target.value.trim().toLowerCase())}
          />
          <FormField
            label="Password"
            type="password"
            name="biz-smtp-secret"
            noAutofill
            placeholder={draft.smtpPassSet ? "Saved — leave blank to keep it" : "Mailbox password"}
            value={draft.smtpPass ?? ""}
            onChange={(e: any) => set("smtpPass", e.target.value)}
          />
          <FormField
            label="SMTP Host"
            name="smtpHost"
            placeholder="smtp.hostinger.com"
            value={draft.smtpHost ?? ""}
            onChange={(e: any) => {
              const host = e.target.value.trim().toLowerCase();
              setDraft((d: any) => {
                const next = { ...d, smtpHost: host };
                // Port follows the provider unless the admin typed one himself.
                if (!d.smtpPortTouched) next.smtpPort = defaultSmtpPort(host);
                return next;
              });
            }}
          />
          <FormField
            label="SMTP Port"
            type="number"
            name="smtpPort"
            placeholder="465 (SSL) or 587 (TLS)"
            value={draft.smtpHost ? (draft.smtpPort ?? "") : ""}
            disabled={!draft.smtpHost}
            onChange={(e: any) => setDraft((d: any) => ({
              ...d, smtpPortTouched: true,
              smtpPort: e.target.value === "" ? "" : Number(e.target.value),
            }))}
          />
        </div>
        <p className="mt-1.5 text-xs px-1">
          {draft.smtpUser && draft.smtpHost && (draft.smtpPassSet || draft.smtpPass) ? (
            <span className="text-green-700">OTP mails will be sent from {draft.smtpUser} (after you save).</span>
          ) : (
            <span className="text-gray-400">Not set — OTP mails go from the default Rudra mailbox.</span>
          )}
        </p>
        <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-end">
          <div className="md:w-1/2">
            <FormField
              label="Send a test mail to"
              type="email"
              name="smtpTestTo"
              placeholder="your@email.com"
              value={smtpTestTo}
              onChange={(e: any) => setSmtpTestTo(e.target.value.trim())}
            />
          </div>
          <Button
            variant="outline"
            disabled={!adminId || !smtpTestTo || testingSmtp}
            onClick={async () => {
              try {
                const { data: res } = await testBusinessSmtp({ variables: { adminid: adminId, to: smtpTestTo } });
                dispatch(showMessage({ message: res?.testBusinessSmtp || "Test mail sent.", type: "success" }));
              } catch (e: any) {
                dispatch(showMessage({ message: e?.message || "Test mail failed.", type: "error" }));
              }
            }}
          >
            {testingSmtp ? "Sending…" : "Send Test Mail"}
          </Button>
        </div>
        <p className="mt-1 text-xs text-gray-400 px-1">Save the settings first — the test uses the saved mailbox.</p>
      </Section>

      {/* What each toggle can ACTUALLY enforce differs a lot by platform, and
          quietly implying "on = safe" would be worse than no feature at all.
          So each row states its own real limit inline. */}
      <Section title="Screen Capture Protection">
        <div className="text-xs text-gray-400 mb-1 px-1">
          Stops someone screen-sharing or recording your product to give an unauthorised demo.
          Turn a switch off when <span className="font-medium text-gray-500">you</span> need to demo that surface.
        </div>

        <Toggle
          label="Mobile app — black screen on screen share / recording"
          checked={!!draft.secureScreenApp}
          onChange={(v: boolean) => set("secureScreenApp", v)}
        />
        <p className="-mt-1 mb-2 px-1 text-xs text-gray-400">
          <span className="font-medium text-emerald-600">Android: fully enforced.</span> The OS itself
          blacks out screen share, screen recording and screenshots — nothing can bypass it.{" "}
          <span className="font-medium text-amber-600">iOS: best effort.</span> Apple has no equivalent,
          so the app covers itself in black while a recording or mirroring session is running.
          A single screenshot can't be blocked there, only detected afterwards.
        </p>

        <Toggle
          label="Admin panel — watermark, and capture-block in the desktop app"
          checked={!!draft.secureScreenAdmin}
          onChange={(v: boolean) => set("secureScreenAdmin", v)}
        />
        <p className="-mt-1 mb-2 px-1 text-xs text-gray-400">
          <span className="font-medium text-emerald-600">Desktop app: fully enforced</span> on
          Windows 10 (2004) and newer — the window is removed from any capture entirely.{" "}
          <span className="font-medium text-amber-600">In a browser tab: watermark only.</span> No
          browser tells a page that it's being screen-shared, so a recording can't be prevented
          there — instead every frame carries the logged-in user's name, mobile and the time,
          which makes a leak traceable back to whoever made it.
        </p>

        <Toggle
          label="Customer website — watermark on the storefront"
          checked={!!draft.secureScreenWebsite}
          onChange={(v: boolean) => set("secureScreenWebsite", v)}
        />
        <p className="-mt-1 px-1 text-xs text-gray-400">
          <span className="font-medium text-amber-600">Watermark only</span> — same browser limit as
          above. Doesn't appear on printed invoices or PDFs.
        </p>
      </Section>

      <div className="flex justify-end">
        <Button variant="outline" onClick={handleSave}>Save Business Settings</Button>
      </div>
    </div>
  );
};

const ModulesTab: React.FC<{ adminId?: string; dispatch: any }> = ({
  adminId,
  dispatch,
}) => {
  const { admin: loggedInAdmin } = useAppSelector((s: any) => s.auth);
  const { data: adminsData } = useAdminsQuery();
  const targetAdmin = useMemo(() => adminsData?.getAdmins?.find((a: any) => a.id === adminId), [adminsData, adminId]);

  const { data: settingsData } = useAdminSettingsQuery(adminId);
  const settings = settingsData?.getAdminSettings;
  const [updateAdmin] = useUpdateAdminMutation();

  const myAllowed = loggedInAdmin?.allowedmodules;

  const eligibleModules = useMemo(() => {
    // If myAllowed is null/undefined, show all. If empty [], show nothing.
    if (myAllowed === undefined || myAllowed === null) return ADMIN_REGISTER_MODULES;
    return ADMIN_REGISTER_MODULES.filter(m =>
      DEFAULT_ON_MODULE_IDS.includes(m.id.toLowerCase()) ||
      myAllowed.map(id => id.toLowerCase()).includes(m.id.toLowerCase())
    );
  }, [myAllowed]);

  const allCatalogIds = useMemo(() => eligibleModules.map((m: any) => m.id), [eligibleModules]);
  const [draft, setDraft] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (Array.isArray(targetAdmin?.allowedmodules) && targetAdmin.allowedmodules.length > 0) {
      setDraft(targetAdmin.allowedmodules);
    } else {
      setDraft(allCatalogIds);
    }
  }, [targetAdmin?.allowedmodules, allCatalogIds]);

  const featureDisabledIds = useMemo(() => {
    if (!settings) return new Set<string>();
    const out = new Set<string>();
    Object.entries(FEATURE_TO_MODULES).forEach(([flag, ids]) => {
      if (settings[flag] === false) ids.forEach((id) => out.add(id));
    });
    return out;
  }, [settings]);

  const toggleOne = (id: string) => {
    setDirty(true);
    setDraft((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    if (!adminId) return;
    try {
      const cleaned = draft.filter((id) => !featureDisabledIds.has(id));
      await updateAdmin({ variables: { id: adminId, input: { allowedmodules: cleaned } } });
      if (adminId === loggedInAdmin?.id) {
        dispatch(setAllowedModules(cleaned));
      }
      setDirty(false);
      dispatch(showMessage({ message: "Business modules updated.", type: "success" }));
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Save failed.", type: "error" }));
    }
  };

  const grouped = useMemo(() => {
    const map: Record<string, typeof ADMIN_REGISTER_MODULES> = {};
    eligibleModules.forEach((m) => { (map[m.section] ||= [] as any).push(m); });
    return map;
  }, [eligibleModules]);

  return (
    <div className="space-y-4">
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
            {items.map((m: any) => {
              const featureOff = featureDisabledIds.has(m.id);
              const enabled = !featureOff && draft.includes(m.id);
              return (
                <label key={m.id} className={`flex items-center gap-2 px-2 py-1 rounded border ${featureOff ? "bg-gray-100 text-gray-400" : enabled ? "bg-blue-50 border-blue-200" : "bg-white border-gray-200"}`}>
                  <input type="checkbox" disabled={featureOff} checked={enabled} onChange={() => toggleOne(m.id)} />
                  <span className="font-medium truncate">{m.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
      <div className="flex justify-end">
        <Button variant="outline" onClick={handleSave} disabled={!dirty}>Save Business Modules</Button>
      </div>
    </div>
  );
};

const PermissionsTab: React.FC<{
  scope: "admin";
  scopeid?: string;
  title: string;
  dispatch: any;
  parentAllowed?: string[];
}> = ({ scope, scopeid, title, dispatch, parentAllowed }) => {
  const [load, { data, loading }] = usePermissionsLazy();
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
    setDraft(seedDraft(saved));
  }, [data]);

  const visibleModules = useMemo(() => {
    let list = MODULES.filter((m) => m.section !== "system");
    if (parentAllowed) {
      list = list.filter(m =>
        DEFAULT_ON_MODULE_IDS.includes(m.id.toLowerCase()) ||
        parentAllowed.map(id => id.toLowerCase()).includes(m.id.toLowerCase())
      );
    }
    return list;
  }, [parentAllowed]);

  if (!scopeid || loading || !draft) return <div className="text-sm text-gray-500">Loading…</div>;

  const ALL_ACTIONS: ModuleAction[] = ["view", "add", "edit", "delete", "print", "return", "cancel", "convert", "whatsapp", "import", "export", "exportexcel", "exportcsv", "exportpdf", "rearrange", "reset", "claims"];

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
      const response = await setPermissions({ variables: { scope, scopeid, permissions: completePerms } });
      
      // Update Redux state immediately so changes reflect without reloading
      if (response.data?.setPermissions?.permissions) {
        dispatch(setReduxPermissions(response.data.setPermissions.permissions));
      } else {
        dispatch(setReduxPermissions(completePerms));
      }

      dispatch(showMessage({ message: "Permissions saved.", type: "success" }));
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Save failed.", type: "error" }));
    }
  };

  return (
    <div className="space-y-4">
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
                  checked={items.every(m => 
                    m.actions.every(a => !!draft?.[m.id]?.[a])
                  )}
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
        <Button variant="outline" onClick={handleSave}>Save Business Permissions</Button>
      </div>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white border rounded-lg p-4">
    <div className="text-sm font-semibold mb-3 text-gray-700">{title}</div>
    <div className="space-y-2">{children}</div>
  </div>
);

/** 4 switches per row on wide screens, 2 on tablets, 1 on phones. */
const Grid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">{children}</div>
);

/**
 * One switch as a compact tile: the name on the left (ⓘ shows the details on
 * hover) and a small switch on the right — no "Active / Inactive" text, the
 * switch colour says it.
 */
const Toggle: React.FC<{ label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, hint, checked, onChange }) => (
  <label
    className={`flex cursor-pointer items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs ${checked ? "border-green-200 bg-green-50/50" : "border-gray-200"}`}
    title={hint || label}
  >
    <span className="flex min-w-0 items-center gap-1 leading-tight text-gray-700">
      <span className="truncate">{label}</span>
      {hint && <span className="shrink-0 cursor-help text-[10px] text-gray-400">ⓘ</span>}
    </span>
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      aria-label={label}
      onClick={(e) => { e.preventDefault(); onChange(!checked); }}
      className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${checked ? "bg-green-600" : "bg-gray-300"}`}
    >
      <span className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-3.5" : "translate-x-0.5"}`} />
    </button>
  </label>
);
