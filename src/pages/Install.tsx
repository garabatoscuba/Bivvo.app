import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Button } from "@/components/ui/button";
import { Download, Share, Plus, CheckCircle, ArrowLeft, Monitor, Chrome } from "lucide-react";
import { Link } from "react-router-dom";

const Install = () => {
  const { canInstall, isInstalled, promptInstall } = usePWAInstall();
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isDesktop = !isMobile;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Instala Bivoo</h1>
          <p className="text-muted-foreground">Úsala como una app nativa en tu teléfono, incluso sin internet.</p>
        </div>

        {isInstalled ? (
          <div className="rounded-lg border border-border bg-card p-6 space-y-3">
            <CheckCircle className="mx-auto h-10 w-10 text-primary" />
            <p className="font-medium text-foreground">¡App ya instalada!</p>
            <p className="text-sm text-muted-foreground">Búscala en tu pantalla de inicio.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Direct install button - most prominent */}
            {canInstall && (
              <Button size="lg" className="w-full gap-2 text-base" onClick={promptInstall}>
                <Download className="h-5 w-5" />
                Instalar App Ahora
              </Button>
            )}

            {/* Desktop message */}
            {isDesktop && (
              <div className="rounded-lg border border-border bg-card p-5 space-y-3">
                <Monitor className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Estás en una computadora. Para instalar la app, abre este enlace desde tu teléfono:
                </p>
                <div className="rounded-md bg-muted px-3 py-2">
                  <p className="text-xs font-mono text-foreground break-all select-all">
                    {window.location.origin}/install
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Copia el enlace y ábrelo en <strong className="text-foreground">Chrome</strong> (Android) o{" "}
                  <strong className="text-foreground">Safari</strong> (iPhone)
                </p>
              </div>
            )}

            {/* Android instructions */}
            <div className="rounded-lg border border-border bg-card p-5 text-left space-y-3">
              <div className="flex items-center gap-2">
                <Chrome className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-foreground">Android (Chrome)</h2>
              </div>
              {canInstall ? (
                <p className="text-sm text-muted-foreground">
                  ¡Toca el botón <strong className="text-foreground">"Instalar App Ahora"</strong> de arriba y confirma!
                </p>
              ) : (
                <ol className="space-y-2.5 text-sm text-muted-foreground">
                  <li className="flex gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      1
                    </span>
                    <span>
                      Abre esta página en <strong className="text-foreground">Chrome</strong>
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      2
                    </span>
                    <span>
                      Toca el menú <strong className="text-foreground">⋮</strong> (tres puntos arriba a la derecha)
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      3
                    </span>
                    <span>
                      Selecciona <strong className="text-foreground">"Instalar app"</strong> o{" "}
                      <strong className="text-foreground">"Agregar a pantalla de inicio"</strong>
                    </span>
                  </li>
                </ol>
              )}
            </div>

            {/* iOS instructions */}
            <div className="rounded-lg border border-border bg-card p-5 text-left space-y-3">
              <div className="flex items-center gap-2">
                <Share className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-foreground">iPhone / iPad (Safari)</h2>
              </div>
              <ol className="space-y-2.5 text-sm text-muted-foreground">
                <li className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    1
                  </span>
                  <span>
                    Abre esta página en <strong className="text-foreground">Safari</strong>
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    2
                  </span>
                  <span>
                    Toca el icono <Share className="inline h-3.5 w-3.5 -mt-0.5" />{" "}
                    <strong className="text-foreground">Compartir</strong>
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    3
                  </span>
                  <span>
                    Selecciona <Plus className="inline h-3.5 w-3.5 -mt-0.5" />{" "}
                    <strong className="text-foreground">"Agregar a pantalla de inicio"</strong>
                  </span>
                </li>
              </ol>
            </div>
          </div>
        )}

        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Volver al inicio
        </Link>
      </div>
    </div>
  );
};

export default Install;
