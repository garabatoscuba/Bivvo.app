import { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Download, Printer, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

interface EmployeeQRCardProps {
  employeeId: string;
  businessId: string;
  employeeName: string;
  position: string;
}

const EmployeeQRCard = ({ employeeId, businessId, employeeName, position }: EmployeeQRCardProps) => {
  const qrRef = useRef<HTMLDivElement>(null);

  const qrData = JSON.stringify({
    type: 'bivoo_employee',
    employee_id: employeeId,
    business_id: businessId,
  });

  const handleDownload = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `QR-${employeeName.replace(/\s+/g, '_')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast.success('QR descargado');
  };

  const handlePrint = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const win = window.open('', '_blank');
    if (!win) {
      toast.error('No se pudo abrir la ventana de impresión');
      return;
    }
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR - ${employeeName}</title>
        <style>
          @page { size: 80mm 120mm; margin: 4mm; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            text-align: center;
          }
          .brand { font-size: 18px; font-weight: 700; letter-spacing: 2px; margin-bottom: 12px; }
          .qr { margin: 8px 0; }
          .qr img { width: 200px; height: 200px; }
          .name { font-size: 16px; font-weight: 600; margin-top: 12px; }
          .position { font-size: 13px; color: #666; margin-top: 4px; }
          .cut-line { border-top: 1px dashed #ccc; width: 90%; margin-top: 16px; padding-top: 4px; font-size: 10px; color: #aaa; }
        </style>
      </head>
      <body>
        <div class="brand">BIVOO</div>
        <div class="qr"><img src="${dataUrl}" /></div>
        <div class="name">${employeeName}</div>
        <div class="position">${position}</div>
        <div class="cut-line">Escanea para registrar asistencia</div>
      </body>
      </html>
    `);
    win.document.close();
    win.onload = () => { win.print(); };
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <QrCode className="h-4 w-4" />
          Código QR de Asistencia
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3">
        <div ref={qrRef} className="rounded-xl border bg-white p-3">
          <QRCodeCanvas value={qrData} size={180} level="H" />
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Escanea este código para registrar entrada/salida
        </p>
        <div className="flex gap-2 w-full">
          <Button onClick={handleDownload} variant="outline" size="sm" className="flex-1 gap-1.5">
            <Download className="h-3.5 w-3.5" /> Descargar
          </Button>
          <Button onClick={handlePrint} variant="outline" size="sm" className="flex-1 gap-1.5">
            <Printer className="h-3.5 w-3.5" /> Imprimir
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default EmployeeQRCard;
