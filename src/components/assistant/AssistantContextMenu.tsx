import { useState, useEffect, useRef } from 'react';
import { TrendingDown, TrendingUp, Zap, Landmark } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
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
  const [customActions, setCustomActions] = useState<ContextAction[]>([]);
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
        if (data) setCustomActions(data as unknown as ContextAction[]);
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

  const handleAbrirCaja = () => {
    onOpenChange(false);
    if (isOwner || isSuperAdmin) {
      navigate('/tesoreria');
    } else {
      navigate('/caja');
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
          <button
            onClick={() => { onAction('gasto'); onOpenChange(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-muted/60 transition-colors text-foreground"
          >
            <TrendingDown className="h-4 w-4 text-destructive" />
            +Gasto
          </button>
          <button
            onClick={() => { onAction('capital'); onOpenChange(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-muted/60 transition-colors text-foreground"
          >
            <TrendingUp className="h-4 w-4 text-primary" />
            +Capital
          </button>
          <button
            onClick={handleAbrirCaja}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-muted/60 transition-colors text-foreground"
          >
            <Landmark className="h-4 w-4 text-muted-foreground" />
            Abrir Caja
          </button>
          {customActions.map((a) => {
            const Icon = getIconComponent(a.icon) || Zap;
            return (
              <button
                key={a.id}
                onClick={() => { onAction('custom', a.action_payload); onOpenChange(false); }}
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
