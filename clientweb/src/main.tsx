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
const segments = window.location.pathname.split("/").filter(Boolean);
const storeSlug = segments[0] ?? null;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ApolloProvider client={apolloClient}>
      <BrowserRouter basename={storeSlug ? `/${storeSlug}` : undefined}>
        <App storeSlug={storeSlug} />
      </BrowserRouter>
    </ApolloProvider>
  </StrictMode>
);
