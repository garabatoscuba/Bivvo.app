import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Resolves the correct business_id and branch_id for the current user.
 * - Owners/regular users: uses profile.business_id / profile.branch_id
 * - Employees (@bivoo.app or linked via employees table): resolves from employees.auth_user_id
 * 
 * This follows the session-context-resolution pattern from AppSidebar.
 */
export const useResolvedBusinessId = () => {
  const { profile } = useAuth();

  const { data: employeeRecord, isLoading } = useQuery({
    queryKey: ['employee-session-record', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return null;
      const { data, error } = await supabase
        .from('employees')
        .select('id, business_id, branch_id')
        .eq('auth_user_id', profile.user_id)
        .limit(1)
        .maybeSingle();
      if (error || !data) return null;
      return data;
    },
    enabled: !!profile?.user_id,
    staleTime: 5 * 60 * 1000,
  });

  // Employee record takes priority over profile for business context
  const businessId = employeeRecord?.business_id || profile?.business_id || null;
  const branchId = employeeRecord?.branch_id || profile?.branch_id || null;

  return {
    businessId,
    branchId,
    isLoading,
    isEmployee: !!employeeRecord,
  };
};
