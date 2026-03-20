import type { User, Session } from '@supabase/supabase-js';

const OFFLINE_SESSION_KEY = 'bivoo-offline-session';

export interface OfflineSessionData {
  user: User;
  session: Session;
  profile: any;
  roles: string[];
  savedAt: string;
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

export function loadOfflineSession(): OfflineSessionData | null {
  try {
    const raw = localStorage.getItem(OFFLINE_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OfflineSessionData;
  } catch {
    return null;
  }
}

export function clearOfflineSession(): void {
  try {
    localStorage.removeItem(OFFLINE_SESSION_KEY);
  } catch {
    // silent
  }
}
