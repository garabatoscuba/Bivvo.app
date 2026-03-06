import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Copy, DollarSign, Users, Clock, CheckCircle, Network, Loader2, Link } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const PartnerDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: partner, isLoading } = useQuery({
    queryKey: ['my-partner', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('partners')
        .select('*')
        .eq('user_id', user!.id)
        .eq('is_active', true)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: referrals = [] } = useQuery({
    queryKey: ['my-referrals', partner?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('partner_referrals')
        .select('*')
        .eq('partner_id', partner!.id)
        .order('used_at', { ascending: false });
      // Fetch referred user emails
      if (!data?.length) return [];
      const userIds = data.map(r => r.referred_user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);
      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
      return data.map(r => ({
        ...r,
        referred_name: profileMap.get(r.referred_user_id)?.full_name || profileMap.get(r.referred_user_id)?.email || 'Usuario',
      }));
    },
    enabled: !!partner?.id,
  });

  const { data: payouts = [] } = useQuery({
    queryKey: ['my-payouts', partner?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('partner_payouts')
        .select('*')
        .eq('partner_id', partner!.id)
        .order('paid_at', { ascending: false });
      return data || [];
    },
    enabled: !!partner?.id,
  });

  const totalEarned = referrals.reduce((sum, r) => sum + Number(r.commission_earned), 0);
  const pendingAmount = referrals.filter(r => r.commission_status === 'pending').reduce((sum, r) => sum + Number(r.commission_earned), 0);
  const totalPaid = payouts.reduce((sum, p) => sum + Number(p.amount), 0);

  const referralLink = partner?.code ? `${window.location.origin}/auth?ref=${partner.code}` : '';

  const copyCode = () => {
    if (partner?.code) {
      navigator.clipboard.writeText(partner.code);
      toast({ title: 'Código copiado', description: partner.code });
    }
  };

  const copyLink = () => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink);
      toast({ title: 'Link copiado', description: 'Comparte este link para que se registren con tu código.' });
    }
  };

  if (isLoading) {
    return (
      <AppLayout title="Mi Red">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!partner) {
    return (
      <AppLayout title="Mi Red">
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <Network className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">No tienes un código de partner activo.</p>
          <p className="text-sm text-muted-foreground/60">Contacta al administrador para obtener uno.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Mi Red">
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Code section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Network className="h-4 w-4" /> Tu Código de Partner
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <code className="text-2xl font-bold tracking-wider bg-muted px-4 py-2 rounded-lg">
                {partner.code}
              </code>
              <Button variant="outline" size="icon" onClick={copyCode} title="Copiar código">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Link className="h-4 w-4 text-muted-foreground shrink-0" />
              <code className="text-xs bg-muted px-3 py-1.5 rounded-lg truncate max-w-[300px]">
                {referralLink}
              </code>
              <Button variant="outline" size="icon" onClick={copyLink} title="Copiar link">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">
                {partner.discount_type === 'percentage' ? `${partner.discount_value}% descuento` : `$${Number(partner.discount_value).toFixed(2)} descuento`}
              </Badge>
              <Badge variant="outline">
                Planes: {(partner.applies_to_plans as string[]).join(', ')}
              </Badge>
              {partner.expires_at && (
                <Badge variant="outline">
                  Válido hasta {format(new Date(partner.expires_at), "d MMM yyyy", { locale: es })}
                </Badge>
              )}
              {partner.user_limit && (
                <Badge variant="outline">
                  Límite: {referrals.length}/{partner.user_limit} referidos
                </Badge>
              )}
              <Badge variant="outline">
                Comisión: {partner.commission_percent}%
                {partner.commission_duration_months ? ` por ${partner.commission_duration_months} meses` : ' indefinida'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Earnings summary */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                <span className="text-xs font-medium">Ganancias acumuladas</span>
              </div>
              <p className="text-2xl font-bold">${totalEarned.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="text-xs font-medium">Pendiente de cobro</span>
              </div>
              <p className="text-2xl font-bold">${pendingAmount.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                <span className="text-xs font-medium">Total referidos</span>
              </div>
              <p className="text-2xl font-bold">{referrals.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Referrals list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Referidos</CardTitle>
          </CardHeader>
          <CardContent>
            {referrals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Aún no tienes referidos.</p>
                <p className="text-xs mt-1">¡Comparte tu código para empezar a ganar!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-left">
                      <th className="pb-2 font-medium">Usuario</th>
                      <th className="pb-2 font-medium">Plan</th>
                      <th className="pb-2 font-medium">Fecha</th>
                      <th className="pb-2 font-medium text-right">Comisión</th>
                      <th className="pb-2 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {referrals.map((r: any) => (
                      <tr key={r.id}>
                        <td className="py-2">{r.referred_name}</td>
                        <td className="py-2">
                          <Badge variant="outline" className="text-xs">{r.plan_type || '-'}</Badge>
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {format(new Date(r.used_at), "d MMM yyyy", { locale: es })}
                        </td>
                        <td className="py-2 text-right font-medium">${Number(r.commission_earned).toFixed(2)}</td>
                        <td className="py-2">
                          {r.commission_status === 'paid' ? (
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" /> Pagada
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" /> Pendiente
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payouts history */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historial de Pagos</CardTitle>
          </CardHeader>
          <CardContent>
            {payouts.length === 0 ? (
              <p className="text-center py-6 text-sm text-muted-foreground">Sin pagos registrados.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-left">
                      <th className="pb-2 font-medium">Fecha</th>
                      <th className="pb-2 font-medium text-right">Monto</th>
                      <th className="pb-2 font-medium">Nota</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {payouts.map((p: any) => (
                      <tr key={p.id}>
                        <td className="py-2 text-muted-foreground">
                          {format(new Date(p.paid_at), "d MMM yyyy", { locale: es })}
                        </td>
                        <td className="py-2 text-right font-medium">${Number(p.amount).toFixed(2)}</td>
                        <td className="py-2 text-muted-foreground">{p.note || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default PartnerDashboard;
