import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Check, ChevronLeft, ArrowRight, Package, ShoppingCart, Users, Store, Heart, Gift, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface OnboardingWizardProps {
  open: boolean;
  profile: { user_id: string; business_id: string | null; country: string | null };
}

type Step = "country" | "business" | "currency" | "checklist";

const COUNTRIES = [
  { value: "cuba", label: "Cuba", flag: "🇨🇺" },
  { value: "mexico", label: "México", flag: "🇲🇽" },
  { value: "americas", label: "Américas", flag: "🌎" },
  { value: "usa", label: "Estados Unidos", flag: "🇺🇸" },
  { value: "europe", label: "Europa", flag: "🇪🇺" },
  { value: "africa", label: "África", flag: "🌍" },
  { value: "asia", label: "Asia", flag: "🌏" },
];

const CURRENCY_BY_COUNTRY: Record<string, { code: string; symbol: string; name: string }[]> = {
  cuba: [
    { code: "CUP", symbol: "$", name: "Peso Cubano (CUP)" },
    { code: "USD", symbol: "$", name: "Dólar (USD)" },
    { code: "EUR", symbol: "€", name: "Euro (EUR)" },
  ],
  mexico: [
    { code: "MXN", symbol: "$", name: "Peso Mexicano (MXN)" },
    { code: "USD", symbol: "$", name: "Dólar (USD)" },
    { code: "EUR", symbol: "€", name: "Euro (EUR)" },
  ],
  usa: [
    { code: "USD", symbol: "$", name: "Dólar (USD)" },
    { code: "EUR", symbol: "€", name: "Euro (EUR)" },
  ],
  americas: [
    { code: "USD", symbol: "$", name: "Dólar (USD)" },
    { code: "MXN", symbol: "$", name: "Peso Mexicano (MXN)" },
    { code: "COP", symbol: "$", name: "Peso Colombiano (COP)" },
    { code: "ARS", symbol: "$", name: "Peso Argentino (ARS)" },
    { code: "BRL", symbol: "R$", name: "Real (BRL)" },
    { code: "EUR", symbol: "€", name: "Euro (EUR)" },
  ],
  europe: [
    { code: "EUR", symbol: "€", name: "Euro (EUR)" },
    { code: "GBP", symbol: "£", name: "Libra (GBP)" },
    { code: "USD", symbol: "$", name: "Dólar (USD)" },
  ],
  asia: [
    { code: "USD", symbol: "$", name: "Dólar (USD)" },
    { code: "CNY", symbol: "¥", name: "Yuan (CNY)" },
    { code: "JPY", symbol: "¥", name: "Yen (JPY)" },
    { code: "EUR", symbol: "€", name: "Euro (EUR)" },
  ],
  africa: [
    { code: "USD", symbol: "$", name: "Dólar (USD)" },
    { code: "EUR", symbol: "€", name: "Euro (EUR)" },
    { code: "ZAR", symbol: "R", name: "Rand (ZAR)" },
  ],
};

const DEFAULT_CURRENCY: Record<string, string> = {
  cuba: "CUP",
  mexico: "MXN",
  usa: "USD",
  americas: "USD",
  europe: "EUR",
  asia: "USD",
  africa: "USD",
};

const STEP_TITLES: Record<Step, string> = {
  country: "¿Dónde operas?",
  business: "Tu negocio",
  currency: "¿Cuál es tu moneda principal?",
  checklist: "Todo listo",
};

const STEP_SUBTITLES: Record<Step, string> = {
  country: "Configuraremos moneda y funciones regionales",
  business: "Podrás cambiarlo después",
  currency: "Se usará en POS, inventario y reportes",
  checklist: "Tus primeros pasos con Bivoo",
};

const BIZ_TYPE_DESCRIPTIONS: Record<string, string> = {
  store: "Inventario, punto de venta y ventas",
  copy_shop: "Impresiones y servicios de copias",
  gym: "Membresías y control de acceso",
};

const OnboardingWizard = ({ open, profile }: OnboardingWizardProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedCountry, setSelectedCountry] = useState(profile.country || "");
  const [selectedBizType, setSelectedBizType] = useState("store");
  const [businessName, setBusinessName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const [saving, setSaving] = useState(false);
  const [direction, setDirection] = useState<"forward" | "back">("forward");

  const isCuba = selectedCountry === "cuba";
  const hasBusinessName = businessName.trim().length >= 2;

  const { data: availableBusinessTypes = [] } = useQuery({
    queryKey: ["onboarding-business-types", isCuba],
    queryFn: async () => {
      const { data } = await supabase
        .from("business_type_configs")
        .select("key, name, icon, country")
        .eq("is_active", true)
        .order("sort_order");
      return (data || []).filter((bt) => !bt.country || (bt.country === "cuba" ? isCuba : true));
    },
    enabled: !!selectedCountry,
  });

  // Dynamic steps: currency only if user entered a business name
  const steps = useMemo<Step[]>(() => {
    if (hasBusinessName) {
      return ["country", "business", "currency", "checklist"];
    }
    return ["country", "business", "checklist"];
  }, [hasBusinessName]);

  const step = steps[currentStep];

  const handleCountrySelect = (country: string) => {
    setSelectedCountry(country);
    setSelectedCurrency(DEFAULT_CURRENCY[country] || "USD");
    if (country !== "cuba" && selectedBizType === "copy_shop") {
      setSelectedBizType("store");
    }
  };

  const canNext = () => {
    switch (step) {
      case "country":
        return !!selectedCountry;
      case "business":
        return true; // always can continue (with or without business name)
      case "currency":
        return !!selectedCurrency;
      case "checklist":
        return true;
      default:
        return false;
    }
  };

  const goNext = () => {
    setDirection("forward");
    setCurrentStep((s) => s + 1);
  };

  const goBack = () => {
    setDirection("back");
    setCurrentStep((s) => s - 1);
  };

  const handleSkip = () => {
    // Skip goes directly to checklist (last step)
    setDirection("forward");
    setBusinessName("");
    // steps without business: ["country", "business", "checklist"] → checklist is index 2
    setCurrentStep(2);
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        country: selectedCountry,
      };

      if (hasBusinessName) {
        body.business_name = businessName.trim();
        body.business_type = selectedBizType;
        body.base_currency = selectedCurrency;
        body.keywords = keywords.trim() || undefined;
      } else {
        body.skip_business = true;
      }

      const { data, error } = await supabase.functions.invoke('complete-onboarding', { body });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(
        hasBusinessName
          ? "¡Todo listo! Tu negocio está configurado 🎉"
          : "¡Bienvenido a Bivoo! 🎉"
      );
      window.location.reload();
    } catch (err: any) {
      console.error('Onboarding error:', err);
      toast.error(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const currencies = CURRENCY_BY_COUNTRY[selectedCountry] || CURRENCY_BY_COUNTRY["usa"];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      {/* Subtle top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary/30" />

      <div className="w-full max-w-lg mx-auto px-6 py-8 flex flex-col min-h-screen justify-center">
        {/* Logo */}
        <div className="flex justify-center mb-12">
          <img src="/logo-light.png" alt="Bivoo" className="h-8 dark:hidden" />
          <img src="/logo-dark.png" alt="Bivoo" className="h-8 hidden dark:block" />
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-12">
          {steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                "rounded-full transition-all duration-500",
                i === currentStep
                  ? "w-6 h-2 bg-primary"
                  : i < currentStep
                    ? "w-2 h-2 bg-primary/40"
                    : "w-2 h-2 bg-border",
              )}
            />
          ))}
        </div>

        {/* Step content with animation */}
        <div
          key={`${step}-${currentStep}`}
          className="flex-1 flex flex-col animate-fade-in"
        >
          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground mb-2">
              {STEP_TITLES[step]}
            </h1>
            <p className="text-sm text-muted-foreground">{STEP_SUBTITLES[step]}</p>
          </div>

          {/* Step bodies */}
          <div className="flex-1 flex flex-col items-center">
            {/* Country */}
            {step === "country" && (
              <div className="w-full grid grid-cols-2 gap-3">
                {COUNTRIES.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleCountrySelect(opt.value)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-4 py-4 text-left transition-all duration-200",
                      selectedCountry === opt.value
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/30 hover:bg-muted/30",
                    )}
                  >
                    <span className="text-xl">{opt.flag}</span>
                    <span
                      className={cn(
                        "text-sm font-medium",
                        selectedCountry === opt.value ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {opt.label}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Business — merged step */}
            {step === "business" && (
              <div className="w-full space-y-5">
                {/* Business name input */}
                <div>
                  <Input
                    placeholder="Nombre de tu negocio"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    autoFocus
                    className="text-center text-lg h-14 border-border bg-transparent rounded-xl focus:border-primary focus:ring-primary/20"
                  />
                </div>

                {/* Dynamic content based on whether name is filled */}
                {hasBusinessName ? (
                  <div className="space-y-4 animate-fade-in">
                    {/* Business type free input */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">
                        Tipo de negocio
                      </label>
                      <Input
                        value={selectedBizType}
                        onChange={(e) => setSelectedBizType(e.target.value)}
                        placeholder="Ej: Barbería, Floristería, Taller..."
                        className="h-12 rounded-xl border-border bg-transparent focus:border-primary focus:ring-primary/20"
                      />
                      {availableBusinessTypes.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <span className="text-xs text-muted-foreground self-center">Sugerencias:</span>
                          {availableBusinessTypes.map((bt) => (
                            <button
                              key={bt.key}
                              type="button"
                              onClick={() => setSelectedBizType(bt.key)}
                              className={cn(
                                "px-2.5 py-1 rounded-full text-xs border transition-colors",
                                selectedBizType === bt.key
                                  ? "bg-primary/10 border-primary/40 text-primary"
                                  : "border-border hover:border-primary/30 hover:bg-muted/30",
                              )}
                            >
                              {bt.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Keywords field */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">
                        ¿Cómo describirías tu negocio?
                      </label>
                      <Textarea
                        placeholder="café, desayuno, La Habana"
                        value={keywords}
                        onChange={(e) => setKeywords(e.target.value)}
                        rows={2}
                        className="resize-none rounded-xl border-border bg-transparent text-sm focus:border-primary focus:ring-primary/20"
                      />
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Escribe palabras separadas por comas. Ejemplo: café, desayuno, La Habana. Cuantas más palabras agregues, más fácil será que otros usuarios te encuentren cuando busquen negocios como el tuyo.
                      </p>
                    </div>

                    {/* Public portal message */}
                    <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/10 px-4 py-3">
                      <Store className="w-4 h-4 text-primary shrink-0" />
                      <p className="text-xs text-foreground">
                        Gestiona tu negocio con Bivoo — inventario, punto de venta, empleados y más. Crear tu negocio es gratuito por tiempo ilimitado.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 animate-fade-in">
                    {/* No-business explanation */}
                    <div className="rounded-xl border border-border p-5 space-y-4">
                      <p className="text-sm text-foreground font-medium text-center">
                        Sin negocio también puedes disfrutar de Bivoo
                      </p>
                      <div className="space-y-3">
                        {[
                          { Icon: Heart, text: "Afiliarte a negocios locales y acumular puntos" },
                          { Icon: Gift, text: "Ver ofertas exclusivas de tus negocios favoritos" },
                          { Icon: ShoppingBag, text: "Hacer pedidos directamente desde los portales" },
                        ].map((item, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <item.Icon className="w-4 h-4 text-primary shrink-0" />
                            <p className="text-xs text-muted-foreground">{item.text}</p>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground text-center pt-1">
                        Puedes crear tu negocio en cualquier momento desde el hub.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Currency */}
            {step === "currency" && (
              <div className="w-full space-y-3">
                {currencies.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => setSelectedCurrency(c.code)}
                    className={cn(
                      "w-full flex items-center gap-4 rounded-xl border px-5 py-4 text-left transition-all duration-200",
                      selectedCurrency === c.code
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/30 hover:bg-muted/30",
                    )}
                  >
                    <span
                      className={cn(
                        "text-lg font-semibold w-8 text-center",
                        selectedCurrency === c.code ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {c.symbol}
                    </span>
                    <span className="text-sm font-medium text-foreground">{c.name}</span>
                    {selectedCurrency === c.code && (
                      <div className="shrink-0 ml-auto w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                ))}
                <p className="text-xs text-muted-foreground text-center pt-2">
                  Puedes activar doble moneda después con el plugin de Tasa de Cambio.
                </p>
              </div>
            )}

            {/* Checklist */}
            {step === "checklist" && (
              <div className="w-full space-y-4">
                {hasBusinessName ? (
                  <>
                    {[
                      { Icon: Package, text: "Agrega tu primer producto", sub: "Inventario" },
                      { Icon: ShoppingCart, text: "Realiza tu primera venta", sub: "Punto de Venta" },
                      { Icon: Users, text: "Agrega tu primer empleado", sub: "Recursos Humanos" },
                    ].map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-center gap-4 rounded-xl border border-border px-5 py-4"
                        style={{ animationDelay: `${i * 100}ms` }}
                      >
                        <item.Icon className="w-5 h-5 text-primary shrink-0" />
                        <div className="text-center">
                          <p className="text-sm font-medium text-foreground">{item.text}</p>
                          <p className="text-xs text-muted-foreground">{item.sub}</p>
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground text-center pt-4">
                      Plan gratuito activo. Prueba planes superiores por 7 días sin compromiso.
                    </p>
                  </>
                ) : (
                  <>
                    {[
                      { Icon: Heart, text: "Explora negocios locales", sub: "Afiliaciones" },
                      { Icon: Gift, text: "Descubre ofertas exclusivas", sub: "Portal público" },
                      { Icon: Store, text: "Crea tu negocio cuando quieras", sub: "Hub" },
                    ].map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-center gap-4 rounded-xl border border-border px-5 py-4"
                        style={{ animationDelay: `${i * 100}ms` }}
                      >
                        <item.Icon className="w-5 h-5 text-primary shrink-0" />
                        <div className="text-center">
                          <p className="text-sm font-medium text-foreground">{item.text}</p>
                          <p className="text-xs text-muted-foreground">{item.sub}</p>
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground text-center pt-4">
                      Puedes crear tu negocio en cualquier momento desde el hub.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-8 pb-4">
          <div className="flex items-center gap-3">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={goBack}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Atrás
              </button>
            )}
            {step === "business" && hasBusinessName && (
              <button
                type="button"
                onClick={handleSkip}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Omitir por ahora
              </button>
            )}
            {step === "business" && !hasBusinessName && (
              <button
                type="button"
                onClick={handleSkip}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Omitir por ahora
              </button>
            )}
          </div>

          {currentStep < steps.length - 1 ? (
            <Button onClick={goNext} disabled={!canNext()} className="rounded-full px-6 h-11 gap-2 text-sm font-medium">
              Continuar
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button onClick={handleFinish} disabled={saving} className="rounded-full px-8 h-11 text-sm font-medium">
              {saving ? "Guardando..." : "Empezar"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;
