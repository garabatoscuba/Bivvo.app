import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import garabatosLogoDark from '@/assets/garabatos-dark.png';
import garabatosLogoLight from '@/assets/garabatos-light.png';

const GarabatosPromoCard = () => (
  <Card className="border-amber-500/30 bg-gradient-to-br from-card to-amber-950/10">
    <CardContent className="flex flex-col sm:flex-row items-center gap-4 p-5">
      <img
        src={garabatosLogoDark}
        alt="Estudio Garabatos"
        className="h-14 w-auto object-contain shrink-0 dark:hidden"
      />
      <img
        src={garabatosLogoLight}
        alt="Estudio Garabatos"
        className="h-14 w-auto object-contain shrink-0 hidden dark:block"
      />
      <div className="flex-1 text-center sm:text-left space-y-1">
        <p className="text-sm font-semibold text-foreground">¿Tu negocio necesita una identidad visual?</p>
        <p className="text-xs text-muted-foreground">Diseño de logos, branding completo y portales web personalizados, fotografía, estrategias y mucho más. El estudio detrás de Bivoo.</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="border-amber-500/40 hover:bg-amber-500/10 shrink-0"
        onClick={() => window.open('https://estudiogarabatos.com', '_blank')}
      >
        <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
        Conocer Estudio Garabatos
      </Button>
    </CardContent>
  </Card>
);

export default GarabatosPromoCard;
