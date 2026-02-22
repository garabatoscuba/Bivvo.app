import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Users } from 'lucide-react';

interface Condition {
  positions: number;
  service_percent: number;
}

const SalaryConfigTab = ({ businessId }: { businessId: string }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
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

  const [totalPositions, setTotalPositions] = useState<number | null>(null);
  const [conditions, setConditions] = useState<Condition[] | null>(null);

  const effectivePositions = totalPositions ?? config?.total_positions ?? 3;
  const effectiveConditions: Condition[] = conditions ?? (config?.conditions as unknown as Condition[] | undefined) ?? [
    { positions: 3, service_percent: 12 },
    { positions: 2, service_percent: 33 },
    { positions: 1, service_percent: 30 },
  ];

  const handlePositionsChange = (val: number) => {
    const n = Math.max(1, Math.min(10, val));
    setTotalPositions(n);
    // Generate default conditions for new position count
    const newConditions: Condition[] = [];
    for (let i = n; i >= 1; i--) {
      const existing = effectiveConditions.find(c => c.positions === i);
      newConditions.push({ positions: i, service_percent: existing?.service_percent ?? 10 });
    }
    setConditions(newConditions);
  };

  const handlePercentChange = (positions: number, percent: number) => {
    const updated = effectiveConditions.map(c =>
      c.positions === positions ? { ...c, service_percent: Math.max(0, Math.min(100, percent)) } : c
    );
    setConditions(updated);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        business_id: businessId,
        total_positions: effectivePositions,
        conditions: effectiveConditions,
      };
      if (config) {
        const { error } = await supabase
          .from('salary_config')
          .update({ total_positions: effectivePositions, conditions: effectiveConditions as any })
          .eq('id', config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('salary_config').insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-config'] });
      toast({ title: 'Configuración guardada' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Puestos de Trabajo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm">Cantidad de puestos</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={effectivePositions}
              onChange={e => handlePositionsChange(parseInt(e.target.value) || 1)}
              className="w-32 mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Define cuántos puestos de trabajo tiene este negocio
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Condiciones Salariales por Servicios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground mb-3">
            Define el porcentaje de la venta total de servicios que cobran los empleados según cuántos puestos estén activos ese día. El porcentaje se divide entre los trabajadores activos.
          </p>
          {effectiveConditions
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
                      ? `El empleado cobra el ${cond.service_percent}% de servicios + todas las comisiones`
                      : `${cond.service_percent}% de servicios dividido entre ${cond.positions} + comisiones divididas`}
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
        </CardContent>
      </Card>

      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
        {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
        Guardar Configuración
      </Button>
    </div>
  );
};

export default SalaryConfigTab;
