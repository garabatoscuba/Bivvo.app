import { useState, useEffect, useRef } from 'react';
import { Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/contexts/AuthContext';
import { getIconComponent } from '@/components/services/IconSelector';

interface ContextAction {
  id: string;
  label: string;
  icon: string;
  action_type: string;
  action_payload: any;
}

interface AssistantContextMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAction: (type: 'gasto' | 'capital' | 'custom', payload?: any) => void;
  children: React.ReactNode;
}

export default function AssistantContextMenu({ open, onOpenChange, onAction, children }: AssistantContextMenuProps) {
  const [actions, setActions] = useState<ContextAction[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { isOwner, isSuperAdmin } = useAuth();

  useEffect(() => {
    supabase
      .from('assistant_context_actions')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        if (data) setActions(data as unknown as ContextAction[]);
      });
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => { clearTimeout(id); document.removeEventListener('mousedown', handler); };
  }, [open, onOpenChange]);

  const handleAction = (a: ContextAction) => {
    onOpenChange(false);
    const value = a.action_payload?.value || '';

    if (a.action_type === 'treasury_action') {
      if (value === 'gasto') onAction('gasto');
      else if (value === 'capital') onAction('capital');
      else onAction('custom', a.action_payload);
    } else if (a.action_type === 'navigate') {
      navigate(value);
    } else {
      onAction('custom', a.action_payload);
    }
  };

  return (
    <>
      {children}
      {open && (
        <div
          ref={menuRef}
          className="fixed bottom-[72px] right-4 z-[60] w-48 p-1.5 rounded-lg border bg-popover shadow-md animate-scale-in"
        >
          {actions.map((a) => {
            const Icon = getIconComponent(a.icon) || Zap;
            return (
              <button
                key={a.id}
                onClick={() => handleAction(a)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-muted/60 transition-colors text-foreground"
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                {a.label}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
