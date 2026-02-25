import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';

const Cobros = () => {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
        <FileText className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Próximamente</h2>
        <p className="text-muted-foreground max-w-md">
          El módulo de Reportes estará disponible con el plan Profesional. Consulta reportes diarios y resumen de cobros.
        </p>
        <Button onClick={() => navigate('/plans')}>Ver Planes</Button>
      </div>
    </AppLayout>
  );
};

export default Cobros;
