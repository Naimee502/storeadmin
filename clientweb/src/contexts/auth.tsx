import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface AuthUser {
  name: string;
  mobile: string;
}

interface AuthContextValue {
  isLoggedIn: boolean;
  user: AuthUser | null;
  login: (user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "rkn_storefront_user";

// Minimal client-side auth state — no backend session yet, just tracks
// whether the OTP/register flow on the Login page actually completed, so
// pages like /account (and the header) stop pretending someone's logged in
// when nobody is. Persisted to localStorage so a refresh doesn't log the
// customer back out.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore storage errors (e.g. private browsing)
    }
  }, [user]);

  const value: AuthContextValue = {
    isLoggedIn: !!user,
    user,
    login: (u) => setUser(u),
    logout: () => setUser(null),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
