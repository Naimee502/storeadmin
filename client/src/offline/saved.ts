// Helpers for pages that save documents which may have been queued offline.
export const OFFLINE_SAVED_MESSAGE = "Saved offline — will sync automatically";

// True when a mutation result is the placeholder returned for a queued save.
export function isOfflineSaved(doc: any): boolean {
  return typeof doc?.id === "string" && doc.id.startsWith("offline-");
}
