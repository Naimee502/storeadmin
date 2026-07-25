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

const columns = [
  {
    title: "Categories",
    links: [
      { label: "Grocery & Staples", to: "/shop" },
      { label: "Mobiles & Electronics", to: "/shop" },
      { label: "Fashion", to: "/shop" },
      { label: "Home & Furniture", to: "/shop" },
      { label: "Beauty & Personal Care", to: "/shop" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About us" },
      { label: "Careers" },
      { label: "Become a Vendor", to: "/login" },
      { label: "Wholesale / Bulk Orders", to: "/login" },
      { label: "Blog" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Login / Sign up", to: "/login" },
      { label: "Order History", to: "/account" },
      { label: "Track Order", to: "/account" },
      { label: "Wishlist", to: "/account" },
      { label: "Returns & Refunds" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help Center" },
      { label: "Shipping Info" },
      { label: "Payment Options" },
      { label: "Terms & Conditions" },
      { label: "Privacy Policy" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-ink-900 text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-6">
          <div className="col-span-2">
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 font-bold text-white">
                R
              </span>
              <span className="text-xl font-extrabold text-white">{siteConfig.name}</span>
            </div>
            <p className="mb-4 text-sm leading-relaxed text-slate-400">
              A multi-category marketplace &amp; B2B ordering platform — one storefront for
              retail shoppers and wholesale/manufacturer party accounts alike.
            </p>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-brand-400" /> {siteConfig.supportPhone}
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-brand-400" /> {siteConfig.supportEmail}
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-brand-400" /> Ahmedabad, India
              </li>
            </ul>
            <div className="mt-5 flex gap-3">
              {[Facebook, Instagram, Twitter, Linkedin].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white hover:bg-brand-600"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title} className="col-span-1">
              <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white">
                {col.title}
              </h4>
              <ul className="space-y-2 text-sm">
                {col.links.map((link) =>
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
          ))}
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} {siteConfig.name}. All rights reserved.</p>
          <div className="flex items-center gap-2">
            {["UPI", "RuPay", "Visa", "Mastercard", "Net Banking", "COD"].map((p) => (
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
