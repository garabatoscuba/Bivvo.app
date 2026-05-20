import { AlertTriangle, ArrowRight } from 'lucide-react';

export interface EasyAlert {
  id: string;
  text: string;
  actionLabel: string;
  onAction?: () => void;
}

interface Props {
  alerts: EasyAlert[];
}

const EasyAlertsCard = ({ alerts }: Props) => {
  if (!alerts.length) return null;

  return (
    <section
      className="flex gap-3.5 items-start p-4 px-5 mb-5 rounded-[var(--te-r-lg)] bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
      style={{ borderLeft: '3px solid var(--te-amber)' }}
    >
      <div className="w-8 h-8 flex items-center justify-center rounded-[var(--te-r-sm)] bg-[var(--te-amber-soft)] text-[var(--te-amber)] flex-shrink-0">
        <AlertTriangle className="w-4 h-4" strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[13.5px] font-semibold text-[var(--te-text-primary)]">
            Cosas que revisar
          </span>
          <span className="text-[11px] font-medium text-[var(--te-amber)] bg-[var(--te-amber-soft)] px-2 py-0.5 rounded-full">
            {alerts.length}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          {alerts.map((a) => (
            <div key={a.id} className="flex items-center gap-2.5 text-[12.5px] text-[var(--te-text-secondary)] py-1">
              <span className="w-1 h-1 rounded-full bg-[var(--te-amber)] flex-shrink-0" />
              <span className="flex-1 min-w-0 truncate">{a.text}</span>
              <button
                onClick={a.onAction}
                className="ml-auto text-[11.5px] text-[var(--te-text-tertiary)] cursor-pointer inline-flex items-center gap-1 hover:text-[var(--te-text-primary)] transition-colors bg-transparent border-0"
              >
                {a.actionLabel}
                <ArrowRight className="w-[11px] h-[11px]" strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default EasyAlertsCard;
