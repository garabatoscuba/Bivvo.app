import { cn } from '@/lib/utils';

export type BivooState = 'idle' | 'notification' | 'thinking' | 'responding';

interface BivooFaceProps {
  state: BivooState;
  hasUnread?: boolean;
  className?: string;
}

/**
 * Bivoo face icon: two 'oo' eyes + bottom mouth line.
 * Pure CSS animations for each state.
 */
export default function BivooFace({ state, hasUnread, className }: BivooFaceProps) {
  return (
    <div className={cn('relative', className)}>
      {/* Main face container */}
      <div
        className={cn(
          'relative w-12 h-12 rounded-full bg-primary flex items-center justify-center transition-transform',
          state === 'responding' && 'animate-bivoo-respond',
        )}
      >
        {/* Accent dash above left eye */}
        <div className="absolute top-[8px] left-[11px] w-[5px] h-[2px] rounded-sm bg-primary-foreground" />

        {/* Eyes container */}
        <div
          className={cn(
            'flex items-center gap-[4px]',
            state === 'thinking' && 'animate-bivoo-think',
          )}
        >
          {/* Left eye — ring style */}
          <div
            className={cn(
              'w-[12px] h-[12px] rounded-full border-[2.5px] border-primary-foreground bg-transparent',
              state === 'idle' && 'animate-bivoo-blink',
              state === 'notification' && 'animate-bivoo-blink',
            )}
          />
          {/* Right eye — ring style (slightly larger) */}
          <div
            className={cn(
              'w-[14px] h-[14px] rounded-full border-[2.5px] border-primary-foreground bg-transparent',
              state === 'idle' && 'animate-bivoo-blink',
              state === 'notification' && 'animate-bivoo-blink',
            )}
          />
        </div>

        {/* Mouth — always visible */}
        <div className="absolute bottom-[8px] left-1/2 -translate-x-1/2 w-[6px] h-[2px] rounded-sm bg-primary-foreground" />
      </div>

      {/* Notification dot */}
      {(hasUnread || state === 'notification') && (
        <span
          className={cn(
            'absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-destructive border-2 border-background',
            state === 'notification' && 'animate-bivoo-pulse',
          )}
        />
      )}
    </div>
  );
}
