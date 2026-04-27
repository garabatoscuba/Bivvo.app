import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Mantiene viva la sesión de Supabase sin disparar re-renders innecesarios.
 *
 * - Solo refresca el token si está por expirar en menos de 5 minutos.
 *   Esto evita que al volver a la app desde otra (WhatsApp, navegador, etc.)
 *   se emita un evento TOKEN_REFRESHED que provoque re-renders y haga que
 *   componentes con estado local (tabs, filtros) se reinicien.
 * - Supabase ya auto-refresca tokens internamente; este hook solo cubre el
 *   caso de tabs/PWAs que estuvieron pausadas mucho tiempo.
 */
export const useSessionKeepAlive = () => {
  const stateRef = useRef<{
    interval: ReturnType<typeof setInterval> | null;
    lastRefresh: number;
  }>({ interval: null, lastRefresh: 0 });

  useEffect(() => {
    const REFRESH_THRESHOLD_SEC = 5 * 60;
    const MIN_INTERVAL_MS = 2 * 60 * 1000;

    const maybeRefreshSession = async () => {
      if (!navigator.onLine) return;

      const now = Date.now();
      if (now - stateRef.current.lastRefresh < MIN_INTERVAL_MS) return;

      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (!session) return;

        const expiresAt = session.expires_at;
        const nowSec = Math.floor(now / 1000);
        const secondsLeft = expiresAt ? expiresAt - nowSec : 0;

        if (secondsLeft > REFRESH_THRESHOLD_SEC) return;

        stateRef.current.lastRefresh = now;
        await supabase.auth.refreshSession();
      } catch {
        // silencioso
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') maybeRefreshSession();
    };
    const handleFocus = () => maybeRefreshSession();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    stateRef.current.interval = setInterval(maybeRefreshSession, 10 * 60 * 1000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      if (stateRef.current.interval) clearInterval(stateRef.current.interval);
    };
  }, []);
};
