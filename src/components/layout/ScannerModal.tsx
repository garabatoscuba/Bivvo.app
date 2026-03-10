import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, ScanLine, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useResolvedBusinessId } from '@/hooks/useResolvedBusinessId';

interface ScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScanResult?: (result: string) => void;
}

interface ScanFeedback {
  type: 'success' | 'error';
  title: string;
  description: string;
}

const ScannerModal = ({ open, onOpenChange, onScanResult }: ScannerModalProps) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const { profile } = useAuth();
  const { businessId, branchId } = useResolvedBusinessId();

  const handleEmployeeQR = async (data: { employee_id: string; business_id: string }) => {
    if (!businessId || !branchId) {
      setFeedback({ type: 'error', title: 'Error', description: 'No se pudo determinar el negocio activo' });
      return;
    }
    if (data.business_id !== businessId) {
      setFeedback({ type: 'error', title: 'QR inválido', description: 'Este empleado no pertenece a tu negocio' });
      return;
    }

    setProcessing(true);
    try {
      // Get employee name
      const { data: emp } = await supabase
        .from('employees')
        .select('full_name, position')
        .eq('id', data.employee_id)
        .eq('business_id', businessId)
        .maybeSingle();

      if (!emp) {
        setFeedback({ type: 'error', title: 'No encontrado', description: 'Empleado no registrado en este negocio' });
        return;
      }

      // Check for active session today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: activeSession } = await supabase
        .from('work_sessions')
        .select('id, inicio')
        .eq('employee_id', data.employee_id)
        .eq('business_id', businessId)
        .is('fin', null)
        .gte('inicio', todayStart.toISOString())
        .order('inicio', { ascending: false })
        .limit(1)
        .maybeSingle();

      const now = new Date();
      const timeStr = now.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

      if (activeSession) {
        // Close session
        await supabase
          .from('work_sessions')
          .update({ fin: now.toISOString() })
          .eq('id', activeSession.id);

        setFeedback({
          type: 'success',
          title: `Salida registrada — ${timeStr}`,
          description: `${emp.full_name} (${emp.position})`,
        });
      } else {
        // Open session
        await supabase
          .from('work_sessions')
          .insert({
            business_id: businessId,
            branch_id: branchId,
            employee_id: data.employee_id,
            inicio: now.toISOString(),
          });

        setFeedback({
          type: 'success',
          title: `Entrada registrada — ${timeStr}`,
          description: `${emp.full_name} (${emp.position})`,
        });
      }
    } catch (err) {
      console.error('Work session error:', err);
      setFeedback({ type: 'error', title: 'Error', description: 'No se pudo registrar la asistencia' });
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => {
    if (!open) {
      setFeedback(null);
      setProcessing(false);
      return;
    }

    let mounted = true;
    const scannerId = 'bivoo-qr-reader';

    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode(scannerId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          async (decodedText) => {
            if (!mounted || processing) return;

            // Try to parse as Bivoo employee QR
            try {
              const parsed = JSON.parse(decodedText);
              if (parsed.type === 'bivoo_employee' && parsed.employee_id && parsed.business_id) {
                // Stop scanner before processing
                await scanner.stop().catch(() => {});
                scannerRef.current = null;
                await handleEmployeeQR(parsed);
                return;
              }
            } catch {
              // Not a JSON QR, handle as generic
            }

            onScanResult?.(decodedText);
            toast.success('Código escaneado', { description: decodedText });
            onOpenChange(false);
          },
          () => {}
        );
      } catch (err) {
        console.error('Scanner error:', err);
        if (mounted) toast.error('No se pudo acceder a la cámara');
      }
    };

    const t = setTimeout(startScanner, 300);

    return () => {
      mounted = false;
      clearTimeout(t);
      scannerRef.current?.stop().catch(() => {});
      scannerRef.current = null;
    };
  }, [open]);

  const handleClose = () => {
    setFeedback(null);
    onOpenChange(false);
  };

  const handleScanAnother = async () => {
    setFeedback(null);
    // Restart scanner
    const scannerId = 'bivoo-qr-reader';
    try {
      const scanner = new Html5Qrcode(scannerId);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          if (processing) return;
          try {
            const parsed = JSON.parse(decodedText);
            if (parsed.type === 'bivoo_employee' && parsed.employee_id && parsed.business_id) {
              await scanner.stop().catch(() => {});
              scannerRef.current = null;
              await handleEmployeeQR(parsed);
              return;
            }
          } catch {}
          onScanResult?.(decodedText);
          toast.success('Código escaneado', { description: decodedText });
          onOpenChange(false);
        },
        () => {}
      );
    } catch (err) {
      console.error('Scanner restart error:', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ScanLine className="h-5 w-5 text-primary" />
            Escáner
          </DialogTitle>
        </DialogHeader>

        {feedback ? (
          <div className="p-6 flex flex-col items-center gap-4 text-center">
            {feedback.type === 'success' ? (
              <CheckCircle className="h-16 w-16 text-green-500" />
            ) : (
              <XCircle className="h-16 w-16 text-destructive" />
            )}
            <div>
              <p className="font-semibold text-lg">{feedback.title}</p>
              <p className="text-sm text-muted-foreground mt-1">{feedback.description}</p>
            </div>
            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1" onClick={handleScanAnother}>
                Escanear otro
              </Button>
              <Button className="flex-1" onClick={handleClose}>
                Cerrar
              </Button>
            </div>
          </div>
        ) : processing ? (
          <div className="p-6 flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Registrando asistencia...</p>
          </div>
        ) : (
          <>
            <div className="relative bg-black">
              <div id="bivoo-qr-reader" className="w-full" />
            </div>
            <div className="p-4 pt-3 text-center space-y-3">
              <p className="text-sm text-muted-foreground">Apunta al código QR o de barras</p>
              <Button variant="outline" className="w-full" onClick={handleClose}>
                <X className="h-4 w-4 mr-2" /> Cerrar
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ScannerModal;
