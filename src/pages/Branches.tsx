import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBranches } from '@/hooks/useBranches';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Building2, Plus, Pencil, CheckCircle2, MapPin, Phone, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import type { Branch } from '@/types/database';

const Branches = () => {
  const { profile, isOwner, isManager, switchBranch } = useAuth();
  const { data: branches = [], isLoading } = useBranches();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const canManage = isOwner || isManager;

  const openCreate = () => {
    setEditing(null);
    setName('');
    setAddress('');
    setPhone('');
    setDialogOpen(true);
  };

  const openEdit = (branch: Branch) => {
    setEditing(branch);
    setName(branch.name);
    setAddress(branch.address || '');
    setPhone(branch.phone || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    if (!profile?.business_id) return;

    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from('branches')
          .update({ name: name.trim(), address: address.trim() || null, phone: phone.trim() || null })
          .eq('id', editing.id);
        if (error) throw error;
        toast.success('Sucursal actualizada');
        queryClient.invalidateQueries({ queryKey: ['branches'] });
        setDialogOpen(false);
      } else {
        // New branches require admin approval
        const { error } = await supabase
          .from('business_requests')
          .insert({
            user_id: profile.user_id,
            request_type: 'branch',
            branch_business_id: profile.business_id,
            branch_name: name.trim(),
            status: 'pending',
            is_free: false,
          });
        if (error) throw error;
        toast.success('Solicitud enviada', {
          description:
            'La creación de sucursales adicionales requiere aprobación de la administración. Te notificaremos cuando esté lista.',
          duration: 8000,
        });
        setDialogOpen(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleSelect = async (branchId: string) => {
    try {
      await switchBranch(branchId);
      queryClient.invalidateQueries();
      toast.success('Sucursal activa cambiada');
    } catch {
      toast.error('Error al cambiar de sucursal');
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sucursales</h1>
            <p className="text-muted-foreground text-sm">Gestiona las sucursales de tu negocio</p>
          </div>
          {canManage && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Sucursal
            </Button>
          )}
        </div>

        {canManage && (
          <div className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
            <span>Crear una sucursal adicional requiere aprobación de la administración e incrementará el costo de tu plan.</span>
          </div>
        )}

        {isLoading ? (
          <p className="text-muted-foreground">Cargando...</p>
        ) : branches.length === 0 ? (
          <p className="text-muted-foreground">No hay sucursales registradas.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {branches.map((branch) => {
              const isActive = profile?.branch_id === branch.id;
              return (
                <Card
                  key={branch.id}
                  className={`relative transition-colors ${isActive ? 'border-primary ring-1 ring-primary/30' : ''}`}
                >
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
                        <h3 className="font-semibold leading-tight">{branch.name}</h3>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        {branch.is_main && <Badge variant="secondary">Principal</Badge>}
                        {isActive && <Badge className="bg-primary text-primary-foreground">Activa</Badge>}
                      </div>
                    </div>

                    {branch.address && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span>{branch.address}</span>
                      </div>
                    )}
                    {branch.phone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span>{branch.phone}</span>
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      {!isActive && (
                        <Button size="sm" onClick={() => handleSelect(branch.id)}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Seleccionar
                        </Button>
                      )}
                      {canManage && (
                        <Button size="sm" variant="outline" onClick={() => openEdit(branch)}>
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          Editar
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Sucursal' : 'Nueva Sucursal'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Actualiza los datos de la sucursal.'
                : 'Tu solicitud será revisada por la administración antes de crear la sucursal.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="branch-name">Nombre *</Label>
              <Input id="branch-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Sucursal Centro" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch-address">Dirección</Label>
              <Input id="branch-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Ej: Av. Principal #123" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch-phone">Teléfono</Label>
              <Input id="branch-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ej: 555-1234" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Enviando...' : editing ? 'Guardar cambios' : 'Enviar solicitud'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Branches;
