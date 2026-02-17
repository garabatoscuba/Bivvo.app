/// <reference types="vite-plugin-pwa/react" />
import { useRegisterSW } from 'virtual:pwa-register/react';

export function usePWAUpdate() {
  const {
    needRefresh: [needsUpdate, setNeedsUpdate],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        setInterval(() => r.update(), 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('SW registration error:', error);
    },
  });

  const updateApp = () => {
    updateServiceWorker(true);
  };

  const dismissUpdate = () => {
    setNeedsUpdate(false);
  };

  return { needsUpdate, updateApp, dismissUpdate };
}
