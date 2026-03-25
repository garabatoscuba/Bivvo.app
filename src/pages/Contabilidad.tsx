import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBranches } from "@/hooks/useBranches";
import { useSearchParams, useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { Lock, FileText, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";

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
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { Card, CardContent } from "@/components/ui/card";

const TAB_LABELS: Record<string, string> = {
  balance: "Balance",
  gastos: "Gastos",
  activos: "Activos",
  analisis: "Análisis",
  avanzado: "Avanzado",
  documentos: "Documentos",
};

const TAB_DESCRIPTIONS: Record<string, string> = {
  balance: "Ingresos, gastos y tu dinero disponible en tiempo real.",
  gastos: "Gestión de gastos fijos, variables e imprevistos.",
  activos: "Inventario de activos fijos con depreciación y mantenimiento.",
  analisis: "Indicadores financieros, márgenes y comparativas.",
  avanzado: "Cuentas T y Libro Diario (próximamente).",
  documentos: "IPV, Conduces, Órdenes de Compra y Facturas.",
};

const SPECIAL_EMAIL = "garabatoscuba@gmail.com";

const Contabilidad = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { data: branches = [] } = useBranches();
  const { plan } = usePlanFeatures();

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

  const isEnterprise = plan === "enterprise";
  const isSpecialUser = profile?.email === SPECIAL_EMAIL;

  // Avanzado and Documentos are dev-only, locked for everyone except special email
  const isDevTab = (tab: string) => tab === "avanzado" || tab === "documentos";
  const canAccessDevTab = isSpecialUser;

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
              const locked = isDevTab(tab) && !canAccessDevTab;
              return (
                <button
                  key={tab}
                  onClick={() => !locked && setActiveTab(tab)}
                  className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 shrink-0 flex-1 gap-1 ${
                    activeTab === tab
                      ? "bg-background text-foreground shadow"
                      : locked
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-background/50 hover:text-foreground"
                  }`}
                  disabled={locked}
                >
                  {TAB_LABELS[tab]}
                  {locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Enterprise gate overlay for non-enterprise users (except dev tabs which are fully locked) */}
        {!isEnterprise && !isDevTab(activeTab) && (
          <div className="relative">
            {/* Blurred content preview */}
            <div className="blur-sm pointer-events-none select-none opacity-60 min-h-[300px]">
              {activeTab === "balance" && profile?.business_id && (
                <TreasuryMovimientos
                  businessId={profile.business_id}
                  branchId={filterBranchId}
                  prefillType={null}
                  onPrefillConsumed={() => {}}
                />
              )}
              {activeTab === "gastos" && profile?.business_id && (
                <ExpensesTab businessId={profile.business_id} branchId={filterBranchId} />
              )}
              {activeTab === "activos" && profile?.business_id && (
                <AssetsTab businessId={profile.business_id} branchId={filterBranchId} />
              )}
              {activeTab === "analisis" && profile?.business_id && (
                <AnalysisTab businessId={profile.business_id} branchId={filterBranchId} />
              )}
            </div>

            {/* Overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-lg">
              <Card className="max-w-sm mx-4">
                <CardContent className="p-6 text-center space-y-3">
                  <div className="rounded-full bg-primary/10 p-3 mx-auto w-fit">
                    <Crown className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold">Contabilidad Enterprise</h3>
                  <p className="text-sm text-muted-foreground">
                    {TAB_DESCRIPTIONS[activeTab]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Accede a Balance, Gastos, Activos, Análisis y más con el Plan Enterprise.
                  </p>
                  <Button className="w-full" onClick={() => navigate("/plans")}>
                    Ver planes
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Dev tabs locked message */}
        {isDevTab(activeTab) && !canAccessDevTab && (
          <Card>
            <CardContent className="p-8 text-center space-y-3">
              <div className="rounded-full bg-primary/10 p-3 mx-auto w-fit">
                <Lock className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">{TAB_LABELS[activeTab]}</h3>
              <p className="text-sm text-muted-foreground">
                {TAB_DESCRIPTIONS[activeTab]} Esta sección está en desarrollo.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Normal content for Enterprise users */}
        {isEnterprise && !isDevTab(activeTab) && (
          <>
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

            {activeTab === "analisis" && profile?.business_id && (
              <AnalysisTab businessId={profile.business_id} branchId={filterBranchId} />
            )}
          </>
        )}

        {/* Dev tabs content for special user */}
        {isDevTab(activeTab) && canAccessDevTab && (
          <>
            {activeTab === "avanzado" && (
              <Card>
                <CardContent className="p-8 text-center space-y-3">
                  <div className="rounded-full bg-primary/10 p-3 mx-auto w-fit">
                    <Lock className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold">Contabilidad Avanzada</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Cuentas T y Libro Diario estarán disponibles próximamente.
                  </p>
                </CardContent>
              </Card>
            )}

            {activeTab === "documentos" && (
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
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default Contabilidad;
