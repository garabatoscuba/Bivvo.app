import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBranches } from "@/hooks/useBranches";
import { useSearchParams } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { Lock, FileText } from "lucide-react";

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
import { usePlanFeatures, type PlanFeatureKey } from "@/hooks/usePlanFeatures";
import PlanGateModal from "@/components/PlanGateModal";
import { Card, CardContent } from "@/components/ui/card";

const TAB_FEATURE_MAP: Record<string, PlanFeatureKey | null> = {
  balance: null,
  gastos: null,
  activos: 'contabilidad_activos',
  analisis: 'contabilidad_analisis',
  avanzado: 'contabilidad_avanzado',
  documentos: 'contabilidad_documentos',
};

const TAB_LABELS: Record<string, string> = {
  balance: "Balance",
  gastos: "Gastos",
  activos: "Activos",
  analisis: "Análisis",
  avanzado: "Avanzado",
  documentos: "Documentos",
};

const Contabilidad = () => {
  const { profile } = useAuth();
  const { data: branches = [] } = useBranches();
  const { hasFeature, requiredPlanFor } = usePlanFeatures();

  const [searchParams, setSearchParams] = useSearchParams();
  const prefillType = searchParams.get("prefill") as "extraccion" | "inyeccion" | null;

  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("balance");
  const [gateOpen, setGateOpen] = useState(false);
  const [gateRequiredPlan, setGateRequiredPlan] = useState("Enterprise");

  const handlePrefillConsumed = () => {
    setSearchParams({}, { replace: true });
  };

  const singleBranch = branches.length === 1;
  const effectiveBranchId = singleBranch ? branches[0].id : selectedBranchId;
  const filterBranchId = effectiveBranchId === "all" ? null : effectiveBranchId;

  const handleTabClick = (tab: string) => {
    const featureKey = TAB_FEATURE_MAP[tab];
    if (featureKey && !hasFeature(featureKey)) {
      setGateRequiredPlan(requiredPlanFor(featureKey));
      setGateOpen(true);
      return;
    }
    setActiveTab(tab);
  };

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
          <div className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground w-full overflow-x-auto">
            {(["balance", "gastos", "activos", "analisis", "avanzado", "documentos"] as const).map((tab) => {
              const featureKey = TAB_FEATURE_MAP[tab];
              const locked = featureKey ? !hasFeature(featureKey) : false;
              return (
                <button
                  key={tab}
                  onClick={() => handleTabClick(tab)}
                  className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 shrink-0 flex-1 gap-1 ${
                    activeTab === tab
                      ? "bg-background text-foreground shadow"
                      : "hover:bg-background/50 hover:text-foreground"
                  }`}
                >
                  {TAB_LABELS[tab]}
                  {locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                </button>
              );
            })}
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

        {activeTab === "activos" && hasFeature('contabilidad_activos') && profile?.business_id && (
          <AssetsTab businessId={profile.business_id} branchId={filterBranchId} />
        )}

        {activeTab === "analisis" && hasFeature('contabilidad_analisis') && profile?.business_id && (
          <AnalysisTab businessId={profile.business_id} branchId={filterBranchId} />
        )}

        {activeTab === "avanzado" && hasFeature('contabilidad_avanzado') && (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-8 text-center space-y-3">
                <div className="rounded-full bg-primary/10 p-3 mx-auto w-fit">
                  <Lock className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">Contabilidad Avanzada</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Cuentas T y Libro Diario estarán disponibles próximamente para el Plan Enterprise.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "documentos" && hasFeature('contabilidad_documentos') && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { title: "IPV", desc: "Informe de Producción y Ventas" },
                { title: "Conduce", desc: "Documento de traslado de mercancías" },
                { title: "Orden de Compra", desc: "Solicitud formal de adquisición" },
                { title: "Factura de Venta", desc: "Documento comercial de venta" },
              ].map((doc) => (
                <Card key={doc.title} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-4 text-center space-y-2">
                    <div className="rounded-full bg-muted p-2.5 mx-auto w-fit">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <h4 className="text-sm font-semibold">{doc.title}</h4>
                    <p className="text-[11px] text-muted-foreground leading-snug">{doc.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Selecciona un tipo de documento para generar o consultar.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <PlanGateModal open={gateOpen} onOpenChange={setGateOpen} requiredPlan={gateRequiredPlan} />
    </AppLayout>
  );
};

export default Contabilidad;
