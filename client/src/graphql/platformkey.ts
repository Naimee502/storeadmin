const KEY = "platformKey";

export const getPlatformKey = (): string => {
  try { return sessionStorage.getItem(KEY) || ""; } catch { return ""; }
};

export const setPlatformKey = (value: string) => {
  try { sessionStorage.setItem(KEY, value); } catch { /* private mode: asked again next time */ }
};

/** Forget the key and ask again (wrong key, or the server's key changed). */
export const clearPlatformKey = () => {
  try { sessionStorage.removeItem(KEY); } catch { /* nothing saved */ }
  window.location.reload();
};
