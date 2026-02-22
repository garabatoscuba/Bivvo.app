import { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Download, Copy, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const JornadaQR = () => {
  const { profile, isOwner, isManager } = useAuth();
  const qrRef = useRef<HTMLDivElement>(null);

  if (!isOwner && !isManager) return null;
  if (!profile?.branch_id) return null;

  const url = `${window.location.origin}/jornada/entrada?sucursal=${profile.branch_id}`;

  const handleDownload = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `qr-jornada-${profile.branch_id}.png`;
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          QR de Jornada Laboral
        </CardTitle>
        <CardDescription>
          Imprime este QR y colócalo en la entrada. Los empleados lo escanean para registrar su jornada.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div ref={qrRef} className="rounded-xl border bg-white p-4">
          <QRCodeCanvas value={url} size={220} level="H" />
        </div>
        <p className="text-xs text-muted-foreground text-center max-w-xs break-all">{url}</p>
        <div className="flex gap-2 w-full max-w-xs">
          <Button onClick={handleDownload} variant="outline" className="flex-1 gap-2">
            <Download className="h-4 w-4" /> Descargar QR
          </Button>
          <Button onClick={handleCopy} variant="outline" className="flex-1 gap-2">
            <Copy className="h-4 w-4" /> Copiar enlace
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default JornadaQR;
