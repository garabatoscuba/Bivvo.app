import { supabase } from '@/integrations/supabase/client';

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
  | 'employee_deleted'
  | 'print_job_created'
  | 'anulacion_compra'
  | 'anulacion_entrada_insumo'
  | 'anulacion_movimiento';

interface AuditContext {
  userId: string;
  userName: string;
  userRole: string;
  businessId: string;
  branchId?: string | null;
}

interface AuditParams {
  action_type: AuditActionType;
  action_description: string;
  entity_id?: string;
  entity_type?: string;
}

/**
 * Logs an audit action via the security definer DB function.
 * Never throws — silently catches errors to avoid interrupting main operations.
 */
export async function logAuditAction(
  ctx: AuditContext,
  params: AuditParams
): Promise<void> {
  try {
    const deviceInfo = typeof navigator !== 'undefined'
      ? navigator.userAgent.slice(0, 200)
      : null;

    await supabase.rpc('insert_audit_log', {
      _business_id: ctx.businessId,
      _branch_id: ctx.branchId || null,
      _user_id: ctx.userId,
      _user_name: ctx.userName,
      _user_role: ctx.userRole,
      _action_type: params.action_type,
      _action_description: params.action_description,
      _entity_id: params.entity_id || null,
      _entity_type: params.entity_type || null,
      _device_info: deviceInfo,
    });
  } catch {
    // Silent — audit failures must never block operations
  }
}
