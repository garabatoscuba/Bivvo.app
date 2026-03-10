import { useState, useMemo, useCallback } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import BusinessDetailSheet from '@/components/admin/BusinessDetailSheet';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
// Tabs removed — solicitudes moved to /admin/requests
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Store, Search, Loader2, Building2, Settings, Trash2, Check, X,
  Pencil, MapPin, ArrowUp, ArrowDown, ArrowUpDown, Ban, CheckCircle2,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type SortDir = 'asc' | 'desc';

const SortHead = ({ label, sortKey: sk, currentKey, currentDir, onToggle, className }: {
  label: string; sortKey: string; currentKey: string; currentDir: SortDir;
  onToggle: (k: any) => void; className?: string;
}) => (
  <TableHead
    className={`cursor-pointer select-none hover:text-foreground text-[11px] uppercase tracking-wide ${className || ''}`}
    onClick={() => onToggle(sk)}
  >
    <span className="inline-flex items-center gap-1">
      {label}
      {currentKey === sk
        ? (currentDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
        : <ArrowUpDown className="h-3 w-3 opacity-30" />
      }
    </span>
  </TableHead>
);

function useSortToggle<K extends string>(defaultKey: K) {
  const [key, setKey] = useState<K>(defaultKey);
  const [dir, setDir] = useState<SortDir>('desc');
  const toggle = useCallback((k: K) => {
    setKey(prev => {
      if (prev === k) { setDir(d => d === 'asc' ? 'desc' : 'asc'); return k; }
      setDir('desc'); return k;
    });
  }, []);
  return { key, dir, toggle } as const;
}

function sortData<T>(arr: T[], key: string, dir: SortDir, numericKeys: string[] = [], dateKeys: string[] = []): T[] {
  return [...arr].sort((a: any, b: any) => {
    let va: any, vb: any;
    if (dateKeys.includes(key)) { va = new Date(a[key]).getTime(); vb = new Date(b[key]).getTime(); }
    else if (numericKeys.includes(key)) { va = Number(a[key] || 0); vb = Number(b[key] || 0); }
    else { va = (a[key] || '').toString().toLowerCase(); vb = (b[key] || '').toString().toLowerCase(); }
    if (va < vb) return dir === 'asc' ? -1 : 1;
    if (va > vb) return dir === 'asc' ? 1 : -1;
    return 0;
  });
}

const FilterBar = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">{children}</div>
);

const SearchInput = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
  <div className="relative flex-1 max-w-xs">
    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    <Input placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="pl-8 h-9 text-sm" />
  </div>
);

const ResultCount = ({ count, label = 'resultado' }: { count: number; label?: string }) => (
  <span className="text-xs text-muted-foreground ml-auto">{count} {label}{count !== 1 ? 's' : ''}</span>
);

const AdminBusinesses = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [editBiz, setEditBiz] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('');
  const [editBranches, setEditBranches] = useState<any[]>([]);
  const [deleteBranchTarget, setDeleteBranchTarget] = useState<{ id: string; name: string } | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'deactivate' | 'delete' | null>(null);
  const [bulkConfirmText, setBulkConfirmText] = useState('');
  const [detailBizId, setDetailBizId] = useState<string | null>(null);

  // Business filters
  const [bizSearch, setBizSearch] = useState('');
  const [bizFilterStatus, setBizFilterStatus] = useState('all');
  const [bizFilterPlan, setBizFilterPlan] = useState('all');
  const bizSort = useSortToggle<string>('created_at');

  // (Plan/biz request filters removed — moved to AdminRequests)
  const { data, isLoading } = useQuery({
    queryKey: ['admin-businesses-page'],
    queryFn: async () => {
      const [businesses, profiles, products, branches] = await Promise.all([
        supabase.from('businesses').select('*, is_active').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name, email, business_id, user_id, plan_type'),
        supabase.from('products').select('id, business_id'),
        supabase.from('branches').select('id, business_id, name, is_main, address, phone'),
      ]);

      const allProfiles = profiles.data || [];
      const allProducts = products.data || [];
      const allBranches = branches.data || [];

      const enriched = (businesses.data || []).map(b => {
        const owner = allProfiles.find(p => p.id === (b.owner_id ?? ''));
        return {
          ...b,
          owner_name: owner?.full_name || 'Sin dueño',
          owner_email: owner?.email || '',
          owner_plan: owner?.plan_type || 'free',
          branch_count: allBranches.filter(br => br.business_id === b.id).length,
          product_count: allProducts.filter(p => p.business_id === b.id).length,
        };
      });

      return { businesses: enriched };
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('businesses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-businesses-page'] }); toast({ title: 'Negocio eliminado' }); setDeleteTarget(null); },
    onError: (err: any) => { toast({ title: 'Error', description: err.message, variant: 'destructive' }); setDeleteTarget(null); },
  });

  // Bulk mutations
  const bulkMutation = useMutation({
    mutationFn: async ({ ids, action }: { ids: string[]; action: 'deactivate' | 'delete' }) => {
      let success = 0;
      let failed = 0;
      for (const id of ids) {
        try {
          if (action === 'deactivate') {
            const { error } = await supabase.from('businesses').update({ is_active: false } as any).eq('id', id);
            if (error) { failed++; continue; }
          } else {
            const { error } = await supabase.from('businesses').delete().eq('id', id);
            if (error) { failed++; continue; }
          }
          success++;
        } catch {
          failed++;
        }
      }
      return { success, failed, action };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-businesses-page'] });
      const label = result.action === 'deactivate' ? 'desactivados' : 'eliminados';
      let msg = `${result.success} negocios ${label}`;
      if (result.failed > 0) msg += `, ${result.failed} fallaron`;
      toast({ title: 'Acción masiva completada', description: msg });
      setSelectedIds(new Set());
      setBulkAction(null);
      setBulkConfirmText('');
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      setBulkAction(null);
      setBulkConfirmText('');
    },
  });

  const openEditBiz = async (biz: any) => {
    setEditBiz(biz);
    setEditName(biz.name);
    setEditType(biz.business_type || 'store');
    const { data: branchData } = await supabase.from('branches').select('*').eq('business_id', biz.id).order('is_main', { ascending: false }).order('name');
    setEditBranches(branchData || []);
  };

  const updateBizMutation = useMutation({
    mutationFn: async ({ id, name, business_type, is_active }: { id: string; name: string; business_type: string; is_active: boolean }) => {
      const { error } = await supabase.from('businesses').update({ name, business_type, is_active } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-businesses-page'] }); toast({ title: 'Negocio actualizado' }); setEditBiz(null); },
    onError: (err: any) => { toast({ title: 'Error', description: err.message, variant: 'destructive' }); },
  });

  const deleteBranchMutation = useMutation({
    mutationFn: async (branchId: string) => {
      const { error } = await supabase.from('branches').delete().eq('id', branchId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-businesses-page'] });
      setEditBranches(prev => prev.filter(b => b.id !== deleteBranchTarget?.id));
      toast({ title: 'Sucursal eliminada' }); setDeleteBranchTarget(null);
    },
    onError: (err: any) => { toast({ title: 'Error', description: err.message, variant: 'destructive' }); setDeleteBranchTarget(null); },
  });

  const getPlanLabel = (plan: string | null) => {
    if (plan === 'professional') return 'Profesional';
    if (plan === 'basic') return 'Básico';
    return 'Gratuito';
  };

  const filteredBiz = useMemo(() => {
    let list = data?.businesses || [];
    const q = bizSearch.toLowerCase().trim();
    if (q) list = list.filter(b => b.name.toLowerCase().includes(q) || b.owner_name.toLowerCase().includes(q) || b.owner_email.toLowerCase().includes(q));
    if (bizFilterStatus !== 'all') list = list.filter(b => bizFilterStatus === 'active' ? b.is_active !== false : b.is_active === false);
    if (bizFilterPlan !== 'all') list = list.filter(b => b.owner_plan === bizFilterPlan);
    return sortData(list, bizSort.key, bizSort.dir, ['branch_count', 'product_count'], ['created_at']);
  }, [data?.businesses, bizSearch, bizFilterStatus, bizFilterPlan, bizSort.key, bizSort.dir]);

  // Selection helpers
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allChecked = filteredBiz.length > 0 && selectedIds.size === filteredBiz.length;
  const someChecked = selectedIds.size > 0 && selectedIds.size < filteredBiz.length;

  const toggleSelectAll = () => {
    if (allChecked) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredBiz.map(b => b.id)));
    }
  };

  const handleBulkConfirm = () => {
    const ids = Array.from(selectedIds);
    if (bulkAction === 'deactivate' || bulkAction === 'delete') {
      bulkMutation.mutate({ ids, action: bulkAction });
    }
  };

  if (isLoading) {
    return (
      <AppLayout title="Negocios">
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Negocios">
      <div className="space-y-6 pb-20">
        <div className="space-y-4">
            <FilterBar>
              <SearchInput value={bizSearch} onChange={setBizSearch} placeholder="Buscar negocio, dueño..." />
              <Select value={bizFilterStatus} onValueChange={setBizFilterStatus}>
                <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Estado: Todos</SelectItem>
                  <SelectItem value="active">Activos</SelectItem>
                  <SelectItem value="inactive">Inactivos</SelectItem>
                </SelectContent>
              </Select>
              <Select value={bizFilterPlan} onValueChange={setBizFilterPlan}>
                <SelectTrigger className="w-[150px] h-9 text-sm"><SelectValue placeholder="Plan" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Plan: Todos</SelectItem>
                  <SelectItem value="free">Gratuito</SelectItem>
                  <SelectItem value="basic">Básico</SelectItem>
                  <SelectItem value="professional">Profesional</SelectItem>
                </SelectContent>
              </Select>
              <ResultCount count={filteredBiz.length} />
            </FilterBar>
            <Card className="border-border/60">
              <CardContent className="p-0">
                {filteredBiz.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-10">
                            <Checkbox
                              checked={allChecked}
                              onCheckedChange={toggleSelectAll}
                              className={someChecked ? 'data-[state=unchecked]:bg-primary/20' : ''}
                            />
                          </TableHead>
                          <SortHead label="Negocio" sortKey="name" currentKey={bizSort.key} currentDir={bizSort.dir} onToggle={bizSort.toggle} />
                          <SortHead label="Dueño" sortKey="owner_name" currentKey={bizSort.key} currentDir={bizSort.dir} onToggle={bizSort.toggle} />
                          <SortHead label="Plan" sortKey="owner_plan" currentKey={bizSort.key} currentDir={bizSort.dir} onToggle={bizSort.toggle} />
                          <SortHead label="Estado" sortKey="is_active" currentKey={bizSort.key} currentDir={bizSort.dir} onToggle={bizSort.toggle} className="text-center" />
                          <SortHead label="Suc." sortKey="branch_count" currentKey={bizSort.key} currentDir={bizSort.dir} onToggle={bizSort.toggle} className="text-center" />
                          <SortHead label="Prod." sortKey="product_count" currentKey={bizSort.key} currentDir={bizSort.dir} onToggle={bizSort.toggle} className="text-center" />
                          <SortHead label="Fecha" sortKey="created_at" currentKey={bizSort.key} currentDir={bizSort.dir} onToggle={bizSort.toggle} />
                          <TableHead className="text-[11px] uppercase tracking-wide text-right">Acción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredBiz.map((b) => (
                          <TableRow key={b.id} className={`cursor-pointer ${selectedIds.has(b.id) ? 'bg-primary/5' : ''}`} onClick={() => setDetailBizId(b.id)}>
                            <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedIds.has(b.id)}
                                onCheckedChange={() => toggleSelect(b.id)}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="text-sm font-medium">{b.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm">{b.owner_name}</p>
                              <p className="text-[11px] text-muted-foreground">{b.owner_email}</p>
                            </TableCell>
                            <TableCell><Badge variant="outline" className="text-[11px]">{getPlanLabel(b.owner_plan)}</Badge></TableCell>
                            <TableCell className="text-center">
                              <Badge variant={b.is_active !== false ? 'default' : 'secondary'} className="text-[11px]">
                                {b.is_active !== false ? 'Activo' : 'Inactivo'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center text-sm">{b.branch_count}</TableCell>
                            <TableCell className="text-center text-sm">{b.product_count}</TableCell>
                            <TableCell className="text-[11px] text-muted-foreground">{format(new Date(b.created_at), "d MMM yy", { locale: es })}</TableCell>
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditBiz(b)}><Pencil className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget({ id: b.id, name: b.name })}><Trash2 className="h-3.5 w-3.5" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="py-12 text-center text-sm text-muted-foreground">No se encontraron negocios</div>
                )}
              </CardContent>
            </Card>
        </div>

        {/* Floating bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border bg-background px-4 py-3 shadow-lg">
            <span className="text-sm font-medium">
              <CheckCircle2 className="inline h-4 w-4 mr-1.5 text-primary" />
              {selectedIds.size} negocio{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}
            </span>
            <div className="h-5 w-px bg-border" />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setBulkAction('deactivate')}
              disabled={bulkMutation.isPending}
            >
              <Ban className="h-3.5 w-3.5" />
              Desactivar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={() => { setBulkAction('delete'); setBulkConfirmText(''); }}
              disabled={bulkMutation.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Cancelar
            </Button>
          </div>
        )}

        {/* Bulk Deactivate Dialog */}
        <AlertDialog open={bulkAction === 'deactivate'} onOpenChange={() => setBulkAction(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Desactivar {selectedIds.size} negocio{selectedIds.size !== 1 ? 's' : ''}?</AlertDialogTitle>
              <AlertDialogDescription>
                Los negocios seleccionados quedarán inactivos. Sus datos se conservarán y la acción es reversible desde la edición individual.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleBulkConfirm}
                disabled={bulkMutation.isPending}
              >
                {bulkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Ban className="h-4 w-4 mr-1.5" />}
                Desactivar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Delete Dialog */}
        <Dialog open={bulkAction === 'delete'} onOpenChange={() => { setBulkAction(null); setBulkConfirmText(''); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-destructive">¿Eliminar {selectedIds.size} negocio{selectedIds.size !== 1 ? 's' : ''} permanentemente?</DialogTitle>
              <DialogDescription>
                Esta acción no se puede deshacer. Se eliminarán todos los datos asociados a estos negocios.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label className="text-sm">Escribe <strong>ELIMINAR</strong> para confirmar:</Label>
              <Input
                value={bulkConfirmText}
                onChange={e => setBulkConfirmText(e.target.value)}
                placeholder="ELIMINAR"
                className="font-mono"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => { setBulkAction(null); setBulkConfirmText(''); }}>Cancelar</Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkConfirm}
                disabled={bulkConfirmText !== 'ELIMINAR' || bulkMutation.isPending}
                className="gap-1.5"
              >
                {bulkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Eliminar permanentemente
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Single Delete Confirmation */}
        <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar {deleteTarget?.name}?</AlertDialogTitle>
              <AlertDialogDescription>Se eliminarán todos los datos del negocio.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit Business Dialog */}
        <Dialog open={!!editBiz} onOpenChange={(open) => !open && setEditBiz(null)}>
          <DialogContent className="max-w-lg max-h-[85dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Settings className="h-4 w-4" /> Editar Negocio</DialogTitle>
              <DialogDescription>Modifica los datos, estado y sucursales del negocio.</DialogDescription>
            </DialogHeader>
            <div className="space-y-5">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tipo de negocio</Label>
                <Input value={editType} onChange={(e) => setEditType(e.target.value)} placeholder="store, restaurant, etc." />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Estado del negocio</p>
                  <p className="text-[11px] text-muted-foreground">{editBiz?.is_active !== false ? 'El negocio está activo' : 'El negocio está desactivado'}</p>
                </div>
                <Switch checked={editBiz?.is_active !== false} onCheckedChange={(checked) => setEditBiz((prev: any) => prev ? { ...prev, is_active: checked } : null)} />
              </div>
              <div className="space-y-2">
                <Label>Sucursales ({editBranches.length})</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {editBranches.map((br) => (
                    <div key={br.id} className="flex items-center justify-between rounded-md border border-border p-2.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium truncate">{br.name}</span>
                          {br.is_main && <Badge variant="secondary" className="text-[10px] ml-1">Principal</Badge>}
                        </div>
                        {br.address && <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1"><MapPin className="h-3 w-3" /> {br.address}</p>}
                      </div>
                      {!br.is_main && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0" onClick={() => setDeleteBranchTarget({ id: br.id, name: br.name })}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {editBranches.length === 0 && <p className="text-sm text-muted-foreground py-2 text-center">Sin sucursales</p>}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditBiz(null)}>Cancelar</Button>
              <Button
                onClick={() => editBiz && updateBizMutation.mutate({ id: editBiz.id, name: editName.trim(), business_type: editType.trim(), is_active: editBiz.is_active !== false })}
                disabled={!editName.trim() || updateBizMutation.isPending}
              >
                {updateBizMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Branch Confirmation */}
        <AlertDialog open={!!deleteBranchTarget} onOpenChange={() => setDeleteBranchTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar sucursal "{deleteBranchTarget?.name}"?</AlertDialogTitle>
              <AlertDialogDescription>Se eliminarán todos los datos asociados a esta sucursal.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteBranchTarget && deleteBranchMutation.mutate(deleteBranchTarget.id)}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <BusinessDetailSheet
          businessId={detailBizId}
          onClose={() => setDetailBizId(null)}
          onEdit={(biz) => { setDetailBizId(null); openEditBiz(biz); }}
          onDeactivate={async (id, isActive) => {
            await supabase.from('businesses').update({ is_active: !isActive } as any).eq('id', id);
            queryClient.invalidateQueries({ queryKey: ['admin-businesses-page'] });
            queryClient.invalidateQueries({ queryKey: ['admin-biz-detail', id] });
            toast({ title: isActive ? 'Negocio desactivado' : 'Negocio activado' });
          }}
        />
      </div>
    </AppLayout>
  );
};

export default AdminBusinesses;
