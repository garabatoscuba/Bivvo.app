import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProducts, useBranchStock } from '@/hooks/useProducts';
import { useBranches } from '@/hooks/useBranches';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useLatestSales } from '@/hooks/useLatestSales';
import { useWeeklySalesHeatmap } from '@/hooks/useWeeklySalesHeatmap';
import { useRawMaterials } from '@/hooks/usePrintData';
import type { Period } from '@/components/ui/period-filter';

import EasyTopbar from './EasyTopbar';
import HumanGreeting from './HumanGreeting';
import EasyPeriodFilter from './EasyPeriodFilter';
import EasyAlertsCard, { type EasyAlert } from './EasyAlertsCard';
import KPICard from './KPICard';
import TopProductsCard from './TopProductsCard';
import LatestSalesCard from './LatestSalesCard';
import WeeklyHeatmap from './WeeklyHeatmap';
import MobileHourlyChart from './MobileHourlyChart';
import RecommendationCard from './RecommendationCard';

interface Props {
  period: Period;
  onPeriodChange: (p: Period) => void;
  businessName: string;
}

const EasyDashboard = ({ period, onPeriodChange, businessName }: Props) => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { products } = useProducts();
  const { data: branches } = useBranches();
  const currentBranch = profile?.branch_id || branches?.[0]?.id;
  const { data: branchStock } = useBranchStock(currentBranch);
  const { data: stats } = useDashboardStats(currentBranch, period);
  const { data: latestSales = [] } = useLatestSales(currentBranch, 6);
  const { data: rawMaterials = [] } = useRawMaterials();
  const { data: weeklyMatrix } = useWeeklySalesHeatmap(currentBranch);

  const lowStockProducts = (branchStock || []).filter((bs: any) => {
    const product = products.find((p) => p.id === bs.product_id);
    return product && bs.quantity <= product.min_stock && bs.quantity > 0;
  });
  const lowStockMaterials = rawMaterials.filter((m: any) => {
    const total = (m.stock_almacen || 0) + (m.stock_vendedor || 0);
    return m.stock_minimo > 0 && total <= m.stock_minimo && total >= 0;
  });

  const alerts: EasyAlert[] = [];
  if (lowStockProducts.length > 0) {
    alerts.push({
      id: 'low-stock-products',
      text: `${lowStockProducts.length} productos por debajo del stock mínimo`,
      actionLabel: 'Ver inventario',
      onAction: () => navigate('/inventory'),
    });
  }
  if (lowStockMaterials.length > 0) {
    alerts.push({
      id: 'low-stock-materials',
      text: `${lowStockMaterials.length} insumos de impresión bajos`,
      actionLabel: 'Ver impresiones',
      onAction: () => navigate('/impresiones'),
    });
  }
  if ((stats?.pendingCredit || 0) > 0) {
    alerts.push({
      id: 'pending-credit',
      text: `Tienes $${Math.round(stats!.pendingCredit)} en ventas a crédito por cobrar`,
      actionLabel: 'Revisar',
      onAction: () => navigate('/sales'),
    });
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'Bivoo';
  const salesSpark = (stats?.salesOverTime || []).map((p) => p.total);
  const stockSpark = Array.from({ length: 14 }, (_, i) => Math.max(0, lowStockProducts.length - (13 - i) + Math.round(Math.sin(i) * 0.6)));
  const cashSpark = Array.from({ length: 14 }, (_, i) => i + 1);

  return (
    <div className="theme-easy min-h-screen">
      <EasyTopbar businessName={businessName} pageTitle="Dashboard" />

      <div className="mx-auto w-full pb-12 pt-5 sm:pt-7 px-3 sm:px-10" style={{ maxWidth: 1400 }}>
        <header className="flex items-start justify-between gap-4 sm:gap-6 mb-5 sm:mb-7 pt-1 flex-wrap">
          <HumanGreeting
            name={firstName}
            salesCount={stats?.salesCount || 0}
            totalToday={stats?.totalSales || 0}
            cashOpen={false}
          />
          <EasyPeriodFilter value={period} onChange={onPeriodChange} />
        </header>

        <EasyAlertsCard alerts={alerts} />

        <section className="grid gap-3 sm:gap-3.5 mb-4 sm:mb-5 grid-cols-1 sm:grid-cols-3">
          <KPICard
            label="Ventas"
            value={`$${new Intl.NumberFormat('es-CU', { maximumFractionDigits: 0 }).format(stats?.totalSales || 0)}`}
            unit="CUP"
            hint="vs. período anterior"
            delta={
              stats
                ? {
                    value: `${stats.totalSalesChange > 0 ? '+' : ''}${stats.totalSalesChange}%`,
                    direction: stats.totalSalesChange > 0 ? 'up' : stats.totalSalesChange < 0 ? 'down' : 'neutral',
                  }
                : undefined
            }
            sparklineData={salesSpark.length > 1 ? salesSpark : [0, 1, 2, 1, 2, 3, 4]}
            sparklineColor="#10D9A0"
            sparklineFillId="sparkGreenEasy"
          />
          <KPICard
            label="Stock crítico"
            value={String(lowStockProducts.length)}
            unit="productos"
            hint="por debajo del mínimo configurado"
            delta={lowStockProducts.length > 0 ? { value: 'atención', direction: 'down' } : { value: 'ok', direction: 'neutral' }}
            sparklineData={stockSpark}
            sparklineColor="#EF4444"
            sparklineFillId="sparkRedEasy"
          />
          <KPICard
            label="Caja actual"
            value={`$${new Intl.NumberFormat('es-CU', { maximumFractionDigits: 0 }).format(stats?.totalSales || 0)}`}
            unit="CUP"
            hint="movimientos del período"
            delta={{ value: 'período', direction: 'neutral' }}
            sparklineData={cashSpark}
            sparklineColor="rgba(255,255,255,0.35)"
            sparklineFillId="sparkNeutralEasy"
          />
        </section>

        <div className="grid gap-3 sm:gap-3.5 mb-4 sm:mb-5 items-stretch grid-cols-1 lg:[grid-template-columns:1fr_1.2fr]">
          <TopProductsCard
            products={(stats?.topProducts || []).map((p) => ({
              name: p.name,
              quantity: p.quantity,
              revenue: p.revenue,
              margin: p.margin,
            }))}
            totalQty={stats?.topProductsTotalQty || 0}
            onViewAll={() => navigate('/inventory')}
            onAdd={() => navigate('/inventory')}
          />
          <LatestSalesCard
            sales={latestSales.map((s) => ({
              id: s.id,
              kind: s.kind,
              saleNumber: s.saleNumber,
              itemsCount: s.itemsCount,
              productName: s.productName,
              customerName: s.customerName,
              paymentType: s.paymentType,
              total: s.total,
              createdAt: s.createdAt,
            }))}
            onViewAll={() => navigate('/sales')}
          />
        </div>

        <div className="hidden sm:block">
          <WeeklyHeatmap matrix={weeklyMatrix} />
        </div>
        <div className="sm:hidden">
          <MobileHourlyChart matrix={weeklyMatrix} salesOverTime={stats?.salesOverTime} period={period} />
        </div>

        <RecommendationCard
          variant="garabatos"
          label="Recomendación"
          labelSecondary="por Estudio Garabatos"
          title={
            <>
              ¿Necesitas <em className="te-font-serif italic font-normal">fotografía profesional</em> para tu negocio?
            </>
          }
          description="En Estudio Garabatos hacemos fotografía de producto, retrato corporativo, eventos y contenido para redes. Eleva la imagen de tu marca con material visual cuidado."
          ctaLabel="Saber más"
        />
        <RecommendationCard
          variant="bivoo"
          className="mt-3.5"
          label="Activar capa"
          labelSecondary="módulo de Bivoo"
          title={
            <>
              ¿Listo para gestionar <em className="te-font-serif italic font-normal">salarios y nómina</em>?
            </>
          }
          description="Activa Nómina cuando quieras calcular pagos automáticos por jornada, comisiones por ventas, deducciones y reportes mensuales."
          ctaLabel="Activar Nómina"
          onCta={() => navigate('/nomina')}
        />

        <div className="flex justify-between items-center mt-9 pt-5 border-t border-[var(--border-subtle)] text-[11.5px] text-[var(--te-text-quaternary)]">
          <span>Bivoo · modo easy</span>
        </div>
      </div>
    </div>
  );
};

export default EasyDashboard;
