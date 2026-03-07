import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Plus,
  Bell,
  Check,
  X,
  Info,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import TreasuryCategoryManager from "./TreasuryCategoryManager";
import TreasuryMovementModal from "./TreasuryMovementModal";
import BalancePersonalCards from "./BalancePersonalCards";
import BalanceHistoryTable from "./BalanceHistoryTable";
import BalanceIncomeExpenseChart from "./BalanceIncomeExpenseChart";

type Period = "today" | "week" | "month" | "all";
type TreasuryMode = "operativo" | "real";

interface Props {
  businessId: string;
  branchId?: string | null;
  prefillType?: "extraccion" | "inyeccion" | null;
  onPrefillConsumed?: () => void;
}

const LS_KEY_PREFIX = "bivoo-treasury-mode-";

export default function TreasuryMovimientos({ businessId, branchId, prefillType, onPrefillConsumed }: Props) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPrefill, setModalPrefill] = useState<"extraccion" | "inyeccion" | null>(null);
  const [period, setPeriod] = useState<Period>("today");
  const [mode, setMode] = useState<TreasuryMode>(() => {
    const saved = localStorage.getItem(`${LS_KEY_PREFIX}${businessId}`);
    return (saved === "real" ? "real" : "operativo") as TreasuryMode;
  });

  const toggleMode = (m: TreasuryMode) => {
    setMode(m);
    localStorage.setItem(`${LS_KEY_PREFIX}${businessId}`, m);
  };

  // Handle prefill from assistant
  useEffect(() => {
    if (prefillType && !modalOpen) {
      setModalPrefill(prefillType);
      setModalOpen(true);
      onPrefillConsumed?.();
    }
  }, [prefillType]);

  const { data: categories = [] } = useQuery({
    queryKey: ["treasury-categories", businessId],
    queryFn: async () => {
      const { data } = await supabase
        .from("treasury_categories" as any)
        .select("*")
        .eq("business_id", businessId)
        .order("sort_order");
      if (!data || data.length === 0) {
        const defaults = [
          "Alimentación y mercado",
          "Transporte",
          "Servicios (agua, luz, internet)",
          "Gastos imprevistos",
          "Retiro personal del dueño",
          "Entrega de caja",
        ];
        const rows = defaults.map((name, i) => ({
          business_id: businessId,
          name,
          sort_order: i,
        }));
        const { data: seeded } = await supabase
          .from("treasury_categories" as any)
          .insert(rows)
          .select();
        return (seeded as any[]) || [];
      }
      return (data as any[]) || [];
    },
    enabled: !!businessId,
  });

  // Pending entries from employee register closings
  const { data: pendingEntries = [] } = useQuery({
    queryKey: ["treasury-pending-entries", businessId],
    queryFn: async () => {
      const { data } = await supabase
        .from("treasury_pending_entries" as any)
        .select("*")
        .eq("business_id", businessId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
    enabled: !!businessId,
  });

  // Fetch employee names for pending entries
  const pendingUserIds = useMemo(() => [...new Set(pendingEntries.map((e: any) => e.employee_user_id))], [pendingEntries]);
  const { data: pendingProfilesMap = {} } = useQuery({
    queryKey: ["pending-profiles", pendingUserIds],
    queryFn: async () => {
      if (pendingUserIds.length === 0) return {};
      const { data } = await supabase.from("profiles").select("user_id, full_name").in("user_id", pendingUserIds);
      const map: Record<string, string> = {};
      data?.forEach((p) => {
        if (p.full_name) map[p.user_id] = p.full_name;
      });
      // Fallback for @bivoo.app employees
      const missing = pendingUserIds.filter((id) => !map[id]);
      if (missing.length > 0) {
        const { data: empData } = await supabase
          .from("employees")
          .select("auth_user_id, full_name")
          .in("auth_user_id", missing);
        empData?.forEach((e) => {
          if (e.auth_user_id && e.full_name) map[e.auth_user_id] = e.full_name;
        });
      }
      return map;
    },
    enabled: pendingUserIds.length > 0,
  });

  const confirmEntryMutation = useMutation({
    mutationFn: async (entry: any) => {
      const entregaCat = categories.find((c: any) => c.name === "Entrega de caja");
      await supabase.from("treasury_movements" as any).insert({
        business_id: businessId,
        user_id: profile!.user_id,
        movement_type: "inyeccion",
        amount: entry.amount,
        category_id: entregaCat?.id || null,
        label: "negocio",
        payment_method: "efectivo",
        origin: pendingProfilesMap[entry.employee_user_id] || "Empleado",
        reason: "Entrega de caja al cerrar jornada",
      });
      await supabase.from("treasury_pending_entries" as any).update({ status: "confirmed" }).eq("id", entry.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["treasury-pending-entries"] });
      queryClient.invalidateQueries({ queryKey: ["treasury-movements"] });
      queryClient.invalidateQueries({ queryKey: ["bp-injections"] });
      queryClient.invalidateQueries({ queryKey: ["bh-treasury"] });
    },
  });

  const ignoreEntryMutation = useMutation({
    mutationFn: async (entryId: string) => {
      await supabase.from("treasury_pending_entries" as any).update({ status: "ignored" }).eq("id", entryId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["treasury-pending-entries"] });
    },
  });

  const handleNewMovement = (type?: "extraccion" | "inyeccion") => {
    setModalPrefill(type || null);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Period selector + mode toggle */}
      <div className="flex items-center gap-2 flex-wrap justify-between">
        <div className="flex gap-1.5 overflow-x-auto">
          {([
            { key: "today", label: "Hoy" },
            { key: "week", label: "Esta Semana" },
            { key: "month", label: "Este Mes" },
            { key: "all", label: "Todos" },
          ] as { key: Period; label: string }[]).map((p) => (
            <Button
              key={p.key}
              size="sm"
              variant={period === p.key ? "default" : "outline"}
              className="text-xs h-8 shrink-0"
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              className={`px-2.5 py-1 text-xs font-medium transition-colors ${mode === "operativo" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}
              onClick={() => toggleMode("operativo")}
            >
              Operativo
            </button>
            <button
              className={`px-2.5 py-1 text-xs font-medium transition-colors ${mode === "real" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}
              onClick={() => toggleMode("real")}
            >
              Real
            </button>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                {mode === "operativo"
                  ? "Mide la rentabilidad de lo que vendiste. El inventario no vendido no afecta el resultado."
                  : "Muestra el flujo de caja real. Cada compra de inventario aparece como gasto en la fecha en que se realizó."}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Balance Personal Cards */}
      <BalancePersonalCards businessId={businessId} branchId={branchId} period={period} mode={mode} />

      {/* Action buttons */}
      <div className="flex items-center justify-between pt-2 border-t">
        <Button onClick={() => handleNewMovement()} className="gap-2" size="sm">
          <Plus className="h-4 w-4" /> Nuevo movimiento
        </Button>
        <TreasuryCategoryManager businessId={businessId} />
      </div>

      {/* Pending entries */}
      {pendingEntries.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <Bell className="h-3.5 w-3.5" /> Entregas pendientes ({pendingEntries.length})
          </h3>
          {pendingEntries.map((entry: any) => (
            <Card key={entry.id} className="border-amber-300/50 bg-amber-50/50 dark:border-amber-700/30 dark:bg-amber-950/20">
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-sm font-medium">
                      {pendingProfilesMap[entry.employee_user_id] || "Empleado"} entregó caja
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Monto: <span className="font-semibold text-foreground">${Number(entry.amount).toLocaleString("es", { minimumFractionDigits: 2 })}</span>
                      {" · "}
                      {format(new Date(entry.created_at), "dd MMM yyyy · HH:mm", { locale: es })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 text-xs border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400"
                      onClick={() => confirmEntryMutation.mutate(entry)}
                      disabled={confirmEntryMutation.isPending}
                    >
                      <Check className="h-3.5 w-3.5" /> Confirmar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 gap-1 text-xs text-muted-foreground"
                      onClick={() => ignoreEntryMutation.mutate(entry.id)}
                      disabled={ignoreEntryMutation.isPending}
                    >
                      <X className="h-3.5 w-3.5" /> Ignorar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Historical table */}
      <BalanceHistoryTable businessId={businessId} branchId={branchId} period={period} />

      {/* Modals */}
      <TreasuryMovementModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        businessId={businessId}
        prefillType={modalPrefill}
        defaultBranchId={branchId}
      />
    </div>
  );
}
