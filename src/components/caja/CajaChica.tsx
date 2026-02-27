import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { PiggyBank, Plus, Minus, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const CajaChica = () => {
  const { profile, isOwner, isManager, isSuperAdmin } = useAuth();
  const isPrivileged = isOwner || isManager || isSuperAdmin;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const branchId = profile?.branch_id;
  const businessId = profile?.business_id;

  const [showMovDialog, setShowMovDialog] = useState(false);
  const [movType, setMovType] = useState<"deposit" | "withdrawal">("deposit");
  const [movAmount, setMovAmount] = useState("");
  const [movReason, setMovReason] = useState("");

  // Fetch or create petty cash
  const { data: pettyCash, isLoading } = useQuery({
    queryKey: ["petty-cash", branchId],
    queryFn: async () => {
      if (!branchId) return null;
      const { data } = await supabase
        .from("petty_cash")
        .select("*")
        .eq("branch_id", branchId)
        .maybeSingle();
      return data;
    },
    enabled: !!branchId,
  });

  // Fetch movements
  const { data: movements = [] } = useQuery({
    queryKey: ["petty-cash-movements", pettyCash?.id],
    queryFn: async () => {
      if (!pettyCash?.id) return [];
      const { data } = await supabase
        .from("petty_cash_movements")
        .select("*")
        .eq("petty_cash_id", pettyCash.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!pettyCash?.id,
  });

  // Fetch user names for movements
  const { data: userNames = {} } = useQuery({
    queryKey: ["petty-cash-user-names", movements.map(m => m.user_id).join(",")],
    queryFn: async () => {
      const userIds = [...new Set(movements.map(m => m.user_id))];
      if (!userIds.length) return {};
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      const map: Record<string, string> = {};
      data?.forEach(p => { map[p.user_id] = p.full_name; });
      return map;
    },
    enabled: movements.length > 0,
  });

  // Initialize petty cash
  const initMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("petty_cash").insert({
        branch_id: branchId!,
        business_id: businessId!,
        balance: 0,
        min_alert: 100,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["petty-cash"] });
      toast({ title: "Caja chica creada" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Add movement
  const movMutation = useMutation({
    mutationFn: async () => {
      const amount = Number(movAmount);
      if (!amount || amount <= 0) throw new Error("Monto inválido");

      if (movType === "withdrawal" && amount > Number(pettyCash!.balance)) {
        throw new Error("Saldo insuficiente");
      }

      // Insert movement
      const { error: movErr } = await supabase.from("petty_cash_movements").insert({
        petty_cash_id: pettyCash!.id,
        branch_id: branchId!,
        business_id: businessId!,
        user_id: profile!.user_id,
        movement_type: movType,
        amount,
        reason: movReason || null,
      });
      if (movErr) throw movErr;

      // Update balance
      const newBalance = movType === "deposit"
        ? Number(pettyCash!.balance) + amount
        : Number(pettyCash!.balance) - amount;
      const { error: upErr } = await supabase
        .from("petty_cash")
        .update({ balance: newBalance })
        .eq("id", pettyCash!.id);
      if (upErr) throw upErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["petty-cash"] });
      queryClient.invalidateQueries({ queryKey: ["petty-cash-movements"] });
      setShowMovDialog(false);
      setMovAmount("");
      setMovReason("");
      toast({ title: movType === "deposit" ? "Depósito registrado" : "Retiro registrado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="py-8 text-center text-sm text-muted-foreground">Cargando...</div>;

  if (!pettyCash) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-3">
          <PiggyBank className="h-10 w-10 mx-auto text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No hay caja chica configurada para esta sucursal.</p>
          {isPrivileged && (
            <Button onClick={() => initMutation.mutate()} disabled={initMutation.isPending}>
              Crear caja chica
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const isLowBalance = Number(pettyCash.balance) <= Number(pettyCash.min_alert);

  return (
    <div className="space-y-4">
      <Card className={isLowBalance ? "border-destructive/50 bg-destructive/5" : ""}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <PiggyBank className="h-4 w-4" /> Caja chica
            {isLowBalance && (
              <Badge variant="destructive" className="gap-1 text-[10px]">
                <AlertTriangle className="h-3 w-3" /> Saldo bajo
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-3xl font-bold">${Number(pettyCash.balance).toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">
            Alerta cuando baje de ${Number(pettyCash.min_alert).toFixed(2)}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="gap-1"
              onClick={() => { setMovType("deposit"); setShowMovDialog(true); }}
            >
              <Plus className="h-3.5 w-3.5" /> Depositar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => { setMovType("withdrawal"); setShowMovDialog(true); }}
            >
              <Minus className="h-3.5 w-3.5" /> Retirar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Movements history */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Movimientos</CardTitle>
        </CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sin movimientos aún</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {movements.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {m.movement_type === "deposit" ? (
                        <Plus className="h-3 w-3 text-green-600 shrink-0" />
                      ) : (
                        <Minus className="h-3 w-3 text-red-600 shrink-0" />
                      )}
                      <span className="text-sm font-medium truncate">
                        {m.reason || (m.movement_type === "deposit" ? "Depósito" : "Retiro")}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground ml-4.5">
                      {(userNames as any)[m.user_id] || "—"} · {format(new Date(m.created_at), "dd/MM HH:mm")}
                    </div>
                  </div>
                  <span className={`text-sm font-mono font-semibold ${m.movement_type === "deposit" ? "text-green-600" : "text-red-600"}`}>
                    {m.movement_type === "deposit" ? "+" : "-"}${Number(m.amount).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Movement dialog */}
      <Dialog open={showMovDialog} onOpenChange={setShowMovDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{movType === "deposit" ? "Depositar a caja chica" : "Retirar de caja chica"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm">Monto</Label>
              <Input
                type="number"
                min={0}
                value={movAmount}
                onChange={(e) => setMovAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label className="text-sm">Motivo</Label>
              <Input
                value={movReason}
                onChange={(e) => setMovReason(e.target.value)}
                placeholder={movType === "withdrawal" ? "Ej: Compra de insumos" : "Ej: Reposición de fondo"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMovDialog(false)}>Cancelar</Button>
            <Button onClick={() => movMutation.mutate()} disabled={movMutation.isPending}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CajaChica;
