import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { fullSync, isOnline as checkOnline, isSyncRequired, isSyncWarning, getLastSyncTime } from '@/lib/syncEngine';
import { getPendingCount, getFailedCount } from '@/lib/offlineDb';
import { useAuth } from './AuthContext';

interface OfflineContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  failedOps: number;
  lastSyncTime: number | null;
  syncRequired: boolean;
  syncWarning: boolean;
  syncBlocked: boolean;
  triggerSync: () => Promise<void>;
  triggerPullOnly: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType>({
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  failedOps: 0,
  lastSyncTime: null,
  syncRequired: false,
  syncWarning: false,
  syncBlocked: false,
  triggerSync: async () => {},
  triggerPullOnly: async () => {},
});

export const useOffline = () => useContext(OfflineContext);

export const OfflineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  let profile: any = null;
  try {
    const auth = useAuth();
    profile = auth.profile;
  } catch {
    // AuthProvider not ready yet
  }

  const [online, setOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedOps, setFailedOps] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [syncRequired, setSyncRequired] = useState(false);
  const [syncWarning, setSyncWarning] = useState(false);
  const [syncBlocked, setSyncBlocked] = useState(false);
  const syncingRef = useRef(false);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const checkCounts = async () => {
      setPendingCount(await getPendingCount());
      setFailedOps(await getFailedCount());
    };
    checkCounts();
    const interval = setInterval(checkCounts, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkSync = async () => {
      const required = await isSyncRequired();
      setSyncRequired(required);
      setSyncBlocked(required);
      const warning = await isSyncWarning();
      setSyncWarning(warning);
      const last = await getLastSyncTime();
      setLastSyncTime(last);
    };
    checkSync();
    const interval = setInterval(checkSync, 30000);
    return () => clearInterval(interval);
  }, []);

  const triggerSync = useCallback(async () => {
    if (syncingRef.current || !profile?.business_id || !profile?.branch_id) return;

    const isReallyOnline = await checkOnline();
    if (!isReallyOnline) {
      setOnline(false);
      return;
    }

    syncingRef.current = true;
    setIsSyncing(true);

    try {
      const result = await fullSync(profile.business_id, profile.branch_id);

      if (result.success || result.pushed > 0) {
        setPendingCount(await getPendingCount());
        setFailedOps(await getFailedCount());
        const last = await getLastSyncTime();
        setLastSyncTime(last);
        setSyncRequired(false);
        setSyncBlocked(false);
        setSyncWarning(false);
      }

      if (result.failed > 0) {
        console.warn(`[OfflineContext] ${result.failed} operaciones fallidas`);
      }
    } catch (err: any) {
      console.error('[OfflineContext] Sync error:', err);
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [profile?.business_id, profile?.branch_id]);

  const triggerPullOnly = useCallback(async () => {
    if (syncingRef.current || !profile?.business_id || !profile?.branch_id) return;

    const isReallyOnline = await checkOnline();
    if (!isReallyOnline) { setOnline(false); return; }

    syncingRef.current = true;
    setIsSyncing(true);

    try {
      const { pullCloudData } = await import('@/lib/syncEngine');
      await pullCloudData(profile.business_id, profile.branch_id);
      const last = await getLastSyncTime();
      setLastSyncTime(last);
      setSyncRequired(false);
      setSyncBlocked(false);
      setSyncWarning(false);
    } catch (err: any) {
      console.error('[OfflineContext] Pull error:', err);
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [profile?.business_id, profile?.branch_id]);

  useEffect(() => {
    if (online && profile?.business_id && profile?.branch_id) {
      triggerSync();
    }
  }, [online, profile?.business_id, profile?.branch_id, triggerSync]);

  useEffect(() => {
    if (!online || !profile?.business_id) return;
    const interval = setInterval(() => {
      if (online) triggerSync();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [online, profile?.business_id, triggerSync]);

  return (
    <OfflineContext.Provider value={{
      isOnline: online,
      isSyncing,
      pendingCount,
      failedOps,
      lastSyncTime,
      syncRequired,
      syncWarning,
      syncBlocked,
      triggerSync,
      triggerPullOnly,
    }}>
      {children}
    </OfflineContext.Provider>
  );
};
