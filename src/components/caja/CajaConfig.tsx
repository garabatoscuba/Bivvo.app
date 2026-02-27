import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Settings2 } from "lucide-react";

const CajaConfig = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const branchId = profile?.branch_id;
  const businessId = profile?.business_id;

  const [mode, setMode] = useState("branch");
  const [openingType, setOpeningType] = useState("fixed");
  const [fixedAmount, setFixedAmount] = useState("0");
  const [minAlert, setMinAlert] = useState("100");

  const { data: config, isLoading } = useQuery({
    queryKey: ["cash-register-config", branchId],
    queryFn: async () => {
      if (!branchId) return null;
      const { data } = await supabase
        .from("cash_register_config")
        .select("*")
        .eq("branch_id", branchId)
        .maybeSingle();
      return data;
    },
    enabled: !!branchId,
  });

  useEffect(() => {
    if (config) {
      setMode(config.mode);
      setOpeningType(config.opening_type);
      setFixedAmount(String(config.fixed_opening_amount));
      setMinAlert(String(config.petty_cash_min_alert));
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        branch_id: branchId!,
        business_id: businessId!,
        mode,
        opening_type: openingType,
        fixed_opening_amount: Number(fixedAmount) || 0,
        petty_cash_min_alert: Number(minAlert) || 100,
      };

      if (config) {
        const { error } = await supabase
          .from("cash_register_config")
          .update(payload)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("cash_register_config")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-register-config"] });
      toast({ title: "Configuración guardada" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="py-8 text-center text-sm text-muted-foreground">Cargando...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Settings2 className="h-4 w-4" /> Configuración de caja
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Mode */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Modo de caja</Label>
          <RadioGroup value={mode} onValueChange={setMode} className="space-y-1">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="branch" id="mode-branch" />
              <Label htmlFor="mode-branch" className="text-sm cursor-pointer">
                Por sucursal <span className="text-muted-foreground">(una caja para todos)</span>
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="employee" id="mode-employee" />
              <Label htmlFor="mode-employee" className="text-sm cursor-pointer">
                Por empleado <span className="text-muted-foreground">(cada uno gestiona la suya)</span>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Opening type */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Tipo de apertura</Label>
          <RadioGroup value={openingType} onValueChange={setOpeningType} className="space-y-1">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="fixed" id="open-fixed" />
              <Label htmlFor="open-fixed" className="text-sm cursor-pointer">
                Monto fijo
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="small_bills" id="open-small" />
              <Label htmlFor="open-small" className="text-sm cursor-pointer">
                Conteo de billetes chicos <span className="text-muted-foreground">(1, 3, 5, 10)</span>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {openingType === "fixed" && (
          <div className="space-y-1">
            <Label className="text-sm">Monto fijo de apertura</Label>
            <Input
              type="number"
              min={0}
              value={fixedAmount}
              onChange={(e) => setFixedAmount(e.target.value)}
              className="max-w-xs"
            />
          </div>
        )}

        {/* Petty cash alert */}
        <div className="space-y-1">
          <Label className="text-sm">Alerta caja chica (saldo mínimo)</Label>
          <Input
            type="number"
            min={0}
            value={minAlert}
            onChange={(e) => setMinAlert(e.target.value)}
            className="max-w-xs"
          />
        </div>

        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          Guardar configuración
        </Button>
      </CardContent>
    </Card>
  );
};

export default CajaConfig;
