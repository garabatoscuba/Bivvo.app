import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBranches } from "@/hooks/useBranches";
import AppLayout from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CajaActiva from "@/components/caja/CajaActiva";
import CajaChica from "@/components/caja/CajaChica";
import CajaHistorial from "@/components/caja/CajaHistorial";
import CajaConfig from "@/components/caja/CajaConfig";
import { Landmark, Construction } from "lucide-react";

const Tesoreria = () => {
  const { profile, isOwner, isManager, isSuperAdmin } = useAuth();
  const { data: branches = [] } = useBranches();
  const activeBranch = branches.find((b) => b.id === profile?.branch_id);
  const isPrivileged = isOwner || isManager || isSuperAdmin;
  const [mainTab, setMainTab] = useState("caja");
  const [cajaTab, setCajaTab] = useState("activa");

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
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <Construction className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Próximamente — Movimientos del dueño
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Tesoreria;
