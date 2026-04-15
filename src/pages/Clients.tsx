import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Search, Plus, User, Phone, Mail, Loader2, ArrowLeft, ShoppingCart, Wrench } from 'lucide-react';

const Clients = () => {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const businessId = profile?.business_id;
  const branchId = profile?.branch_id;

  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // Form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [editMode, setEditMode] = useState(false);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients-list', businessId, search],
    queryFn: async () => {
      let q = supabase
        .from('customers')
        .select('*')
        .eq('business_id', businessId!)
        .order('created_at', { ascending: false })
        .limit(100);
      if (search.trim()) {
        const term = `%${search.trim()}%`;
        q = q.or(`name.ilike.${term},phone.ilike.${term}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!businessId,
  });

  const selectedClient = clients.find((c: any) => c.id === selectedClientId);

  // Sales history
  const { data: clientSales = [], isLoading: loadingSales } = useQuery({
    queryKey: ['client-sales', selectedClientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('id, sale_number, total, payment_type, status, created_at')
        .eq('customer_id', selectedClientId!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedClientId,
  });

  // Service history
  const { data: clientServices = [], isLoading: loadingServices } = useQuery({
    queryKey: ['client-services', selectedClientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_entries')
        .select('id, amount, payment_type, description, created_at, service_categories(name)')
        .eq('customer_id', selectedClientId!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedClientId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        notes: notes.trim() || null,
      };
      if (editMode && selectedClientId) {
        const { error } = await supabase.from('customers').update(payload).eq('id', selectedClientId);
        if (error) throw error;
      } else {
        payload.business_id = businessId;
        payload.branch_id = branchId;
        payload.created_by = user?.id;
        const { error } = await supabase.from('customers').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients-list'] });
      toast({ title: editMode ? 'Cliente actualizado' : 'Cliente creado' });
      setCreateOpen(false);
      resetForm();
      if (editMode) setEditMode(false);
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const resetForm = () => { setName(''); setPhone(''); setEmail(''); setNotes(''); };

  const openEdit = (client: any) => {
    setName(client.name || '');
    setPhone(client.phone || '');
    setEmail(client.email || '');
    setNotes(client.notes || '');
    setEditMode(true);
    setCreateOpen(true);
  };

  const paymentLabels: Record<string, string> = {
    cash: 'Efectivo', transfer: 'Transferencia', card: 'Tarjeta', mixed: 'Mixto', credit: 'Crédito',
  };

  return (
    <AppLayout>
      <div className="p-3 md:p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Clientes</h1>
            <p className="text-xs text-muted-foreground">{clients.length} clientes registrados</p>
          </div>
          <Button size="sm" onClick={() => { resetForm(); setEditMode(false); setCreateOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Nuevo
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-muted-foreground">
            <User className="h-12 w-12 opacity-30 mb-3" />
            <p className="text-sm">{search ? 'No se encontraron clientes' : 'Aún no hay clientes registrados'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {clients.map((client: any) => (
              <button
                key={client.id}
                className="w-full flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedClientId(client.id)}
              >
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{client.name}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {client.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{client.phone}</span>}
                    {client.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{client.email}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Client Detail Sheet */}
      <Sheet open={!!selectedClientId} onOpenChange={(open) => { if (!open) setSelectedClientId(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {selectedClient && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" /> {selectedClient.name}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <Card>
                  <CardContent className="pt-4 space-y-2">
                    {selectedClient.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" /> {selectedClient.phone}
                      </div>
                    )}
                    {selectedClient.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" /> {selectedClient.email}
                      </div>
                    )}
                    {selectedClient.notes && (
                      <p className="text-sm text-muted-foreground">{selectedClient.notes}</p>
                    )}
                    <Button size="sm" variant="outline" onClick={() => openEdit(selectedClient)} className="mt-2">
                      Editar datos
                    </Button>
                  </CardContent>
                </Card>

                <Tabs defaultValue="ventas">
                  <TabsList className="w-full">
                    <TabsTrigger value="ventas" className="flex-1">
                      <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Ventas
                    </TabsTrigger>
                    <TabsTrigger value="servicios" className="flex-1">
                      <Wrench className="h-3.5 w-3.5 mr-1" /> Servicios
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="ventas" className="mt-3">
                    {loadingSales ? (
                      <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
                    ) : clientSales.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">Sin ventas registradas</p>
                    ) : (
                      <div className="space-y-2">
                        {clientSales.map((s: any) => (
                          <div key={s.id} className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                              <p className="text-sm font-medium">{s.sale_number}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Badge variant={s.status === 'cancelled' ? 'destructive' : 'secondary'} className="text-[10px]">
                                  {s.status === 'cancelled' ? 'Cancelada' : 'Completada'}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(s.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </span>
                              </div>
                            </div>
                            <span className="text-sm font-bold">${Number(s.total).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="servicios" className="mt-3">
                    {loadingServices ? (
                      <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
                    ) : clientServices.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">Sin servicios registrados</p>
                    ) : (
                      <div className="space-y-2">
                        {clientServices.map((s: any) => (
                          <div key={s.id} className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                              <p className="text-sm font-medium">{s.service_categories?.name || s.description || 'Servicio'}</p>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(s.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                            </div>
                            <span className="text-sm font-bold">${Number(s.amount).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Create/Edit Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editMode ? 'Editar cliente' : 'Nuevo cliente'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nombre *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del cliente" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Teléfono</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Opcional" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Opcional" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Notas</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional" rows={2} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!name.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? 'Guardando...' : editMode ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Clients;
