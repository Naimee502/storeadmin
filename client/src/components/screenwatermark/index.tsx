import { useEffect, useMemo, useState } from "react";
import { useAppSelector } from "../../redux/hooks";

/** Tiled login/time watermark that makes screen leaks traceable; deters, doesn't prevent. */
const ScreenWatermark = () => {
  const settings = useAppSelector((s: any) => s.adminsettings?.settings);
  const { type, admin, branch, staff } = useAppSelector((s: any) => s.auth);

  const enabled = !!settings?.secureScreenAdmin;

  // Re-stamp the time so a recording can be dated to the minute.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, [enabled]);

  // Electron only: toggle OS-level capture protection, including turning it off.
  useEffect(() => {
    const bridge = (window as any).desktopSecurity;
    if (!bridge?.setContentProtection) return;
    bridge.setContentProtection(enabled).catch(() => {
      // May fail on older Windows/macOS; the watermark still applies.
    });
  }, [enabled]);

  // Mark the actual viewer, so a staff leak points at that staff member.
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
