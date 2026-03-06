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
import { Settings2, Wallet } from "lucide-react";

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
  const [nextDayFundMode, setNextDayFundMode] = useState("none");
  const [nextDayFundAmount, setNextDayFundAmount] = useState("0");
  const [lowBillDenominations, setLowBillDenominations] = useState<number[]>([1, 2, 5, 10]);

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
      setNextDayFundMode((config as any).next_day_fund_mode || "none");
      setNextDayFundAmount(String((config as any).next_day_fund_amount || 0));
      setLowBillDenominations((config as any).low_bill_denominations || [1, 2, 5, 10]);
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
        next_day_fund_mode: nextDayFundMode,
        next_day_fund_amount: Number(nextDayFundAmount) || 0,
        low_bill_denominations: lowBillDenominations,
      };

      if (config) {
        const { error } = await supabase
          .from("cash_register_config")
          .update(payload as any)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("cash_register_config")
          .insert(payload as any);
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

  // All available denominations - owner picks which ones count as "low bills"
  const ALL_DENOMINATIONS = [1, 2, 3, 5, 10, 20, 50, 100, 200, 500, 1000];

  return (
    <div className="space-y-4">
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
                  Conteo de billetes chicos
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

          {openingType === "small_bills" && (
            <div className="space-y-2">
              <Label className="text-sm">Denominaciones para conteo de apertura</Label>
              <p className="text-xs text-muted-foreground">
                Selecciona qué billetes se contarán al abrir caja.
              </p>
              <div className="flex flex-wrap gap-2">
                {ALL_DENOMINATIONS.map((d) => {
                  const selected = lowBillDenominations.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setLowBillDenominations((prev) =>
                          selected ? prev.filter((v) => v !== d) : [...prev, d].sort((a, b) => a - b)
                        );
                      }}
                      className={`px-3 py-1.5 rounded-md border text-sm font-mono transition-colors ${
                        selected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-input hover:bg-muted"
                      }`}
                    >
                      ${d}
                    </button>
                  );
                })}
              </div>
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

      {/* Next-day fund config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-4 w-4" /> Fondo para el día siguiente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Al cerrar caja, el sistema separará automáticamente un fondo para la apertura del día siguiente. Este monto no cuenta como recaudación del día.
          </p>

          <RadioGroup value={nextDayFundMode} onValueChange={setNextDayFundMode} className="space-y-2">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="none" id="fund-none" />
              <Label htmlFor="fund-none" className="text-sm cursor-pointer">
                Sin fondo automático
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="fixed" id="fund-fixed" />
              <Label htmlFor="fund-fixed" className="text-sm cursor-pointer">
                Monto fijo <span className="text-muted-foreground">(el dueño define la cantidad)</span>
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="low_bills" id="fund-low-bills" />
              <Label htmlFor="fund-low-bills" className="text-sm cursor-pointer">
                Billetes bajos <span className="text-muted-foreground">(suma de billetes seleccionados contados al cierre)</span>
              </Label>
            </div>
          </RadioGroup>

          {nextDayFundMode === "fixed" && (
            <div className="space-y-1">
              <Label className="text-sm">Monto fijo del fondo</Label>
              <Input
                type="number"
                min={0}
                value={nextDayFundAmount}
                onChange={(e) => setNextDayFundAmount(e.target.value)}
                className="max-w-xs"
              />
            </div>
          )}

          {nextDayFundMode === "low_bills" && (
            <div className="space-y-2">
              <Label className="text-sm">Denominaciones consideradas bajas</Label>
              <p className="text-xs text-muted-foreground">
                Selecciona qué billetes se suman como fondo al cerrar caja.
              </p>
              <div className="flex flex-wrap gap-2">
                {ALL_DENOMINATIONS.map((d) => {
                  const selected = lowBillDenominations.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setLowBillDenominations((prev) =>
                          selected ? prev.filter((v) => v !== d) : [...prev, d].sort((a, b) => a - b)
                        );
                      }}
                      className={`px-3 py-1.5 rounded-md border text-sm font-mono transition-colors ${
                        selected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-input hover:bg-muted"
                      }`}
                    >
                      ${d}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            Guardar configuración
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CajaConfig;
