import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useResolvedBusinessId } from '@/hooks/useResolvedBusinessId';
import { Copy, ShoppingCart, Wrench, AlertTriangle, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface JornadaSummaryBlockProps {
  jornadaId: string;
  aperturaAt: string;
  userId: string;
}

const JornadaSummaryBlock = ({ jornadaId, aperturaAt, userId }: JornadaSummaryBlockProps) => {
  const { businessId, branchId } = useResolvedBusinessId();

  const { data } = useQuery({
    queryKey: ['jornada-summary', jornadaId, businessId],
    queryFn: async (): Promise<{
      salesCount: number; salesTotal: number;
      servicesCount: number; servicesTotal: number;
      mermaCount: number; auditCode: string | null;
    } | null> => {
      if (!businessId) return null;

      const startTime = aperturaAt;
      const endTime = new Date().toISOString();

      // Sales during shift
      const salesQuery = supabase
        .from('sales')
        .select('total')
        .eq('business_id', businessId as string)
        .eq('user_id', userId);
      const { data: sales } = await (salesQuery as any)
        .gte('created_at', startTime)
        .lte('created_at', endTime)
        .neq('status', 'cancelled');

      // Services during shift
      const { data: services } = await supabase
        .from('service_entries')
        .select('amount')
        .eq('business_id', businessId)
        .eq('user_id', userId)
        .gte('created_at', startTime)
        .lte('created_at', endTime);

      // Shrinkage count during shift
      const { count: mermaCount } = await supabase
        .from('inventory_movements')
        .select('*', { count: 'exact', head: true })
        .eq('movement_type', 'loss')
        .eq('user_id', userId)
        .gte('created_at', startTime)
        .lte('created_at', endTime);

      // Audit code for shift_ended
      const { data: auditLog } = await supabase
        .from('audit_logs')
        .select('code')
        .eq('business_id', businessId)
        .eq('action_type', 'shift_ended')
        .eq('entity_id', jornadaId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const totalSales = sales?.reduce((s, r) => s + (Number(r.total) || 0), 0) || 0;
      const totalServices = services?.reduce((s, r) => s + (Number(r.amount) || 0), 0) || 0;

      return {
        salesCount: sales?.length || 0,
        salesTotal: totalSales,
        servicesCount: services?.length || 0,
        servicesTotal: totalServices,
        mermaCount: mermaCount || 0,
        auditCode: auditLog?.code || null,
      };
    },
    enabled: !!businessId && !!jornadaId,
    staleTime: 30_000,
  });

  if (!data) return null;

  const entryTime = new Date(aperturaAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  const exitTime = new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  const diffMin = Math.floor((Date.now() - new Date(aperturaAt).getTime()) / 60000);
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  const durationText = h > 0 ? `${h}h ${m}m` : `${m}m`;

  const copyCode = () => {
    if (data.auditCode) {
      navigator.clipboard.writeText(data.auditCode);
      toast.success('Código copiado');
    }
  };

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
      <p className="text-sm font-semibold">Resumen de tu jornada</p>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Ventas</p>
            <p className="font-medium">{data.salesCount} — ${data.salesTotal.toFixed(2)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Servicios</p>
            <p className="font-medium">{data.servicesCount} — ${data.servicesTotal.toFixed(2)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Mermas</p>
            <p className="font-medium">{data.mermaCount}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Horario</p>
            <p className="font-medium">{entryTime} → {exitTime} ({durationText})</p>
          </div>
        </div>
      </div>

      {data.auditCode && (
        <div className="rounded-md border bg-background p-3 text-center space-y-1">
          <div className="flex items-center justify-center gap-2">
            <span className="font-mono text-sm font-semibold">{data.auditCode}</span>
            <button onClick={copyCode} className="text-muted-foreground hover:text-foreground transition-colors">
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Guarda este código como comprobante de tu jornada.</p>
        </div>
      )}
    </div>
  );
};

export default JornadaSummaryBlock;
