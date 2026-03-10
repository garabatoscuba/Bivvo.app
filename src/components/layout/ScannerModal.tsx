import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, ScanLine } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { toast } from 'sonner';

interface ScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScanResult?: (result: string) => void;
}

const ScannerModal = ({ open, onOpenChange, onScanResult }: ScannerModalProps) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let mounted = true;
    const scannerId = 'bivoo-qr-reader';

    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode(scannerId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            if (!mounted) return;
            setLastResult(decodedText);
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

    // Small delay to ensure DOM element exists
    const t = setTimeout(startScanner, 300);

    return () => {
      mounted = false;
      clearTimeout(t);
      scannerRef.current?.stop().catch(() => {});
      scannerRef.current = null;
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ScanLine className="h-5 w-5 text-primary" />
            Escáner
          </DialogTitle>
        </DialogHeader>

        <div className="relative bg-black">
          <div id="bivoo-qr-reader" className="w-full" />
        </div>

        <div className="p-4 pt-3 text-center space-y-3">
          <p className="text-sm text-muted-foreground">Apunta al código QR o de barras</p>
          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" /> Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ScannerModal;
