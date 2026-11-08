// Entry points used by index.tsx and the layout; all no-ops when offline mode is off.
import type { ApolloClient, NormalizedCacheObject } from "@apollo/client";
import { isOfflineEnabled } from "./settings";
import { clearCacheOnLogout, flushCacheSave, restoreCache } from "./persist";
import { refreshOutbox, startOutbox } from "./outbox";
import { registerServiceWorker, unregisterServiceWorker } from "./sw";
import { startDevice } from "./device";
import { startWarmup } from "./warmup";

// Restores the cache (bounded wait), starts sync and the service worker. Never rejects.
export async function bootOffline(client: ApolloClient<NormalizedCacheObject>): Promise<void> {
  try {
    await restoreCache(client);
  } catch {
    // Start with an empty cache.
  }
  try {
    startOutbox(client);
    startDevice();
    startWarmup();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushCacheSave();
    });
    if (import.meta.env.PROD) registerServiceWorker();
  } catch {
    // The app still works online.
  }
}

// Offline mode is off: remove any worker and caches left from an earlier opt-in.
export function cleanupOfflineArtifacts(): void {
  unregisterServiceWorker();
}

// Called from logout before the session keys are removed.
export function offlineOnLogout(): void {
  if (!isOfflineEnabled()) return;
  void clearCacheOnLogout().then(() => refreshOutbox());
}
