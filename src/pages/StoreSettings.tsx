import { useState, useEffect, useRef } from 'react';
import LoyaltyRewardsTab from '@/components/storefront/LoyaltyRewardsTab';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Store, Truck, Clock, Save, Loader2, ExternalLink, Copy, Palette, Info, Globe,
  Megaphone, Plus, Trash2, Star, Eye, EyeOff, MessageSquare, Users, ImageIcon, Type, Upload,
} from 'lucide-react';
import PromoBlocksConfig from '@/components/storefront/PromoBlocksConfig';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

const DAY_LABELS: Record<string, string> = {
  monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles', thursday: 'Jueves',
  friday: 'Viernes', saturday: 'Sábado', sunday: 'Domingo',
};
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

const HEADING_FONTS = [
  'Lora', 'Merriweather', 'Libre Baskerville', 'Libre Caslon Text',
  'Work Sans', 'DM Sans', 'Poppins', 'Inter',
];
const BODY_FONTS = [
  'Work Sans', 'DM Sans', 'Inter', 'Poppins', 'Open Sans', 'Roboto',
  'Lora', 'Merriweather',
];

const MAX_HERO_SIZE = 500 * 1024; // 500 KB

const StoreSettingsPage = () => {
  const { settings, isLoading, defaultSchedule, save, isSaving } = useStoreSettings();
  const { profile, isSuperAdmin } = useAuth();
  const { data: branches = [] } = useBranches();
  const { toast: toastFn } = useToast();
  const queryClient = useQueryClient();
  const heroInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const activeBranch = branches.find(b => b.id === profile?.branch_id);
  const branchId = profile?.branch_id;

  const { data: business } = useQuery({
    queryKey: ['my-business-details', profile?.business_id],
    queryFn: async () => {
      const { data } = await supabase.from('businesses').select('slug, name, logo_url').eq('id', profile!.business_id!).single();
      return data;
    },
    enabled: !!profile?.business_id,
  });

  const [logoUrl, setLogoUrl] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    if (business?.logo_url) setLogoUrl(business.logo_url);
  }, [business]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.business_id) return;
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toastFn({ title: 'Formato no válido', description: 'Solo JPG, PNG o WebP', variant: 'destructive' });
      return;
    }
    if (file.size > MAX_HERO_SIZE) {
      toastFn({ title: 'Imagen muy pesada', description: 'Máximo 500 KB', variant: 'destructive' });
      return;
    }
    setUploadingLogo(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `logo-${profile.business_id}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('product-images')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(path);
      const newUrl = urlData.publicUrl;
      await supabase.from('businesses').update({ logo_url: newUrl }).eq('id', profile.business_id!);
      setLogoUrl(newUrl);
      queryClient.invalidateQueries({ queryKey: ['my-business-details', profile.business_id] });
      toastFn({ title: 'Logo actualizado' });
    } catch (err: any) {
      toastFn({ title: 'Error al subir', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const storeUrl = business?.slug
    ? `https://bivoo.app/s/${business.slug}`
    : null;

  // Settings state
  const [isActive, setIsActive] = useState(false);
  const [hasDelivery, setHasDelivery] = useState(false);
  const [schedule, setSchedule] = useState<WeekSchedule>(defaultSchedule);
  const [accentColor, setAccentColor] = useState('#18181b');
  const [aboutText, setAboutText] = useState('');
  const [heroTitle, setHeroTitle] = useState('');
  const [heroSubtitle, setHeroSubtitle] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [fontHeading, setFontHeading] = useState('Lora');
  const [fontBody, setFontBody] = useState('Work Sans');
  const [socialInstagram, setSocialInstagram] = useState('');
  const [socialFacebook, setSocialFacebook] = useState('');
  const [socialTiktok, setSocialTiktok] = useState('');
  const [socialTwitter, setSocialTwitter] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [uploadingHero, setUploadingHero] = useState(false);

  useEffect(() => {
    if (settings) {
      setIsActive(settings.is_active);
      setHasDelivery(settings.has_delivery);
      setSchedule(settings.schedule);
      setAccentColor(settings.accent_color || '#18181b');
      setAboutText(settings.about_text || '');
      setHeroTitle(settings.hero_title || '');
      setHeroSubtitle(settings.hero_subtitle || '');
      setHeroImageUrl(settings.hero_image_url || '');
      setFontHeading(settings.font_heading || 'Lora');
      setFontBody(settings.font_body || 'Work Sans');
      setSocialInstagram(settings.social_instagram || '');
      setSocialFacebook(settings.social_facebook || '');
      setSocialTiktok(settings.social_tiktok || '');
      setSocialTwitter(settings.social_twitter || '');
      setContactEmail(settings.contact_email || '');
      setWhatsappNumber((settings as any).whatsapp_number || '');
    }
  }, [settings]);

  const updateDay = (day: string, field: keyof DaySchedule, value: any) => {
    setSchedule(prev => ({ ...prev, [day]: { ...prev[day as keyof WeekSchedule], [field]: value } }));
  };

  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !branchId) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toastFn({ title: 'Formato no válido', description: 'Solo JPG, PNG o WebP', variant: 'destructive' });
      return;
    }
    if (file.size > MAX_HERO_SIZE) {
      toastFn({ title: 'Imagen muy pesada', description: 'Máximo 500 KB', variant: 'destructive' });
      return;
    }

    setUploadingHero(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `hero-${branchId}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('product-images')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(path);
      setHeroImageUrl(urlData.publicUrl);
      toastFn({ title: 'Imagen subida' });
    } catch (err: any) {
      toastFn({ title: 'Error al subir', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingHero(false);
      if (heroInputRef.current) heroInputRef.current.value = '';
    }
  };

  const handleSave = () => {
    save({
      is_active: isActive, has_delivery: hasDelivery, schedule, accent_color: accentColor,
      about_text: aboutText || null,
      hero_title: heroTitle || null,
      hero_subtitle: heroSubtitle || null,
      hero_image_url: heroImageUrl || null,
      font_heading: fontHeading,
      font_body: fontBody,
      social_instagram: socialInstagram || null,
      social_facebook: socialFacebook || null, social_tiktok: socialTiktok || null,
      social_twitter: socialTwitter || null,
      contact_email: contactEmail || null,
      whatsapp_number: whatsappNumber.trim() || null,
    } as any);
  };

  // Announcements
  const { data: announcements = [], isLoading: announcementsLoading } = useQuery({
    queryKey: ['announcements', branchId],
    queryFn: async () => {
      const { data } = await supabase.from('announcements').select('*').eq('branch_id', branchId!)
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
        branch_id: branchId!, title: newAnnTitle.trim(),
        description: newAnnDesc.trim() || null, badge_text: newAnnBadge.trim() || 'Oferta',
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements', branchId] });
      setNewAnnTitle(''); setNewAnnDesc(''); setNewAnnBadge('Oferta');
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
      const { data } = await supabase.from('reviews')
        .select('id, rating, comment, is_visible, created_at, phone_number, product_name')
        .eq('branch_id', branchId!).order('created_at', { ascending: false });
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

  const deleteReviewMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reviews').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews-admin', branchId] });
      toastFn({ title: 'Reseña eliminada' });
    },
  });

  // Affiliates
  const { data: affiliates = [], isLoading: affiliatesLoading } = useQuery({
    queryKey: ['affiliates-admin', branchId],
    queryFn: async () => {
      const { data } = await supabase.from('affiliates')
        .select('id, name, phone, email, points, created_at')
        .eq('branch_id', branchId!).order('created_at', { ascending: false });
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
          <Tabs defaultValue="general" className="w-full max-w-2xl">
            <TabsList className="mb-6 flex-wrap h-auto gap-1">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="appearance">Personalización</TabsTrigger>
              {isSuperAdmin && <TabsTrigger value="loyalty">Fidelización</TabsTrigger>}
              {isSuperAdmin && <TabsTrigger value="announcements">Anuncios</TabsTrigger>}
              <TabsTrigger value="reviews">Reseñas</TabsTrigger>
              {isSuperAdmin && <TabsTrigger value="affiliates">Clientes</TabsTrigger>}
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

              {/* Logo del negocio */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Logo del negocio</CardTitle>
                  <CardDescription>Se mostrará en la barra de navegación de tu portal. Máx. 500 KB. Formatos: JPG, PNG, WebP. Recomendado: 256×256 px (cuadrado).</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    {logoUrl ? (
                      <div className="relative">
                        <img src={logoUrl} alt="Logo" className="h-16 w-16 rounded-xl object-cover border border-border" />
                        <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6" onClick={async () => {
                          await supabase.from('businesses').update({ logo_url: null }).eq('id', profile!.business_id!);
                          setLogoUrl('');
                          queryClient.invalidateQueries({ queryKey: ['my-business-details', profile?.business_id] });
                          toastFn({ title: 'Logo eliminado' });
                        }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="h-16 w-16 rounded-xl border-2 border-dashed border-border flex items-center justify-center text-muted-foreground">
                        <Store className="h-6 w-6" />
                      </div>
                    )}
                    <div>
                      <input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleLogoUpload} className="hidden" />
                      <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>
                        {uploadingLogo ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
                        {logoUrl ? 'Cambiar logo' : 'Subir logo'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Estudio Garabatos promo */}
              <GarabatosPromoCard />

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

              {/* Hero content */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Hero del portal</CardTitle>
                  <CardDescription>Imagen y textos principales que verán tus clientes al entrar.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Título principal</Label>
                    <Input value={heroTitle} onChange={(e) => setHeroTitle(e.target.value)} placeholder={activeBranch ? `Ej: ${activeBranch.name}` : 'Nombre de tu negocio'} className="h-9 text-sm" maxLength={80} />
                    <p className="text-[10px] text-muted-foreground mt-1">Si lo dejas vacío, se usará el nombre del negocio.</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Subtítulo</Label>
                    <Input value={heroSubtitle} onChange={(e) => setHeroSubtitle(e.target.value)} placeholder="Ej: Los mejores productos al mejor precio" className="h-9 text-sm" maxLength={120} />
                    <p className="text-[10px] text-muted-foreground mt-1">Si lo dejas vacío, se usará el nombre de la sucursal.</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Imagen de hero</Label>
                    <p className="text-[10px] text-muted-foreground mb-2">
                      Resolución recomendada: <strong>1920×1080 px</strong> (16:9) o <strong>1920×800 px</strong> (panorámica). Máx. <strong>500 KB</strong>. Formatos: JPG, PNG, WebP.
                    </p>
                    {heroImageUrl && (
                      <div className="relative mb-3 rounded-lg overflow-hidden border border-border">
                        <img src={heroImageUrl} alt="Hero preview" className="w-full h-40 object-cover" />
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2 h-7 text-xs"
                          onClick={() => setHeroImageUrl('')}
                        >
                          <Trash2 className="h-3 w-3 mr-1" /> Quitar
                        </Button>
                      </div>
                    )}
                    <input ref={heroInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleHeroUpload} className="hidden" />
                    <Button variant="outline" size="sm" onClick={() => heroInputRef.current?.click()} disabled={uploadingHero}>
                      {uploadingHero ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
                      Subir imagen
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <PromoBlocksConfig />

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Horario de atención</CardTitle>
                  <CardDescription>Define el horario de apertura y cierre por día.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {DAYS.map(day => {
                    const d = schedule[day];
                    return (
                      <div key={day} className="flex items-center gap-2 sm:gap-3">
                        <Switch checked={d.enabled} onCheckedChange={(v) => updateDay(day, 'enabled', v)} className="shrink-0" />
                        <span className={`w-16 sm:w-24 text-xs sm:text-sm ${d.enabled ? 'font-medium' : 'text-muted-foreground'}`}>{DAY_LABELS[day]}</span>
                        {d.enabled ? (
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-1">
                            <Input type="time" value={d.open || '08:00'} onChange={(e) => updateDay(day, 'open', e.target.value)} className="h-8 w-24 sm:w-28 text-xs sm:text-sm" />
                            <span className="text-xs text-muted-foreground">a</span>
                            <Input type="time" value={d.close || '18:00'} onChange={(e) => updateDay(day, 'close', e.target.value)} className="h-8 w-24 sm:w-28 text-xs sm:text-sm" />
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
                  <CardTitle className="text-base flex items-center gap-2"><Info className="h-4 w-4" /> Texto editorial</CardTitle>
                  <CardDescription>Texto destacado que aparecerá en el Home de tu portal.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea value={aboutText} onChange={(e) => setAboutText(e.target.value)} placeholder="Escribe un mensaje llamativo para tus clientes..." rows={4} maxLength={500} />
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
                  <div>
                    <Label className="text-xs text-muted-foreground">WhatsApp de contacto</Label>
                    <Input value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="+53 5XXXXXXX" className="h-8 text-sm" maxLength={20} />
                    <p className="text-[10px] text-muted-foreground mt-1">Opcional. Si lo configuras, aparecerá un botón de WhatsApp en la página de Contacto.</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Correo de contacto</CardTitle>
                  <CardDescription>Los clientes podrán enviarte mensajes desde el portal. Se recibirán como notificaciones.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div>
                    <Label className="text-xs text-muted-foreground">Email de contacto</Label>
                    <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="contacto@mi-negocio.com" className="h-8 text-sm" type="email" maxLength={255} />
                    <p className="text-[10px] text-muted-foreground mt-1">Si lo dejas vacío, el formulario de contacto no aparecerá en el portal.</p>
                  </div>
                </CardContent>
              </Card>

              <Button onClick={handleSave} disabled={isSaving} className="w-fit">
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Guardar configuración
              </Button>
            </TabsContent>

            {/* APPEARANCE TAB */}
            <TabsContent value="appearance" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Palette className="h-4 w-4" /> Color de acento</CardTitle>
                  <CardDescription>El color principal que usará tu portal público.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-8 w-12 rounded border border-input cursor-pointer" />
                    <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="w-28 h-8 text-sm font-mono" maxLength={7} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Type className="h-4 w-4" /> Tipografía</CardTitle>
                  <CardDescription>Elige las fuentes para títulos y texto general de tu portal.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Fuente de títulos</Label>
                    <Select value={fontHeading} onValueChange={setFontHeading}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HEADING_FONTS.map(f => (
                          <SelectItem key={f} value={f}>
                            <span style={{ fontFamily: `'${f}', serif` }}>{f}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground mt-1">Se usa para el hero, secciones y catálogo.</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Fuente del cuerpo</Label>
                    <Select value={fontBody} onValueChange={setFontBody}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BODY_FONTS.map(f => (
                          <SelectItem key={f} value={f}>
                            <span style={{ fontFamily: `'${f}', sans-serif` }}>{f}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground mt-1">Se usa para párrafos, botones y navegación.</p>
                  </div>
                  <Separator />
                  <div className="p-4 rounded-lg border border-border bg-card">
                    <p className="text-xs text-muted-foreground mb-2">Vista previa</p>
                    <h3 className="text-2xl font-bold tracking-tight" style={{ fontFamily: `'${fontHeading}', serif` }}>
                      Título de ejemplo
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1" style={{ fontFamily: `'${fontBody}', sans-serif` }}>
                      Este es un texto de ejemplo para ver cómo se ve la fuente del cuerpo en tu portal.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Button onClick={handleSave} disabled={isSaving} className="w-fit">
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Guardar personalización
              </Button>
            </TabsContent>

            {/* ANNOUNCEMENTS TAB */}
            {isSuperAdmin && <TabsContent value="announcements" className="space-y-6">
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
                            <Switch checked={a.is_active} onCheckedChange={(v) => toggleAnnouncementMutation.mutate({ id: a.id, is_active: v })} />
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteAnnouncementMutation.mutate(a.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>}

            {/* REVIEWS TAB */}
            <TabsContent value="reviews" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Reseñas de clientes</CardTitle>
                  <CardDescription>Las reseñas son privadas. Solo tú y tu equipo pueden verlas.</CardDescription>
                </CardHeader>
                <CardContent>
                  {reviewsLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
                  ) : reviews.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Aún no hay reseñas.</p>
                  ) : (
                    <div className="space-y-3">
                      {reviews.map((r: any) => {
                        const cleanPhone = r.phone_number?.replace(/[^0-9+]/g, '').replace(/^\+/, '');
                        return (
                          <div key={r.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {r.phone_number && (
                                  <a
                                    href={`https://wa.me/${cleanPhone}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-sm font-medium text-green-600 hover:text-green-700 hover:underline"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0">
                                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                    </svg>
                                    {r.phone_number}
                                  </a>
                                )}
                                {r.rating && r.rating > 0 && (
                                  <div className="flex gap-0.5">
                                    {[1, 2, 3, 4, 5].map(i => (
                                      <Star key={i} size={12} className={i <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'} />
                                    ))}
                                  </div>
                                )}
                              </div>
                              {r.product_name && (
                                <p className="text-xs text-primary/80 mt-0.5">Producto: {r.product_name}</p>
                              )}
                              {r.comment && <p className="text-xs text-muted-foreground mt-0.5">{r.comment}</p>}
                              <p className="text-[10px] text-muted-foreground/60 mt-1">
                                {new Date(r.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost" size="icon" className="h-8 w-8"
                                onClick={() => toggleReviewMutation.mutate({ id: r.id, is_visible: !r.is_visible })}
                                title={r.is_visible ? 'Ocultar' : 'Mostrar'}
                              >
                                {r.is_visible ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                              </Button>
                              <Button
                                variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => deleteReviewMutation.mutate(r.id)}
                                disabled={deleteReviewMutation.isPending}
                                title="Eliminar reseña"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* AFFILIATES TAB */}
            {isSuperAdmin && <TabsContent value="affiliates" className="space-y-6">
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
                    <div className="overflow-x-auto -mx-6">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead className="hidden sm:table-cell">Teléfono</TableHead>
                            <TableHead className="hidden sm:table-cell">Email</TableHead>
                            <TableHead className="text-right">Pts</TableHead>
                            <TableHead className="hidden sm:table-cell">Fecha</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {affiliates.map((a: any) => (
                            <TableRow key={a.id}>
                              <TableCell className="font-medium text-xs sm:text-sm">{a.name || <span className="text-muted-foreground italic">Sin nombre</span>}</TableCell>
                              <TableCell className="hidden sm:table-cell text-xs">{a.phone || '—'}</TableCell>
                              <TableCell className="hidden sm:table-cell text-xs">{a.email || '—'}</TableCell>
                              <TableCell className="text-right font-semibold text-xs sm:text-sm">{a.points}</TableCell>
                              <TableCell className="hidden sm:table-cell text-muted-foreground text-xs">
                                {new Date(a.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>}

            {/* LOYALTY TAB */}
            {isSuperAdmin && <TabsContent value="loyalty">
              <LoyaltyRewardsTab />
            </TabsContent>}
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
};

export default StoreSettingsPage;
