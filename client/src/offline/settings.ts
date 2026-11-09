// Offline billing is always on (local-first): every device saves first and syncs.

// True on every device; kept as a function so callers read the same way they always have.
export const isOfflineEnabled = (): boolean => true;

// Nothing to switch any more; boot still subscribes to it.
export const modeStore = {
  subscribe(_l: () => void) {
    return () => {};
  },
  getSnapshot: () => "on" as const,
};
