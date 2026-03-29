import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Proactively refreshes the Supabase session to prevent expiry.
 * - Refreshes when the tab regains visibility after being hidden.
 * - Refreshes every 10 minutes while the tab is visible.
 * - Works alongside Supabase's built-in autoRefreshToken.
 */
export const useSessionKeepAlive = () => {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const refreshSession = async () => {
      if (!navigator.onLine) return;

      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          await supabase.auth.refreshSession();
        }
      } catch {
        // Silent — avoid breaking the app if refresh fails
      }
    };

    // Refresh when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        refreshSession();
      }
    };

    // Refresh on window focus (covers alt-tab scenarios)
    const handleFocus = () => {
      if (!navigator.onLine) return;
      refreshSession();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Periodic refresh every 10 minutes
    intervalRef.current = setInterval(refreshSession, 10 * 60 * 1000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);
};
