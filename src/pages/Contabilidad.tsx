import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBranches } from "@/hooks/useBranches";
import { useSearchParams } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import TreasuryMovimientos from "@/components/tesoreria/TreasuryMovimientos";
import ExpensesTab from "@/components/contabilidad/ExpensesTab";

const Contabilidad = () => {
  const { profile } = useAuth();
  const { data: branches = [] } = useBranches();

  const [searchParams, setSearchParams] = useSearchParams();
  const prefillType = searchParams.get("prefill") as "extraccion" | "inyeccion" | null;

  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("balance");

  const handlePrefillConsumed = () => {
    setSearchParams({}, { replace: true });
  };

  const singleBranch = branches.length === 1;
  const effectiveBranchId = singleBranch ? branches[0].id : selectedBranchId;
  const filterBranchId = effectiveBranchId === "all" ? null : effectiveBranchId;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          {singleBranch ? (
            <h1 className="text-xl font-bold tracking-tight">{branches[0].name}</h1>
          ) : branches.length > 1 ? (
            <Select value={effectiveBranchId} onValueChange={setSelectedBranchId}>
              <SelectTrigger className="w-auto min-w-[200px] h-9 text-base font-bold border-none shadow-none px-0 gap-2">
                <SelectValue placeholder="Seleccionar sucursal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las sucursales</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <h1 className="text-xl font-bold tracking-tight">Contabilidad</h1>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="w-full flex flex-nowrap overflow-x-auto scrollbar-hide h-9">
            <TabsTrigger value="balance" className="shrink-0 text-xs">Balance</TabsTrigger>
            <TabsTrigger value="gastos" className="shrink-0 text-xs">Gastos</TabsTrigger>
            <TabsTrigger value="activos" className="shrink-0 text-xs">Activos</TabsTrigger>
            <TabsTrigger value="analisis" className="shrink-0 text-xs">Análisis</TabsTrigger>
          </TabsList>

          <TabsContent value="balance">
            {profile?.business_id && (
              <TreasuryMovimientos
                businessId={profile.business_id}
                branchId={filterBranchId}
                prefillType={prefillType}
                onPrefillConsumed={handlePrefillConsumed}
              />
            )}
          </TabsContent>

          <TabsContent value="gastos">
            {profile?.business_id && (
              <ExpensesTab businessId={profile.business_id} branchId={filterBranchId} />
            )}
          </TabsContent>

          <TabsContent value="activos">
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              Próximamente
            </div>
          </TabsContent>

          <TabsContent value="analisis">
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              Próximamente
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Contabilidad;
