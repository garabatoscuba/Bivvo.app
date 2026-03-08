import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3 } from "lucide-react";
import ServiciosTab from "@/components/impresiones/ServiciosTab";
import InsumosTab from "@/components/impresiones/InsumosTab";
import RecetasTab from "@/components/impresiones/RecetasTab";
import SellerPrintView from "@/components/impresiones/SellerPrintView";

const Impresiones = () => {
  const { isOwner, isSuperAdmin, isManager } = useAuth();
  const isOwnerView = isOwner || isSuperAdmin || isManager;

  if (!isOwnerView) {
    return (
      <AppLayout>
        <SellerPrintView />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-4">
        <h1 className="text-2xl font-bold">Impresiones</h1>

        <Tabs defaultValue="servicios" className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="servicios">Servicios</TabsTrigger>
            <TabsTrigger value="insumos">Insumos</TabsTrigger>
            <TabsTrigger value="recetas">Recetas</TabsTrigger>
            <TabsTrigger value="reportes">Reportes</TabsTrigger>
          </TabsList>

          <TabsContent value="servicios" className="mt-4">
            <ServiciosTab />
          </TabsContent>

          <TabsContent value="insumos" className="mt-4">
            <InsumosTab />
          </TabsContent>

          <TabsContent value="recetas" className="mt-4">
            <RecetasTab />
          </TabsContent>

          <TabsContent value="reportes" className="mt-4">
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-muted-foreground">
              <BarChart3 className="h-12 w-12" />
              <p className="text-lg">Reportes en construcción</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Impresiones;
