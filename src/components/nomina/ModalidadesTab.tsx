import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Settings2, Users } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

import AppliesToSelector from './modality-configs/AppliesToSelector';
import FixedConfig from './modality-configs/FixedConfig';
import FixedLadderConfig from './modality-configs/FixedLadderConfig';
import SalesPercentConfig from './modality-configs/SalesPercentConfig';
import ProfitPercentConfig from './modality-configs/ProfitPercentConfig';
import GoalBonusConfig from './modality-configs/GoalBonusConfig';
import HourlyConfig from './modality-configs/HourlyConfig';
import CustomMixedConfig from './modality-configs/CustomMixedConfig';
import type { Preset } from './modality-configs/PresetManager';

const MODALITY_INFO: Record<string, { label: string; description: string }> = {
  fixed: { label: 'Fijo', description: 'Salario fijo independiente de ventas' },
  fixed_ladder: { label: 'Fijo con Escalera', description: 'Salario base que sube según rangos de venta' },
  fixed_plus_sales_percent: { label: 'Fijo + % Ventas', description: 'Salario base más porcentaje sobre sus ventas' },
  sales_percent_only: { label: 'Solo % sobre su Venta', description: 'Sin salario fijo, solo porcentaje de lo que vende' },
  profit_percent: { label: '% sobre Ganancia Total', description: 'Porcentaje sobre la ganancia neta del negocio' },
  fixed_plus_goal_bonus: { label: 'Fijo + Bono por Meta', description: 'Salario base con bonos al cumplir metas' },
  hourly: { label: 'Por Horas', description: 'Pago según horas trabajadas' },
  custom_mixed: { label: 'Mixto Personalizado', description: 'Cada trabajador gana un % de la venta según cuántos estén activos' },
};

const ALL_TYPES = Object.keys(MODALITY_INFO);
const BLOCKED_TYPES = new Set(['fixed_ladder', 'fixed_plus_goal_bonus']);

interface Condition {
  positions: number;
  service_percent: number;
}

interface ModalidadesTabProps {
  businessId: string;
}

const ModalidadesTab = ({ businessId }: ModalidadesTabProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [configOpen, setConfigOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  // Config state
  const [appliesTo, setAppliesTo] = useState('both');
  const [presets, setPresets] = useState<Preset[]>([]);

  // custom_mixed specific state
  const [totalPositions, setTotalPositions] = useState<number>(3);
  const [conditions, setConditions] = useState<Condition[]>([
    { positions: 3, service_percent: 12 },
    { positions: 2, service_percent: 33 },
    { positions: 1, service_percent: 30 },
  ]);

  const { data: modalities = [], isLoading } = useQuery({
    queryKey: ['salary-modalities', businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salary_modalities')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at');
      if (error) throw error;
      return data;
    },
    enabled: !!businessId,
  });

  const { data: salaryConfig } = useQuery({
    queryKey: ['salary-config', businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salary_config')
        .select('*')
        .eq('business_id', businessId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!businessId,
  });

  const enabledTypes = new Set(modalities.map((m: any) => m.modality_type));

  const toggleMutation = useMutation({
    mutationFn: async ({ type, enable }: { type: string; enable: boolean }) => {
      if (enable) {
        const info = MODALITY_INFO[type];
        const { error } = await supabase.from('salary_modalities').insert({
          business_id: businessId,
          modality_type: type,
          name: info.label,
          config: {},
          is_active: true,
          applies_to: 'both',
          presets: [],
        } as any);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('salary_modalities')
          .delete()
          .eq('business_id', businessId)
          .eq('modality_type', type as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-modalities'] });
      toast({ title: 'Modalidad actualizada' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      if (selectedType === 'custom_mixed') {
        // Save to salary_config
        const payload = {
          business_id: businessId,
          total_positions: totalPositions,
          conditions: conditions,
        };
        if (salaryConfig) {
          const { error } = await supabase
            .from('salary_config')
            .update({ total_positions: totalPositions, conditions: conditions as any })
            .eq('id', salaryConfig.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('salary_config').insert(payload as any);
          if (error) throw error;
        }
      }

      // Save applies_to and presets to the modality
      const { error } = await supabase
        .from('salary_modalities')
        .update({ applies_to: appliesTo, presets: presets as any, config: {} } as any)
        .eq('business_id', businessId)
        .eq('modality_type', selectedType as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-modalities'] });
      queryClient.invalidateQueries({ queryKey: ['salary-config'] });
      toast({ title: 'Configuración guardada' });
      setConfigOpen(false);
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const openConfig = (type: string) => {
    setSelectedType(type);
    const mod = modalities.find((m: any) => m.modality_type === type);
    setAppliesTo((mod as any)?.applies_to || 'both');
    setPresets(((mod as any)?.presets as Preset[]) || []);

    if (type === 'custom_mixed') {
      const cfg = salaryConfig;
      setTotalPositions(cfg?.total_positions ?? 3);
      setConditions((cfg?.conditions as unknown as Condition[]) ?? [
        { positions: 3, service_percent: 12 },
        { positions: 2, service_percent: 33 },
        { positions: 1, service_percent: 30 },
      ]);
    }
    setConfigOpen(true);
  };

  const renderModalityConfig = () => {
    if (!selectedType) return null;

    switch (selectedType) {
      case 'fixed':
        return <FixedConfig presets={presets} onPresetsChange={setPresets} />;
      case 'fixed_ladder':
        return <FixedLadderConfig presets={presets} onPresetsChange={setPresets} />;
      case 'fixed_plus_sales_percent':
        return <SalesPercentConfig type="fixed_plus_sales_percent" presets={presets} onPresetsChange={setPresets} />;
      case 'sales_percent_only':
        return <SalesPercentConfig type="sales_percent_only" presets={presets} onPresetsChange={setPresets} />;
      case 'profit_percent':
        return <ProfitPercentConfig presets={presets} onPresetsChange={setPresets} />;
      case 'fixed_plus_goal_bonus':
        return <GoalBonusConfig presets={presets} onPresetsChange={setPresets} />;
      case 'hourly':
        return <HourlyConfig presets={presets} onPresetsChange={setPresets} />;
      case 'custom_mixed':
        return (
          <CustomMixedConfig
            totalPositions={totalPositions}
            conditions={conditions}
            onTotalPositionsChange={setTotalPositions}
            onConditionsChange={setConditions}
            presets={presets}
            onPresetsChange={setPresets}
          />
        );
      default:
        return null;
    }
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Modalidades de Salario</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">
            Activa las modalidades de salario que aplican a tu negocio. Configura cada una con el ícono de ajustes.
          </p>
          <div className="space-y-3">
            {ALL_TYPES.map(type => {
              const info = MODALITY_INFO[type];
              const isEnabled = enabledTypes.has(type);
              const mod = modalities.find((m: any) => m.modality_type === type);
              const modAppliesTo = (mod as any)?.applies_to;
              const modPresets = ((mod as any)?.presets as Preset[]) || [];

              return (
                <div key={type} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex-1 min-w-0 mr-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{info.label}</p>
                      {isEnabled && <Badge variant="secondary" className="text-[10px]">Activa</Badge>}
                      {BLOCKED_TYPES.has(type) && <Badge variant="outline" className="text-[10px] opacity-60">Próximamente</Badge>}
                      {isEnabled && modAppliesTo && modAppliesTo !== 'both' && (
                        <Badge variant="outline" className="text-[10px]">
                          {modAppliesTo === 'services' ? 'Servicios' : 'Productos'}
                        </Badge>
                      )}
                      {isEnabled && modPresets.length > 0 && (
                        <Badge variant="outline" className="text-[10px]">
                          {modPresets.length} preset{modPresets.length > 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{info.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isEnabled && !BLOCKED_TYPES.has(type) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openConfig(type)}
                      >
                        <Settings2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={checked => toggleMutation.mutate({ type, enable: checked })}
                      disabled={toggleMutation.isPending || BLOCKED_TYPES.has(type)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurar {selectedType ? MODALITY_INFO[selectedType]?.label : ''}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <AppliesToSelector value={appliesTo} onChange={setAppliesTo} />
            {renderModalityConfig()}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveConfigMutation.mutate()} disabled={saveConfigMutation.isPending}>
              {saveConfigMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ModalidadesTab;
