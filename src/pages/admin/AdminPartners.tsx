import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Network, Users, Plus, Pencil, DollarSign, Loader2, Search, CheckCircle, Clock } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface PartnerRow {
  id: string;
  user_id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  applies_to_plans: string[];
  user_limit: number | null;
  expires_at: string | null;
  commission_percent: number;
  commission_duration_months: number | null;
  is_active: boolean;
  created_at: string;
  user_email?: string;
  user_name?: string;
  referral_count?: number;
  total_earned?: number;
}

const AdminPartners = () => {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<PartnerRow | null>(null);
  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false);
  const [payoutPartnerId, setPayoutPartnerId] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutNote, setPayoutNote] = useState('');

  // Form state
  const [searchEmail, setSearchEmail] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedUserEmail, setSelectedUserEmail] = useState('');
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState('percentage');
  const [discountValue, setDiscountValue] = useState('10');
  const [appliesToPlans, setAppliesToPlans] = useState<string[]>(['basic']);
  const [userLimit, setUserLimit] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [commissionPercent, setCommissionPercent] = useState('10');
  const [commissionDuration, setCommissionDuration] = useState('');
  const [discountDuration, setDiscountDuration] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Referidos filter
  const [filterPartnerId, setFilterPartnerId] = useState('all');

  // Fetch partners with enriched data
  const { data: partners = [], isLoading } = useQuery({
    queryKey: ['admin-partners'],
    queryFn: async () => {
      const { data: partnerList } = await supabase
        .from('partners')
        .select('*')
        .order('created_at', { ascending: false });
      if (!partnerList?.length) return [];

      const userIds = partnerList.map(p => p.user_id);
      const partnerIds = partnerList.map(p => p.id);

      const [profilesRes, referralsRes] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, email').in('user_id', userIds),
        supabase.from('partner_referrals').select('partner_id, commission_earned').in('partner_id', partnerIds),
      ]);

      const profileMap = new Map((profilesRes.data || []).map(p => [p.user_id, p]));
      const referralsByPartner = new Map<string, { count: number; total: number }>();
      (referralsRes.data || []).forEach(r => {
        const existing = referralsByPartner.get(r.partner_id) || { count: 0, total: 0 };
        existing.count++;
        existing.total += Number(r.commission_earned);
        referralsByPartner.set(r.partner_id, existing);
      });

      return partnerList.map(p => ({
        ...p,
        user_email: profileMap.get(p.user_id)?.email || '',
        user_name: profileMap.get(p.user_id)?.full_name || '',
        referral_count: referralsByPartner.get(p.id)?.count || 0,
        total_earned: referralsByPartner.get(p.id)?.total || 0,
      })) as PartnerRow[];
    },
  });

  // Fetch all referrals for Referidos tab
  const { data: allReferrals = [] } = useQuery({
    queryKey: ['admin-partner-referrals'],
    queryFn: async () => {
      const { data } = await supabase
        .from('partner_referrals')
        .select('*')
        .order('used_at', { ascending: false });
      if (!data?.length) return [];

      const referredIds = data.map(r => r.referred_user_id);
      const partnerIds = [...new Set(data.map(r => r.partner_id))];

      const [profilesRes, partnersRes] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, email').in('user_id', referredIds),
        supabase.from('partners').select('id, code, user_id').in('id', partnerIds),
      ]);

      const profileMap = new Map((profilesRes.data || []).map(p => [p.user_id, p]));
      // Get partner user profiles
      const partnerUserIds = (partnersRes.data || []).map(p => p.user_id);
      const { data: partnerProfiles } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', partnerUserIds);
      const partnerProfileMap = new Map((partnerProfiles || []).map(p => [p.user_id, p]));
      const partnerMap = new Map((partnersRes.data || []).map(p => [p.id, { ...p, name: partnerProfileMap.get(p.user_id)?.full_name || partnerProfileMap.get(p.user_id)?.email || p.code }]));

      return data.map(r => ({
        ...r,
        referred_email: profileMap.get(r.referred_user_id)?.email || '',
        referred_name: profileMap.get(r.referred_user_id)?.full_name || '',
        partner_name: partnerMap.get(r.partner_id)?.name || '',
        partner_code: partnerMap.get(r.partner_id)?.code || '',
      }));
    },
  });

  // Search user by email
  const searchMutation = useMutation({
    mutationFn: async (email: string) => {
      const { data } = await supabase.from('profiles').select('user_id, full_name, email').ilike('email', `%${email}%`).limit(5);
      return data || [];
    },
  });

  const [searchResults, setSearchResults] = useState<any[]>([]);

  const handleSearch = async () => {
    if (!searchEmail.trim()) return;
    const results = await searchMutation.mutateAsync(searchEmail);
    setSearchResults(results);
  };

  const openCreate = () => {
    setEditingPartner(null);
    setSearchEmail('');
    setSelectedUserId('');
    setSelectedUserEmail('');
    setCode('');
    setDiscountType('percentage');
    setDiscountValue('10');
    setAppliesToPlans(['basic']);
    setUserLimit('');
    setExpiresAt('');
    setCommissionPercent('10');
    setCommissionDuration('');
    setDiscountDuration('');
    setIsActive(true);
    setSearchResults([]);
    setDialogOpen(true);
  };

  const openEdit = (p: PartnerRow) => {
    setEditingPartner(p);
    setSelectedUserId(p.user_id);
    setSelectedUserEmail(p.user_email || '');
    setCode(p.code);
    setDiscountType(p.discount_type);
    setDiscountValue(String(p.discount_value));
    setAppliesToPlans(p.applies_to_plans as string[]);
    setUserLimit(p.user_limit ? String(p.user_limit) : '');
    setExpiresAt(p.expires_at ? p.expires_at.split('T')[0] : '');
    setCommissionPercent(String(p.commission_percent));
    setCommissionDuration(p.commission_duration_months ? String(p.commission_duration_months) : '');
    setIsActive(p.is_active);
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        user_id: selectedUserId,
        code: code.trim().toUpperCase(),
        discount_type: discountType,
        discount_value: Number(discountValue),
        applies_to_plans: appliesToPlans,
        user_limit: userLimit ? Number(userLimit) : null,
        expires_at: expiresAt || null,
        commission_percent: Number(commissionPercent),
        commission_duration_months: commissionDuration ? Number(commissionDuration) : null,
        is_active: isActive,
      };

      if (editingPartner) {
        const { error } = await supabase.from('partners').update(payload).eq('id', editingPartner.id);
        if (error) throw error;
      } else {
        // Also assign partner role
        const { error } = await supabase.from('partners').insert(payload);
        if (error) throw error;
        const { error: roleError } = await supabase.from('user_roles').insert({ user_id: selectedUserId, role: 'partner' });
        if (roleError && !roleError.message.includes('duplicate')) throw roleError;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-partners'] });
      toast({ title: editingPartner ? 'Partner actualizado' : 'Partner creado' });
      setDialogOpen(false);
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const toggleActive = async (p: PartnerRow) => {
    await supabase.from('partners').update({ is_active: !p.is_active }).eq('id', p.id);
    qc.invalidateQueries({ queryKey: ['admin-partners'] });
  };

  const openPayout = (partnerId: string) => {
    setPayoutPartnerId(partnerId);
    setPayoutAmount('');
    setPayoutNote('');
    setPayoutDialogOpen(true);
  };

  const payoutMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('partner_payouts').insert({
        partner_id: payoutPartnerId,
        amount: Number(payoutAmount),
        note: payoutNote || null,
      });
      if (error) throw error;
      // Mark pending commissions as paid
      await supabase.from('partner_referrals')
        .update({ commission_status: 'paid' })
        .eq('partner_id', payoutPartnerId)
        .eq('commission_status', 'pending');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-partners'] });
      qc.invalidateQueries({ queryKey: ['admin-partner-referrals'] });
      toast({ title: 'Pago registrado' });
      setPayoutDialogOpen(false);
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const filteredReferrals = filterPartnerId === 'all'
    ? allReferrals
    : allReferrals.filter((r: any) => r.partner_id === filterPartnerId);

  if (isLoading) {
    return (
      <AppLayout title="Partners">
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Partners">
      <Tabs defaultValue="partners" className="space-y-4">
        <TabsList className="bg-muted/60">
          <TabsTrigger value="partners" className="gap-1.5 text-xs"><Network className="h-3.5 w-3.5" /> Partners</TabsTrigger>
          <TabsTrigger value="referrals" className="gap-1.5 text-xs"><Users className="h-3.5 w-3.5" /> Referidos</TabsTrigger>
        </TabsList>

        {/* PARTNERS TAB */}
        <TabsContent value="partners" className="space-y-4 mt-0">
          <div className="flex justify-end">
            <Button size="sm" className="gap-1.5" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" /> Nuevo Partner
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-left">
                      <th className="p-3 font-medium">Usuario</th>
                      <th className="p-3 font-medium">Código</th>
                      <th className="p-3 font-medium">Descuento</th>
                      <th className="p-3 font-medium text-center">Referidos</th>
                      <th className="p-3 font-medium text-right">Ganancias</th>
                      <th className="p-3 font-medium text-center">Estado</th>
                      <th className="p-3 font-medium text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {partners.length === 0 ? (
                      <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Sin partners registrados</td></tr>
                    ) : partners.map(p => (
                      <tr key={p.id}>
                        <td className="p-3">
                          <div>
                            <p className="font-medium truncate max-w-[180px]">{p.user_name || p.user_email}</p>
                            {p.user_name && <p className="text-xs text-muted-foreground truncate">{p.user_email}</p>}
                          </div>
                        </td>
                        <td className="p-3"><code className="bg-muted px-2 py-0.5 rounded text-xs font-bold">{p.code}</code></td>
                        <td className="p-3 text-xs">
                          {p.discount_type === 'percentage' ? `${p.discount_value}%` : `$${Number(p.discount_value).toFixed(2)}`}
                        </td>
                        <td className="p-3 text-center">{p.referral_count}</td>
                        <td className="p-3 text-right font-medium">${(p.total_earned || 0).toFixed(2)}</td>
                        <td className="p-3 text-center">
                          <Badge
                            variant={p.is_active ? 'default' : 'secondary'}
                            className="text-xs cursor-pointer"
                            onClick={() => toggleActive(p)}
                          >
                            {p.is_active ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)} title="Editar">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openPayout(p.id)} title="Registrar pago">
                              <DollarSign className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* REFERIDOS TAB */}
        <TabsContent value="referrals" className="space-y-4 mt-0">
          <div className="flex items-center gap-2">
            <Label className="text-xs shrink-0">Filtrar por partner:</Label>
            <Select value={filterPartnerId} onValueChange={setFilterPartnerId}>
              <SelectTrigger className="w-[200px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {partners.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.user_name || p.code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-left">
                      <th className="p-3 font-medium">Partner</th>
                      <th className="p-3 font-medium">Referido</th>
                      <th className="p-3 font-medium">Plan</th>
                      <th className="p-3 font-medium">Fecha</th>
                      <th className="p-3 font-medium text-right">Comisión</th>
                      <th className="p-3 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredReferrals.length === 0 ? (
                      <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Sin referidos</td></tr>
                    ) : filteredReferrals.map((r: any) => (
                      <tr key={r.id}>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{r.partner_code}</code>
                            <span className="text-xs text-muted-foreground truncate max-w-[120px]">{r.partner_name}</span>
                          </div>
                        </td>
                        <td className="p-3 truncate max-w-[180px]">{r.referred_name || r.referred_email}</td>
                        <td className="p-3"><Badge variant="outline" className="text-xs">{r.plan_type || '-'}</Badge></td>
                        <td className="p-3 text-muted-foreground text-xs">{format(new Date(r.used_at), "d MMM yyyy", { locale: es })}</td>
                        <td className="p-3 text-right font-medium">${Number(r.commission_earned).toFixed(2)}</td>
                        <td className="p-3">
                          {r.commission_status === 'paid' ? (
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs gap-1">
                              <CheckCircle className="h-3 w-3" /> Pagada
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs gap-1">
                              <Clock className="h-3 w-3" /> Pendiente
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Partner Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPartner ? 'Editar Partner' : 'Nuevo Partner'}</DialogTitle>
            <DialogDescription>
              {editingPartner ? 'Modifica las condiciones del partner.' : 'Busca un usuario y asígnale código y condiciones.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* User search (only for create) */}
            {!editingPartner && (
              <div className="space-y-2">
                <Label className="text-sm">Buscar usuario por email</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="email@ejemplo.com"
                    value={searchEmail}
                    onChange={e => setSearchEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Button size="sm" variant="outline" onClick={handleSearch} disabled={searchMutation.isPending}>
                    <Search className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {searchResults.length > 0 && (
                  <div className="border rounded-md divide-y max-h-32 overflow-y-auto">
                    {searchResults.map((u: any) => (
                      <button
                        key={u.user_id}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${selectedUserId === u.user_id ? 'bg-primary/10' : ''}`}
                        onClick={() => { setSelectedUserId(u.user_id); setSelectedUserEmail(u.email); }}
                      >
                        <p className="font-medium">{u.full_name || u.email}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </button>
                    ))}
                  </div>
                )}
                {selectedUserEmail && (
                  <p className="text-xs text-muted-foreground">Seleccionado: <span className="font-medium">{selectedUserEmail}</span></p>
                )}
              </div>
            )}

            {editingPartner && (
              <p className="text-sm text-muted-foreground">Usuario: <span className="font-medium">{selectedUserEmail}</span></p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Código</Label>
                <Input value={code} onChange={e => setCode(e.target.value)} placeholder="PARTNER2025" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Tipo descuento</Label>
                <Select value={discountType} onValueChange={setDiscountType}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Porcentaje</SelectItem>
                    <SelectItem value="fixed">Fijo ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Valor descuento</Label>
                <Input type="number" value={discountValue} onChange={e => setDiscountValue(e.target.value)} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-sm">Aplica a planes</Label>
                <div className="flex items-center gap-4 mt-1">
                  {[
                    { value: 'free', label: 'Gratuito' },
                    { value: 'basic', label: 'Básico' },
                    { value: 'professional', label: 'Profesional' },
                  ].map(plan => (
                    <label key={plan.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <Checkbox
                        checked={appliesToPlans.includes(plan.value)}
                        onCheckedChange={(checked) => {
                          setAppliesToPlans(prev =>
                            checked
                              ? [...prev, plan.value]
                              : prev.filter(p => p !== plan.value)
                          );
                        }}
                      />
                      {plan.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Límite usuarios</Label>
                <Input type="number" value={userLimit} onChange={e => setUserLimit(e.target.value)} placeholder="Ilimitado" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Vence</Label>
                <Input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">% Comisión</Label>
                <Input type="number" value={commissionPercent} onChange={e => setCommissionPercent(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Meses comisión</Label>
                <Input type="number" value={commissionDuration} onChange={e => setCommissionDuration(e.target.value)} placeholder="Indefinido" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label className="text-sm">Activo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || (!editingPartner && !selectedUserId) || !code.trim()}
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editingPartner ? 'Guardar' : 'Crear Partner'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payout Dialog */}
      <Dialog open={payoutDialogOpen} onOpenChange={setPayoutDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
            <DialogDescription>Este pago marcará todas las comisiones pendientes como pagadas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Monto ($)</Label>
              <Input type="number" value={payoutAmount} onChange={e => setPayoutAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Nota (opcional)</Label>
              <Input value={payoutNote} onChange={e => setPayoutNote(e.target.value)} placeholder="Transferencia bancaria..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayoutDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => payoutMutation.mutate()}
              disabled={payoutMutation.isPending || !payoutAmount || Number(payoutAmount) <= 0}
            >
              {payoutMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Registrar pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default AdminPartners;
