/// <reference types="vite-plugin-pwa/react" />
import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Detecta si la app corre dentro de un iframe (caso típico del preview de Lovable).
 */
const isInIframe = (() => {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    // Cross-origin block → asumimos iframe
    return true;
  }
})();

/**
 * Detecta hosts de preview/sandbox de Lovable donde el SW causa más problemas
 * que beneficios (sirve assets cacheados y muestra la app vieja después de
 * publicar cambios).
 */
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
 * Hook usado en preview: NO registra service worker y limpia cualquier SW/cache
 * previamente instalado, para que el preview siempre sirva la versión fresca.
 */
function usePreviewCleanup() {
  useEffect(() => {
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
}

/**
 * Hook usado en producción real (dominio publicado, no iframe): registra el SW
 * con autoUpdate y revisa actualizaciones periódicamente.
 */
function useProductionSW() {
  useRegisterSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // Chequea actualizaciones cada hora y al volver al tab.
      const check = () => registration.update().catch(() => {});
      const interval = window.setInterval(check, 60 * 60 * 1000);
      const onVisibility = () => {
        if (document.visibilityState === 'visible') check();
      };
      document.addEventListener('visibilitychange', onVisibility);
      window.addEventListener('focus', check);
      // Limpieza no estrictamente necesaria (vida del app), pero referenciada:
      (registration as any).__bivooCleanup = () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('focus', check);
      };
    },
    onRegisterError(error) {
      console.error('SW registration error:', error);
    },
  });
}

/**
 * Hook principal. La rama (preview vs producción) se decide UNA sola vez
 * usando constantes de módulo, así no se rompe la regla de hooks de React.
 */
export function usePWAUpdate() {
  if (shouldDisableSW) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    usePreviewCleanup();
  } else {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useProductionSW();
  }
}
