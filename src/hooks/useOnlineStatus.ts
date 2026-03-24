import { useState, useEffect, useCallback, useRef } from 'react';
import { pushPendingOperations } from '@/lib/syncEngine';

export type SyncStatus = 'online' | 'offline' | 'syncing' | 'synced';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(navigator.onLine ? 'online' : 'offline');
  const syncingRef = useRef(false);
  const syncedTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleSync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncStatus('syncing');

    try {
      const result = await pushPendingOperations();
      if (result.pushed > 0) {
        setSyncStatus('synced');
        syncedTimerRef.current = setTimeout(() => setSyncStatus('online'), 3000);
      } else {
        setSyncStatus('online');
      }
    } catch (err) {
      console.warn('[useOnlineStatus] Sync error:', err);
      setSyncStatus('online');
    } finally {
      syncingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      handleSync();
    };
    const onOffline = () => {
      setIsOnline(false);
      setSyncStatus('offline');
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      if (syncedTimerRef.current) clearTimeout(syncedTimerRef.current);
    };
  }, [handleSync]);

  return { isOnline, syncStatus, triggerSync: handleSync };
}
