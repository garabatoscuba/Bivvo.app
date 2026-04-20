import type { User, Session } from '@supabase/supabase-js';

const OFFLINE_SESSION_KEY = 'bivoo-offline-session';
const OFFLINE_CREDENTIALS_KEY = 'bivoo-offline-credentials';
const OFFLINE_SESSION_MULTI_KEY = `${OFFLINE_SESSION_KEY}-multi`;

export interface OfflineSessionData {
  user: User;
  session: Session;
  profile: any;
  roles: string[];
  savedAt: string;
}

interface OfflineCredential {
  email: string;
  hash: string;
  userId: string;
}

/**
 * Simple hash for offline credential verification.
 * NOT for security — just to avoid storing plaintext passwords.
 */
async function hashCredential(email: string, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${email.toLowerCase()}:${password}:bivoo-offline-salt-2024`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function saveOfflineSession(data: Omit<OfflineSessionData, 'savedAt'>): void {
  try {
    const payload: OfflineSessionData = {
      ...data,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(OFFLINE_SESSION_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[offlineSession] Failed to save:', err);
  }
}

/**
 * Save credentials for offline login verification.
 * Stores a SHA-256 hash, never the plaintext password.
 */
export async function saveOfflineCredentials(email: string, password: string, userId: string): Promise<void> {
  try {
    const hash = await hashCredential(email, password);
    const existing = loadAllOfflineCredentials();
    // Update or add
    const idx = existing.findIndex(c => c.email.toLowerCase() === email.toLowerCase());
    const entry: OfflineCredential = { email: email.toLowerCase(), hash, userId };
    if (idx >= 0) {
      existing[idx] = entry;
    } else {
      existing.push(entry);
    }
    localStorage.setItem(OFFLINE_CREDENTIALS_KEY, JSON.stringify(existing));
  } catch (err) {
    console.warn('[offlineSession] Failed to save credentials:', err);
  }
}

/**
 * Verify offline credentials. Returns the userId if match, null otherwise.
 */
export async function verifyOfflineCredentials(email: string, password: string): Promise<string | null> {
  try {
    const hash = await hashCredential(email, password);
    const all = loadAllOfflineCredentials();
    const match = all.find(c => c.email === email.toLowerCase() && c.hash === hash);
    return match ? match.userId : null;
  } catch {
    return null;
  }
}

function loadAllOfflineCredentials(): OfflineCredential[] {
  try {
    const raw = localStorage.getItem(OFFLINE_CREDENTIALS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OfflineCredential[];
  } catch {
    return [];
  }
}

function isValidSession(data: any): data is OfflineSessionData {
  return !!(
    data &&
    typeof data === "object" &&
    data.user?.id &&
    data.session?.access_token &&
    data.profile?.user_id &&
    data.profile?.email
  );
}

export function loadOfflineSession(): OfflineSessionData | null {
  try {
    const raw = localStorage.getItem(OFFLINE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isValidSession(parsed)) {
      console.warn("[offlineSession] Discarded invalid cached session");
      localStorage.removeItem(OFFLINE_SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Load offline session for a specific user by email.
 * Falls back to the default cached session if email matches.
 */
export function loadOfflineSessionByEmail(email: string): OfflineSessionData | null {
  const normalizedEmail = email.toLowerCase();
  const session = loadOfflineSession();
  if (session?.profile?.email?.toLowerCase() === normalizedEmail) {
    return session;
  }

  try {
    const raw = localStorage.getItem(OFFLINE_SESSION_MULTI_KEY);
    if (!raw) return null;
    const all: Record<string, any> = JSON.parse(raw);
    const candidate = all[normalizedEmail];
    if (!candidate || !isValidSession(candidate)) return null;
    return candidate;
  } catch {
    return null;
  }
}

/**
 * Save session indexed by email for multi-user offline support.
 */
export function saveOfflineSessionMulti(email: string, data: Omit<OfflineSessionData, 'savedAt'>): void {
  try {
    const raw = localStorage.getItem(OFFLINE_SESSION_MULTI_KEY);
    const all: Record<string, OfflineSessionData> = raw ? JSON.parse(raw) : {};
    all[email.toLowerCase()] = { ...data, savedAt: new Date().toISOString() };
    localStorage.setItem(OFFLINE_SESSION_MULTI_KEY, JSON.stringify(all));
  } catch (err) {
    console.warn('[offlineSession] Failed to save multi:', err);
  }
}

export function clearOfflineSession(): void {
  try {
    localStorage.removeItem(OFFLINE_SESSION_KEY);
  } catch {
    // silent
  }
}
