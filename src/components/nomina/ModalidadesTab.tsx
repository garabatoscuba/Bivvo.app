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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const MODALITY_INFO: Record<string, { label: string; description: string }> = {
  fixed: { label: 'Fijo', description: 'Salario fijo independiente de ventas' },
  fixed_ladder: { label: 'Fijo con Escalera', description: 'Salario base que sube según rangos de venta' },
  fixed_plus_sales_percent: { label: 'Fijo + % Ventas', description: 'Salario base más porcentaje sobre sus ventas' },
  sales_percent_only: { label: 'Solo % sobre su Venta', description: 'Sin salario fijo, solo porcentaje de lo que vende' },
  profit_percent: { label: '% sobre Ganancia Total', description: 'Porcentaje sobre la ganancia neta del negocio' },
  fixed_plus_goal_bonus: { label: 'Fijo + Bono por Meta', description: 'Salario base con bonos al cumplir metas' },
  hourly: { label: 'Por Horas', description: 'Pago según horas trabajadas' },
  custom_mixed: { label: 'Mixto Personalizado', description: 'Se destina un % de la venta total a salarios, dividido entre los trabajadores activos' },
};

const ALL_TYPES = Object.keys(MODALITY_INFO);

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
  const [configJson, setConfigJson] = useState('');

  // custom_mixed state
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

  // Also fetch salary_config for custom_mixed
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
      let parsed = {};
      try { parsed = JSON.parse(configJson || '{}'); } catch { parsed = {}; }
      const { error } = await supabase
        .from('salary_modalities')
        .update({ config: parsed } as any)
        .eq('business_id', businessId)
        .eq('modality_type', selectedType as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-modalities'] });
      toast({ title: 'Configuración guardada' });
      setConfigOpen(false);
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const saveMixtoConfigMutation = useMutation({
    mutationFn: async () => {
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-config'] });
      toast({ title: 'Configuración del Mixto guardada' });
      setConfigOpen(false);
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const openConfig = (type: string) => {
    setSelectedType(type);
    if (type === 'custom_mixed') {
      const cfg = salaryConfig;
      const pos = cfg?.total_positions ?? 3;
      const conds = (cfg?.conditions as unknown as Condition[]) ?? [
        { positions: 3, service_percent: 12 },
        { positions: 2, service_percent: 33 },
        { positions: 1, service_percent: 30 },
      ];
      setTotalPositions(pos);
      setConditions(conds);
    } else {
      const mod = modalities.find((m: any) => m.modality_type === type);
      setConfigJson(JSON.stringify(mod?.config || {}, null, 2));
    }
    setConfigOpen(true);
  };

  const handlePositionsChange = (val: number) => {
    const n = Math.max(1, Math.min(10, val));
    setTotalPositions(n);
    const newConditions: Condition[] = [];
    for (let i = n; i >= 1; i--) {
      const existing = conditions.find(c => c.positions === i);
      newConditions.push({ positions: i, service_percent: existing?.service_percent ?? 10 });
    }
    setConditions(newConditions);
  };

  const handlePercentChange = (positions: number, percent: number) => {
    setConditions(prev =>
      prev.map(c =>
        c.positions === positions ? { ...c, service_percent: Math.max(0, Math.min(100, percent)) } : c
      )
    );
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
            Activa las modalidades de salario que aplican a tu negocio. Luego podrás asignarlas a cada empleado.
          </p>
          <div className="space-y-3">
            {ALL_TYPES.map(type => {
              const info = MODALITY_INFO[type];
              const isEnabled = enabledTypes.has(type);
              return (
                <div key={type} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex-1 min-w-0 mr-3">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{info.label}</p>
                      {isEnabled && <Badge variant="secondary" className="text-[10px]">Activa</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{info.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isEnabled && (
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
                      disabled={toggleMutation.isPending}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className={selectedType === 'custom_mixed' ? 'max-w-lg' : ''}>
          <DialogHeader>
            <DialogTitle>Configurar {selectedType ? MODALITY_INFO[selectedType]?.label : ''}</DialogTitle>
          </DialogHeader>

          {selectedType === 'custom_mixed' ? (
            <div className="space-y-4">
              <div>
                <Label className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Cantidad máxima de puestos
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={totalPositions}
                  onChange={e => handlePositionsChange(parseInt(e.target.value) || 1)}
                  className="w-32 mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Define cuántos puestos de trabajo puede tener activos este negocio
                </p>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Condiciones por trabajadores activos</Label>
                <p className="text-xs text-muted-foreground">
                  Define el % de la venta total que se destina a salarios según cuántos trabajadores estén activos en la jornada. Ese porcentaje se divide equitativamente entre ellos.
                </p>
                {conditions
                  .sort((a, b) => b.positions - a.positions)
                  .map(cond => (
                    <div key={cond.positions} className="flex items-center gap-3 rounded-lg border p-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {cond.positions === 1
                            ? '1 trabajador activo'
                            : `${cond.positions} trabajadores activos`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {cond.positions === 1
                            ? `El empleado cobra el ${cond.service_percent}% de las ventas`
                            : `${cond.service_percent}% de las ventas ÷ ${cond.positions} = ${(cond.service_percent / cond.positions).toFixed(1)}% c/u`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={cond.service_percent}
                          onChange={e => handlePercentChange(cond.positions, parseFloat(e.target.value) || 0)}
                          className="w-20 h-8 text-center text-sm"
                        />
                        <span className="text-sm font-medium">%</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Label className="text-sm">Configuración (JSON)</Label>
              <Textarea
                value={configJson}
                onChange={e => setConfigJson(e.target.value)}
                rows={8}
                className="font-mono text-xs"
                placeholder='{"rangos": [...]}'
              />
              <p className="text-xs text-muted-foreground">
                Define rangos de escalera, metas, porcentajes u otros parámetros según la modalidad.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigOpen(false)}>Cancelar</Button>
            {selectedType === 'custom_mixed' ? (
              <Button onClick={() => saveMixtoConfigMutation.mutate()} disabled={saveMixtoConfigMutation.isPending}>
                {saveMixtoConfigMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Guardar
              </Button>
            ) : (
              <Button onClick={() => saveConfigMutation.mutate()} disabled={saveConfigMutation.isPending}>
                {saveConfigMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Guardar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ModalidadesTab;
