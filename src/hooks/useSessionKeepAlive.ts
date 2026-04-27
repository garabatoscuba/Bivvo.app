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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastRefreshRef = useRef<number>(0);

  useEffect(() => {
    const REFRESH_THRESHOLD_SEC = 5 * 60; // refrescar si quedan <5 min
    const MIN_INTERVAL_MS = 2 * 60 * 1000; // no refrescar más seguido que cada 2 min

    const maybeRefreshSession = async () => {
      if (!navigator.onLine) return;

      // Throttle: evita ráfagas de refresh por focus/visibilitychange repetidos
      const now = Date.now();
      if (now - lastRefreshRef.current < MIN_INTERVAL_MS) return;

      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (!session) return;

        const expiresAt = session.expires_at; // segundos epoch
        const nowSec = Math.floor(now / 1000);
        const secondsLeft = expiresAt ? expiresAt - nowSec : 0;

        if (secondsLeft > REFRESH_THRESHOLD_SEC) {
          // Token todavía válido — no hacer nada (evita TOKEN_REFRESHED y re-renders).
          return;
        }

        lastRefreshRef.current = now;
        await supabase.auth.refreshSession();
      } catch {
        // Silencioso — no romper la app si el refresh falla
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        maybeRefreshSession();
      }
    };

    const handleFocus = () => {
      maybeRefreshSession();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Chequeo periódico cada 10 minutos
    intervalRef.current = setInterval(maybeRefreshSession, 10 * 60 * 1000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);
};
