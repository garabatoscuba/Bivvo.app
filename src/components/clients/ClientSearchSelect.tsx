import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Search, UserPlus, X, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ClientSearchSelectProps {
  businessId: string;
  branchId?: string | null;
  selectedClientId: string | null;
  onSelect: (clientId: string | null) => void;
  createdBy?: string;
}

export const ClientSearchSelect = ({
  businessId,
  branchId,
  selectedClientId,
  onSelect,
  createdBy,
}: ClientSearchSelectProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: results = [] } = useQuery({
    queryKey: ['client-search', businessId, search],
    queryFn: async () => {
      if (!search.trim() || search.trim().length < 2) return [];
      const term = `%${search.trim()}%`;
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, phone, email')
        .eq('business_id', businessId)
        .or(`name.ilike.${term},phone.ilike.${term}`)
        .limit(8);
      if (error) throw error;
      return data || [];
    },
    enabled: !!businessId && search.trim().length >= 2,
  });

  const { data: selectedClient } = useQuery({
    queryKey: ['client-selected', selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return null;
      const { data } = await supabase
        .from('customers')
        .select('id, name, phone')
        .eq('id', selectedClientId)
        .maybeSingle();
      return data;
    },
    enabled: !!selectedClientId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        business_id: businessId,
        name: newName.trim(),
        phone: newPhone.trim() || null,
        branch_id: branchId || null,
        created_by: createdBy || null,
      };
      const { data, error } = await supabase
        .from('customers')
        .insert(payload)
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['client-search'] });
      queryClient.invalidateQueries({ queryKey: ['clients-list'] });
      onSelect(data.id);
      setQuickCreateOpen(false);
      setNewName('');
      setNewPhone('');
      setSearch('');
      setOpen(false);
      toast({ title: 'Cliente creado' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  if (selectedClientId && selectedClient) {
    return (
      <div className="flex items-center gap-2 rounded-md border px-3 py-2">
        <User className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium flex-1 truncate">{selectedClient.name}</span>
        {selectedClient.phone && <span className="text-xs text-muted-foreground">{selectedClient.phone}</span>}
        <button onClick={() => onSelect(null)} className="p-0.5 rounded hover:bg-muted">
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Cliente (opcional)</Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Buscar por nombre o teléfono..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        {open && search.trim().length >= 2 && (
          <div className="rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
            {results.length === 0 ? (
              <div className="p-3 text-center">
                <p className="text-xs text-muted-foreground mb-2">No se encontró</p>
                <Button size="sm" variant="outline" onClick={() => { setQuickCreateOpen(true); setNewName(search.trim()); setOpen(false); }}>
                  <UserPlus className="h-3.5 w-3.5 mr-1" /> Crear cliente
                </Button>
              </div>
            ) : (
              <>
                {results.map((c: any) => (
                  <button
                    key={c.id}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted text-sm"
                    onClick={() => { onSelect(c.id); setOpen(false); setSearch(''); }}
                  >
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate flex-1">{c.name}</span>
                    {c.phone && <span className="text-xs text-muted-foreground shrink-0">{c.phone}</span>}
                  </button>
                ))}
                <div className="border-t p-2">
                  <Button size="sm" variant="ghost" className="w-full text-xs" onClick={() => { setQuickCreateOpen(true); setNewName(search.trim()); setOpen(false); }}>
                    <UserPlus className="h-3.5 w-3.5 mr-1" /> Crear nuevo cliente
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <Dialog open={quickCreateOpen} onOpenChange={setQuickCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nuevo cliente</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nombre *</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nombre del cliente" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Teléfono</Label>
              <Input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Opcional" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickCreateOpen(false)}>Cancelar</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!newName.trim() || createMutation.isPending}>
              {createMutation.isPending ? 'Creando...' : 'Crear y seleccionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
