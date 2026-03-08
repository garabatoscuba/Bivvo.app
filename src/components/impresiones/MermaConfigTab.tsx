import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useResolvedBusinessId } from "@/hooks/useResolvedBusinessId";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Percent, Save } from "lucide-react";

export default function MermaConfigTab() {
  const { businessId, branchId } = useResolvedBusinessId();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);

  const { data: employees, isLoading } = useQuery({
    queryKey: ["employees-merma-config", businessId, branchId],
    queryFn: async () => {
      if (!businessId) return [];
      const query = supabase
        .from("employees")
        .select("id, full_name, position, merma_descuento_pct")
        .eq("business_id", businessId)
        .order("full_name");
      
      if (branchId) {
        query.eq("branch_id", branchId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!businessId,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, pct }: { id: string; pct: number }) => {
      const { error } = await supabase
        .from("employees")
        .update({ merma_descuento_pct: pct })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees-merma-config"] });
      toast({ title: "Configuración guardada" });
      setEditingId(null);
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const handleSave = (id: string) => {
    if (editValue < 0 || editValue > 100) {
      toast({
        title: "Valor inválido",
        description: "El porcentaje debe estar entre 0 y 100",
        variant: "destructive",
      });
      return;
    }
    updateMutation.mutate({ id, pct: editValue });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!employees || employees.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No hay empleados registrados en esta sucursal
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Configuración de Mermas por Empleado</CardTitle>
          <CardDescription>
            Define qué porcentaje del valor de la merma se descuenta del salario de cada empleado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {employees.map((emp) => (
              <div
                key={emp.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium">{emp.full_name}</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {emp.position || "Empleado"}
                  </p>
                </div>

                <div className="flex items-center gap-2 sm:w-64">
                  {editingId === emp.id ? (
                    <>
                      <div className="flex-1 flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={editValue}
                          onChange={(e) => setEditValue(Number(e.target.value))}
                          className="w-20"
                        />
                        <Percent className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleSave(emp.id)}
                        disabled={updateMutation.isPending}
                      >
                        {updateMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingId(null)}
                        disabled={updateMutation.isPending}
                      >
                        Cancelar
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 text-right font-medium">
                        {emp.merma_descuento_pct || 0}%
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingId(emp.id);
                          setEditValue(emp.merma_descuento_pct || 0);
                        }}
                      >
                        Editar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-muted/50">
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">
            <strong>Nota:</strong> El porcentaje configurado se aplicará automáticamente al valor de
            cada merma registrada por el empleado. El dueño podrá decidir si cobra o perdona cada
            merma individual.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
