import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBranches } from "@/hooks/useBranches";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Wallet,
  CreditCard,
  DollarSign,
  ChevronDown,
  Clock,
  ArrowDownToLine,
  ArrowUpFromLine,
  Inbox,
  User,
  Store,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const CajaOwnerOverview = () => {
  const { profile } = useAuth();
  const { data: branches = [] } = useBranches();
  const queryClient = useQueryClient();

  const [selectedBranchId, setSelectedBranchId] = useState(
    profile?.branch_id || ""
  );

  useEffect(() => {
    if (!selectedBranchId && branches.length > 0) {
      setSelectedBranchId(branches[0].id);
    }
  }, [branches, selectedBranchId]);

  // Fetch all open registers for the selected branch (excluding owner)
  const { data: openRegisters = [], isLoading } = useQuery({
    queryKey: ["owner-open-registers", selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      const { data, error } = await supabase
        .from("cash_registers")
        .select("*")
        .eq("branch_id", selectedBranchId)
        .eq("status", "open")
        .order("opened_at", { ascending: true });
      if (error) throw error;
      // Exclude the owner's own register
      return (data || []).filter((r) => r.user_id !== profile?.user_id);
    },
    enabled: !!selectedBranchId,
  });

  // Fetch employee names
  const userIds = useMemo(
    () => [...new Set(openRegisters.map((r) => r.user_id))],
    [openRegisters]
  );

  const { data: profilesMap = {} } = useQuery({
    queryKey: ["register-profiles", userIds],
    queryFn: async () => {
      if (userIds.length === 0) return {};
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      const map: Record<string, string> = {};
      data?.forEach((p) => {
        map[p.user_id] = p.full_name;
      });
      return map;
    },
    enabled: userIds.length > 0,
  });

  // Fetch sales data for open registers
  const earliestOpen = useMemo(() => {
    if (openRegisters.length === 0) return null;
    return openRegisters.reduce(
      (min, r) => (r.opened_at < min ? r.opened_at : min),
      openRegisters[0].opened_at
    );
  }, [openRegisters]);

  const { data: salesByUser = {} } = useQuery({
    queryKey: ["owner-caja-sales", selectedBranchId, earliestOpen],
    queryFn: async () => {
      if (!selectedBranchId || !earliestOpen) return {};
      const { data } = await supabase
        .from("sales")
        .select("user_id, cash_amount, transfer_amount, created_at")
        .eq("branch_id", selectedBranchId)
        .eq("status", "completed")
        .gte("created_at", earliestOpen);
      const map: Record<string, { cash: number; transfer: number }> = {};
      openRegisters.forEach((r) => {
        map[r.user_id] = { cash: 0, transfer: 0 };
      });
      data?.forEach((s) => {
        const reg = openRegisters.find(
          (r) => r.user_id === s.user_id && s.created_at >= r.opened_at
        );
        if (reg) {
          if (!map[reg.user_id]) map[reg.user_id] = { cash: 0, transfer: 0 };
          map[reg.user_id].cash += Number(s.cash_amount || 0);
          map[reg.user_id].transfer += Number(s.transfer_amount || 0);
        }
      });
      return map;
    },
    enabled: !!earliestOpen,
    refetchInterval: 15000,
  });

  const { data: servicesByUser = {} } = useQuery({
    queryKey: ["owner-caja-services", selectedBranchId, earliestOpen],
    queryFn: async () => {
      if (!selectedBranchId || !earliestOpen) return {};
      const { data } = await supabase
        .from("service_entries")
        .select("user_id, amount, payment_type, created_at")
        .eq("branch_id", selectedBranchId)
        .gte("created_at", earliestOpen);
      const map: Record<string, { cash: number; transfer: number }> = {};
      openRegisters.forEach((r) => {
        map[r.user_id] = { cash: 0, transfer: 0 };
      });
      data?.forEach((s) => {
        const reg = openRegisters.find(
          (r) => r.user_id === s.user_id && s.created_at >= r.opened_at
        );
        if (reg) {
          if (!map[reg.user_id]) map[reg.user_id] = { cash: 0, transfer: 0 };
          if (s.payment_type === "cash") {
            map[reg.user_id].cash += Number(s.amount || 0);
          } else {
            map[reg.user_id].transfer += Number(s.amount || 0);
          }
        }
      });
      return map;
    },
    enabled: !!earliestOpen,
    refetchInterval: 15000,
  });

  // Fetch movements for open registers
  const registerIds = useMemo(
    () => openRegisters.map((r) => r.id),
    [openRegisters]
  );

  const { data: movementsByRegister = {} } = useQuery({
    queryKey: ["owner-caja-movements", registerIds],
    queryFn: async () => {
      if (registerIds.length === 0) return {};
      const { data } = await supabase
        .from("cash_register_movements" as any)
        .select("*")
        .in("cash_register_id", registerIds)
        .order("created_at", { ascending: false });
      const map: Record<string, any[]> = {};
      registerIds.forEach((id) => (map[id] = []));
      (data as any[])?.forEach((m) => {
        if (!map[m.cash_register_id]) map[m.cash_register_id] = [];
        map[m.cash_register_id].push(m);
      });
      return map;
    },
    enabled: registerIds.length > 0,
    refetchInterval: 15000,
  });

  // Realtime subscription
  useEffect(() => {
    if (!selectedBranchId) return;
    const channel = supabase
      .channel(`owner-caja-${selectedBranchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cash_registers",
          filter: `branch_id=eq.${selectedBranchId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["owner-open-registers", selectedBranchId],
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedBranchId, queryClient]);

  // Consolidated totals (employees only)
  const totals = useMemo(() => {
    let cash = 0;
    let transfer = 0;
    openRegisters.forEach((r) => {
      const uid = r.user_id;
      const sCash = salesByUser[uid]?.cash || 0;
      const sTransfer = salesByUser[uid]?.transfer || 0;
      const svCash = servicesByUser[uid]?.cash || 0;
      const svTransfer = servicesByUser[uid]?.transfer || 0;
      const mvDelta =
        (movementsByRegister[r.id] || []).reduce((sum: number, m: any) => {
          return (
            sum +
            (m.movement_type === "insertion"
              ? Number(m.amount)
              : -Number(m.amount))
          );
        }, 0);
      cash += Number(r.opening_amount) + sCash + svCash + mvDelta;
      transfer += sTransfer + svTransfer;
    });
    return { cash, transfer, total: cash + transfer };
  }, [openRegisters, salesByUser, servicesByUser, movementsByRegister]);

  const selectedBranch = branches.find((b) => b.id === selectedBranchId);

  return (
    <div className="space-y-6 mt-2">
      {/* ===== SECTION 1: Cajas del negocio ===== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <Store className="h-4 w-4 text-muted-foreground" />
            Cajas del negocio
          </h2>
          {branches.length > 1 && (
            <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="Sucursal" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id} className="text-xs">
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {branches.length === 1 && selectedBranch && (
            <span className="text-xs text-muted-foreground">
              {selectedBranch.name}
            </span>
          )}
        </div>

        {/* Consolidated summary */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Wallet className="h-3.5 w-3.5" /> Efectivo
              </div>
              <div className="text-lg font-bold">${totals.cash.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mb-1">
                <CreditCard className="h-3.5 w-3.5" /> Transferencias
              </div>
              <div className="text-lg font-bold">
                ${totals.transfer.toFixed(2)}
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mb-1">
                <DollarSign className="h-3.5 w-3.5" /> Total
              </div>
              <div className="text-lg font-bold">${totals.total.toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Open register cards */}
        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Cargando cajas...
          </div>
        ) : openRegisters.length === 0 ? (
          <Card>
            <CardContent className="py-10 flex flex-col items-center gap-3 text-muted-foreground">
              <Inbox className="h-10 w-10" />
              <p className="text-sm">No hay cajas de empleados abiertas en esta sucursal</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground">
              Cajas abiertas ({openRegisters.length})
            </h3>
            {openRegisters.map((reg) => {
              const uid = reg.user_id;
              const sCash = salesByUser[uid]?.cash || 0;
              const svCash = servicesByUser[uid]?.cash || 0;
              const sTransfer = salesByUser[uid]?.transfer || 0;
              const svTransfer = servicesByUser[uid]?.transfer || 0;
              const movements = movementsByRegister[reg.id] || [];
              const mvDelta = movements.reduce(
                (sum: number, m: any) =>
                  sum +
                  (m.movement_type === "insertion"
                    ? Number(m.amount)
                    : -Number(m.amount)),
                0
              );
              const expectedCash =
                Number(reg.opening_amount) + sCash + svCash + mvDelta;
              const totalTransfers = sTransfer + svTransfer;

              return (
                <RegisterCard
                  key={reg.id}
                  register={reg}
                  employeeName={profilesMap[uid] || "Empleado"}
                  salesCash={sCash}
                  servicesCash={svCash}
                  transfers={totalTransfers}
                  expectedCash={expectedCash}
                  movements={movements}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

/* ───── Employee Register Card (collapsible) ───── */

interface RegisterCardProps {
  register: any;
  employeeName: string;
  salesCash: number;
  servicesCash: number;
  transfers: number;
  expectedCash: number;
  movements: any[];
}

const RegisterCard = ({
  register,
  employeeName,
  salesCash,
  servicesCash,
  transfers,
  expectedCash,
  movements,
}: RegisterCardProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full text-left p-4 hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">{employeeName}</span>
                <Badge
                  variant="default"
                  className="gap-1 text-[10px] px-1.5 py-0"
                >
                  <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                  Abierta
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {format(new Date(register.opened_at), "HH:mm", {
                    locale: es,
                  })}
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${
                    open ? "rotate-180" : ""
                  }`}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Apertura</span>
                <p className="font-semibold">
                  ${Number(register.opening_amount).toFixed(2)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Ventas $</span>
                <p className="font-semibold text-green-600">
                  ${salesCash.toFixed(2)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Servicios $</span>
                <p className="font-semibold text-blue-600">
                  ${servicesCash.toFixed(2)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Transferencias</span>
                <p className="font-semibold">${transfers.toFixed(2)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Esperado</span>
                <p className="font-bold text-primary">
                  ${expectedCash.toFixed(2)}
                </p>
              </div>
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t px-4 py-3 space-y-2 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground">
              Movimientos manuales
            </p>
            {movements.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Sin movimientos manuales
              </p>
            ) : (
              movements.map((m: any) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between text-xs py-1.5 border-b last:border-0"
                >
                  <div className="flex items-center gap-2">
                    {m.movement_type === "insertion" ? (
                      <ArrowDownToLine className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <ArrowUpFromLine className="h-3.5 w-3.5 text-red-600" />
                    )}
                    <span>{m.reason || "Sin motivo"}</span>
                  </div>
                  <span
                    className={
                      m.movement_type === "insertion"
                        ? "text-green-600 font-medium"
                        : "text-red-600 font-medium"
                    }
                  >
                    {m.movement_type === "insertion" ? "+" : "-"}$
                    {Number(m.amount).toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default CajaOwnerOverview;
