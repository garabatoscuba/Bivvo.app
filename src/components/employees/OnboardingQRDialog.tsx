import { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Download, Copy, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface OnboardingQRDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  employeeName: string;
}

const OnboardingQRDialog = ({ open, onOpenChange, token, employeeName }: OnboardingQRDialogProps) => {
  const qrRef = useRef<HTMLDivElement>(null);

  // Use published URL so the QR works on external devices (preview URLs require Lovable auth)
  const getPublicOrigin = () => {
    const host = window.location.hostname;
    if (host.includes('preview--')) {
      // Published URL: use the app's published domain
      return 'https://sync-sales-suite.lovable.app';
    }
    return window.location.origin;
  };

  const url = `${getPublicOrigin()}/onboarding/empleado?token=${token}`;

  const handleDownload = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `qr-onboarding-${employeeName.replace(/\s+/g, '-')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast.success('QR descargado');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Enlace copiado');
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            QR de Registro
          </DialogTitle>
          <DialogDescription>
            Comparte este QR con <strong>{employeeName}</strong> para que se registre en el sistema como empleado.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          <div ref={qrRef} className="rounded-xl border bg-white p-4">
            <QRCodeCanvas value={url} size={200} level="H" />
          </div>
          <p className="text-xs text-muted-foreground text-center max-w-xs break-all">{url}</p>
          <div className="flex gap-2 w-full">
            <Button onClick={handleDownload} variant="outline" className="flex-1 gap-2">
              <Download className="h-4 w-4" /> Descargar
            </Button>
            <Button onClick={handleCopy} variant="outline" className="flex-1 gap-2">
              <Copy className="h-4 w-4" /> Copiar enlace
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Este enlace expira en 72 horas y solo puede usarse una vez.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingQRDialog;
