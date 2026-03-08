import { useState, useEffect, useCallback } from 'react';
import { syncPendingRecords } from '@/lib/offlineSync';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await syncPendingRecords();
    } catch (err) {
      console.warn('[useOnlineStatus] Sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      handleSync();
    };
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [handleSync]);

  return { isOnline, isSyncing, triggerSync: handleSync };
}
