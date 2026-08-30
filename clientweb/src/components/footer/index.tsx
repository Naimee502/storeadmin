import { Link } from "react-router";
import {
  Facebook,
  Instagram,
  Twitter,
  Linkedin,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";
import { siteConfig } from "../../config/site";
import { useTenant } from "../../contexts/tenant";
import { useCatalog } from "../../hooks/useCatalog";

const accountLinks = [
  { label: "Login / Sign up", to: "/login" },
  { label: "Order History", to: "/account?tab=orders" },
  { label: "Track Order", to: "/account?tab=orders" },
];

const supportLinks = [
  { label: "Help Center" },
  { label: "Shipping Info" },
  { label: "Payment Options" },
  { label: "Terms & Conditions", to: "/terms" },
  { label: "Privacy Policy", to: "/privacy" },
];

const paymentBadges = ["UPI", "RuPay", "Visa", "Mastercard", "Net Banking", "COD"];

export default function Footer() {
  const tenant = useTenant();
  const { companyName, address, supportPhone, supportEmail, socialFacebookUrl, socialInstagramUrl, socialTwitterUrl, socialLinkedinUrl, codOnly, websiteTagline, brandLogo } = tenant;
  const brandName = companyName || siteConfig.name;
  const tagline =
    websiteTagline ||
    "A multi-category marketplace & B2B ordering platform — one storefront for retail shoppers and wholesale/manufacturer party accounts alike.";
  const { categories } = useCatalog();

  // Only show an icon for a network once its link has actually been added
  // in the admin's Settings → General page — no dummy/placeholder icons.
  const socialLinks = [
    { Icon: Facebook, href: socialFacebookUrl },
    { Icon: Instagram, href: socialInstagramUrl },
    { Icon: Twitter, href: socialTwitterUrl },
    { Icon: Linkedin, href: socialLinkedinUrl },
  ].filter((s) => s.href);

  // Cash-on-Delivery-only stores only ever offer COD at checkout, so the
  // other payment badges would be misleading here.
  const visiblePaymentBadges = codOnly ? ["COD"] : paymentBadges;

  return (
    <footer className="bg-ink-900 text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-6">
          <div className="col-span-2">
            <div className="mb-3 flex items-center gap-2">
              {brandLogo ? (
                <img
                  src={brandLogo}
                  alt={brandName}
                  className="h-9 w-auto max-w-[150px] shrink-0 rounded-lg bg-white object-contain p-0.5 ring-1 ring-white/15"
                />
              ) : (
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 font-bold text-white">
                  {brandName[0]?.toUpperCase() ?? "R"}
                </span>
              )}
              <span className="text-xl font-extrabold text-white">{brandName}</span>
            </div>
            <p className="mb-4 text-sm leading-relaxed text-slate-400">{tagline}</p>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-brand-400" /> {supportPhone || siteConfig.supportPhone}
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-brand-400" /> {supportEmail || siteConfig.supportEmail}
              </li>
              {address && (
                <li className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-brand-400" /> {address}
                </li>
              )}
            </ul>
            {socialLinks.length > 0 && (
              <div className="mt-5 flex gap-3">
                {socialLinks.map(({ Icon, href }, i) => (
                  <a
                    key={i}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white hover:bg-brand-600"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="col-span-1">
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white">Categories</h4>
            <ul className="space-y-2 text-sm">
              {categories.length > 0 ? (
                categories.slice(0, 5).map((cat) => (
                  <li key={cat.id}>
                    <Link to={`/shop?category=${cat.id}`} className="text-slate-400 hover:text-brand-300">
                      {cat.name}
                    </Link>
                  </li>
                ))
              ) : (
                <li className="text-slate-500">No categories yet</li>
              )}
            </ul>
          </div>

          <div className="col-span-1">
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white">Company</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/about" className="text-slate-400 hover:text-brand-300">About us</Link>
              </li>
            </ul>
          </div>

          <div className="col-span-1">
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white">Account</h4>
            <ul className="space-y-2 text-sm">
              {accountLinks.map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className="text-slate-400 hover:text-brand-300">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-span-1">
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white">Support</h4>
            <ul className="space-y-2 text-sm">
              {supportLinks.map((link) =>
                link.to ? (
                  <li key={link.label}>
                    <Link to={link.to} className="text-slate-400 hover:text-brand-300">
                      {link.label}
                    </Link>
                  </li>
                ) : (
                  <li key={link.label}>
                    <a href="#" className="text-slate-400 hover:text-brand-300">
                      {link.label}
                    </a>
                  </li>
                )
              )}
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} {brandName}. All rights reserved.</p>
          <div className="flex items-center gap-2">
            {visiblePaymentBadges.map((p) => (
              <span key={p} className="rounded border border-white/10 px-2 py-1 text-[10px] text-slate-400">
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
