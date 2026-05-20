import type { ReactNode } from 'react';
import { Camera, CreditCard, ArrowRight } from 'lucide-react';

interface Props {
  variant: 'garabatos' | 'bivoo';
  label: string;
  labelSecondary: string;
  title: ReactNode;
  description: string;
  ctaLabel: string;
  onCta?: () => void;
  icon?: ReactNode;
  className?: string;
}

const RecommendationCard = ({
  variant, label, labelSecondary, title, description, ctaLabel, onCta, icon, className,
}: Props) => {
  const isBivoo = variant === 'bivoo';

  const bgGradient = isBivoo
    ? 'linear-gradient(135deg, var(--te-brand-soft) 0%, rgba(16, 217, 160, 0.02) 60%, transparent 100%)'
    : 'linear-gradient(135deg, var(--te-amber-soft) 0%, rgba(245, 158, 11, 0.02) 60%, transparent 100%)';

  const iconWrapCls = isBivoo
    ? 'bg-[var(--te-brand-soft)] text-[var(--te-brand)]'
    : 'bg-[var(--te-amber-soft)] text-[var(--te-amber)]';

  const labelCls = isBivoo ? 'text-[var(--te-brand)]' : 'text-[var(--te-amber)]';

  const ctaCls = isBivoo
    ? 'bg-[var(--te-brand)] text-[var(--te-brand-text)] hover:bg-[var(--te-brand-bright)]'
    : 'bg-[var(--te-text-primary)] text-[var(--bg-app)] hover:opacity-90';

  const defaultIcon = isBivoo
    ? <CreditCard className="w-[22px] h-[22px]" strokeWidth={1.8} />
    : <Camera className="w-[22px] h-[22px]" strokeWidth={1.8} />;

  return (
    <div
      className={`relative overflow-hidden rounded-[var(--te-r-lg)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 px-4 py-4 sm:px-6 sm:py-[22px] ${className || ''}`}
    >
      <div className="absolute inset-0 pointer-events-none" style={{ background: bgGradient }} />
      <div className="flex items-start gap-3 sm:contents">
        <div className={`relative w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-[var(--te-r-md)] flex-shrink-0 ${iconWrapCls}`}>
          {icon || defaultIcon}
        </div>
        <div className="flex-1 relative min-w-0">
          <div className={`text-[10.5px] sm:text-[11px] font-semibold tracking-[0.6px] uppercase mb-1 flex items-center gap-2 flex-wrap ${labelCls}`}>
            <span>{label}</span>
            <span className="w-[3px] h-[3px] rounded-full bg-[var(--te-text-quaternary)]" />
            <span className="te-font-serif italic text-[12px] text-[var(--te-text-tertiary)] normal-case font-normal whitespace-nowrap" style={{ letterSpacing: 0 }}>
              {labelSecondary}
            </span>
          </div>
          <div className="text-[15px] sm:text-[16px] font-semibold text-[var(--te-text-primary)] mb-1 leading-[1.3]">
            {title}
          </div>
          <div className="text-[12.5px] sm:text-[13px] text-[var(--te-text-secondary)] leading-[1.5]">
            {description}
          </div>
        </div>
      </div>
      <button
        onClick={onCta}
        className={`relative inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-[var(--te-r-md)] text-[13px] font-medium cursor-pointer flex-shrink-0 transition-opacity border-0 w-full sm:w-auto ${ctaCls}`}
      >
        {ctaLabel}
        <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
      </button>
    </div>
  );
};

export default RecommendationCard;
