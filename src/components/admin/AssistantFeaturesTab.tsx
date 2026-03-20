import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getIconComponent } from '@/components/services/IconSelector';

const PLAN_TYPES = [
  { value: 'free', label: 'Gratuito' },
  { value: 'professional', label: 'Profesional' },
  { value: 'enterprise', label: 'Enterprise' },
];

const AVAILABILITY_OPTIONS = [
  { value: 'included', label: 'Incluido gratis' },
  { value: 'paid_addon', label: 'Pago adicional' },
  { value: 'unavailable', label: 'No disponible' },
];

const ROLES = [
  { value: 'owner', label: 'Dueño' },
  { value: 'manager', label: 'Gerente' },
  { value: 'employee', label: 'Empleado' },
  { value: 'partner', label: 'Partner' },
];

interface Feature {
  id: string;
  key: string;
  name: string;
  description: string | null;
  icon: string;
  is_active: boolean;
  sort_order: number;
}

interface FeaturePricing {
  id: string;
  feature_id: string;
  plan_type: string;
  availability: string;
  monthly_price: number;
}

interface FeatureRole {
  id: string;
  feature_id: string;
  role: string;
  is_allowed: boolean;
}

export default function AssistantFeaturesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: features = [], isLoading } = useQuery({
    queryKey: ['assistant-features'],
    queryFn: async () => {
      const { data } = await supabase.from('assistant_features').select('*').order('sort_order');
      return (data || []) as unknown as Feature[];
    },
  });

  const { data: pricing = [] } = useQuery({
    queryKey: ['assistant-feature-pricing'],
    queryFn: async () => {
      const { data } = await supabase.from('assistant_feature_pricing').select('*');
      return (data || []) as unknown as FeaturePricing[];
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['assistant-feature-roles'],
    queryFn: async () => {
      const { data } = await supabase.from('assistant_feature_roles').select('*');
      return (data || []) as unknown as FeatureRole[];
    },
  });

  const toggleFeature = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('assistant_features').update({ is_active } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assistant-features'] }),
  });

  const upsertPricing = useMutation({
    mutationFn: async (row: { feature_id: string; plan_type: string; availability: string; monthly_price: number }) => {
      const { error } = await supabase.from('assistant_feature_pricing').upsert(row as any, { onConflict: 'feature_id,plan_type' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assistant-feature-pricing'] });
      toast({ title: 'Precio actualizado' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const toggleRole = useMutation({
    mutationFn: async ({ feature_id, role, is_allowed }: { feature_id: string; role: string; is_allowed: boolean }) => {
      const { error } = await supabase.from('assistant_feature_roles').upsert(
        { feature_id, role, is_allowed } as any,
        { onConflict: 'feature_id,role' }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assistant-feature-roles'] });
      toast({ title: 'Rol actualizado' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const getPricing = (featureId: string, planType: string) =>
    pricing.find(p => p.feature_id === featureId && p.plan_type === planType);

  const getRoleAllowed = (featureId: string, role: string) => {
    const r = roles.find(r => r.feature_id === featureId && r.role === role);
    return r?.is_allowed ?? true;
  };

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">Configura disponibilidad por plan y rol para cada función del asistente.</p>

      {features.map(feature => {
        const Icon = getIconComponent(feature.icon);
        return (
          <Card key={feature.id} className="border-border/60">
            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                {feature.name}
                <Badge variant="outline" className="text-[10px] ml-1">Función</Badge>
              </CardTitle>
              <Switch
                checked={feature.is_active}
                onCheckedChange={v => toggleFeature.mutate({ id: feature.id, is_active: v })}
              />
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 space-y-4">
              {feature.description && (
                <p className="text-xs text-muted-foreground">{feature.description}</p>
              )}

              {/* Pricing by plan */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Por plan</Label>
                <div className="grid gap-3 sm:grid-cols-3 mt-2">
                  {PLAN_TYPES.map(plan => {
                    const p = getPricing(feature.id, plan.value);
                    const currentAvail = p?.availability || 'included';
                    const currentPrice = p?.monthly_price || 0;
                    return (
                      <div key={plan.value} className="rounded-lg border p-3 space-y-2">
                        <p className="text-xs font-medium">{plan.label}</p>
                        <Select
                          value={currentAvail}
                          onValueChange={v => upsertPricing.mutate({
                            feature_id: feature.id,
                            plan_type: plan.value,
                            availability: v,
                            monthly_price: v === 'paid_addon' ? currentPrice : 0,
                          })}
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {AVAILABILITY_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {currentAvail === 'paid_addon' && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">$</span>
                            <Input
                              type="number"
                              className="h-7 text-xs w-20"
                              defaultValue={currentPrice}
                              onBlur={e => {
                                const val = parseFloat(e.target.value) || 0;
                                if (val !== currentPrice) {
                                  upsertPricing.mutate({
                                    feature_id: feature.id,
                                    plan_type: plan.value,
                                    availability: 'paid_addon',
                                    monthly_price: val,
                                  });
                                }
                              }}
                            />
                            <span className="text-xs text-muted-foreground">/mes</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Roles */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Por rol</Label>
                <div className="flex flex-wrap gap-4 mt-2">
                  {ROLES.map(r => (
                    <label key={r.value} className="flex items-center gap-2 text-sm">
                      <Switch
                        className="scale-75"
                        checked={getRoleAllowed(feature.id, r.value)}
                        onCheckedChange={v => toggleRole.mutate({ feature_id: feature.id, role: r.value, is_allowed: v })}
                      />
                      {r.label}
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
