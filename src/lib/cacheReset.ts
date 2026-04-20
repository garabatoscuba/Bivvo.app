/**
 * Cache reset helper for migrating legacy clients to a new app version.
 * Preserves Supabase auth tokens and offline credentials so users stay logged in.
 */

export const APP_CACHE_VERSION = "2026-04-20-hub-v1";
const VERSION_KEY = "bivoo-cache-version";

const PRESERVED_LS_KEYS = new Set([
  "bivoo-offline-credentials",
  "bivoo-offline-session",
  "bivoo-offline-session-multi",
  VERSION_KEY,
]);

function isPreservedKey(key: string): boolean {
  if (PRESERVED_LS_KEYS.has(key)) return true;
  // Preserve Supabase auth tokens (sb-*-auth-token, etc.)
  if (key.startsWith("sb-")) return true;
  return false;
}

export async function performFullCacheReset(): Promise<void> {
  // 1. Caches (HTTP / workbox)
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (err) {
    console.warn("[cacheReset] caches:", err);
  }

  // 2. Service workers
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch (err) {
    console.warn("[cacheReset] sw:", err);
  }

  // 3. IndexedDB — only bivoo databases (preserve sb-* auth)
  try {
    const anyIDB = indexedDB as any;
    if (typeof anyIDB.databases === "function") {
      const dbs: Array<{ name?: string }> = await anyIDB.databases();
      for (const db of dbs) {
        if (!db.name) continue;
        const lower = db.name.toLowerCase();
        if (lower.startsWith("sb-")) continue;
        if (lower.includes("bivoo") || lower.includes("offline") || lower.includes("workbox")) {
          try {
            indexedDB.deleteDatabase(db.name);
          } catch {
            // silent
          }
        }
      }
    }
  } catch (err) {
    console.warn("[cacheReset] idb:", err);
  }

  // 4. localStorage — preserve auth + offline credentials
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && !isPreservedKey(k)) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch (err) {
    console.warn("[cacheReset] ls:", err);
  }

  // 5. sessionStorage — full clear (no auth lives here)
  try {
    sessionStorage.clear();
  } catch {
    // silent
  }
}

/**
 * Run on app boot. If the cached version is outdated AND there are legacy
 * bivoo-* keys present, perform a full reset and reload.
 * New users (no legacy keys) just get the version stamped, no reload.
 */
export async function runVersionGuard(): Promise<boolean> {
  try {
    const stored = localStorage.getItem(VERSION_KEY);
    if (stored === APP_CACHE_VERSION) return false;

    // Detect legacy state: any bivoo-* key besides version, or stale SW
    let hasLegacy = false;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("bivoo-") && k !== VERSION_KEY) {
        hasLegacy = true;
        break;
      }
    }
    if (!hasLegacy && "serviceWorker" in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        if (regs.length > 0) hasLegacy = true;
      } catch {
        // silent
      }
    }

    if (!hasLegacy) {
      // Fresh install — just stamp version.
      localStorage.setItem(VERSION_KEY, APP_CACHE_VERSION);
      return false;
    }

    console.info("[cacheReset] Legacy version detected, performing full reset…");
    await performFullCacheReset();
    localStorage.setItem(VERSION_KEY, APP_CACHE_VERSION);
    window.location.reload();
    return true;
  } catch (err) {
    console.warn("[cacheReset] guard error:", err);
    return false;
  }
}

/**
 * Manual repair trigger (for UI button). Always resets and reloads.
 */
export async function manualRepairAndReload(): Promise<void> {
  await performFullCacheReset();
  localStorage.setItem(VERSION_KEY, APP_CACHE_VERSION);
  window.location.reload();
}
