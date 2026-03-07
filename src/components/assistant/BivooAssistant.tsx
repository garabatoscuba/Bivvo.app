import { useState, useCallback, useRef, useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { useAssistantFeatures } from '@/hooks/useAssistantFeatures';
import { useNavigate } from 'react-router-dom';
import BivooFace, { type BivooState } from './BivooFace';
import AssistantPanel from './AssistantPanel';
import AssistantContextMenu from './AssistantContextMenu';

type VisibleElement = 'none' | 'panel' | 'menu';

export default function BivooAssistant() {
  const { isOwner, isManager } = useAuth();
  const { unreadCount } = useNotifications();
  const { hasAnyFeature, canContextMenu, canNotifications, canChat } = useAssistantFeatures();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [visible, setVisible] = useState<VisibleElement>('none');
  const [faceState, setFaceState] = useState<BivooState>('idle');
  const containerRef = useRef<HTMLDivElement>(null);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  const showContextMenu = canContextMenu && (isOwner || isManager);
  const showNotificationDot = canNotifications && unreadCount > 0 && visible !== 'panel';
  const derivedState: BivooState = faceState !== 'idle' ? faceState : showNotificationDot ? 'notification' : 'idle';

  // Click-outside listener — only on mobile
  useEffect(() => {
    if (visible === 'none' || !isMobile) return;
    const handler = (e: MouseEvent) => {
      if (longPressTriggered.current) return;
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setVisible('none');
      }
    };
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener('mousedown', handler);
    };
  }, [visible, isMobile]);

  const handleClick = useCallback(() => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    if (!canNotifications && !canChat) return;
    setVisible(prev => (prev === 'panel' ? 'none' : 'panel'));
  }, [canNotifications, canChat]);

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
    }, 600);
  }, [showContextMenu]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleAction = useCallback((type: 'gasto' | 'capital' | 'custom', payload?: any) => {
    if (type === 'gasto') {
      navigate('/caja');
    } else if (type === 'capital') {
      navigate('/caja');
    }
  }, [navigate]);

  // Don't render at all if no features available
  if (!hasAnyFeature) return null;

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
      <BivooFace state={derivedState} hasUnread={showNotificationDot} />
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
      {(canNotifications || canChat) && (
        <AssistantPanel
          open={visible === 'panel'}
          onClose={() => setVisible('none')}
          onStateChange={setFaceState}
          canNotifications={canNotifications}
          canChat={canChat}
        />
      )}
    </div>
  );
}
