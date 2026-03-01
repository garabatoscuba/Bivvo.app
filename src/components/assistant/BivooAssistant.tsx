import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import BivooFace, { type BivooState } from './BivooFace';
import AssistantPanel from './AssistantPanel';
import AssistantContextMenu from './AssistantContextMenu';
import { useToast } from '@/hooks/use-toast';

export default function BivooAssistant() {
  const { isOwner, isManager, isSeller } = useAuth();
  const { unreadCount } = useNotifications();
  const { toast } = useToast();
  const [panelOpen, setPanelOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [faceState, setFaceState] = useState<BivooState>('idle');

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  // Notification state
  const showContextMenu = isOwner || isManager;
  const derivedState: BivooState = faceState !== 'idle' ? faceState : unreadCount > 0 ? 'notification' : 'idle';

  const handleClick = useCallback(() => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    setPanelOpen(prev => !prev);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (!showContextMenu) return;
    e.preventDefault();
    setContextOpen(true);
  }, [showContextMenu]);

  // Long press for mobile
  const handlePointerDown = useCallback(() => {
    if (!showContextMenu) return;
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setContextOpen(true);
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
      toast({
        title: 'Registrar Gasto',
        description: 'El formulario de extracción de Tesorería estará disponible próximamente.',
      });
    } else if (type === 'capital') {
      toast({
        title: 'Inyectar Capital',
        description: 'El formulario de inyección de Tesorería estará disponible próximamente.',
      });
    } else {
      toast({
        title: 'Acción personalizada',
        description: JSON.stringify(payload),
      });
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

  if (showContextMenu) {
    return (
      <>
        <AssistantContextMenu open={contextOpen} onOpenChange={setContextOpen} onAction={handleAction}>
          {button}
        </AssistantContextMenu>
        <AssistantPanel open={panelOpen} onClose={() => setPanelOpen(false)} onStateChange={setFaceState} />
      </>
    );
  }

  return (
    <>
      {button}
      <AssistantPanel open={panelOpen} onClose={() => setPanelOpen(false)} onStateChange={setFaceState} />
    </>
  );
}
