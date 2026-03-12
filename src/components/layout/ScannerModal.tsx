import { useEffect, useRef, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, ScanLine, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';
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
  const scannerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
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
      // Get employee profile info (empleado_id in jornadas references profiles.id)
      const { data: emp } = await supabase
        .from('employees')
        .select('id, full_name, position, auth_user_id')
        .eq('id', data.employee_id)
        .eq('business_id', businessId)
        .maybeSingle();

      if (!emp) {
        setFeedback({ type: 'error', title: 'No encontrado', description: 'Empleado no registrado en este negocio' });
        return;
      }

      // Resolve profile id for jornadas.empleado_id
      let empleadoProfileId: string | null = null;
      if (emp.auth_user_id) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', emp.auth_user_id)
          .maybeSingle();
        empleadoProfileId = prof?.id ?? null;
      }

      if (!empleadoProfileId) {
        setFeedback({ type: 'error', title: 'Sin cuenta', description: `${emp.full_name} no tiene cuenta vinculada para registrar jornada` });
        return;
      }

      // Check for active jornada (cierre_at IS NULL)
      const { data: activeJornada } = await supabase
        .from('jornadas')
        .select('id, apertura_at')
        .eq('empleado_id', empleadoProfileId)
        .eq('sucursal_id', branchId)
        .is('cierre_at', null)
        .order('apertura_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const now = new Date();
      const timeStr = now.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

      if (activeJornada) {
        // Already has active shift
        const aperturaTime = new Date(activeJornada.apertura_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
        setFeedback({
          type: 'error',
          title: 'Jornada ya activa',
          description: `${emp.full_name} tiene una jornada activa desde ${aperturaTime}`,
        });
      } else {
        // Open new jornada
        const { error: insertError } = await supabase
          .from('jornadas')
          .insert({
            empleado_id: empleadoProfileId,
            sucursal_id: branchId,
            apertura_at: now.toISOString(),
            metodo_apertura: 'qr',
          });

        if (insertError) throw insertError;

        setFeedback({
          type: 'success',
          title: `Entrada registrada — ${timeStr}`,
          description: `${emp.full_name} (${emp.position})`,
        });
      }
    } catch (err) {
      console.error('Jornada registration error:', err);
      setFeedback({ type: 'error', title: 'Error', description: 'No se pudo registrar la jornada' });
    } finally {
      setProcessing(false);
    }
  };

  const handleScanResult = async (decodedText: string) => {
    const codeReader = scannerRef.current;
    try {
      const parsed = JSON.parse(decodedText);
      if (parsed.type === 'bivoo_employee' && parsed.employee_id && parsed.business_id) {
        codeReader?.reset();
        scannerRef.current = null;
        await handleEmployeeQR(parsed);
        return;
      }
    } catch {}
    onScanResult?.(decodedText);
    toast.success('Código escaneado', { description: decodedText });
    onOpenChange(false);
  };

  useEffect(() => {
    if (!open) {
      setFeedback(null);
      setProcessing(false);
      return;
    }

    let mounted = true;

    const startScanner = async () => {
      try {
        const codeReader = new BrowserMultiFormatReader();
        scannerRef.current = codeReader;
        const videoEl = document.getElementById('bivoo-qr-reader') as HTMLVideoElement;
        await codeReader.decodeFromVideoDevice(undefined, videoEl, (result, err) => {
          if (!mounted || processing || !result) return;
          handleScanResult(result.getText());
        });
      } catch (err) {
        console.error('Scanner error:', err);
        if (mounted) toast.error('No se pudo acceder a la cámara');
      }
    };

    const t = setTimeout(startScanner, 300);

    return () => {
      mounted = false;
      clearTimeout(t);
      scannerRef.current?.reset();
      scannerRef.current = null;
    };
  }, [open]);

  const handleClose = () => {
    setFeedback(null);
    onOpenChange(false);
  };

  const handleScanAnother = async () => {
    setFeedback(null);
    const codeReader = new BrowserMultiFormatReader();
    scannerRef.current = codeReader;
    const videoEl = document.getElementById('bivoo-qr-reader') as HTMLVideoElement;
    await codeReader.decodeFromVideoDevice(undefined, videoEl, (result, err) => {
      if (processing || !result) return;
      handleScanResult(result.getText());
    });
  };

  const applyFocus = async () => {
    const video = document.querySelector('#bivoo-qr-reader') as HTMLVideoElement;
    if (video?.srcObject) {
      const track = (video.srcObject as MediaStream).getVideoTracks()[0];
      if (track) {
        try {
          await track.applyConstraints({ advanced: [{ focusMode: 'manual' }] as any });
          await new Promise(r => setTimeout(r, 300));
          await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] as any });
        } catch {}
      }
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
              <video id="bivoo-qr-reader" className="w-full" />
              <div
                className="absolute inset-0 z-10"
                onTouchStart={(e) => {
                  const touch = e.touches[0];
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pixelX = touch.clientX - rect.left;
                  const pixelY = touch.clientY - rect.top;
                  setFocusPoint({ x: pixelX, y: pixelY });
                  setTimeout(() => setFocusPoint(null), 800);
                  applyFocus();
                }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pixelX = e.clientX - rect.left;
                  const pixelY = e.clientY - rect.top;
                  setFocusPoint({ x: pixelX, y: pixelY });
                  setTimeout(() => setFocusPoint(null), 800);
                  applyFocus();
                }}
              />
              {focusPoint && (
                <div
                  className="absolute z-20 rounded-full border-2 border-green-500 pointer-events-none animate-ping"
                  style={{
                    width: 40,
                    height: 40,
                    left: focusPoint.x - 20,
                    top: focusPoint.y - 20,
                    animationDuration: '0.8s',
                    animationIterationCount: 1,
                  }}
                />
              )}
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