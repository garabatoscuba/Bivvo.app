import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBranches } from "@/hooks/useBranches";
import { useSearchParams } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CajaActiva from "@/components/caja/CajaActiva";
import CajaChica from "@/components/caja/CajaChica";
import CajaHistorial from "@/components/caja/CajaHistorial";
import CajaConfig from "@/components/caja/CajaConfig";
import TreasuryMovimientos from "@/components/tesoreria/TreasuryMovimientos";
import { Landmark } from "lucide-react";

const Tesoreria = () => {
  const { profile, isOwner, isManager, isSuperAdmin } = useAuth();
  const { data: branches = [] } = useBranches();
  const activeBranch = branches.find((b) => b.id === profile?.branch_id);
  const isPrivileged = isOwner || isManager || isSuperAdmin;

  const [searchParams, setSearchParams] = useSearchParams();
  const prefillType = searchParams.get("prefill") as "extraccion" | "inyeccion" | null;
  const initialTab = prefillType ? "movimientos" : "caja";

  const [mainTab, setMainTab] = useState(initialTab);
  const [cajaTab, setCajaTab] = useState("activa");

  const handlePrefillConsumed = () => {
    setSearchParams({}, { replace: true });
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">Tesorería</h1>
            {activeBranch && (
              <p className="text-xs text-muted-foreground">{activeBranch.name}</p>
            )}
          </div>
        </div>

        <Tabs value={mainTab} onValueChange={setMainTab}>
          <TabsList className="w-full grid grid-cols-2 h-9">
            <TabsTrigger value="caja" className="text-xs">Caja</TabsTrigger>
            <TabsTrigger value="movimientos" className="text-xs">Movimientos</TabsTrigger>
          </TabsList>

          <TabsContent value="caja">
            <Tabs value={cajaTab} onValueChange={setCajaTab}>
              <TabsList className="w-full grid grid-cols-4 h-9 mt-2">
                <TabsTrigger value="activa" className="text-xs">Caja activa</TabsTrigger>
                <TabsTrigger value="chica" className="text-xs">Caja chica</TabsTrigger>
                <TabsTrigger value="historial" className="text-xs">Historial</TabsTrigger>
                {isPrivileged && (
                  <TabsTrigger value="config" className="text-xs">Config</TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="activa">
                <CajaActiva />
              </TabsContent>
              <TabsContent value="chica">
                <CajaChica />
              </TabsContent>
              <TabsContent value="historial">
                <CajaHistorial />
              </TabsContent>
              {isPrivileged && (
                <TabsContent value="config">
                  <CajaConfig />
                </TabsContent>
              )}
            </Tabs>
          </TabsContent>

          <TabsContent value="movimientos">
            {profile?.business_id && (
              <TreasuryMovimientos
                businessId={profile.business_id}
                prefillType={prefillType}
                onPrefillConsumed={handlePrefillConsumed}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Tesoreria;
