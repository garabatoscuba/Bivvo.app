import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, ScanLine, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useResolvedBusinessId } from "@/hooks/useResolvedBusinessId";

interface ScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScanResult?: (result: string) => void;
}

interface ScanFeedback {
  type: "success" | "error";
  title: string;
  description: string;
}

// Beep usando Web Audio API — no requiere archivos externos
const playBeep = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(1046, ctx.currentTime);
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.15);
  } catch {}
};

const ScannerModal = ({ open, onOpenChange, onScanResult }: ScannerModalProps) => {
  const scannerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const focusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanLineRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanLinePosRef = useRef(0);
  const scanLineDirRef = useRef(1);
  const [scanLinePos, setScanLinePos] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const { profile } = useAuth();
  const { businessId, branchId } = useResolvedBusinessId();

  // Animación de la línea de escaneo
  const startScanLine = () => {
    if (scanLineRef.current) clearInterval(scanLineRef.current);
    scanLineRef.current = setInterval(() => {
      scanLinePosRef.current += scanLineDirRef.current * 1.8;
      if (scanLinePosRef.current >= 100) {
        scanLineDirRef.current = -1;
        scanLinePosRef.current = 98;
      }
      if (scanLinePosRef.current <= 0) {
        scanLineDirRef.current = 1;
        scanLinePosRef.current = 2;
      }
      setScanLinePos(scanLinePosRef.current);
    }, 16);
  };

  const stopScanLine = () => {
    if (scanLineRef.current) {
      clearInterval(scanLineRef.current);
      scanLineRef.current = null;
    }
  };

  const applyFocus = async () => {
    const video = document.querySelector("#bivoo-qr-reader") as HTMLVideoElement;
    if (video?.srcObject) {
      const track = (video.srcObject as MediaStream).getVideoTracks()[0];
      if (track) {
        try {
          await track.applyConstraints({ advanced: [{ focusMode: "manual" }] as any });
          await new Promise((r) => setTimeout(r, 300));
          await track.applyConstraints({ advanced: [{ focusMode: "continuous" }] as any });
        } catch {}
      }
    }
  };

  // Auto-focus removed — only manual tap-to-focus is used

  const stopScanner = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    scannerRef.current = null;
    if (focusIntervalRef.current) {
      clearInterval(focusIntervalRef.current);
      focusIntervalRef.current = null;
    }
    stopScanLine();
  };

  const getMainBackCamera = async (): Promise<string | undefined> => {
    try {
      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      const backCameras = devices.filter(
        (d) =>
          d.label.toLowerCase().includes("back") ||
          d.label.toLowerCase().includes("rear") ||
          d.label.toLowerCase().includes("environment") ||
          !d.label.toLowerCase().includes("front"),
      );
      return backCameras[backCameras.length - 1]?.deviceId ?? undefined;
    } catch {
      return undefined;
    }
  };

  const handleEmployeeQR = async (data: { employee_id: string; business_id: string }) => {
    if (!businessId || !branchId) {
      setFeedback({ type: "error", title: "Error", description: "No se pudo determinar el negocio activo" });
      return;
    }
    if (data.business_id !== businessId) {
      setFeedback({ type: "error", title: "QR inválido", description: "Este empleado no pertenece a tu negocio" });
      return;
    }

    setProcessing(true);
    try {
      const { data: emp } = await supabase
        .from("employees")
        .select("id, full_name, position, auth_user_id")
        .eq("id", data.employee_id)
        .eq("business_id", businessId)
        .maybeSingle();

      if (!emp) {
        setFeedback({ type: "error", title: "No encontrado", description: "Empleado no registrado en este negocio" });
        return;
      }

      let empleadoProfileId: string | null = null;
      if (emp.auth_user_id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", emp.auth_user_id)
          .maybeSingle();
        empleadoProfileId = prof?.id ?? null;
      }

      if (!empleadoProfileId) {
        setFeedback({
          type: "error",
          title: "Sin cuenta",
          description: `${emp.full_name} no tiene cuenta vinculada para registrar jornada`,
        });
        return;
      }

      const { data: activeJornada } = await supabase
        .from("jornadas")
        .select("id, apertura_at")
        .eq("empleado_id", empleadoProfileId)
        .eq("sucursal_id", branchId)
        .is("cierre_at", null)
        .order("apertura_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const now = new Date();
      const timeStr = now.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });

      if (activeJornada) {
        const aperturaTime = new Date(activeJornada.apertura_at).toLocaleTimeString("es", {
          hour: "2-digit",
          minute: "2-digit",
        });
        setFeedback({
          type: "error",
          title: "Jornada ya activa",
          description: `${emp.full_name} tiene una jornada activa desde ${aperturaTime}`,
        });
      } else {
        const { error: insertError } = await supabase.from("jornadas").insert({
          empleado_id: empleadoProfileId,
          sucursal_id: branchId,
          apertura_at: now.toISOString(),
          metodo_apertura: "qr",
        });

        if (insertError) throw insertError;

        setFeedback({
          type: "success",
          title: `Entrada registrada — ${timeStr}`,
          description: `${emp.full_name} (${emp.position})`,
        });
      }
    } catch (err) {
      console.error("Jornada registration error:", err);
      setFeedback({ type: "error", title: "Error", description: "No se pudo registrar la jornada" });
    } finally {
      setProcessing(false);
    }
  };

  const handleScanResult = async (decodedText: string) => {
    playBeep();
    stopScanLine();
    try {
      const parsed = JSON.parse(decodedText);
      if (parsed.type === "bivoo_employee" && parsed.employee_id && parsed.business_id) {
        stopScanner();
        await handleEmployeeQR(parsed);
        return;
      }
    } catch {}
    onScanResult?.(decodedText);
    toast.success("Código escaneado", { description: decodedText });
    onOpenChange(false);
  };

  useEffect(() => {
    if (!open) {
      setFeedback(null);
      setProcessing(false);
      setScanLinePos(0);
      scanLinePosRef.current = 0;
      return;
    }

    let mounted = true;

    const startScanner = async () => {
      try {
        const codeReader = new BrowserMultiFormatReader();
        scannerRef.current = codeReader;
        const videoEl = document.getElementById("bivoo-qr-reader") as HTMLVideoElement;
        const selectedCamera = await getMainBackCamera();

        await codeReader.decodeFromVideoDevice(selectedCamera, videoEl, (result, err, controls) => {
          if (!mounted || processing || !result) return;
          controlsRef.current = controls;
          handleScanResult(result.getText());
        });

        // Manual tap-to-focus only
        startScanLine();
      } catch (err) {
        console.error("Scanner error:", err);
        if (mounted) toast.error("No se pudo acceder a la cámara");
      }
    };

    const t = setTimeout(startScanner, 300);

    return () => {
      mounted = false;
      clearTimeout(t);
      stopScanner();
    };
  }, [open]);

  const handleClose = () => {
    setFeedback(null);
    onOpenChange(false);
  };

  const handleScanAnother = async () => {
    setFeedback(null);
    setScanLinePos(0);
    scanLinePosRef.current = 0;
    const codeReader = new BrowserMultiFormatReader();
    scannerRef.current = codeReader;
    const videoEl = document.getElementById("bivoo-qr-reader") as HTMLVideoElement;
    const selectedCamera = await getMainBackCamera();

    await codeReader.decodeFromVideoDevice(selectedCamera, videoEl, (result, err, controls) => {
      if (processing || !result) return;
      controlsRef.current = controls;
      handleScanResult(result.getText());
    });

    startAutoFocus();
    startScanLine();
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
            {feedback.type === "success" ? (
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
            <div
              className="relative bg-black"
              style={{ aspectRatio: "4/3" }}
              onTouchStart={() => applyFocus()}
              onClick={() => applyFocus()}
            >
              <video id="bivoo-qr-reader" className="w-full h-full object-cover" />

              {/* Línea de escaneo animada — pantalla completa */}
              <div className="absolute inset-0 z-10 pointer-events-none">
                <div
                  className="absolute left-4 right-4 h-px"
                  style={{
                    top: `${scanLinePos}%`,
                    background: "linear-gradient(90deg, transparent 0%, #00d282 30%, #00d282 70%, transparent 100%)",
                    boxShadow: "0 0 8px 2px rgba(0,210,130,0.5)",
                  }}
                />
              </div>
            </div>

            <div className="p-4 pt-3 text-center space-y-3">
              <p className="text-sm text-muted-foreground">Apunta a cualquier código QR o de barras</p>
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
