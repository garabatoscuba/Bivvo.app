import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Gift, Plus, Trash2, Save, Loader2, Star, Percent, ShoppingBag } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PREDEFINED_REWARDS = [
  { name: 'Descuento 5%', reward_type: 'discount_percent', config: { percent: 5 }, points_cost: 50 },
  { name: 'Descuento 10%', reward_type: 'discount_percent', config: { percent: 10 }, points_cost: 100 },
  { name: 'Descuento 15%', reward_type: 'discount_percent', config: { percent: 15 }, points_cost: 150 },
  { name: 'Producto gratis', reward_type: 'free_product', config: {}, points_cost: 200 },
];

const LoyaltyRewardsTab = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const businessId = profile?.business_id;

  // Loyalty config
  const { data: loyaltyConfig, isLoading: configLoading } = useQuery({
    queryKey: ['loyalty-config', businessId],
    queryFn: async () => {
      if (!businessId) return null;
      const { data } = await (supabase.from('loyalty_config' as any).select('*').eq('business_id', businessId).maybeSingle() as any);
      return data;
    },
    enabled: !!businessId,
  });

  const [ptsWelcome, setPtsWelcome] = useState<number>(loyaltyConfig?.points_welcome ?? 10);
  const [ptsName, setPtsName] = useState<number>(loyaltyConfig?.points_name ?? 10);
  const [ptsPhone, setPtsPhone] = useState<number>(loyaltyConfig?.points_phone ?? 10);
  const [ptsEmail, setPtsEmail] = useState<number>(loyaltyConfig?.points_email ?? 10);

  // Sync when data loads
  const configLoaded = !!loyaltyConfig;
  useState;

  const saveLoyaltyMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        business_id: businessId!,
        points_welcome: ptsWelcome,
        points_name: ptsName,
        points_phone: ptsPhone,
        points_email: ptsEmail,
      };
      if (loyaltyConfig) {
        await (supabase.from('loyalty_config' as any).update(payload).eq('id', loyaltyConfig.id) as any);
      } else {
        await (supabase.from('loyalty_config' as any).insert(payload) as any);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loyalty-config'] });
      toast({ title: 'Puntos configurados' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // Rewards
  const { data: rewards = [], isLoading: rewardsLoading } = useQuery({
    queryKey: ['rewards', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data } = await (supabase.from('rewards' as any).select('*').eq('business_id', businessId).order('sort_order') as any);
      return data || [];
    },
    enabled: !!businessId,
  });

  const [newName, setNewName] = useState('');
  const [newPoints, setNewPoints] = useState('100');
  const [newType, setNewType] = useState('custom');

  const addRewardMutation = useMutation({
    mutationFn: async (reward: { name: string; points_cost: number; reward_type: string; config: any }) => {
      await (supabase.from('rewards' as any).insert({
        business_id: businessId!,
        ...reward,
        sort_order: rewards.length,
      }) as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rewards'] });
      setNewName('');
      setNewPoints('100');
      toast({ title: 'Recompensa creada' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const toggleRewardMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      await (supabase.from('rewards' as any).update({ is_active }).eq('id', id) as any);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rewards'] }),
  });

  const deleteRewardMutation = useMutation({
    mutationFn: async (id: string) => {
      await (supabase.from('rewards' as any).delete().eq('id', id) as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rewards'] });
      toast({ title: 'Recompensa eliminada' });
    },
  });

  const addPredefined = (preset: typeof PREDEFINED_REWARDS[0]) => {
    addRewardMutation.mutate(preset);
  };

  const getRewardIcon = (type: string) => {
    switch (type) {
      case 'discount_percent': return <Percent className="h-3.5 w-3.5" />;
      case 'free_product': return <ShoppingBag className="h-3.5 w-3.5" />;
      default: return <Gift className="h-3.5 w-3.5" />;
    }
  };

  if (configLoading) {
    return <div className="py-8 text-center text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Points configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Star className="h-4 w-4" /> Puntos por acción</CardTitle>
          <CardDescription>Define cuántos puntos gana el cliente por cada acción.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Bienvenida (al afiliarse)</Label>
              <Input type="number" min={0} value={ptsWelcome} onChange={e => setPtsWelcome(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Completar nombre</Label>
              <Input type="number" min={0} value={ptsName} onChange={e => setPtsName(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Completar teléfono</Label>
              <Input type="number" min={0} value={ptsPhone} onChange={e => setPtsPhone(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Completar email</Label>
              <Input type="number" min={0} value={ptsEmail} onChange={e => setPtsEmail(Number(e.target.value))} />
            </div>
          </div>
          <Button size="sm" onClick={() => saveLoyaltyMutation.mutate()} disabled={saveLoyaltyMutation.isPending}>
            <Save className="h-3.5 w-3.5 mr-1.5" /> Guardar puntos
          </Button>
        </CardContent>
      </Card>

      {/* Predefined rewards */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Gift className="h-4 w-4" /> Recompensas predefinidas</CardTitle>
          <CardDescription>Agrega recompensas comunes con un clic.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {PREDEFINED_REWARDS.map((preset, i) => (
              <Button
                key={i}
                variant="outline"
                size="sm"
                onClick={() => addPredefined(preset)}
                disabled={addRewardMutation.isPending}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> {preset.name} ({preset.points_cost} pts)
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Custom reward */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" /> Recompensa personalizada</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Nombre de la recompensa"
              className="flex-1"
              maxLength={100}
            />
            <Input
              type="number"
              min={1}
              value={newPoints}
              onChange={e => setNewPoints(e.target.value)}
              placeholder="Puntos"
              className="w-24"
            />
          </div>
          <Button
            size="sm"
            onClick={() => {
              if (!newName.trim()) return;
              addRewardMutation.mutate({
                name: newName.trim(),
                points_cost: Number(newPoints) || 100,
                reward_type: 'custom',
                config: {},
              });
            }}
            disabled={!newName.trim() || addRewardMutation.isPending}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
          </Button>
        </CardContent>
      </Card>

      {/* Active rewards list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recompensas activas</CardTitle>
        </CardHeader>
        <CardContent>
          {rewards.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No hay recompensas configuradas</p>
          ) : (
            <div className="space-y-2">
              {rewards.map((reward: any) => (
                <div key={reward.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      {getRewardIcon(reward.reward_type)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{reward.name}</p>
                      <Badge variant="secondary" className="text-[10px]">{reward.points_cost} pts</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={reward.is_active}
                      onCheckedChange={(checked) => toggleRewardMutation.mutate({ id: reward.id, is_active: checked })}
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteRewardMutation.mutate(reward.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LoyaltyRewardsTab;
