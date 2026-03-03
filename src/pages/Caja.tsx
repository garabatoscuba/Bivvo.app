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
import SinJornadaActiva from "@/components/employees/SinJornadaActiva";
import { Loader2 } from "lucide-react";

const Caja = () => {
  const { profile, isOwner, isManager, isSuperAdmin } = useAuth();
  const { data: branches = [] } = useBranches();
  const { jornadaActiva, isLoading: jornadaLoading } = useJornadaActiva();
  const activeBranch = branches.find((b) => b.id === profile?.branch_id);
  const isPrivileged = isOwner || isManager || isSuperAdmin;
  const canBypassJornada = isOwner || isSuperAdmin;
  const [tab, setTab] = useState("activa");

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
          <TabsList className="w-full grid grid-cols-4 h-9">
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
      </div>
    </AppLayout>
  );
};

export default Caja;
