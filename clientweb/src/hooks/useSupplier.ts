import { useEffect, useState } from "react";
import { useTenant } from "../contexts/tenant";
import { supplierTokenKey } from "../graphql/queries/supplier";

const EVENT = "supplier-session";
const read = (key: string) => {
  try { return { token: localStorage.getItem(key) || "", name: localStorage.getItem(`${key}:name`) || "" }; } catch { return { token: "", name: "" }; }
};

/** Save (or clear, with no token) the supplier login for one business. */
export const setSupplierSession = (adminid: string | null | undefined, token: string, name = "") => {
  const key = supplierTokenKey(adminid);
  try {
    if (token) { localStorage.setItem(key, token); localStorage.setItem(`${key}:name`, name); }
    else { localStorage.removeItem(key); localStorage.removeItem(`${key}:name`); }
  } catch { /* storage off */ }
  window.dispatchEvent(new Event(EVENT));
};

/** The signed-in supplier on this store, if any. */
export const useSupplier = () => {
  const { adminid } = useTenant();
  const key = supplierTokenKey(adminid);
  const [s, setS] = useState(() => read(key));
  useEffect(() => {
    const sync = () => setS(read(key));
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener("storage", sync); };
  }, [key]);
  return { ...s, signedIn: !!s.token, signOut: () => setSupplierSession(adminid, "") };
};
