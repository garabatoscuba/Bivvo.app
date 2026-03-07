import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBranches } from "@/hooks/useBranches";
import { useSearchParams } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import TreasuryMovimientos from "@/components/tesoreria/TreasuryMovimientos";
import ExpensesTab from "@/components/contabilidad/ExpensesTab";
import AssetsTab from "@/components/contabilidad/AssetsTab";
import AnalysisTab from "@/components/contabilidad/AnalysisTab";

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

        <div className="flex">
          <div className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground w-full">
            {(["balance", "gastos", "activos", "analisis"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 shrink-0 flex-1 ${
                  activeTab === tab
                    ? "bg-background text-foreground shadow"
                    : "hover:bg-background/50 hover:text-foreground"
                }`}
              >
                {{ balance: "Balance", gastos: "Gastos", activos: "Activos", analisis: "Análisis" }[tab]}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "balance" && profile?.business_id && (
          <TreasuryMovimientos
            businessId={profile.business_id}
            branchId={filterBranchId}
            prefillType={prefillType}
            onPrefillConsumed={handlePrefillConsumed}
          />
        )}

        {activeTab === "gastos" && profile?.business_id && (
          <ExpensesTab businessId={profile.business_id} branchId={filterBranchId} />
        )}

        {activeTab === "activos" && profile?.business_id && (
          <AssetsTab businessId={profile.business_id} branchId={filterBranchId} />
        )}

        {activeTab === "analisis" && (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            Próximamente
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Contabilidad;
