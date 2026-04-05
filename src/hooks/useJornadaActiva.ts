import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getAllFromStore, putManyInStore } from '@/lib/offlineDb';

export const useJornadaActiva = () => {
  const { profile } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['jornada-activa', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;

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

          if (data) {
            await putManyInStore('jornadas', [data]);
          }
          return data;
        } catch (err) {
          console.warn('[useJornadaActiva] Online fetch failed, using cache:', err);
        }
      }

      const cached = await getAllFromStore<any>('jornadas', 'by-employee', profile.id);
      const active = cached
        .filter(j => !j.cierre_at)
        .sort((a, b) => new Date(b.apertura_at).getTime() - new Date(a.apertura_at).getTime());
      return active[0] || null;
    },
    enabled: !!profile?.id,
  });

  return {
    jornadaActiva: !!data,
    jornada: data,
    isLoading,
  };
};
