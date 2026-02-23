import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Settings2 } from 'lucide-react';
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
  custom_mixed: { label: 'Mixto Personalizado', description: 'Configuración personalizada con puestos y porcentajes' },
};

const ALL_TYPES = Object.keys(MODALITY_INFO);

interface ModalidadesTabProps {
  businessId: string;
}

const ModalidadesTab = ({ businessId }: ModalidadesTabProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [configOpen, setConfigOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [configJson, setConfigJson] = useState('');

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

  const openConfig = (type: string) => {
    const mod = modalities.find((m: any) => m.modality_type === type);
    setSelectedType(type);
    setConfigJson(JSON.stringify(mod?.config || {}, null, 2));
    setConfigOpen(true);
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar {selectedType ? MODALITY_INFO[selectedType]?.label : ''}</DialogTitle>
          </DialogHeader>
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
