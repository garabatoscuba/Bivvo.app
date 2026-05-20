import { Receipt, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

export interface LatestSale {
  id: string;
  kind?: 'sale' | 'service';
  saleNumber?: string | number | null;
  itemsCount: number;
  productName?: string | null;
  customerName?: string | null;
  paymentType: string;
  total: number;
  createdAt: string;
}

interface Props {
  sales: LatestSale[];
  onViewAll?: () => void;
}

const PAYMENT_META: Record<string, { code: string; cls: string; label: string }> = {
  cash:     { code: 'CT', cls: 'bg-[var(--te-brand-soft)] text-[var(--te-brand)]', label: 'efectivo' },
  card:     { code: 'TJ', cls: 'bg-[var(--te-indigo-soft)] text-[var(--te-indigo)]', label: 'tarjeta' },
  transfer: { code: 'TR', cls: 'bg-[var(--te-blue-soft)] text-[var(--te-blue)]', label: 'transferencia' },
  credit:   { code: 'CR', cls: 'bg-[var(--te-amber-soft)] text-[var(--te-amber)]', label: 'crédito' },
  mixed:    { code: 'MX', cls: 'bg-[var(--te-purple-soft)] text-[var(--te-purple)]', label: 'mixto' },
};

const fmt = (n: number) => new Intl.NumberFormat('es-CU', { maximumFractionDigits: 0 }).format(n);

const LatestSalesCard = ({ sales, onViewAll }: Props) => (
  <section className="overflow-hidden flex flex-col rounded-[var(--te-r-lg)] bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
    <div className="flex items-center justify-between pt-3.5 sm:pt-[18px] px-3.5 sm:px-[22px] pb-3 sm:pb-3.5">
      <div className="flex items-center gap-2 sm:gap-2.5 text-[13px] sm:text-[14.5px] font-semibold text-[var(--te-text-primary)]">
        <div className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-[var(--te-r-sm)] bg-[var(--bg-surface-elevated)] text-[var(--te-text-secondary)]">
          <Receipt className="w-3 h-3 sm:w-3.5 sm:h-3.5" strokeWidth={1.8} />
        </div>
        Últimas ventas
      </div>
      <button
        onClick={onViewAll}
        className="inline-flex items-center gap-1 text-[11.5px] sm:text-[12.5px] text-[var(--te-text-tertiary)] hover:text-[var(--te-text-primary)] transition-colors bg-transparent border-0 cursor-pointer"
      >
        Ver todas
        <ArrowRight className="w-3 h-3" strokeWidth={2} />
      </button>
    </div>

    <div className="px-3.5 sm:px-[22px] pb-3.5 sm:pb-[22px] flex-1">
      {sales.length === 0 && (
        <div className="text-[12.5px] text-[var(--te-text-tertiary)] py-6 text-center">
          Sin ventas recientes.
        </div>
      )}
      {sales.map((s) => {
        const meta = PAYMENT_META[s.paymentType] || { code: '··', cls: 'bg-[var(--bg-surface-elevated)] text-[var(--te-text-secondary)]', label: s.paymentType };
        const time = (() => { try { return format(new Date(s.createdAt), 'HH:mm'); } catch { return ''; } })();
        return (
          <div
            key={s.id}
            className="grid items-center cursor-pointer transition-colors border-t border-[var(--border-subtle)] hover:bg-white/[0.015] [grid-template-columns:28px_1fr_auto_auto] sm:[grid-template-columns:32px_1fr_auto_auto] gap-2.5 sm:gap-3.5 py-3 sm:py-[17px]"
          >
            <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-[var(--te-r-sm)] flex items-center justify-center text-[10.5px] sm:text-[11.5px] font-semibold ${meta.cls}`}>
              {meta.code}
            </div>
            <div className="min-w-0">
              <div className="text-[12.5px] sm:text-[13.5px] font-medium text-[var(--te-text-primary)] truncate">
                {s.kind === 'service'
                  ? (s.productName || 'Servicio')
                  : (s.productName
                      ? `${s.productName}${s.itemsCount > 1 ? ` · ${s.itemsCount} uds` : ''}`
                      : `${s.itemsCount} producto${s.itemsCount === 1 ? '' : 's'}`)}
                {s.saleNumber ? <span className="text-[var(--te-text-tertiary)] font-normal"> · #{s.saleNumber}</span> : null}
              </div>
              <div className="text-[10.5px] sm:text-[11.5px] text-[var(--te-text-tertiary)] mt-0.5 truncate">
                {s.customerName || 'Cliente sin registro'} · {meta.label}
              </div>
            </div>
            <div className="text-[12.5px] sm:text-[14px] font-semibold text-[var(--te-text-primary)] tabular-nums">
              ${fmt(Number(s.total))}
            </div>
            <div className="text-[10.5px] sm:text-[11.5px] text-[var(--te-text-tertiary)] min-w-[40px] sm:min-w-[48px] text-right tabular-nums">
              {time}
            </div>
          </div>
        );
      })}
    </div>
  </section>
);

export default LatestSalesCard;
