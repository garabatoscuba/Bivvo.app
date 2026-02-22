import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useJornadaActiva = () => {
  const { profile } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['jornada-activa', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const { data, error } = await supabase
        .from('jornadas')
        .select('*')
        .eq('empleado_id', profile.id)
        .is('cierre_at', null)
        .order('apertura_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching jornada activa:', error);
        return null;
      }
      return data;
    },
    enabled: !!profile?.id,
  });

  return {
    jornadaActiva: !!data,
    jornada: data,
    isLoading,
  };
};
