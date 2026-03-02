import { cn } from '@/lib/utils';
import bivooFaceSvg from '@/assets/bivoo-face.svg';

export type BivooState = 'idle' | 'notification' | 'thinking' | 'responding';

interface BivooFaceProps {
  state: BivooState;
  hasUnread?: boolean;
  className?: string;
}

export default function BivooFace({ state, hasUnread, className }: BivooFaceProps) {
  return (
    <div className={cn('relative', className)}>
      <div
        className={cn(
          'relative w-12 h-12 rounded-full overflow-hidden transition-transform',
          state === 'thinking' && 'animate-bivoo-think',
          state === 'responding' && 'animate-bivoo-respond',
          state === 'idle' && 'animate-bivoo-blink',
          state === 'notification' && 'animate-bivoo-blink',
        )}
      >
        <img
          src={bivooFaceSvg}
          alt="Bivoo"
          className="w-full h-full object-cover"
          draggable={false}
        />
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
