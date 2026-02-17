/// <reference types="vite-plugin-pwa/react" />
import { useRegisterSW } from 'virtual:pwa-register/react';

export function usePWAUpdate() {
  useRegisterSW({
    onRegistered(r) {
      if (r) {
        // Check for updates every 24 hours
        setInterval(() => r.update(), 24 * 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('SW registration error:', error);
    },
  });
}
