import { useState, useEffect } from 'react';
import { User, Shield, Loader2, Save, Eye, EyeOff, Database } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import JornadaQR from '@/components/employees/JornadaQR';
import DataManagement from '@/components/settings/DataManagement';

const Settings = () => {
  const { profile, user, isOwner, isManager } = useAuth();
  const showDataTab = isOwner;
  const cols = showDataTab ? 3 : 2;

  return (
    <AppLayout title="Configuración">
      <div className="mx-auto max-w-3xl space-y-6">
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className={`grid w-full`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            <TabsTrigger value="profile" className="gap-1.5 text-xs sm:text-sm">
              <User className="h-4 w-4" /> Perfil
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-1.5 text-xs sm:text-sm">
              <Shield className="h-4 w-4" /> Seguridad
            </TabsTrigger>
            {showDataTab && (
              <TabsTrigger value="data" className="gap-1.5 text-xs sm:text-sm">
                <Database className="h-4 w-4" /> Datos
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="profile">
            <ProfileSection profile={profile} userId={user?.id} />
          </TabsContent>
          <TabsContent value="security">
            <SecuritySection />
          </TabsContent>
          {showDataTab && (
            <TabsContent value="data">
              <DataManagement />
            </TabsContent>
          )}
        </Tabs>

        {/* QR de Jornada - solo owner/manager */}
        {(isOwner || isManager) && <JornadaQR />}
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
      const msg = error.message?.includes('same')
        ? 'La nueva contraseña debe ser diferente a la actual'
        : error.message || 'Error al cambiar la contraseña';
      toast.error(msg);
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
