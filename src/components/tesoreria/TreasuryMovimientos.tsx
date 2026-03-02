import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  TrendingDown,
  TrendingUp,
  Plus,
  ArrowUpDown,
  Calendar,
} from "lucide-react";
import TreasuryCategoryManager from "./TreasuryCategoryManager";
import TreasuryMovementModal from "./TreasuryMovementModal";

interface Props {
  businessId: string;
  prefillType?: "extraccion" | "inyeccion" | null;
  onPrefillConsumed?: () => void;
}

export default function TreasuryMovimientos({ businessId, prefillType, onPrefillConsumed }: Props) {
  const { profile } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPrefill, setModalPrefill] = useState<"extraccion" | "inyeccion" | null>(null);

  // Filters
  const [filterType, setFilterType] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterLabel, setFilterLabel] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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
      // Seed defaults if empty
      if (!data || data.length === 0) {
        const defaults = [
          "Alimentación y mercado",
          "Transporte",
          "Servicios (agua, luz, internet)",
          "Gastos imprevistos",
          "Retiro personal del dueño",
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

  const { data: movements = [], isLoading } = useQuery({
    queryKey: ["treasury-movements", businessId],
    queryFn: async () => {
      const { data } = await supabase
        .from("treasury_movements" as any)
        .select("*, treasury_categories(name)")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(500);
      return (data as any[]) || [];
    },
    enabled: !!businessId,
  });

  const categoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach((c: any) => { map[c.id] = c.name; });
    return map;
  }, [categories]);

  const filtered = useMemo(() => {
    return movements.filter((m: any) => {
      if (filterType !== "all" && m.movement_type !== filterType) return false;
      if (filterCategory !== "all" && m.category_id !== filterCategory) return false;
      if (filterLabel !== "all" && m.label !== filterLabel) return false;
      if (dateFrom) {
        const mDate = m.created_at.split("T")[0];
        if (mDate < dateFrom) return false;
      }
      if (dateTo) {
        const mDate = m.created_at.split("T")[0];
        if (mDate > dateTo) return false;
      }
      return true;
    });
  }, [movements, filterType, filterCategory, filterLabel, dateFrom, dateTo]);

  const summary = useMemo(() => {
    let inyecciones = 0;
    let extracciones = 0;
    filtered.forEach((m: any) => {
      if (m.movement_type === "inyeccion") inyecciones += Number(m.amount);
      else extracciones += Number(m.amount);
    });
    return { inyecciones, extracciones, balance: inyecciones - extracciones };
  }, [filtered]);

  const handleNewMovement = (type?: "extraccion" | "inyeccion") => {
    setModalPrefill(type || null);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button onClick={() => handleNewMovement()} className="gap-2">
          <Plus className="h-4 w-4" /> Nuevo movimiento
        </Button>
        <TreasuryCategoryManager businessId={businessId} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-green-600" /> Inyecciones
            </div>
            <div className="text-lg font-bold text-green-600">
              ${summary.inyecciones.toLocaleString("es", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <TrendingDown className="h-3.5 w-3.5 text-red-600" /> Extracciones
            </div>
            <div className="text-lg font-bold text-red-600">
              ${summary.extracciones.toLocaleString("es", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <ArrowUpDown className="h-3.5 w-3.5" /> Balance
            </div>
            <div className={`text-lg font-bold ${summary.balance >= 0 ? "text-primary" : "text-destructive"}`}>
              ${summary.balance.toLocaleString("es", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="extraccion">Extracciones</SelectItem>
            <SelectItem value="inyeccion">Inyecciones</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {categories.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterLabel} onValueChange={setFilterLabel}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="Etiqueta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="negocio">Negocio</SelectItem>
            <SelectItem value="personal">Personal</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          className="h-9 text-xs"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          placeholder="Desde"
        />
        <Input
          type="date"
          className="h-9 text-xs"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          placeholder="Hasta"
        />
      </div>

      {/* Movement list */}
      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Cargando...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ArrowUpDown className="h-8 w-8 opacity-40 mx-auto mb-2" />
            <p className="text-sm">Sin movimientos registrados</p>
            <p className="text-xs mt-1">Registra tu primer movimiento con el botón de arriba.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((m: any) => {
            const isInj = m.movement_type === "inyeccion";
            const catName = m.treasury_categories?.name || categoryMap[m.category_id] || null;
            return (
              <Card key={m.id}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <div className={`mt-0.5 rounded-full p-1.5 ${isInj ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
                        {isInj ? (
                          <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5 text-red-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          {catName && (
                            <span className="text-xs font-medium">{catName}</span>
                          )}
                          <Badge
                            variant={m.label === "personal" ? "outline" : "secondary"}
                            className="text-[10px] h-4"
                          >
                            {m.label === "personal" ? "Personal" : "Negocio"}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] h-4">
                            {m.payment_method === "efectivo" ? "Efectivo" : m.payment_method === "transferencia" ? "Transfer." : "Mixto"}
                          </Badge>
                        </div>
                        {m.reason && (
                          <p className="text-xs text-muted-foreground truncate">{m.reason}</p>
                        )}
                        {m.origin && (
                          <p className="text-[10px] text-muted-foreground/70">Origen: {m.origin}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-2.5 w-2.5" />
                          {format(new Date(m.created_at), "dd MMM yyyy · HH:mm", { locale: es })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-base font-bold ${isInj ? "text-green-600" : "text-red-600"}`}>
                        {isInj ? "+" : "-"}${Number(m.amount).toLocaleString("es", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <TreasuryMovementModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        businessId={businessId}
        prefillType={modalPrefill}
      />
    </div>
  );
}
