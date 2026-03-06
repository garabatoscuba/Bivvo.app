import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBranches } from "@/hooks/useBranches";
import { useJornadaActiva } from "@/hooks/useJornadaActiva";
import AppLayout from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CajaActiva from "@/components/caja/CajaActiva";
import CajaChica from "@/components/caja/CajaChica";
import CajaHistorial from "@/components/caja/CajaHistorial";
import CajaConfig from "@/components/caja/CajaConfig";
import CajaOwnerOverview from "@/components/caja/CajaOwnerOverview";
import SinJornadaActiva from "@/components/employees/SinJornadaActiva";
import { Loader2 } from "lucide-react";

const Caja = () => {
  const { profile, isOwner, isManager, isSuperAdmin } = useAuth();
  const { data: branches = [] } = useBranches();
  const { jornadaActiva, isLoading: jornadaLoading } = useJornadaActiva();
  const activeBranch = branches.find((b) => b.id === profile?.branch_id);
  const isPrivileged = isOwner || isManager || isSuperAdmin;
  const canBypassJornada = isOwner || isSuperAdmin;
  const showCajasTab = isOwner || isSuperAdmin;
  const [tab, setTab] = useState(showCajasTab ? "cajas" : "activa");

  if (!canBypassJornada && jornadaLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!canBypassJornada && !jornadaActiva) {
    return (
      <AppLayout>
        <SinJornadaActiva />
      </AppLayout>
    );
  }

  const tabCount = (showCajasTab ? 1 : 0) + 3 + (isPrivileged ? 1 : 0);

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Caja</h1>
          {activeBranch && (
            <p className="text-xs text-muted-foreground">{activeBranch.name}</p>
          )}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full flex flex-nowrap overflow-x-auto scrollbar-hide h-9">
            {showCajasTab && (
              <TabsTrigger value="cajas" className="shrink-0 text-xs">Cajas</TabsTrigger>
            )}
            <TabsTrigger value="activa" className="shrink-0 text-xs">Caja activa</TabsTrigger>
            <TabsTrigger value="chica" className="shrink-0 text-xs">Caja chica</TabsTrigger>
            <TabsTrigger value="historial" className="shrink-0 text-xs">Historial</TabsTrigger>
            {isPrivileged && (
              <TabsTrigger value="config" className="shrink-0 text-xs">Config</TabsTrigger>
            )}
          </TabsList>

          {showCajasTab && (
            <TabsContent value="cajas">
              <CajaOwnerOverview />
            </TabsContent>
          )}
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
      </div>
    </AppLayout>
  );
};

export default Caja;
