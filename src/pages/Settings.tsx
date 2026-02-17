import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor, User, Palette, Building2, Shield, Loader2, Save, Eye, EyeOff } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const Settings = () => {
  const { profile, user, isOwner, isManager } = useAuth();

  return (
    <AppLayout title="Configuración">
      <div className="mx-auto max-w-3xl space-y-6">
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile" className="gap-1.5 text-xs sm:text-sm">
              <User className="h-4 w-4" /> Perfil
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-1.5 text-xs sm:text-sm">
              <Palette className="h-4 w-4" /> Apariencia
            </TabsTrigger>
            <TabsTrigger value="business" className="gap-1.5 text-xs sm:text-sm">
              <Building2 className="h-4 w-4" /> Negocio
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-1.5 text-xs sm:text-sm">
              <Shield className="h-4 w-4" /> Seguridad
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <ProfileSection profile={profile} userId={user?.id} />
          </TabsContent>
          <TabsContent value="appearance">
            <AppearanceSection />
          </TabsContent>
          <TabsContent value="business">
            <BusinessSection profile={profile} canEdit={isOwner || isManager} />
          </TabsContent>
          <TabsContent value="security">
            <SecuritySection />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

// ── Profile Section ──
function ProfileSection({ profile, userId }: { profile: any; userId?: string }) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
    }
  }, [profile]);

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, phone: phone || null })
      .eq('user_id', userId);
    setSaving(false);
    if (error) {
      toast.error('Error al guardar los cambios');
    } else {
      toast.success('Perfil actualizado');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Perfil de Usuario</CardTitle>
        <CardDescription>Administra tu información personal.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">Nombre completo</Label>
          <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={profile?.email || ''} disabled className="opacity-60" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Teléfono</Label>
          <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+591 ..." />
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar cambios
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Appearance Section ──
function AppearanceSection() {
  const { theme, setTheme } = useTheme();

  const options = [
    { value: 'light', label: 'Claro', icon: Sun, description: 'Interfaz con fondo claro' },
    { value: 'dark', label: 'Oscuro', icon: Moon, description: 'Interfaz con fondo oscuro' },
    { value: 'system', label: 'Sistema', icon: Monitor, description: 'Sigue la preferencia del sistema' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Apariencia</CardTitle>
        <CardDescription>Personaliza el aspecto visual de la aplicación.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          {options.map(opt => {
            const Icon = opt.icon;
            const active = theme === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={`flex flex-col items-center gap-2 rounded-md border-2 p-4 transition-colors ${
                  active
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/30'
                }`}
              >
                <Icon className={`h-6 w-6 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className={`text-sm font-medium ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {opt.label}
                </span>
                <span className="text-xs text-muted-foreground text-center">{opt.description}</span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Business Section ──
function BusinessSection({ profile, canEdit }: { profile: any; canEdit: boolean }) {
  const [businessName, setBusinessName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.business_id) {
      supabase
        .from('businesses')
        .select('name, logo_url')
        .eq('id', profile.business_id)
        .single()
        .then(({ data }) => {
          if (data) {
            setBusinessName(data.name);
            setLogoUrl(data.logo_url);
          }
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [profile?.business_id]);

  const handleSave = async () => {
    if (!profile?.business_id || !canEdit) return;
    setSaving(true);
    const { error } = await supabase
      .from('businesses')
      .update({ name: businessName })
      .eq('id', profile.business_id);
    setSaving(false);
    if (error) {
      toast.error('Error al guardar');
    } else {
      toast.success('Negocio actualizado');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!canEdit) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Negocio</CardTitle>
          <CardDescription>Solo los dueños o gerentes pueden editar esta sección.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre del negocio</Label>
            <Input value={businessName} disabled className="opacity-60" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Negocio</CardTitle>
        <CardDescription>Configuración de tu negocio.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {logoUrl && (
          <div className="flex items-center gap-4">
            <img src={logoUrl} alt="Logo" className="h-16 w-16 rounded-md border object-cover" />
            <span className="text-sm text-muted-foreground">Logo actual</span>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="businessName">Nombre del negocio</Label>
          <Input id="businessName" value={businessName} onChange={e => setBusinessName(e.target.value)} />
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar cambios
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Security Section ──
function SecuritySection() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (error) {
      toast.error('Error al cambiar la contraseña');
    } else {
      toast.success('Contraseña actualizada');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Seguridad</CardTitle>
        <CardDescription>Cambia tu contraseña de acceso.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="newPassword">Nueva contraseña</Label>
          <div className="relative">
            <Input
              id="newPassword"
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Repite la contraseña"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <Button onClick={handleChangePassword} disabled={saving || !newPassword} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
          Cambiar contraseña
        </Button>
      </CardContent>
    </Card>
  );
}

export default Settings;
