import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import BivooFace, { type BivooState } from './BivooFace';
import AssistantPanel from './AssistantPanel';
import AssistantContextMenu from './AssistantContextMenu';
import { useToast } from '@/hooks/use-toast';

type VisibleElement = 'none' | 'panel' | 'menu';

export default function BivooAssistant() {
  const { isOwner, isManager } = useAuth();
  const { unreadCount } = useNotifications();
  const { toast } = useToast();
  const [visible, setVisible] = useState<VisibleElement>('none');
  const [faceState, setFaceState] = useState<BivooState>('idle');
  const containerRef = useRef<HTMLDivElement>(null);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  const showContextMenu = isOwner || isManager;
  const derivedState: BivooState = faceState !== 'idle' ? faceState : unreadCount > 0 ? 'notification' : 'idle';

  // Click-outside listener
  useEffect(() => {
    if (visible === 'none') return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setVisible('none');
      }
    };
    // Delay so the current click doesn't immediately close
    const id = setTimeout(() => document.addEventListener('click', handler), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener('click', handler);
    };
  }, [visible]);

  const handleClick = useCallback(() => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    setVisible(prev => (prev === 'panel' ? 'none' : 'panel'));
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (!showContextMenu) return;
    e.preventDefault();
    setVisible(prev => (prev === 'menu' ? 'none' : 'menu'));
  }, [showContextMenu]);

  const handlePointerDown = useCallback(() => {
    if (!showContextMenu) return;
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setVisible('menu');
    }, 500);
  }, [showContextMenu]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleAction = useCallback((type: 'gasto' | 'capital' | 'custom', payload?: any) => {
    if (type === 'gasto') {
      toast({ title: 'Registrar Gasto', description: 'El formulario de extracción de Tesorería estará disponible próximamente.' });
    } else if (type === 'capital') {
      toast({ title: 'Inyectar Capital', description: 'El formulario de inyección de Tesorería estará disponible próximamente.' });
    } else {
      toast({ title: 'Acción personalizada', description: JSON.stringify(payload) });
    }
  }, [toast]);

  const button = (
    <button
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="fixed bottom-4 right-4 z-[55] select-none touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
      aria-label="Asistente Bivoo"
    >
      <BivooFace state={derivedState} hasUnread={unreadCount > 0} />
    </button>
  );

  return (
    <div ref={containerRef}>
      {showContextMenu ? (
        <AssistantContextMenu
          open={visible === 'menu'}
          onOpenChange={(open) => setVisible(open ? 'menu' : 'none')}
          onAction={handleAction}
        >
          {button}
        </AssistantContextMenu>
      ) : (
        button
      )}
      <AssistantPanel
        open={visible === 'panel'}
        onClose={() => setVisible('none')}
        onStateChange={setFaceState}
      />
    </div>
  );
}
