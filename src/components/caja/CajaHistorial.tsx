import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBranches } from "@/hooks/useBranches";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { History, TrendingUp, TrendingDown } from "lucide-react";

const CajaHistorial = () => {
  const { profile, isOwner, isManager, isSuperAdmin } = useAuth();
  const isPrivileged = isOwner || isManager || isSuperAdmin;
  const { data: branches = [] } = useBranches();

  const [filterBranch, setFilterBranch] = useState<string>("all");
  const [filterDate, setFilterDate] = useState("");

  const branchId = profile?.branch_id;
  const businessId = profile?.business_id;

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["cash-register-history", businessId, filterBranch, filterDate],
    queryFn: async () => {
      if (!businessId) return [];
      let query = supabase
        .from("cash_registers")
        .select("*")
        .eq("business_id", businessId)
        .eq("status", "closed")
        .order("closed_at", { ascending: false })
        .limit(100);

      if (filterBranch !== "all") {
        query = query.eq("branch_id", filterBranch);
      } else if (!isPrivileged) {
        query = query.eq("branch_id", branchId!);
      }

      if (filterDate) {
        query = query.gte("closed_at", filterDate + "T00:00:00").lte("closed_at", filterDate + "T23:59:59");
      }

      const { data } = await query;
      return data || [];
    },
    enabled: !!businessId,
  });

  // Fetch user names
  const { data: userMap = {} } = useQuery({
    queryKey: ["caja-history-users", history.map(h => h.user_id).join(",")],
    queryFn: async () => {
      const ids = [...new Set(history.map(h => h.user_id))];
      if (!ids.length) return {};
      const { data } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
      const m: Record<string, string> = {};
      data?.forEach(p => { m[p.user_id] = p.full_name; });
      return m;
    },
    enabled: history.length > 0,
  });

  // Fetch branch names
  const branchMap = useMemo(() => {
    const m: Record<string, string> = {};
    branches.forEach(b => { m[b.id] = b.name; });
    return m;
  }, [branches]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {isPrivileged && branches.length > 1 && (
          <div className="space-y-1">
            <Label className="text-xs">Sucursal</Label>
            <Select value={filterBranch} onValueChange={setFilterBranch}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {branches.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1">
          <Label className="text-xs">Fecha</Label>
          <Input
            type="date"
            className="h-8 w-40 text-xs"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Cargando...</div>
      ) : history.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <History className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No hay cierres de caja registrados</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {history.map((r: any) => {
            const diff = Number(r.difference || 0);
            const totalCash = Number(r.total_sales_cash || 0) + Number(r.total_services_cash || 0);
            const totalTransfer = Number(r.total_sales_transfer || 0) + Number(r.total_services_transfer || 0);

            return (
              <Card key={r.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">
                        {(userMap as any)[r.user_id] || "—"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {branchMap[r.branch_id] || "—"} · {format(new Date(r.closed_at), "dd MMM yyyy · HH:mm", { locale: es })}
                      </p>
                    </div>
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
                      <p className="font-medium">${totalTransfer.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Contado</span>
                      <p className="font-medium">${Number(r.counted_cash || 0).toFixed(2)}</p>
                    </div>
                  </div>
                  {r.notes && (
                    <p className="text-[10px] text-muted-foreground italic">{r.notes}</p>
                  )}
                  {Number((r as any).next_day_fund || 0) > 0 && (
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                      💰 Fondo dejado para el día siguiente: ${Number((r as any).next_day_fund).toFixed(2)}
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

export default CajaHistorial;
