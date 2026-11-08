// Open/closed state of the offline sync side panel, shared by the header dot and the floating pill.
export type PanelTab = "review" | "failed" | "waiting";

let tab: PanelTab | null = null;
const listeners = new Set<() => void>();

export const panelStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  getSnapshot: (): PanelTab | null => tab,
};

export function openOfflinePanel(next: PanelTab | null) {
  tab = next;
  listeners.forEach((l) => l());
}
