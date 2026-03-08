import { useState, useMemo } from 'react';
import { useRawMaterials, usePrintServiceTypes, usePrintRecipes, useEmployeesForTransfer, usePrintMaterialTypes, useActiveSheets, useOpenSheet, useCloseSheet } from '@/hooks/usePrintData';
import { useResolvedBusinessId } from '@/hooks/useResolvedBusinessId';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Smartphone, RotateCcw, AlertCircle, CreditCard, DollarSign, Send, FileText,
} from 'lucide-react';
import { getIconComponent } from '@/components/services/IconSelector';
import { cn } from '@/lib/utils';

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

type PaymentMethod = 'cash' | 'transfer' | 'card' | 'mixed';
const QUICK_AMOUNTS = [1, 5, 10, 20, 50, 100, 200, 500, 1000];

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
  const { data: materialTypes = [] } = usePrintMaterialTypes();

  const activeServices = useMemo(() => services.filter((s: any) => s.is_active), [services]);
  const { data: activeSheets = [] } = useActiveSheets();
  const openSheetMut = useOpenSheet();
  const closeSheetMut = useCloseSheet();

  // Open sheet modal state
  const [openSheetDialog, setOpenSheetDialog] = useState(false);
  const [openSheetForm, setOpenSheetForm] = useState({ material_id: '', tramos_total: 4 });

  // Active cash register for this user
  const { data: activeCaja, isLoading: loadingCaja } = useQuery({
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

  // Recent jobs for today
  const { data: recentJobs = [], isLoading: loadingJobs } = useQuery({
    queryKey: ['print-jobs-recent', businessId, branchId, user?.id],
    queryFn: async () => {
      if (!businessId || !branchId) return [];
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('print_jobs')
        .select('*, print_job_items(service_type_id, cantidad, precio_cobrado)')
        .eq('business_id', businessId)
        .eq('branch_id', branchId)
        .eq('user_id', user!.id)
        .gte('created_at', today + 'T00:00:00')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!businessId && !!branchId && !!user?.id,
  });

  const todayTotal = useMemo(() => recentJobs.reduce((s: number, j: any) => s + Number(j.total), 0), [recentJobs]);

  // ─── Inline Job State ──────────────────────────────────────
  const [jobItems, setJobItems] = useState<JobItem[]>([]);
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [isMixed, setIsMixed] = useState(false);
  const [mixedCash, setMixedCash] = useState('0');
  const [mixedTransfer, setMixedTransfer] = useState('0');

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
    const map = new Map<string, { name: string; needed: number; available: number; isTramo: boolean }>();
    jobItems.forEach(it => {
      if (!it.material_id) return;
      const mat = getMaterial(it.material_id);
      if (!mat) return;
      const matType = materialTypes.find((t: any) => t.id === mat.material_type_id);
      const isTramo = !!matType?.permite_tramos;
      const existing = map.get(it.material_id) || { name: mat.name, needed: 0, available: mat.stock_vendedor, isTramo };
      existing.needed += it.material_consumed;
      map.set(it.material_id, existing);
    });
    return Array.from(map.entries());
  }, [jobItems, materials, materialTypes]);

  const hasStockIssue = materialConsumption.some(([, v]) => v.needed > v.available && !v.isTramo);

  // Check tramo materials: verify active sheet exists
  const tramoIssues = useMemo(() => {
    const issues: { materialId: string; materialName: string }[] = [];
    materialConsumption.forEach(([matId, info]) => {
      if (!info.isTramo) return;
      const mat = getMaterial(matId);
      if (!mat) return;
      const sheet = activeSheets.find((s: any) => s.material_id === matId && s.status === 'activa');
      if (!sheet) {
        issues.push({ materialId: matId, materialName: info.name });
      }
    });
    return issues;
  }, [materialConsumption, activeSheets, materials]);

  // Tramo info chips
  const tramoInfo = useMemo(() => {
    const info: { name: string; remaining: number }[] = [];
    materialConsumption.forEach(([matId, mc]) => {
      if (!mc.isTramo) return;
      const sheet = activeSheets.find((s: any) => s.material_id === matId && s.status === 'activa');
      if (sheet) {
        info.push({ name: mc.name, remaining: Math.max(0, (sheet as any).tramos_total - (sheet as any).tramos_usados) });
      }
    });
    return info;
  }, [materialConsumption, activeSheets]);

  // Payment helpers
  const paymentOptions: { value: PaymentMethod; label: string; Icon: React.ElementType }[] = [
    { value: 'cash', label: 'Efectivo', Icon: Banknote },
    { value: 'card', label: 'Tarjeta', Icon: CreditCard },
    { value: 'transfer', label: 'Transferencia', Icon: Smartphone },
  ];

  const handlePaymentSelect = (value: PaymentMethod) => {
    if (isMixed) {
      if (value === 'cash' || value === 'transfer') {
        setIsMixed(false);
        setPaymentMethod(value);
        return;
      }
    }
    if (
      (paymentMethod === 'cash' && value === 'transfer') ||
      (paymentMethod === 'transfer' && value === 'cash')
    ) {
      setIsMixed(true);
      setMixedCash('0');
      setMixedTransfer(jobTotal > 0 ? jobTotal.toFixed(2) : '0');
      return;
    }
    setIsMixed(false);
    setPaymentMethod(value);
  };

  const isPaymentActive = (v: PaymentMethod) => isMixed ? (v === 'cash' || v === 'transfer') : paymentMethod === v;

  const canSubmit = jobItems.length > 0 && jobTotal > 0 && tramoIssues.length === 0;

  // ─── Submit Job ─────────────────────────────────────────────
  const jobMutation = useMutation({
    mutationFn: async () => {
      if (!businessId || !branchId || !user?.id) throw new Error('Sin contexto');

      const finalPayment = isMixed ? 'mixed' : paymentMethod;

      const { data: job, error: jobErr } = await supabase
        .from('print_jobs')
        .insert({
          business_id: businessId,
          branch_id: branchId,
          user_id: user.id,
          total: jobTotal,
          payment_method: finalPayment,
          nota: description.trim() || null,
        })
        .select('id')
        .single();
      if (jobErr) throw jobErr;

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

      // Deduct stock only for non-tramo materials (tramo materials are handled via active sheets)
      for (const [matId, info] of materialConsumption) {
        const mat = getMaterial(matId);
        if (!mat) continue;
        // Check if this material's type has permite_tramos
        const matType = materialTypes.find((t: any) => t.id === mat.material_type_id);
        if (matType?.permite_tramos) continue; // Skip: tramos are managed via print_active_sheets trigger
        await supabase.from('raw_materials').update({
          stock_vendedor: Math.max(0, mat.stock_vendedor - info.needed),
        }).eq('id', matId);
      }

      if (activeCaja?.id && (finalPayment === 'cash' || finalPayment === 'mixed')) {
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

      auditLog('print_job_created', `Trabajo de impresión por $${jobTotal.toFixed(2)} (${jobItems.length} items)`, job.id, 'print_job');
      return job.id;
    },
    onSuccess: () => {
      toast({ title: '✓ Trabajo registrado' });
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      queryClient.invalidateQueries({ queryKey: ['caja-movements'] });
      queryClient.invalidateQueries({ queryKey: ['print-jobs-recent'] });
      setJobItems([]);
      setDescription('');
      setPaymentMethod('cash');
      setIsMixed(false);
      setMixedCash('0');
      setMixedTransfer('0');
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

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
  const activeRecipes = recipes.filter((r: any) => r.is_active);
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

  const paymentLabels: Record<string, string> = {
    cash: 'Efectivo', transfer: 'Transferencia', card: 'Tarjeta', mixed: 'Mixto',
  };

  // ─── Render ─────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Impresiones</h1>
        <p className="text-sm text-muted-foreground">Registra trabajos de impresión</p>
      </div>

      {loadingCaja ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !activeCaja ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
            <DollarSign className="h-10 w-10 opacity-40 mb-3" />
            <p className="text-sm font-medium">Debes abrir tu caja primero</p>
            <p className="text-xs mt-1">Ve al módulo Caja para abrir tu caja antes de registrar trabajos.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Total del día */}
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total del día</p>
                <p className="text-2xl font-bold">${todayTotal.toFixed(2)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-primary opacity-50" />
            </CardContent>
          </Card>

          {/* Registrar Trabajo - inline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Registrar Trabajo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Service selector */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Selecciona un servicio</Label>
                {activeServices.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-3">No hay servicios configurados</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {activeServices.map((svc: any) => {
                      const SvcIcon = getIconComponent(svc.icon);
                      const count = jobItems.filter(it => it.service_type_id === svc.id).length;
                      return (
                        <button
                          key={svc.id}
                          onClick={() => addJobItem(svc)}
                          className={cn(
                            'flex items-center gap-2 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50',
                            count > 0 && 'border-primary bg-primary/10 ring-1 ring-primary'
                          )}
                        >
                          <SvcIcon className={cn('h-4 w-4 shrink-0', count > 0 ? 'text-primary' : 'text-muted-foreground')} />
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-medium truncate block">{svc.name}</span>
                            {svc.precio_base > 0 && (
                              <span className="text-[10px] text-muted-foreground">${Number(svc.precio_base).toFixed(2)}</span>
                            )}
                          </div>
                          {count > 0 && (
                            <Badge variant="default" className="shrink-0 text-[10px] h-5 min-w-5 flex items-center justify-center">{count}</Badge>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Items detail */}
              {jobItems.length > 0 && (
                <div className="space-y-2">
                  {jobItems.map((item, idx) => {
                    const svc = activeServices.find((s: any) => s.id === item.service_type_id);
                    return (
                      <div key={idx} className="rounded-lg border p-2 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.service_name}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Input
                              type="number"
                              min={1}
                              className="h-7 w-14 text-xs text-center"
                              value={item.cantidad}
                              onChange={e => updateJobItem(idx, 'cantidad', parseInt(e.target.value) || 1)}
                            />
                            <span className="text-xs text-muted-foreground">×</span>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              className="h-7 w-20 text-xs text-right"
                              value={item.precio_cobrado}
                              onChange={e => updateJobItem(idx, 'precio_cobrado', parseFloat(e.target.value) || 0)}
                            />
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeJobItem(idx)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        {/* Switches: doble cara & color */}
                        <div className="flex items-center gap-4 pl-1">
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                            <Switch
                              className="scale-75"
                              checked={item.es_doble_cara}
                              onCheckedChange={v => updateJobItem(idx, 'es_doble_cara', v)}
                            />
                            Doble cara
                          </label>
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                            <Switch
                              className="scale-75"
                              checked={item.es_color}
                              onCheckedChange={v => updateJobItem(idx, 'es_color', v)}
                            />
                            Color
                          </label>
                        </div>
                      </div>
                    );
                  })}

                  {/* Tramo info chips */}
                  {tramoInfo.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {tramoInfo.map(t => (
                        <Badge key={t.name} variant="outline" className="text-xs">
                          {t.name}: {t.remaining} tramos disponibles
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Tramo warnings - no active sheet */}
                  {tramoIssues.length > 0 && (
                    <div className="rounded-md border border-warning/50 bg-warning/10 p-2 space-y-1">
                      {tramoIssues.map(issue => (
                        <div key={issue.materialId} className="flex items-center gap-1.5 text-xs text-warning">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          <span>No hay hoja activa de <strong>{issue.materialName}</strong>. El administrador debe abrir una desde Insumos.</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Material warnings */}
                  {materialConsumption.length > 0 && hasStockIssue && (
                    <div className="flex items-center gap-1 text-destructive text-xs">
                      <AlertTriangle className="h-3 w-3" />
                      <span>Stock insuficiente para algunos insumos</span>
                    </div>
                  )}

                  {/* Total inline */}
                  <div className="flex justify-between items-center px-1 pt-1">
                    <span className="text-sm font-medium text-muted-foreground">Total</span>
                    <span className="text-lg font-bold">${jobTotal.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <Label className="text-xs text-muted-foreground">Descripción (opcional)</Label>
                <Textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Detalle del trabajo..."
                  rows={2}
                  className="mt-1"
                />
              </div>

              {/* Payment method */}
              <div className="space-y-3">
                <Label className="text-xs text-muted-foreground">Método de Pago</Label>
                <div className="grid grid-cols-3 gap-2">
                  {paymentOptions.map(({ value, label, Icon }) => (
                    <Button
                      key={value}
                      type="button"
                      variant={isPaymentActive(value) ? 'default' : 'outline'}
                      className={cn('flex-col h-auto py-2.5', isPaymentActive(value) && 'ring-2 ring-primary')}
                      onClick={() => handlePaymentSelect(value)}
                    >
                      <Icon className="h-4 w-4 mb-0.5" />
                      <span className="text-xs">{label}</span>
                    </Button>
                  ))}
                </div>
                {isMixed && (
                  <p className="text-xs text-muted-foreground text-center">Pago mixto: Efectivo + Transferencia</p>
                )}

                {isMixed && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-1"><Banknote className="h-3 w-3" /> Efectivo</Label>
                      <Input type="number" step="0.01" min="0" value={mixedCash} onChange={e => setMixedCash(e.target.value)} className="text-right font-medium" />
                      <div className="flex flex-wrap gap-1.5">
                        {QUICK_AMOUNTS.map(a => (
                          <Button key={a} type="button" variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => setMixedCash(p => (Number(p) + a).toString())}>${a}</Button>
                        ))}
                        <Button type="button" variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => setMixedCash(jobTotal > 0 ? jobTotal.toFixed(2) : '0')}>Exacto</Button>
                        <Button type="button" variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => setMixedCash('0')}><RotateCcw className="h-3 w-3" /></Button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-1"><Smartphone className="h-3 w-3" /> Transferencia</Label>
                      <Input type="number" step="0.01" min="0" value={mixedTransfer} onChange={e => setMixedTransfer(e.target.value)} className="text-right font-medium" />
                    </div>
                  </div>
                )}
              </div>

              {/* Submit */}
              <Button
                className="w-full"
                onClick={() => jobMutation.mutate()}
                disabled={!canSubmit || jobMutation.isPending}
              >
                {jobMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                Registrar Cobro
              </Button>
            </CardContent>
          </Card>

          {/* Stock de insumos colapsado */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Mi stock de insumos</CardTitle>
            </CardHeader>
            <CardContent>
              {materials.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tienes insumos asignados</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {materials.map((m: any) => {
                    const isLow = m.stock_vendedor <= 0;
                    return (
                      <div key={m.id} className={cn('flex items-center justify-between gap-2 rounded-lg border p-2', isLow && 'border-destructive bg-destructive/5')}>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{m.name}</p>
                        </div>
                        <Badge variant={isLow ? 'destructive' : 'secondary'} className="shrink-0 text-xs">
                          {m.stock_vendedor}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action buttons */}
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

          {/* Cobros Recientes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Cobros Recientes</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingJobs ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : recentJobs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No hay trabajos registrados hoy</p>
              ) : (
                <div className="space-y-2">
                  {recentJobs.map((job: any) => {
                    const itemCount = (job.print_job_items || []).reduce((s: number, it: any) => s + it.cantidad, 0);
                    return (
                      <div key={job.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <Printer className="h-4 w-4 shrink-0 text-primary" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="secondary" className="text-[10px]">{itemCount} item{itemCount !== 1 ? 's' : ''}</Badge>
                              <Badge variant="outline" className="text-[10px]">{paymentLabels[job.payment_method] || job.payment_method}</Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                              {new Date(job.created_at).toLocaleString('es', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                        <span className="text-sm font-bold shrink-0 ml-2">${Number(job.total).toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

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
