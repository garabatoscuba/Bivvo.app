import { Clock, QrCode, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

const SinJornadaActiva = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Clock className="h-10 w-10 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold text-foreground mb-1">Jornada no iniciada</h2>
      <p className="text-sm text-muted-foreground max-w-xs mb-6">
        Para acceder a esta sección necesitas iniciar tu jornada laboral
      </p>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        <Button onClick={() => navigate('/jornada/entrada')} className="gap-2">
          <QrCode className="h-4 w-4" />
          Escanear QR de entrada
        </Button>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() =>
            toast({
              title: 'Contacta a tu gerente',
              description: 'Pide a tu gerente que inicie tu jornada manualmente.',
            })
          }
        >
          <HelpCircle className="h-4 w-4" />
          Pedir ayuda a mi gerente
        </Button>
      </div>
    </div>
  );
};

export default SinJornadaActiva;
