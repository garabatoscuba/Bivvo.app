import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useStoreSettings, type WeekSchedule, type DaySchedule } from '@/hooks/useStoreSettings';
import { useAuth } from '@/contexts/AuthContext';
import { useBranches } from '@/hooks/useBranches';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Store, Truck, Clock, Save, Loader2, ExternalLink, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const DAY_LABELS: Record<string, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

const StoreSettingsPage = () => {
  const { settings, isLoading, defaultSchedule, save, isSaving } = useStoreSettings();
  const { profile } = useAuth();
  const { data: branches = [] } = useBranches();
  const { toast: toastFn } = useToast();

  const activeBranch = branches.find(b => b.id === profile?.branch_id);

  const { data: business } = useQuery({
    queryKey: ['my-business-slug', profile?.business_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('businesses')
        .select('slug')
        .eq('id', profile!.business_id!)
        .single();
      return data;
    },
    enabled: !!profile?.business_id,
  });

  const storeUrl = business?.slug && activeBranch?.slug
    ? `${window.location.origin}/tienda/${business.slug}/${activeBranch.slug}`
    : null;

  const [isActive, setIsActive] = useState(false);
  const [hasDelivery, setHasDelivery] = useState(false);
  const [schedule, setSchedule] = useState<WeekSchedule>(defaultSchedule);

  useEffect(() => {
    if (settings) {
      setIsActive(settings.is_active);
      setHasDelivery(settings.has_delivery);
      setSchedule(settings.schedule);
    }
  }, [settings]);

  const updateDay = (day: string, field: keyof DaySchedule, value: any) => {
    setSchedule(prev => ({
      ...prev,
      [day]: { ...prev[day as keyof WeekSchedule], [field]: value },
    }));
  };

  const handleSave = () => {
    save({ is_active: isActive, has_delivery: hasDelivery, schedule });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configuración de Tienda</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configura tu portal de venta para esta sucursal.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-6 max-w-2xl">
            {/* Store URL */}
            {storeUrl && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" /> Enlace de tu tienda
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Input readOnly value={storeUrl} className="text-sm font-mono" />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(storeUrl);
                        toastFn({ title: 'Enlace copiado' });
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" asChild>
                      <a href={storeUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            {/* General toggles */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Store className="h-4 w-4" /> General
                </CardTitle>
                <CardDescription>Estado de tu tienda y opciones de entrega.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Tienda activa</Label>
                    <p className="text-xs text-muted-foreground">Los clientes podrán ver tu portal cuando esté activa.</p>
                  </div>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5" /> Delivery
                    </Label>
                    <p className="text-xs text-muted-foreground">Indica si ofreces servicio de entrega a domicilio.</p>
                  </div>
                  <Switch checked={hasDelivery} onCheckedChange={setHasDelivery} />
                </div>
              </CardContent>
            </Card>

            {/* Schedule */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Horario de atención
                </CardTitle>
                <CardDescription>Define el horario de apertura y cierre por día.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {DAYS.map(day => {
                  const d = schedule[day];
                  return (
                    <div key={day} className="flex items-center gap-3">
                      <Switch
                        checked={d.enabled}
                        onCheckedChange={(v) => updateDay(day, 'enabled', v)}
                        className="shrink-0"
                      />
                      <span className={`w-24 text-sm ${d.enabled ? 'font-medium' : 'text-muted-foreground'}`}>
                        {DAY_LABELS[day]}
                      </span>
                      {d.enabled ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            type="time"
                            value={d.open || '08:00'}
                            onChange={(e) => updateDay(day, 'open', e.target.value)}
                            className="h-8 w-28 text-sm"
                          />
                          <span className="text-xs text-muted-foreground">a</span>
                          <Input
                            type="time"
                            value={d.close || '18:00'}
                            onChange={(e) => updateDay(day, 'close', e.target.value)}
                            className="h-8 w-28 text-sm"
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Cerrado</span>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Button onClick={handleSave} disabled={isSaving} className="w-fit">
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Guardar configuración
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default StoreSettingsPage;
