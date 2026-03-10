import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Store, Building2, Users, Package, ExternalLink,
  Pencil, Ban, Eye, Loader2, Calendar, Mail, DollarSign, AlertTriangle,
  Heart, ShieldAlert, CheckCircle2, XCircle, Clock, ChevronDown,
  ArrowUpRight, ArrowDownRight, Minus, Search, ChefHat, MailIcon,
  ShoppingCart, UserPlus, PackagePlus, CreditCard, Activity,
} from 'lucide-react';
import { format, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

interface BusinessDetailSheetProps {
  businessId: string | null;
  onClose: () => void;
  onEdit: (biz: any) => void;
  onDeactivate: (id: string, currentActive: boolean) => void;
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito',
  basic: 'Básico',
  professional: 'Profesional',
};

type HealthLevel = 'healthy' | 'warning' | 'critical';

function calcHealth(opts: {
  hasSalesThisMonth: boolean;
  outOfStock: number;
  totalProducts: number;
  hasActiveEmployees: boolean;
  planActive: boolean;
  ownerRecentAccess: boolean;
}): { level: HealthLevel; score: number } {
  let score = 0;
  if (opts.hasSalesThisMonth) score += 25;
  if (opts.outOfStock === 0 || opts.totalProducts === 0) score += 20;
  else if (opts.outOfStock / opts.totalProducts < 0.3) score += 10;
  if (opts.ownerRecentAccess) score += 20;
  if (opts.hasActiveEmployees) score += 15;
  if (opts.planActive) score += 20;
  const level: HealthLevel = score >= 70 ? 'healthy' : score >= 40 ? 'warning' : 'critical';
  return { level, score };
}

const HEALTH_CONFIG: Record<HealthLevel, { label: string; className: string }> = {
  healthy: { label: 'Saludable', className: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
  warning: { label: 'Atención', className: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
  critical: { label: 'En riesgo', className: 'bg-destructive/15 text-destructive border-destructive/30' },
};

const BusinessDetailSheet = ({ businessId, onClose, onEdit, onDeactivate }: BusinessDetailSheetProps) => {
  const [productSearch, setProductSearch] = useState('');
  const [inventoryOpen, setInventoryOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-biz-detail-v2', businessId],
    queryFn: async () => {
      if (!businessId) throw new Error('No id');

      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      const sevenDaysAgo = subDays(now, 7);
      const fourteenDaysAgo = subDays(now, 14);
      const thirtyDaysAgo = subMonths(now, 1);

      const [
        bizRes, branchesRes, employeesRes, productsRes, modulesRes, bizTypeRes, categoriesRes,
      ] = await Promise.all([
        supabase.from('businesses').select('*').eq('id', businessId).maybeSingle(),
        supabase.from('branches').select('id, name, is_main, address, slug').eq('business_id', businessId).order('is_main', { ascending: false }),
        supabase.from('employees').select('id, full_name, created_at, business_id').eq('business_id', businessId),
        supabase.from('products').select('id, name, business_id, cost_price, sale_price, min_stock, tipo, category_id').eq('business_id', businessId),
        supabase.from('platform_modules').select('id, name, sidebar_label, is_active'),
        supabase.from('business_type_configs').select('id, key, name, module_ids, is_active'),
        supabase.from('categories').select('id, name').eq('business_id', businessId),
      ]);

      const biz = bizRes.data;
      if (!biz) throw new Error('Not found');

      const branches = branchesRes.data || [];
      const branchIds = branches.map(b => b.id);
      const noB = branchIds.length === 0;

      // Owner
      const { data: ownerProfile } = biz.owner_id
        ? await supabase.from('profiles').select('id, full_name, email, plan_type, user_id, subscription_status, subscription_ends_at, updated_at').eq('id', biz.owner_id).maybeSingle()
        : { data: null };

      // Sales this month + recent 5 + all time + last 30 days check
      const [salesMonthRes, recentSalesRes, allSalesRes, sales30Res] = await Promise.all([
        supabase.from('sales').select('total').in('branch_id', noB ? ['__none__'] : branchIds).eq('status', 'completed')
          .gte('created_at', monthStart.toISOString()).lte('created_at', monthEnd.toISOString()),
        supabase.from('sales').select('id, total, created_at, sale_number, branch_id').in('branch_id', noB ? ['__none__'] : branchIds)
          .eq('status', 'completed').order('created_at', { ascending: false }).limit(5),
        supabase.from('sales').select('total').in('branch_id', noB ? ['__none__'] : branchIds).eq('status', 'completed'),
        supabase.from('sales').select('id').in('branch_id', noB ? ['__none__'] : branchIds).eq('status', 'completed')
          .gte('created_at', thirtyDaysAgo.toISOString()).limit(1),
      ]);

      const salesThisMonth = (salesMonthRes.data || []).reduce((s, v) => s + Number(v.total), 0);
      const hasSalesThisMonth = (salesMonthRes.data || []).length > 0;
      const hasSalesLast30 = (sales30Res.data || []).length > 0;
      const totalRevenue = (allSalesRes.data || []).reduce((s, v) => s + Number(v.total), 0);

      // Stock
      const { data: stockData } = await supabase.from('branch_stock').select('product_id, quantity')
        .in('branch_id', noB ? ['__none__'] : branchIds);

      const products = productsRes.data || [];
      const categories = categoriesRes.data || [];
      const categoryMap: Record<string, string> = {};
      categories.forEach(c => { categoryMap[c.id] = c.name; });

      const stockMap: Record<string, number> = {};
      (stockData || []).forEach(s => { stockMap[s.product_id] = (stockMap[s.product_id] || 0) + s.quantity; });

      const enrichedProducts = products.map(p => {
        const stock = stockMap[p.id] || 0;
        const minStock = p.min_stock || 0;
        const margin = p.sale_price && p.cost_price ? Math.round(((p.sale_price - p.cost_price) / p.sale_price) * 100) : 0;
        let stockLevel: 'ok' | 'low' | 'out' = 'ok';
        if (stock <= 0) stockLevel = 'out';
        else if (minStock > 0 && stock <= minStock) stockLevel = 'low';
        return {
          ...p,
          stock,
          stockLevel,
          margin,
          categoryName: p.category_id ? categoryMap[p.category_id] || '—' : '—',
        };
      }).sort((a, b) => {
        const order = { out: 0, low: 1, ok: 2 };
        return order[a.stockLevel] - order[b.stockLevel];
      });

      const outOfStock = enrichedProducts.filter(p => p.stockLevel === 'out').length;
      const lowStock = enrichedProducts.filter(p => p.stockLevel === 'low').length;

      // Employees
      const employees = employeesRes.data || [];
      const activeEmployees = employees.length;

      // Modules
      const bizTypeConfig = (bizTypeRes.data || []).find(c => c.key === biz.business_type);
      const activeModuleIds = bizTypeConfig?.module_ids || [];
      const allModules = modulesRes.data || [];
      const activatedModules = allModules.filter(m => activeModuleIds.includes(m.id));

      // Owner access check (using updated_at as proxy)
      const ownerLastAccess = ownerProfile?.updated_at ? new Date(ownerProfile.updated_at) : null;
      const ownerRecentAccess = ownerLastAccess ? ownerLastAccess >= sevenDaysAgo : false;
      const ownerNoAccess14 = ownerLastAccess ? ownerLastAccess < fourteenDaysAgo : true;

      // Plan check
      const planActive = ownerProfile?.subscription_status === 'active';
      const subEnds = ownerProfile?.subscription_ends_at ? new Date(ownerProfile.subscription_ends_at) : null;
      const planExpiringSoon = subEnds ? subEnds.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000 && subEnds > now : false;

      // Health score
      const health = calcHealth({
        hasSalesThisMonth,
        outOfStock,
        totalProducts: products.length,
        hasActiveEmployees: activeEmployees > 0,
        planActive,
        ownerRecentAccess,
      });

      // Alerts
      const alerts: { type: 'error' | 'warning'; message: string }[] = [];
      if (outOfStock > 0) alerts.push({ type: 'error', message: `${outOfStock} producto${outOfStock !== 1 ? 's' : ''} sin stock` });
      if (planExpiringSoon) alerts.push({ type: 'warning', message: 'Plan próximo a vencer (< 7 días)' });
      if (ownerNoAccess14) alerts.push({ type: 'warning', message: 'Dueño sin acceso en más de 14 días' });
      if (!hasSalesLast30) alerts.push({ type: 'warning', message: 'Sin ventas en los últimos 30 días' });

      // Comparativa vs same business type
      const sameBizType = biz.business_type;
      const { data: sameBizAll } = await supabase.from('businesses').select('id, owner_id').eq('business_type', sameBizType);
      const sameTypeBizIds = (sameBizAll || []).map(b => b.id).filter(id => id !== businessId);

      let avgSales = 0, avgProducts = 0, avgEmployees = 0;
      if (sameTypeBizIds.length > 0) {
        const [sameProds, sameEmps, sameBranches2] = await Promise.all([
          supabase.from('products').select('id, business_id').in('business_id', sameTypeBizIds),
          supabase.from('employees').select('id, business_id').in('business_id', sameTypeBizIds),
          supabase.from('branches').select('id, business_id').in('business_id', sameTypeBizIds),
        ]);
        const sameBranchIds = (sameBranches2.data || []).map(b => b.id);
        const { data: sameSalesData } = sameBranchIds.length > 0
          ? await supabase.from('sales').select('total, branch_id').in('branch_id', sameBranchIds).eq('status', 'completed')
              .gte('created_at', monthStart.toISOString()).lte('created_at', monthEnd.toISOString())
          : { data: [] };

        // Group sales by business
        const salesByBiz: Record<string, number> = {};
        const branchToBiz: Record<string, string> = {};
        (sameBranches2.data || []).forEach(b => { branchToBiz[b.id] = b.business_id; });
        (sameSalesData || []).forEach(s => {
          const bid = branchToBiz[s.branch_id];
          if (bid) salesByBiz[bid] = (salesByBiz[bid] || 0) + Number(s.total);
        });
        const salesValues = Object.values(salesByBiz);
        avgSales = salesValues.length > 0 ? salesValues.reduce((a, b) => a + b, 0) / sameTypeBizIds.length : 0;

        const prodsByBiz: Record<string, number> = {};
        (sameProds.data || []).forEach(p => { prodsByBiz[p.business_id] = (prodsByBiz[p.business_id] || 0) + 1; });
        avgProducts = Object.values(prodsByBiz).length > 0
          ? Object.values(prodsByBiz).reduce((a, b) => a + b, 0) / sameTypeBizIds.length : 0;

        const empsByBiz: Record<string, number> = {};
        (sameEmps.data || []).forEach(e => {
          empsByBiz[e.business_id] = (empsByBiz[e.business_id] || 0) + 1;
        });
        avgEmployees = Object.values(empsByBiz).length > 0
          ? Object.values(empsByBiz).reduce((a, b) => a + b, 0) / sameTypeBizIds.length : 0;
      }

      // Timeline: last 5 relevant actions
      const timeline: { icon: string; text: string; date: string }[] = [];

      // Recent sales (already fetched)
      (recentSalesRes.data || []).slice(0, 2).forEach(s => {
        timeline.push({ icon: 'sale', text: `Venta ${s.sale_number || ''} por $${Number(s.total).toFixed(2)}`, date: s.created_at });
      });

      // Recent products
      const { data: recentProducts } = await supabase.from('products').select('name, created_at')
        .eq('business_id', businessId).order('created_at', { ascending: false }).limit(2);
      (recentProducts || []).forEach(p => {
        timeline.push({ icon: 'product', text: `Producto "${p.name}" agregado`, date: p.created_at });
      });

      // Recent employees
      const recentEmps = [...employees].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 2);
      recentEmps.forEach(e => {
        timeline.push({ icon: 'employee', text: `Empleado "${e.full_name}" registrado`, date: e.created_at });
      });

      // Sort timeline by date desc, take 5
      timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return {
        biz,
        owner: ownerProfile,
        branches,
        employees,
        activeEmployees,
        totalProducts: products.length,
        outOfStock,
        lowStock,
        enrichedProducts,
        recentSales: recentSalesRes.data || [],
        totalRevenue,
        salesThisMonth,
        activatedModules,
        bizTypeName: bizTypeConfig?.name || biz.business_type || 'Desconocido',
        health,
        alerts,
        comparativa: {
          salesThisMonth,
          avgSales: Math.round(avgSales),
          products: products.length,
          avgProducts: Math.round(avgProducts),
          employees: activeEmployees,
          avgEmployees: Math.round(avgEmployees),
          count: sameTypeBizIds.length,
        },
        timeline: timeline.slice(0, 5),
        ownerLastAccess,
        planExpiringSoon,
        subEnds,
      };
    },
    enabled: !!businessId,
  });

  const filteredProducts = (data?.enrichedProducts || []).filter(p => {
    if (!productSearch.trim()) return true;
    return p.name.toLowerCase().includes(productSearch.toLowerCase());
  });

  const CompDiff = ({ current, avg }: { current: number; avg: number }) => {
    if (avg === 0) return <span className="text-[11px] text-muted-foreground">—</span>;
    const diff = Math.round(((current - avg) / avg) * 100);
    if (diff > 0) return <span className="flex items-center gap-0.5 text-[11px] font-medium text-emerald-600"><ArrowUpRight className="h-3 w-3" />+{diff}%</span>;
    if (diff < 0) return <span className="flex items-center gap-0.5 text-[11px] font-medium text-destructive"><ArrowDownRight className="h-3 w-3" />{diff}%</span>;
    return <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground"><Minus className="h-3 w-3" />0%</span>;
  };

  const TimelineIcon = ({ type }: { type: string }) => {
    switch (type) {
      case 'sale': return <ShoppingCart className="h-3.5 w-3.5 text-primary" />;
      case 'product': return <PackagePlus className="h-3.5 w-3.5 text-muted-foreground" />;
      case 'employee': return <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />;
      case 'plan': return <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />;
      default: return <Activity className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  return (
    <Sheet open={!!businessId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Store className="h-4 w-4 text-primary" />
            {isLoading ? 'Cargando...' : data?.biz?.name || 'Negocio'}
          </SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <ScrollArea className="flex-1 px-5 pb-5">
            <div className="space-y-4 pt-3">
              {/* Header + Health Score */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={data.biz.is_active !== false ? 'default' : 'secondary'} className="text-[11px]">
                    {data.biz.is_active !== false ? 'Activo' : 'Inactivo'}
                  </Badge>
                  <Badge variant="outline" className="text-[11px]">{data.bizTypeName}</Badge>
                  <Badge variant="outline" className="text-[11px]">{PLAN_LABELS[data.owner?.plan_type || 'free'] || 'Gratuito'}</Badge>
                  <Badge className={`text-[11px] border ${HEALTH_CONFIG[data.health.level].className}`}>
                    {data.health.level === 'healthy' ? <Heart className="h-3 w-3 mr-1" /> :
                     data.health.level === 'warning' ? <ShieldAlert className="h-3 w-3 mr-1" /> :
                     <XCircle className="h-3 w-3 mr-1" />}
                    {HEALTH_CONFIG[data.health.level].label}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  Creado {format(new Date(data.biz.created_at), "d 'de' MMMM yyyy", { locale: es })}
                </div>
              </div>

              {/* § ALERTS */}
              {data.alerts.length > 0 ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-1.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Alertas activas
                  </p>
                  {data.alerts.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {a.type === 'error'
                        ? <XCircle className="h-3 w-3 text-destructive shrink-0" />
                        : <ShieldAlert className="h-3 w-3 text-amber-600 shrink-0" />}
                      <span>{a.message}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                  <p className="text-xs text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Sin alertas activas
                  </p>
                </div>
              )}

              <Separator />

              {/* Owner */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Dueño</p>
                {data.owner ? (
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                      {(data.owner.full_name || '?')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{data.owner.full_name}</p>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {data.owner.email}
                      </p>
                      {data.ownerLastAccess && (
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" /> Último acceso: {format(data.ownerLastAccess, "d MMM yyyy", { locale: es })}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin dueño asignado</p>
                )}
              </div>

              <Separator />

              {/* Modules */}
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Módulos activados</p>
                {data.activatedModules.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {data.activatedModules.map(m => (
                      <Badge key={m.id} variant="secondary" className="text-[11px]">{m.sidebar_label || m.name}</Badge>
                    ))}
                  </div>
                ) : <p className="text-xs text-muted-foreground">Sin módulos</p>}
              </div>

              {/* Portal */}
              {data.biz.slug && (
                <Button variant="outline" size="sm" className="gap-1.5 text-xs w-full" asChild>
                  <a href={`/s/${data.biz.slug}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" /> Ver portal →
                  </a>
                </Button>
              )}

              <Separator />

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-border/60 p-3 text-center">
                  <Building2 className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                  <p className="text-lg font-semibold">{data.branches.length}</p>
                  <p className="text-[10px] text-muted-foreground">Sucursales</p>
                </div>
                <div className="rounded-lg border border-border/60 p-3 text-center">
                  <Users className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                  <p className="text-lg font-semibold">{data.activeEmployees}</p>
                  <p className="text-[10px] text-muted-foreground">Empleados</p>
                </div>
                <div className="rounded-lg border border-border/60 p-3 text-center">
                  <Package className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                  <p className="text-lg font-semibold">{data.totalProducts}</p>
                  <p className="text-[10px] text-muted-foreground">Productos</p>
                  {data.outOfStock > 0 && (
                    <p className="text-[10px] text-destructive flex items-center justify-center gap-0.5 mt-0.5">
                      <AlertTriangle className="h-3 w-3" /> {data.outOfStock} sin stock
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              {/* § COMPARATIVA */}
              {data.comparativa.count > 0 && (
                <>
                  <div className="space-y-2">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      vs otros {data.bizTypeName} ({data.comparativa.count})
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg border border-border/60 p-2.5 text-center">
                        <p className="text-xs font-semibold">${data.comparativa.salesThisMonth.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">Ventas mes</p>
                        <CompDiff current={data.comparativa.salesThisMonth} avg={data.comparativa.avgSales} />
                      </div>
                      <div className="rounded-lg border border-border/60 p-2.5 text-center">
                        <p className="text-xs font-semibold">{data.comparativa.products}</p>
                        <p className="text-[10px] text-muted-foreground">Productos</p>
                        <CompDiff current={data.comparativa.products} avg={data.comparativa.avgProducts} />
                      </div>
                      <div className="rounded-lg border border-border/60 p-2.5 text-center">
                        <p className="text-xs font-semibold">{data.comparativa.employees}</p>
                        <p className="text-[10px] text-muted-foreground">Empleados</p>
                        <CompDiff current={data.comparativa.employees} avg={data.comparativa.avgEmployees} />
                      </div>
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Branches */}
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Sucursales</p>
                <div className="space-y-1.5">
                  {data.branches.map(br => (
                    <div key={br.id} className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{br.name}</span>
                      {br.is_main && <Badge variant="secondary" className="text-[10px] ml-auto shrink-0">Principal</Badge>}
                    </div>
                  ))}
                  {data.branches.length === 0 && <p className="text-xs text-muted-foreground">Sin sucursales</p>}
                </div>
              </div>

              <Separator />

              {/* § INVENTORY DETAIL (collapsible) */}
              <Collapsible open={inventoryOpen} onOpenChange={setInventoryOpen}>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center justify-between w-full group">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Productos ({data.totalProducts})
                    </p>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${inventoryOpen ? 'rotate-180' : ''}`} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2 space-y-2">
                  {data.totalProducts > 5 && (
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input placeholder="Buscar producto..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="pl-8 h-8 text-xs" />
                    </div>
                  )}
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {filteredProducts.length > 0 ? filteredProducts.map(p => (
                      <div key={p.id} className="flex items-center justify-between rounded-md border border-border/60 px-2.5 py-1.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <div className={`h-2 w-2 rounded-full shrink-0 ${
                              p.stockLevel === 'ok' ? 'bg-emerald-500' : p.stockLevel === 'low' ? 'bg-amber-500' : 'bg-destructive'
                            }`} />
                            <span className="text-xs font-medium truncate">{p.name}</span>
                            {p.tipo === 'elaborado' && <ChefHat className="h-3 w-3 text-muted-foreground shrink-0" />}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-muted-foreground">{p.categoryName}</span>
                            <span className="text-[10px] text-muted-foreground">Stock: {p.stock}</span>
                            {p.min_stock > 0 && <span className="text-[10px] text-muted-foreground">Mín: {p.min_stock}</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <p className="text-xs font-medium">${p.sale_price?.toFixed(2) || '0.00'}</p>
                          {p.margin > 0 && <p className="text-[10px] text-emerald-600">{p.margin}% margen</p>}
                        </div>
                      </div>
                    )) : (
                      <p className="text-xs text-muted-foreground text-center py-2">Sin productos</p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              {/* Recent sales */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Ventas recientes</p>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <DollarSign className="h-3 w-3" />
                    Total: ${data.totalRevenue.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                {data.recentSales.length > 0 ? (
                  <div className="space-y-1">
                    {data.recentSales.map(sale => (
                      <div key={sale.id} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
                        <div>
                          <p className="text-sm font-medium">{sale.sale_number || '—'}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {format(new Date(sale.created_at), "d MMM yyyy HH:mm", { locale: es })}
                          </p>
                        </div>
                        <span className="text-sm font-semibold">${Number(sale.total).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-muted-foreground">Sin ventas registradas</p>}
              </div>

              <Separator />

              {/* § TIMELINE */}
              {data.timeline.length > 0 && (
                <>
                  <div className="space-y-2">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Actividad reciente</p>
                    <div className="space-y-2">
                      {data.timeline.map((t, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <div className="mt-0.5"><TimelineIcon type={t.icon} /></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs truncate">{t.text}</p>
                            <p className="text-[10px] text-muted-foreground">{format(new Date(t.date), "d MMM yyyy HH:mm", { locale: es })}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* § ACTIONS */}
              <div className="flex flex-col gap-2">
                {data.owner?.email && (
                  <Button variant="outline" size="sm" className="gap-1.5 justify-start" asChild>
                    <a href={`mailto:${data.owner.email}`}>
                      <MailIcon className="h-3.5 w-3.5" /> Contactar dueño
                    </a>
                  </Button>
                )}
                <Button variant="outline" size="sm" className="gap-1.5 justify-start" onClick={() => { onClose(); onEdit(data.biz); }}>
                  <Pencil className="h-3.5 w-3.5" /> Editar negocio
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 justify-start"
                  onClick={() => onDeactivate(data.biz.id, data.biz.is_active !== false)}
                >
                  <Ban className="h-3.5 w-3.5" />
                  {data.biz.is_active !== false ? 'Desactivar negocio' : 'Activar negocio'}
                </Button>
                {data.owner?.user_id && (
                  <Button variant="outline" size="sm" className="gap-1.5 justify-start" disabled>
                    <Eye className="h-3.5 w-3.5" /> Ver como dueño
                  </Button>
                )}
              </div>
            </div>
          </ScrollArea>
        ) : null}
      </SheetContent>
    </Sheet>
  );
};

export default BusinessDetailSheet;
