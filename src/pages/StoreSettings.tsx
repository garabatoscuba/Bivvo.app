import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useStoreSettings, type WeekSchedule, type DaySchedule } from '@/hooks/useStoreSettings';
import { useAuth } from '@/contexts/AuthContext';
import { useBranches } from '@/hooks/useBranches';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Store, Truck, Clock, Save, Loader2, ExternalLink, Copy, Palette, Info, Globe,
  Megaphone, Plus, Trash2, Star, Eye, EyeOff, MessageSquare, Users,
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

const DAY_LABELS: Record<string, string> = {
  monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles', thursday: 'Jueves',
  friday: 'Viernes', saturday: 'Sábado', sunday: 'Domingo',
};
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

const StoreSettingsPage = () => {
  const { settings, isLoading, defaultSchedule, save, isSaving } = useStoreSettings();
  const { profile } = useAuth();
  const { data: branches = [] } = useBranches();
  const { toast: toastFn } = useToast();
  const queryClient = useQueryClient();

  const activeBranch = branches.find(b => b.id === profile?.branch_id);
  const branchId = profile?.branch_id;

  const { data: business } = useQuery({
    queryKey: ['my-business-slug', profile?.business_id],
    queryFn: async () => {
      const { data } = await supabase.from('businesses').select('slug').eq('id', profile!.business_id!).single();
      return data;
    },
    enabled: !!profile?.business_id,
  });

  const storeUrl = business?.slug && activeBranch?.slug
    ? `${window.location.origin}/tienda/${business.slug}/${activeBranch.slug}`
    : null;

  // Settings state
  const [isActive, setIsActive] = useState(false);
  const [hasDelivery, setHasDelivery] = useState(false);
  const [schedule, setSchedule] = useState<WeekSchedule>(defaultSchedule);
  const [accentColor, setAccentColor] = useState('#18181b');
  const [aboutText, setAboutText] = useState('');
  const [socialInstagram, setSocialInstagram] = useState('');
  const [socialFacebook, setSocialFacebook] = useState('');
  const [socialTiktok, setSocialTiktok] = useState('');
  const [socialTwitter, setSocialTwitter] = useState('');

  useEffect(() => {
    if (settings) {
      setIsActive(settings.is_active);
      setHasDelivery(settings.has_delivery);
      setSchedule(settings.schedule);
      setAccentColor(settings.accent_color || '#18181b');
      setAboutText(settings.about_text || '');
      setSocialInstagram(settings.social_instagram || '');
      setSocialFacebook(settings.social_facebook || '');
      setSocialTiktok(settings.social_tiktok || '');
      setSocialTwitter(settings.social_twitter || '');
    }
  }, [settings]);

  const updateDay = (day: string, field: keyof DaySchedule, value: any) => {
    setSchedule(prev => ({ ...prev, [day]: { ...prev[day as keyof WeekSchedule], [field]: value } }));
  };

  const handleSave = () => {
    save({
      is_active: isActive, has_delivery: hasDelivery, schedule, accent_color: accentColor,
      about_text: aboutText || null, social_instagram: socialInstagram || null,
      social_facebook: socialFacebook || null, social_tiktok: socialTiktok || null,
      social_twitter: socialTwitter || null,
    });
  };

  // Announcements
  const { data: announcements = [], isLoading: announcementsLoading } = useQuery({
    queryKey: ['announcements', branchId],
    queryFn: async () => {
      const { data } = await supabase
        .from('announcements')
        .select('*')
        .eq('branch_id', branchId!)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!branchId,
  });

  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnDesc, setNewAnnDesc] = useState('');
  const [newAnnBadge, setNewAnnBadge] = useState('Oferta');

  const createAnnouncementMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('announcements').insert({
        branch_id: branchId!,
        title: newAnnTitle.trim(),
        description: newAnnDesc.trim() || null,
        badge_text: newAnnBadge.trim() || 'Oferta',
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements', branchId] });
      setNewAnnTitle('');
      setNewAnnDesc('');
      setNewAnnBadge('Oferta');
      toastFn({ title: 'Anuncio creado' });
    },
    onError: (err: any) => toastFn({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const toggleAnnouncementMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('announcements').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['announcements', branchId] }),
  });

  const deleteAnnouncementMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements', branchId] });
      toastFn({ title: 'Anuncio eliminado' });
    },
  });

  // Reviews
  const { data: reviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: ['reviews-admin', branchId],
    queryFn: async () => {
      const { data } = await supabase
        .from('reviews')
        .select('id, rating, comment, is_visible, created_at, affiliate:affiliates(name, email, phone)')
        .eq('branch_id', branchId!)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!branchId,
  });

  const toggleReviewMutation = useMutation({
    mutationFn: async ({ id, is_visible }: { id: string; is_visible: boolean }) => {
      const { error } = await supabase.from('reviews').update({ is_visible }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews-admin', branchId] });
      toastFn({ title: 'Visibilidad actualizada' });
    },
  });

  // Affiliates
  const { data: affiliates = [], isLoading: affiliatesLoading } = useQuery({
    queryKey: ['affiliates-admin', branchId],
    queryFn: async () => {
      const { data } = await supabase
        .from('affiliates')
        .select('id, name, phone, email, points, created_at')
        .eq('branch_id', branchId!)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!branchId,
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Portal</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configura tu portal público para esta sucursal.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="general" className="max-w-2xl">
            <TabsList className="mb-6">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="announcements">Anuncios</TabsTrigger>
              <TabsTrigger value="reviews">Reseñas</TabsTrigger>
              <TabsTrigger value="affiliates">Clientes</TabsTrigger>
            </TabsList>

            {/* GENERAL TAB */}
            <TabsContent value="general" className="space-y-6">
              {storeUrl && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2"><ExternalLink className="h-4 w-4" /> Enlace de tu portal</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Input readOnly value={storeUrl} className="text-sm font-mono" />
                      <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(storeUrl); toastFn({ title: 'Enlace copiado' }); }}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" asChild>
                        <a href={storeUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Store className="h-4 w-4" /> General</CardTitle>
                  <CardDescription>Estado de tu portal y opciones de entrega.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Portal activo</Label>
                      <p className="text-xs text-muted-foreground">Los clientes podrán ver tu portal cuando esté activo.</p>
                    </div>
                    <Switch checked={isActive} onCheckedChange={setIsActive} />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" /> Delivery</Label>
                      <p className="text-xs text-muted-foreground">Indica si ofreces servicio de entrega a domicilio.</p>
                    </div>
                    <Switch checked={hasDelivery} onCheckedChange={setHasDelivery} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Horario de atención</CardTitle>
                  <CardDescription>Define el horario de apertura y cierre por día.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {DAYS.map(day => {
                    const d = schedule[day];
                    return (
                      <div key={day} className="flex items-center gap-3">
                        <Switch checked={d.enabled} onCheckedChange={(v) => updateDay(day, 'enabled', v)} className="shrink-0" />
                        <span className={`w-24 text-sm ${d.enabled ? 'font-medium' : 'text-muted-foreground'}`}>{DAY_LABELS[day]}</span>
                        {d.enabled ? (
                          <div className="flex items-center gap-2 flex-1">
                            <Input type="time" value={d.open || '08:00'} onChange={(e) => updateDay(day, 'open', e.target.value)} className="h-8 w-28 text-sm" />
                            <span className="text-xs text-muted-foreground">a</span>
                            <Input type="time" value={d.close || '18:00'} onChange={(e) => updateDay(day, 'close', e.target.value)} className="h-8 w-28 text-sm" />
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Cerrado</span>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Palette className="h-4 w-4" /> Apariencia</CardTitle>
                  <CardDescription>Personaliza el color de tu portal público.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <Label className="text-sm font-medium">Color de acento</Label>
                    <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-8 w-12 rounded border border-input cursor-pointer" />
                    <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="w-28 h-8 text-sm font-mono" maxLength={7} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Info className="h-4 w-4" /> Sobre nosotros</CardTitle>
                  <CardDescription>Texto que aparecerá en tu portal público.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea value={aboutText} onChange={(e) => setAboutText(e.target.value)} placeholder="Cuéntale a tus clientes sobre tu negocio..." rows={4} maxLength={500} />
                  <p className="text-xs text-muted-foreground mt-1.5">{aboutText.length}/500</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" /> Redes sociales</CardTitle>
                  <CardDescription>Añade los enlaces de tus redes para mostrarlos en el portal.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Instagram</Label>
                    <Input value={socialInstagram} onChange={(e) => setSocialInstagram(e.target.value)} placeholder="https://instagram.com/tu-negocio" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Facebook</Label>
                    <Input value={socialFacebook} onChange={(e) => setSocialFacebook(e.target.value)} placeholder="https://facebook.com/tu-negocio" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">TikTok</Label>
                    <Input value={socialTiktok} onChange={(e) => setSocialTiktok(e.target.value)} placeholder="https://tiktok.com/@tu-negocio" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">X / Twitter</Label>
                    <Input value={socialTwitter} onChange={(e) => setSocialTwitter(e.target.value)} placeholder="https://x.com/tu-negocio" className="h-8 text-sm" />
                  </div>
                </CardContent>
              </Card>

              <Button onClick={handleSave} disabled={isSaving} className="w-fit">
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Guardar configuración
              </Button>
            </TabsContent>

            {/* ANNOUNCEMENTS TAB */}
            <TabsContent value="announcements" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Megaphone className="h-4 w-4" /> Nuevo anuncio</CardTitle>
                  <CardDescription>Crea ofertas y anuncios que aparecerán en tu portal.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Título</Label>
                    <Input value={newAnnTitle} onChange={(e) => setNewAnnTitle(e.target.value)} placeholder="Ej: 2x1 en bebidas" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Descripción (opcional)</Label>
                    <Textarea value={newAnnDesc} onChange={(e) => setNewAnnDesc(e.target.value)} placeholder="Detalles de la oferta..." rows={2} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Etiqueta</Label>
                    <Input value={newAnnBadge} onChange={(e) => setNewAnnBadge(e.target.value)} placeholder="Oferta" className="h-8 text-sm w-40" />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => createAnnouncementMutation.mutate()}
                    disabled={!newAnnTitle.trim() || createAnnouncementMutation.isPending}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Crear anuncio
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Anuncios activos</CardTitle>
                </CardHeader>
                <CardContent>
                  {announcementsLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
                  ) : announcements.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No hay anuncios aún.</p>
                  ) : (
                    <div className="space-y-3">
                      {announcements.map((a: any) => (
                        <div key={a.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {a.badge_text && (
                                <span className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded">{a.badge_text}</span>
                              )}
                              <span className="text-sm font-medium truncate">{a.title}</span>
                            </div>
                            {a.description && <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Switch
                              checked={a.is_active}
                              onCheckedChange={(v) => toggleAnnouncementMutation.mutate({ id: a.id, is_active: v })}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => deleteAnnouncementMutation.mutate(a.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* REVIEWS TAB */}
            <TabsContent value="reviews" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Reseñas de clientes</CardTitle>
                  <CardDescription>Modera las reseñas que aparecen en tu portal. Ocultar una reseña no la elimina.</CardDescription>
                </CardHeader>
                <CardContent>
                  {reviewsLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
                  ) : reviews.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Aún no hay reseñas.</p>
                  ) : (
                    <div className="space-y-3">
                      {reviews.map((r: any) => (
                        <div key={r.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{r.affiliate?.name || 'Anónimo'}</span>
                              <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map(i => (
                                  <Star key={i} size={12} className={i <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'} />
                                ))}
                              </div>
                            </div>
                            {r.comment && <p className="text-xs text-muted-foreground mt-0.5">{r.comment}</p>}
                            <p className="text-[10px] text-muted-foreground/60 mt-1">
                              {new Date(r.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
                              {r.affiliate?.phone && ` · ${r.affiliate.phone}`}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => toggleReviewMutation.mutate({ id: r.id, is_visible: !r.is_visible })}
                            title={r.is_visible ? 'Ocultar del portal' : 'Mostrar en portal'}
                          >
                            {r.is_visible ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* AFFILIATES TAB */}
            <TabsContent value="affiliates" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Clientes afiliados</CardTitle>
                  <CardDescription>Clientes que se han registrado a través de tu portal público.</CardDescription>
                </CardHeader>
                <CardContent>
                  {affiliatesLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
                  ) : affiliates.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Aún no hay clientes afiliados.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Teléfono</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead className="text-right">Puntos</TableHead>
                            <TableHead>Fecha</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {affiliates.map((a: any) => (
                            <TableRow key={a.id}>
                              <TableCell className="font-medium">{a.name || <span className="text-muted-foreground italic">Sin nombre</span>}</TableCell>
                              <TableCell>{a.phone || <span className="text-muted-foreground">—</span>}</TableCell>
                              <TableCell>{a.email || <span className="text-muted-foreground">—</span>}</TableCell>
                              <TableCell className="text-right font-semibold">{a.points}</TableCell>
                              <TableCell className="text-muted-foreground text-xs">
                                {new Date(a.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
};

export default StoreSettingsPage;
