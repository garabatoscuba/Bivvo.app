import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, Crown, MessageCircle, CalendarDays, Building2, DollarSign, Star, Send, Loader2, Clock, Tag } from 'lucide-react';
import { useSubscription, PlanType } from '@/hooks/useSubscription';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery } from '@tanstack/react-query';

const WHATSAPP_NUMBER = '5352514878';
const WHATSAPP_URL = (msg: string) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;

const PLAN_LABELS: Record<PlanType, string> = {
  free: 'Gratuito',
  professional: 'Profesional',
  enterprise: 'Enterprise',
};

const PRICE_PER_BRANCH: Record<PlanType, number> = {
  free: 0,
  professional: 10,
  enterprise: 20,
};

const DURATION_OPTIONS = [
  { value: '1', label: '1 mes', discount: 0 },
  { value: '3', label: '3 meses', discount: 0 },
  { value: '6', label: '6 meses', discount: 0 },
  { value: '12', label: '12 meses (anual)', discount: 10 },
];

const Plans = () => {
  const { status, daysLeft, planType, trialEndsAt, subscriptionEndsAt, totalBranches, totalMonthly } = useSubscription();
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [requestOpen, setRequestOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'professional' | 'enterprise'>('professional');
  const [selectedMonths, setSelectedMonths] = useState('1');
  const [manualCode, setManualCode] = useState(() => {
    return (profile as any)?.referral_code || sessionStorage.getItem('referral_code') || '';
  });

  // React Router search params for reactive updates
  const [searchParams, setSearchParams] = useSearchParams();

  // Auto-open purchase dialog when coming from banner with ?buy=true
  useEffect(() => {
    if (searchParams.get('buy') === 'true') {
      setSelectedPlan('professional');
      setSelectedMonths('1');
      setRequestOpen(true);
      // Clean up URL without full reload
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, planType, setSearchParams]);

  // Fetch the latest approved plan_request to show actual paid amount
  const { data: approvedRequest } = useQuery({
    queryKey: ['approved-plan-request', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('plan_requests')
        .select('*')
        .eq('user_id', user!.id)
        .eq('status', 'approved')
        .order('approved_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user && planType !== 'free',
  });

  // Fetch active offers applicable to this user
  const { data: activeOffers } = useQuery({
    queryKey: ['plan-offers-active', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('plan_offers')
        .select('*')
        .eq('is_active', true)
        .lte('starts_at', new Date().toISOString());
      // Filter: not expired and targets this user (or all)
      return (data || []).filter((o: any) => {
        if (o.expires_at && new Date(o.expires_at) < new Date()) return false;
        if (o.target_type === 'specific' && !o.target_user_ids?.includes(user?.id)) return false;
        return true;
      });
    },
    enabled: !!user,
  });

  // Fetch partner discount from profile referral_code or sessionStorage
  const { data: partnerOffer } = useQuery({
    queryKey: ['partner-offer', user?.id, manualCode],
    queryFn: async () => {
      const code = manualCode.trim();
      if (!code) return null;
      const { data } = await supabase
        .from('partners')
        .select('*')
        .eq('code', code.toUpperCase())
        .eq('is_active', true)
        .maybeSingle();
      if (!data) return null;
      if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
      return data;
    },
    enabled: !!user && manualCode.trim().length > 0,
  });

  // Find the best offer for the selected plan
  const bestOffer = activeOffers?.find((o: any) => o.applies_to_plans?.includes(selectedPlan));

  // Check if partner offer applies to selected plan
  const partnerApplies = partnerOffer && (partnerOffer.applies_to_plans as string[])?.includes(selectedPlan);

  const expirationDate = subscriptionEndsAt || trialEndsAt;

  const months = parseInt(selectedMonths);
  const durationOpt = DURATION_OPTIONS.find(d => d.value === selectedMonths)!;
  const pricePerBranch = PRICE_PER_BRANCH[selectedPlan];
  const branchCount = Math.max(1, totalBranches);
  const subtotal = pricePerBranch * branchCount * months;
  const durationDiscount = subtotal * (durationOpt.discount / 100);
  const afterDuration = subtotal - durationDiscount;

  // Apply offer discount on top
  let offerDiscount = 0;
  if (bestOffer) {
    if (bestOffer.discount_type === 'percentage') {
      offerDiscount = afterDuration * (Number(bestOffer.discount_value) / 100);
    } else {
      offerDiscount = Math.min(Number(bestOffer.discount_value), afterDuration);
    }
  }
  const afterOfferDiscount = afterDuration - offerDiscount;

  // Apply partner discount on top of offer discount
  let partnerDiscount = 0;
  if (partnerApplies && partnerOffer) {
    if (partnerOffer.discount_type === 'percentage') {
      partnerDiscount = afterOfferDiscount * (Number(partnerOffer.discount_value) / 100);
    } else {
      partnerDiscount = Math.min(Number(partnerOffer.discount_value), afterOfferDiscount);
    }
  }
  const requestTotal = afterOfferDiscount - partnerDiscount;

  // Trial activation
  const trialMutation = useMutation({
    mutationFn: async (plan: 'professional' | 'enterprise') => {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 7);
      const { error } = await supabase
        .from('profiles')
        .update({
          plan_type: plan,
          subscription_status: 'active',
          trial_ends_at: trialEnd.toISOString(),
        })
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Prueba activada', description: 'Tienes 7 días para probar todas las funciones.' });
      // Navigate to dashboard — the popup will show reactively
      window.location.href = '/';
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const requestMutation = useMutation({
    mutationFn: async () => {
      const insertData: any = {
        user_id: user!.id,
        plan_type: selectedPlan,
        months,
        price_per_branch: pricePerBranch,
        total_branches: branchCount,
        discount_percent: durationOpt.discount,
        total_amount: requestTotal,
      };
      if (partnerApplies && partnerOffer) {
        insertData.partner_id = partnerOffer.id;
      }
      const { error } = await supabase.from('plan_requests').insert(insertData);
      if (error) throw error;

      // Create partner_referrals entry so the partner sees the referred user
      if (partnerApplies && partnerOffer && user) {
        const commissionAmount = requestTotal * (Number(partnerOffer.commission_percent) / 100);
        // Use upsert to avoid duplicates if user re-requests
        await supabase.from('partner_referrals').upsert({
          partner_id: partnerOffer.id,
          referred_user_id: user.id,
          plan_type: selectedPlan,
          commission_earned: commissionAmount,
          commission_status: 'pending',
        }, { onConflict: 'partner_id,referred_user_id', ignoreDuplicates: false });
      }
    },
    onSuccess: () => {
      toast({ title: 'Solicitud enviada', description: 'Un administrador revisará tu solicitud pronto.' });
      setRequestOpen(false);
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const openRequest = (plan: 'professional' | 'enterprise') => {
    setSelectedPlan(plan);
    setSelectedMonths('1');
    setRequestOpen(true);
  };

  const freePlanFeatures = [
    'Inventario limitado (5 productos, 2 categorías)',
    'Punto de Venta (POS) completo',
    'Gráficas de desempeño',
    'Configuración inicial guiada del negocio',
    'Sin límite de tiempo',
  ];

  const professionalFeatures = [
    'Inventario ilimitado',
    'Punto de Venta (POS) completo',
    'Módulo de Clientes y Afiliación',
    'Módulo de negocio a elegir',
    'Gráficas de desempeño',
    'Soporte por WhatsApp',
  ];

  const enterpriseFeatures = [
    'Todo lo del Plan Profesional',
    'Contabilidad completa',
    'Portales públicos personalizables',
    'Enlace entre negocios',
    'Soporte prioritario',
  ];

  return (
    <AppLayout title="Planes y Precios">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Account summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Resumen de tu cuenta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs text-muted-foreground">Plan actual</p>
                <p className="mt-1 text-lg font-semibold">{PLAN_LABELS[planType]}</p>
                {status === 'trial' && <Badge variant="secondary" className="mt-1">Trial</Badge>}
              </div>

              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs text-muted-foreground">
                  {status === 'blocked' ? 'Estado' : planType === 'free' ? 'Estado' : 'Vence'}
                </p>
                {status === 'blocked' ? (
                  <p className="mt-1 text-lg font-semibold text-destructive">Expirado</p>
                ) : planType === 'free' ? (
                  <p className="mt-1 text-lg font-semibold text-green-600">Activo</p>
                ) : (
                  <div className="mt-1">
                    <p className="text-lg font-semibold">{daysLeft} día{daysLeft !== 1 ? 's' : ''}</p>
                    {expirationDate && (
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(expirationDate), "d 'de' MMM yyyy", { locale: es })}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> Sucursales totales
                </p>
                <p className="mt-1 text-lg font-semibold">{totalBranches}</p>
              </div>

              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-3 w-3" /> Total mensual
                </p>
                {planType === 'free' ? (
                  <p className="mt-1 text-lg font-semibold">$0</p>
                ) : approvedRequest && approvedRequest.months && Number(approvedRequest.total_amount) < totalMonthly * approvedRequest.months ? (
                  <>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-sm line-through text-muted-foreground">${totalMonthly}</span>
                      <span className="text-lg font-semibold text-green-600 dark:text-green-400">
                        ${(Number(approvedRequest.total_amount) / approvedRequest.months).toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 mt-0.5">
                      <Tag className="h-3 w-3" /> {approvedRequest.partner_id ? 'Descuento de partner aplicado' : 'Oferta aplicada'}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-lg font-semibold">${totalMonthly}</p>
                )}
                {planType !== 'free' && totalBranches > 1 && (
                  <p className="text-xs text-muted-foreground">
                    ${PRICE_PER_BRANCH[planType]} × {totalBranches} sucursales
                  </p>
                )}
              </div>
            </div>

            {(status === 'blocked' || status === 'expiring') && planType !== 'free' && (
              <div className="mt-4 flex justify-center">
                <Button className="gap-2" onClick={() => openRequest(planType === 'professional' || planType === 'enterprise' ? planType : 'professional')}>
                  <Send className="h-4 w-4" /> Renovar plan
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active offers banner */}
        {activeOffers && activeOffers.length > 0 && (
          <div className="space-y-2">
            {activeOffers.map((offer: any) => (
              <Card key={offer.id} className="border-primary/30 bg-primary/5">
                <CardContent className="flex items-center gap-3 py-3 px-4">
                  <Tag className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-primary">{offer.name}</p>
                    {offer.description && <p className="text-xs text-muted-foreground">{offer.description}</p>}
                  </div>
                  <Badge className="shrink-0">
                    {offer.discount_type === 'percentage' ? `${offer.discount_value}% OFF` : `$${Number(offer.discount_value).toFixed(2)} OFF`}
                  </Badge>
                  {offer.expires_at && (
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      Hasta {format(new Date(offer.expires_at), "d MMM", { locale: es })}
                    </span>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Partner discount banner */}
        {partnerOffer && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-center gap-3 py-3 px-4">
              <Tag className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-primary">
                  {partnerOffer.discount_type === 'percentage'
                    ? `${partnerOffer.discount_value}% de descuento con código ${partnerOffer.code}`
                    : `$${Number(partnerOffer.discount_value).toFixed(2)} USD de descuento con código ${partnerOffer.code}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  Aplica en planes: {(partnerOffer.applies_to_plans as string[]).join(', ')}
                </p>
              </div>
              {partnerOffer.expires_at && (
                <span className="text-[10px] text-muted-foreground shrink-0">
                  Hasta {format(new Date(partnerOffer.expires_at), "d MMM", { locale: es })}
                </span>
              )}
            </CardContent>
          </Card>
        )}

        {/* Referral code input */}
        <Card>
          <CardContent className="flex items-center gap-3 py-3 px-4">
            <Tag className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1 flex items-center gap-2">
              <label htmlFor="referral-code" className="text-sm font-medium whitespace-nowrap">Código de referido</label>
              <input
                id="referral-code"
                type="text"
                placeholder="Ej: BIVOO2026"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                className="flex h-9 w-full max-w-[200px] rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              {manualCode && !partnerOffer && (
                <span className="text-xs text-destructive whitespace-nowrap">Código no válido</span>
              )}
              {partnerOffer && (
                <Check className="h-4 w-4 text-green-600 shrink-0" />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Plan cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Free */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg">Plan Gratuito</CardTitle>
              <CardDescription>Para empezar sin compromiso</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <p className="text-3xl font-bold">$0</p>
              <p className="text-sm text-muted-foreground">Para siempre, sin tarjeta</p>
              <ul className="mt-4 space-y-2">
                {freePlanFeatures.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-600 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              {planType === 'free' ? (
                <Badge variant="outline" className="w-full justify-center py-2">Plan actual</Badge>
              ) : (
                <span className="w-full text-center text-xs text-muted-foreground">Siempre disponible</span>
              )}
            </CardFooter>
          </Card>

          {/* Professional */}
          <Card className={`flex flex-col relative ${planType === 'professional' && status !== 'blocked' ? 'border-primary' : 'border-primary'}`}>
            <div className="flex items-center justify-between px-4 pt-3">
              <Badge className="gap-1"><Star className="h-3 w-3" /> Popular</Badge>
              {status === 'trial' && planType === 'professional' && (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  <Clock className="h-3 w-3" /> PRUEBA
                </Badge>
              )}
            </div>
            <CardHeader className="pt-2">
              <CardTitle className="text-lg">Plan Profesional</CardTitle>
              <CardDescription>Inventario y clientes sin límites</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <p className="text-3xl font-bold">$10 <span className="text-sm font-normal text-muted-foreground">USD/mes/sucursal</span></p>
              <p className="text-sm text-muted-foreground">7 días gratis · Sin tarjeta</p>
              <ul className="mt-4 space-y-2">
                {professionalFeatures.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-600 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="flex-col gap-2">
              {planType === 'professional' && status !== 'blocked' ? (
                <Badge variant="outline" className="w-full justify-center py-2">Plan actual</Badge>
              ) : (
                <>
                  <Button className="w-full gap-2" onClick={() => openRequest('professional')}>
                    <Send className="h-4 w-4" /> Solicitar plan
                  </Button>
                  {planType === 'free' && (
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => trialMutation.mutate('professional')}
                      disabled={trialMutation.isPending}
                    >
                      {trialMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
                      Probar 7 días gratis
                    </Button>
                  )}
                </>
              )}
            </CardFooter>
          </Card>

          {/* Enterprise */}
          <Card className="flex flex-col relative">
            <div className="flex items-center justify-between px-4 pt-3">
              <Badge variant="secondary" className="gap-1"><Crown className="h-3 w-3" /> Pro</Badge>
              {status === 'trial' && planType === 'enterprise' && (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  <Clock className="h-3 w-3" /> PRUEBA
                </Badge>
              )}
            </div>
            <CardHeader className="pt-2">
              <CardTitle className="text-lg">Plan Enterprise</CardTitle>
              <CardDescription>Todo para escalar tu negocio</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <p className="text-3xl font-bold">$20 <span className="text-sm font-normal text-muted-foreground">USD/mes/sucursal</span></p>
              <p className="text-sm text-muted-foreground">En construcción · Disponible pronto</p>
              <ul className="mt-4 space-y-2">
                {enterpriseFeatures.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-600 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="flex-col gap-2">
              {planType === 'enterprise' && status !== 'blocked' ? (
                <Badge variant="outline" className="w-full justify-center py-2">Plan actual</Badge>
              ) : (
                <Badge variant="secondary" className="w-full justify-center py-2 text-muted-foreground">
                  🚧 Próximamente
                </Badge>
              )}
            </CardFooter>
          </Card>
        </div>

        {/* WhatsApp CTA */}
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
            <MessageCircle className="h-10 w-10" />
            <h3 className="text-xl font-semibold">¿Tienes dudas? Escríbenos</h3>
            <p className="text-sm opacity-90">Estamos disponibles por WhatsApp para ayudarte con tu plan, pagos o cualquier consulta.</p>
            <Button variant="secondary" asChild className="gap-2">
              <a href={WHATSAPP_URL('Hola, tengo una consulta sobre GestorPro')} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" /> Chatear por WhatsApp
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Plan Request Dialog */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Solicitar Plan {selectedPlan === 'basic' ? 'Básico' : 'Profesional'}</DialogTitle>
            <DialogDescription>Elige la duración y revisa el total antes de enviar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label htmlFor="plan-select" className="text-sm font-medium">Plan</label>
              <select
                id="plan-select"
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value as 'basic' | 'professional')}
                className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="basic">Básico ($10/mes/sucursal)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="duration-select" className="text-sm font-medium">Duración</label>
              <select
                id="duration-select"
                value={selectedMonths}
                onChange={(e) => setSelectedMonths(e.target.value)}
                className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                {DURATION_OPTIONS.map(d => (
                  <option key={d.value} value={d.value}>
                    {d.label}{d.discount > 0 ? ` — ${d.discount}% descuento` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Precio por sucursal</span>
                <span>${pricePerBranch}/mes</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Sucursales</span>
                <span>{branchCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Meses</span>
                <span>{months}</span>
              </div>
              {durationOpt.discount > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Descuento duración ({durationOpt.discount}%)</span>
                    <span>-${durationDiscount.toFixed(2)}</span>
                  </div>
                </>
              )}
              {bestOffer && offerDiscount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span className="flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    {bestOffer.name} ({bestOffer.discount_type === 'percentage' ? `${bestOffer.discount_value}%` : `$${Number(bestOffer.discount_value).toFixed(2)}`})
                  </span>
                  <span>-${offerDiscount.toFixed(2)}</span>
                </div>
              )}
              {partnerApplies && partnerOffer && partnerDiscount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span className="flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    Partner {partnerOffer.code} ({partnerOffer.discount_type === 'percentage' ? `${partnerOffer.discount_value}%` : `$${Number(partnerOffer.discount_value).toFixed(2)}`})
                  </span>
                  <span>-${partnerDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold border-t pt-2">
                <span>Total a pagar</span>
                <span>${requestTotal.toFixed(2)} USD</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => requestMutation.mutate()}
              disabled={requestMutation.isPending}
              className="gap-2"
            >
              {requestMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar solicitud
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Plans;
