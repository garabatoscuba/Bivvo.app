import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

/**
 * Ensures the current user has a business + branch.
 * For free-plan users this creates one transparently on first use.
 * Returns the business_id (existing or newly created).
 */
export const useEnsureBusiness = () => {
  const { profile } = useAuth();
  const [creating, setCreating] = useState(false);

  const ensureBusiness = useCallback(async (): Promise<string | null> => {
    if (profile?.business_id) return profile.business_id;
    if (!profile?.user_id) return null;

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-business', {
        body: { name: 'Mi Negocio' },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Reload profile to pick up business_id + branch_id
      window.location.reload();
      return data.business?.id || null;
    } catch (err) {
      console.error('Auto-create business failed:', err);
      return null;
    } finally {
      setCreating(false);
    }
  }, [profile]);

  return { ensureBusiness, creating };
};
