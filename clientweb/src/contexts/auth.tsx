import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { setTokenGetter } from "../graphql/client";

export interface AuthAccount {
  id: string;
  name: string;
  mobile: string;
  email?: string;
}

interface AuthContextValue {
  isLoggedIn: boolean;
  account: AuthAccount | null;
  accessToken: string | null;
  // Called by the Login page once verifyOTP succeeds — this context doesn't
  // run the OTP mutations itself, it just holds the resulting session so the
  // rest of the app (header, account page, order/payment history) can read
  // who's logged in and attach the token to authenticated GraphQL calls.
  setSession: (accessToken: string, account: AuthAccount) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface StoredSession {
  accessToken: string;
  account: AuthAccount;
}

// Real party login — sendOTP/verifyOTP against the same Account/Party model
// and JWT the mobile app (clientapp) uses. Persisted per-store (storeSlug)
// so two different businesses' storefronts in the same browser don't share
// a session, mirroring clientapp's AsyncStorage-persisted auth slice.
export function AuthProvider({ storeSlug, children }: { storeSlug: string; children: ReactNode }) {
  const storageKey = `rkn_storefront_session_${storeSlug}`;

  const [session, setSessionState] = useState<StoredSession | null>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  // The Apollo authLink reads the token through a getter (not React state),
  // so it always sees the latest value even on requests fired outside a
  // render — keep a ref in sync and hand Apollo a stable closure over it.
  const tokenRef = useRef<string | null>(session?.accessToken ?? null);
  useEffect(() => {
    tokenRef.current = session?.accessToken ?? null;
  }, [session]);
  useEffect(() => {
    setTokenGetter(() => tokenRef.current);
  }, []);

  useEffect(() => {
    try {
      if (session) localStorage.setItem(storageKey, JSON.stringify(session));
      else localStorage.removeItem(storageKey);
    } catch {
      // ignore storage errors (e.g. private browsing)
    }
  }, [session, storageKey]);

  const value: AuthContextValue = {
    isLoggedIn: !!session,
    account: session?.account ?? null,
    accessToken: session?.accessToken ?? null,
    setSession: (accessToken, account) => setSessionState({ accessToken, account }),
    logout: () => setSessionState(null),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
