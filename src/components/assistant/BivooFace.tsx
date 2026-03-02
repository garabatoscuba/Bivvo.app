import { cn } from '@/lib/utils';
import bivooFaceSvg from '@/assets/bivoo-face.svg';

export type BivooState = 'idle' | 'notification' | 'thinking' | 'responding';

interface BivooFaceProps {
  state: BivooState;
  hasUnread?: boolean;
  className?: string;
}

const keyframesStyle = `
@keyframes bivoo-breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.04); }
}
@keyframes bivoo-think {
  0%, 100% { transform: translateX(-4px); }
  50% { transform: translateX(4px); }
}
@keyframes bivoo-respond {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}
@keyframes bivoo-dot-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
`;

export default function BivooFace({ state, hasUnread, className }: BivooFaceProps) {
  return (
    <div className={cn('relative', className)}>
      <style>{keyframesStyle}</style>
      <div
        className="relative w-12 h-12 rounded-full overflow-hidden"
        style={{
          animation:
            state === 'thinking'
              ? 'bivoo-think 0.6s ease-in-out infinite'
              : state === 'responding'
                ? 'bivoo-respond 0.8s ease-in-out infinite'
                : state === 'idle'
                  ? 'bivoo-breathe 3s ease-in-out infinite'
                  : 'none',
        }}
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
          className="absolute -top-0.5 -right-0.5 w-[10px] h-[10px] rounded-full bg-destructive border-2 border-background"
          style={{
            animation: 'bivoo-dot-pulse 1.5s ease-in-out infinite',
          }}
        />
      )}
    </div>
  );
}
