import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { ApolloProvider } from "@apollo/client";
import "./index.css";
import App from "./App";
import apolloClient from "./graphql/client";

// The first path segment IS the store link — yourdomain.com/rudra/shop
// means storeSlug="rudra". Setting it as the router's basename means every
// existing route/<Link to="/shop"> in the app keeps working completely
// unchanged; React Router transparently prefixes them with "/rudra".
// A bare domain (no segment) renders MainDomainLanding instead (see App.tsx).
//
// A handful of segments are the platform's own, not anybody's store handle.
// Without this list, /account-deletion would be looked up as a storeslug and
// answered with "store not found" — and that page has to stay reachable,
// since it is the address filed with Google Play for every app we publish.
// A business therefore cannot claim one of these as its handle; keep this in
// step with the storeslug validation in Business Settings.
const RESERVED_SEGMENTS = new Set(["account-deletion"]);

// ── Custom domains ───────────────────────────────────────────────────────────
// Our own hosts use the /<storeslug> link. Any OTHER host is a business's own
// domain (dkmarketing.com, saved in Business Settings -> Custom Domain): there
// the whole site is that one store, so there is no slug and no basename, and
// the store is looked up by the domain itself.
//
// Add a host here (or in VITE_PLATFORM_HOSTS, comma separated) if the platform
// is ever served from another address of its own.
const PLATFORM_HOSTS = new Set(
  (import.meta.env.VITE_PLATFORM_HOSTS || "localhost,127.0.0.1,rudra.digisysindiatech.com")
    .split(",")
    .map((h: string) => h.trim().toLowerCase())
    .filter(Boolean)
);

const host = window.location.hostname.toLowerCase().replace(/^www\./, "");

// Local testing of a custom domain without DNS: open
//   http://localhost:5174/?domain=dkmarketing.com
// once — it is remembered for this tab until ?domain= (empty) clears it.
const DEV_DOMAIN_KEY = "dev_custom_domain";
let devDomain: string | null = null;
if (host === "localhost" || host === "127.0.0.1") {
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.has("domain")) {
      const v = (q.get("domain") || "").trim().toLowerCase();
      if (v) sessionStorage.setItem(DEV_DOMAIN_KEY, v);
      else sessionStorage.removeItem(DEV_DOMAIN_KEY);
    }
    devDomain = sessionStorage.getItem(DEV_DOMAIN_KEY);
  } catch {
    devDomain = null;
  }
}

const customDomain = devDomain || (PLATFORM_HOSTS.has(host) ? null : host);

const segments = window.location.pathname.split("/").filter(Boolean);
const first = segments[0] ?? null;
const reserved = first && RESERVED_SEGMENTS.has(first) ? first : null;
const storeSlug = reserved || customDomain ? null : first;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ApolloProvider client={apolloClient}>
      <BrowserRouter basename={storeSlug ? `/${storeSlug}` : undefined}>
        <App storeSlug={storeSlug} platformPath={reserved} customDomain={reserved ? null : customDomain} />
      </BrowserRouter>
    </ApolloProvider>
  </StrictMode>
);
