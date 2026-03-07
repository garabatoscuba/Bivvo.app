import { useAuth } from '@/contexts/AuthContext';
import { useResolvedBusinessId } from '@/hooks/useResolvedBusinessId';
import { logAuditAction } from '@/lib/auditLogger';
import { useCallback } from 'react';

type AuditActionType =
  | 'sale_created'
  | 'sale_cancelled'
  | 'service_charge_created'
  | 'inventory_entry'
  | 'stock_transfer'
  | 'shrinkage_registered'
  | 'cash_register_opened'
  | 'cash_register_closed'
  | 'shift_started'
  | 'shift_ended'
  | 'expense_paid'
  | 'balance_movement_created'
  | 'employee_created'
  | 'employee_edited'
  | 'employee_deleted';

/**
 * Hook that provides a simple `log(action_type, description, entity_id?, entity_type?)` function
 * with user/business context already resolved.
 */
export function useAuditLog() {
  const { profile, roles } = useAuth();
  const { businessId, branchId } = useResolvedBusinessId();

  const log = useCallback(
    (
      action_type: AuditActionType,
      action_description: string,
      entity_id?: string,
      entity_type?: string
    ) => {
      const resolvedBusinessId = businessId || profile?.business_id;
      const resolvedBranchId = branchId || profile?.branch_id;
      if (!resolvedBusinessId || !profile?.user_id) return;

      const primaryRole = roles.includes('owner')
        ? 'owner'
        : roles.includes('super_admin')
        ? 'super_admin'
        : roles.includes('manager')
        ? 'manager'
        : roles.includes('seller')
        ? 'seller'
        : roles.includes('accountant')
        ? 'accountant'
        : roles[0] || 'unknown';

      logAuditAction(
        {
          userId: profile.user_id,
          userName: profile.full_name || '',
          userRole: primaryRole,
          businessId: resolvedBusinessId,
          branchId: resolvedBranchId,
        },
        { action_type, action_description, entity_id, entity_type }
      );
    },
    [profile, roles, businessId, branchId]
  );

  return log;
}
