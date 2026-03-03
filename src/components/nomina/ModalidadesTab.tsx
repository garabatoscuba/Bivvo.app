import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Settings2, Save, Trash2, RotateCcw } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

import AppliesToSelector from './modality-configs/AppliesToSelector';
import SalesPercentConfig from './modality-configs/SalesPercentConfig';
import ProfitPercentConfig from './modality-configs/ProfitPercentConfig';
import HourlyConfig from './modality-configs/HourlyConfig';
import CustomMixedConfig from './modality-configs/CustomMixedConfig';
import type { Preset } from './modality-configs/PresetManager';

const MODALITY_INFO: Record<string, { label: string; description: string }> = {
  fixed_plus_sales_percent: { label: 'Fijo + % de Venta', description: 'Salario fijo que siempre se suma más un porcentaje de sus ventas' },
  fixed_plus_profit_percent: { label: 'Fijo + % de Ganancia', description: 'Salario fijo que siempre se suma más un porcentaje de la ganancia (venta - costo)' },
  sales_percent_only: { label: 'Solo % sobre su Venta', description: 'Sin salario fijo, solo porcentaje de lo que vende' },
  profit_percent: { label: '% sobre Ganancia Total', description: 'Porcentaje sobre la ganancia neta del negocio' },
  hourly: { label: 'Por Horas', description: 'Pago según horas trabajadas' },
  custom_mixed: { label: 'Mixto Personalizado', description: 'Cada trabajador gana un % de la venta según cuántos estén activos' },
};

const ALL_TYPES = Object.keys(MODALITY_INFO);
const BLOCKED_TYPES = new Set<string>();

interface Condition {
  positions: number;
  service_percent: number;
}

interface SavedConfig {
  id: string;
  name: string;
  applies_to: string;
  presets: Preset[];
  custom_mixed?: { total_positions: number; conditions: Condition[] };
}

interface ModalidadesTabProps {
  businessId: string;
}

const ModalidadesTab = ({ businessId }: ModalidadesTabProps) => {
  const context = 'general';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [configOpen, setConfigOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  // Config state
  const [appliesTo, setAppliesTo] = useState('both');
  const [presets, setPresets] = useState<Preset[]>([]);
  const [modalityConfig, setModalityConfig] = useState<Record<string, any>>({});

  // Save-as-preset state
  const [savePresetName, setSavePresetName] = useState('');
  const [showSavePreset, setShowSavePreset] = useState(false);

  // custom_mixed specific state
  const [totalPositions, setTotalPositions] = useState<number>(3);
  const [conditions, setConditions] = useState<Condition[]>([
    { positions: 3, service_percent: 12 },
    { positions: 2, service_percent: 33 },
    { positions: 1, service_percent: 30 },
  ]);

  const { data: modalities = [], isLoading } = useQuery({
    queryKey: ['salary-modalities', businessId, context],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salary_modalities')
        .select('*')
        .eq('business_id', businessId)
        .eq('context', context)
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
          context,
        } as any);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('salary_modalities')
          .delete()
          .eq('business_id', businessId)
          .eq('modality_type', type as any)
          .eq('context', context);
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
        .update({ applies_to: appliesTo, presets: presets as any, config: modalityConfig } as any)
        .eq('business_id', businessId)
        .eq('modality_type', selectedType as any)
        .eq('context', context);
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

  const saveAsPresetMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!selectedType) return;
      const mod = modalities.find((m: any) => m.modality_type === selectedType);
      if (!mod) return;

      const snapshot: SavedConfig = {
        id: crypto.randomUUID(),
        name,
        applies_to: appliesTo,
        presets: [...presets],
      };
      if (selectedType === 'custom_mixed') {
        snapshot.custom_mixed = { total_positions: totalPositions, conditions: [...conditions] };
      }

      const existing = ((mod as any).saved_configs as SavedConfig[]) || [];
      const updated = [...existing, snapshot];

      const { error } = await supabase
        .from('salary_modalities')
        .update({ saved_configs: updated as any } as any)
        .eq('id', mod.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-modalities'] });
      toast({ title: 'Preset guardado' });
      setSavePresetName('');
      setShowSavePreset(false);
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const deleteSavedConfig = useMutation({
    mutationFn: async ({ modalityId, configId }: { modalityId: string; configId: string }) => {
      const mod = modalities.find((m: any) => m.id === modalityId);
      if (!mod) return;
      const existing = ((mod as any).saved_configs as SavedConfig[]) || [];
      const updated = existing.filter(c => c.id !== configId);
      const { error } = await supabase
        .from('salary_modalities')
        .update({ saved_configs: updated as any } as any)
        .eq('id', modalityId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-modalities'] });
      toast({ title: 'Preset eliminado' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const loadSavedConfig = (saved: SavedConfig) => {
    setAppliesTo(saved.applies_to);
    setPresets(saved.presets || []);
    if (saved.custom_mixed) {
      setTotalPositions(saved.custom_mixed.total_positions);
      setConditions(saved.custom_mixed.conditions);
    }
    toast({ title: `Preset "${saved.name}" cargado`, description: 'Pulsa Guardar para aplicar los cambios.' });
  };

  const openConfig = (type: string) => {
    setSelectedType(type);
    const mod = modalities.find((m: any) => m.modality_type === type);
    setAppliesTo((mod as any)?.applies_to || 'both');
    setPresets(((mod as any)?.presets as Preset[]) || []);
    setModalityConfig(((mod as any)?.config as Record<string, any>) || {});
    setShowSavePreset(false);
    setSavePresetName('');

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
      case 'fixed_plus_sales_percent':
        return <SalesPercentConfig type="fixed_plus_sales_percent" config={modalityConfig} onConfigChange={setModalityConfig} presets={presets} onPresetsChange={setPresets} />;
      case 'fixed_plus_profit_percent':
        return <ProfitPercentConfig config={modalityConfig} onConfigChange={setModalityConfig} presets={presets} onPresetsChange={setPresets} />;
      case 'sales_percent_only':
        return <SalesPercentConfig type="sales_percent_only" config={modalityConfig} onConfigChange={setModalityConfig} presets={presets} onPresetsChange={setPresets} />;
      case 'profit_percent':
        return <ProfitPercentConfig config={modalityConfig} onConfigChange={setModalityConfig} presets={presets} onPresetsChange={setPresets} />;
      case 'hourly':
        return <HourlyConfig config={modalityConfig} onConfigChange={setModalityConfig} presets={presets} onPresetsChange={setPresets} />;
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

  // Gather all saved configs across all modalities for the "Presets Guardados" section
  const allSavedConfigs = modalities.flatMap((m: any) => {
    const saved = (m.saved_configs as SavedConfig[]) || [];
    return saved.map(s => ({ ...s, modalityId: m.id, modalityType: m.modality_type }));
  });

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
              const modSavedConfigs = ((mod as any)?.saved_configs as SavedConfig[]) || [];

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
                      {isEnabled && modSavedConfigs.length > 0 && (
                        <Badge variant="outline" className="text-[10px]">
                          <Save className="h-2.5 w-2.5 mr-0.5" />
                          {modSavedConfigs.length} guardado{modSavedConfigs.length > 1 ? 's' : ''}
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

      {/* Saved Configs Section */}
      {allSavedConfigs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Presets Guardados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Configuraciones completas guardadas que puedes cargar rápidamente en cualquier momento.
            </p>
            <div className="space-y-2">
              {allSavedConfigs.map(saved => {
                const info = MODALITY_INFO[saved.modalityType];
                return (
                  <div key={saved.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex-1 min-w-0 mr-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{saved.name}</p>
                        <Badge variant="secondary" className="text-[10px]">{info?.label}</Badge>
                        {saved.presets?.length > 0 && (
                          <Badge variant="outline" className="text-[10px]">
                            {saved.presets.length} sub-preset{saved.presets.length > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Aplica a: {saved.applies_to === 'both' ? 'Ambos' : saved.applies_to === 'services' ? 'Servicios' : 'Productos'}
                        {saved.custom_mixed && ` · ${saved.custom_mixed.total_positions} puestos`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Cargar este preset"
                        onClick={() => {
                          openConfig(saved.modalityType);
                          // Defer loading so dialog opens first
                          setTimeout(() => loadSavedConfig(saved), 50);
                        }}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Eliminar preset"
                        onClick={() => deleteSavedConfig.mutate({ modalityId: saved.modalityId, configId: saved.id })}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurar {selectedType ? MODALITY_INFO[selectedType]?.label : ''}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <AppliesToSelector value={appliesTo} onChange={setAppliesTo} />
            {renderModalityConfig()}

            {/* Save as preset inline */}
            <div className="border-t pt-4">
              {!showSavePreset ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowSavePreset(true)}
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  Guardar como preset
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Guarda toda la configuración actual con un nombre para reutilizarla después.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={savePresetName}
                      onChange={e => setSavePresetName(e.target.value)}
                      placeholder="Nombre del preset..."
                      className="h-8 text-sm"
                      onKeyDown={e => e.key === 'Enter' && savePresetName.trim() && saveAsPresetMutation.mutate(savePresetName.trim())}
                    />
                    <Button
                      size="sm"
                      onClick={() => saveAsPresetMutation.mutate(savePresetName.trim())}
                      disabled={!savePresetName.trim() || saveAsPresetMutation.isPending}
                    >
                      {saveAsPresetMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                      Guardar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setShowSavePreset(false); setSavePresetName(''); }}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
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
