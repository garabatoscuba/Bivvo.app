import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Package, Users, Store, DollarSign, ArrowRight, X } from "lucide-react";

const features = [
  {
    icon: Package,
    title: "Inventario y Ventas",
    description: "Controla tu stock y registra ventas en segundos",
  },
  {
    icon: Users,
    title: "Empleados y Nómina",
    description: "Gestiona tu equipo, turnos y pagos fácilmente",
  },
  {
    icon: Store,
    title: "Portal y Pedidos",
    description: "Recibe pedidos online con tu tienda propia",
  },
  {
    icon: DollarSign,
    title: "Contabilidad",
    description: "Visualiza tus finanzas y toma mejores decisiones",
  },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const WhatIsBivooPanel = ({ open, onOpenChange }: Props) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[340px] sm:w-[400px] flex flex-col gap-0 p-0">
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Cerrar</span>
        </button>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <SheetHeader className="space-y-1 p-0 text-left">
            <SheetTitle className="text-xl font-bold">Bivoo</SheetTitle>
            <SheetDescription className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
              Automatización de Empresas
            </SheetDescription>
          </SheetHeader>

          <p className="text-sm text-muted-foreground">
            Todo lo que tu negocio necesita en un solo lugar
          </p>

          <div className="space-y-5">
            {features.map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <div className="shrink-0 flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">{f.title}</h3>
                  <p className="text-xs text-muted-foreground">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="shrink-0 p-6 pt-0">
          <Button className="w-full gap-2" onClick={() => onOpenChange(false)}>
            Comenzar gratis <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default WhatIsBivooPanel;
