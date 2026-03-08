import { useState, useMemo } from 'react';
import { useRawMaterials, usePrintServiceTypes, usePrintRecipes, useEmployeesForTransfer } from '@/hooks/usePrintData';
import { useResolvedBusinessId } from '@/hooks/useResolvedBusinessId';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  Printer, Package, AlertTriangle, Plus, Trash2, Loader2,
  Banknote, ArrowLeftRight, ClipboardMinus, ChefHat, CheckCircle2,
  Smartphone, RotateCcw, AlertCircle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────
interface JobItem {
  service_type_id: string;
  service_name: string;
  cantidad: number;
  es_doble_cara: boolean;
  es_color: boolean;
  precio_cobrado: number;
  costo_insumo: number;
  material_consumed: number;
  material_id: string | null;
  nota: string;
}

type PaymentMethod = 'cash' | 'transfer' | 'mixed';

// ─── Component ────────────────────────────────────────────────
const SellerPrintView = () => {
  const { profile, user } = useAuth();
  const { businessId, branchId } = useResolvedBusinessId();
  const { toast } = useToast();
  const auditLog = useAuditLog();
  const queryClient = useQueryClient();

  const { data: materials = [], isLoading: matLoading } = useRawMaterials();
  const { data: services = [] } = usePrintServiceTypes();
  const { data: recipes = [] } = usePrintRecipes();

  const activeServices = useMemo(() => services.filter((s: any) => s.is_active), [services]);

  // Active cash register for this user
  const { data: activeCaja } = useQuery({
    queryKey: ['active-cash-register', branchId, user?.id],
    queryFn: async () => {
      if (!branchId || !user?.id) return null;
      const { data } = await supabase
        .from('cash_registers')
        .select('id')
        .eq('branch_id', branchId)
        .eq('user_id', user.id)
        .eq('status', 'open')
        .maybeSingle();
      return data;
    },
    enabled: !!branchId && !!user?.id,
  });

  // ─── Job Modal ──────────────────────────────────────────────
  const [jobOpen, setJobOpen] = useState(false);
  const [jobItems, setJobItems] = useState<JobItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [jobDone, setJobDone] = useState<{ total: number; change: number } | null>(null);

  // ─── Shrinkage Modal ───────────────────────────────────────
  const [shrinkOpen, setShrinkOpen] = useState(false);
  const [shrinkForm, setShrinkForm] = useState({ material_id: '', cantidad: 0, motivo: '', nota: '' });

  // ─── Production Modal ──────────────────────────────────────
  const [prodOpen, setProdOpen] = useState(false);
  const [prodForm, setProdForm] = useState({ recipe_id: '', cantidad_producida: 1, nota: '' });

  // ─── Helpers ────────────────────────────────────────────────
  const getMaterial = (id: string | null) => materials.find((m: any) => m.id === id);

  const addJobItem = (svc: any) => {
    setJobItems(prev => [
      ...prev,
      {
        service_type_id: svc.id,
        service_name: svc.name,
        cantidad: 1,
        es_doble_cara: false,
        es_color: false,
        precio_cobrado: svc.precio_base,
        costo_insumo: svc.material_id ? (getMaterial(svc.material_id)?.costo_unitario || 0) * svc.consumo_por_unidad : 0,
        material_consumed: svc.consumo_por_unidad,
        material_id: svc.material_id,
        nota: '',
      },
    ]);
  };

  const updateJobItem = (idx: number, field: string, value: any) => {
    setJobItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      // Recalc cost when quantity changes
      if (field === 'cantidad') {
        const svc = activeServices.find((s: any) => s.id === item.service_type_id);
        if (svc && svc.material_id) {
          const mat = getMaterial(svc.material_id);
          updated.costo_insumo = (mat?.costo_unitario || 0) * svc.consumo_por_unidad * value;
          updated.material_consumed = svc.consumo_por_unidad * value;
        }
      }
      return updated;
    }));
  };

  const removeJobItem = (idx: number) => setJobItems(prev => prev.filter((_, i) => i !== idx));

  const jobTotal = useMemo(() => jobItems.reduce((s, it) => s + it.precio_cobrado * it.cantidad, 0), [jobItems]);

  const materialConsumption = useMemo(() => {
    const map = new Map<string, { name: string; needed: number; available: number }>();
    jobItems.forEach(it => {
      if (!it.material_id) return;
      const mat = getMaterial(it.material_id);
      if (!mat) return;
      const existing = map.get(it.material_id) || { name: mat.name, needed: 0, available: mat.stock_vendedor };
      existing.needed += it.material_consumed;
      map.set(it.material_id, existing);
    });
    return Array.from(map.entries());
  }, [jobItems, materials]);

  const hasStockIssue = materialConsumption.some(([, v]) => v.needed > v.available);

  // ─── Submit Job ─────────────────────────────────────────────
  const jobMutation = useMutation({
    mutationFn: async () => {
      if (!businessId || !branchId || !user?.id) throw new Error('Sin contexto');

      // 1. Insert print_job
      const { data: job, error: jobErr } = await supabase
        .from('print_jobs')
        .insert({
          business_id: businessId,
          branch_id: branchId,
          user_id: user.id,
          total: jobTotal,
          payment_method: paymentMethod,
          nota: null,
        })
        .select('id')
        .single();
      if (jobErr) throw jobErr;

      // 2. Insert print_job_items
      const items = jobItems.map(it => ({
        job_id: job.id,
        service_type_id: it.service_type_id,
        cantidad: it.cantidad,
        es_doble_cara: it.es_doble_cara,
        es_color: it.es_color,
        precio_cobrado: it.precio_cobrado,
        costo_insumo: it.costo_insumo,
        material_consumido: it.material_consumed,
        nota: it.nota || null,
      }));
      const { error: itemsErr } = await supabase.from('print_job_items').insert(items);
      if (itemsErr) throw itemsErr;

      // 3. Deduct stock_vendedor
      for (const [matId, info] of materialConsumption) {
        const mat = getMaterial(matId);
        if (!mat) continue;
        await supabase.from('raw_materials').update({
          stock_vendedor: Math.max(0, mat.stock_vendedor - info.needed),
        }).eq('id', matId);
      }

      // 4. Create cash register movement if caja is open
      if (activeCaja?.id && (paymentMethod === 'cash' || paymentMethod === 'mixed')) {
        await supabase.from('cash_register_movements' as any).insert({
          cash_register_id: activeCaja.id,
          branch_id: branchId,
          business_id: businessId,
          user_id: user.id,
          movement_type: 'insertion',
          amount: jobTotal,
          reason: `Trabajo de impresión ($${jobTotal.toFixed(2)})`,
        });
      }

      // 5. Audit
      auditLog('print_job_created', `Trabajo de impresión por $${jobTotal.toFixed(2)} (${jobItems.length} items)`, job.id, 'print_job');

      return job.id;
    },
    onSuccess: () => {
      const received = parseFloat(amountReceived) || jobTotal;
      const change = Math.max(0, received - jobTotal);
      setJobDone({ total: jobTotal, change });
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      queryClient.invalidateQueries({ queryKey: ['caja-movements'] });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const resetJob = () => {
    setJobItems([]);
    setPaymentMethod('cash');
    setAmountReceived('');
    setJobDone(null);
    setJobOpen(false);
  };

  // ─── Submit Shrinkage ──────────────────────────────────────
  const shrinkMutation = useMutation({
    mutationFn: async () => {
      if (!businessId || !branchId || !user?.id) throw new Error('Sin contexto');
      const { error } = await supabase.from('print_shrinkage').insert({
        business_id: businessId,
        branch_id: branchId,
        user_id: user.id,
        material_id: shrinkForm.material_id,
        cantidad: shrinkForm.cantidad,
        motivo: shrinkForm.motivo || null,
        nota: shrinkForm.nota || null,
      });
      if (error) throw error;
      // Deduct
      const mat = getMaterial(shrinkForm.material_id);
      if (mat) {
        await supabase.from('raw_materials').update({
          stock_vendedor: Math.max(0, mat.stock_vendedor - shrinkForm.cantidad),
        }).eq('id', shrinkForm.material_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      toast({ title: 'Merma registrada' });
      setShrinkForm({ material_id: '', cantidad: 0, motivo: '', nota: '' });
      setShrinkOpen(false);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // ─── Submit Production ─────────────────────────────────────
  const selectedRecipe = useMemo(() => recipes.find((r: any) => r.id === prodForm.recipe_id), [recipes, prodForm.recipe_id]);

  const prodConsumption = useMemo(() => {
    if (!selectedRecipe) return [];
    return ((selectedRecipe as any).print_recipe_materials || []).map((rm: any) => {
      const mat = getMaterial(rm.material_id);
      const needed = rm.cantidad_por_produccion * prodForm.cantidad_producida;
      return { material_id: rm.material_id, name: mat?.name || '—', needed, available: mat?.stock_vendedor || 0 };
    });
  }, [selectedRecipe, prodForm.cantidad_producida, materials]);

  const prodMutation = useMutation({
    mutationFn: async () => {
      if (!businessId || !branchId || !user?.id || !selectedRecipe) throw new Error('Sin contexto');
      const { error } = await supabase.from('print_productions').insert({
        business_id: businessId,
        branch_id: branchId,
        user_id: user.id,
        recipe_id: selectedRecipe.id,
        cantidad_producida: prodForm.cantidad_producida,
        nota: prodForm.nota || null,
      });
      if (error) throw error;
      // Deduct materials
      for (const pc of prodConsumption) {
        const mat = getMaterial(pc.material_id);
        if (mat) {
          await supabase.from('raw_materials').update({
            stock_vendedor: Math.max(0, mat.stock_vendedor - pc.needed),
          }).eq('id', pc.material_id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      toast({ title: `Producción registrada: ${prodForm.cantidad_producida} × ${(selectedRecipe as any)?.name}` });
      setProdForm({ recipe_id: '', cantidad_producida: 1, nota: '' });
      setProdOpen(false);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  if (matLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const activeRecipes = recipes.filter((r: any) => r.is_active);

  // ─── Render ─────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Stock Cards */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Mi stock de insumos</h2>
        {materials.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tienes insumos asignados</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {materials.map((m: any) => {
              const isLow = m.stock_vendedor <= 0;
              return (
                <Card key={m.id} className={isLow ? 'border-destructive bg-destructive/5' : ''}>
                  <CardContent className="p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.print_material_types?.name || ''}</p>
                    </div>
                    <Badge variant={isLow ? 'destructive' : 'secondary'} className="shrink-0">
                      {m.stock_vendedor}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Separator />

      {/* Action buttons */}
      <div className="space-y-3">
        <Button size="lg" className="w-full h-14 text-lg gap-2" onClick={() => { setJobDone(null); setJobItems([]); setJobOpen(true); }}>
          <Printer className="h-5 w-5" />
          Registrar Trabajo
        </Button>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" className="gap-2" onClick={() => setShrinkOpen(true)}>
            <ClipboardMinus className="h-4 w-4" />
            Registrar Merma
          </Button>
          {activeRecipes.length > 0 && (
            <Button variant="outline" className="gap-2" onClick={() => setProdOpen(true)}>
              <ChefHat className="h-4 w-4" />
              Registrar Producción
            </Button>
          )}
        </div>
      </div>

      {/* ─── JOB MODAL ──────────────────────────────────── */}
      <Dialog open={jobOpen} onOpenChange={v => { if (!v) resetJob(); else setJobOpen(true); }}>
        <DialogContent className="max-w-lg max-h-[92vh] flex flex-col p-0">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle>{jobDone ? 'Trabajo registrado' : 'Registrar Trabajo'}</DialogTitle>
          </DialogHeader>

          {jobDone ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
              <CheckCircle2 className="h-16 w-16 text-primary" />
              <p className="text-2xl font-bold">${jobDone.total.toFixed(2)}</p>
              {jobDone.change > 0 && (
                <p className="text-lg text-muted-foreground">Cambio: <span className="font-semibold text-foreground">${jobDone.change.toFixed(2)}</span></p>
              )}
              <Button className="mt-4" onClick={resetJob}>Cerrar</Button>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-4 space-y-4">
                {/* Service selector */}
                <div>
                  <Label className="text-sm text-muted-foreground">Selecciona servicios</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                    {activeServices.map((svc: any) => (
                      <Button key={svc.id} variant="outline" size="sm" className="h-auto py-2 px-3 text-left justify-start" onClick={() => addJobItem(svc)}>
                        <Plus className="h-3 w-3 mr-1 shrink-0" />
                        <span className="truncate">{svc.name}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Items list */}
                {jobItems.length > 0 && (
                  <div className="space-y-3">
                    {jobItems.map((item, idx) => {
                      const svc = activeServices.find((s: any) => s.id === item.service_type_id);
                      return (
                        <Card key={idx}>
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-sm">{item.service_name}</p>
                                {/b\/?n|blanco/i.test(item.service_name) && (
                                  <span className="text-[10px] text-muted-foreground">Blanco y Negro</span>
                                )}
                                {/color/i.test(item.service_name) && !/b\/?n|blanco/i.test(item.service_name) && (
                                  <span className="text-[10px] text-muted-foreground">Color</span>
                                )}
                              </div>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeJobItem(idx)}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-xs">Cantidad</Label>
                                <Input type="number" min={1} className="h-8" value={item.cantidad} onChange={e => updateJobItem(idx, 'cantidad', parseInt(e.target.value) || 1)} />
                              </div>
                              <div>
                                <Label className="text-xs">Precio cobrado</Label>
                                <Input type="number" min={0} step="0.01" className="h-8" value={item.precio_cobrado} onChange={e => updateJobItem(idx, 'precio_cobrado', parseFloat(e.target.value) || 0)} />
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
                              {svc?.admite_doble_cara && (
                                <div className="flex items-center gap-2">
                                  <Switch checked={item.es_doble_cara} onCheckedChange={v => updateJobItem(idx, 'es_doble_cara', v)} />
                                  <Label className="text-xs">Doble cara</Label>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <Switch checked={item.es_color} onCheckedChange={v => updateJobItem(idx, 'es_color', v)} />
                                <Label className="text-xs">{item.es_color ? 'Color' : 'B/N'}</Label>
                              </div>
                            </div>
                            <Input placeholder="Nota (opcional)" className="h-8 text-xs" value={item.nota} onChange={e => updateJobItem(idx, 'nota', e.target.value)} />
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}

                {/* Summary */}
                {jobItems.length > 0 && (
                  <div className="space-y-2 bg-muted/50 rounded-lg p-3">
                    <div className="flex justify-between font-semibold text-lg">
                      <span>Total</span>
                      <span>${jobTotal.toFixed(2)}</span>
                    </div>

                    {materialConsumption.length > 0 && (
                      <div className="text-xs space-y-1">
                        <p className="text-muted-foreground font-medium">Insumos a consumir:</p>
                        {materialConsumption.map(([id, info]) => (
                          <div key={id} className={`flex justify-between ${info.needed > info.available ? 'text-destructive font-medium' : ''}`}>
                            <span>{info.name}</span>
                            <span>{info.needed} / {info.available} disp.</span>
                          </div>
                        ))}
                        {hasStockIssue && (
                          <div className="flex items-center gap-1 text-destructive mt-1">
                            <AlertTriangle className="h-3 w-3" />
                            <span>Stock insuficiente</span>
                          </div>
                        )}
                      </div>
                    )}

                    <Separator />

                    {/* Payment */}
                    <div className="space-y-2">
                      <Label className="text-xs">Método de pago</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['cash', 'transfer', 'mixed'] as const).map(m => (
                          <Button key={m} variant={paymentMethod === m ? 'default' : 'outline'} size="sm" onClick={() => setPaymentMethod(m)}>
                            {m === 'cash' ? 'Efectivo' : m === 'transfer' ? 'Transferencia' : 'Mixto'}
                          </Button>
                        ))}
                      </div>
                      {paymentMethod === 'cash' && (
                        <div>
                          <Label className="text-xs">Monto recibido</Label>
                          <Input type="number" min={0} step="0.01" value={amountReceived} onChange={e => setAmountReceived(e.target.value)} placeholder={jobTotal.toFixed(2)} />
                          {parseFloat(amountReceived) > jobTotal && (
                            <p className="text-sm text-primary font-medium mt-1">Cambio: ${(parseFloat(amountReceived) - jobTotal).toFixed(2)}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="p-4 pt-2 border-t">
                <Button variant="outline" onClick={resetJob}>Cancelar</Button>
                <Button onClick={() => jobMutation.mutate()} disabled={jobItems.length === 0 || jobMutation.isPending}>
                  {jobMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Confirmar (${jobTotal.toFixed(2)})
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── SHRINKAGE MODAL ───────────────────────────── */}
      <Dialog open={shrinkOpen} onOpenChange={setShrinkOpen}>
        <DialogContent className="max-w-sm max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>Registrar Merma</DialogTitle></DialogHeader>
          <div className="space-y-3 overflow-y-auto flex-1 pr-1">
            <div>
              <Label>Insumo</Label>
              <Select value={shrinkForm.material_id} onValueChange={v => setShrinkForm(f => ({ ...f, material_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {materials.filter((m: any) => m.stock_vendedor > 0).map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>{m.name} (Stock: {m.stock_vendedor})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cantidad</Label>
              <Input type="number" min={1} value={shrinkForm.cantidad || ''} onChange={e => setShrinkForm(f => ({ ...f, cantidad: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <Label>Motivo</Label>
              <Input value={shrinkForm.motivo} onChange={e => setShrinkForm(f => ({ ...f, motivo: e.target.value }))} placeholder="Ej: Atasco en impresora" />
            </div>
            <div>
              <Label>Nota (opcional)</Label>
              <Textarea value={shrinkForm.nota} onChange={e => setShrinkForm(f => ({ ...f, nota: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShrinkOpen(false)}>Cancelar</Button>
            <Button onClick={() => shrinkMutation.mutate()} disabled={!shrinkForm.material_id || !shrinkForm.cantidad || shrinkMutation.isPending}>
              {shrinkMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Registrar merma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── PRODUCTION MODAL ──────────────────────────── */}
      <Dialog open={prodOpen} onOpenChange={setProdOpen}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>Registrar Producción</DialogTitle></DialogHeader>
          <div className="space-y-3 overflow-y-auto flex-1 pr-1">
            <div>
              <Label>Receta</Label>
              <Select value={prodForm.recipe_id} onValueChange={v => setProdForm(f => ({ ...f, recipe_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar receta" /></SelectTrigger>
                <SelectContent>
                  {activeRecipes.map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>{r.name} (produce {r.unidades_produce})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cantidad producida</Label>
              <Input type="number" min={1} value={prodForm.cantidad_producida} onChange={e => setProdForm(f => ({ ...f, cantidad_producida: parseInt(e.target.value) || 1 }))} />
            </div>
            <div>
              <Label>Nota (opcional)</Label>
              <Textarea value={prodForm.nota} onChange={e => setProdForm(f => ({ ...f, nota: e.target.value }))} rows={2} />
            </div>

            {prodConsumption.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <p className="font-medium text-muted-foreground">Insumos a consumir:</p>
                {prodConsumption.map((pc: any) => (
                  <div key={pc.material_id} className={`flex justify-between ${pc.needed > pc.available ? 'text-destructive font-medium' : ''}`}>
                    <span>{pc.name}</span>
                    <span>{pc.needed} / {pc.available} disp.</span>
                  </div>
                ))}
                {prodConsumption.some((pc: any) => pc.needed > pc.available) && (
                  <div className="flex items-center gap-1 text-destructive mt-1">
                    <AlertTriangle className="h-3 w-3" /><span>Stock insuficiente</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProdOpen(false)}>Cancelar</Button>
            <Button onClick={() => prodMutation.mutate()} disabled={!prodForm.recipe_id || prodMutation.isPending}>
              {prodMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Confirmar producción
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SellerPrintView;
