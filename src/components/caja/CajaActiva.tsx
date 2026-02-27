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
  ArrowDownRight,
  Wallet,
  CreditCard,
  Lock,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const DENOMINATIONS_SMALL = [1, 3, 5, 10];
const DENOMINATIONS_ALL = [1, 3, 5, 10, 20, 50, 100, 200, 500, 1000];

const CajaActiva = () => {
  const { profile, isOwner, isManager, isSuperAdmin } = useAuth();
  const isPrivileged = isOwner || isManager || isSuperAdmin;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [openingAmount, setOpeningAmount] = useState("");
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [billCounts, setBillCounts] = useState<Record<number, number>>({});
  const [closeNotes, setCloseNotes] = useState("");

  const branchId = profile?.branch_id;
  const businessId = profile?.business_id;

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

  // Fetch active cash register
  const { data: activeRegister, isLoading } = useQuery({
    queryKey: ["active-cash-register", branchId, profile?.user_id],
    queryFn: async () => {
      if (!branchId) return null;
      const mode = config?.mode || "branch";
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

  const expectedCash = useMemo(() => {
    if (!activeRegister) return 0;
    return Number(activeRegister.opening_amount) + (salesData?.cash || 0) + (servicesData?.cash || 0);
  }, [activeRegister, salesData, servicesData]);

  const totalTransfers = (salesData?.transfer || 0) + (servicesData?.transfer || 0);

  const countedTotal = useMemo(() => {
    return DENOMINATIONS_ALL.reduce((sum, d) => sum + d * (billCounts[d] || 0), 0);
  }, [billCounts]);

  // Open register
  const openMutation = useMutation({
    mutationFn: async () => {
      let amount = Number(openingAmount) || 0;
      if (config?.opening_type === "small_bills") {
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
        })
        .eq("id", activeRegister!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-cash-register"] });
      queryClient.invalidateQueries({ queryKey: ["cash-register-history"] });
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
          {config?.opening_type === "small_bills" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Cuenta los billetes de denominaciones 1–10:
              </p>
              <div className="grid grid-cols-2 gap-3">
                {DENOMINATIONS_SMALL.map((d) => (
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
                Total apertura: ${DENOMINATIONS_SMALL.reduce((s, d) => s + d * (billCounts[d] || 0), 0)}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cerrar caja</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending}>
              Confirmar cierre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CajaActiva;
