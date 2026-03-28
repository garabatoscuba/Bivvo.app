import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getAllFromStore, putManyInStore } from '@/lib/offlineDb';
import { toast } from '@/hooks/use-toast';

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;

export const useJornadaActiva = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['jornada-activa', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;

      // Try online first
      if (navigator.onLine) {
        try {
          const { data, error } = await supabase
            .from('jornadas')
            .select('*')
            .eq('empleado_id', profile.id)
            .is('cierre_at', null)
            .order('apertura_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (error) throw error;

          // Cache jornada to IndexedDB
          if (data) {
            await putManyInStore('jornadas', [data]);
          }
          return data;
        } catch (err) {
          console.warn('[useJornadaActiva] Online fetch failed, using cache:', err);
        }
      }

      // Offline fallback: read from IndexedDB
      const cached = await getAllFromStore<any>('jornadas', 'by-employee', profile.id);
      // Find the active one (no cierre_at)
      const active = cached
        .filter(j => !j.cierre_at)
        .sort((a, b) => new Date(b.apertura_at).getTime() - new Date(a.apertura_at).getTime());
      return active[0] || null;
    },
    enabled: !!profile?.id,
  });

  const jornadaActiva = !!data;

  // Inactivity tracking
  const [mostrarAlertaInactividad, setMostrarAlertaInactividad] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    if (!jornadaActiva) return;
    timerRef.current = setTimeout(() => {
      setMostrarAlertaInactividad(true);
    }, INACTIVITY_TIMEOUT);
  }, [jornadaActiva, clearTimer]);

  const resetInactividad = useCallback(() => {
    setMostrarAlertaInactividad(false);
    startTimer();
  }, [startTimer]);

  const cerrarPorInactividad = useCallback(async () => {
    if (!data) return;
    const now = new Date();
    const aperturaMs = new Date(data.apertura_at).getTime();
    const duracionMin = Math.floor((now.getTime() - aperturaMs) / 60000);

    await supabase
      .from('jornadas')
      .update({
        cierre_at: now.toISOString(),
        metodo_cierre: 'automatico_inactividad',
        duracion_min: duracionMin,
        incidencia: true,
        notas: 'Cierre automático por inactividad de 30 minutos',
      })
      .eq('id', data.id);

    // Auto-close open cash register
    if (profile?.user_id) {
      await supabase
        .from('cash_registers')
        .update({ status: 'closed', closed_at: now.toISOString(), notes: 'Cierre automático por inactividad' } as any)
        .eq('user_id', profile.user_id)
        .eq('status', 'open');
    }

    setMostrarAlertaInactividad(false);
    clearTimer();
    queryClient.invalidateQueries({ queryKey: ['jornada-activa'] });
    queryClient.invalidateQueries({ queryKey: ['active-cash-register'] });
    toast({ title: 'Jornada cerrada por inactividad', description: 'Tu jornada fue cerrada automáticamente.' });
  }, [data, queryClient, clearTimer]);

  // Set up activity listeners
  useEffect(() => {
    if (!jornadaActiva) {
      clearTimer();
      setMostrarAlertaInactividad(false);
      return;
    }

    const handleActivity = () => {
      if (!mostrarAlertaInactividad) {
        startTimer();
      }
    };

    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, handleActivity, { passive: true }));
    startTimer();

    return () => {
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, handleActivity));
      clearTimer();
    };
  }, [jornadaActiva, mostrarAlertaInactividad, startTimer, clearTimer]);

  return {
    jornadaActiva,
    jornada: data,
    isLoading,
    mostrarAlertaInactividad,
    resetInactividad,
    cerrarPorInactividad,
  };
};
