import { useEffect, useMemo, useState } from "react";
import { useAppSelector } from "../../redux/hooks";

/**
 * Tiled identity watermark, drawn over the whole admin panel.
 *
 * ── Read this before assuming it "secures" anything ─────────────────────────
 * A browser tab CANNOT tell that it is being screen-shared or recorded. There
 * is no API, in any browser, deliberately: the `isScreenCaptured` proposal is
 * still only a proposal, and its own design doc plans to gate it behind an
 * allowlist for financial institutions. So a page cannot black itself out on
 * capture, and anything claiming otherwise (blocking PrintScreen, killing
 * right-click, blurring on window blur) is theatre that a determined person
 * bypasses in seconds while genuine users suffer.
 *
 * What this does instead is make a leak *traceable*: every frame of any
 * recording carries who was logged in and when. That converts "someone demoed
 * our product" from anonymous into attributable, which is what actually deters
 * it. Deterrence, not prevention — the Business Settings copy says so plainly
 * rather than selling false safety.
 *
 * Real prevention on the desktop lives elsewhere: the Electron build calls
 * setContentProtection(true) (see desktop/main.js), which the OS enforces.
 * This overlay still renders there, so a photo of the screen is attributable
 * too.
 *
 * Implementation notes:
 *  - `pointer-events: none` so it can never block a click.
 *  - Rendered as a repeating SVG background, not thousands of DOM nodes, so it
 *    costs one paint and doesn't affect scrolling.
 *  - Hidden in `@media print`, otherwise every invoice and PDF the business
 *    prints would come out defaced.
 */
const ScreenWatermark = () => {
  const settings = useAppSelector((s: any) => s.adminsettings?.settings);
  const { type, admin, branch, staff } = useAppSelector((s: any) => s.auth);

  const enabled = !!settings?.secureScreenAdmin;

  // Re-stamp the time so a recording can be placed to the minute. A frame from
  // 14:05 and one from 15:40 are visibly different, which makes an edited clip
  // harder to pass off.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, [enabled]);

  // ── Desktop build: the part that is actually enforced ────────────────────
  // In the Electron shell, preload.js exposes this bridge and the main process
  // calls BrowserWindow.setContentProtection(). On Windows 10 2004+ that hands
  // the window to SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE) and it
  // disappears from any capture entirely. In a normal browser tab the bridge
  // simply doesn't exist, so this is a no-op and only the watermark applies.
  //
  // Runs on every change of `enabled`, INCLUDING off — otherwise turning the
  // setting off wouldn't restore capture and you couldn't demo the product.
  useEffect(() => {
    const bridge = (window as any).desktopSecurity;
    if (!bridge?.setContentProtection) return;
    bridge.setContentProtection(enabled).catch(() => {
      // Older Windows falls back to a black window rather than a hidden one,
      // and macOS ScreenCaptureKit can defeat it outright. Either way a failure
      // here must not take the panel down — the watermark still applies.
    });
  }, [enabled]);

  // Whoever is actually looking at the screen — not the admin who owns the
  // account. A staff leak must point at the staff member, not their employer.
  const identity = useMemo(() => {
    if (type === "staff" && staff) return { name: staff.name || staff.email || "Staff", id: staff.email || "" };
    if (type === "branch" && branch) return { name: branch.branchname || "Branch", id: branch.mobile || branch.email || "" };
    if (admin) return { name: admin.name || admin.companyName || "Admin", id: admin.mobile || admin.email || "" };
    return null;
  }, [type, admin, branch, staff]);

  const backgroundImage = useMemo(() => {
    if (!enabled || !identity) return "";

    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp =
      `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()} ` +
      `${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const line1 = identity.id ? `${identity.name} · ${identity.id}` : identity.name;

    // Escaped for an SVG data URL: raw & < > would break the XML, and # breaks
    // the url() itself.
    const esc = (v: string) =>
      v
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/#/g, "%23");

    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="340" height="200">` +
      `<g transform="rotate(-28 170 100)" fill="rgba(15,23,42,0.10)" ` +
      `font-family="system-ui,sans-serif" font-size="14" font-weight="600">` +
      `<text x="20" y="92">${esc(line1)}</text>` +
      `<text x="20" y="112" font-size="12" font-weight="400">${esc(stamp)}</text>` +
      `</g></svg>`;

    return `url("data:image/svg+xml;utf8,${svg.replace(/\n/g, "")}")`;
  }, [enabled, identity, now]);

  if (!enabled || !identity) return null;

  return (
    <div
      aria-hidden="true"
      data-screen-watermark=""
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483000, // above modals/toasts, below nothing that matters
        pointerEvents: "none",
        backgroundImage,
        backgroundRepeat: "repeat",
      }}
    >
      {/* Keeps invoices and PDFs clean — the watermark is for the screen only. */}
      <style>{`@media print { [data-screen-watermark] { display: none !important; } }`}</style>
    </div>
  );
};

export default ScreenWatermark;
