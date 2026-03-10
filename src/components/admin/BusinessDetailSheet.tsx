import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Store, Building2, Users, Package, ShoppingCart, ExternalLink,
  Pencil, Ban, Eye, Loader2, Calendar, Mail, DollarSign, AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';
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

const BusinessDetailSheet = ({ businessId, onClose, onEdit, onDeactivate }: BusinessDetailSheetProps) => {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-biz-detail', businessId],
    queryFn: async () => {
      if (!businessId) throw new Error('No id');

      const [
        bizRes, branchesRes, employeesRes, productsRes, salesRes, modulesRes, bizTypeRes,
      ] = await Promise.all([
        supabase.from('businesses').select('*').eq('id', businessId).maybeSingle(),
        supabase.from('branches').select('id, name, is_main, address, slug').eq('business_id', businessId).order('is_main', { ascending: false }),
        supabase.from('employees').select('id, status').eq('business_id', businessId),
        supabase.from('products').select('id, name, business_id').eq('business_id', businessId),
        supabase.from('sales').select('id, total, created_at, status, sale_number').eq('status', 'completed').order('created_at', { ascending: false }).limit(5),
        supabase.from('platform_modules').select('id, name, sidebar_label, is_active'),
        supabase.from('business_type_configs').select('id, key, name, module_ids, is_active'),
      ]);

      const biz = bizRes.data;
      if (!biz) throw new Error('Not found');

      // Get owner profile
      const { data: ownerProfile } = biz.owner_id
        ? await supabase.from('profiles').select('id, full_name, email, plan_type, user_id').eq('id', biz.owner_id).maybeSingle()
        : { data: null };

      // Filter sales by business branches
      const branchIds = (branchesRes.data || []).map(b => b.id);
      const { data: bizSales } = await supabase
        .from('sales')
        .select('id, total, created_at, status, sale_number, branch_id')
        .in('branch_id', branchIds.length > 0 ? branchIds : ['__none__'])
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(5);

      // Total revenue
      const { data: allSales } = await supabase
        .from('sales')
        .select('total')
        .in('branch_id', branchIds.length > 0 ? branchIds : ['__none__'])
        .eq('status', 'completed');

      const totalRevenue = (allSales || []).reduce((s, v) => s + Number(v.total), 0);

      // Products with stock
      const { data: stockData } = await supabase
        .from('branch_stock')
        .select('product_id, quantity')
        .in('branch_id', branchIds.length > 0 ? branchIds : ['__none__']);

      const productIds = (productsRes.data || []).map(p => p.id);
      const stockMap: Record<string, number> = {};
      (stockData || []).forEach(s => {
        stockMap[s.product_id] = (stockMap[s.product_id] || 0) + s.quantity;
      });
      const outOfStock = productIds.filter(id => (stockMap[id] || 0) <= 0).length;

      // Modules activated for this biz type
      const bizTypeConfig = (bizTypeRes.data || []).find(c => c.key === biz.business_type);
      const activeModuleIds = bizTypeConfig?.module_ids || [];
      const allModules = modulesRes.data || [];
      const activatedModules = allModules.filter(m => activeModuleIds.includes(m.id));

      const employees = employeesRes.data || [];

      return {
        biz,
        owner: ownerProfile,
        branches: branchesRes.data || [],
        employees,
        activeEmployees: employees.filter(e => (e as any).status !== 'inactive').length,
        totalProducts: productsRes.data?.length || 0,
        outOfStock,
        recentSales: bizSales || [],
        totalRevenue,
        activatedModules,
        bizTypeName: bizTypeConfig?.name || biz.business_type || 'Desconocido',
      };
    },
    enabled: !!businessId,
  });

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
            <div className="space-y-5 pt-3">
              {/* Header info */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={data.biz.is_active !== false ? 'default' : 'secondary'} className="text-[11px]">
                    {data.biz.is_active !== false ? 'Activo' : 'Inactivo'}
                  </Badge>
                  <Badge variant="outline" className="text-[11px]">{data.bizTypeName}</Badge>
                  <Badge variant="outline" className="text-[11px]">{PLAN_LABELS[data.owner?.plan_type || 'free'] || 'Gratuito'}</Badge>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  Creado {format(new Date(data.biz.created_at), "d 'de' MMMM yyyy", { locale: es })}
                </div>
              </div>

              <Separator />

              {/* Owner */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Dueño</p>
                {data.owner ? (
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                      {(data.owner.full_name || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{data.owner.full_name}</p>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {data.owner.email}
                      </p>
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
                      <Badge key={m.id} variant="secondary" className="text-[11px]">
                        {m.sidebar_label || m.name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Sin módulos</p>
                )}
              </div>

              {/* Portal link */}
              {data.biz.slug && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs w-full"
                  asChild
                >
                  <a href={`/s/${data.biz.slug}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Ver portal →
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
                        <span className="text-sm font-semibold">
                          ${Number(sale.total).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Sin ventas registradas</p>
                )}
              </div>

              {/* Action buttons */}
              <Separator />
              <div className="flex flex-col gap-2">
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
