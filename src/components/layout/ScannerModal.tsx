import { useEffect, useRef, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, ScanLine, CheckCircle, XCircle, Loader2 } from "lucide-react";
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

// Check native BarcodeDetector support
const hasBarcodeDetector = typeof globalThis !== "undefined" && "BarcodeDetector" in globalThis;

// Pick the main back camera, excluding ultra-wide/macro/depth lenses
const pickMainBackCamera = async (): Promise<string | undefined> => {
  let devices = await navigator.mediaDevices.enumerateDevices();
  let videoDevices = devices.filter((d) => d.kind === "videoinput");

  // If labels are empty (no permission yet), get a temp stream to unlock labels
  if (videoDevices.length > 0 && !videoDevices[0].label) {
    const tempStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    tempStream.getTracks().forEach((t) => t.stop());
    devices = await navigator.mediaDevices.enumerateDevices();
    videoDevices = devices.filter((d) => d.kind === "videoinput");
  }

  const backCameras = videoDevices.filter((d) => {
    const l = d.label.toLowerCase();
    return l.includes("back") || l.includes("rear") || l.includes("environment") || !l.includes("front");
  });

  const filtered = backCameras.filter((d) => {
    const l = d.label.toLowerCase();
    return !l.includes("ultra") && !l.includes("wide") && !l.includes("macro") && !l.includes("depth") && !l.includes("telephoto");
  });

  const candidates = filtered.length > 0 ? filtered : backCameras;
  if (candidates.length === 0) return undefined;

  // Prefer one with "0" in label (usually main), otherwise first
  const main = candidates.find((d) => /\b0\b/.test(d.label)) ?? candidates[0];
  return main.deviceId || undefined;
};

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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastScanRef = useRef<number>(0);
  const detectorRef = useRef<any>(null);
  const zxingControlsRef = useRef<any>(null);
  const zxingReaderRef = useRef<any>(null);
  const focusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanLineRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanLinePosRef = useRef(0);
  const scanLineDirRef = useRef(1);
  const [scanLinePos, setScanLinePos] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const { profile } = useAuth();
  const { businessId, branchId } = useResolvedBusinessId();
  const mountedRef = useRef(false);

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

  const handleScanResult = useCallback(async (decodedText: string) => {
    playBeep();
    stopScanLine();
    try {
      const parsed = JSON.parse(decodedText);
      if (parsed.type === "bivoo_employee" && parsed.employee_id && parsed.business_id) {
        stopAllScanning();
        await handleEmployeeQR(parsed);
        return;
      }
    } catch {}
    onScanResult?.(decodedText);
    toast.success("Código escaneado", { description: decodedText });
    onOpenChange(false);
  }, [businessId, branchId, onScanResult, onOpenChange]);

  // --- Stop all scanning engines ---
  const stopAllScanning = useCallback(() => {
    // Stop native BarcodeDetector loop
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    // Stop ZXing
    zxingControlsRef.current?.stop();
    zxingControlsRef.current = null;
    zxingReaderRef.current = null;
    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (focusIntervalRef.current) {
      clearInterval(focusIntervalRef.current);
      focusIntervalRef.current = null;
    }
    stopScanLine();
  }, []);

  // --- Native BarcodeDetector scanning loop ---
  const startNativeScanning = useCallback((video: HTMLVideoElement, canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const detector = new (globalThis as any).BarcodeDetector({
      formats: ["qr_code", "ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e"],
    });
    detectorRef.current = detector;

    const scanFrame = () => {
      if (!mountedRef.current) return;

      const now = performance.now();
      if (now - lastScanRef.current < 300) {
        rafRef.current = requestAnimationFrame(scanFrame);
        return;
      }
      lastScanRef.current = now;

      if (video.readyState < video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      detector
        .detect(canvas)
        .then((barcodes: any[]) => {
          if (!mountedRef.current) return;
          if (barcodes.length > 0) {
            handleScanResult(barcodes[0].rawValue);
            return; // Stop loop after detection
          }
          rafRef.current = requestAnimationFrame(scanFrame);
        })
        .catch(() => {
          if (mountedRef.current) {
            rafRef.current = requestAnimationFrame(scanFrame);
          }
        });
    };

    rafRef.current = requestAnimationFrame(scanFrame);
  }, [handleScanResult]);

  // --- Get camera constraints using main back camera ---
  const getCameraConstraints = async (): Promise<MediaStreamConstraints> => {
    const deviceId = await pickMainBackCamera();
    if (deviceId) {
      return { video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false };
    }
    return { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false };
  };

  // --- ZXing fallback ---
  const startZxingScanning = useCallback(async (videoEl: HTMLVideoElement) => {
    const { BrowserMultiFormatReader } = await import("@zxing/browser");
    const codeReader = new BrowserMultiFormatReader();
    zxingReaderRef.current = codeReader;

    const selectedCamera = await pickMainBackCamera();

    await codeReader.decodeFromVideoDevice(selectedCamera ?? undefined, videoEl, (result, _err, controls) => {
      if (!mountedRef.current || processing || !result) return;
      zxingControlsRef.current = controls;
      handleScanResult(result.getText());
    });
  }, [handleScanResult, processing]);

  // --- Main start scanner ---
  const startScanner = useCallback(async () => {
    const videoEl = document.getElementById("bivoo-qr-reader") as HTMLVideoElement;
    if (!videoEl) return;

    if (hasBarcodeDetector) {
      // Native path: manually acquire camera stream
      try {
        const constraints = await getCameraConstraints();
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!mountedRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        videoEl.srcObject = stream;
        await videoEl.play();

        const canvas = canvasRef.current;
        if (canvas) {
          startNativeScanning(videoEl, canvas);
        }
        startScanLine();
      } catch (err) {
        console.error("Native scanner error, falling back to ZXing:", err);
        // Fallback to ZXing
        try {
          await startZxingScanning(videoEl);
          startScanLine();
        } catch (zxErr) {
          console.error("ZXing fallback also failed:", zxErr);
          if (mountedRef.current) toast.error("No se pudo acceder a la cámara");
        }
      }
    } else {
      // ZXing path
      try {
        await startZxingScanning(videoEl);
        startScanLine();
      } catch (err) {
        console.error("Scanner error:", err);
        if (mountedRef.current) toast.error("No se pudo acceder a la cámara");
      }
    }
  }, [startNativeScanning, startZxingScanning]);

  useEffect(() => {
    if (!open) {
      setFeedback(null);
      setProcessing(false);
      setScanLinePos(0);
      scanLinePosRef.current = 0;
      return;
    }

    mountedRef.current = true;

    const t = setTimeout(startScanner, 300);

    return () => {
      mountedRef.current = false;
      clearTimeout(t);
      stopAllScanning();
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
    mountedRef.current = true;
    await startScanner();
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
              <video id="bivoo-qr-reader" className="w-full h-full object-cover" playsInline muted />
              {/* Canvas oculto para BarcodeDetector */}
              <canvas ref={canvasRef} className="hidden" />

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
