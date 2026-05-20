import { ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Props {
  name: string;
  salesCount: number;
  totalToday: number;
  cashOpen: boolean;
  currency?: string;
}

const greetingByHour = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 18) return 'Buenas tardes';
  return 'Buenas noches';
};

const formatMoney = (n: number) =>
  new Intl.NumberFormat('es-CU', { maximumFractionDigits: 0 }).format(n);

const HumanGreeting = ({ name, salesCount, totalToday, cashOpen, currency = 'CUP' }: Props) => {
  const dateStr = format(new Date(), "EEEE d 'de' MMMM", { locale: es });

  return (
    <div>
      <h1 className="text-[32px] font-normal leading-[1.15] tracking-[-0.5px] text-[var(--te-text-primary)]">
        {greetingByHour()},
        <em className="te-font-serif italic font-normal text-[var(--te-brand)] ml-1 tracking-normal">
          {name}
        </em>
        <button
          type="button"
          title="Gestionar capas activas"
          className="inline-flex items-center gap-1.5 ml-3.5 p-0 bg-transparent border-0 text-[var(--te-brand)] text-[13px] font-medium cursor-pointer align-middle relative hover:opacity-80 transition-opacity"
          style={{ top: '-8px' }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full bg-[var(--te-brand)]"
            style={{ boxShadow: '0 0 0 3px rgba(16, 217, 160, 0.18)' }}
          />
          <span className="inline-flex items-baseline gap-1">
            modo <span className="font-semibold">easy</span>
          </span>
          <ChevronDown className="w-[11px] h-[11px] opacity-70 ml-0.5" strokeWidth={2.2} />
        </button>
      </h1>

      <div className="mt-2 text-[13.5px] text-[var(--te-text-tertiary)] flex items-center gap-2.5 flex-wrap">
        <span className="capitalize">{dateStr}</span>
        <span className="w-[3px] h-[3px] rounded-full bg-[var(--te-text-quaternary)]" />
        <span>{salesCount} ventas hoy</span>
        <span className="w-[3px] h-[3px] rounded-full bg-[var(--te-text-quaternary)]" />
        <span>${formatMoney(totalToday)} facturado</span>
        {cashOpen && (
          <>
            <span className="w-[3px] h-[3px] rounded-full bg-[var(--te-text-quaternary)]" />
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--te-brand-soft)] text-[var(--te-brand)] text-[11px] font-medium">
              <span className="w-[5px] h-[5px] rounded-full bg-[var(--te-brand)]" />
              Caja abierta
            </span>
          </>
        )}
      </div>
    </div>
  );
};

export default HumanGreeting;
