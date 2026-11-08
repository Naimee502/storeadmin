// Helpers for pages that save documents which may have been queued offline.
export const OFFLINE_SAVED_MESSAGE = "Saved offline. It will sync when the internet is back.";

// True when a mutation result is the placeholder returned for a queued save.
export function isOfflineSaved(doc: any): boolean {
  return typeof doc?.id === "string" && doc.id.startsWith("offline-");
}
