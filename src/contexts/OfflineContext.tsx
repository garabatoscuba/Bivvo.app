import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { fullSync, isOnline as checkOnline, isSyncRequired, getLastSyncTime, pushPendingOperations } from '@/lib/syncEngine';
import { getPendingCount, setSyncMeta } from '@/lib/offlineDb';
import { toast } from '@/hooks/use-toast';

// Import the raw context to avoid the throwing useAuth wrapper
import { useAuth } from './AuthContext';

interface OfflineContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: number | null;
  syncRequired: boolean;
  triggerSync: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType>({
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  lastSyncTime: null,
  syncRequired: false,
  triggerSync: async () => {},
});

export const useOffline = () => useContext(OfflineContext);

export const OfflineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const [online, setOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [syncRequired, setSyncRequired] = useState(false);
  const syncingRef = useRef(false);

  // Listen for online/offline events
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

  // Check pending count periodically
  useEffect(() => {
    const checkPending = async () => {
      const count = await getPendingCount();
      setPendingCount(count);
    };
    checkPending();
    const interval = setInterval(checkPending, 5000);
    return () => clearInterval(interval);
  }, []);

  // Check sync status
  useEffect(() => {
    const checkSync = async () => {
      const required = await isSyncRequired();
      setSyncRequired(required);
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
      
      if (result.success) {
        const count = await getPendingCount();
        setPendingCount(count);
        const last = await getLastSyncTime();
        setLastSyncTime(last);
        setSyncRequired(false);

        if (result.pushed > 0) {
          console.log(`[OfflineContext] ${result.pushed} operaciones sincronizadas`);
        }
      } else {
        console.error('[OfflineContext] Error de sincronización:', result.error);
      }
    } catch (err: any) {
      console.error('[OfflineContext] Sync error:', err);
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [profile?.business_id, profile?.branch_id]);

  // Auto-sync when coming online or when there are pending operations
  useEffect(() => {
    if (online && profile?.business_id && profile?.branch_id) {
      triggerSync();
    }
  }, [online, profile?.business_id, profile?.branch_id, triggerSync]);

  // Periodic auto-sync every 5 minutes when online
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
      lastSyncTime,
      syncRequired,
      triggerSync,
    }}>
      {children}
    </OfflineContext.Provider>
  );
};
