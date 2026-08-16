import { useEffect, useMemo, useState } from "react";
import { useTenant } from "../../contexts/tenant";
import { useAuth } from "../../contexts/auth";

/**
 * Tiled identity watermark over the customer-facing storefront.
 *
 * Same honest caveat as the admin panel's copy of this: a browser tab cannot
 * detect that it is being screen-shared or recorded — no browser exposes that,
 * on purpose. So this does not prevent a recording; it makes one attributable,
 * which is what actually stops people passing the product off as their own.
 *
 * On the storefront most visitors are anonymous, so there is often no person to
 * name. In that case we stamp the store and the time instead of inventing an
 * identity — a watermark that says "Guest" everywhere would be noise. Once a
 * party logs in, their name and mobile appear, which is the case that matters:
 * a logged-in session is the one that shows real prices and real ledger data.
 *
 * Hidden in `@media print` so invoices and PDFs come out clean.
 */
const ScreenWatermark = () => {
  const tenant = useTenant();
  const { isLoggedIn, account } = useAuth();

  const enabled = !!tenant.secureScreenWebsite;

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, [enabled]);

  const backgroundImage = useMemo(() => {
    if (!enabled) return "";

    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp =
      `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()} ` +
      `${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const line1 =
      isLoggedIn && account
        ? account.mobile
          ? `${account.name} · ${account.mobile}`
          : account.name
        : tenant.companyName || "";

    if (!line1) return "";

    // & < > " break the SVG's XML; # breaks the surrounding url().
    const esc = (v: string) =>
      v
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/#/g, "%23");

    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="340" height="200">` +
      `<g transform="rotate(-28 170 100)" fill="rgba(15,23,42,0.09)" ` +
      `font-family="system-ui,sans-serif" font-size="14" font-weight="600">` +
      `<text x="20" y="92">${esc(line1)}</text>` +
      `<text x="20" y="112" font-size="12" font-weight="400">${esc(stamp)}</text>` +
      `</g></svg>`;

    return `url("data:image/svg+xml;utf8,${svg}")`;
  }, [enabled, isLoggedIn, account, tenant.companyName, now]);

  if (!enabled || !backgroundImage) return null;

  return (
    <div
      aria-hidden="true"
      data-screen-watermark=""
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483000,
        pointerEvents: "none",
        backgroundImage,
        backgroundRepeat: "repeat",
      }}
    >
      <style>{`@media print { [data-screen-watermark] { display: none !important; } }`}</style>
    </div>
  );
};

export default ScreenWatermark;
