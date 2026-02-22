import { useEffect, useRef } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { useJornadaActiva } from '@/hooks/useJornadaActiva';
import { useAuth } from '@/contexts/AuthContext';
import { Clock } from 'lucide-react';

const AlertaInactividad = () => {
  const { isOwner, isManager, isSuperAdmin } = useAuth();
  const { mostrarAlertaInactividad, resetInactividad, cerrarPorInactividad } = useJornadaActiva();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isPrivileged = isOwner || isManager || isSuperAdmin;

  const show = !isPrivileged && mostrarAlertaInactividad;

  useEffect(() => {
    if (show) {
      timerRef.current = setTimeout(() => {
        cerrarPorInactividad();
      }, 10 * 60 * 1000); // 10 minutes
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [show, cerrarPorInactividad]);

  if (!show) return null;

  return (
    <AlertDialog open>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <div className="flex justify-center mb-2">
            <Clock className="h-10 w-10 text-warning" />
          </div>
          <AlertDialogTitle className="text-center">¿Sigues trabajando?</AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Llevas 30 minutos sin actividad. ¿Tu jornada sigue activa?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <AlertDialogAction onClick={resetInactividad} className="w-full">
            Sí, sigo trabajando
          </AlertDialogAction>
          <AlertDialogCancel onClick={cerrarPorInactividad} className="w-full">
            Cerrar mi jornada
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default AlertaInactividad;
