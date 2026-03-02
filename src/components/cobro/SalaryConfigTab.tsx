import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Users, ChevronUp, ChevronDown } from 'lucide-react';

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
    const newConditions: Condition[] = [];
    for (let i = n; i >= 1; i--) {
      const existing = effectiveConditions.find(c => c.positions === i);
      newConditions.push({ positions: i, service_percent: existing?.service_percent ?? 10 });
    }
    setConditions(newConditions);
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
            <Label className="text-sm">Cantidad de puestos disponibles</Label>
            <div className="flex items-center gap-2 mt-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={() => handlePositionsChange(effectivePositions - 1)}
                disabled={effectivePositions <= 1}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <div className="flex items-center justify-center h-10 w-16 rounded-md border border-input bg-background text-lg font-semibold">
                {effectivePositions}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={() => handlePositionsChange(effectivePositions + 1)}
                disabled={effectivePositions >= 10}
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Define cuántos puestos de trabajo tiene este negocio (1–10)
            </p>
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
        {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
        Guardar
      </Button>
    </div>
  );
};

export default SalaryConfigTab;
