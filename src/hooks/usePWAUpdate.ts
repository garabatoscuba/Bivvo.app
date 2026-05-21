/// <reference types="vite-plugin-pwa/react" />
import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const isInIframe = (() => {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost = (() => {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return (
    h.includes('id-preview--') ||
    h.includes('lovableproject.com') ||
    h.includes('sandbox.lovable.dev')
  );
})();

const shouldDisableSW = isInIframe || isPreviewHost;

/**
 * Hook principal. Llama SIEMPRE el mismo set de hooks (regla de hooks).
 * Si estamos en preview/iframe: registramos pero inmediatamente desregistramos
 * y limpiamos caches en un effect.
 */
export function usePWAUpdate() {
  const { updateServiceWorker } = useRegisterSW({
    immediate: !shouldDisableSW,
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      if (shouldDisableSW) return;
      const check = () => registration.update().catch(() => {});
      const interval = window.setInterval(check, 60 * 60 * 1000);
      const onVisibility = () => {
        if (document.visibilityState === 'visible') check();
      };
      document.addEventListener('visibilitychange', onVisibility);
      window.addEventListener('focus', check);
      (registration as any).__bivooCleanup = () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('focus', check);
      };
    },
    onRegisterError(error) {
      if (!shouldDisableSW) console.error('SW registration error:', error);
    },
  });

  useEffect(() => {
    if (!shouldDisableSW) return;
    (async () => {
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
        }
        if (typeof caches !== 'undefined') {
          const names = await caches.keys();
          await Promise.all(names.map((n) => caches.delete(n).catch(() => false)));
        }
      } catch (e) {
        console.warn('[PWA] preview cleanup error', e);
      }
    })();
  }, []);

  return { updateServiceWorker };
}
