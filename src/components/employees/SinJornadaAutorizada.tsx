import { ShieldAlert } from 'lucide-react';

const SinJornadaAutorizada = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="rounded-full bg-destructive/10 p-4 mb-4">
        <ShieldAlert className="h-10 w-10 text-destructive" />
      </div>
      <h2 className="text-lg font-semibold text-foreground mb-1">Acceso restringido</h2>
      <p className="text-sm text-muted-foreground max-w-xs">
        Tu jornada debe ser iniciada por un dueño o gerente para acceder a esta sección.
        Contacta a tu supervisor.
      </p>
    </div>
  );
};

export default SinJornadaAutorizada;
