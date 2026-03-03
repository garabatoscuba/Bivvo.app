import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface DailySalaryBreakdown {
  total: number;
  base: number;
  serviceEarning: number;
  commissionEarning: number;
  tipShare: number;
  sharedIncome: number;
  individualIncome: number;
  activeWorkersCount: number;
  todayBranchServiceTotal: number;
  todayBranchSalesTotal: number;
  todaySalesTotal: number;
  todayServiceTotal: number;
  displayPercent: number;
  hasAssignment: boolean;
  modalityName: string;
}

interface UseDailySalaryOptions {
  businessId: string | null;
  branchId: string | null;
  employeeId: string | null;
  jornadaActiva: boolean;
  jornadaAperturaAt?: string;
}

export const useDailySalary = ({
  businessId,
  branchId,
  employeeId,
  jornadaActiva,
  jornadaAperturaAt,
}: UseDailySalaryOptions): DailySalaryBreakdown => {
  const { profile, user } = useAuth();
  const todayStr = new Date().toISOString().split('T')[0];

  // Branch service total
  const { data: todayBranchServiceTotal = 0 } = useQuery({
    queryKey: ['salary-branch-services', businessId, branchId, todayStr],
    queryFn: async () => {
      const { data } = await supabase
        .from('service_entries')
        .select('amount')
        .eq('business_id', businessId!)
        .eq('branch_id', branchId!)
        .gte('created_at', todayStr + 'T00:00:00')
        .lte('created_at', todayStr + 'T23:59:59');
      return data?.reduce((sum, s) => sum + Number(s.amount), 0) || 0;
    },
    enabled: !!businessId && !!branchId && jornadaActiva,
    refetchInterval: 30000,
  });

  // Employee's own service entries
  const { data: todayServiceTotal = 0 } = useQuery({
    queryKey: ['salary-my-services', businessId, branchId, user?.id, todayStr],
    queryFn: async () => {
      const { data } = await supabase
        .from('service_entries')
        .select('amount')
        .eq('business_id', businessId!)
        .eq('branch_id', branchId!)
        .eq('user_id', user!.id)
        .gte('created_at', todayStr + 'T00:00:00')
        .lte('created_at', todayStr + 'T23:59:59');
      return data?.reduce((sum, s) => sum + Number(s.amount), 0) || 0;
    },
    enabled: !!businessId && !!branchId && !!user?.id && jornadaActiva,
    refetchInterval: 30000,
  });

  // Employee's own sales
  const { data: todaySalesTotal = 0 } = useQuery({
    queryKey: ['salary-my-sales', branchId, user?.id, todayStr],
    queryFn: async () => {
      const { data } = await supabase
        .from('sales')
        .select('total')
        .eq('branch_id', branchId!)
        .eq('user_id', user!.id)
        .eq('status', 'completed')
        .gte('created_at', todayStr + 'T00:00:00')
        .lte('created_at', todayStr + 'T23:59:59');
      return data?.reduce((sum, s) => sum + Number(s.total), 0) || 0;
    },
    enabled: !!branchId && !!user?.id && jornadaActiva,
    refetchInterval: 30000,
  });

  // Branch-wide sales
  const { data: todayBranchSalesTotal = 0 } = useQuery({
    queryKey: ['salary-branch-sales', branchId, todayStr],
    queryFn: async () => {
      const { data } = await supabase
        .from('sales')
        .select('total')
        .eq('branch_id', branchId!)
        .eq('status', 'completed')
        .gte('created_at', todayStr + 'T00:00:00')
        .lte('created_at', todayStr + 'T23:59:59');
      return data?.reduce((sum, s) => sum + Number(s.total), 0) || 0;
    },
    enabled: !!branchId && jornadaActiva,
    refetchInterval: 30000,
  });

  // Sale items for commissions
  const { data: todaySaleItems = [] } = useQuery({
    queryKey: ['salary-sale-items', branchId, user?.id, todayStr],
    queryFn: async () => {
      const { data: sales } = await supabase
        .from('sales')
        .select('id')
        .eq('branch_id', branchId!)
        .eq('user_id', user!.id)
        .eq('status', 'completed')
        .gte('created_at', todayStr + 'T00:00:00')
        .lte('created_at', todayStr + 'T23:59:59');
      if (!sales?.length) return [];
      const { data: items } = await supabase
        .from('sale_items')
        .select('product_id, quantity, unit_price, cost_price, total')
        .in('sale_id', sales.map(s => s.id));
      return items || [];
    },
    enabled: !!branchId && !!user?.id && jornadaActiva,
    refetchInterval: 30000,
  });

  // Product commissions config
  const { data: productCommissions = [] } = useQuery({
    queryKey: ['salary-product-commissions', businessId],
    queryFn: async () => {
      const { data } = await supabase
        .from('product_commissions')
        .select('product_id, commission_type, commission_value, split_type')
        .eq('business_id', businessId!);
      return data || [];
    },
    enabled: !!businessId && jornadaActiva,
  });

  // Active workers count
  const { data: activeWorkersCount = 1 } = useQuery({
    queryKey: ['salary-active-workers', branchId, todayStr],
    queryFn: async () => {
      const { data } = await supabase
        .from('jornadas')
        .select('empleado_id')
        .eq('sucursal_id', branchId!)
        .gte('apertura_at', todayStr + 'T00:00:00')
        .lte('apertura_at', todayStr + 'T23:59:59');
      const unique = new Set(data?.map(j => j.empleado_id) || []);
      return Math.max(1, unique.size);
    },
    enabled: !!branchId && jornadaActiva,
    refetchInterval: 30000,
  });

  // Salary assignments
  const { data: mySalaryAssignments = [] } = useQuery({
    queryKey: ['salary-assignments', employeeId],
    queryFn: async () => {
      const { data } = await supabase
        .from('employee_salary_assignments')
        .select('*, salary_modalities(name, modality_type, config, presets, context)')
        .eq('employee_id', employeeId!)
        .eq('is_active', true);
      return data || [];
    },
    enabled: !!employeeId,
  });

  // Salary config (conditions for custom_mixed)
  const { data: salaryConfig } = useQuery({
    queryKey: ['salary-config', businessId],
    queryFn: async () => {
      const { data } = await supabase
        .from('salary_config')
        .select('*')
        .eq('business_id', businessId!)
        .maybeSingle();
      return data;
    },
    enabled: !!businessId,
  });

  // Tip config
  const { data: tipConfig } = useQuery({
    queryKey: ['salary-tip-config', businessId],
    queryFn: async () => {
      const { data } = await supabase
        .from('tip_config')
        .select('*')
        .eq('business_id', businessId!)
        .maybeSingle();
      return data;
    },
    enabled: !!businessId,
  });

  // Today's tip entries
  const { data: todayTipEntries = [] } = useQuery({
    queryKey: ['salary-tip-entries', businessId, branchId, todayStr],
    queryFn: async () => {
      const { data } = await supabase
        .from('tip_entries')
        .select('amount, tip_type')
        .eq('business_id', businessId!)
        .eq('branch_id', branchId!)
        .eq('date', todayStr);
      return data || [];
    },
    enabled: !!businessId && !!branchId && jornadaActiva,
    refetchInterval: 30000,
  });

  return useMemo(() => {
    const todayManualTips = todayTipEntries.reduce((sum, t) => sum + Number(t.amount), 0);

    // Calculate tip share
    let myTipShare = 0;
    if (tipConfig && todayManualTips > 0) {
      const ownerPct = Number((tipConfig as any).owner_percent) || 0;
      const afterOwner = todayManualTips * ((100 - ownerPct) / 100);
      const conditions = ((tipConfig as any).conditions as { positions: number; tip_percent: number }[]) || [];
      const matched = conditions.find(c => c.positions === activeWorkersCount)
        || conditions.filter(c => c.positions <= activeWorkersCount).sort((a, b) => b.positions - a.positions)[0]
        || conditions.sort((a, b) => a.positions - b.positions)[0];
      myTipShare = matched ? afterOwner * (matched.tip_percent / 100) : afterOwner / Math.max(1, activeWorkersCount);
    }

    const sharedIncome = todayBranchServiceTotal + todayBranchSalesTotal;
    const individualIncome = todaySalesTotal;

    let base = 0;
    let earning = 0;
    let displayPercent = 0;
    let modalityName = '';

    for (const assignment of mySalaryAssignments) {
      const modType = assignment?.salary_modalities?.modality_type;
      const modalityConfig = (assignment?.salary_modalities?.config || {}) as Record<string, any>;
      const configOverride = (assignment.config_override as Record<string, any>) || {};
      // Merge: per-employee override takes priority over global modality config
      const config = { ...modalityConfig, ...configOverride } as Record<string, any>;
      const baseSalary = Number(assignment.base_salary || 0);

      if (!modalityName && assignment?.salary_modalities?.name) {
        modalityName = assignment.salary_modalities.name;
      }

      switch (modType) {
        case 'fixed': {
          const freq = assignment.pay_frequency;
          const days = freq === 'daily' ? 1 : freq === 'weekly' ? 7 : freq === 'biweekly' ? 15 : 30;
          base += baseSalary / days;
          break;
        }
        case 'fixed_ladder': {
          // Fixed salary with tiers - use base as daily
          const freq = assignment.pay_frequency;
          const days = freq === 'daily' ? 1 : freq === 'weekly' ? 7 : freq === 'biweekly' ? 15 : 30;
          base += baseSalary / days;
          // Check if there's a sales-based ladder bonus
          const ladderTiers = config.tiers as any[] || [];
          for (const tier of ladderTiers) {
            if (individualIncome >= Number(tier.min_sales || 0)) {
              earning = Math.max(earning, Number(tier.bonus || 0));
            }
          }
          break;
        }
        case 'custom_mixed': {
          const conditions = (salaryConfig?.conditions as unknown as any[]) || [];
          const matchedCondition = conditions.find((c: any) => c.positions === activeWorkersCount)
            || conditions.filter((c: any) => c.positions <= activeWorkersCount).sort((a: any, b: any) => b.positions - a.positions)[0]
            || conditions.sort((a: any, b: any) => a.positions - b.positions)[0];

          const presetId = config?.preset_id;
          let servicePercent = matchedCondition?.service_percent || 0;

          if (presetId) {
            const presets = assignment?.salary_modalities?.presets || [];
            const preset = (presets as any[]).find((p: any) => p.id === presetId);
            if (preset?.config?.service_percent_override != null) {
              servicePercent = preset.config.service_percent_override;
            }
          }

          displayPercent = servicePercent;
          earning += sharedIncome * (servicePercent / 100);
          break;
        }
        case 'fixed_plus_sales_percent': {
          const freq = assignment.pay_frequency;
          const days = freq === 'daily' ? 1 : freq === 'weekly' ? 7 : freq === 'biweekly' ? 15 : 30;
          // Fijo siempre se suma, NO es piso
          earning += baseSalary / days;
          const salesPct = Number(config.sales_percent || 0);
          displayPercent = salesPct;
          if (salesPct > 0) earning += individualIncome * (salesPct / 100);
          break;
        }
        case 'fixed_plus_profit_percent': {
          const freq = assignment.pay_frequency;
          const days = freq === 'daily' ? 1 : freq === 'weekly' ? 7 : freq === 'biweekly' ? 15 : 30;
          // Fijo siempre se suma, NO es piso
          earning += baseSalary / days;
          const profitPct = Number(config.profit_percent || config.percent || 0);
          displayPercent = profitPct;
          // Ganancia = venta - costo de los items vendidos hoy
          if (profitPct > 0) {
            const todayProfit = todaySaleItems.reduce((sum, item) => {
              return sum + ((Number(item.unit_price) - Number(item.cost_price)) * Number(item.quantity));
            }, 0);
            earning += todayProfit * (profitPct / 100);
          }
          break;
        }
        case 'sales_percent_only': {
          const pct = Number(config.sales_percent || config.percent || 0);
          displayPercent = pct;
          if (pct > 0) earning += individualIncome * (pct / 100);
          break;
        }
        case 'profit_percent': {
          const profitPct = Number(config.profit_percent || config.percent || 0);
          displayPercent = profitPct;
          // Ganancia real = venta - costo
          if (profitPct > 0) {
            const todayProfit = todaySaleItems.reduce((sum, item) => {
              return sum + ((Number(item.unit_price) - Number(item.cost_price)) * Number(item.quantity));
            }, 0);
            earning += todayProfit * (profitPct / 100);
          }
          break;
        }
        case 'fixed_plus_goal_bonus': {
          const freq = assignment.pay_frequency;
          const days = freq === 'daily' ? 1 : freq === 'weekly' ? 7 : freq === 'biweekly' ? 15 : 30;
          base += baseSalary / days;
          const goalAmount = Number(config.goal_amount || 0);
          const goalBonus = Number(config.goal_bonus || 0);
          if (goalAmount > 0 && individualIncome >= goalAmount) {
            earning += goalBonus;
          }
          break;
        }
        case 'hourly': {
          if (jornadaAperturaAt) {
            const hoursWorked = (Date.now() - new Date(jornadaAperturaAt).getTime()) / 3600000;
            const hourlyRate = Number(config.hourly_rate || baseSalary || 0);
            base += hourlyRate * hoursWorked;
          }
          break;
        }
        default: {
          base += baseSalary;
          const pct = Number(config.service_percent || config.percent || 0);
          if (pct > 0) {
            displayPercent = pct;
            earning += sharedIncome * (pct / 100);
          }
        }
      }
    }

    // Product commissions
    const hasCommissions = mySalaryAssignments.some((a: any) => {
      const override = (a.config_override as Record<string, any>) || {};
      return override.commissions_enabled;
    });

    let totalCommissionEarning = 0;
    if (hasCommissions) {
      for (const item of todaySaleItems) {
        const commConfig = productCommissions.find((c: any) => c.product_id === item.product_id);
        if (!commConfig || Number(commConfig.commission_value) === 0) continue;
        let commAmount = 0;
        if (commConfig.commission_type === 'fixed') {
          commAmount = Number(commConfig.commission_value) * Number(item.quantity);
        } else if (commConfig.commission_type === 'percent') {
          commAmount = Number(item.total) * (Number(commConfig.commission_value) / 100);
        } else if (commConfig.commission_type === 'profit_percent') {
          const itemProfit = (Number(item.unit_price) - Number(item.cost_price)) * Number(item.quantity);
          commAmount = itemProfit * (Number(commConfig.commission_value) / 100);
        }
        if (commConfig.split_type === 'shared' && activeWorkersCount > 1) {
          commAmount = commAmount / activeWorkersCount;
        }
        totalCommissionEarning += commAmount;
      }
    }

    const total = base + earning + totalCommissionEarning + myTipShare;

    return {
      total,
      base,
      serviceEarning: earning,
      commissionEarning: totalCommissionEarning,
      tipShare: myTipShare,
      sharedIncome,
      individualIncome,
      activeWorkersCount,
      todayBranchServiceTotal,
      todayBranchSalesTotal,
      todaySalesTotal,
      todayServiceTotal,
      displayPercent,
      hasAssignment: mySalaryAssignments.length > 0,
      modalityName,
    };
  }, [
    mySalaryAssignments, salaryConfig, todayBranchServiceTotal, todayBranchSalesTotal,
    todaySalesTotal, todayServiceTotal, activeWorkersCount, todaySaleItems, productCommissions,
    tipConfig, todayTipEntries, jornadaAperturaAt,
  ]);
};
