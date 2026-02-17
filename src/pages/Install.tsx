import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Button } from '@/components/ui/button';
import { Download, Share, Plus, Smartphone, CheckCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const Install = () => {
  const { canInstall, isInstalled, promptInstall } = usePWAInstall();
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <Smartphone className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Instala SyncSales</h1>
          <p className="text-muted-foreground">
            Úsala como una app nativa en tu teléfono, incluso sin internet.
          </p>
        </div>

        {isInstalled ? (
          <div className="rounded-lg border border-border bg-card p-6 space-y-3">
            <CheckCircle className="mx-auto h-10 w-10 text-primary" />
            <p className="font-medium text-foreground">¡App ya instalada!</p>
            <p className="text-sm text-muted-foreground">
              Búscala en tu pantalla de inicio.
            </p>
          </div>
        ) : (
          <>
            {/* Android instructions */}
            {!isIOS && (
              <div className="rounded-lg border border-border bg-card p-6 text-left space-y-4">
                <h2 className="font-semibold text-foreground">Android</h2>
                <ol className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
                    <span>Toca el botón <strong className="text-foreground">"Instalar"</strong> de abajo</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
                    <span>Confirma la instalación en el diálogo del navegador</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
                    <span>¡Listo! Busca <strong className="text-foreground">SyncSales</strong> en tu pantalla de inicio</span>
                  </li>
                </ol>
              </div>
            )}

            {/* iOS instructions */}
            {isIOS && (
              <div className="rounded-lg border border-border bg-card p-6 text-left space-y-4">
                <h2 className="font-semibold text-foreground">iPhone / iPad</h2>
                <ol className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex gap-3">
                    <Share className="h-5 w-5 shrink-0 text-primary" />
                    <span>Toca el icono de <strong className="text-foreground">Compartir</strong> en Safari (cuadrado con flecha hacia arriba)</span>
                  </li>
                  <li className="flex gap-3">
                    <Plus className="h-5 w-5 shrink-0 text-primary" />
                    <span>Selecciona <strong className="text-foreground">"Agregar a pantalla de inicio"</strong></span>
                  </li>
                  <li className="flex gap-3">
                    <CheckCircle className="h-5 w-5 shrink-0 text-primary" />
                    <span>Toca <strong className="text-foreground">"Agregar"</strong> y listo</span>
                  </li>
                </ol>
              </div>
            )}

            {canInstall && (
              <Button size="lg" className="w-full gap-2" onClick={promptInstall}>
                <Download className="h-5 w-5" />
                Instalar App
              </Button>
            )}

            {!canInstall && !isIOS && (
              <p className="text-sm text-muted-foreground">
                Abre esta página en <strong>Chrome</strong> en tu teléfono Android para poder instalar la app.
              </p>
            )}
          </>
        )}

        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al inicio
        </Link>
      </div>
    </div>
  );
};

export default Install;
