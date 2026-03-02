import { useMemo, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Wallet,
  ArrowUpRight,
  CreditCard,
  DollarSign,
  TrendingUp,
  TrendingDown,
  History,
  Clock,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";

interface MiCajaEmpleadoProps {
  businessId: string;
  branchId: string;
}

const MiCajaEmpleado = ({ businessId, branchId }: MiCajaEmpleadoProps) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Fetch active cash register for this employee
  const { data: activeRegister, isLoading } = useQuery({
    queryKey: ["my-active-register", branchId, profile?.user_id],
    queryFn: async () => {
      if (!branchId || !profile?.user_id) return null;
      // Try employee mode first, fallback to branch mode
      const { data: empReg } = await supabase
        .from("cash_registers")
        .select("*")
        .eq("branch_id", branchId)
        .eq("user_id", profile.user_id)
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (empReg) return empReg;

      // Branch mode — any open register for this branch
      const { data: branchReg } = await supabase
        .from("cash_registers")
        .select("*")
        .eq("branch_id", branchId)
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return branchReg;
    },
    enabled: !!branchId && !!profile?.user_id,
  });

  // Sales since register opened
  const { data: salesData } = useQuery({
    queryKey: ["my-caja-sales", branchId, activeRegister?.opened_at, profile?.user_id],
    queryFn: async () => {
      if (!branchId || !activeRegister?.opened_at) return { cash: 0, transfer: 0 };
      const { data } = await supabase
        .from("sales")
        .select("cash_amount, transfer_amount")
        .eq("branch_id", branchId)
        .eq("user_id", profile!.user_id)
        .eq("status", "completed")
        .gte("created_at", activeRegister.opened_at);
      const cash = data?.reduce((s, r) => s + Number(r.cash_amount || 0), 0) || 0;
      const transfer = data?.reduce((s, r) => s + Number(r.transfer_amount || 0), 0) || 0;
      return { cash, transfer };
    },
    enabled: !!activeRegister && !!profile?.user_id,
    refetchInterval: 15000,
  });

  // Services since register opened
  const { data: servicesData } = useQuery({
    queryKey: ["my-caja-services", branchId, activeRegister?.opened_at, profile?.user_id],
    queryFn: async () => {
      if (!branchId || !activeRegister?.opened_at) return { cash: 0, transfer: 0 };
      const { data } = await supabase
        .from("service_entries")
        .select("amount, payment_type")
        .eq("branch_id", branchId)
        .eq("user_id", profile!.user_id)
        .gte("created_at", activeRegister.opened_at);
      const cash = data?.filter(s => s.payment_type === "cash").reduce((s, r) => s + Number(r.amount || 0), 0) || 0;
      const transfer = data?.filter(s => s.payment_type !== "cash").reduce((s, r) => s + Number(r.amount || 0), 0) || 0;
      return { cash, transfer };
    },
    enabled: !!activeRegister && !!profile?.user_id,
    refetchInterval: 15000,
  });

  // Movements for this register
  const { data: movements = [] } = useQuery({
    queryKey: ["my-caja-movements", activeRegister?.id],
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

  // My closing history
  const { data: myHistory = [] } = useQuery({
    queryKey: ["my-caja-history", branchId, profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return [];
      const { data } = await supabase
        .from("cash_registers")
        .select("*")
        .eq("user_id", profile.user_id)
        .eq("status", "closed")
        .order("closed_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!profile?.user_id,
  });

  // Realtime subscription for sales, services, and movements
  useEffect(() => {
    if (!branchId || !activeRegister) return;
    const channel = supabase
      .channel(`mi-caja-realtime-${branchId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sales", filter: `branch_id=eq.${branchId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["my-caja-sales"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "service_entries", filter: `branch_id=eq.${branchId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["my-caja-services"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "cash_register_movements", filter: `cash_register_id=eq.${activeRegister.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["my-caja-movements"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [branchId, activeRegister?.id, queryClient]);

  const movementsDelta = useMemo(() => {
    return movements.reduce((sum: number, m: any) => {
      return sum + (m.movement_type === "insertion" ? Number(m.amount) : -Number(m.amount));
    }, 0);
  }, [movements]);

  const totalCashIn = (salesData?.cash || 0) + (servicesData?.cash || 0);
  const totalTransfers = (salesData?.transfer || 0) + (servicesData?.transfer || 0);
  const currentTotal = useMemo(() => {
    if (!activeRegister) return 0;
    return Number(activeRegister.opening_amount) + totalCashIn + movementsDelta;
  }, [activeRegister, totalCashIn, movementsDelta]);

  if (isLoading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Cargando...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Active register summary */}
      {activeRegister ? (
        <>
          <div className="flex items-center justify-between">
            <Badge variant="default" className="gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              Caja activa
            </Badge>
            <span className="text-xs text-muted-foreground">
              Desde {format(new Date(activeRegister.opened_at), "HH:mm · dd MMM", { locale: es })}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
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
                  <ArrowUpRight className="h-3.5 w-3.5 text-green-500" /> Mis ventas (efectivo)
                </div>
                <div className="text-lg font-bold text-green-600">${totalCashIn.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <CreditCard className="h-3.5 w-3.5" /> Mis transferencias
                </div>
                <div className="text-lg font-bold">${totalTransfers.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <DollarSign className="h-3.5 w-3.5" /> Total en caja
                </div>
                <div className="text-lg font-bold text-primary">${currentTotal.toFixed(2)}</div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Clock className="h-8 w-8 opacity-40 mb-2" />
            <p className="text-sm font-medium">No hay caja abierta</p>
            <p className="text-xs mt-1">La caja se abre desde el módulo Caja.</p>
          </CardContent>
        </Card>
      )}

      {/* Movements */}
      {movements.length > 0 && activeRegister && (
        <Card>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs text-muted-foreground">Movimientos de caja</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-1.5">
            {movements.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between text-xs py-1.5 border-b last:border-0">
                <div className="flex items-center gap-2">
                  {m.movement_type === "insertion" ? (
                    <ArrowDownToLine className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <ArrowUpFromLine className="h-3.5 w-3.5 text-red-600" />
                  )}
                  <span className="text-muted-foreground truncate max-w-[160px]">
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

      {/* My closing history */}
      {myHistory.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <History className="h-4 w-4" /> Mis cierres anteriores
          </h3>
          {myHistory.map((r: any) => {
            const diff = Number(r.difference || 0);
            const totalCash = Number(r.total_sales_cash || 0) + Number(r.total_services_cash || 0);
            const totalTr = Number(r.total_sales_transfer || 0) + Number(r.total_services_transfer || 0);

            return (
              <Card key={r.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(r.closed_at), "dd MMM yyyy · HH:mm", { locale: es })}
                    </p>
                    <Badge variant={diff >= 0 ? "default" : "destructive"} className="gap-1 text-xs">
                      {diff >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {diff >= 0 ? "+" : ""}{diff.toFixed(2)}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Apertura</span>
                      <p className="font-medium">${Number(r.opening_amount).toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Efectivo</span>
                      <p className="font-medium">${totalCash.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Transfer.</span>
                      <p className="font-medium">${totalTr.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Contado</span>
                      <p className="font-medium">${Number(r.counted_cash || 0).toFixed(2)}</p>
                    </div>
                  </div>
                  {Number(r.next_day_fund || 0) > 0 && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Wallet className="h-3 w-3" /> Fondo dejado: ${Number(r.next_day_fund).toFixed(2)}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MiCajaEmpleado;
