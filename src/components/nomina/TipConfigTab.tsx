import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users, Gift, Percent } from 'lucide-react';

interface TipCondition {
  positions: number;
  tip_percent: number;
}

interface TipConfigTabProps {
  businessId: string;
}

const TipConfigTab = ({ businessId }: TipConfigTabProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [ownerPercent, setOwnerPercent] = useState(0);
  const [totalPositions, setTotalPositions] = useState(3);
  const [conditions, setConditions] = useState<TipCondition[]>([
    { positions: 3, tip_percent: 33 },
    { positions: 2, tip_percent: 50 },
    { positions: 1, tip_percent: 100 },
  ]);

  const { data: tipConfig, isLoading } = useQuery({
    queryKey: ['tip-config', businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tip_config')
        .select('*')
        .eq('business_id', businessId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!businessId,
  });

  useEffect(() => {
    if (tipConfig) {
      setOwnerPercent(Number(tipConfig.owner_percent) || 0);
      setTotalPositions(tipConfig.total_positions || 3);
      setConditions((tipConfig.conditions as unknown as TipCondition[]) || []);
    }
  }, [tipConfig]);

  const handlePositionsChange = (val: number) => {
    const n = Math.max(1, Math.min(20, val));
    setTotalPositions(n);
    const newConditions: TipCondition[] = [];
    for (let i = n; i >= 1; i--) {
      const existing = conditions.find(c => c.positions === i);
      newConditions.push({ positions: i, tip_percent: existing?.tip_percent ?? Math.round(100 / i) });
    }
    setConditions(newConditions);
  };

  const handlePercentChange = (positions: number, percent: number) => {
    setConditions(prev =>
      prev.map(c =>
        c.positions === positions ? { ...c, tip_percent: Math.max(0, Math.min(100, percent)) } : c
      )
    );
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        business_id: businessId,
        owner_percent: ownerPercent,
        total_positions: totalPositions,
        conditions: conditions as any,
      };
      if (tipConfig) {
        const { error } = await supabase
          .from('tip_config')
          .update({ owner_percent: ownerPercent, total_positions: totalPositions, conditions: conditions as any })
          .eq('id', tipConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tip_config').insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tip-config'] });
      toast({ title: 'Configuración de propinas guardada' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const remainingPercent = 100 - ownerPercent;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="h-4 w-4" />
            Configuración de Propinas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border p-3 bg-muted/30">
            <p className="text-sm text-muted-foreground">
              Las propinas se calculan como el excedente entre el efectivo contado + transferencias y la venta del día.
              También se pueden agregar manualmente. El dueño se queda con un porcentaje fijo y el resto se distribuye entre los trabajadores activos.
            </p>
          </div>

          {/* Owner percentage */}
          <div className="space-y-2">
            <Label className="text-sm flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Porcentaje del dueño
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={100}
                value={ownerPercent}
                onChange={e => setOwnerPercent(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                className="w-24"
              />
              <span className="text-sm font-medium">%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              El dueño se queda con el {ownerPercent}% de la propina total. El {remainingPercent}% restante se distribuye entre los trabajadores.
            </p>
          </div>

          {/* Total positions */}
          <div>
            <Label className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              Cantidad máxima de puestos
            </Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={totalPositions}
              onChange={e => handlePositionsChange(parseInt(e.target.value) || 1)}
              className="w-32 mt-1"
            />
          </div>

          {/* Conditions */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Distribución por trabajadores activos</Label>
            <p className="text-xs text-muted-foreground">
              Define el % de la propina (después del dueño) que recibe <strong>cada trabajador</strong> según cuántos estén activos.
            </p>
            {conditions
              .sort((a, b) => b.positions - a.positions)
              .map(cond => {
                const eachGets = (remainingPercent * cond.tip_percent / 100);
                const totalForWorkers = eachGets * cond.positions;
                return (
                  <div key={cond.positions} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {cond.positions === 1 ? '1 trabajador activo' : `${cond.positions} trabajadores activos`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Cada uno: {cond.tip_percent}% → Total trabajadores: {(cond.tip_percent * cond.positions).toFixed(0)}% del resto
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={cond.tip_percent}
                        onChange={e => handlePercentChange(cond.positions, parseFloat(e.target.value) || 0)}
                        className="w-20 h-8 text-center text-sm"
                      />
                      <span className="text-sm font-medium">%</span>
                    </div>
                  </div>
                );
              })}
          </div>

          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
            {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Guardar Configuración
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default TipConfigTab;
