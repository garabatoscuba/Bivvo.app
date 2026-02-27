import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, ChevronLeft, ChevronRight, Globe, Store, Scissors, Dumbbell, DollarSign, ListChecks } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

interface OnboardingWizardProps {
  open: boolean;
  profile: { user_id: string; business_id: string | null; country: string | null };
}

type Step = 'country' | 'business_type' | 'business_name' | 'currency' | 'checklist';

const COUNTRIES = [
  { value: 'cuba', label: '🇨🇺 Cuba' },
  { value: 'usa', label: '🇺🇸 Estados Unidos' },
  { value: 'americas', label: '🌎 Américas' },
  { value: 'europe', label: '🇪🇺 Europa' },
  { value: 'asia', label: '🌏 Asia' },
  { value: 'africa', label: '🌍 África' },
];

const CURRENCY_BY_COUNTRY: Record<string, { code: string; symbol: string; name: string }[]> = {
  cuba: [
    { code: 'CUP', symbol: '$', name: 'Peso Cubano (CUP)' },
    { code: 'USD', symbol: '$', name: 'Dólar Estadounidense (USD)' },
    { code: 'EUR', symbol: '€', name: 'Euro (EUR)' },
  ],
  usa: [
    { code: 'USD', symbol: '$', name: 'Dólar Estadounidense (USD)' },
    { code: 'EUR', symbol: '€', name: 'Euro (EUR)' },
  ],
  americas: [
    { code: 'USD', symbol: '$', name: 'Dólar Estadounidense (USD)' },
    { code: 'MXN', symbol: '$', name: 'Peso Mexicano (MXN)' },
    { code: 'COP', symbol: '$', name: 'Peso Colombiano (COP)' },
    { code: 'ARS', symbol: '$', name: 'Peso Argentino (ARS)' },
    { code: 'BRL', symbol: 'R$', name: 'Real Brasileño (BRL)' },
    { code: 'EUR', symbol: '€', name: 'Euro (EUR)' },
  ],
  europe: [
    { code: 'EUR', symbol: '€', name: 'Euro (EUR)' },
    { code: 'GBP', symbol: '£', name: 'Libra Esterlina (GBP)' },
    { code: 'USD', symbol: '$', name: 'Dólar Estadounidense (USD)' },
  ],
  asia: [
    { code: 'USD', symbol: '$', name: 'Dólar Estadounidense (USD)' },
    { code: 'CNY', symbol: '¥', name: 'Yuan Chino (CNY)' },
    { code: 'JPY', symbol: '¥', name: 'Yen Japonés (JPY)' },
    { code: 'EUR', symbol: '€', name: 'Euro (EUR)' },
  ],
  africa: [
    { code: 'USD', symbol: '$', name: 'Dólar Estadounidense (USD)' },
    { code: 'EUR', symbol: '€', name: 'Euro (EUR)' },
    { code: 'ZAR', symbol: 'R', name: 'Rand Sudafricano (ZAR)' },
  ],
};

const DEFAULT_CURRENCY: Record<string, string> = {
  cuba: 'CUP',
  usa: 'USD',
  americas: 'USD',
  europe: 'EUR',
  asia: 'USD',
  africa: 'USD',
};

const BIZ_TYPE_ICONS: Record<string, typeof Store> = {
  store: Store,
  copy_shop: Scissors,
  gym: Dumbbell,
};

const BIZ_TYPE_DESCRIPTIONS: Record<string, string> = {
  store: 'Tienda minorista con inventario, POS y ventas',
  copy_shop: 'Centro de impresiones y servicios de copias',
  gym: 'Gimnasio con membresías y control de acceso',
};

const STEPS: Step[] = ['country', 'business_type', 'business_name', 'currency', 'checklist'];

const OnboardingWizard = ({ open, profile }: OnboardingWizardProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedCountry, setSelectedCountry] = useState(profile.country || '');
  const [selectedBizType, setSelectedBizType] = useState('store');
  const [businessName, setBusinessName] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [saving, setSaving] = useState(false);

  const isCuba = selectedCountry === 'cuba';

  // Fetch available business types from DB
  const { data: availableBusinessTypes = [] } = useQuery({
    queryKey: ['onboarding-business-types', isCuba],
    queryFn: async () => {
      const { data } = await supabase
        .from('business_type_configs')
        .select('key, name, icon, country')
        .eq('is_active', true)
        .order('sort_order');
      return (data || []).filter(bt =>
        !bt.country || (bt.country === 'cuba' ? isCuba : true)
      );
    },
    enabled: !!selectedCountry,
  });

  const step = STEPS[currentStep];

  // Set default currency when country changes
  const handleCountrySelect = (country: string) => {
    setSelectedCountry(country);
    setSelectedCurrency(DEFAULT_CURRENCY[country] || 'USD');
    if (country !== 'cuba' && selectedBizType === 'copy_shop') {
      setSelectedBizType('store');
    }
  };

  const canNext = () => {
    switch (step) {
      case 'country': return !!selectedCountry;
      case 'business_type': return !!selectedBizType;
      case 'business_name': return businessName.trim().length >= 2;
      case 'currency': return !!selectedCurrency;
      case 'checklist': return true;
      default: return false;
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      // 1. Update profile with country + onboarding_completed
      await supabase.from('profiles').update({
        country: selectedCountry,
        onboarding_completed: true,
      } as any).eq('user_id', profile.user_id);

      // 2. Update business with name, type, and currency
      if (profile.business_id) {
        await supabase.from('businesses').update({
          name: businessName.trim(),
          business_type: selectedBizType,
          base_currency: selectedCurrency,
        } as any).eq('id', profile.business_id);
      }

      toast.success('¡Todo listo! Tu negocio está configurado 🎉');
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const currencies = CURRENCY_BY_COUNTRY[selectedCountry] || CURRENCY_BY_COUNTRY['usa'];

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Progress bar */}
        <div className="flex gap-1.5 mb-1">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= currentStep ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Country */}
        {step === 'country' && (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                ¿Dónde te encuentras?
              </DialogTitle>
              <DialogDescription>
                Esto nos ayuda a configurar moneda, impuestos y funciones regionales.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-2 py-2">
              {COUNTRIES.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleCountrySelect(opt.value)}
                  className={`flex items-center justify-center rounded-lg border p-3 text-sm font-medium transition-colors ${
                    selectedCountry === opt.value
                      ? 'border-primary bg-primary/10 ring-1 ring-primary text-foreground'
                      : 'hover:bg-muted/50 text-muted-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 2: Business Type */}
        {step === 'business_type' && (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" />
                Tipo de negocio
              </DialogTitle>
              <DialogDescription>
                Selecciona el tipo que mejor describe tu negocio.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              {availableBusinessTypes.map(bt => {
                const Icon = BIZ_TYPE_ICONS[bt.key] || Store;
                return (
                  <button
                    key={bt.key}
                    type="button"
                    onClick={() => setSelectedBizType(bt.key)}
                    className={`w-full flex items-start gap-3 rounded-lg border p-4 text-left transition-colors ${
                      selectedBizType === bt.key
                        ? 'border-primary bg-primary/10 ring-1 ring-primary'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <Icon className={`h-5 w-5 mt-0.5 ${selectedBizType === bt.key ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div>
                      <p className="font-medium text-sm">{bt.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {BIZ_TYPE_DESCRIPTIONS[bt.key] || bt.name}
                      </p>
                    </div>
                  </button>
                );
              })}
              {availableBusinessTypes.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Cargando tipos de negocio...</p>
              )}
            </div>
          </>
        )}

        {/* Step 3: Business Name */}
        {step === 'business_name' && (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" />
                Nombre del negocio
              </DialogTitle>
              <DialogDescription>
                ¿Cómo se llama tu negocio? Podrás cambiarlo después.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              <Input
                placeholder="Ej: Mi Tienda, Ferretería López..."
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                autoFocus
                className="text-base"
              />
            </div>
          </>
        )}

        {/* Step 4: Currency */}
        {step === 'currency' && (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Moneda principal
              </DialogTitle>
              <DialogDescription>
                Esta moneda se usará en POS, inventario, reportes y nómina.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              {currencies.map(c => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => setSelectedCurrency(c.code)}
                  className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                    selectedCurrency === c.code
                      ? 'border-primary bg-primary/10 ring-1 ring-primary'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <span className="text-lg font-bold w-8 text-center">{c.symbol}</span>
                  <span className="text-sm font-medium">{c.name}</span>
                  {selectedCurrency === c.code && (
                    <Check className="h-4 w-4 text-primary ml-auto" />
                  )}
                </button>
              ))}
              <p className="text-xs text-muted-foreground pt-1">
                💡 Si activas el plugin de Tasa de Cambio podrás operar con dos monedas simultáneamente.
              </p>
            </div>
          </>
        )}

        {/* Step 5: Checklist */}
        {step === 'checklist' && (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-primary" />
                ¡Ya casi! Tus primeros pasos
              </DialogTitle>
              <DialogDescription>
                Estos pasos te ayudarán a sacarle el máximo provecho a Bivoo.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {[
                { icon: '📦', text: 'Agrega tu primer producto en Inventario' },
                { icon: '🛒', text: 'Realiza tu primera venta en el Punto de Venta' },
                { icon: '👥', text: 'Agrega tu primer empleado en Recursos Humanos' },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-sm font-medium">{item.text}</span>
                </div>
              ))}
              <div className="rounded-lg border bg-muted/50 p-3 mt-2">
                <p className="text-xs text-muted-foreground">
                  Empiezas con un plan gratuito. Puedes probar planes superiores por 7 días sin compromiso desde la sección de <strong>Planes</strong>.
                </p>
              </div>
            </div>
          </>
        )}

        {/* Navigation */}
        <DialogFooter className="flex-row gap-2 justify-between sm:justify-between">
          {currentStep > 0 ? (
            <Button
              variant="outline"
              onClick={() => setCurrentStep(s => s - 1)}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Atrás
            </Button>
          ) : (
            <div />
          )}
          {currentStep < STEPS.length - 1 ? (
            <Button
              onClick={() => setCurrentStep(s => s + 1)}
              disabled={!canNext()}
              className="gap-1"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleFinish}
              disabled={saving}
              className="gap-1"
            >
              {saving ? 'Guardando...' : '¡Empezar! 🚀'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingWizard;
