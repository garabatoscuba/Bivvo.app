import { Button } from "@/components/ui/button";
import { DollarSign, Heart, Loader2 } from "lucide-react";
import { useResolveShrinkage } from "@/hooks/usePrintShrinkage";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ShrinkageNotificationActionsProps {
  shrinkageId: string;
  employeeName: string;
  materialName: string;
  cantidad: number;
  valorPerdido: number;
  montoDescuento: number;
  motivo: string;
  onResolved?: () => void;
}

export default function ShrinkageNotificationActions({
  shrinkageId,
  employeeName,
  materialName,
  cantidad,
  valorPerdido,
  montoDescuento,
  motivo,
  onResolved,
}: ShrinkageNotificationActionsProps) {
  const [showCobrarDialog, setShowCobrarDialog] = useState(false);
  const [showPerdonarDialog, setShowPerdonarDialog] = useState(false);
  const resolveMutation = useResolveShrinkage();

  const handleCobrar = () => {
    resolveMutation.mutate(
      { shrinkage_id: shrinkageId, action: "cobrar" },
      {
        onSuccess: () => {
          setShowCobrarDialog(false);
          onResolved?.();
        },
      }
    );
  };

  const handlePerdonar = () => {
    resolveMutation.mutate(
      { shrinkage_id: shrinkageId, action: "perdonar" },
      {
        onSuccess: () => {
          setShowPerdonarDialog(false);
          onResolved?.();
        },
      }
    );
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-2 mt-3">
        <Button
          size="sm"
          variant="destructive"
          onClick={() => setShowCobrarDialog(true)}
          disabled={resolveMutation.isPending}
          className="flex-1"
        >
          {resolveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <DollarSign className="h-4 w-4 mr-2" />
          )}
          Cobrar (${montoDescuento.toFixed(2)})
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowPerdonarDialog(true)}
          disabled={resolveMutation.isPending}
          className="flex-1"
        >
          <Heart className="h-4 w-4 mr-2" />
          Perdonar
        </Button>
      </div>

      {/* Dialog Cobrar */}
      <AlertDialog open={showCobrarDialog} onOpenChange={setShowCobrarDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cobrar esta merma?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Se descontará <strong>${montoDescuento.toFixed(2)}</strong> del salario de {employeeName}.</p>
              <div className="text-sm bg-muted p-3 rounded-lg space-y-1 mt-3">
                <p><strong>Material:</strong> {materialName}</p>
                <p><strong>Cantidad:</strong> {cantidad}</p>
                <p><strong>Valor perdido:</strong> ${valorPerdido.toFixed(2)}</p>
                <p><strong>Motivo:</strong> {motivo}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Esta acción creará una deducción automática en la nómina del empleado.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resolveMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCobrar}
              disabled={resolveMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {resolveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Confirmar y cobrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Perdonar */}
      <AlertDialog open={showPerdonarDialog} onOpenChange={setShowPerdonarDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Perdonar esta merma?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>La merma se registrará como incidente <strong>sin impacto</strong> en el salario de {employeeName}.</p>
              <div className="text-sm bg-muted p-3 rounded-lg space-y-1 mt-3">
                <p><strong>Material:</strong> {materialName}</p>
                <p><strong>Cantidad:</strong> {cantidad}</p>
                <p><strong>Valor perdido:</strong> ${valorPerdido.toFixed(2)}</p>
                <p><strong>Motivo:</strong> {motivo}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                No se creará ninguna deducción en nómina.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resolveMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePerdonar}
              disabled={resolveMutation.isPending}
            >
              {resolveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Confirmar y perdonar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
