import { Star, ArrowRight, Plus } from 'lucide-react';

export interface TopProduct {
  name: string;
  quantity: number;
  revenue?: number;
  margin?: number;
}

interface Props {
  products: TopProduct[];
  totalQty: number;
  currency?: string;
  onViewAll?: () => void;
  onAdd?: () => void;
}

const fmt = (n: number) => new Intl.NumberFormat('es-CU', { maximumFractionDigits: 0 }).format(n);

const TopProductsCard = ({ products, totalQty, currency = 'CUP', onViewAll, onAdd }: Props) => {
  const star = products[0];
  const rest = products.slice(1, 10);
  const maxRest = rest[0]?.quantity || 1;
  const sharePct = star && totalQty > 0 ? Math.round((star.quantity / totalQty) * 100) : 0;

  return (
    <section className="overflow-hidden flex flex-col rounded-[var(--te-r-lg)] bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
      <div className="flex items-center justify-between pt-[18px] px-[22px] pb-3.5">
        <div className="flex items-center gap-2.5 text-[14.5px] font-semibold text-[var(--te-text-primary)]">
          <div className="w-7 h-7 flex items-center justify-center rounded-[var(--te-r-sm)] bg-[var(--bg-surface-elevated)] text-[var(--te-text-secondary)]">
            <Star className="w-3.5 h-3.5" strokeWidth={1.8} />
          </div>
          Más vendidos
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={onViewAll}
            className="inline-flex items-center gap-1.5 bg-transparent border-0 p-0 text-[12.5px] font-medium text-[var(--te-text-tertiary)] hover:text-[var(--te-text-primary)] transition-colors cursor-pointer"
          >
            Ver todo
            <ArrowRight className="w-3 h-3" strokeWidth={2.2} />
          </button>
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 bg-transparent border-0 p-0 text-[12.5px] font-medium text-[var(--te-brand)] hover:text-[var(--te-brand-bright)] transition-colors cursor-pointer"
          >
            <Plus className="w-3 h-3" strokeWidth={2.2} />
            Añadir
          </button>
        </div>
      </div>

      {star ? (
        <>
          <div
            className="mx-[22px] mb-4 p-5 rounded-[var(--te-r-md)] relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, var(--te-brand-soft) 0%, rgba(16, 217, 160, 0.02) 100%)',
              border: '1px solid rgba(16, 217, 160, 0.18)',
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-[var(--te-brand)] uppercase tracking-[0.6px]">
                <Star className="w-3 h-3" strokeWidth={2.2} />
                Producto estrella
              </div>
              <div className="inline-flex items-baseline gap-1 tabular-nums">
                <span className="te-font-serif italic text-[28px] text-[var(--te-brand)] leading-none font-normal">
                  {sharePct}%
                </span>
                <span className="text-[12px] text-[var(--te-text-tertiary)] font-medium">del total</span>
              </div>
            </div>
            <div className="text-[17px] font-semibold text-[var(--te-text-primary)] mt-2 mb-3.5 truncate">
              {star.name}
            </div>
            <div className="flex gap-7">
              <Stat label="Vendidos" value={String(star.quantity)} unit="unidades" />
              <Divider />
              <Stat
                label="Ingresos"
                value={`$${fmt(star.revenue ?? 0)}`}
                unit={currency}
              />
              <Divider />
              <Stat
                label="Margen"
                value={`$${fmt(star.margin ?? 0)}`}
                unit={currency}
              />
            </div>
          </div>

          <div className="te-podium-scroll-wrap flex-1">
            <div className="te-no-scrollbar overflow-y-auto px-[22px] pb-8" style={{ maxHeight: 280 }}>
              {rest.map((p, i) => {
                const pct = Math.round((p.quantity / maxRest) * 100);
                return (
                  <div
                    key={`${p.name}-${i}`}
                    className="grid items-center py-3.5 border-t border-[var(--border-subtle)]"
                    style={{ gridTemplateColumns: '24px auto 1fr auto', gap: 14 }}
                  >
                    <div className="te-font-serif italic text-[20px] text-[var(--te-text-tertiary)] text-center leading-none">
                      {i + 2}
                    </div>
                    <div
                      className="text-[13px] font-medium text-[var(--te-text-primary)] whitespace-nowrap overflow-hidden text-ellipsis"
                      style={{ maxWidth: 180 }}
                    >
                      {p.name}
                    </div>
                    <div className="w-full min-w-[40px] h-1 rounded bg-white/[0.05] overflow-hidden">
                      <div
                        className="h-full rounded"
                        style={{ width: `${pct}%`, background: 'var(--te-brand)', opacity: 0.6 }}
                      />
                    </div>
                    <div className="text-[12px] text-[var(--te-text-tertiary)] tabular-nums min-w-[28px] text-right">
                      {p.quantity}
                    </div>
                  </div>
                );
              })}
              {rest.length === 0 && (
                <div className="text-[12.5px] text-[var(--te-text-tertiary)] py-6 text-center">
                  Sin más productos en este período.
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="px-[22px] pb-8 text-[12.5px] text-[var(--te-text-tertiary)]">
          Sin ventas registradas en este período.
        </div>
      )}
    </section>
  );
};

const Stat = ({ label, value, unit }: { label: string; value: string; unit?: string }) => (
  <div>
    <div className="text-[11px] text-[var(--te-text-tertiary)] mb-1">{label}</div>
    <div className="text-[18px] font-semibold text-[var(--te-text-primary)] tabular-nums leading-none">
      {value}
      {unit && <span className="text-[12px] text-[var(--te-text-tertiary)] font-medium ml-0.5">{unit}</span>}
    </div>
  </div>
);

const Divider = () => <div className="w-px bg-[rgba(16,217,160,0.18)]" />;

export default TopProductsCard;
