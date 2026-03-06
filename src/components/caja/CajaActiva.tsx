import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Wallet,
  CreditCard,
  Lock,
  Banknote,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import CajaMovementModal from "@/components/caja/CajaMovementModal";

const DENOMINATIONS_SMALL = [1, 3, 5, 10];
const DENOMINATIONS_LOW = [1, 2, 5, 10];
const DENOMINATIONS_ALL = [1, 2, 3, 5, 10, 20, 50, 100, 200, 500, 1000];

interface CajaActivaProps {
  forceEmployeeMode?: boolean;
}

const CajaActiva = ({ forceEmployeeMode = false }: CajaActivaProps = {}) => {
  const { profile, isOwner, isManager, isSuperAdmin } = useAuth();
  const isPrivileged = isOwner || isManager || isSuperAdmin;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [openingAmount, setOpeningAmount] = useState("");
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [billCounts, setBillCounts] = useState<Record<number, number>>({});
  const [closeNotes, setCloseNotes] = useState("");
  const [movementModal, setMovementModal] = useState<{ open: boolean; type: "insertion" | "extraction" }>({ open: false, type: "insertion" });

  // Resolve branch/business from employees table for @bivoo.app users
  const { data: empRecord } = useQuery({
    queryKey: ["employee-session-record-caja", profile?.user_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("branch_id, business_id")
        .eq("auth_user_id", profile!.user_id)
        .maybeSingle();
      return data;
    },
    enabled: !!profile?.user_id,
  });

  const branchId = empRecord?.branch_id || profile?.branch_id;
  const businessId = empRecord?.business_id || profile?.business_id;

  // Fetch config
  const { data: config } = useQuery({
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

  // Fetch last closed register to get next_day_fund
  const { data: lastClosedFund } = useQuery({
    queryKey: ["last-closed-fund", branchId, profile?.user_id],
    queryFn: async () => {
      if (!branchId) return 0;
      const mode = forceEmployeeMode ? "employee" : (config?.mode || "branch");
      let query = supabase
        .from("cash_registers")
        .select("next_day_fund")
        .eq("branch_id", branchId)
        .eq("status", "closed")
        .order("closed_at", { ascending: false })
        .limit(1);

      if (mode === "employee") {
        query = query.eq("user_id", profile!.user_id);
      }

      const { data } = await query.maybeSingle();
      return Number((data as any)?.next_day_fund || 0);
    },
    enabled: !!branchId && config !== undefined,
  });

  // Fetch active cash register
  const { data: activeRegister, isLoading } = useQuery({
    queryKey: ["active-cash-register", branchId, profile?.user_id],
    queryFn: async () => {
      if (!branchId) return null;
      const mode = forceEmployeeMode ? "employee" : (config?.mode || "branch");
      let query = supabase
        .from("cash_registers")
        .select("*")
        .eq("branch_id", branchId)
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1);

      if (mode === "employee") {
        query = query.eq("user_id", profile!.user_id);
      }

      const { data } = await query.maybeSingle();
      return data;
    },
    enabled: !!branchId && config !== undefined,
  });

  // Real-time sales data since register opened
  const { data: salesData } = useQuery({
    queryKey: ["caja-sales-today", branchId, activeRegister?.opened_at],
    queryFn: async () => {
      if (!branchId || !activeRegister?.opened_at) return { cash: 0, transfer: 0 };
      const { data } = await supabase
        .from("sales")
        .select("cash_amount, transfer_amount")
        .eq("branch_id", branchId)
        .eq("status", "completed")
        .gte("created_at", activeRegister.opened_at);
      const cash = data?.reduce((s, r) => s + Number(r.cash_amount || 0), 0) || 0;
      const transfer = data?.reduce((s, r) => s + Number(r.transfer_amount || 0), 0) || 0;
      return { cash, transfer };
    },
    enabled: !!activeRegister,
    refetchInterval: 15000,
  });

  // Real-time services data
  const { data: servicesData } = useQuery({
    queryKey: ["caja-services-today", branchId, activeRegister?.opened_at],
    queryFn: async () => {
      if (!branchId || !activeRegister?.opened_at) return { cash: 0, transfer: 0 };
      const { data } = await supabase
        .from("service_entries")
        .select("amount, payment_type")
        .eq("branch_id", branchId)
        .gte("created_at", activeRegister.opened_at);
      const cash = data?.filter(s => s.payment_type === "cash").reduce((s, r) => s + Number(r.amount || 0), 0) || 0;
      const transfer = data?.filter(s => s.payment_type !== "cash").reduce((s, r) => s + Number(r.amount || 0), 0) || 0;
      return { cash, transfer };
    },
    enabled: !!activeRegister,
    refetchInterval: 15000,
  });

  // Fetch cash register movements
  const { data: cajaMovements = [] } = useQuery({
    queryKey: ["caja-movements", activeRegister?.id],
    queryFn: async () => {
      if (!activeRegister?.id) return [];
      const { data } = await supabase
        .from("cash_register_movements" as any)
        .select("*")
        .eq("cash_register_id", activeRegister.id)
        .order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
    enabled: !!activeRegister?.id,
    refetchInterval: 15000,
  });

  const movementsCashDelta = useMemo(() => {
    return cajaMovements.reduce((sum: number, m: any) => {
      return sum + (m.movement_type === "insertion" ? Number(m.amount) : -Number(m.amount));
    }, 0);
  }, [cajaMovements]);

  const expectedCash = useMemo(() => {
    if (!activeRegister) return 0;
    return Number(activeRegister.opening_amount) + (salesData?.cash || 0) + (servicesData?.cash || 0) + movementsCashDelta;
  }, [activeRegister, salesData, servicesData, movementsCashDelta]);

  const totalTransfers = (salesData?.transfer || 0) + (servicesData?.transfer || 0);

  const countedTotal = useMemo(() => {
    return DENOMINATIONS_ALL.reduce((sum, d) => sum + d * (billCounts[d] || 0), 0);
  }, [billCounts]);

  // Calculate next-day fund based on config
  const configDenominations: number[] = (config as any)?.low_bill_denominations || DENOMINATIONS_LOW;

  const nextDayFund = useMemo(() => {
    const fundMode = (config as any)?.next_day_fund_mode || "none";
    if (fundMode === "none") return 0;
    if (fundMode === "fixed") return Number((config as any)?.next_day_fund_amount || 0);
    if (fundMode === "low_bills") {
      return configDenominations.reduce((sum: number, d: number) => sum + d * (billCounts[d] || 0), 0);
    }
    return 0;
  }, [config, billCounts, configDenominations]);

  const fundMode = (config as any)?.next_day_fund_mode || "none";

  // Determine auto-opening amount
  const autoOpeningAmount = lastClosedFund && lastClosedFund > 0 ? lastClosedFund : null;

  // Open register
  const openMutation = useMutation({
    mutationFn: async () => {
      let amount = Number(openingAmount) || 0;
      if (autoOpeningAmount && autoOpeningAmount > 0) {
        amount = autoOpeningAmount;
      } else if (config?.opening_type === "small_bills") {
        amount = DENOMINATIONS_SMALL.reduce((s, d) => s + d * (billCounts[d] || 0), 0);
      } else if (config?.opening_type === "fixed") {
        amount = Number(config.fixed_opening_amount) || 0;
      }
      const { error } = await supabase.from("cash_registers").insert({
        branch_id: branchId!,
        business_id: businessId!,
        user_id: profile!.user_id,
        opening_amount: amount,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-cash-register"] });
      queryClient.invalidateQueries({ queryKey: ["last-closed-fund"] });
      toast({ title: "Caja abierta" });
      setOpeningAmount("");
      setBillCounts({});
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Close register
  const closeMutation = useMutation({
    mutationFn: async () => {
      const diff = countedTotal - expectedCash;
      const netToDeliverCalc = countedTotal - nextDayFund;
      const { error } = await supabase
        .from("cash_registers")
        .update({
          status: "closed",
          counted_cash: countedTotal,
          expected_cash: expectedCash,
          difference: diff,
          total_sales_cash: salesData?.cash || 0,
          total_sales_transfer: salesData?.transfer || 0,
          total_services_cash: servicesData?.cash || 0,
          total_services_transfer: servicesData?.transfer || 0,
          notes: closeNotes || null,
          closed_at: new Date().toISOString(),
          next_day_fund: nextDayFund,
        } as any)
        .eq("id", activeRegister!.id);
      if (error) throw error;

      // Create treasury pending entry if net to deliver > 0
      if (netToDeliverCalc > 0 && businessId) {
        await supabase
          .from("treasury_pending_entries" as any)
          .insert({
            business_id: businessId,
            employee_user_id: profile!.user_id,
            cash_register_id: activeRegister!.id,
            amount: netToDeliverCalc,
            status: "pending",
          });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-cash-register"] });
      queryClient.invalidateQueries({ queryKey: ["cash-register-history"] });
      queryClient.invalidateQueries({ queryKey: ["last-closed-fund"] });
      setShowCloseDialog(false);
      setBillCounts({});
      setCloseNotes("");
      toast({ title: "Caja cerrada exitosamente" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="py-8 text-center text-sm text-muted-foreground">Cargando...</div>;

  // No active register → show open form
  if (!activeRegister) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-4 w-4" /> Abrir caja
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Auto-load from previous fund */}
          {autoOpeningAmount && autoOpeningAmount > 0 ? (
            <div className="space-y-2">
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Banknote className="h-4 w-4 text-primary" />
                  Fondo del día anterior
                </div>
                <p className="text-2xl font-bold text-primary">${autoOpeningAmount.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">
                  Este monto fue separado en el cierre anterior y se usa como apertura automática.
                </p>
              </div>
            </div>
          ) : config?.opening_type === "small_bills" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Cuenta los billetes de las denominaciones seleccionadas:
              </p>
              <div className="grid grid-cols-2 gap-3">
                {configDenominations.map((d) => (
                  <div key={d} className="flex items-center gap-2">
                    <Label className="w-10 text-right text-sm font-mono">${d}</Label>
                    <Input
                      type="number"
                      min={0}
                      className="h-9"
                      value={billCounts[d] || ""}
                      onChange={(e) =>
                        setBillCounts((p) => ({ ...p, [d]: parseInt(e.target.value) || 0 }))
                      }
                      placeholder="0"
                    />
                    <span className="text-xs text-muted-foreground w-16">
                      = ${d * (billCounts[d] || 0)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="text-sm font-semibold">
                Total apertura: ${configDenominations.reduce((s: number, d: number) => s + d * (billCounts[d] || 0), 0)}
              </div>
            </div>
          ) : config?.opening_type === "fixed" ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Monto fijo de apertura configurado:
              </p>
              <div className="text-2xl font-bold">${config.fixed_opening_amount}</div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-sm">Monto de apertura</Label>
              <Input
                type="number"
                min={0}
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          )}
          <Button onClick={() => openMutation.mutate()} disabled={openMutation.isPending} className="w-full">
            Abrir caja
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Active register → show dashboard
  const difference = countedTotal - expectedCash;
  const netToDeliver = countedTotal - nextDayFund;

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant="default" className="gap-1">
            <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            Caja abierta
          </Badge>
          <span className="text-xs text-muted-foreground">
            Desde {format(new Date(activeRegister.opened_at), "HH:mm · dd MMM", { locale: es })}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Wallet className="h-3.5 w-3.5" /> Fondo apertura
              </div>
              <div className="text-lg font-bold">${Number(activeRegister.opening_amount).toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <ArrowUpRight className="h-3.5 w-3.5 text-green-500" /> Ventas efectivo
              </div>
              <div className="text-lg font-bold text-green-600">${(salesData?.cash || 0).toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <ArrowUpRight className="h-3.5 w-3.5 text-blue-500" /> Servicios efectivo
              </div>
              <div className="text-lg font-bold text-blue-600">${(servicesData?.cash || 0).toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <CreditCard className="h-3.5 w-3.5" /> Transferencias
              </div>
              <div className="text-lg font-bold">${totalTransfers.toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Efectivo esperado en caja</p>
                <p className="text-2xl font-bold">${expectedCash.toFixed(2)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-primary/40" />
            </div>
          </CardContent>
        </Card>

        {/* Insert / Extract buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="gap-2 border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950"
            onClick={() => setMovementModal({ open: true, type: "insertion" })}
          >
            <ArrowDownToLine className="h-4 w-4" /> Insertar en Caja
          </Button>
          <Button
            variant="outline"
            className="gap-2 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
            onClick={() => setMovementModal({ open: true, type: "extraction" })}
          >
            <ArrowUpFromLine className="h-4 w-4" /> Sacar de Caja
          </Button>
        </div>

        {/* Movement history */}
        {cajaMovements.length > 0 && (
          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs text-muted-foreground">Movimientos de esta caja</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-1.5">
              {cajaMovements.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between text-xs py-1.5 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    {m.movement_type === "insertion" ? (
                      <ArrowDownToLine className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <ArrowUpFromLine className="h-3.5 w-3.5 text-red-600" />
                    )}
                    <span className="text-muted-foreground truncate max-w-[180px]">
                      {m.reason || (m.movement_type === "insertion" ? "Inserción" : "Extracción")}
                    </span>
                  </div>
                  <span className={`font-bold ${m.movement_type === "insertion" ? "text-green-600" : "text-red-600"}`}>
                    {m.movement_type === "insertion" ? "+" : "-"}${Number(m.amount).toFixed(2)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Button
          variant="destructive"
          className="w-full gap-2"
          onClick={() => {
            setBillCounts({});
            setCloseNotes("");
            setShowCloseDialog(true);
          }}
        >
          <Lock className="h-4 w-4" /> Cerrar caja
        </Button>
      </div>

      {/* Close dialog with bill counting */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent className="max-h-[90vh] p-0 sm:max-w-lg">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>Cerrar caja</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] px-6">
            <div className="space-y-4 pb-4">
              <p className="text-sm text-muted-foreground">Cuenta el efectivo en caja:</p>
              <div className="grid grid-cols-2 gap-2">
                {DENOMINATIONS_ALL.map((d) => (
                  <div key={d} className="flex items-center gap-2">
                    <Label className="w-12 text-right text-sm font-mono">${d}</Label>
                    <Input
                      type="number"
                      min={0}
                      className="h-8 text-sm"
                      value={billCounts[d] || ""}
                      onChange={(e) =>
                        setBillCounts((p) => ({ ...p, [d]: parseInt(e.target.value) || 0 }))
                      }
                      placeholder="0"
                    />
                    <span className="text-xs text-muted-foreground w-14">
                      ${d * (billCounts[d] || 0)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Contado:</span>
                  <span className="font-bold">${countedTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Esperado:</span>
                  <span className="font-medium">${expectedCash.toFixed(2)}</span>
                </div>
                <div className={`flex justify-between text-sm font-bold ${difference >= 0 ? "text-green-600" : "text-red-600"}`}>
                  <span className="flex items-center gap-1">
                    {difference >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    Diferencia:
                  </span>
                  <span>{difference >= 0 ? "+" : ""}{difference.toFixed(2)}</span>
                </div>
              </div>

              {/* Next-day fund section */}
              {fundMode !== "none" && (
                <div className="border-t pt-3 space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-1.5">
                    <Banknote className="h-4 w-4 text-primary" />
                    Fondo para el día siguiente
                  </h4>
                  {fundMode === "fixed" && (
                    <p className="text-xs text-muted-foreground">
                      Monto fijo configurado por el dueño.
                    </p>
                  )}
                  {fundMode === "low_bills" && (
                    <p className="text-xs text-muted-foreground">
                      Suma automática de billetes de $1, $2, $5 y $10 contados arriba.
                    </p>
                  )}
                  <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Fondo a dejar:</span>
                      <span className="font-bold text-primary">${nextDayFund.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total recaudado:</span>
                      <span className="font-medium">${countedTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold border-t pt-1.5">
                      <span>Neto a entregar al dueño:</span>
                      <span>${Math.max(0, netToDeliver).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <Label className="text-sm">Notas (opcional)</Label>
                <Textarea
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="Observaciones del cierre..."
                  rows={2}
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="px-6 pb-6 pt-3 border-t">
            <Button variant="outline" onClick={() => setShowCloseDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending}>
              Confirmar cierre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Movement modal */}
      {activeRegister && (
        <CajaMovementModal
          open={movementModal.open}
          onOpenChange={(open) => setMovementModal((p) => ({ ...p, open }))}
          type={movementModal.type}
          registerId={activeRegister.id}
          branchId={branchId!}
          businessId={businessId!}
        />
      )}
    </>
  );
};

export default CajaActiva;
