const KEY = "platformKey";

export const getPlatformKey = (): string => {
  try { return sessionStorage.getItem(KEY) || ""; } catch { return ""; }
};

export const setPlatformKey = (value: string) => {
  try { sessionStorage.setItem(KEY, value); } catch { /* private mode: asked again next time */ }
};
