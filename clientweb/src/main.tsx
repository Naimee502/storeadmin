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

const segments = window.location.pathname.split("/").filter(Boolean);
const first = segments[0] ?? null;
const reserved = first && RESERVED_SEGMENTS.has(first) ? first : null;
const storeSlug = reserved ? null : first;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ApolloProvider client={apolloClient}>
      <BrowserRouter basename={storeSlug ? `/${storeSlug}` : undefined}>
        <App storeSlug={storeSlug} platformPath={reserved} />
      </BrowserRouter>
    </ApolloProvider>
  </StrictMode>
);
