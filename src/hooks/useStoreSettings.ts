import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface DaySchedule {
  open: string | null;
  close: string | null;
  enabled: boolean;
}

export interface WeekSchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export interface StoreSettings {
  id: string;
  branch_id: string;
  is_active: boolean;
  has_delivery: boolean;
  schedule: WeekSchedule;
  accent_color: string;
  about_text: string | null;
  hero_image_url: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  font_heading: string;
  font_body: string;
  social_instagram: string | null;
  social_facebook: string | null;
  social_tiktok: string | null;
  social_twitter: string | null;
  created_at: string;
  updated_at: string;
}

const DEFAULT_SCHEDULE: WeekSchedule = {
  monday: { open: '08:00', close: '18:00', enabled: true },
  tuesday: { open: '08:00', close: '18:00', enabled: true },
  wednesday: { open: '08:00', close: '18:00', enabled: true },
  thursday: { open: '08:00', close: '18:00', enabled: true },
  friday: { open: '08:00', close: '18:00', enabled: true },
  saturday: { open: '09:00', close: '14:00', enabled: true },
  sunday: { open: null, close: null, enabled: false },
};

export const useStoreSettings = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const branchId = profile?.branch_id;

  const query = useQuery({
    queryKey: ['store-settings', branchId],
    queryFn: async () => {
      if (!branchId) return null;
      const { data, error } = await supabase
        .from('store_settings')
        .select('*')
        .eq('branch_id', branchId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { ...data, schedule: data.schedule as unknown as WeekSchedule } as StoreSettings;
    },
    enabled: !!branchId,
  });

  const upsertMutation = useMutation({
    mutationFn: async (updates: {
      is_active?: boolean;
      has_delivery?: boolean;
      schedule?: WeekSchedule;
      accent_color?: string;
      about_text?: string | null;
      hero_image_url?: string | null;
      hero_title?: string | null;
      hero_subtitle?: string | null;
      font_heading?: string;
      font_body?: string;
      social_instagram?: string | null;
      social_facebook?: string | null;
      social_tiktok?: string | null;
      social_twitter?: string | null;
    }) => {
      if (!branchId) throw new Error('No branch');
      const payload: any = { ...updates };
      if (updates.schedule) payload.schedule = JSON.parse(JSON.stringify(updates.schedule));
      const existing = query.data;
      if (existing) {
        const { error } = await supabase
          .from('store_settings')
          .update(payload)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('store_settings')
          .insert([{ branch_id: branchId, ...payload }] as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-settings', branchId] });
      toast({ title: 'Configuración guardada' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  return {
    settings: query.data,
    isLoading: query.isLoading,
    defaultSchedule: DEFAULT_SCHEDULE,
    save: upsertMutation.mutate,
    isSaving: upsertMutation.isPending,
  };
};
