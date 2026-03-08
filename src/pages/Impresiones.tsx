import AppLayout from "@/components/layout/AppLayout";
import { Printer } from "lucide-react";

const Impresiones = () => {
  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground">
        <Printer className="h-16 w-16" />
        <h1 className="text-2xl font-semibold text-foreground">Impresiones</h1>
        <p className="text-lg">Módulo en construcción</p>
      </div>
    </AppLayout>
  );
};

export default Impresiones;
